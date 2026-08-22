import type { ValidationContext } from "./adapter";
import {
  calculateEvidenceConfidence,
  MARKETPLACE_VALIDATION_POLICIES,
  validateWithEvidence,
} from "./confidence";
import type { ConfidenceSignals, NormalizedLabel } from "./types";

const strongSignals: ConfidenceSignals = {
  marketplaceAnchors: 1,
  pageType: 1,
  geometry: 1,
  expectedText: 1,
  cropBoundaries: 1,
  barcodeDetected: 1,
  barcodeDecoded: 1,
  qrDetected: 1,
  qrDecoded: 1,
  clippingSafety: 1,
  layoutFingerprint: 1,
};

describe("evidence confidence", () => {
  it("uses the complete weighted signal set", () => {
    expect(calculateEvidenceConfidence(strongSignals)).toBeCloseTo(1, 10);
    expect(
      calculateEvidenceConfidence({ ...strongSignals, barcodeDecoded: 0 }),
    ).toBeCloseTo(0.84, 10);
  });

  it("auto-approves only when mandatory deterministic evidence passes", () => {
    const result = validateWithEvidence(
      context({
        format: "qr",
        detected: true,
        decoded: true,
        clipped: false,
      }),
      MARKETPLACE_VALIDATION_POLICIES.meesho,
    );

    expect(result.valid).toBe(true);
    expect(result.disposition).toBe("auto_approved");
    expect(result.confidence).toBeCloseTo(1, 10);
  });

  it("routes an undecodable or clipping-risk label to review", () => {
    const result = validateWithEvidence(
      {
        ...context(),
        contentClippingRisk: 0.7,
        confidenceSignals: {
          ...strongSignals,
          barcodeDecoded: 0,
          qrDecoded: 0,
          clippingSafety: 0,
        },
      },
      MARKETPLACE_VALIDATION_POLICIES.amazon,
    );

    expect(result.valid).toBe(false);
    expect(result.disposition).toBe("manual_review");
    expect(result.retryRecommended).toBe(true);
  });
});

function context(
  code?: ValidationContext["machineReadableCodes"][number],
): ValidationContext {
  return {
    label: fakeLabel(),
    expectedMachineReadableCodes: [],
    validationDpi: 203,
    machineReadableCodes: code ? [code] : [],
    outputDimensionsValid: true,
    contentClippingRisk: 0,
    confidenceSignals: strongSignals,
  };
}

function fakeLabel(): NormalizedLabel {
  return {
    id: "label",
    batchId: "batch",
    documentId: "document",
    pageId: "page",
    regionId: "region",
    sourcePageNumber: 1,
    outputOrder: 0,
    marketplace: "meesho",
    widthPt: 283.464566929,
    heightPt: 425.196850394,
    sourceBoundsPt: { x: 0, y: 0, width: 100, height: 150 },
    pdfBytes: new Uint8Array(),
    adapterId: "meesho",
    adapterVersion: "1",
  };
}
