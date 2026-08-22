# Marketplace Adapters

Adapters live under `packages/core/src/marketplace/adapters/` and implement the shared `MarketplaceAdapter` contract. Selection is document-aware, but every source page is classified independently.

## Implemented adapters

- `FlipkartAdapter`: detects E-Kart/shipping anchors and geometric separators, retains the top shipping region, and excludes the lower Tax Invoice. The primary decision is evidence/geometry based—not a fixed percentage crop.
- `AmazonAdapter`: classifies shipping-label versus supplier/seller invoice pages from page anchors and layout evidence. It does not assume a permanent two-page export.
- `MeeshoAdapter`: combines observed anchors, raster meaningful-content bounds, whitespace trimming, and safe padding to maximize package-label area without clipping.
- `GenericAdapter`: conservatively preserves plausible content but routes uncertainty to review instead of silently guessing.

Each adapter has a stable ID/version and known layout fingerprints. Unknown or drifted fingerprints lower confidence and route to manual review. Fixture expectations and anonymized manifests are under `docs/fixtures/`; raw PDFs are git-ignored because they contain shipping information.

To add a marketplace, follow [ADDING_A_MARKETPLACE.md](ADDING_A_MARKETPLACE.md): add confirmed fixtures, named evidence, fingerprints, crop tolerances, expected codes, golden tests, and mixed-batch E2E coverage before enabling automatic approval.
