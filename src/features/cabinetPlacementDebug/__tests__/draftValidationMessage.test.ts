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
    expect(DRAFT_HINTS.cabinetCollision).toBe("This cabinet overlaps another cabinet. Move it to a free spot to apply.");
  });
  it("countertop collision has its own message without inferring the product id", () => {
    expect(draftInvalidHint(invalid({ code: "COUNTERTOP_COLLISION", affectedProductIds: ["custom-top-id"] }))).toBe(
      "This cabinet overlaps the countertop. Move it to a free spot to apply.",
    );
  });
  it("mixed reasons keep cabinet, countertop, floor priority regardless of reason order", () => {
    const top = { code: "COUNTERTOP_COLLISION" };
    expect(draftInvalidHint(invalid(top, collision("cab-2")))).toBe(DRAFT_HINTS.cabinetCollision);
    expect(draftInvalidHint(invalid(collision("Floor_R1"), top))).toBe(
      "This cabinet overlaps the countertop. Move it to a free spot to apply.",
    );
  });
  it("unknown reason code or no reasons gives the generic message", () => {
    expect(draftInvalidHint(invalid({ code: "OUT_OF_ROOM", params: {} }))).toBe(DRAFT_HINTS.generic);
    expect(draftInvalidHint(invalid())).toBe(DRAFT_HINTS.generic);
  });
  it("shows the rule's own message for placement rules; an open question is prefixed", () => {
    const rule = { code: "NOTHING_ON_SINK_BASE", message: "A SC cannot be placed on or above a SB.", affectedProductIds: ["sb"] };
    expect(draftInvalidHint(invalid(rule))).toBe("A SC cannot be placed on or above a SB.");
    expect(draftInvalidHint(invalid(collision("cab-2"), rule))).toBe(DRAFT_HINTS.cabinetCollision);
    expect(draftInvalidHint({ validation: { status: "unsupported", reasons: [rule] } })).toBe(DRAFT_HINTS.unsupported + rule.message);
    expect(draftInvalidHint({ validation: { status: "pending", reasons: [] } })).toBe(DRAFT_HINTS.pending);
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
    expect(draftValidationStatus({ validation: { status: "unsupported" } })).toBe("unsupported");
    expect(draftValidationStatus({})).toBeNull();
  });
});
