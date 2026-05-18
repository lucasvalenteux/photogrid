"""FastAPI application factory + ASGI entrypoint."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.firebase import get_app as init_firebase

logger = logging.getLogger("photogrid")


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings = get_settings()
    logging.basicConfig(
        level=settings.log_level.upper(),
        format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    )
    logger.info("Booting Photogrid API v%s (%s)", __version__, settings.env)
    try:
        init_firebase()
        logger.info("Firebase Admin initialised.")
    except Exception:
        logger.exception("Failed to initialise Firebase Admin SDK.")
        if settings.is_production:
            raise
    yield
    logger.info("Shutting down Photogrid API.")


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Photogrid API",
        version=__version__,
        summary="Backend services for Photogrid — multi-tenant photographer SaaS.",
        docs_url="/docs",
        redoc_url=None,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router)

    @app.get("/", include_in_schema=False)
    def root() -> dict[str, str]:
        return {"name": "photogrid-api", "version": __version__}

    return app


app = create_app()
