"""Studio use cases."""

from __future__ import annotations

from dataclasses import dataclass

from app.domain.models import Studio
from app.repositories.studio_repository import SlugTakenError, StudioRepository
from app.services.slug_service import InvalidSlugError, SlugService


class StudioNotFoundError(Exception):
    pass


class StudioAlreadyExistsError(Exception):
    pass


@dataclass(slots=True)
class CreateStudioCommand:
    owner_id: str
    name: str


class StudioService:
    def __init__(self, repo: StudioRepository, slugs: SlugService) -> None:
        self._repo = repo
        self._slugs = slugs

    def create(self, cmd: CreateStudioCommand) -> Studio:
        name = cmd.name.strip()
        if len(name) < 2:
            raise InvalidSlugError("Studio name is too short.")
        if self._repo.list_for_owner(cmd.owner_id):
            raise StudioAlreadyExistsError("This owner already has a studio.")
        slug = self._slugs.find_available(name)
        try:
            return self._repo.create_with_slug(owner_id=cmd.owner_id, name=name, slug=slug)
        except SlugTakenError as exc:
            raise StudioAlreadyExistsError(str(exc)) from exc

    def get_by_slug(self, slug: str) -> Studio:
        studio = self._repo.get_by_slug(slug)
        if studio is None:
            raise StudioNotFoundError(f"No studio found for slug '{slug}'.")
        return studio

    def get_for_owner(self, owner_id: str) -> Studio | None:
        studios = self._repo.list_for_owner(owner_id)
        return studios[0] if studios else None
