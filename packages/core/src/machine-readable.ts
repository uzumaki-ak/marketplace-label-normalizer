import {
  BarcodeFormat,
  BinaryBitmap,
  Code128Reader,
  DataMatrixReader,
  DecodeHintType,
  HybridBinarizer,
  PDF417Reader,
  QRCodeReader,
  RGBLuminanceSource,
  type Reader,
} from "@zxing/library";
import type { MachineReadableCodeResult, PdfRect } from "./types";

export interface DecodedMachineReadableCode {
  readonly format: MachineReadableCodeResult["format"];
  readonly payload: string;
  readonly boundsPx?: PdfRect;
  readonly clipped: boolean;
}

export interface PixelMachineReadableAnalysis {
  readonly decodedCodes: readonly DecodedMachineReadableCode[];
  readonly linearPatternDetected: boolean;
  readonly edgeInkRatio: number;
  readonly clippingRisk: number;
}

export function analyzeMachineReadablePixels(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): PixelMachineReadableAnalysis {
  const decodedCodes = decodeMachineReadableCodes(rgba, width, height);
  const edgeInkRatio = calculateEdgeInkRatio(rgba, width, height);
  const decodedClipped = decodedCodes.some((code) => code.clipped);
  return {
    decodedCodes,
    linearPatternDetected:
      decodedCodes.some((code) => isLinearFormat(code.format)) ||
      detectLinearPattern(rgba, width, height),
    edgeInkRatio,
    clippingRisk: Math.min(
      1,
      Math.max(decodedClipped ? 0.65 : 0, edgeInkRatio * 8),
    ),
  };
}

export function decodeMachineReadableCodes(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): readonly DecodedMachineReadableCode[] {
  if (width < 16 || height < 16 || rgba.length < width * height * 4) return [];
  const source = new RGBLuminanceSource(
    toGrayscale(rgba, width, height),
    width,
    height,
  );
  const hints = new Map<DecodeHintType, unknown>();
  hints.set(DecodeHintType.TRY_HARDER, true);
  const regions = buildScanRegions(width, height);
  const decoded = new Map<string, DecodedMachineReadableCode>();

  for (const region of regions) {
    try {
      const cropped = source.crop(
        region.x,
        region.y,
        region.width,
        region.height,
      );
      const bitmap = new BinaryBitmap(new HybridBinarizer(cropped));
      for (const reader of createReaders()) {
        try {
          const result = reader.decode(bitmap, hints);
          const format = mapFormat(result.getBarcodeFormat());
          const points = result.getResultPoints();
          const boundsPx = points.length
            ? pointsToBounds(points, region.x, region.y)
            : undefined;
          const clipped = boundsPx
            ? touchesOutputEdge(boundsPx, width, height)
            : false;
          const key = `${format}:${result.getText()}`;
          if (!decoded.has(key)) {
            decoded.set(key, {
              format,
              payload: result.getText(),
              ...(boundsPx ? { boundsPx } : {}),
              clipped,
            });
          }
        } catch {
          // Missing a particular symbology in one scan region is expected.
        } finally {
          reader.reset();
        }
      }
    } catch {
      // A missed tile is expected; the label-level policy handles uncertainty.
    }
  }

  return [...decoded.values()];
}

function createReaders(): readonly Reader[] {
  return [
    new Code128Reader(),
    new QRCodeReader(),
    new DataMatrixReader(),
    new PDF417Reader(),
  ];
}

function toGrayscale(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): Uint8ClampedArray {
  const grayscale = new Uint8ClampedArray(width * height);
  for (let pixel = 0; pixel < grayscale.length; pixel += 1) {
    const index = pixel * 4;
    const alpha = rgba[index + 3] ?? 0;
    if (alpha === 0) {
      grayscale[pixel] = 255;
      continue;
    }
    grayscale[pixel] =
      (306 * (rgba[index] ?? 255) +
        601 * (rgba[index + 1] ?? 255) +
        117 * (rgba[index + 2] ?? 255) +
        512) >>
      10;
  }
  return grayscale;
}

export async function toMachineReadableCodeResults(
  decoded: readonly DecodedMachineReadableCode[],
): Promise<readonly MachineReadableCodeResult[]> {
  return Promise.all(
    decoded.map(async (code) => ({
      format: code.format,
      detected: true,
      decoded: true,
      clipped: code.clipped,
      payloadHash: await sha256Text(code.payload),
      ...(code.boundsPx ? { boundsPx: code.boundsPx } : {}),
    })),
  );
}

