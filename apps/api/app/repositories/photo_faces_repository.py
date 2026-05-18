"""Per-photo face detection summary."""

from __future__ import annotations

from datetime import datetime, timezone

from google.cloud.firestore import Client as FirestoreClient

from app.domain.models import DetectedFace, PhotoFaces
from app.repositories.collections import PHOTO_FACES


class PhotoFacesRepository:
    """Stores the detection result for each photo.

    The doc id is the photo's id so we can look it up without a query, and
    so processed photos are easy to filter out when batch-reprocessing.
    """

    def __init__(self, db: FirestoreClient) -> None:
        self._db = db
        self._col = db.collection(PHOTO_FACES)

    def get(self, photo_id: str) -> PhotoFaces | None:
        snap = self._col.document(photo_id).get()
        if not snap.exists:
            return None
        return PhotoFaces.model_validate(snap.to_dict() or {})

    def exists(self, photo_id: str) -> bool:
        return self._col.document(photo_id).get().exists

    def save(
        self,
        *,
        photo_id: str,
        gallery_id: str,
        studio_id: str,
        faces: list[DetectedFace],
    ) -> PhotoFaces:
        now = datetime.now(timezone.utc)
        payload = {
            "photoId": photo_id,
            "galleryId": gallery_id,
            "studioId": studio_id,
            # Pydantic dumps with aliases so Firestore matches the JS schema.
            "faces": [f.model_dump(by_alias=True) for f in faces],
            "processedAt": now,
        }
        self._col.document(photo_id).set(payload)
        return PhotoFaces.model_validate(payload)

    def delete(self, photo_id: str) -> None:
        self._col.document(photo_id).delete()

    def list_for_gallery(self, gallery_id: str) -> list[PhotoFaces]:
        query = self._col.where("galleryId", "==", gallery_id)
        return [
            PhotoFaces.model_validate(doc.to_dict() or {}) for doc in query.stream()
        ]
