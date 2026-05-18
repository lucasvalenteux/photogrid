# syntax=docker/dockerfile:1.7
# ---------------------------------------------------------------------------
# Photogrid API — production image.
#
# Two-stage build:
#
#   1. `builder`  — installs Python deps into a virtualenv and pre-downloads
#                   the InsightFace `buffalo_sc` model pack into
#                   /opt/insightface so we never pay for the model download
#                   at runtime cold-start.
#   2. `runtime`  — slim base, copies the venv + cached model. The ONNX
#                   runtime defaults to CPU; switch to onnxruntime-gpu +
#                   a CUDA base image if you ever need GPU inference.
#
# Memory expectation: ~500-700 MB resident with the lean buffalo_sc pack
# + detection/recognition-only modules. Fits comfortably in a 1 GB
# Railway plan; if you bump to a larger instance, switch to `buffalo_l`
# in services/face_clustering_service.py for higher recognition accuracy.
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

# Pre-download the buffalo_sc (small/light) model pack so cold starts are
# instantaneous. Without this the first request triggers a model pull from
# insightface.ai. We restrict to detection + recognition modules to skip
# downloading the age/gender/landmark heads we never use.
RUN python -c "import insightface; insightface.app.FaceAnalysis(name='buffalo_sc', allowed_modules=['detection','recognition'], root='${INSIGHTFACE_HOME}').prepare(ctx_id=-1, det_size=(640, 640))"

# ---------------------------------------------------------------------------

FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    INSIGHTFACE_HOME=/opt/insightface \
    PATH="/opt/venv/bin:${PATH}" \
    PORT=8000 \
    # Cap BLAS / OpenMP threadpools to 1 — extra threads inflate the
    # working set by 100-200 MB without helping a single-worker uvicorn
    # process. Combined with ONNX Runtime's own thread defaults this is
    # what keeps us under 1 GB.
    OMP_NUM_THREADS=1 \
    OPENBLAS_NUM_THREADS=1 \
    MKL_NUM_THREADS=1 \
    NUMEXPR_NUM_THREADS=1 \
    # Disable ORT's global thread pool so each session allocates threads
    # lazily instead of holding a fixed pool resident.
    ORT_DISABLE_GLOBAL_THREAD_POOL=1

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
