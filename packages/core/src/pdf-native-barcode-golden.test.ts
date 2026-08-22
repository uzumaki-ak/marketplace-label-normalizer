// @vitest-environment node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { NormalizationContext } from "./adapter";
import { analyzeMachineReadablePixels } from "./machine-readable";
import { normalizePdfRegionNative } from "./pdf-native";
import type {
  Marketplace,
  PdfDocumentAnalysis,
  PdfPageAnalysis,
  PdfRect,
} from "./types";

const DPI = 203;
const SCALE = DPI / 72;
const CASES: readonly {
  readonly marketplace: Exclude<Marketplace, "unknown">;
  readonly fixture: string;
  readonly crop: PdfRect;
}[] = [
  {
    marketplace: "flipkart",
    fixture: "docs/fixtures/flipkart/invoice_labels_1786940253611.pdf",
    crop: { x: 189.25, y: 458.25, width: 217, height: 356.5 },
  },
  {
    marketplace: "amazon",
    fixture: "docs/fixtures/amazon/document (6).pdf",
    crop: { x: 8, y: 8, width: 579, height: 826 },
  },
  {
    marketplace: "meesho",
    fixture:
      "docs/fixtures/meesho/Sub_Order_Labels_5dc607bf-c639-4e34-85d4-ba221312a317.pdf",
    crop: { x: 7, y: 235, width: 578, height: 600 },
  },
];

describe("PDF-native 203 DPI barcode quality regression", () => {
  for (const fixture of CASES) {
    it(`preserves a decodable payload for ${fixture.marketplace}`, async () => {
      const sourceBytes = new Uint8Array(
        await readFile(path.resolve(process.cwd(), fixture.fixture)),
      );
      const originalPage = await renderPage(sourceBytes, 1);
      const originalCrop = cropRenderedPage(
        originalPage,
        fixture.crop,
        842,
        SCALE,
      );
      const original = analyzeMachineReadablePixels(
        originalCrop.rgba,
        originalCrop.width,
        originalCrop.height,
      );
      const normalized = await normalizePdfRegionNative(
        contextFor(sourceBytes, fixture),
        {
          marketplace: fixture.marketplace,
          adapterId: fixture.marketplace,
          adapterVersion: "golden",
        },
      );
      const outputPage = await renderPage(normalized.pdfBytes, 1);
      const output = analyzeMachineReadablePixels(
        outputPage.rgba,
        outputPage.width,
        outputPage.height,
      );
      const originalPayloads = new Set(
        original.decodedCodes.map((code) => code.payload),
      );

      expect(originalPayloads.size).toBeGreaterThan(0);
      expect(
        output.decodedCodes.some((code) => originalPayloads.has(code.payload)),
      ).toBe(true);
      expect(output.clippingRisk).toBeLessThan(0.25);
    }, 30_000);
  }
});

async function renderPage(bytes: Uint8Array, pageNumber: number) {
  const loadingTask = getDocument({
    data: bytes.slice(),
    useSystemFonts: true,
    wasmUrl: `${path
      .resolve("node_modules", "pdfjs-dist", "wasm")
      .replaceAll("\\", "/")}/`,
  });
  const document = await loadingTask.promise;
  const page = await document.getPage(pageNumber);
  const viewport = page.getViewport({ scale: SCALE });
  const canvas = createCanvas(
    Math.ceil(viewport.width),
    Math.ceil(viewport.height),
  );
  const context = canvas.getContext("2d");
  await page.render({
    canvas: canvas as never,
    canvasContext: context as never,
    viewport,
  }).promise;
  const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
  await loadingTask.destroy();
  return { rgba, width: canvas.width, height: canvas.height };
}

function cropRenderedPage(
  rendered: { readonly rgba: Uint8ClampedArray; readonly width: number },
  crop: PdfRect,
  pageHeightPt: number,
  scale: number,
) {
  const left = Math.max(0, Math.floor(crop.x * scale));
  const top = Math.max(
    0,
    Math.floor((pageHeightPt - crop.y - crop.height) * scale),
  );
  const width = Math.ceil(crop.width * scale);
  const height = Math.ceil(crop.height * scale);
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const sourceStart = ((top + y) * rendered.width + left) * 4;
    rgba.set(
      rendered.rgba.subarray(sourceStart, sourceStart + width * 4),
      y * width * 4,
    );
  }
  return { rgba, width, height };
}

function contextFor(
  sourcePdfBytes: Uint8Array,
  fixture: (typeof CASES)[number],
): NormalizationContext<PdfDocumentAnalysis, PdfPageAnalysis> {
  const pageId = `${fixture.marketplace}:page:1`;
  const geometry = {
    widthPt: 595,
    heightPt: 842,
    rotation: 0 as const,
    mediaBox: { x: 0, y: 0, width: 595, height: 842 },
  };
  const page: PdfPageAnalysis = {
    pageId,
    pageNumber: 1,
    geometry,
    textItems: [],
  };
  const document = { documentId: fixture.marketplace, pages: [page] };
  return {
    pageContext: {
      documentContext: {
        batchId: "quality-batch",
        documentId: fixture.marketplace,
        source: {
          id: fixture.marketplace,
          name: path.basename(fixture.fixture),
          sizeBytes: sourcePdfBytes.length,
          mimeType: "application/pdf",
          uploadIndex: 0,
          lastModified: 0,
        },
        document,
        emit: () => undefined,
      },
      pageId,
      pageNumber: 1,
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
    outputOrder: 0,
  };
}
