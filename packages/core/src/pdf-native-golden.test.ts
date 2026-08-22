// @vitest-environment node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import type { NormalizationContext } from "./adapter";
import { TARGET_LABEL_SIZE_PT } from "./constants";
import {
  assembleNormalizedLabels,
  normalizePdfRegionNative,
} from "./pdf-native";
import type {
  Marketplace,
  PdfDocumentAnalysis,
  PdfPageAnalysis,
  PdfRect,
} from "./types";

const CASES: readonly {
  readonly marketplace: Exclude<Marketplace, "unknown">;
  readonly fixture: string;
  readonly pageNumber: number;
  readonly pageSize: readonly [number, number];
  readonly crop: PdfRect;
}[] = [
  {
    marketplace: "flipkart",
    fixture: "docs/fixtures/flipkart/invoice_labels_1786940253611.pdf",
    pageNumber: 1,
    pageSize: [595, 842],
    crop: { x: 189.25, y: 458.25, width: 217, height: 356.5 },
  },
  {
    marketplace: "amazon",
    fixture: "docs/fixtures/amazon/document (6).pdf",
    pageNumber: 1,
    pageSize: [595, 842],
    crop: { x: 8, y: 8, width: 579, height: 826 },
  },
  {
    marketplace: "meesho",
    fixture:
      "docs/fixtures/meesho/Sub_Order_Labels_5dc607bf-c639-4e34-85d4-ba221312a317.pdf",
    pageNumber: 1,
    pageSize: [595, 842],
    crop: { x: 7, y: 235, width: 578, height: 600 },
  },
];

describe("PDF-native real-fixture normalization", () => {
  it("creates one exact portrait page per representative marketplace label", async () => {
    const labels = [];
    for (const [outputOrder, fixture] of CASES.entries()) {
      const sourcePdfBytes = new Uint8Array(
        await readFile(path.resolve(process.cwd(), fixture.fixture)),
      );
      const normalized = await normalizePdfRegionNative(
        contextFor(sourcePdfBytes, fixture, outputOrder),
        {
          marketplace: fixture.marketplace,
          adapterId: fixture.marketplace,
          adapterVersion: "golden",
        },
      );
      const output = await PDFDocument.load(normalized.pdfBytes);
      const page = output.getPage(0);
      expect(output.getPageCount()).toBe(1);
      expect(page.getWidth()).toBeCloseTo(TARGET_LABEL_SIZE_PT.width, 9);
      expect(page.getHeight()).toBeCloseTo(TARGET_LABEL_SIZE_PT.height, 9);
      labels.push(normalized);
    }

    const combined = await assembleNormalizedLabels(labels);
    const output = await PDFDocument.load(combined.pdfBytes);
    expect(combined.pageCount).toBe(3);
    expect(output.getPageCount()).toBe(3);
    for (const page of output.getPages()) {
      expect(page.getWidth()).toBeCloseTo(TARGET_LABEL_SIZE_PT.width, 9);
      expect(page.getHeight()).toBeCloseTo(TARGET_LABEL_SIZE_PT.height, 9);
    }
  });
});

function contextFor(
  sourcePdfBytes: Uint8Array,
  fixture: (typeof CASES)[number],
  outputOrder: number,
): NormalizationContext<PdfDocumentAnalysis, PdfPageAnalysis> {
  const pageId = `${fixture.marketplace}:page:${fixture.pageNumber}`;
  const [widthPt, heightPt] = fixture.pageSize;
  const geometry = {
    widthPt,
    heightPt,
    rotation: 0 as const,
    mediaBox: { x: 0, y: 0, width: widthPt, height: heightPt },
  };
  const page: PdfPageAnalysis = {
    pageId,
    pageNumber: fixture.pageNumber,
    geometry,
    textItems: [],
  };
  const document: PdfDocumentAnalysis = {
    documentId: fixture.marketplace,
    pages: [page],
  };
  return {
    pageContext: {
      documentContext: {
        batchId: "golden-batch",
        documentId: fixture.marketplace,
        source: {
          id: fixture.marketplace,
          name: path.basename(fixture.fixture),
          sizeBytes: sourcePdfBytes.length,
          mimeType: "application/pdf",
          uploadIndex: outputOrder,
          lastModified: 0,
        },
        document,
        emit: () => undefined,
      },
      pageId,
      pageNumber: fixture.pageNumber,
      page,
      geometry,
      textItems: [],
    },
    region: {
      id: `${pageId}:region:0`,
      documentId: fixture.marketplace,
      pageId,
      regionIndex: 0,
      boundsPt: fixture.crop,
      confidence: 1,
      evidence: [],
      requiresReview: false,
    },
    sourcePdfBytes,
    outputOrder,
  };
}
