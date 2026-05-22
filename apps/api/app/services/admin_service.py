"""System-admin maintenance — uses Firebase Admin SDK (bypasses client rules)."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import HTTPException, status
from firebase_admin import auth as fb_auth
from google.cloud.firestore import Client as FirestoreClient

from app.core.firebase import get_bucket, get_firestore
from app.repositories import collections as C

logger = logging.getLogger(__name__)

ACCOUNT_ACCESS_LOGS = "accountAccessLogs"
CLIENTS = "clients"
ORDERS = "orders"
BATCH_LIMIT = 450

SYSTEM_ADMIN_EMAILS = frozenset(
    {
        "luckvalente@gmail.com",
        "lucasvalenteux@gmail.com",
    }
)


def assert_system_admin(email: str | None) -> None:
    if (email or "").strip().lower() not in SYSTEM_ADMIN_EMAILS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso restrito ao administrador do sistema.",
        )


def assert_not_system_admin_target(email: str | None) -> None:
    if (email or "").strip().lower() in SYSTEM_ADMIN_EMAILS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não é possível excluir uma conta de administrador do sistema.",
        )


def _chunked_delete(db: FirestoreClient, refs: list[Any]) -> None:
    if not refs:
        return
    batch = db.batch()
    count = 0
    for ref in refs:
        batch.delete(ref)
        count += 1
        if count >= BATCH_LIMIT:
            batch.commit()
            batch = db.batch()
            count = 0
    if count:
        batch.commit()


def _query_refs(db: FirestoreClient, collection: str, field: str, value: str) -> list[Any]:
    return [
        doc.reference
        for doc in db.collection(collection).where(field, "==", value).stream()
    ]


def _delete_studio_cascade(db: FirestoreClient, studio_id: str, studio: dict[str, Any]) -> None:
    slug = str(studio.get("slug") or "")
    owner_id = str(studio.get("ownerId") or "")
    logo_path = studio.get("logoStoragePath")

    photos = [
        doc.to_dict() | {"id": doc.id}
        for doc in db.collection(C.PHOTOS).where("studioId", "==", studio_id).stream()
    ]

    deletes = (
        _query_refs(db, C.GALLERIES, "studioId", studio_id)
        + _query_refs(db, C.ALBUMS, "studioId", studio_id)
        + _query_refs(db, C.PHOTOS, "studioId", studio_id)
        + _query_refs(db, ORDERS, "studioId", studio_id)
        + _query_refs(db, CLIENTS, "studioId", studio_id)
        + _query_refs(db, C.FACE_CLUSTERS, "studioId", studio_id)
        + _query_refs(db, C.PHOTO_FACES, "studioId", studio_id)
    )
    if slug:
        deletes.append(db.collection(C.SLUGS).document(slug))
    deletes.append(db.collection(C.STUDIOS).document(studio_id))

    _chunked_delete(db, deletes)

    for user_ref in _query_refs(db, C.USERS, "studioId", studio_id):
        user_ref.set({"studioId": None}, merge=True)
    if owner_id:
        db.collection(C.USERS).document(owner_id).set({"studioId": None}, merge=True)

    bucket = get_bucket()
    paths: set[str] = set()
    for photo in photos:
        storage_path = photo.get("storagePath")
        thumb_path = photo.get("thumbnailPath")
        if isinstance(storage_path, str) and storage_path:
            paths.add(storage_path)
        if isinstance(thumb_path, str) and thumb_path:
            paths.add(thumb_path)
        gallery_id = photo.get("galleryId")
        photo_id = photo.get("id")
        if gallery_id and photo_id:
            paths.add(f"studios/{studio_id}/galleries/{gallery_id}/photos/{photo_id}")
        photo_faces_ref = db.collection(C.PHOTO_FACES).document(str(photo_id))
        if photo_faces_ref.get().exists:
            photo_faces_ref.delete()

    if isinstance(logo_path, str) and logo_path:
        paths.add(logo_path)

    for path in paths:
        try:
            bucket.blob(path).delete()
        except Exception as exc:  # noqa: BLE001 — best-effort cleanup
            logger.warning("storage delete failed for %s: %s", path, exc)


def delete_account(
    *,
    target_user_id: str,
    target_email: str | None,
    delete_studio: bool,
) -> None:
    assert_not_system_admin_target(target_email)

    db = get_firestore()
    owned = list(
        db.collection(C.STUDIOS).where("ownerId", "==", target_user_id).limit(1).stream()
    )

    if owned:
        if not delete_studio:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Esta conta é dona de um estúdio. Confirme a exclusão do estúdio.",
            )
        studio_doc = owned[0]
        _delete_studio_cascade(db, studio_doc.id, studio_doc.to_dict())

    log_refs = _query_refs(db, ACCOUNT_ACCESS_LOGS, "userId", target_user_id)
    _chunked_delete(db, log_refs)

    user_ref = db.collection(C.USERS).document(target_user_id)
    if user_ref.get().exists:
        user_ref.delete()

    try:
        fb_auth.delete_user(target_user_id)
    except fb_auth.UserNotFoundError:
        pass
