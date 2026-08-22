# Confidence and Validation

Every normalized candidate is rendered temporarily at 203 DPI. Local ZXing scans bounded full/half/quadrant regions for Code 128, QR, Data Matrix, and PDF417, checks decode success and bounds, and reduces payloads to SHA-256 hashes.

Confidence is evidence-based. Named signals cover marketplace anchors, page kind, geometry, expected text, crop boundaries, barcode detection/decode, QR detection/decode, clipping safety, and layout fingerprint. The normal auto-approval threshold is 0.82, but aggregate score can never override mandatory output-dimension, expected machine-readable-code, or clipping checks.

Clipping evidence permits one bounded native crop-margin retry. Remaining uncertainty goes to review. Duplicate warnings use reliable order/tracking evidence when safely extracted, hashed decoded payloads, or a strong page fingerprint; candidates are never silently deleted.

AI fallback follows the same rule. It is not invoked after deterministic success. A local/Gemini/OpenAI proposal is only a crop hypothesis; the resulting native crop must pass a fresh deterministic validation at the configured threshold. Model confidence and model voting are never proof of print safety.
