"""Aggregate v1 router."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import admin, albums, auth, face_clustering, galleries, health, studios

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health.router)
api_router.include_router(admin.router)
api_router.include_router(auth.router)
api_router.include_router(studios.router)
api_router.include_router(galleries.router)
api_router.include_router(albums.router)
api_router.include_router(face_clustering.router)
