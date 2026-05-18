# Photogrid

> Onde fotógrafos hospedam, organizam e vendem suas fotos.

Photogrid is a multi-tenant SaaS for photographers (the first customer is a school photographer). It combines a Next.js 15 frontend, a FastAPI backend, and Firebase for auth, data and storage.

```
┌────────────────────── photogrid (monorepo) ──────────────────────┐
│                                                                  │
│  apps/web      Next.js 15 + Tailwind v4 + shadcn-style UI        │
│  apps/api      FastAPI + Firebase Admin (clean architecture)     │
│  packages/ui   Shared design system (tokens, primitives)         │
│  packages/config  Shared constants, env access, routes           │
│                                                                  │
│  firebase.json  rules, indexes, emulators                        │
│  firestore.rules / storage.rules — multi-tenant isolation        │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## Stack

| Layer    | Tech                                                     |
| -------- | -------------------------------------------------------- |
| Frontend | Next.js 15 (App Router) · TypeScript · Tailwind v4 · shadcn-style components · Framer Motion |
| Backend  | Python 3.11+ · FastAPI · Pydantic v2 · Firebase Admin SDK |
| Data     | Firebase Firestore                                       |
| Storage  | Firebase Storage                                         |
| Auth     | Firebase Authentication (email/password)                 |
| Hosting  | Vercel (web) · Cloud Run / Fly (api, optional)           |

## Quick start

```bash
# 0. one-time global tooling
node -v   # 20+
pnpm -v   # 9+
firebase --version
vercel --version

# 1. install JS workspaces
pnpm install

# 2. copy env files
cp apps/web/.env.local.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env

# 3. run the frontend
pnpm dev          # http://localhost:3000

# 4. (optional) run the backend in another shell
cd apps/api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The frontend is fully usable on its own — it talks to Firebase directly. The FastAPI backend is there for server-side workloads (image processing, integrations, etc.) and shares the same Firestore data model.

## Multi-tenant model

Each photographer (`user`) owns one `studio`. The studio's slug is unique and serves as the public URL:

```
photogrid.store/maria-fotografia
```

Firestore collections:

```
users        /users/{uid}
studios      /studios/{studioId}        — ownerId = uid
slugs        /slugs/{slug}              — uniqueness index, public-readable
galleries    /galleries/{galleryId}     — studioId
photos       /photos/{photoId}          — studioId, galleryId
```

Storage layout:

```
/studios/{studioId}/galleries/{galleryId}/photos/{photoId}/<file>
```

Security rules (`firestore.rules`, `storage.rules`) require authentication for every request and enforce that users can only read/write within their own studio.

## Useful scripts

```bash
pnpm dev                   # run apps/web
pnpm build                 # build all packages + web
pnpm typecheck             # tsc --noEmit across the workspace
pnpm lint                  # next lint
pnpm format                # prettier --write
pnpm firebase:rules        # deploy Firestore + Storage rules
```

## Deploy

### Frontend → Vercel

```bash
vercel link --yes
vercel env pull apps/web/.env.local
vercel deploy --prod
```

The Vercel project should:

- set the **Root Directory** to `apps/web`
- use `pnpm install` and `pnpm build`

### Firebase rules + indexes

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```

### Backend → Cloud Run (optional)

```bash
cd apps/api
gcloud run deploy photogrid-api \
  --source . \
  --region us-central1 \
  --allow-unauthenticated
```

## Project conventions

- Strict TypeScript everywhere (`noUncheckedIndexedAccess`, no implicit any).
- All UI lives in `packages/ui`; the web app composes it into pages.
- All routes live in `@photogrid/config/routes` — never hardcode URLs.
- All collection / storage names live in `@photogrid/config/constants` — same on the FastAPI side via `app/repositories/collections.py`.
- Multi-tenant isolation is enforced server-side (rules + FastAPI deps), never trusted to the client.

## License

UNLICENSED — proprietary.