export async function sha256Text(value: string): Promise<string> {
  return sha256Bytes(new TextEncoder().encode(value));
}

export async function sha256Bytes(value: Uint8Array): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    value as Uint8Array<ArrayBuffer>,
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function buildScanRegions(width: number, height: number): readonly PdfRect[] {
  const halfWidth = Math.floor(width / 2);
  const halfHeight = Math.floor(height / 2);
  return uniqueRegions([
    { x: 0, y: 0, width, height },
    { x: 0, y: 0, width, height: halfHeight + 1 },
    { x: 0, y: halfHeight, width, height: height - halfHeight },
    { x: 0, y: 0, width: halfWidth + 1, height },
    { x: halfWidth, y: 0, width: width - halfWidth, height },
    { x: 0, y: 0, width: halfWidth + 1, height: halfHeight + 1 },
    { x: halfWidth, y: 0, width: width - halfWidth, height: halfHeight + 1 },
    { x: 0, y: halfHeight, width: halfWidth + 1, height: height - halfHeight },
    {
      x: halfWidth,
      y: halfHeight,
      width: width - halfWidth,
      height: height - halfHeight,
    },
  ]);
}

function uniqueRegions(regions: readonly PdfRect[]): readonly PdfRect[] {
  const unique = new Map<string, PdfRect>();
  for (const region of regions) {
    const normalized = {
      x: Math.floor(region.x),
      y: Math.floor(region.y),
      width: Math.max(1, Math.floor(region.width)),
      height: Math.max(1, Math.floor(region.height)),
    };
    unique.set(
      `${normalized.x}:${normalized.y}:${normalized.width}:${normalized.height}`,
      normalized,
    );
  }
  return [...unique.values()];
}

function pointsToBounds(
  points: readonly { getX(): number; getY(): number }[],
  offsetX: number,
  offsetY: number,
): PdfRect {
  const xs = points.map((point) => point.getX() + offsetX);
  const ys = points.map((point) => point.getY() + offsetY);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const right = Math.max(...xs);
  const bottom = Math.max(...ys);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function touchesOutputEdge(
  bounds: PdfRect,
  width: number,
  height: number,
): boolean {
  const margin = 3;
  return (
    bounds.x <= margin ||
    bounds.y <= margin ||
    bounds.x + bounds.width >= width - margin ||
    bounds.y + bounds.height >= height - margin
  );
}

function calculateEdgeInkRatio(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): number {
  const edge = Math.max(
    1,
    Math.min(4, Math.floor(Math.min(width, height) / 10)),
  );
  let ink = 0;
  let sampled = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (x >= edge && x < width - edge && y >= edge && y < height - edge)
        continue;
      const index = (y * width + x) * 4;
      const dark =
        (rgba[index] ?? 255) < 225 ||
        (rgba[index + 1] ?? 255) < 225 ||
        (rgba[index + 2] ?? 255) < 225;
      if (dark) ink += 1;
      sampled += 1;
    }
  }
  return sampled > 0 ? ink / sampled : 0;
}

function detectLinearPattern(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): boolean {
  let candidateRows = 0;
  for (let y = 0; y < height; y += 3) {
    let previous = false;
    let transitions = 0;
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const current =
        ((rgba[index] ?? 255) +
          (rgba[index + 1] ?? 255) +
          (rgba[index + 2] ?? 255)) /
          3 <
        128;
      if (x > 0 && current !== previous) transitions += 1;
      previous = current;
    }
    if (transitions >= Math.max(24, width * 0.07)) candidateRows += 1;
    if (candidateRows >= 4) return true;
  }
  return false;
}

function mapFormat(format: BarcodeFormat): MachineReadableCodeResult["format"] {
  switch (format) {
    case BarcodeFormat.CODE_128:
      return "code_128";
    case BarcodeFormat.QR_CODE:
    case BarcodeFormat.MICRO_QR_CODE:
      return "qr";
    case BarcodeFormat.DATA_MATRIX:
      return "data_matrix";
    case BarcodeFormat.PDF_417:
      return "pdf_417";
    default:
      return "other";
  }
}

function isLinearFormat(format: MachineReadableCodeResult["format"]): boolean {
  return format === "code_128" || format === "other";
}
