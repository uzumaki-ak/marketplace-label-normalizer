# Marketplace Shipping Label Normalizer

> Convert mixed Flipkart, Amazon, and Meesho shipping PDFs into validated, PDF-native **100 × 150 mm** print-ready labels — directly in the browser.

<p align="center">
  <strong>Mixed marketplace PDFs → Detect → Extract → Normalize → VValidate → Review → Print</strong>
</p>

<p align="center">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-black?logo=next.js">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white">
  <img alt="FastAPI" src="https://img.shields.io/badge/FastAPI-0.141-009688?logo=fastapi&logoColor=white">
  <img alt="Docker" src="https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white">
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white">
  <img alt="Valkey" src="https://img.shields.io/badge/Valkey-8.1-DC382D">
</p>

---

## Why this exists

Marketplace shipping documents are inconsistent.

A typical seller may receive:

- a **Flipkart** A4 PDF where the shipping label is only the upper portion and the Tax Invoice occupies the lower half,
- an **Amazon** PDF where the shipping label and supplier invoice are separate pages,
- a **Meesho** label where useful content occupies only part of the page and large blank regions cause thermal-printer scaling problems,
- and multiple PDFs from different marketplaces in the same batch.

Printing those files directly to a 4-inch thermal printer often means manual screenshots, crops, page selection, repeated print dialogs, or labels that are unnecessarily small.

Marketplace Shipping Label Normalizer turns that workflow into:

```text
Drop mixed PDFs
      ↓
Inspect every page
      ↓
Detect marketplace + label region
      ↓
Remove invoice-only / useless content
      ↓
Normalize to 100 × 150 mm
      ↓
Validate barcode / QR / clipping
      ↓
Review only uncertain labels
      ↓
Build PRINT_READY_LABELS.pdf
      ↓
Preview / Download / Print All
```

The core workflow is **browser-local** and does not require cloud AI, paid storage, or a hosted database.

---

## Highlights

- **Mixed batches** — upload Flipkart, Amazon, and Meesho PDFs together.
- **Page-aware processing** — input PDF count is not assumed to equal shipment count.
- **PDF-native output** — final labels are built from the source PDF content, not screenshots.
- **Exact thermal-label size** — every approved output page is exactly **100 × 150 mm portrait**.
- **Marketplace adapters** — modular Flipkart, Amazon, Meesho, and conservative Generic adapters.
- **Barcode / QR validation** — validation is rendered at **203 DPI**, matching common 4-inch thermal printers.
- **Manual review** — drag crop, resize, rotate, re-detect, approve, skip, or download a single label.
- **Realtime progress** — inspectable stages from ingest to assembly.
- **Duplicate warnings** — warns using hashed machine-readable payloads or strong page fingerprints.
- **Privacy-first** — known marketplace processing stays in browser memory by default.
- **Zero-config local stack** — `docker compose up --build` works without API keys or paid services.
- **Optional fallback infrastructure** — FastAPI, Celery, Valkey, PostgreSQL, local/OpenCV vision, Gemini, OpenAI, ImageKit, and Neon-compatible PostgreSQL.

---

## Supported marketplace behavior

### Flipkart

![flipkartproof](image.png)

Confirmed layout family:

`flipkart/a4-ekart-tax-invoice/v1`

The adapter:

- detects E-Kart / shipping anchors,
- inspects every source page,
- identifies the shipping-label and Tax Invoice separation through anchors + geometry,
- keeps the upper shipping label,
- excludes the lower Tax Invoice,
- avoids fixed-percentage cropping as its primary strategy.

Conceptually:

```text
┌────────────────────────────┐
│ E-Kart shipping label      │  ← kept
│ QR / AWB / address / SKU   │
└────────────────────────────┘
------------- divider --------
│ Tax Invoice                │  ← excluded
│ billing / totals / seller  │
└────────────────────────────┘
```

### Amazon
![amazon](image-1.png)

Confirmed layout family:

`amazon/a4-raster-label-with-supplier-invoice/v1`

