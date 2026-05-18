"""Firestore data access for face clusters."""

from __future__ import annotations

from datetime import datetime, timezone

from google.cloud.firestore import Client as FirestoreClient
from google.cloud.firestore_v1 import ArrayUnion, Increment

from app.domain.models import FaceCluster
from app.repositories.collections import FACE_CLUSTERS


class FaceClusterRepository:
    """CRUD + light query layer for ``/faceClusters``.

    The collection is intentionally flat (not nested under /galleries) so we
    can serve gallery-scoped queries with a single composite index.
    """

    def __init__(self, db: FirestoreClient) -> None:
        self._db = db
        self._col = db.collection(FACE_CLUSTERS)

    # ------------------------------------------------------------------ list

    def list_for_gallery(self, gallery_id: str) -> list[FaceCluster]:
        query = self._col.where("galleryId", "==", gallery_id)
        clusters = [
            FaceCluster.model_validate({"id": doc.id, **(doc.to_dict() or {})})
            for doc in query.stream()
        ]
        # Order client-side: biggest cluster first, then by creation order.
        # Doing this here avoids requiring yet another composite index.
        clusters.sort(key=lambda c: (-c.photo_count, c.created_at))
        return clusters

    def list_open_for_gallery(self, gallery_id: str) -> list[FaceCluster]:
        return [c for c in self.list_for_gallery(gallery_id) if c.status == "open"]

    def get(self, cluster_id: str) -> FaceCluster | None:
        snap = self._col.document(cluster_id).get()
        if not snap.exists:
            return None
        return FaceCluster.model_validate({"id": snap.id, **(snap.to_dict() or {})})

    # ----------------------------------------------------------------- write

    def create(
        self,
        *,
        gallery_id: str,
        studio_id: str,
        centroid: list[float],
        photo_id: str,
        photo_image_url: str | None,
        photo_thumbnail_url: str | None,
        face_bbox: list[float],
        face_score: float,
    ) -> FaceCluster:
        """Create a new cluster seeded with one face from one photo."""
        ref = self._col.document()
        now = datetime.now(timezone.utc)
        payload = {
            "id": ref.id,
            "galleryId": gallery_id,
            "studioId": studio_id,
            "centroid": centroid,
            "photoCount": 1,
            "photoIds": [photo_id],
            "representativePhotoId": photo_id,
            "representativePhotoUrl": photo_image_url,
            "representativeThumbnailUrl": photo_thumbnail_url,
            "representativeBbox": face_bbox,
            "representativeScore": face_score,
            "status": "open",
            "albumId": None,
            "createdAt": now,
            "updatedAt": now,
        }
        ref.set(payload)
        return FaceCluster.model_validate(payload)

    def add_photo(
        self,
        cluster_id: str,
        *,
        photo_id: str,
        new_centroid: list[float],
        # Optional representative refresh — caller compares face score.
        better_representative: dict | None = None,
    ) -> None:
        """Add a photo to the cluster's `photoIds` and refresh the centroid.

        We track membership at the **photo** granularity rather than the
        face granularity to keep the array bounded by the gallery size.
        Repeated additions of the same photo (e.g. two faces of the same
        person in one frame) are de-duplicated via `ArrayUnion`.
        """
        patch: dict = {
            "centroid": new_centroid,
            "photoIds": ArrayUnion([photo_id]),
            "updatedAt": datetime.now(timezone.utc),
        }
        if better_representative is not None:
            patch.update(better_representative)
        # `photoCount` is incremented only when the photo was not already
        # in the array — the caller signals that via `better_representative`
        # carrying a `photoCount` field; otherwise we skip the increment.
        self._col.document(cluster_id).update(patch)

    def bump_photo_count(self, cluster_id: str, *, delta: int = 1) -> None:
        self._col.document(cluster_id).update(
            {
                "photoCount": Increment(delta),
                "updatedAt": datetime.now(timezone.utc),
            }
        )

    def mark_promoted(self, cluster_id: str, *, album_id: str) -> None:
        self._col.document(cluster_id).update(
            {
                "status": "promoted",
                "albumId": album_id,
                "updatedAt": datetime.now(timezone.utc),
            }
        )

    def mark_dismissed(self, cluster_id: str) -> None:
        self._col.document(cluster_id).update(
            {"status": "dismissed", "updatedAt": datetime.now(timezone.utc)}
        )

    def remove_photo(self, cluster_id: str, photo_id: str) -> None:
        """Hard-delete the photo from a cluster.

        Used when a photo is removed from the gallery — keeping orphan ids
        around would mislead the UI counters.
        """
        from google.cloud.firestore_v1 import ArrayRemove

        self._col.document(cluster_id).update(
            {
                "photoIds": ArrayRemove([photo_id]),
                "photoCount": Increment(-1),
                "updatedAt": datetime.now(timezone.utc),
            }
        )

    def delete_for_gallery(self, gallery_id: str) -> int:
        """Delete every cluster of a gallery — used when the gallery itself
        is deleted. Returns the number of docs removed."""
        deleted = 0
        for doc in self._col.where("galleryId", "==", gallery_id).stream():
            doc.reference.delete()
            deleted += 1
        return deleted
