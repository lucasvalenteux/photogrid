"""Authentication helpers — verify Firebase ID tokens from the Authorization header."""

from __future__ import annotations

from dataclasses import dataclass

from fastapi import HTTPException, Request, status
from firebase_admin import auth as fb_auth

from app.core.firebase import verify_id_token


@dataclass(frozen=True, slots=True)
class AuthUser:
    """Identity extracted from a verified Firebase ID token."""

    uid: str
    email: str | None
    claims: dict[str, object]


def _extract_bearer(request: Request) -> str:
    header = request.headers.get("Authorization") or request.headers.get("authorization")
    if not header or not header.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header.",
            headers={"WWW-Authenticate": 'Bearer realm="photogrid"'},
        )
    return header.split(" ", 1)[1].strip()


def get_current_user(request: Request) -> AuthUser:
    """FastAPI dependency. Returns the authenticated user or 401s."""
    token = _extract_bearer(request)
    try:
        claims = verify_id_token(token)
    except (fb_auth.InvalidIdTokenError, fb_auth.ExpiredIdTokenError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
        ) from exc
    except fb_auth.RevokedIdTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token has been revoked.",
        ) from exc

    uid = str(claims.get("uid") or claims.get("sub") or "")
    if not uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is missing a subject.",
        )

    email = claims.get("email")
    return AuthUser(uid=uid, email=str(email) if email else None, claims=claims)