The adapter:

- classifies pages individually,
- keeps the shipping-label page,
- excludes supplier/seller invoice pages,
- does not assume Amazon exports will always remain exactly two pages,
- uses visual meaningful-content bounds and layout evidence.

### Meesho
![meesho](image-2.png)

Confirmed layout family:

`meesho/a4-package-label/v1`

The adapter:

- detects the combined shipping/product/invoice package-label structure,
- finds meaningful visual bounds,
- removes unnecessary outer/bottom whitespace with safe padding,
- preserves the full package-label content,
- does not stretch or distort the label to fill the output page.

### Unknown / changed layouts

`GenericAdapter` is intentionally conservative.

Unknown or drifted layouts are routed to **manual review** instead of being silently auto-approved.

---

## Output format

The final batch file is:

```text
PRINT_READY_LABELS.pdf
```

Properties:

- **100 mm × 150 mm**
- **portrait**
- one approved shipment label per output page
- deterministic order:
  1. upload order
  2. source page order
  3. discovered region order

A source document may produce:

- zero labels,
- one label,
- or multiple labels.

For example:

```text
20 uploaded PDFs
      ↓
27 discovered / approved shipments
      ↓
PRINT_READY_LABELS.pdf
      ↓
27 pages
```

---

## PDF-native quality

The production output path does **not** use screenshots as label pages.

```text
Source PDF
   ↓
Detect region in PDF coordinates
   ↓
Embed original PDF page content
   ↓
Clip / transform into 100 × 150 mm page
   ↓
Final PDF
```

Rendered images are used only for:

- preview,
- visual detection,
- validation,
- review.

The final PDF is assembled through `pdf-lib` from original PDF content wherever the source permits it.

---

## Validation

Each normalized label is rendered temporarily at **203 DPI** for machine-readable validation.

Supported symbologies:

- Code 128
- QR
- Data Matrix
- PDF417

Validation considers:

- barcode / QR decoding,
- mandatory code policy,
- clipping risk,
- output dimensions,
- crop boundaries,
- marketplace anchors,
- page classification,
- geometry,
- layout fingerprint,
- overall confidence.

A failed mandatory barcode/dimension/clipping check cannot be overridden by a high confidence score.

If clipping evidence is detected, the system can perform one bounded crop-margin retry before routing the label to review.

Decoded machine-readable payloads stored in application state are reduced to **SHA-256 hashes** rather than stored raw.

---

## Manual review

Uncertain labels do not disappear and are not silently approved.

The review editor supports:

- source-page preview,
- draggable crop rectangle,
- resize via handle,
- rotation: `0°`, `90°`, `180°`, `270°`,
- re-detection,
- approve,
- skip,
- individual label download.

Review edits are mapped back into PDF coordinates, so final output remains PDF-native.

---

## Realtime processing

The UI exposes the processing pipeline rather than hiding work behind a generic spinner.

```text
INGEST
  ↓
PARSE
  ↓
CLASSIFY
  ↓
EXTRACT
  ↓
NORMALIZE
  ↓
VALIDATE
  ↓
REVIEW
  ↓
ASSEMBLE
  ↓
COMPLETE
```

Browser processing emits append-only local events.

The backend exposes compatible processing events and an SSE stream endpoint for server-side fallback jobs.

---

# Quick start

## Option A — Docker Compose

This is the easiest way to run the full local stack.

### Requirements

- Docker Desktop, or
- Docker Engine with Docker Compose v2

### Start

```bash
git clone https://github.com/uzumaki-ak/marketplace-label-normalizer.git
cd marketplace-label-normalizer
docker compose up --build
```

Open:

```text
http://localhost:8080
```

Run in the background:

```bash
docker compose up --build -d
```

Stop:

```bash
docker compose down
```

No `.env` file or API keys are required for the local stack.

---

## Option B — browser-local development

### Requirements

- Node.js **24+**
- npm **11+**

```bash
npm ci
npm run dev
```

Open:

```text
http://localhost:3000
```

This runs the browser-local PDF workflow.

