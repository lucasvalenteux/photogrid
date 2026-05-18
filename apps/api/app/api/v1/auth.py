"""Auth helpers exposed to the unauthenticated marketing/login flow.

The single endpoint here exists so the web login form can render a
proper two-step UX ("enter email → either sign in or create account")
instead of the classic "email + password" single shot. We need an
authoritative *exists / does not exist* answer for a given email, and
the Firebase Client SDK can't give it once Email Enumeration Protection
is enabled on the Firebase project — `fetchSignInMethodsForEmail`
always returns an empty array and `signInWithEmailAndPassword` collapses
every failure into ``auth/invalid-credential``.

Security note: this endpoint inherently leaks "email X is registered",
which is the same trade-off Firebase's protection was put in place to
avoid. We accept it because:

  * the UX win on the login screen is substantial,
  * CORS already restricts callers to our own origins, and
  * a determined attacker can probe the public Firebase Identity
    Toolkit endpoints anyway.

If we ever need to harden this, this is the spot to add a per-IP rate
limiter (e.g. a leaky bucket in Redis).
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, status
from firebase_admin import auth as fb_auth
from pydantic import BaseModel, EmailStr

from app.core.firebase import get_app

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


class EmailLookupRequest(BaseModel):
    email: EmailStr


class EmailLookupResponse(BaseModel):
    exists: bool


@router.post(
    "/lookup",
    response_model=EmailLookupResponse,
    summary="Check whether an email is already registered",
)
def lookup_email(payload: EmailLookupRequest) -> EmailLookupResponse:
    normalised = payload.email.strip().lower()
    try:
        fb_auth.get_user_by_email(normalised, app=get_app())
        return EmailLookupResponse(exists=True)
    except fb_auth.UserNotFoundError:
        return EmailLookupResponse(exists=False)
    except Exception:  # pragma: no cover - defensive
        # We never want to leak the underlying error to the client and
        # we never want the login form to break because the lookup
        # service is temporarily unhappy. Logging + 503 lets the
        # frontend fall back to the optimistic single-step path.
        logger.exception("auth.lookup failed for email=%s", normalised)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="lookup_unavailable",
        )
