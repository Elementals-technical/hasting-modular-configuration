import { describe, expect, it } from "vitest";

import uiJson from "../../../../public/collections/urban-standard-height/ui.json";
import { validateCustomizationSchema } from "../lib/validateCustomizationSchema";

describe("validateCustomizationSchema", () => {
  it("accepts the real USH ui.json", () => {
    const result = validateCustomizationSchema(uiJson);

    expect(result.ok).toBe(true);
  });

  it("rejects an unknown entryStepId", () => {
    const broken = {
      ...uiJson,
      flows: { ...uiJson.flows, prebuilt: { ...uiJson.flows.prebuilt, entryStepId: "ghost" } },
    };

    const result = validateCustomizationSchema(broken);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: "missing-entry-step" }));
  });

  it("rejects an unknown stepId referenced from a flow", () => {
    const broken = {
      ...uiJson,
      flows: {
        ...uiJson.flows,
        prebuilt: {
          ...uiJson.flows.prebuilt,
          steps: [...uiJson.flows.prebuilt.steps, { stepId: "ghost", path: "/prebuilt/ghost" }],
        },
      },
    };

    const result = validateCustomizationSchema(broken);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: "unknown-step-id" }));
  });

  it("rejects a duplicate route within the same flow", () => {
    const broken = {
      ...uiJson,
      flows: {
        ...uiJson.flows,
        prebuilt: {
          ...uiJson.flows.prebuilt,
          steps: [...uiJson.flows.prebuilt.steps, { stepId: "model", path: "/prebuilt/model" }],
        },
      },
    };

    const result = validateCustomizationSchema(broken);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: "duplicate-route" }));
  });

  it("rejects an unsupported screen kind", () => {
    const broken = { ...uiJson, steps: { ...uiJson.steps, model: { ...uiJson.steps.model, kind: "wizard" } } };

    const result = validateCustomizationSchema(broken);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: "unsupported-kind" }));
  });

  it("rejects a sectionId that is not defined in sections", () => {
    const broken = {
      ...uiJson,
      steps: { ...uiJson.steps, cabinet: { ...uiJson.steps.cabinet, sectionIds: ["ghost-section"] } },
    };

    const result = validateCustomizationSchema(broken);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: "unknown-section-id" }));
  });

  it("rejects an unsupported field control", () => {
    const broken = {
      ...uiJson,
      sections: {
        ...uiJson.sections,
        "cabinet-color": {
          ...uiJson.sections["cabinet-color"],
          fields: [{ attributeId: "CabinetColor", control: "slider" }],
        },
      },
    };

    const result = validateCustomizationSchema(broken);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: "unsupported-control" }));
  });

  it("rejects a non-object input", () => {
    const result = validateCustomizationSchema(null);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: "invalid-schema" }));
  });
});
