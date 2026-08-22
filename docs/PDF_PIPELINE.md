# PDF Pipeline

## State and events

```text
INGEST → PARSE → CLASSIFY → EXTRACT → NORMALIZE → VALIDATE
       → REVIEW when uncertain → ASSEMBLE → COMPLETE
```

Events are append-only, stage-expandable, and attributable to batch/document/page/label. `failed`, `skipped`, and `cancelled` are explicit outcomes. Work retries at the smallest safe scope, and one failure never terminates unrelated documents.

## Coordinates and output

Canonical rectangles use PDF points (`1 pt = 1/72 inch`) with a bottom-left origin. PDF.js affine transforms map those rectangles to preview pixels; editor gestures are inverse-transformed back into PDF points. Crop state is never stored as a hardcoded page percentage.

Each production page is exactly:

```text
width  = 100 × 72 / 25.4 = 283.464566929... pt
height = 150 × 72 / 25.4 = 425.196850394... pt
```

`pdf-lib` embeds the original source page with the selected native bounding box, aspect-fits it without distortion, and centers it on the exact portrait page. Canvas and WebP output are never used as final label content.

## Browser pipeline

1. Preserve selection order; reject count, size, extension/MIME, and `%PDF-` violations safely.
2. Parse every valid PDF and enumerate every page under bounded concurrency.
3. Collect text, geometry, low-resolution preview, and layout fingerprint evidence.
4. Select Flipkart, Amazon, Meesho, or Generic adapter; independently classify every page.
5. Find zero or more shipping regions and explicitly exclude invoice-only pages.
6. Normalize each candidate from original PDF bytes to a native 100 × 150 mm page.
7. Render only a temporary validation copy at 203 DPI; decode expected codes, check dimensions/clipping, score evidence, and retry one sensible margin where indicated.
8. Send uncertainty to the crop/rotation editor; approve, skip, re-detect, or download one label.
9. Assemble every ready label in deterministic order into `PRINT_READY_LABELS.pdf`.
10. Preview/download that exact byte stream or open it in the browser/OS print flow.

## Fallback pipeline

Known workflows remain browser-local. An explicitly uploaded problematic document is stored privately, inspected by a bounded Celery worker, and reported through the same event model. Optional vision providers receive only a minimum rendered image after deterministic uncertainty. Their proposed coordinates must be applied to original PDF content and deterministically revalidated; otherwise the item remains in review.
