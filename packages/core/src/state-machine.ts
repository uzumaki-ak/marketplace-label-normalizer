import type { BatchStatus } from "./types";

const TRANSITIONS: Readonly<Record<BatchStatus, readonly BatchStatus[]>> = {
  idle: ["ingesting", "cancelled"],
  ingesting: ["parsing", "failed", "cancelled"],
  parsing: ["classifying", "ready", "failed", "cancelled"],
  classifying: ["extracting", "review_required", "failed", "cancelled"],
  extracting: [
    "normalizing",
    "review_required",
    "ready",
    "failed",
    "cancelled",
  ],
  normalizing: [
    "validating",
    "review_required",
    "assembling",
    "failed",
    "cancelled",
  ],
  validating: ["review_required", "assembling", "failed", "cancelled"],
  review_required: ["validating", "assembling", "failed", "cancelled"],
  assembling: ["ready", "failed", "cancelled"],
  ready: ["ingesting"],
  failed: ["ingesting"],
  cancelled: ["ingesting"],
};

export function canTransitionBatch(
  current: BatchStatus,
  next: BatchStatus,
): boolean {
  return TRANSITIONS[current].includes(next);
}

export function assertBatchTransition(
  current: BatchStatus,
  next: BatchStatus,
): void {
  if (!canTransitionBatch(current, next)) {
    throw new Error(`Illegal batch transition: ${current} -> ${next}`);
  }
}
