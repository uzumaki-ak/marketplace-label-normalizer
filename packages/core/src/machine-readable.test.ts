import { BarcodeFormat, QRCodeWriter } from "@zxing/library";
import {
  analyzeMachineReadablePixels,
  sha256Text,
  toMachineReadableCodeResults,
} from "./machine-readable";

describe("machine-readable decoding", () => {
  it("decodes a QR code from RGBA pixels and hashes its payload", async () => {
    const payload = "TRACKING-TEST-12345";
    const { rgba, width, height } = qrImage(payload);
    const analysis = analyzeMachineReadablePixels(rgba, width, height);
    const results = await toMachineReadableCodeResults(analysis.decodedCodes);

    expect(analysis.decodedCodes.some((code) => code.payload === payload)).toBe(
      true,
    );
    expect(results.some((code) => code.format === "qr" && code.decoded)).toBe(
      true,
    );
    expect(results[0]?.payloadHash).toBe(await sha256Text(payload));
    expect(results[0]?.payloadHash).not.toContain(payload);
  });

  it("reports edge ink as clipping risk evidence", () => {
    const rgba = new Uint8ClampedArray(40 * 40 * 4).fill(255);
    for (let y = 0; y < 40; y += 1) {
      for (let x = 0; x < 3; x += 1) {
        const index = (y * 40 + x) * 4;
        rgba[index] = rgba[index + 1] = rgba[index + 2] = 0;
      }
    }

    expect(
      analyzeMachineReadablePixels(rgba, 40, 40).clippingRisk,
    ).toBeGreaterThan(0.2);
  });
});

function qrImage(payload: string) {
  const width = 240;
  const height = 240;
  const rgba = new Uint8ClampedArray(width * height * 4).fill(255);
  const matrix = new QRCodeWriter().encode(
    payload,
    BarcodeFormat.QR_CODE,
    180,
    180,
    new Map(),
  );
  for (let y = 0; y < matrix.getHeight(); y += 1) {
    for (let x = 0; x < matrix.getWidth(); x += 1) {
      if (!matrix.get(x, y)) continue;
      const index = ((y + 30) * width + x + 30) * 4;
      rgba[index] = rgba[index + 1] = rgba[index + 2] = 0;
      rgba[index + 3] = 255;
    }
  }
  return { rgba, width, height };
}
