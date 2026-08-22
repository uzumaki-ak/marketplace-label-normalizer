import type { PdfRect } from "./types";

export interface RasterBoundsOptions {
  readonly whiteThreshold?: number;
  readonly minimumInkPerAxis?: number;
  readonly paddingPx?: number;
}

export interface RasterBoundsResult {
  readonly boundsPx?: PdfRect;
  readonly inkRatio: number;
}

/**
 * Finds meaningful non-white pixels without allowing one isolated pixel to
 * expand the crop. This operates on preview pixels only; final PDF output
 * remains native.
 */
export function detectRasterBounds(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  options: RasterBoundsOptions = {},
): RasterBoundsResult {
  if (width <= 0 || height <= 0 || rgba.length < width * height * 4) {
    return { inkRatio: 0 };
  }

  const whiteThreshold = options.whiteThreshold ?? 245;
  const minimumInkPerAxis = options.minimumInkPerAxis ?? 2;
  const padding = Math.max(0, options.paddingPx ?? 2);
  const rowInk = new Uint32Array(height);
  const columnInk = new Uint32Array(width);
  let inkPixels = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const alpha = rgba[index + 3] ?? 0;
      const red = rgba[index] ?? 255;
      const green = rgba[index + 1] ?? 255;
      const blue = rgba[index + 2] ?? 255;
      if (
        alpha > 16 &&
        (red < whiteThreshold ||
          green < whiteThreshold ||
          blue < whiteThreshold)
      ) {
        rowInk[y] = (rowInk[y] ?? 0) + 1;
        columnInk[x] = (columnInk[x] ?? 0) + 1;
        inkPixels += 1;
      }
    }
  }

  const top = firstPassing(rowInk, minimumInkPerAxis);
  const bottom = lastPassing(rowInk, minimumInkPerAxis);
  const left = firstPassing(columnInk, minimumInkPerAxis);
  const right = lastPassing(columnInk, minimumInkPerAxis);
  const inkRatio = inkPixels / (width * height);
  if (top < 0 || bottom < 0 || left < 0 || right < 0) return { inkRatio };

  const paddedLeft = Math.max(0, left - padding);
  const paddedTop = Math.max(0, top - padding);
  const paddedRight = Math.min(width, right + 1 + padding);
  const paddedBottom = Math.min(height, bottom + 1 + padding);
  return {
    boundsPx: {
      x: paddedLeft,
      y: paddedTop,
      width: paddedRight - paddedLeft,
      height: paddedBottom - paddedTop,
    },
    inkRatio,
  };
}

function firstPassing(values: Uint32Array, minimum: number): number {
  return values.findIndex((value) => value >= minimum);
}

function lastPassing(values: Uint32Array, minimum: number): number {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if ((values[index] ?? 0) >= minimum) return index;
  }
  return -1;
}
