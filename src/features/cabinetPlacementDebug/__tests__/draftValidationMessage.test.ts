import { describe, expect, it } from "vitest";

import { DRAFT_HINTS, draftInvalidHint, draftValidationStatus } from "../lib/draftValidationMessage";

const invalid = (...reasons: unknown[]) => ({ validation: { status: "invalid", reasons } });
const collision = (...collidesWith: string[]) => ({ code: "CABINET_COLLISION", params: { collidesWith } });

describe("draftInvalidHint", () => {
  it("is null for a valid draft or no draft", () => {
    expect(draftInvalidHint({ validation: { status: "valid", reasons: [] } })).toBeNull();
    expect(draftInvalidHint(null)).toBeNull();
    expect(draftInvalidHint({})).toBeNull();
  });
  it("floor-only collision says below the floor", () => {
    expect(draftInvalidHint(invalid(collision("Floor_R1")))).toBe(DRAFT_HINTS.belowFloor);
  });
  it("floor + cabinet keeps the cabinet message", () => {
    expect(draftInvalidHint(invalid(collision("Floor_R1", "cab-2")))).toBe(DRAFT_HINTS.cabinetCollision);
    expect(draftInvalidHint(invalid(collision("Floor_R1"), collision("cab-2")))).toBe(DRAFT_HINTS.cabinetCollision);
  });
  it("cabinet-only collision keeps the cabinet message", () => {
    expect(draftInvalidHint(invalid(collision("cab-2")))).toBe(DRAFT_HINTS.cabinetCollision);
  });
  it("unknown reason code or no reasons gives the generic message", () => {
    expect(draftInvalidHint(invalid({ code: "OUT_OF_ROOM", params: {} }))).toBe(DRAFT_HINTS.generic);
    expect(draftInvalidHint(invalid())).toBe(DRAFT_HINTS.generic);
  });
  it("falls back to state.collision ids when the reason has none", () => {
    const draft = { ...invalid({ code: "CABINET_COLLISION" }), collision: { status: "colliding", collidesWith: ["Floor_R1"] } };
    expect(draftInvalidHint(draft)).toBe(DRAFT_HINTS.belowFloor);
  });
  it("uses collision alone for engines without validation", () => {
    expect(draftInvalidHint({ collision: { status: "colliding", collidesWith: ["Floor_R1"] } })).toBe(DRAFT_HINTS.belowFloor);
    expect(draftInvalidHint({ collision: { status: "colliding" } })).toBe(DRAFT_HINTS.cabinetCollision);
    expect(draftInvalidHint({ collision: { status: "free" } })).toBeNull();
  });
});

describe("draftValidationStatus", () => {
  it("reads validation.status, null when absent", () => {
    expect(draftValidationStatus(invalid())).toBe("invalid");
    expect(draftValidationStatus({ validation: { status: "valid" } })).toBe("valid");
    expect(draftValidationStatus({})).toBeNull();
  });
});
