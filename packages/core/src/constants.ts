import { PRINT_CONFIG } from "@label-normalizer/config";

export function millimetresToPoints(millimetres: number): number {
  return (
    (millimetres * PRINT_CONFIG.pointsPerInch) / PRINT_CONFIG.millimetresPerInch
  );
}

export const TARGET_LABEL_SIZE_PT = Object.freeze({
  width: millimetresToPoints(PRINT_CONFIG.widthMm),
  height: millimetresToPoints(PRINT_CONFIG.heightMm),
});

export const DIMENSION_TOLERANCE_PT = 0.001;

export function hasExactTargetLabelDimensions(
  widthPt: number,
  heightPt: number,
  tolerancePt = DIMENSION_TOLERANCE_PT,
): boolean {
  return (
    Math.abs(widthPt - TARGET_LABEL_SIZE_PT.width) <= tolerancePt &&
    Math.abs(heightPt - TARGET_LABEL_SIZE_PT.height) <= tolerancePt
  );
}