> The supported full backend development path is Docker Compose because the API/worker stack also requires PostgreSQL and Valkey.

---

# Docker architecture

The local Compose stack contains:

| Service | Purpose |
|---|---|
| `caddy` | Local public entry point on `:8080`; routes web/API/health/docs |
| `web` | Next.js production application |
| `api` | FastAPI backend |
| `worker` | Celery worker + cleanup scheduler |
| `storage-init` | Initializes the private storage volume for non-root app UID |
| `postgres` | PostgreSQL metadata database |
| `valkey` | Celery broker/result backend |

```mermaid
flowchart TD
    U[Browser] --> C[Caddy :8080]
    C --> W[Next.js Web]
    C --> A[FastAPI API]

    A --> P[(PostgreSQL)]
    A --> S[Private Temp Storage]
    A --> V[(Valkey)]

    V --> CW[Celery Worker]
    CW --> S
    CW --> P
```

---

# Browser-first architecture

Known marketplace processing is intentionally client-first:

```mermaid
flowchart LR
    A[Mixed PDFs] --> B[PDF.js]
    B --> C[Marketplace Adapter]
    C --> D[Native PDF Region]
    D --> E[100 × 150 mm Normalization]
    E --> F[203 DPI ZXing Validation]
    F -->|Pass| G[Approved]
    F -->|Uncertain| H[Manual Review]
    H --> G
    G --> I[PRINT_READY_LABELS.pdf]
```

For the normal browser-local path:

- source PDFs remain in browser memory,
- generated output remains in browser memory,
- no cloud AI is called,
- no external storage is required.

---

# Optional server / AI fallback

The repository also contains infrastructure for optional server-side processing.

Implemented backend pieces include:

- FastAPI batch/document endpoints,
- PostgreSQL metadata,
- private temporary storage,
- Celery + Valkey queueing,
- worker PDF structural inspection/page counting,
- SSE processing events,
- malformed-PDF isolation,
- OpenCV local vision provider,
- optional Gemini provider,
- optional OpenAI provider.

Provider order:

```text
Local OpenCV
    ↓
Gemini (optional)
    ↓
OpenAI (optional)
    ↓
fresh deterministic validation
```

Important:

- the browser workflow does **not** automatically upload uncertain customer labels to AI,
- uncertain browser labels currently go to manual review,
- external AI crop proposals cannot approve a label by themselves,
- deterministic barcode/dimension/clipping validation is always required afterward.

The server worker is **not yet equivalent to the full browser normalization pipeline**; known marketplace normalization remains browser-primary.

---

# Configuration

## Required environment variables

None for local use.

A clean Docker launch works without `.env`.

---

## Optional local configuration

| Variable | Purpose | Default |
|---|---|---|
| `APP_NAME` | FastAPI application name | `Marketplace Shipping Label Normalizer API` |
| `ENVIRONMENT` | Backend environment label | `development` |
| `DATABASE_URL` | PostgreSQL connection string | local Compose PostgreSQL |
| `VALKEY_URL` | Celery broker/result backend | local Compose Valkey |
| `STORAGE_PROVIDER` | `local` or `imagekit` | `local` |
| `LOCAL_STORAGE_ROOT` | Private temporary storage root | `/var/lib/label-normalizer` |
| `MAX_FILE_BYTES` | Server fallback max PDF size | `26214400` / 25 MiB |
| `MAX_BATCH_DOCUMENTS` | Server fallback max documents | `20` |
| `MAX_PDF_PAGES` | Server fallback max pages/PDF | `200` |
| `PROCESSING_TIMEOUT_SECONDS` | Worker timeout basis | `120` |
| `TEMP_FILE_TTL_SECONDS` | Temporary record/file TTL | `3600` |
| `WORKER_CONCURRENCY` | Celery process concurrency | `2` |
| `LOCAL_VISION_ENABLED` | Enable OpenCV provider | `false` |
| `VISION_MAX_IMAGE_BYTES` | Max image size for vision coordinator | `5242880` / 5 MiB |
| `VISION_AUTO_APPROVE_CONFIDENCE` | Backend vision threshold setting | `0.85` |

