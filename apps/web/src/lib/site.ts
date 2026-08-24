const DEFAULT_SITE_URL = "https://marketplace-label-normalizer.onrender.com";

export const SITE_NAME = "Label Normalizer";
export const SITE_TITLE =
  "Marketplace Shipping Label Normalizer | Flipkart, Amazon & Meesho";
export const SITE_DESCRIPTION =
  "Convert mixed Flipkart, Amazon, and Meesho shipping PDFs into barcode-validated, print-ready 100 x 150 mm labels directly in your browser.";

export const SITE_URL = (() => {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  try {
    return new URL(configuredUrl || DEFAULT_SITE_URL);
  } catch {
    return new URL(DEFAULT_SITE_URL);
  }
})();

export const SITE_KEYWORDS = [
  "marketplace shipping label normalizer",
  "shipping label converter",
  "Flipkart shipping label",
  "Amazon shipping label",
  "Meesho shipping label",
  "Flipkart label crop",
  "Amazon invoice label separator",
  "Meesho label whitespace remover",
  "100 x 150 mm shipping label",
  "4 x 6 shipping label",
  "thermal printer label PDF",
  "shipping PDF crop tool",
  "mixed marketplace labels",
  "barcode validated shipping label",
  "PDF native label extraction",
  "print ready shipping labels",
  "ecommerce seller shipping labels",
  "PeriPeri S1 label printing",
] as const;

export function absoluteUrl(path = "/"): string {
  return new URL(path, SITE_URL).toString();
}
