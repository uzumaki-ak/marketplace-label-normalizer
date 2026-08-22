import { assertBatchTransition, canTransitionBatch } from "./state-machine";

describe("batch state machine", () => {
  it("supports the independently testable Phase 1 path", () => {
    expect(canTransitionBatch("idle", "ingesting")).toBe(true);
    expect(canTransitionBatch("ingesting", "parsing")).toBe(true);
    expect(canTransitionBatch("parsing", "ready")).toBe(true);
  });

  it("rejects phase-skipping transitions", () => {
    expect(canTransitionBatch("ingesting", "assembling")).toBe(false);
    expect(() => assertBatchTransition("idle", "ready")).toThrow(
      "Illegal batch transition",
    );
  });
});
