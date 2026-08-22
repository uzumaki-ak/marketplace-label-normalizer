import type { PdfPoint, PdfRect } from "./types";

export type AffineTransform = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
];

export interface Size {
  readonly width: number;
  readonly height: number;
}

export function applyTransform(
  point: PdfPoint,
  transform: AffineTransform,
): PdfPoint {
  const [a, b, c, d, e, f] = transform;
  return {
    x: a * point.x + c * point.y + e,
    y: b * point.x + d * point.y + f,
  };
}

export function invertTransform(transform: AffineTransform): AffineTransform {
  const [a, b, c, d, e, f] = transform;
  const determinant = a * d - b * c;

  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-12) {
    throw new Error("Cannot invert a singular viewport transform.");
  }

  return [
    d / determinant,
    -b / determinant,
    -c / determinant,
    a / determinant,
    (c * f - d * e) / determinant,
    (b * e - a * f) / determinant,
  ];
}

function corners(rect: PdfRect): readonly PdfPoint[] {
  return [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x, y: rect.y + rect.height },
    { x: rect.x + rect.width, y: rect.y + rect.height },
  ];
}

function boundingRect(points: readonly PdfPoint[]): PdfRect {
  if (points.length === 0) {
    throw new Error("At least one point is required to create a rectangle.");
  }

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function pdfRectToPreviewRect(
  rect: PdfRect,
  viewportTransform: AffineTransform,
): PdfRect {
  return boundingRect(
    corners(rect).map((point) => applyTransform(point, viewportTransform)),
  );
}

export function previewRectToPdfRect(
  rect: PdfRect,
  viewportTransform: AffineTransform,
): PdfRect {
  const inverse = invertTransform(viewportTransform);
  return boundingRect(
    corners(rect).map((point) => applyTransform(point, inverse)),
  );
}

export function displayPointToCanvasPoint(
  point: PdfPoint,
  displaySize: Size,
  canvasSize: Size,
): PdfPoint {
  if (
    displaySize.width <= 0 ||
    displaySize.height <= 0 ||
    canvasSize.width <= 0 ||
    canvasSize.height <= 0
  ) {
    throw new Error("Display and canvas dimensions must be positive.");
  }

  return {
    x: point.x * (canvasSize.width / displaySize.width),
    y: point.y * (canvasSize.height / displaySize.height),
  };
}

export function displayRectToPdfRect(
  displayRect: PdfRect,
  displaySize: Size,
  canvasSize: Size,
  viewportTransform: AffineTransform,
): PdfRect {
  const topLeft = displayPointToCanvasPoint(
    { x: displayRect.x, y: displayRect.y },
    displaySize,
    canvasSize,
  );
  const bottomRight = displayPointToCanvasPoint(
    {
      x: displayRect.x + displayRect.width,
      y: displayRect.y + displayRect.height,
    },
    displaySize,
    canvasSize,
  );

  return previewRectToPdfRect(
    {
      x: topLeft.x,
      y: topLeft.y,
      width: bottomRight.x - topLeft.x,
      height: bottomRight.y - topLeft.y,
    },
    viewportTransform,
  );
}
