import type {
  NormalizedLabel,
  PdfPageAnalysis,
  PdfRect,
  PdfTextItem,
  ValidationResult,
} from "../types";

export function normalizeText(value: string): string {
  return value.toLowerCase().replaceAll(/\s+/g, " ").trim();
}

export function pageContains(
  page: Pick<PdfPageAnalysis, "textItems">,
  anchor: string,
): boolean {
  const normalizedAnchor = normalizeText(anchor);
  return page.textItems.some((item) =>
    normalizeText(item.text).includes(normalizedAnchor),
  );
}

export function findTextItem(
  page: Pick<PdfPageAnalysis, "textItems">,
  anchor: string,
  predicate: (item: PdfTextItem) => boolean = () => true,
): PdfTextItem | undefined {
  const normalizedAnchor = normalizeText(anchor);
  return page.textItems.find(
    (item) =>
      predicate(item) && normalizeText(item.text).includes(normalizedAnchor),
  );
}

export function clampConfidence(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function clampRect(rect: PdfRect, bounds: PdfRect): PdfRect {
  const left = Math.max(bounds.x, rect.x);
  const bottom = Math.max(bounds.y, rect.y);
  const right = Math.min(bounds.x + bounds.width, rect.x + rect.width);
  const top = Math.min(bounds.y + bounds.height, rect.y + rect.height);
  return {
    x: left,
    y: bottom,
    width: Math.max(0, right - left),
    height: Math.max(0, top - bottom),
  };
}

export async function normalizationPending(): Promise<NormalizedLabel> {
  throw new Error("PDF-native normalization is implemented in Phase 5.");
}

export async function validationPending(): Promise<ValidationResult> {
  throw new Error("Machine-readable validation is implemented in Phase 6.");
}
