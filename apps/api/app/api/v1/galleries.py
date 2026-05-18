"""Galleries HTTP layer (scoped to the current user's studio)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.api.deps import CurrentUser, GalleryRepoDep, StudioServiceDep
from app.domain.models import Gallery

router = APIRouter(prefix="/galleries", tags=["galleries"])


class CreateGalleryBody(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=500)


def _require_studio_id(user_uid: str, service) -> str:  # noqa: ANN001
    studio = service.get_for_owner(user_uid)
    if studio is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You must create a studio before managing galleries.",
        )
    return studio.id


@router.get("", response_model=list[Gallery], summary="List galleries for the current studio")
def list_galleries(
    user: CurrentUser,
    service: StudioServiceDep,
    galleries: GalleryRepoDep,
) -> list[Gallery]:
    studio_id = _require_studio_id(user.uid, service)
    return galleries.list_for_studio(studio_id)


@router.post(
    "",
    response_model=Gallery,
    status_code=status.HTTP_201_CREATED,
    summary="Create a gallery",
)
def create_gallery(
    body: CreateGalleryBody,
    user: CurrentUser,
    service: StudioServiceDep,
    galleries: GalleryRepoDep,
) -> Gallery:
    studio_id = _require_studio_id(user.uid, service)
    return galleries.create(
        studio_id=studio_id, title=body.title, description=body.description
    )


@router.get("/{gallery_id}", response_model=Gallery, summary="Get a gallery by id")
def get_gallery(gallery_id: str, user: CurrentUser, galleries: GalleryRepoDep) -> Gallery:
    gallery = galleries.get_by_id(gallery_id)
    if gallery is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gallery not found.")
    _ = user
    return gallery


@router.delete(
    "/{gallery_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a gallery",
)
def delete_gallery(
    gallery_id: str,
    user: CurrentUser,
    service: StudioServiceDep,
    galleries: GalleryRepoDep,
) -> None:
    studio_id = _require_studio_id(user.uid, service)
    gallery = galleries.get_by_id(gallery_id)
    if gallery is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gallery not found.")
    if gallery.studio_id != studio_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="You do not own this gallery."
        )
    galleries.delete(gallery_id)
