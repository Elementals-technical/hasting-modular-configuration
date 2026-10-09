import { describe, expect, it } from "vitest";

import { UI_REASON_TEXTS } from "@/shared/lib/reasonText/uiReasonTexts";

import { COUNTERTOP_REASON_SLUGS, classifyCountertopError, isStandardCountertop } from "../countertop";

describe("countertop API contract (phase 1)", () => {
  it("reads a rejected pose with its string reasons", () => {
    const failure = classifyCountertopError({
      code: "COUNTERTOP_POSE_INVALID",
      reasons: ["TRAP_KEEPOUT", 7, "SINK_LANDING_GAP"],
      message: "pose rejected",
    });

    expect(failure).toEqual({
      kind: "pose-invalid",
      code: "COUNTERTOP_POSE_INVALID",
      reasons: ["TRAP_KEEPOUT", "SINK_LANDING_GAP"],
      message: "pose rejected",
    });
  });

  it.each(["LEGACY_WRITERS_BUSY", "COMPOSITION_BUSY"])("reads %s as busy (retry later)", (code) => {
    expect(classifyCountertopError({ code }).kind).toBe("busy");
  });

  it("reads COUNTERTOP_DESTROYED (a torn-down API) as not-ready", () => {
    expect(classifyCountertopError({ code: "COUNTERTOP_DESTROYED" }).kind).toBe("not-ready");
  });

  it("reads an unknown code, or none, as unknown", () => {
    expect(classifyCountertopError({ code: "SOMETHING_NEW" })).toMatchObject({ kind: "unknown", code: "SOMETHING_NEW" });
    expect(classifyCountertopError(new Error("boom"))).toMatchObject({ kind: "unknown", code: null, message: "boom" });
  });

  it("keeps a top standard within the runtime's ±2e-6 m drift and no custom length", () => {
    expect(isStandardCountertop({ customLength: null, offset: { x: 2e-6, y: -2e-6 } })).toBe(true);
    expect(isStandardCountertop({ customLength: 1.2, offset: { x: 0, y: 0 } })).toBe(false);
  });

  it("has a UI text for every reason slug", () => {
    const missing = COUNTERTOP_REASON_SLUGS.filter((slug) => !UI_REASON_TEXTS[slug]?.trim());

    expect(missing).toEqual([]);
  });
});
