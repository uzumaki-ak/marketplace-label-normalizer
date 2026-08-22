# Privacy

Known Flipkart, Amazon, and Meesho processing is local-first. Source `File` objects, PDF.js handles, rendered validation images, and generated PDFs stay in browser memory. Reset revokes object URLs; refresh/close releases the local batch.

Technical events may record byte size, page number, dimensions, duration, marketplace evidence, and safe failure codes. They must not contain full extracted text, customer addresses, phone numbers, order IDs, tracking values, or raw barcode payloads. Machine-readable payloads are reduced to SHA-256 hashes before application-state storage.

Server fallback is an explicit boundary for problematic documents. Upload handling checks size, MIME/magic bytes, page count, sanitized names, random private storage keys, processing time, and isolated document failure. PostgreSQL stores metadata—not PDF binaries—and Celery TTL cleanup removes expired private objects.

Local vision is preferred when enabled. Cloud vision receives only the minimum rendered page/region needed for crop analysis, never an entire batch or source PDF by default. Optional provider credentials are blank by default; cloud calls are disabled unless both `AI_ENABLED=true` and the corresponding key are configured. Provider identity and evidence are recorded, and deterministic validation must still approve any proposal.
