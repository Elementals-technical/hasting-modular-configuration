import { afterEach, describe, expect, it, vi } from "vitest";

import {
  countertopErrorMessage,
  describeCountertopError,
  describeCountertopValidation,
  restoreCountertopSnapshot,
  type CountertopApi,
  type CountertopState,
} from "../lib/countertopSession";

const failure = (code: string, extra: Record<string, unknown> = {}) =>
  Object.assign(new Error(`${code} detail`), { code, ...extra });

afterEach(() => vi.restoreAllMocks());

describe("countertop command error description", () => {
  it("lists the reason texts of COUNTERTOP_POSE_INVALID", () => {
    const error = failure("COUNTERTOP_POSE_INVALID", {
      reasons: ["TRAP_KEEPOUT", "SINK_BASE_NOT_COVERED"],
      rejected: { offset: { x: 0.3, y: 0 }, length: null },
    });
    const described = describeCountertopError(error);
    expect(described.kind).toBe("pose-invalid");
    expect(described.lines).toEqual(["Too close to the sink trap.", "The countertop must cover the sink cabinet."]);
    expect(countertopErrorMessage(error)).toBe(
      "Too close to the sink trap. The countertop must cover the sink cabinet.",
    );
    // The component's resolver (a collection override) wins over the dictionary.
    const resolve = ({ code }: { code?: string }) => (code === "TRAP_KEEPOUT" ? "Keep clear of the trap." : undefined);
    expect(describeCountertopError(error, resolve).lines).toEqual(["Keep clear of the trap.", "SINK_BASE_NOT_COVERED"]);
  });

  it("maps vertical lock, not ready and busy to user texts", () => {
    expect(countertopErrorMessage(failure("COUNTERTOP_VERTICAL_LOCKED"))).toBe(
      "This countertop can only slide left or right.",
    );
    expect(countertopErrorMessage(failure("COUNTERTOP_NOT_READY"))).toBe("The countertop is not ready yet.");
    expect(countertopErrorMessage(failure("LEGACY_WRITERS_BUSY"))).toBe("The scene is busy. Try again in a moment.");
    expect(countertopErrorMessage(failure("COMPOSITION_BUSY"))).toBe("The scene is busy. Try again in a moment.");
  });

  it("logs invalid input as a bug and keeps the detail of unknown failures", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const bad = failure("COUNTERTOP_INVALID_INPUT");
    expect(countertopErrorMessage(bad)).toBe("The countertop could not be changed.");
    expect(log).toHaveBeenCalledWith("Countertop command rejected", bad);
    expect(countertopErrorMessage({ code: "STALE", message: "Re-read" })).toBe("STALE: Re-read");
    expect(countertopErrorMessage(new Error("The countertop changed"))).toBe("The countertop changed");
  });

  it("describes the live verdict: invalid, warning only, unknown", () => {
    expect(describeCountertopValidation({ status: "invalid", reasons: ["SINK_LANDING_UNFIT"], warnings: [] })).toEqual({
      tone: "invalid",
      lines: ["The sink can't go on this cabinet."],
    });
    expect(describeCountertopValidation({ status: "valid", reasons: [], warnings: ["COUNTERTOP_COLLISION"] })).toEqual({
      tone: "warning",
      lines: ["The countertop overlaps another object."],
    });
    expect(describeCountertopValidation({ status: "unknown", reasons: ["TRAP_KEEPOUT"], warnings: [] })).toBeNull();
    expect(describeCountertopValidation({ status: "valid", reasons: [], warnings: [] })).toBeNull();
  });
});

describe("restoreCountertopSnapshot", () => {
  it("lowers a top locked meanwhile instead of failing Cancel on its lifted start pose", async () => {
    let current: CountertopState = { readiness: "ready", productId: "p", offset: { x: 0.4, y: 0.05 }, customLength: null };
    const setOffset = vi.fn(async (offset: { x: number; y: number }) => {
      if (offset.y > 0) throw failure("COUNTERTOP_VERTICAL_LOCKED");
      current = { ...current, offset };
    });
    const api = {
      setDragEnabled: vi.fn(async () => undefined),
      resetOffset: vi.fn(async () => undefined),
      setOffset,
      setSize: vi.fn(async () => undefined),
    } as unknown as CountertopApi;
    const read = async () => current;
    const original = { productId: "p", compositionId: "c", offset: { x: 0.2, y: 0.1 }, attached: false, customLength: null, dragEnabled: false };

    await expect(restoreCountertopSnapshot(api, original, { read, settled: read })).resolves.toMatchObject({ offset: { x: 0.2, y: 0 } });
    expect(setOffset).toHaveBeenNthCalledWith(1, { x: 0.2, y: 0.1 }, { validation: "skip" });
    expect(setOffset).toHaveBeenNthCalledWith(2, { x: 0.2, y: 0 }, { validation: "skip" });
  });
});
