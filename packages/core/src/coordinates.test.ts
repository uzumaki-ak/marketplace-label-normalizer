import {
  displayRectToPdfRect,
  invertTransform,
  pdfRectToPreviewRect,
  previewRectToPdfRect,
  type AffineTransform,
} from "./coordinates";

const viewport: AffineTransform = [2, 0, 0, -2, 0, 400];

describe("PDF/preview coordinate conversion", () => {
  it("maps a bottom-left PDF rectangle into top-left preview pixels", () => {
    expect(
      pdfRectToPreviewRect({ x: 10, y: 20, width: 30, height: 40 }, viewport),
    ).toEqual({ x: 20, y: 280, width: 60, height: 80 });
  });

  it("round-trips rectangles through the inverse viewport transform", () => {
    const source = { x: 12.5, y: 18, width: 44, height: 91 };
    const preview = pdfRectToPreviewRect(source, viewport);
    const restored = previewRectToPdfRect(preview, viewport);

    expect(restored.x).toBeCloseTo(source.x, 10);
    expect(restored.y).toBeCloseTo(source.y, 10);
    expect(restored.width).toBeCloseTo(source.width, 10);
    expect(restored.height).toBeCloseTo(source.height, 10);
  });

  it("accounts for CSS display scaling before returning PDF points", () => {
    expect(
      displayRectToPdfRect(
        { x: 10, y: 140, width: 30, height: 40 },
        { width: 100, height: 200 },
        { width: 200, height: 400 },
        viewport,
      ),
    ).toEqual({ x: 10, y: 20, width: 30, height: 40 });
  });

  it("rejects singular transforms", () => {
    expect(() => invertTransform([1, 2, 2, 4, 0, 0])).toThrow(
      "singular viewport transform",
    );
  });
});
