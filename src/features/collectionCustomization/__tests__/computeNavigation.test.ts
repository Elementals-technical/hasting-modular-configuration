import { describe, expect, it } from "vitest";

import { validateCustomizationSchema, type CustomizationSchema } from "@/entities/collection";

import uiJson from "../../../../public/collections/urban-standard-height/ui.json";
import { computeNavigation, resolveEntryStep } from "../lib/computeNavigation";

const validated = validateCustomizationSchema(uiJson);
if (!validated.ok) throw new Error("fixture ui.json failed validation");
const schema = validated.schema;

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
