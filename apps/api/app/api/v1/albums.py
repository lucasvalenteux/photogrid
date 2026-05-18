"""Albums HTTP layer — curated photo selections inside a gallery."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.api.deps import AlbumRepoDep, CurrentUser, GalleryRepoDep, StudioServiceDep
from app.domain.models import Album

router = APIRouter(prefix="/albums", tags=["albums"])


class CreateAlbumBody(BaseModel):
    gallery_id: str = Field(min_length=1, alias="galleryId")
    title: str = Field(min_length=1, max_length=120)
    subject_name: str | None = Field(default=None, max_length=120, alias="subjectName")


class SetAlbumPhotosBody(BaseModel):
    photo_ids: list[str] = Field(alias="photoIds")


def _require_studio_id(user_uid: str, service) -> str:  # noqa: ANN001
    studio = service.get_for_owner(user_uid)
    if studio is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You must create a studio before managing albums.",
        )
    return studio.id


@router.get("", response_model=list[Album], summary="List albums inside a gallery")
def list_albums(
    gallery_id: str,
    user: CurrentUser,
    service: StudioServiceDep,
    galleries: GalleryRepoDep,
    albums: AlbumRepoDep,
) -> list[Album]:
    studio_id = _require_studio_id(user.uid, service)
    gallery = galleries.get_by_id(gallery_id)
    if gallery is None or gallery.studio_id != studio_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gallery not found.")
    return albums.list_for_gallery(gallery_id)


@router.post(
    "",
    response_model=Album,
    status_code=status.HTTP_201_CREATED,
    summary="Create an album inside a gallery",
)
def create_album(
    body: CreateAlbumBody,
    user: CurrentUser,
    service: StudioServiceDep,
    galleries: GalleryRepoDep,
    albums: AlbumRepoDep,
) -> Album:
    studio_id = _require_studio_id(user.uid, service)
    gallery = galleries.get_by_id(body.gallery_id)
    if gallery is None or gallery.studio_id != studio_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gallery not found.")
    return albums.create(
        studio_id=studio_id,
        gallery_id=body.gallery_id,
        title=body.title,
        subject_name=body.subject_name,
    )


@router.put(
    "/{album_id}/photos",
    response_model=Album,
    summary="Replace the album's photo selection",
)
def set_album_photos(
    album_id: str,
    body: SetAlbumPhotosBody,
    user: CurrentUser,
    service: StudioServiceDep,
    albums: AlbumRepoDep,
) -> Album:
    studio_id = _require_studio_id(user.uid, service)
    album = albums.get_by_id(album_id)
    if album is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Album not found.")
    if album.studio_id != studio_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="You do not own this album."
        )
    albums.set_photos(album_id, body.photo_ids)
    refreshed = albums.get_by_id(album_id)
    assert refreshed is not None  # noqa: S101
    return refreshed


@router.delete(
    "/{album_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an album",
)
def delete_album(
    album_id: str,
    user: CurrentUser,
    service: StudioServiceDep,
    albums: AlbumRepoDep,
) -> None:
    studio_id = _require_studio_id(user.uid, service)
    album = albums.get_by_id(album_id)
    if album is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Album not found.")
    if album.studio_id != studio_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="You do not own this album."
        )
    albums.delete(album_id)
