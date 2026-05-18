"""Firestore data access for studios + slug reservations."""

from __future__ import annotations

from datetime import datetime, timezone

from google.cloud.firestore import Client as FirestoreClient
from google.cloud.firestore_v1 import SERVER_TIMESTAMP

from app.domain.models import Studio
from app.repositories.collections import SLUGS, STUDIOS, USERS


class StudioRepository:
    """All studio reads/writes funnel through here so the service layer stays clean."""

    def __init__(self, db: FirestoreClient) -> None:
        self._db = db

    def get_by_id(self, studio_id: str) -> Studio | None:
        snap = self._db.collection(STUDIOS).document(studio_id).get()
        if not snap.exists:
            return None
        data = snap.to_dict() or {}
        return Studio.model_validate({"id": snap.id, **data})

    def get_by_slug(self, slug: str) -> Studio | None:
        slug_snap = self._db.collection(SLUGS).document(slug).get()
        if not slug_snap.exists:
            return None
        slug_data = slug_snap.to_dict() or {}
        studio_id = slug_data.get("studioId")
        if not isinstance(studio_id, str):
            return None
        return self.get_by_id(studio_id)

    def list_for_owner(self, owner_id: str) -> list[Studio]:
        query = self._db.collection(STUDIOS).where("ownerId", "==", owner_id)
        return [
            Studio.model_validate({"id": doc.id, **(doc.to_dict() or {})})
            for doc in query.stream()
        ]

    def create_with_slug(self, *, owner_id: str, name: str, slug: str) -> Studio:
        """Atomically reserve the slug, create the studio doc, link the user."""
        studio_ref = self._db.collection(STUDIOS).document()
        slug_ref = self._db.collection(SLUGS).document(slug)
        user_ref = self._db.collection(USERS).document(owner_id)

        transaction = self._db.transaction()

        @transaction.transactional  # type: ignore[misc]
        def _commit(tx) -> None:  # noqa: ANN001 — google's transactional decorator types
            if slug_ref.get(transaction=tx).exists:
                raise SlugTakenError(slug)
            now = SERVER_TIMESTAMP
            tx.set(
                studio_ref,
                {
                    "id": studio_ref.id,
                    "ownerId": owner_id,
                    "name": name,
                    "slug": slug,
                    "createdAt": now,
                },
            )
            tx.set(
                slug_ref,
                {
                    "slug": slug,
                    "studioId": studio_ref.id,
                    "ownerId": owner_id,
                    "createdAt": now,
                },
            )
            tx.set(user_ref, {"studioId": studio_ref.id}, merge=True)

        _commit(transaction)

        return Studio(
            id=studio_ref.id,
            owner_id=owner_id,
            name=name,
            slug=slug,
            created_at=datetime.now(timezone.utc),
        )

    def slug_exists(self, slug: str) -> bool:
        return self._db.collection(SLUGS).document(slug).get().exists


class SlugTakenError(Exception):
    """Raised when attempting to reserve a slug that's already used."""

    def __init__(self, slug: str) -> None:
        super().__init__(f"Slug '{slug}' is already taken.")
        self.slug = slug