Browser-local limits are code configuration:

- up to **100 PDFs** per browser batch,
- **50 MiB** per browser PDF,
- **500 pages** per browser batch,
- parse concurrency: **2**.

---

## Optional cloud providers

### Gemini

```env
AI_ENABLED=true
GEMINI_API_KEY=your_key
GEMINI_MODEL=gemini-3.6-flash
```

If the key is missing, Gemini is disabled.

### OpenAI

```env
AI_ENABLED=true
OPENAI_API_KEY=your_key
OPENAI_MODEL=gpt-5.4
```

If the key is missing, OpenAI is disabled.

### ImageKit

```env
STORAGE_PROVIDER=imagekit
IMAGEKIT_PRIVATE_KEY=your_private_key
IMAGEKIT_PUBLIC_KEY=your_public_key
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your_endpoint
```

Incomplete ImageKit configuration disables the provider.

### Neon

There is no separate `NEON_*` configuration.

Use a Neon-compatible PostgreSQL connection string:

```env
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST/DB?sslmode=require
```

---

## Zero-config behavior

With no `.env`, no Gemini/OpenAI keys, no ImageKit account, and no Neon account:

- Docker Compose starts successfully,
- browser-local Flipkart/Amazon/Meesho processing works,
- PDF-native normalization works,
- barcode/QR validation works locally,
- manual review works,
- Preview / Download / Print All work,
- local PostgreSQL is used,
- local Valkey is used,
- local private temporary storage is used,
- AI providers are disabled,
- no customer document is automatically uploaded to cloud AI.

---

# Printing

The generated PDF is already normalized to:

```text
100 mm × 150 mm
Portrait
```

Use the normal browser/OS print dialog.

Typical 4-inch thermal-printer settings:

```text
Paper size:   100 × 150 mm
Orientation:  Portrait
Scale:        100% / Actual Size
Copies:       1
```

`Print All` intentionally does **not** silently select or control a USB/network printer.

Printer driver settings remain under the user's control.

---

# Privacy

Shipping documents contain sensitive operational data such as:

- customer names,
- addresses,
- order identifiers,
- tracking identifiers,
- seller information.

The application is designed around local-first processing.

Currently implemented safeguards include:

- known marketplace processing occurs in browser memory by default,
- documents leave the browser only through an explicit server fallback path,
- cloud AI is not automatically invoked,
- PostgreSQL stores metadata rather than PDF binaries,
- local temporary files use UUID object names,
- local directories use `0700`,
- files use `0600`,
- temporary fallback data expires automatically,
- cleanup runs every 10 minutes,
- default TTL is one hour,
- raw barcode payloads are hashed before application-state storage,
- event messages avoid full customer address data,
- object URLs are revoked when no longer needed.

Real marketplace fixture PDFs are intentionally excluded from Git because they may contain customer PII.

---

# Security

Server fallback currently validates:

- PDF magic bytes (`%PDF-`),
- accepted MIME types,
- file size,
- batch document count,
- PDF page count,
- sanitized filenames.

Default server fallback limits:

```text
Max file size:        25 MiB
Documents per batch:  20
Pages per PDF:        200
Processing timeout:   120 seconds
```

Container hardening includes:

- API and worker run as non-root UID/GID `1001`,
- API and worker root filesystems are read-only,
- Caddy/API/worker/web/Valkey use `no-new-privileges`,
- bounded worker concurrency,
- one-task prefetch,
- task time limits,
- maximum tasks per child.

---

# Tech stack

