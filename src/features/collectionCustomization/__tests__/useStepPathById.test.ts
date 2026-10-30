import { describe, expect, it } from "vitest";

import { buildStepPathById } from "../lib/useStepPathById";

import type { NavigationStep } from "../model/types";

const step = (stepId: string, path: string): NavigationStep => ({
  stepId,
  path,
  label: stepId,
  headerLabel: stepId,
  kind: "fields",
});

describe("buildStepPathById", () => {
  it("maps each step's own path by its stepId", () => {
    expect(buildStepPathById([step("model", "/prebuilt/model"), step("color", "/prebuilt/color")])).toEqual({
      model: "/prebuilt/model",
      color: "/prebuilt/color",
    });
  });

  it("returns an empty record for an empty or missing step list", () => {
    expect(buildStepPathById([])).toEqual({});
    expect(buildStepPathById(undefined)).toEqual({});
  });
});
