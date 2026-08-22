# Adding a Marketplace

1. Add anonymized fixture PDFs and manifests before writing rules.
2. Create a versioned adapter folder under `packages/core/src/marketplace/adapters/<id>`.
3. Implement document detection, per-page classification, printable-region detection, normalization delegation, and validation evidence.
4. Use PDF geometry and text anchors before OCR or vision. Never use a fixed page percentage as the primary crop rule.
5. Store regions in canonical PDF points and include the matched layout fingerprint.
6. Add unit, golden, regression, and structural visual tests.
7. Route fingerprint drift or missing mandatory evidence to review.
8. Register the adapter without adding marketplace-specific conditionals to the core pipeline.

Every confirmed production layout bug becomes a named fixture and permanent regression test.
