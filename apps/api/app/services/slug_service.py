"""Slug generation + validation. Mirrors the rules used by the web client."""

from __future__ import annotations

from slugify import slugify as _slugify

from app.repositories.studio_repository import StudioRepository

SLUG_MIN_LENGTH = 3
SLUG_MAX_LENGTH = 40
RESERVED_SLUGS: frozenset[str] = frozenset(
    {
        "admin",
        "api",
        "app",
        "auth",
        "dashboard",
        "login",
        "logout",
        "onboarding",
        "photogrid",
        "pricing",
        "settings",
        "signup",
        "studio",
        "support",
        "terms",
        "privacy",
        "www",
    }
)


class InvalidSlugError(ValueError):
    """Raised when a slug fails validation."""


def slugify(value: str) -> str:
    """URL-safe slugified version of ``value``, clamped to SLUG_MAX_LENGTH."""
    return _slugify(value, lowercase=True, max_length=SLUG_MAX_LENGTH)


def validate_slug(slug: str) -> None:
    if len(slug) < SLUG_MIN_LENGTH:
        raise InvalidSlugError("Slug is too short.")
    if len(slug) > SLUG_MAX_LENGTH:
        raise InvalidSlugError("Slug is too long.")
    if not slug.replace("-", "").isalnum():
        raise InvalidSlugError("Slug contains invalid characters.")
    if slug in RESERVED_SLUGS:
        raise InvalidSlugError("Slug is reserved.")


class SlugService:
    """Locates an available slug for a given studio name."""

    def __init__(self, studio_repo: StudioRepository, max_attempts: int = 20) -> None:
        self._studios = studio_repo
        self._max_attempts = max_attempts

    def find_available(self, name: str) -> str:
        base = slugify(name) or "studio"
        for attempt in range(self._max_attempts):
            candidate = base if attempt == 0 else f"{base}-{attempt + 1}"
            try:
                validate_slug(candidate)
            except InvalidSlugError:
                continue
            if not self._studios.slug_exists(candidate):
                return candidate
        raise InvalidSlugError("Could not derive a unique slug from the given name.")
