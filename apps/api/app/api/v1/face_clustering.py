"""Face clustering HTTP layer.

Endpoints under ``/api/v1/face-clustering`` orchestrate the InsightFace-
based pipeline:

  - ``POST   /process-photo``                 process one photo (auto-run on
                                              upload by the web app)
  - ``GET    /galleries/{id}/clusters``       list cluster suggestions
  - ``POST   /clusters/{id}/promote``         turn a cluster into an album
  - ``POST   /clusters/{id}/dismiss``         hide a cluster from suggestions
"""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from google.cloud.firestore_v1 import Increment
from pydantic import BaseModel, Field

from app.api.deps import (
    AlbumRepoDep,
    CurrentUser,
    GalleryRepoDep,
    StudioServiceDep,
)
from app.core.firebase import get_firestore
from app.domain.models import FaceCluster
from app.repositories.collections import GALLERIES
from app.repositories.face_cluster_repository import FaceClusterRepository
from app.repositories.photo_faces_repository import PhotoFacesRepository
from app.services.face_clustering_service import FaceClusteringService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/face-clustering", tags=["face-clustering"])


# ---------------------------------------------------------------------------
# Dependency wiring
# ---------------------------------------------------------------------------


def _db():  # noqa: ANN202
    return get_firestore()


def _face_cluster_repo(db=Depends(_db)) -> FaceClusterRepository:  # noqa: ANN001
    return FaceClusterRepository(db)


def _photo_faces_repo(db=Depends(_db)) -> PhotoFacesRepository:  # noqa: ANN001
    return PhotoFacesRepository(db)


def _face_clustering_service(
    clusters: FaceClusterRepository = Depends(_face_cluster_repo),
    photo_faces: PhotoFacesRepository = Depends(_photo_faces_repo),
) -> FaceClusteringService:
    return FaceClusteringService(clusters, photo_faces)


FaceClusterRepoDep = Annotated[FaceClusterRepository, Depends(_face_cluster_repo)]
PhotoFacesRepoDep = Annotated[PhotoFacesRepository, Depends(_photo_faces_repo)]
FaceClusteringServiceDep = Annotated[
    FaceClusteringService, Depends(_face_clustering_service)
]


# ---------------------------------------------------------------------------
# Bodies
# ---------------------------------------------------------------------------


class ProcessPhotoBody(BaseModel):
    photo_id: str = Field(min_length=1, alias="photoId")
    gallery_id: str = Field(min_length=1, alias="galleryId")
    # The web app pushes the URLs alongside the request so the API can avoid
    # an extra Firestore read just to discover where the bytes live.
    image_url: str = Field(min_length=1, alias="imageUrl")
    thumbnail_url: str | None = Field(default=None, alias="thumbnailUrl")
    force: bool = False


class PromoteClusterBody(BaseModel):
    # The web app passes the gallery title so we can use it to derive the
    # album title in the format "Gallery title #01".
    gallery_title: str = Field(min_length=1, alias="galleryTitle")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _require_studio_id(user_uid: str, service) -> str:  # noqa: ANN001
    studio = service.get_for_owner(user_uid)
    if studio is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You must create a studio before using face clustering.",
        )
    return studio.id


def _next_suggested_album_title(
    gallery_title: str, existing_titles: list[str]
) -> str:
    """Return the next 'Gallery #NN' title that doesn't collide with an
    existing album. Numbering starts at #01 and skips already-used ones."""
    used: set[int] = set()
    prefix = f"{gallery_title} #"
    for title in existing_titles:
        if not title.startswith(prefix):
            continue
        suffix = title[len(prefix):].strip()
        if suffix.isdigit():
            used.add(int(suffix))
    n = 1
    while n in used:
        n += 1
    return f"{gallery_title} #{n:02d}"


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post(
    "/process-photo",
    summary="Detect faces in a photo and update clusters incrementally",
    status_code=status.HTTP_202_ACCEPTED,
)
def process_photo(
    body: ProcessPhotoBody,
    user: CurrentUser,
    service: StudioServiceDep,
    galleries: GalleryRepoDep,
    face_clusters: FaceClusterRepoDep,
    photo_faces: PhotoFacesRepoDep,
    clustering: FaceClusteringServiceDep,
    background: BackgroundTasks,
) -> dict[str, str]:
    """Queue a photo for processing.

    Ownership is verified synchronously (cheap) but the heavy lifting —
    downloading the image and running InsightFace — is deferred to a
    background task so the web app can fire-and-forget after each upload.
    """
    studio_id = _require_studio_id(user.uid, service)
    gallery = galleries.get_by_id(body.gallery_id)
    if gallery is None or gallery.studio_id != studio_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Gallery not found."
        )

    def _run() -> None:
        try:
            clustering.process_photo(
                photo_id=body.photo_id,
                gallery_id=body.gallery_id,
                studio_id=studio_id,
                image_url=body.image_url,
                thumbnail_url=body.thumbnail_url,
                force=body.force,
            )
        except Exception:
            # Background failures must never crash the server — just log
            # and move on. The next upload will retry implicitly via
            # `force=False` when the user opens the gallery.
            logger.exception(
                "Face clustering failed for photo %s", body.photo_id
            )

    background.add_task(_run)
    return {"status": "queued", "photoId": body.photo_id}


