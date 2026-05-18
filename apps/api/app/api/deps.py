"""FastAPI dependency wiring (repository + service constructors)."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from app.core.firebase import get_firestore
from app.core.security import AuthUser, get_current_user
from app.repositories.album_repository import AlbumRepository
from app.repositories.gallery_repository import GalleryRepository
from app.repositories.studio_repository import StudioRepository
from app.services.slug_service import SlugService
from app.services.studio_service import StudioService


def _firestore_client():  # noqa: ANN202 - exposed via Depends
    return get_firestore()


def _studio_repo(db=Depends(_firestore_client)) -> StudioRepository:  # noqa: ANN001
    return StudioRepository(db)


def _gallery_repo(db=Depends(_firestore_client)) -> GalleryRepository:  # noqa: ANN001
    return GalleryRepository(db)


def _album_repo(db=Depends(_firestore_client)) -> AlbumRepository:  # noqa: ANN001
    return AlbumRepository(db)


def _slug_service(repo: StudioRepository = Depends(_studio_repo)) -> SlugService:
    return SlugService(repo)


def _studio_service(
    repo: StudioRepository = Depends(_studio_repo),
    slugs: SlugService = Depends(_slug_service),
) -> StudioService:
    return StudioService(repo, slugs)


CurrentUser = Annotated[AuthUser, Depends(get_current_user)]
StudioRepoDep = Annotated[StudioRepository, Depends(_studio_repo)]
GalleryRepoDep = Annotated[GalleryRepository, Depends(_gallery_repo)]
AlbumRepoDep = Annotated[AlbumRepository, Depends(_album_repo)]
StudioServiceDep = Annotated[StudioService, Depends(_studio_service)]