| Area | Technology |
|---|---|
| Frontend | Next.js 16.3.1, React 19.2.8, TypeScript 6.0.3 |
| Styling / UI | Tailwind CSS 4.3.3, React Dropzone, Zustand |
| PDF parsing | PDF.js / `pdfjs-dist` 6.2.108 |
| PDF-native generation | `pdf-lib` 1.17.1 |
| Barcode / QR | `@zxing/library` 0.23.0 |
| Browser render tests | `@napi-rs/canvas` |
| Backend | FastAPI 0.141.1, Uvicorn, Pydantic Settings |
| Database | PostgreSQL 17, SQLAlchemy, Psycopg |
| Queue | Valkey 8.1 |
| Worker | Celery 5.6.3 |
| Worker PDF inspection | `pypdf` |
| Computer vision | OpenCV headless |
| Reverse proxy | Caddy |
| Containers | Docker Compose |
| TS tests | Vitest + Testing Library |
| Browser tests | Playwright |
| Python tests | Pytest |
| Python lint / format | Ruff |
| Optional AI | OpenCV → Gemini → OpenAI |
| Optional storage | Local private storage / ImageKit |

---

# Repository structure

```text
.
├── apps/
│   ├── web/                 # Next.js app + browser-local PDF workflow
│   └── api/                 # FastAPI, Celery, storage, vision providers
│
├── packages/
│   ├── config/              # Print dimensions, limits, confidence thresholds
│   ├── core/                # Adapters, native PDF output, validation, types
│   └── ui/                  # Shared UI components
│
├── docs/                    # Architecture, privacy, pipeline, deployment docs
├── e2e/                     # Playwright tests
├── infra/                   # Caddy configuration
├── scripts/                 # Fixture / layout inspection tools
└── compose.yaml             # Complete local Docker stack
```

---

# Development commands

Install dependencies:

```bash
npm ci
```

Run browser-local development:

```bash
npm run dev
```

Run tests:

```bash
npm test
```

Typecheck:

```bash
npm run typecheck
```

Lint:

```bash
npm run lint
```

Formatting check:

```bash
npm run format:check
```

Production build:

```bash
npm run build
```

Browser E2E:

```bash
npm run test:e2e
```

Backend tests:

```bash
docker compose run --rm --no-deps api python -m pytest -p no:cacheprovider
```

Backend lint:

```bash
docker compose run --rm --no-deps api ruff check --no-cache app tests
```

Backend format check:

```bash
docker compose run --rm --no-deps api ruff format --check --no-cache app tests
```

Validate Compose:

```bash
docker compose config --quiet
```

---

# Verification status

Latest recorded project verification:

| Check | Result |
|---|---:|
| Vitest | **44 passed** across 17 files |
| Pytest | **17 passed** |
| Playwright / Chromium | **10 passed** |
| TypeScript typecheck | Passed |
| ESLint | Passed |
| Prettier | Passed |
| Ruff lint | Passed |
| Ruff format check | Passed |
| Next.js production build | Passed |
| Docker Compose build/start | Passed |
| `docker compose config --quiet` | Passed |

Coverage includes:

- marketplace classification,
- fixture behavior,
- geometry / coordinate transforms,
- whitespace bounds,
- output dimensions,
- PDF-native barcode decode regression,
- confidence scoring,
- review flow,
- mixed batches,
- duplicate warnings,
- Download / Print All invocation,
- Docker server fallback,
- optional-provider disablement.

---

# Current limitations

This project deliberately fails safe when it does not have enough evidence.

Current limitations include:

- Marketplace support is based on confirmed layout families:
  - one Flipkart E-Kart + Tax Invoice family,
  - one Amazon raster-label + supplier-invoice family,
  - one Meesho package-label family.
- Unknown or drifted layouts route to review.
- Generic handling is conservative and is not automatic support for arbitrary marketplaces.
- Barcode validation currently supports Code 128, QR, Data Matrix, and PDF417.
- Labels without sufficient machine-readable evidence may require review even when visually usable.
- Output is currently fixed to **100 × 150 mm portrait**.
- Unusual source rotation may require manual correction.
- The crop editor currently has a single resize handle.
- Browser batches are in-memory and do not survive refresh.
- Browser print/preview behavior depends on the browser and OS.
- Popup blocking can affect `Print All`.
- The server worker does not yet reproduce the full browser marketplace-normalization pipeline.
- Optional cloud providers have contract tests but have not been live-tested with paid credentials.
- Explicit database migrations should be added before running multiple production API replicas.
- The local Compose configuration is not a hardened multi-tenant public SaaS deployment.
- Authentication, user accounts, and tenancy are not currently implemented.
- Real marketplace fixtures are not committed because they contain shipping/customer PII.

