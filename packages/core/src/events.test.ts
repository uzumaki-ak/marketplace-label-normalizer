import {
  calculatePhaseOneProgress,
  createProcessingEvent,
  projectStage,
} from "./events";

describe("processing event projection", () => {
  it("creates ordered, bounded append-only events", () => {
    const event = createProcessingEvent(
      {
        batchId: "batch-1",
        stage: "ingest",
        status: "running",
        progress: 2,
        message: "Reading files.",
      },
      4,
      new Date("2026-08-20T00:00:00.000Z"),
    );

    expect(event.id).toBe("batch-1:event:4");
    expect(event.progress).toBe(1);
    expect(event.timestamp).toBe("2026-08-20T00:00:00.000Z");
  });

  it("projects the latest event without rewriting history", () => {
    const events = [
      createProcessingEvent(
        {
          batchId: "batch-1",
          stage: "parse",
          status: "running",
          progress: 0.5,
          message: "Halfway.",
        },
        0,
      ),
      createProcessingEvent(
        {
          batchId: "batch-1",
          stage: "parse",
          status: "success",
          progress: 1,
          message: "Complete.",
        },
        1,
      ),
    ];

    const projection = projectStage(events, "parse");
    expect(projection.events).toHaveLength(2);
    expect(projection.status).toBe("success");
    expect(projection.latestMessage).toBe("Complete.");
  });

  it("weights ingest and parse progress for Phase 1", () => {
    const events = [
      createProcessingEvent(
        {
          batchId: "batch-1",
          stage: "ingest",
          status: "success",
          progress: 1,
          message: "Complete.",
        },
        0,
      ),
      createProcessingEvent(
        {
          batchId: "batch-1",
          stage: "parse",
          status: "running",
          progress: 0.5,
          message: "Halfway.",
        },
        1,
      ),
    ];

    expect(calculatePhaseOneProgress(events)).toBe(63);
  });
});
