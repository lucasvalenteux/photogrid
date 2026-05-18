# syntax=docker/dockerfile:1.7
# ---------------------------------------------------------------------------
# Photogrid API — production image.
#
# Two-stage build:
#
#   1. `builder`  — installs Python deps into a virtualenv and pre-downloads
#                   the InsightFace `buffalo_l` model pack into
#                   /opt/insightface so we never pay for the ~300MB download
#                   at runtime cold-start.
#   2. `runtime`  — slim base, copies the venv + cached model. The ONNX
#                   runtime defaults to CPU; switch to onnxruntime-gpu +
#                   a CUDA base image if you ever need GPU inference.
#
# Memory expectation: ~1.5 GB resident with the model loaded. Configure your
# Railway service with at least 2 GB RAM.
# ---------------------------------------------------------------------------

FROM python:3.11-slim AS builder

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    INSIGHTFACE_HOME=/opt/insightface

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        libgl1 \
        libglib2.0-0 \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Use a venv so the runtime image gets a clean, self-contained Python
# install with no build tooling lingering around.
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:${PATH}"

COPY requirements.txt ./
RUN pip install --upgrade pip setuptools wheel \
    && pip install -r requirements.txt

# Pre-download the buffalo_l model pack so cold starts are instantaneous.
# Without this the first request triggers a ~300MB pull from insightface.ai.
RUN python -c "import insightface; insightface.app.FaceAnalysis(name='buffalo_l', root='${INSIGHTFACE_HOME}').prepare(ctx_id=-1, det_size=(640, 640))"

# ---------------------------------------------------------------------------

FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    INSIGHTFACE_HOME=/opt/insightface \
    PATH="/opt/venv/bin:${PATH}" \
    PORT=8000

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libgl1 \
        libglib2.0-0 \
        ca-certificates \
        curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 1000 photogrid

COPY --from=builder /opt/venv /opt/venv
COPY --from=builder /opt/insightface /opt/insightface

WORKDIR /app
COPY app ./app

USER photogrid
EXPOSE 8000

# Tini-less single process is fine: uvicorn handles signals properly. We
# bind to 0.0.0.0 because Railway / Cloud Run / Fly all proxy from outside
# the container.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]
