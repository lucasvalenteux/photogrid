"""Face detection + incremental clustering using InsightFace.

Design notes
------------

We use InsightFace's `FaceAnalysis` app which bundles SCRFD detection and an
ArcFace recognition head behind a single call. Both models live under
``$INSIGHTFACE_HOME`` (baked into the Docker image during build, so cold
starts don't pay the 300 MB model download).

Clustering is **incremental**: every new photo's faces are compared to the
existing cluster centroids in the same gallery — assigned to the nearest one
if cosine similarity passes a threshold, otherwise seeded into a fresh
cluster. The centroid is the running mean of member embeddings, re-
normalised to unit length on every update so cosine similarity stays a
simple dot product. This is O(faces × clusters) per photo — plenty fast for
photographers' galleries (tens to thousands of photos with at most a few
hundred unique people).
"""

from __future__ import annotations

import io
import logging
import threading
from datetime import datetime, timezone
from typing import Iterable

import httpx
import numpy as np
from PIL import Image

from app.domain.models import DetectedFace, FaceCluster
from app.repositories.face_cluster_repository import FaceClusterRepository
from app.repositories.photo_faces_repository import PhotoFacesRepository

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Tuning knobs
# ---------------------------------------------------------------------------

# Cosine similarity threshold above which a face is considered a match for
# an existing cluster. ArcFace embeddings tend to cluster very tightly
# (same person ≈ 0.55+, different person ≈ 0.05–0.30) so 0.40 is a safe,
# slightly conservative default. Bump higher if you see false-merges.
SIMILARITY_THRESHOLD = 0.40

# Faces below this score are treated as low-confidence noise (blurred
# bystanders, profile shots through windows, etc.) and skipped.
MIN_DETECTION_SCORE = 0.55

# Faces smaller than this many pixels on their shortest edge are ignored.
# In a 640px-edge thumbnail this filters out background figures while
# keeping anyone large enough to be a portrait subject.
MIN_FACE_PIXELS = 48

# Hard ceiling on faces processed per photo — prevents pathological group
# shots from inflating cluster math.
MAX_FACES_PER_PHOTO = 25


# ---------------------------------------------------------------------------
# Lazy singleton — InsightFace's FaceAnalysis is expensive to construct
# (~2 GB resident, ~10 s init) so we share one instance process-wide. The
# library is thread-safe for inference once `.prepare()` has been called.
# ---------------------------------------------------------------------------

# Model pack name. `buffalo_sc` is the small/lightweight pack — ~50 MB on
# disk, ~400 MB resident with detection + recognition only. Quality is
# very close to `buffalo_l` for the clustering task (recognition recall is
# within ~1-2% at the cosine thresholds we use) but lets the service run
# on a 1 GB Railway plan. Bump back to `buffalo_l` if you migrate to a
# larger instance and want the extra accuracy headroom.
MODEL_PACK = "buffalo_sc"

_face_app = None
_face_app_lock = threading.Lock()


def _get_face_app():
    global _face_app
    if _face_app is not None:
        return _face_app
    with _face_app_lock:
        if _face_app is not None:
            return _face_app
        # Imported lazily so module import (and unit tests that don't touch
        # face logic) don't pay the heavy import cost.
        import insightface

        logger.info("Initialising InsightFace FaceAnalysis (%s)…", MODEL_PACK)
        # `allowed_modules` skips the age / gender / landmarks heads we
        # never read — saves ~150 MB of resident memory and shaves
        # ~100 ms off each inference call. Combined with the smaller
        # `buffalo_sc` pack this comfortably fits in a 1 GB Railway plan.
        #
        # We don't pass an `onnxruntime.SessionOptions` here because
        # InsightFace's FaceAnalysis -> model_zoo.get_model pipeline only
        # forwards `providers` / `provider_options`. Thread / memory
        # controls are instead set via process-level env vars
        # (`OMP_NUM_THREADS=1`, `ORT_DISABLE_GLOBAL_THREAD_POOL=1`) in
        # the Dockerfile.
        app = insightface.app.FaceAnalysis(
            name=MODEL_PACK,
            providers=["CPUExecutionProvider"],
            allowed_modules=["detection", "recognition"],
        )
        # ctx_id=-1 means CPU. det_size=640 is the documented sweet spot
        # for SCRFD; dropping to 480 would save ~50 MB more if needed.
        app.prepare(ctx_id=-1, det_size=(640, 640))
        _face_app = app
        logger.info("InsightFace ready.")
        return _face_app


