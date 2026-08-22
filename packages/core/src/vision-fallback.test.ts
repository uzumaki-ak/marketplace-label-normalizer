import { describe, expect, it } from "vitest";
import { acceptsVisionProposal } from "./vision-fallback";

describe("AI fallback deterministic gate", () => {
  it("accepts only a proposal that passes all deterministic checks", () => {
    expect(
      acceptsVisionProposal(
        {
          confidence: 0.92,
          outputDimensionsValid: true,
          machineReadableDecoded: true,
          clippingRisk: false,
        },
        0.88,
      ),
    ).toBe(true);
  });

  it("rejects high confidence when the machine-readable code fails", () => {
    expect(
      acceptsVisionProposal(
        {
          confidence: 1,
          outputDimensionsValid: true,
          machineReadableDecoded: false,
          clippingRisk: false,
        },
        0.88,
      ),
    ).toBe(false);
  });
});
