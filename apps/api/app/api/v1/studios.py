"""Studios HTTP layer."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.api.deps import CurrentUser, StudioServiceDep
from app.domain.models import Studio
from app.services.slug_service import InvalidSlugError
from app.services.studio_service import (
    CreateStudioCommand,
    StudioAlreadyExistsError,
    StudioNotFoundError,
)

router = APIRouter(prefix="/studios", tags=["studios"])


class CreateStudioBody(BaseModel):
    name: str = Field(min_length=2, max_length=80)


@router.post(
    "",
    response_model=Studio,
    status_code=status.HTTP_201_CREATED,
    summary="Create the authenticated user's studio",
)
def create_studio(
    body: CreateStudioBody,
    user: CurrentUser,
    service: StudioServiceDep,
) -> Studio:
    try:
        return service.create(CreateStudioCommand(owner_id=user.uid, name=body.name))
    except StudioAlreadyExistsError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except InvalidSlugError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc


@router.get("/me", response_model=Studio, summary="Get the current user's studio")
def get_my_studio(user: CurrentUser, service: StudioServiceDep) -> Studio:
    studio = service.get_for_owner(user.uid)
    if studio is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No studio for this user.")
    return studio


@router.get("/by-slug/{slug}", response_model=Studio, summary="Public lookup by slug")
def get_studio_by_slug(slug: str, service: StudioServiceDep) -> Studio:
    try:
        return service.get_by_slug(slug)
    except StudioNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