# ---------------------------------------------------------------------------
# Public service
# ---------------------------------------------------------------------------


class FaceClusteringService:
    """Stateful service: detects faces in a photo, then assigns them to
    clusters within the photo's gallery."""

    def __init__(
        self,
        clusters: FaceClusterRepository,
        photo_faces: PhotoFacesRepository,
    ) -> None:
        self._clusters = clusters
        self._photo_faces = photo_faces

    # ----------------------------------------------------- public entrypoint

    def process_photo(
        self,
        *,
        photo_id: str,
        gallery_id: str,
        studio_id: str,
        image_url: str,
        thumbnail_url: str | None = None,
        force: bool = False,
    ) -> list[FaceCluster]:
        """Detect faces in the photo and update gallery clusters.

        Returns the clusters touched during processing (created or modified)
        so the caller can surface them in API responses.
        """
        if not force and self._photo_faces.exists(photo_id):
            logger.info("photo %s already processed, skipping", photo_id)
            return []

        # Prefer the thumbnail for inference — detection works fine at
        # 640 px, and pulling the original (often 5–10 MB) would dominate
        # latency. Fall back to the full image if no thumb exists.
        source_url = thumbnail_url or image_url
        try:
            image = _download_image(source_url)
        except Exception:
            logger.exception("photo %s: failed to download image", photo_id)
            raise

        try:
            faces = _detect_faces(image)
        except Exception:
            logger.exception("photo %s: face detection crashed", photo_id)
            raise

        # Compute the input image's dimensions in absolute pixels so we
        # can normalise face bboxes if a caller wants them later.
        h, w = image.shape[:2]
        filtered: list[DetectedFace] = []
        for face in faces[:MAX_FACES_PER_PHOTO]:
            score = float(face.det_score)
            if score < MIN_DETECTION_SCORE:
                continue
            bbox = [float(v) for v in face.bbox.tolist()]  # x1, y1, x2, y2
            face_w = bbox[2] - bbox[0]
            face_h = bbox[3] - bbox[1]
            if min(face_w, face_h) < MIN_FACE_PIXELS:
                continue
            embedding = face.normed_embedding.astype(np.float32)
            filtered.append(
                DetectedFace(
                    bbox=bbox,
                    score=score,
                    embedding=embedding.tolist(),
                    cluster_id=None,
                )
            )

        touched_clusters: dict[str, FaceCluster] = {}

        if filtered:
            existing = self._clusters.list_for_gallery(gallery_id)
            # `open` + `dismissed` clusters still anchor centroid math so we
            # don't re-create them; `promoted` clusters are frozen — once
            # the user turned a cluster into an album, additions to it
            # would unintentionally grow that album.
            assignable = [c for c in existing if c.status == "open"]

            for face in filtered:
                emb = np.asarray(face.embedding, dtype=np.float32)
                match = _best_match(emb, assignable)
                if match is not None:
                    cluster, similarity = match
                    new_centroid = _update_centroid(
                        np.asarray(cluster.centroid, dtype=np.float32),
                        cluster.photo_count,
                        emb,
                    )
                    is_new_photo = photo_id not in cluster.photo_ids
                    rep_patch = self._maybe_better_representative(
                        cluster=cluster,
                        face=face,
                        photo_id=photo_id,
                        image_url=image_url,
                        thumbnail_url=thumbnail_url,
                        is_new_photo=is_new_photo,
                    )
                    self._clusters.add_photo(
                        cluster.id,
                        photo_id=photo_id,
                        new_centroid=new_centroid.tolist(),
                        better_representative=rep_patch,
                    )
                    if is_new_photo:
                        self._clusters.bump_photo_count(cluster.id, delta=1)
                        cluster.photo_count += 1
                        cluster.photo_ids.append(photo_id)
                    cluster.centroid = new_centroid.tolist()
                    face.cluster_id = cluster.id
                    touched_clusters[cluster.id] = cluster
                else:
                    new_cluster = self._clusters.create(
                        gallery_id=gallery_id,
                        studio_id=studio_id,
                        centroid=emb.tolist(),
                        photo_id=photo_id,
                        photo_image_url=image_url,
                        photo_thumbnail_url=thumbnail_url,
                        face_bbox=face.bbox,
                        face_score=face.score,
                    )
                    face.cluster_id = new_cluster.id
                    assignable.append(new_cluster)
                    touched_clusters[new_cluster.id] = new_cluster

        # Persist the detection record either way — even a "no faces"
        # outcome should be remembered so we don't retry on every call.
        self._photo_faces.save(
            photo_id=photo_id,
            gallery_id=gallery_id,
            studio_id=studio_id,
            faces=filtered,
        )
        return list(touched_clusters.values())

    # ------------------------------------------------------- internal helpers

    @staticmethod
    def _maybe_better_representative(
        *,
        cluster: FaceCluster,
        face: DetectedFace,
        photo_id: str,
        image_url: str,
        thumbnail_url: str | None,
        is_new_photo: bool,
    ) -> dict | None:
        """Pick a new cluster representative when this face is the strongest
        we've seen for it. Keeping the *highest-scoring* face makes the
        cluster's gallery card look intentional rather than random."""
        if face.score <= cluster.representative_score and not is_new_photo:
            return None
        if face.score <= cluster.representative_score:
            return None
        return {
            "representativePhotoId": photo_id,
            "representativePhotoUrl": image_url,
            "representativeThumbnailUrl": thumbnail_url,
            "representativeBbox": face.bbox,
            "representativeScore": face.score,
        }


