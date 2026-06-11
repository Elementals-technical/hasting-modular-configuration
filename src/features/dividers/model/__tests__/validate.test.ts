import { describe, expect, it } from "vitest";

import type { DividerSlot } from "../types";
import {
  DIVIDER_CANNOT_PLACE_WARNING,
  DIVIDER_NO_CONTEXT_WARNING,
  DIVIDER_NO_SELECTION_WARNING,
  DIVIDER_SLOT_MISMATCH_WARNING,
  buildDividerPlacementWarning,
  buildUnavailableDividerWarning,
  validatePlacement,
} from "../validate";

const buildCandidateSlot = (overrides: Partial<DividerSlot> = {}): DividerSlot => ({
  context: { cabinetId: "Sink-Base-abc123", drawerType: "Bot" },
  zone: "main",
  key: "candidate:Bot:main:left:0:A",
  kind: "candidate",
  placementType: "A",
  occupiedType: null,
  stateId: null,
  availableTypes: ["A", "B", "C"],
  canPlace: true,
  disabledReason: null,
  position: { start: 0, center: 6.75, end: 13.5 },
  zoneIndex: 0,
  start: 0,
  anchor: "left",
  ...overrides,
});

describe("validatePlacement", () => {
  it("rejects with no-context when slot is missing", () => {
    const decision = validatePlacement("A", null);

    expect(decision).toEqual({
      ok: false,
      reason: "no-context",
      message: DIVIDER_NO_CONTEXT_WARNING,
    });
  });

  it("rejects with no-selection when no divider type is selected", () => {
    const decision = validatePlacement(null, buildCandidateSlot());

    expect(decision).toEqual({
      ok: false,
      reason: "no-selection",
      message: DIVIDER_NO_SELECTION_WARNING,
    });
  });

  it("rejects with type-unavailable when selected type is not in slot.availableTypes", () => {
    const decision = validatePlacement("C", buildCandidateSlot({ availableTypes: ["A", "B"] }));

    expect(decision).toEqual({
      ok: false,
      reason: "type-unavailable",
      message: "Option C does not fit here. Choose one of: Option A, Option B.",
    });
  });

  it("rejects with cannot-place when slot.canPlace is false", () => {
    const decision = validatePlacement("A", buildCandidateSlot({ canPlace: false }));

    expect(decision).toEqual({
      ok: false,
      reason: "cannot-place",
      message: DIVIDER_CANNOT_PLACE_WARNING,
    });
  });

  it("rejects with slot-mismatch when selected=B and slot.placementType=A (real bug regression)", () => {
    // Regression: a "B" divider used to be sent into "candidate:...:0:A" slots.
    const decision = validatePlacement("B", buildCandidateSlot({ placementType: "A" }));

    expect(decision).toEqual({
      ok: false,
      reason: "slot-mismatch",
      message: DIVIDER_SLOT_MISMATCH_WARNING,
    });
  });

  it("checks type-unavailable before slot-mismatch", () => {
    const decision = validatePlacement("B", buildCandidateSlot({ placementType: "A", availableTypes: ["A"] }));

    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.reason).toBe("type-unavailable");
  });

  it("returns an executable place command when everything matches", () => {
    const slot = buildCandidateSlot({ placementType: "C", key: "candidate:Bot:main:left:2:C" });
    const decision = validatePlacement("C", slot, "trace-1");

    expect(decision).toEqual({
      ok: true,
      command: { kind: "place", slot, type: "C", traceId: "trace-1" },
    });
  });

  it("accepts slots without placementType (legacy payloads)", () => {
    const decision = validatePlacement("B", buildCandidateSlot({ placementType: null, key: "slot:Bot:main:1" }));

    expect(decision.ok).toBe(true);
    if (decision.ok) expect(decision.command.type).toBe("B");
  });

  it("generates a traceId when none is provided", () => {
    const decision = validatePlacement("A", buildCandidateSlot());

    expect(decision.ok).toBe(true);
    if (decision.ok) expect(decision.command.traceId).toMatch(/^validate-place-/);
  });
});

describe("buildUnavailableDividerWarning", () => {
  it("lists available options when present", () => {
    expect(buildUnavailableDividerWarning("B", ["A", "C"])).toBe(
      "Option B does not fit here. Choose one of: Option A, Option C.",
    );
  });

  it("uses the empty-availability wording when nothing fits", () => {
    expect(buildUnavailableDividerWarning("B", [])).toBe(
      "Option B does not fit here. No Divider option is available for this slot.",
    );
  });
});

describe("buildDividerPlacementWarning", () => {
  it("warns about missing selection", () => {
    expect(buildDividerPlacementWarning(null, ["A"])).toBe(DIVIDER_NO_SELECTION_WARNING);
  });

  it("warns about unavailable selection", () => {
    expect(buildDividerPlacementWarning("C", ["A", "B"])).toBe(
      "Option C does not fit here. Choose one of: Option A, Option B.",
    );
  });

  it("returns null when the selection is available", () => {
    expect(buildDividerPlacementWarning("A", ["A", "B"])).toBeNull();
  });
});
