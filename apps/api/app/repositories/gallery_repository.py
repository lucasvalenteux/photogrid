"""Firestore data access for galleries — the top-level content unit."""

from __future__ import annotations

from datetime import datetime, timezone

from google.cloud.firestore import Client as FirestoreClient
from google.cloud.firestore_v1 import SERVER_TIMESTAMP

from app.domain.models import Gallery
from app.repositories.collections import GALLERIES


class GalleryRepository:
    def __init__(self, db: FirestoreClient) -> None:
        self._db = db

    def get_by_id(self, gallery_id: str) -> Gallery | None:
        snap = self._db.collection(GALLERIES).document(gallery_id).get()
        if not snap.exists:
            return None
        return Gallery.model_validate({"id": snap.id, **(snap.to_dict() or {})})

    def list_for_studio(self, studio_id: str) -> list[Gallery]:
        query = (
            self._db.collection(GALLERIES)
            .where("studioId", "==", studio_id)
            .order_by("createdAt", direction="DESCENDING")
        )
        return [
            Gallery.model_validate({"id": doc.id, **(doc.to_dict() or {})})
            for doc in query.stream()
        ]

    def create(
        self,
        *,
        studio_id: str,
        title: str,
        description: str | None = None,
    ) -> Gallery:
        ref = self._db.collection(GALLERIES).document()
        ref.set(
            {
                "id": ref.id,
                "studioId": studio_id,
                "title": title,
                "description": description,
                "photoCount": 0,
                "albumCount": 0,
                "createdAt": SERVER_TIMESTAMP,
            }
        )
        return Gallery(
            id=ref.id,
            studio_id=studio_id,
            title=title,
            description=description,
            photo_count=0,
            album_count=0,
            created_at=datetime.now(timezone.utc),
        )

    def delete(self, gallery_id: str) -> None:
        self._db.collection(GALLERIES).document(gallery_id).delete()