---

# Documentation

Detailed documentation lives under [`docs/`](docs/):

| Document | Description |
|---|---|
| [`ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Browser-first and fallback architecture |
| [`PDF_PIPELINE.md`](docs/PDF_PIPELINE.md) | Processing stages, coordinates, output generation |
| [`MARKETPLACE_ADAPTERS.md`](docs/MARKETPLACE_ADAPTERS.md) | Flipkart, Amazon, Meesho, Generic behavior |
| [`CONFIDENCE_AND_VALIDATION.md`](docs/CONFIDENCE_AND_VALIDATION.md) | 203 DPI validation and confidence rules |
| [`PRIVACY.md`](docs/PRIVACY.md) | Local-first privacy and PII policy |
| [`DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Docker services and deployment configuration |
| [`PRODUCTION_TEST_CHECKLIST.md`](docs/PRODUCTION_TEST_CHECKLIST.md) | Manual browser/printer/provider checks |
| [`IMPLEMENTATION_LOG.md`](docs/IMPLEMENTATION_LOG.md) | Phase-by-phase implementation history |
| [`ADDING_A_MARKETPLACE.md`](docs/ADDING_A_MARKETPLACE.md) | How to add a new marketplace/layout |
| [`CHANGED_FILES.md`](docs/CHANGED_FILES.md) | Phase 0–10 implementation manifest |

---

# Adding a marketplace

Marketplace behavior is adapter-based rather than scattered across the application.

The current design includes:

```text
MarketplaceAdapter
├── FlipkartAdapter
├── AmazonAdapter
├── MeeshoAdapter
└── GenericAdapter
```

New marketplace support should include:

1. representative privacy-safe fixtures,
2. page/document classification,
3. printable-region detection,
4. layout fingerprinting,
5. output normalization,
6. validation policy,
7. golden regression tests,
8. unknown-layout fallback behavior.

See [`docs/ADDING_A_MARKETPLACE.md`](docs/ADDING_A_MARKETPLACE.md).

---

# Roadmap

Possible next steps:

- [ ] public-safe synthetic marketplace fixtures
- [ ] README screenshots / demo GIF
- [ ] CI with GitHub Actions
- [ ] explicit database migrations
- [ ] authentication / accounts
- [ ] durable batch history
- [ ] configurable thermal-label sizes
- [ ] richer crop-resize controls
- [ ] additional marketplace/courier adapters
- [ ] full server-side normalization parity
- [ ] live integration tests for optional cloud providers
- [ ] production deployment templates

---

# Contributing

The project already has a testable modular architecture, but dedicated public contribution documents are not yet included.

Before accepting external contributions, add:

- `CONTRIBUTING.md`
- `CODE_OF_CONDUCT.md`
- `SECURITY.md`
- GitHub Actions CI
- a public-safe fixture strategy

Useful local checks before opening a pull request:

```bash
npm test
npm run typecheck
npm run lint
npm run format:check
npm run build
npm run test:e2e
docker compose config --quiet
```

---

# License

**No open-source license has been selected yet.**

Until a license is added, normal copyright rules apply and public availability of the repository does not automatically grant permission to copy, modify, or redistribute the code.

If this repository is intended to be genuinely open source, add a license before announcing the public release.

---

# Privacy note for contributors

Never commit real shipping documents.

Real seller PDFs may contain:

- customer names,
- addresses,
- order IDs,
- tracking/AWB values,
- GST/tax data,
- seller details,
- machine-readable codes.

Use synthetic or properly anonymized fixtures only.

---

<p align="center">
  <strong>From messy marketplace PDFs to one predictable thermal-label workflow.</strong>
</p>
