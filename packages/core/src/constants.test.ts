import {
  hasExactTargetLabelDimensions,
  millimetresToPoints,
  TARGET_LABEL_SIZE_PT,
} from "./constants";

describe("target label dimensions", () => {
  it("converts 100 x 150 mm to exact PDF point dimensions", () => {
    expect(TARGET_LABEL_SIZE_PT.width).toBeCloseTo(283.464566929, 9);
    expect(TARGET_LABEL_SIZE_PT.height).toBeCloseTo(425.196850394, 9);
    expect(millimetresToPoints(25.4)).toBe(72);
  });

  it("validates dimensions with a narrow floating-point tolerance", () => {
    expect(
      hasExactTargetLabelDimensions(
        TARGET_LABEL_SIZE_PT.width,
        TARGET_LABEL_SIZE_PT.height,
      ),
    ).toBe(true);
    expect(hasExactTargetLabelDimensions(284, 425)).toBe(false);
  });
});
