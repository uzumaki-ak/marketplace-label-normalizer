import type { Marketplace } from "./types";

export interface VisionCrop {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface VisionFallbackInput {
  /** The minimum rendered page/region needed for analysis; never source PDF bytes. */
  readonly renderedImageBytes: Uint8Array;
  readonly mimeType: "image/png" | "image/jpeg" | "image/webp";
  readonly pixelWidth: number;
  readonly pixelHeight: number;
  readonly marketplaceHint: Marketplace;
}

export interface VisionFallbackResult {
  readonly providerId: string;
  /** Top-left-origin normalized coordinates in the range 0..1. */
  readonly crop: VisionCrop;
  readonly rotation: 0 | 90 | 180 | 270;
  readonly modelConfidence: number;
  readonly evidenceCodes: readonly string[];
}

export interface VisionFallbackProvider {
  readonly id: string;
  analyze(input: VisionFallbackInput): Promise<VisionFallbackResult>;
}

export interface PostVisionValidation {
  readonly confidence: number;
  readonly outputDimensionsValid: boolean;
  readonly machineReadableDecoded: boolean;
  readonly clippingRisk: boolean;
}

export function acceptsVisionProposal(
  validation: PostVisionValidation,
  minimumConfidence: number,
): boolean {
  return (
    validation.outputDimensionsValid &&
    validation.machineReadableDecoded &&
    !validation.clippingRisk &&
    validation.confidence >= minimumConfidence
  );
}
