// @vitest-environment node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { DocumentContext, PageContext } from "../../../adapter";
import type {
  PdfDocumentAnalysis,
  PdfPageAnalysis,
  PdfTextItem,
} from "../../../types";
import { FlipkartAdapter, FLIPKART_LAYOUT_V1 } from ".";

const FIXTURES = [
  { name: "invoice_labels_1786940253611.pdf", pages: 5 },
  { name: "invoice_labels_1787124642173.pdf", pages: 2 },
  { name: "invoice_labels_1787198629737.pdf", pages: 3 },
] as const;

describe("FlipkartAdapter golden fixtures", () => {
  const adapter = new FlipkartAdapter();

  for (const fixture of FIXTURES) {
    it(`classifies and extracts every page in ${fixture.name}`, async () => {
      const analysis = await readFixture(fixture.name);
      const documentContext = createDocumentContext(analysis, fixture.name);
      const detection = await adapter.detectDocument(documentContext);

      expect(analysis.pages).toHaveLength(fixture.pages);
      expect(detection.marketplace).toBe("flipkart");
      expect(detection.confidence).toBeGreaterThanOrEqual(0.95);
      expect(detection.layoutFingerprint).toBe(FLIPKART_LAYOUT_V1);

      const regions = [];
      for (const page of analysis.pages) {
        const pageContext = createPageContext(documentContext, page);
        const classification = await adapter.classifyPage(pageContext);
        const pageRegions = await adapter.findPrintableRegions(pageContext);

        expect(classification.marketplace).toBe("flipkart");
        expect(classification.pageKind).toBe("shipping_plus_invoice");
        expect(classification.confidence).toBeGreaterThanOrEqual(0.95);
        expect(classification.layoutFingerprint).toBe(FLIPKART_LAYOUT_V1);
        expect(pageRegions).toHaveLength(1);
        expect(pageRegions[0]?.requiresReview).toBe(false);
        expect(pageRegions[0]?.confidence).toBeGreaterThanOrEqual(0.95);
        expect(pageRegions[0]?.boundsPt.x).toBeCloseTo(189.25, 1);
        expect(pageRegions[0]?.boundsPt.y).toBeCloseTo(458.25, 1);
        expect(pageRegions[0]?.boundsPt.width).toBeCloseTo(217, 1);
        expect(pageRegions[0]?.boundsPt.height).toBeCloseTo(356.5, 1);
        regions.push(...pageRegions);
      }

      expect(regions).toHaveLength(fixture.pages);
    });
  }

  it("lowers confidence and requires review when the layout fingerprint drifts", async () => {
    const analysis = await readFixture(FIXTURES[0].name);
    const sourcePage = analysis.pages[0];
    expect(sourcePage).toBeDefined();
    if (!sourcePage) return;
    const driftedPage: PdfPageAnalysis = {
      ...sourcePage,
      geometry: {
        ...sourcePage.geometry,
        widthPt: 612,
        heightPt: 792,
        mediaBox: { x: 0, y: 0, width: 612, height: 792 },
      },
    };
    const driftedAnalysis = { ...analysis, pages: [driftedPage] };
    const documentContext = createDocumentContext(
      driftedAnalysis,
      "drifted.pdf",
    );
    const [region] = await adapter.findPrintableRegions(
      createPageContext(documentContext, driftedPage),
    );

    expect(region?.layoutFingerprint).toBeUndefined();
    expect(region?.requiresReview).toBe(true);
    expect(region?.confidence).toBeLessThan(0.95);
  });

  it("does not identify a Tax Invoice anchor alone as Flipkart", async () => {
    const page: PdfPageAnalysis = {
      pageId: "document:page:1",
      pageNumber: 1,
      geometry: {
        widthPt: 595,
        heightPt: 842,
        rotation: 0,
        mediaBox: { x: 0, y: 0, width: 595, height: 842 },
      },
      textItems: [{ text: "Tax Invoice" }],
    };
    const analysis = { documentId: "document", pages: [page] };
    const detection = await adapter.detectDocument(
      createDocumentContext(analysis, "invoice-only.pdf"),
    );

    expect(detection.marketplace).toBe("unknown");
    expect(detection.confidence).toBe(0);
  });
});

async function readFixture(name: string): Promise<PdfDocumentAnalysis> {
  const fixturePath = path.resolve(
    process.cwd(),
    "docs",
    "fixtures",
    "flipkart",
    name,
  );
  const bytes = new Uint8Array(await readFile(fixturePath));
  const loadingTask = getDocument({ data: bytes, useSystemFonts: true });
  const document = await loadingTask.promise;
  const pages: PdfPageAnalysis[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const [x1 = 0, y1 = 0, x2 = 0, y2 = 0] = page.view;
    pages.push({
      pageId: `fixture:page:${pageNumber}`,
      pageNumber,
      geometry: {
        widthPt: Math.abs(x2 - x1),
        heightPt: Math.abs(y2 - y1),
        rotation: 0,
        mediaBox: {
          x: Math.min(x1, x2),
          y: Math.min(y1, y2),
          width: Math.abs(x2 - x1),
          height: Math.abs(y2 - y1),
        },
      },
      textItems: textContent.items.flatMap<PdfTextItem>((item) => {
        if (!("str" in item)) return [];
        const [a = 1, b = 0, c = 0, d = 1, x = 0, y = 0] = item.transform;
        return [
          {
            text: item.str,
            transform: [a, b, c, d, x, y],
            boundsPt: {
              x,
              y,
              width: item.width,
              height: item.height,
            },
          },
        ];
      }),
    });
    page.cleanup();
  }
  await loadingTask.destroy();
  return { documentId: `fixture:${name}`, pages };
}

function createDocumentContext(
  analysis: PdfDocumentAnalysis,
  name: string,
): DocumentContext<PdfDocumentAnalysis> {
  return {
    batchId: "fixture-batch",
    documentId: analysis.documentId,
    source: {
      id: analysis.documentId,
      name,
      sizeBytes: 1,
      mimeType: "application/pdf",
      uploadIndex: 0,
      lastModified: 0,
    },
    document: analysis,
    emit: () => undefined,
  };
}

function createPageContext(
  documentContext: DocumentContext<PdfDocumentAnalysis>,
  page: PdfPageAnalysis,
): PageContext<PdfDocumentAnalysis, PdfPageAnalysis> {
  return {
    documentContext,
    pageId: page.pageId,
    pageNumber: page.pageNumber,
    page,
    geometry: page.geometry,
    textItems: page.textItems,
  };
}
