"""Firebase Admin SDK bootstrap."""

from __future__ import annotations

import json
import logging
from functools import lru_cache

import firebase_admin
from firebase_admin import auth as fb_auth
from firebase_admin import credentials, firestore, storage
from google.cloud.firestore import Client as FirestoreClient
from google.cloud.storage import Bucket

from app.core.config import get_settings

logger = logging.getLogger(__name__)


def _build_credentials() -> credentials.Base:
    """Resolve Firebase credentials from env, in priority order.

    1. Inline JSON via ``FIREBASE_SERVICE_ACCOUNT_JSON``
    2. File path via ``GOOGLE_APPLICATION_CREDENTIALS``
    3. Application Default Credentials (works on GCP / Cloud Run)
    """
    settings = get_settings()
    if settings.firebase_service_account_json:
        info = json.loads(settings.firebase_service_account_json)
        return credentials.Certificate(info)
    if settings.google_application_credentials:
        return credentials.Certificate(settings.google_application_credentials)
    logger.info("Falling back to Application Default Credentials")
    return credentials.ApplicationDefault()


@lru_cache(maxsize=1)
def get_app() -> firebase_admin.App:
    """Initialise (once) and return the Firebase admin App."""
    if firebase_admin._apps:  # pragma: no cover - defensive
        return firebase_admin.get_app()

    settings = get_settings()
    return firebase_admin.initialize_app(
        _build_credentials(),
        options={
            "projectId": settings.firebase_project_id,
            "storageBucket": settings.firebase_storage_bucket,
        },
    )


def get_firestore() -> FirestoreClient:
    return firestore.client(app=get_app())


def get_bucket() -> Bucket:
    return storage.bucket(app=get_app())


def verify_id_token(id_token: str) -> dict[str, object]:
    """Verify a Firebase Auth ID token and return its decoded claims."""
    return fb_auth.verify_id_token(id_token, app=get_app(), check_revoked=True)
