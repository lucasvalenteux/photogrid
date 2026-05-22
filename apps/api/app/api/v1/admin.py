"""System-admin routes — privileged operations via Firebase Admin SDK."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.core.security import AuthUser, get_current_user
from app.services.admin_service import assert_system_admin, delete_account

router = APIRouter(prefix="/admin", tags=["admin"])


def require_system_admin(user: AuthUser = Depends(get_current_user)) -> AuthUser:
    assert_system_admin(user.email)
    return user


@router.delete("/users/{target_user_id}", summary="Delete a photographer account")
async def delete_user_account(
    target_user_id: str,
    delete_studio: bool = Query(False, alias="deleteStudio"),
    email: str | None = Query(None, description="Target email for safety checks"),
    _: AuthUser = Depends(require_system_admin),
) -> dict[str, bool]:
    delete_account(
        target_user_id=target_user_id,
        target_email=email,
        delete_studio=delete_studio,
    )
    return {"ok": True}
