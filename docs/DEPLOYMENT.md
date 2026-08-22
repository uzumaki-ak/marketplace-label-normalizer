# Deployment

## Local Docker path

The supported zero-paid-service path is:

```bash
docker compose up --build
```

Caddy serves the application at `http://localhost:8080` and routes `/api/*`, `/health/*`, and API documentation to FastAPI. The remaining paths go to Next.js. PostgreSQL stores metadata, Valkey carries Celery jobs, and a private named volume stores expiring fallback files.

Services are `web`, `api`, `worker`, `postgres`, `valkey`, `caddy`, and the one-shot `storage-init`. API and worker run as non-root UID/GID 1001 with read-only root filesystems, bounded concurrency/timeouts, and no shell interpolation of uploaded filenames. The initializer only assigns the private volume to that identity.

## Environment

### Required

None for local Docker development.

### Optional local overrides

- `DATABASE_URL`, `VALKEY_URL`, `STORAGE_PROVIDER`, `LOCAL_STORAGE_ROOT`
- `MAX_FILE_BYTES`, `MAX_BATCH_DOCUMENTS`, `MAX_PDF_PAGES`
- `PROCESSING_TIMEOUT_SECONDS`, `TEMP_FILE_TTL_SECONDS`, `WORKER_CONCURRENCY`
- `LOCAL_VISION_ENABLED`

### Optional hosted providers

- Neon: replace `DATABASE_URL` with a private PostgreSQL/Neon connection string.
- ImageKit: set `STORAGE_PROVIDER=imagekit` plus `IMAGEKIT_PRIVATE_KEY`, `IMAGEKIT_PUBLIC_KEY`, and `IMAGEKIT_URL_ENDPOINT`.
- Gemini: set `AI_ENABLED=true` and `GEMINI_API_KEY`; optionally set `GEMINI_MODEL`.
- OpenAI: set `AI_ENABLED=true` and `OPENAI_API_KEY`; optionally set `OPENAI_MODEL`.
- Vision controls: `VISION_MAX_IMAGE_BYTES`, `VISION_AUTO_APPROVE_CONFIDENCE`.

Blank or incomplete optional credentials disable that provider and never prevent application boot. Copy `.env.example` to `.env` only when overrides are needed. Do not commit `.env`.

## Production notes

Use HTTPS, private credentials, a strong database password, managed secret injection, and explicit PostgreSQL migrations before scaling API replicas. Preserve temporary-object TTL cleanup and private URLs. Kubernetes, a standalone API gateway, and unnecessary microservices are intentionally excluded; this is a modular monolith with one asynchronous worker tier.
