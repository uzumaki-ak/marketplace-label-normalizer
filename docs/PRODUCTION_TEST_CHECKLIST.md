# Production-Style Test Checklist

## 1. Core workflow — no API keys

Leave every optional key blank and run:

```bash
docker compose up --build
```

Open `http://localhost:8080`, upload a mixed Flipkart/Amazon/Meesho batch, and verify:

1. All source pages are counted, while discovered-label count may differ from PDF count.
2. The expandable stages reach COMPLETE and show page-level classification/exclusion messages.
3. Ready labels are exactly 100 × 150 mm; uncertainty appears in REVIEW and does not block other labels.
4. Review supports crop, resize, rotate, re-detect, approve, skip, and one-label download.
5. Preview and Download use `PRINT_READY_LABELS.pdf`; Print All opens the normal browser/OS print flow.
6. In the print dialog choose PeriPeri S1, 100 × 150 mm portrait, actual size/100%, and disable fit-to-page if the driver offers it.

This is the complete required printing path and requires no paid service.

## 2. Optional provider credentials

Create `.env` beside `compose.yaml`. Add only the providers you intend to test:

```dotenv
# Optional local CV fallback — no key
LOCAL_VISION_ENABLED=true

# Optional cloud vision
AI_ENABLED=true
GEMINI_API_KEY=replace_me
GEMINI_MODEL=gemini-3.6-flash
OPENAI_API_KEY=replace_me
OPENAI_MODEL=gpt-5.4

# Optional hosted storage
STORAGE_PROVIDER=imagekit
IMAGEKIT_PRIVATE_KEY=replace_me
IMAGEKIT_PUBLIC_KEY=replace_me
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your_endpoint

# Optional hosted database; use the SQLAlchemy psycopg prefix.
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST-pooler.REGION.aws.neon.tech/DB?sslmode=require
```

Never commit `.env`. Gemini/OpenAI can be enabled independently. ImageKit requires all three ImageKit values. Neon replaces only the local database connection; Valkey remains self-hosted.

After changing `.env`:

```bash
docker compose up --build -d
```

Check registration:

```bash
curl http://localhost:8080/health/ready
```

Expected provider IDs include `local-vision/opencv-content-bounds/v1`, `gemini/interactions-vision/v1`, and/or `openai/responses-vision/v1` for what you enabled. `ai_enabled` reports cloud-provider availability. It must remain `false` when cloud keys are blank.

## 3. Browser and server regression

PowerShell:

```powershell
$env:SERVER_FALLBACK_BASE_URL='http://127.0.0.1:8080'
npx playwright test
```

Backend:

```bash
docker compose run --rm --no-deps api python -m pytest -p no:cacheprovider
docker compose run --rm --no-deps api ruff check --no-cache app tests
```

The automated OpenAI/Gemini tests use mocked HTTP transports so they are safe, repeatable, and free. A live billable cloud request was not run during implementation because no credentials were supplied. When live keys are available, test only with an anonymized/minimal rendered label region; do not use a customer batch. A provider crop is never sufficient approval—the resulting native crop still needs barcode/dimension/clipping validation or manual review.

## 4. Production checks before real use

- Put Caddy behind HTTPS and inject secrets outside source control.
- Replace default local PostgreSQL credentials if exposing any service beyond localhost.
- Confirm TTL cleanup and private storage behavior with a deliberately expired test batch.
- Confirm database backups and add explicit migrations before multiple API replicas.
- Run a physical PeriPeri S1 print and scan representative Code 128/QR codes from paper.
- Confirm popup permission for Print All and the exact printer-driver paper preset.
