# Photogrid API

FastAPI service that powers Photogrid's server-side logic — most notably
the **InsightFace** face-clustering pipeline that turns gallery uploads
into auto-suggested albums.

## What's in here

| Path                                     | Purpose                                                            |
| ---------------------------------------- | ------------------------------------------------------------------ |
| `app/main.py`                            | ASGI entrypoint (`uvicorn app.main:app`).                          |
| `app/api/v1/face_clustering.py`          | Endpoints for incremental face clustering.                         |
| `app/services/face_clustering_service.py`| InsightFace detection + cosine-centroid clustering.                |
| `app/repositories/*.py`                  | Firestore data access (galleries, albums, photos, clusters).       |
| `app/core/firebase.py`                   | Firebase Admin SDK initialisation.                                 |
| `Dockerfile`                             | Multi-stage image with the buffalo_l model pre-baked at build time.|
| `railway.toml`                           | Railway service descriptor.                                        |

## Endpoints (v1)

All routes are mounted under `/api/v1` and require a Firebase ID token in
the `Authorization: Bearer <token>` header.

- `GET    /health` — liveness probe.
- `POST   /studios`, `GET /studios/me` — studio CRUD.
- `GET/POST/DELETE /galleries`, `/galleries/{id}` — gallery CRUD.
- `GET/POST /albums`, `PUT /albums/{id}/photos`, `DELETE /albums/{id}` — album CRUD.
- `POST   /face-clustering/process-photo` — queue a photo for face detection
  + clustering. Fire-and-forget; runs in a background task.
- `GET    /face-clustering/galleries/{id}/clusters` — list clusters.
- `POST   /face-clustering/clusters/{id}/promote` — convert a cluster into
  an album titled `<gallery title> #NN`.
- `POST   /face-clustering/clusters/{id}/dismiss` — hide a cluster
  suggestion from the dashboard.

## Local development

```bash
cd apps/api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Either pass GOOGLE_APPLICATION_CREDENTIALS pointing at a service-account
# JSON file, or set FIREBASE_SERVICE_ACCOUNT_JSON to the raw JSON contents
# (handy when running inside Railway / Cloud Run).
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json

uvicorn app.main:app --reload
```

The first request triggers InsightFace to download the `buffalo_l` model
into `~/.insightface` (~300 MB). Subsequent runs reuse the cached files.

## Production image

```bash
docker build -t photogrid-api apps/api
docker run -p 8000:8000 \
  -e FIREBASE_SERVICE_ACCOUNT_JSON="$(cat sa.json)" \
  -e PHOTOGRID_CORS_ORIGINS="https://photogrid.store" \
  photogrid-api
```

The Dockerfile bakes the model into `/opt/insightface` at build time so
cold starts don't pay the download cost. Expect ~1.0 GB image size and
~1.5 GB resident memory once the model is loaded.

## Deploying on Railway

1. `railway link` from this directory (or use the GitHub integration and
   point the service at `apps/api` as the build context).
2. Set these env vars on the Railway service:

   | Key                              | Value                                              |
   | -------------------------------- | -------------------------------------------------- |
   | `FIREBASE_PROJECT_ID`            | `photogrid-1822d`                                  |
   | `FIREBASE_STORAGE_BUCKET`        | `photogrid-1822d.firebasestorage.app`              |
   | `FIREBASE_SERVICE_ACCOUNT_JSON`  | *paste the raw service-account JSON*               |
   | `PHOTOGRID_ENV`                  | `production`                                       |
   | `PHOTOGRID_CORS_ORIGINS`         | `https://photogrid.store,https://photogrid-seven.vercel.app` |

3. Bump the service plan to **at least 2 GB RAM**. InsightFace's
   `buffalo_l` model needs ~1.5 GB resident and the OS plus uvicorn add
   overhead.
4. Deploy. Railway will use the in-repo `Dockerfile` and the healthcheck
   at `/api/v1/health` will report green once uvicorn is up.
5. Copy the public URL Railway assigns to the service and set it as
   `NEXT_PUBLIC_API_URL` on the Vercel project. Redeploy the web app —
   the dashboard will start showing the "Sugestões automáticas" strip
   inside galleries as soon as new uploads are processed.

## Tuning knobs

`app/services/face_clustering_service.py` exposes three constants you'll
likely want to adjust as your photo volume grows:

- `SIMILARITY_THRESHOLD` (default `0.40`) — cosine similarity above which
  a face is merged into an existing cluster. Higher = stricter (more
  clusters, fewer false merges). Lower = looser (fewer clusters, risk of
  conflating siblings / cousins).
- `MIN_DETECTION_SCORE` (default `0.55`) — skip low-confidence detections.
- `MIN_FACE_PIXELS` (default `48`) — minimum bounding-box short edge.
  Filters background bystanders without clipping portrait subjects.

## Operational notes

- **Concurrency**: the worker pool is bound by uvicorn's default (1
  worker × N threads). InsightFace inference holds the GIL during ORT
  calls, so additional workers help more than threads. Add
  `--workers 2` to the `CMD` if your Railway plan has the CPU headroom.
- **Cold starts**: the model is mmaped from disk after the Docker layer
  is copied so the first request after a deploy still pays a 5–8 s
  setup. Railway keeps containers warm during steady traffic.
- **Cost**: each photo costs ~1 s of CPU + ~10 KB of Firestore writes
  (one `photoFaces` doc + cluster updates). On a 2 vCPU plan that's
  pennies per thousand photos.
