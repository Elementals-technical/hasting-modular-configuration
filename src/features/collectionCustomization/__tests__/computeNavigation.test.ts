import { describe, expect, it } from "vitest";

import type { CustomizationSchema } from "@/entities/collection";
import { readCustomizationSchema } from "@/entities/collection/__tests__/fixtures/readCustomizationSchema";

import uiJson from "../../../../public/collections/urban-standard-height/ui.json";
import { computeNavigation, resolveEntryStep, resolveFlowForPath } from "../lib/computeNavigation";

const schema = readCustomizationSchema(uiJson);

describe("computeNavigation", () => {
  it("matches a nested route to its parent step", () => {
    const result = computeNavigation(schema, "prebuilt", "/prebuilt/model/12");

    expect(result.currentStep?.stepId).toBe("model");
  });

  it("matches a nested cabinet-builder detail route", () => {
    const result = computeNavigation(schema, "custom", "/custom/cabinet-builder/details/style");

    expect(result.currentStep?.stepId).toBe("cabinet-builder");
  });

  it("resolves previous and next relative to the current step", () => {
    const result = computeNavigation(schema, "prebuilt", "/prebuilt/countertop");

    expect(result.previousStep?.stepId).toBe("cabinet");
    expect(result.nextStep?.stepId).toBe("accessories");
  });

  it("returns null current step for an unmatched path", () => {
    const result = computeNavigation(schema, "prebuilt", "/prebuilt/does-not-exist");

    expect(result.currentStep).toBeNull();
  });

  it("drops a step whose flow ref names an id absent from steps", () => {
    const withGhostRef: CustomizationSchema = {
      ...schema,
      flows: {
        ...schema.flows,
        prebuilt: {
          ...schema.flows.prebuilt,
          steps: [...schema.flows.prebuilt.steps, { stepId: "ghost", path: "/prebuilt/ghost" }],
        },
      },
    };

    const result = computeNavigation(withGhostRef, "prebuilt", "/prebuilt/countertop");

    expect(result.steps.map((step) => step.stepId)).not.toContain("ghost");
  });

  it("drops a disabled step from the flow, closing the prev/next gap around it", () => {
    const disabled: CustomizationSchema = {
      ...schema,
      steps: { ...schema.steps, accessories: { ...schema.steps.accessories, enabled: false } },
    };

    const result = computeNavigation(disabled, "prebuilt", "/prebuilt/countertop");

    expect(result.steps.map((step) => step.stepId)).not.toContain("accessories");
    expect(result.nextStep?.stepId).toBe("faucet-holes");
  });

  it("resolves summary by kind, not by array position", () => {
    const originalSteps = schema.flows.prebuilt.steps;
    const summaryRef = originalSteps.find((step) => step.stepId === "summary");
    if (!summaryRef) throw new Error("fixture prebuilt flow has no summary step");

    const reordered: CustomizationSchema = {
      ...schema,
      flows: {
        ...schema.flows,
        prebuilt: {
          ...schema.flows.prebuilt,
          steps: [summaryRef, ...originalSteps.filter((step) => step.stepId !== "summary")],
        },
      },
    };

    const result = computeNavigation(reordered, "prebuilt", "/prebuilt/model");

    expect(result.summaryStep?.stepId).toBe("summary");
    expect(reordered.flows.prebuilt.steps[reordered.flows.prebuilt.steps.length - 1].stepId).not.toBe("summary");
  });

  it("suppresses the default header prefix when headerPrefix is null", () => {
    const result = computeNavigation(schema, "custom", "/custom/cabinet-builder");

    expect(result.currentStep?.headerLabel).toBe("Cabinet Builder");
  });

  it("applies the default Select prefix otherwise", () => {
    const result = computeNavigation(schema, "prebuilt", "/prebuilt/color");

    expect(result.currentStep?.headerLabel).toBe("Select Color");
  });
});

describe("resolveEntryStep", () => {
  it("resolves the prebuilt entry step", () => {
    const step = resolveEntryStep(schema, "prebuilt");

    expect(step?.stepId).toBe("model");
    expect(step?.path).toBe("/prebuilt/model");
  });

  it("resolves the custom entry step", () => {
    const step = resolveEntryStep(schema, "custom");

    expect(step?.stepId).toBe("cabinet-builder");
    expect(step?.path).toBe("/custom/cabinet-builder");
  });
});

describe("resolveFlowForPath", () => {
  it("picks the flow that declares the step at the path", () => {
    expect(resolveFlowForPath(schema, "/custom/summary")).toBe("custom");
    expect(resolveFlowForPath(schema, "/prebuilt/model/12")).toBe("prebuilt");
  });

  it("falls back to the flow sharing the first path segment for an unknown path", () => {
    expect(resolveFlowForPath(schema, "/custom/nowhere")).toBe("custom");
  });

  it("falls back to prebuilt for a path outside every flow", () => {
    expect(resolveFlowForPath(schema, "/elsewhere")).toBe("prebuilt");
  });
});
