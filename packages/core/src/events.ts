import type {
  ProcessingEvent,
  ProcessingEventDraft,
  ProcessingEventStatus,
  ProcessingStage,
} from "./types";

export const PROCESSING_STAGE_ORDER: readonly ProcessingStage[] = [
  "ingest",
  "parse",
  "classify",
  "extract",
  "normalize",
  "validate",
  "review",
  "assemble",
  "complete",
];

export interface StageProjection {
  readonly stage: ProcessingStage;
  readonly status: ProcessingEventStatus | "pending";
  readonly progress: number;
  readonly latestMessage: string;
  readonly events: readonly ProcessingEvent[];
}

export function createProcessingEvent(
  draft: ProcessingEventDraft,
  sequence: number,
  now = new Date(),
): ProcessingEvent {
  const progress =
    draft.progress === undefined
      ? undefined
      : Math.min(1, Math.max(0, draft.progress));

  return {
    ...draft,
    ...(progress === undefined ? {} : { progress }),
    id: `${draft.batchId}:event:${sequence}`,
    sequence,
    timestamp: now.toISOString(),
  };
}

export function projectStage(
  events: readonly ProcessingEvent[],
  stage: ProcessingStage,
): StageProjection {
  const stageEvents = events.filter((event) => event.stage === stage);
  const latest = stageEvents.at(-1);

  return {
    stage,
    status: latest?.status ?? "pending",
    progress: latest?.progress ?? (latest?.status === "success" ? 1 : 0),
    latestMessage: latest?.message ?? "Waiting for an earlier stage.",
    events: stageEvents,
  };
}

export function calculatePhaseOneProgress(
  events: readonly ProcessingEvent[],
): number {
  const ingest = projectStage(events, "ingest");
  const parse = projectStage(events, "parse");
  return Math.round((ingest.progress * 0.25 + parse.progress * 0.75) * 100);
}

export function calculateProcessingProgress(
  events: readonly ProcessingEvent[],
  stages: readonly ProcessingStage[],
): number {
  if (stages.length === 0) return 0;
  const total = stages.reduce(
    (sum, stage) => sum + projectStage(events, stage).progress,
    0,
  );
  return Math.round((total / stages.length) * 100);
}
