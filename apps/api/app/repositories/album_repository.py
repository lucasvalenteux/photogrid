"""Firestore data access for albums — curated selections inside a gallery."""

from __future__ import annotations

from datetime import datetime, timezone

from google.cloud.firestore import Client as FirestoreClient
from google.cloud.firestore_v1 import SERVER_TIMESTAMP

from app.domain.models import Album
from app.repositories.collections import ALBUMS


class AlbumRepository:
    def __init__(self, db: FirestoreClient) -> None:
        self._db = db

    def get_by_id(self, album_id: str) -> Album | None:
        snap = self._db.collection(ALBUMS).document(album_id).get()
        if not snap.exists:
            return None
        return Album.model_validate({"id": snap.id, **(snap.to_dict() or {})})

    def list_for_gallery(self, gallery_id: str) -> list[Album]:
        query = (
            self._db.collection(ALBUMS)
            .where("galleryId", "==", gallery_id)
            .order_by("createdAt", direction="DESCENDING")
        )
        return [
            Album.model_validate({"id": doc.id, **(doc.to_dict() or {})})
            for doc in query.stream()
        ]

    def create(
        self,
        *,
        studio_id: str,
        gallery_id: str,
        title: str,
        subject_name: str | None = None,
        photo_ids: list[str] | None = None,
        cover_photo_url: str | None = None,
        visibility: str = "unlisted",
    ) -> Album:
        ref = self._db.collection(ALBUMS).document()
        ref.set(
            {
                "id": ref.id,
                "studioId": studio_id,
                "galleryId": gallery_id,
                "title": title,
                "subjectName": subject_name,
                "coverPhotoUrl": cover_photo_url,
                "photoIds": photo_ids or [],
                "visibility": visibility,
                "createdAt": SERVER_TIMESTAMP,
            }
        )
        return Album(
            id=ref.id,
            studio_id=studio_id,
            gallery_id=gallery_id,
            title=title,
            subject_name=subject_name,
            cover_photo_url=cover_photo_url,
            photo_ids=photo_ids or [],
            created_at=datetime.now(timezone.utc),
        )

    def set_photos(self, album_id: str, photo_ids: list[str]) -> None:
        self._db.collection(ALBUMS).document(album_id).update({"photoIds": photo_ids})

    def delete(self, album_id: str) -> None:
        self._db.collection(ALBUMS).document(album_id).delete()
