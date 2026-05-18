"""Application settings loaded from environment variables."""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Typed access to runtime configuration.

    Backed by env vars (prefixed with ``PHOTOGRID_`` for app-level concerns,
    or by the canonical Google/Firebase names for the SDK).
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    env: Literal["development", "staging", "production"] = Field(
        default="development", validation_alias="PHOTOGRID_ENV"
    )
    log_level: str = Field(default="INFO", validation_alias="PHOTOGRID_LOG_LEVEL")
    cors_origins: str = Field(
        default="http://localhost:3000",
        validation_alias="PHOTOGRID_CORS_ORIGINS",
        description="Comma-separated list of allowed origins.",
    )

    firebase_project_id: str = Field(
        default="photogrid-1822d", validation_alias="FIREBASE_PROJECT_ID"
    )
    firebase_storage_bucket: str = Field(
        default="photogrid-1822d.firebasestorage.app",
        validation_alias="FIREBASE_STORAGE_BUCKET",
    )
    google_application_credentials: str | None = Field(
        default=None, validation_alias="GOOGLE_APPLICATION_CREDENTIALS"
    )
    firebase_service_account_json: str | None = Field(
        default=None, validation_alias="FIREBASE_SERVICE_ACCOUNT_JSON"
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        return self.env == "production"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a cached Settings instance."""
    return Settings()
