import type { ValidationContext } from "./adapter";
import type {
  ConfidenceSignals,
  MachineReadableCodeResult,
  ValidationCheck,
  ValidationResult,
} from "./types";

export interface ValidationPolicy {
  readonly minimumDecodedCodes: number;
  readonly requireLinear: boolean;
  readonly requireTwoDimensional: boolean;
  readonly autoApproveThreshold: number;
}

const SIGNAL_WEIGHTS: Readonly<Record<keyof ConfidenceSignals, number>> = {
  marketplaceAnchors: 0.1,
  pageType: 0.08,
  geometry: 0.08,
  expectedText: 0.07,
  cropBoundaries: 0.12,
  barcodeDetected: 0.08,
  barcodeDecoded: 0.16,
  qrDetected: 0.06,
  qrDecoded: 0.1,
  clippingSafety: 0.08,
  layoutFingerprint: 0.07,
};

export const MARKETPLACE_VALIDATION_POLICIES = {
  flipkart: {
    minimumDecodedCodes: 1,
    requireLinear: false,
    requireTwoDimensional: false,
    autoApproveThreshold: 0.82,
  },
  amazon: {
    minimumDecodedCodes: 1,
    requireLinear: true,
    requireTwoDimensional: false,
    autoApproveThreshold: 0.82,
  },
  meesho: {
    minimumDecodedCodes: 1,
    requireLinear: false,
    requireTwoDimensional: true,
    autoApproveThreshold: 0.82,
  },
  unknown: {
    minimumDecodedCodes: 1,
    requireLinear: false,
    requireTwoDimensional: false,
    autoApproveThreshold: 1,
  },
} as const satisfies Readonly<Record<string, ValidationPolicy>>;

export function calculateEvidenceConfidence(
  signals: ConfidenceSignals,
): number {
  return clamp(
    (Object.keys(SIGNAL_WEIGHTS) as (keyof ConfidenceSignals)[]).reduce(
      (total, key) => total + clamp(signals[key]) * SIGNAL_WEIGHTS[key],
      0,
    ),
  );
}

export function validateWithEvidence(
  context: ValidationContext,
  policy: ValidationPolicy,
): ValidationResult {
  const decoded = context.machineReadableCodes.filter((code) => code.decoded);
  const hasLinear = decoded.some(isLinear);
  const hasTwoDimensional = decoded.some(isTwoDimensional);
  const expectedCodesPass = decoded.length >= policy.minimumDecodedCodes;
  const linearPass = !policy.requireLinear || hasLinear;
  const twoDimensionalPass = !policy.requireTwoDimensional || hasTwoDimensional;
  const clippingPass =
    context.contentClippingRisk < 0.25 &&
    context.machineReadableCodes.every((code) => !code.clipped);
  const confidence = calculateEvidenceConfidence(context.confidenceSignals);
  const mandatoryPass =
    context.outputDimensionsValid &&
    expectedCodesPass &&
    linearPass &&
    twoDimensionalPass &&
    clippingPass;
  const checks: ValidationCheck[] = [
    check(
      "dimensions",
      "Exact 100 × 150 mm output dimensions",
      context.outputDimensionsValid,
      true,
      "geometry",
    ),
    check(
      "decoded_codes",
      `At least ${policy.minimumDecodedCodes} machine-readable code decoded`,
      expectedCodesPass,
      true,
      "barcode",
    ),
    check(
      "linear_code",
      "Expected linear barcode decoded",
      linearPass,
      policy.requireLinear,
      "barcode",
    ),
    check(
      "two_dimensional_code",
      "Expected QR/Data Matrix code decoded",
      twoDimensionalPass,
      policy.requireTwoDimensional,
      "barcode",
    ),
    check(
      "clipping",
      "Machine-readable regions have safe crop margins",
      clippingPass,
      true,
      "geometry",
    ),
    check(
      "layout_fingerprint",
      "Known layout fingerprint remains matched",
      context.confidenceSignals.layoutFingerprint >= 0.9,
      false,
      "layout_fingerprint",
    ),
  ];
  const autoApproved =
    mandatoryPass && confidence >= policy.autoApproveThreshold;

  return {
    labelId: context.label.id,
    valid: autoApproved,
    confidence,
    disposition: autoApproved ? "auto_approved" : "manual_review",
    checks,
    machineReadableCodes: context.machineReadableCodes,
    contentClippingRisk: context.contentClippingRisk,
    outputDimensionsValid: context.outputDimensionsValid,
    retryRecommended: !clippingPass,
  };
}

function check(
  id: string,
  label: string,
  passed: boolean,
  mandatory: boolean,
  source: "geometry" | "barcode" | "layout_fingerprint",
): ValidationCheck {
  return {
    id,
    label,
    status: passed ? "pass" : mandatory ? "fail" : "warning",
    mandatory,
    evidence: [
      {
        code: `validation.${id}.${passed ? "pass" : "fail"}`,
        message: `${label}: ${passed ? "passed" : "not confirmed"}.`,
        source,
        weight: mandatory ? 1 : 0.5,
      },
    ],
  };
}

function isLinear(code: MachineReadableCodeResult): boolean {
  return code.format === "code_128" || code.format === "other";
}

function isTwoDimensional(code: MachineReadableCodeResult): boolean {
  return code.format === "qr" || code.format === "data_matrix";
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}
