export const INGEST_LIMITS = Object.freeze({
  maxDocumentsPerBatch: 100,
  maxBytesPerDocument: 50 * 1024 * 1024,
  maxPagesPerBatch: 500,
  parseConcurrency: 2,
  previewWidthPx: 280,
});

export const PRINT_CONFIG = Object.freeze({
  widthMm: 100,
  heightMm: 150,
  pointsPerInch: 72,
  millimetresPerInch: 25.4,
  validationDpi: 203,
  orientation: "portrait" as const,
  targetPrinter: "PeriPeri S1",
});

export const CONFIDENCE_THRESHOLDS = Object.freeze({
  autoApprove: 0.95,
  secondaryVerification: 0.8,
});