@router.get(
    "/galleries/{gallery_id}/clusters",
    response_model=list[FaceCluster],
    summary="List face clusters for a gallery",
)
def list_clusters(
    gallery_id: str,
    user: CurrentUser,
    service: StudioServiceDep,
    galleries: GalleryRepoDep,
    face_clusters: FaceClusterRepoDep,
) -> list[FaceCluster]:
    studio_id = _require_studio_id(user.uid, service)
    gallery = galleries.get_by_id(gallery_id)
    if gallery is None or gallery.studio_id != studio_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Gallery not found."
        )
    return face_clusters.list_for_gallery(gallery_id)


@router.post(
    "/clusters/{cluster_id}/promote",
    summary="Convert a cluster into an album",
    status_code=status.HTTP_201_CREATED,
)
def promote_cluster(
    cluster_id: str,
    body: PromoteClusterBody,
    user: CurrentUser,
    service: StudioServiceDep,
    galleries: GalleryRepoDep,
    albums: AlbumRepoDep,
    face_clusters: FaceClusterRepoDep,
) -> dict[str, str]:
    studio_id = _require_studio_id(user.uid, service)
    cluster = face_clusters.get(cluster_id)
    if cluster is None or cluster.studio_id != studio_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Cluster not found."
        )
    if cluster.status == "promoted" and cluster.album_id is not None:
        # Idempotency: re-clicking "create album" returns the existing one
        # instead of producing duplicates.
        return {"albumId": cluster.album_id, "status": "already_promoted"}

    gallery = galleries.get_by_id(cluster.gallery_id)
    if gallery is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Gallery not found."
        )

    existing_titles = [a.title for a in albums.list_for_gallery(cluster.gallery_id)]
    title = _next_suggested_album_title(body.gallery_title, existing_titles)

    cover_url = (
        cluster.representative_thumbnail_url or cluster.representative_photo_url
    )

    album = albums.create(
        studio_id=studio_id,
        gallery_id=cluster.gallery_id,
        title=title,
        subject_name=title,
        photo_ids=cluster.photo_ids,
        cover_photo_url=cover_url,
        visibility="unlisted",
    )

    # Bump the gallery's denormalised `albumCount` so the dashboard list
    # stays in sync without waiting for the reconciler.
    try:
        db = get_firestore()
        db.collection(GALLERIES).document(cluster.gallery_id).update(
            {"albumCount": Increment(1)}
        )
    except Exception:
        logger.warning("Failed to bump albumCount", exc_info=True)

    face_clusters.mark_promoted(cluster_id, album_id=album.id)
    return {"albumId": album.id, "status": "promoted"}


@router.post(
    "/clusters/{cluster_id}/dismiss",
    summary="Dismiss a cluster suggestion",
    status_code=status.HTTP_204_NO_CONTENT,
)
def dismiss_cluster(
    cluster_id: str,
    user: CurrentUser,
    service: StudioServiceDep,
    face_clusters: FaceClusterRepoDep,
) -> None:
    studio_id = _require_studio_id(user.uid, service)
    cluster = face_clusters.get(cluster_id)
    if cluster is None or cluster.studio_id != studio_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Cluster not found."
        )
    face_clusters.mark_dismissed(cluster_id)


@router.post(
    "/galleries/{gallery_id}/consolidate",
    summary="Merge clusters with overlapping centroids",
)
def consolidate_gallery(
    gallery_id: str,
    user: CurrentUser,
    service: StudioServiceDep,
    galleries: GalleryRepoDep,
    clustering: FaceClusteringServiceDep,
) -> dict[str, int | str]:
    """Run the centroid-overlap merge pass for a single gallery.

    Useful right after a backfill (when the same person ends up in
    several near-duplicate clusters) or any time the photographer wants
    to clean up suggestions. Idempotent — clusters whose centroids are
    well separated stay untouched.
    """
    studio_id = _require_studio_id(user.uid, service)
    gallery = galleries.get_by_id(gallery_id)
    if gallery is None or gallery.studio_id != studio_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Gallery not found."
        )
    merged = clustering.consolidate_clusters(gallery_id)
    return {"galleryId": gallery_id, "merged": merged}
