// @vitest-environment node

import { PDFDocument, StandardFonts } from "pdf-lib";
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { NormalizationContext } from "./adapter";
import {
  assembleNormalizedLabels,
  calculateNativePlacement,
  normalizePdfRegionNative,
} from "./pdf-native";
import { TARGET_LABEL_SIZE_PT } from "./constants";
import type { PdfDocumentAnalysis, PdfPageAnalysis } from "./types";

describe("PDF-native normalization", () => {
  it("maximizes content while preserving aspect ratio", () => {
    const placement = calculateNativePlacement({ width: 200, height: 400 });
    expect(placement.y).toBe(0);
    expect(placement.height).toBeCloseTo(TARGET_LABEL_SIZE_PT.height, 9);
    expect(placement.scale).toBeCloseTo(TARGET_LABEL_SIZE_PT.height / 400, 9);
    expect(placement.x).toBeGreaterThan(0);
  });

  it("embeds vector/text PDF content instead of creating a screenshot", async () => {
    const sourceBytes = await createTwoPageSource();
    const normalized = await normalizePdfRegionNative(
      contextFor(sourceBytes, 1, 0),
      { marketplace: "unknown", adapterId: "test", adapterVersion: "1" },
    );
    const output = await PDFDocument.load(normalized.pdfBytes);
    const page = output.getPage(0);

    expect(page.getWidth()).toBeCloseTo(TARGET_LABEL_SIZE_PT.width, 9);
    expect(page.getHeight()).toBeCloseTo(TARGET_LABEL_SIZE_PT.height, 9);

    const loadingTask = getDocument({ data: normalized.pdfBytes });
    const pdf = await loadingTask.promise;
    const renderedPage = await pdf.getPage(1);
    const operators = await renderedPage.getOperatorList();
    const imagePaints = operators.fnArray.filter(
      (operator) => operator === OPS.paintImageXObject,
    );
    const text = await renderedPage.getTextContent();

    expect(imagePaints).toHaveLength(0);
    expect(
      text.items.some((item) => "str" in item && item.str.includes("FIRST")),
    ).toBe(true);
    await loadingTask.destroy();
  });

  it("assembles one exact target page per label in output order", async () => {
    const sourceBytes = await createTwoPageSource();
    const second = await normalizePdfRegionNative(
      contextFor(sourceBytes, 2, 1),
      { marketplace: "unknown", adapterId: "test", adapterVersion: "1" },
    );
    const first = await normalizePdfRegionNative(
      contextFor(sourceBytes, 1, 0),
      { marketplace: "unknown", adapterId: "test", adapterVersion: "1" },
    );
    const combined = await assembleNormalizedLabels([second, first]);
    const output = await PDFDocument.load(combined.pdfBytes);

    expect(combined.filename).toBe("PRINT_READY_LABELS.pdf");
    expect(combined.pageCount).toBe(2);
    expect(output.getPageCount()).toBe(2);
    for (const page of output.getPages()) {
      expect(page.getWidth()).toBeCloseTo(TARGET_LABEL_SIZE_PT.width, 9);
      expect(page.getHeight()).toBeCloseTo(TARGET_LABEL_SIZE_PT.height, 9);
    }
  });
});

async function createTwoPageSource(): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  for (const text of ["FIRST NATIVE LABEL", "SECOND NATIVE LABEL"]) {
    const page = document.addPage([300, 500]);
    page.drawText(text, { x: 30, y: 400, size: 18, font });
    page.drawRectangle({
      x: 20,
      y: 40,
      width: 260,
      height: 420,
      borderWidth: 2,
    });
  }
  return document.save();
}

function contextFor(
  sourcePdfBytes: Uint8Array,
  pageNumber: number,
  outputOrder: number,
): NormalizationContext<PdfDocumentAnalysis, PdfPageAnalysis> {
  const pageId = `document:page:${pageNumber}`;
  const geometry = {
    widthPt: 300,
    heightPt: 500,
    rotation: 0 as const,
    mediaBox: { x: 0, y: 0, width: 300, height: 500 },
  };
  const page: PdfPageAnalysis = {
    pageId,
    pageNumber,
    geometry,
    textItems: [],
  };
  const document: PdfDocumentAnalysis = {
    documentId: "document",
    pages: [page],
  };
  return {
    pageContext: {
      documentContext: {
        batchId: "batch",
        documentId: "document",
        source: {
          id: "document",
          name: "source.pdf",
          sizeBytes: sourcePdfBytes.length,
          mimeType: "application/pdf",
          uploadIndex: 0,
          lastModified: 0,
        },
        document,
        emit: () => undefined,
      },
      pageId,
      pageNumber,
      page,
      geometry,
      textItems: [],
    },
    region: {
      id: `${pageId}:region:0`,
      documentId: "document",
      pageId,
      regionIndex: 0,
      boundsPt: { x: 0, y: 0, width: 300, height: 500 },
      confidence: 1,
      evidence: [],
      requiresReview: false,
    },
    sourcePdfBytes,
    outputOrder,
  };
}