# ---------------------------------------------------------------------------
# Math helpers
# ---------------------------------------------------------------------------


def _l2_normalise(vec: np.ndarray) -> np.ndarray:
    norm = float(np.linalg.norm(vec))
    if norm == 0.0:
        return vec
    return vec / norm


def _update_centroid(
    centroid: np.ndarray, photo_count: int, new_embedding: np.ndarray
) -> np.ndarray:
    """Online mean of normalised embeddings, kept on the unit sphere."""
    weighted = centroid * photo_count + new_embedding
    return _l2_normalise(weighted)


def _best_match(
    embedding: np.ndarray, clusters: Iterable[FaceCluster]
) -> tuple[FaceCluster, float] | None:
    """Find the closest cluster above `SIMILARITY_THRESHOLD`. None on miss."""
    best: tuple[FaceCluster, float] | None = None
    for cluster in clusters:
        centroid = np.asarray(cluster.centroid, dtype=np.float32)
        if centroid.shape != embedding.shape:
            continue
        similarity = float(np.dot(centroid, embedding))
        if similarity < SIMILARITY_THRESHOLD:
            continue
        if best is None or similarity > best[1]:
            best = (cluster, similarity)
    return best


# ---------------------------------------------------------------------------
# Image fetch + decode
# ---------------------------------------------------------------------------


def _download_image(url: str) -> np.ndarray:
    """Pull an image from Firebase Storage signed URL and return BGR ndarray.

    InsightFace's pipelines expect numpy arrays in OpenCV's BGR order, so we
    decode through PIL then swap channels — avoids dragging in the heavier
    `cv2.imdecode` for the simple network-fetch case.
    """
    with httpx.Client(timeout=30.0, follow_redirects=True) as client:
        resp = client.get(url)
        resp.raise_for_status()
        img = Image.open(io.BytesIO(resp.content)).convert("RGB")
    rgb = np.asarray(img, dtype=np.uint8)
    bgr = rgb[..., ::-1]  # RGB -> BGR
    return bgr


def _detect_faces(image_bgr: np.ndarray):
    """Run InsightFace's combined detection + recognition pipeline."""
    app = _get_face_app()
    return app.get(image_bgr)
