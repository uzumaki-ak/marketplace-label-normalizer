import { detectRasterBounds } from "./raster-bounds";

describe("detectRasterBounds", () => {
  it("trims white space and preserves requested padding", () => {
    const width = 10;
    const height = 8;
    const rgba = whiteImage(width, height);
    for (let y = 2; y <= 5; y += 1) {
      for (let x = 3; x <= 7; x += 1) setPixel(rgba, width, x, y, 0);
    }

    expect(detectRasterBounds(rgba, width, height, { paddingPx: 1 })).toEqual({
      boundsPx: { x: 2, y: 1, width: 7, height: 6 },
      inkRatio: 0.25,
    });
  });

  it("ignores isolated edge noise", () => {
    const rgba = whiteImage(8, 8);
    setPixel(rgba, 8, 0, 0, 0);
    setPixel(rgba, 8, 3, 3, 0);
    setPixel(rgba, 8, 4, 3, 0);
    setPixel(rgba, 8, 3, 4, 0);
    setPixel(rgba, 8, 4, 4, 0);

    expect(
      detectRasterBounds(rgba, 8, 8, {
        paddingPx: 0,
        minimumInkPerAxis: 2,
      }).boundsPx,
    ).toEqual({ x: 3, y: 3, width: 2, height: 2 });
  });
});

function whiteImage(width: number, height: number): Uint8ClampedArray {
  return new Uint8ClampedArray(width * height * 4).fill(255);
}

function setPixel(
  rgba: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
  value: number,
): void {
  const index = (y * width + x) * 4;
  rgba[index] = value;
  rgba[index + 1] = value;
  rgba[index + 2] = value;
  rgba[index + 3] = 255;
}
