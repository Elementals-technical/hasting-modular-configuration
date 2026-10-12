import { describe, expect, it } from "vitest";

import { CUSTOMIZATION_FLOW_IDS, type CustomizationSchema } from "@/entities/collection";
import { readCustomizationSchema } from "@/entities/collection/__tests__/fixtures/readCustomizationSchema";

import classUi from "../../../../public/collections/class/ui.json";
import lameUi from "../../../../public/collections/lame/ui.json";
import makoUi from "../../../../public/collections/mako/ui.json";
import tricotUi from "../../../../public/collections/tricot/ui.json";
import urbanDuplexUi from "../../../../public/collections/urban-duplex/ui.json";
import urbanFreestandingUi from "../../../../public/collections/urban-freestanding/ui.json";
import urbanLowHeightUi from "../../../../public/collections/urban-low-height/ui.json";
import ushUi from "../../../../public/collections/urban-standard-height/ui.json";
import { resolveAttributeTarget, resolveScreenTarget, toTargetUrl } from "../lib/resolveAttributeTarget";

const ush = readCustomizationSchema(ushUi);
const classSchema = readCustomizationSchema(classUi);
const tricot = readCustomizationSchema(tricotUi);

const shipped: [string, CustomizationSchema][] = [
  ["urban-standard-height", ush],
  ["urban-low-height", readCustomizationSchema(urbanLowHeightUi)],
  ["urban-freestanding", readCustomizationSchema(urbanFreestandingUi)],
  ["urban-duplex", readCustomizationSchema(urbanDuplexUi)],
  ["class", classSchema],
  ["mako", readCustomizationSchema(makoUi)],
  ["lame", readCustomizationSchema(lameUi)],
  ["tricot", tricot],
];

describe("resolveAttributeTarget", () => {
  // The step and section ids the player menu used to name for every collection.
  it.each([
    ["prebuilt", "CabinetColor", "cabinet", "cabinet-color"],
    ["prebuilt", "CountertopColor", "countertop", "countertop-color"],
    ["prebuilt", "Thickness", "countertop", "thickness"],
    ["prebuilt", "CountertopStyle", "countertop", "countertop-styles"],
    ["prebuilt", "sinkType", "countertop", "basin-style"],
    ["prebuilt", "VesselColor", "countertop", "vessel-color"],
    ["custom", "CabinetType", "cabinet-builder", "cabinet-type"],
    ["custom", "Drawers", "cabinet-builder", "cabinet-style"],
    ["custom", "CabinetColor", "cabinet-colors", "cabinet-color-custom"],
    ["custom", "CountertopColor", "countertop-custom", "counter-top-color"],
    ["custom", "Thickness", "countertop-custom", "thickness-custom"],
    ["custom", "CountertopStyle", "countertop-custom", "countertop-style"],
    ["custom", "sinkType", "countertop-custom", "basin-style-custom"],
    ["custom", "VesselColor", "countertop-custom", "vessel-color-custom"],
  ] as const)(
    "finds the Urban Standard Height %s %s where the menu used to send it",
    (flow, attribute, step, section) => {
      expect(resolveAttributeTarget(ush, flow, attribute)).toMatchObject({ stepId: step, sectionId: section });
    },
  );

  it("finds a collection's own steps and sections", () => {
    expect(resolveAttributeTarget(classSchema, "prebuilt", "CabinetColor")).toEqual({
      stepId: "color",
      path: "/prebuilt/color",
      sectionId: "cabinet-color",
    });
    expect(resolveAttributeTarget(classSchema, "custom", "sinkType")).toEqual({
      stepId: "countertop",
      path: "/custom/countertop",
      sectionId: "basin-style",
    });
  });

  it("finds nothing for an attribute the collection does not show", () => {
    expect(resolveAttributeTarget(tricot, "prebuilt", "CountertopStyle")).toBeNull();
    expect(resolveAttributeTarget(tricot, "custom", "VesselColor")).toBeNull();
    expect(resolveAttributeTarget(null, "custom", "CabinetColor")).toBeNull();
  });

  it("skips a disabled step and a disabled section", () => {
    const withoutColorStep: CustomizationSchema = {
      ...classSchema,
      steps: { ...classSchema.steps, color: { ...classSchema.steps.color, enabled: false } },
    };
    const withoutColorSection: CustomizationSchema = {
      ...classSchema,
      sections: {
        ...classSchema.sections,
        "cabinet-color": { ...classSchema.sections["cabinet-color"], enabled: false },
      },
    };

    expect(resolveAttributeTarget(withoutColorStep, "prebuilt", "CabinetColor")).toBeNull();
    expect(resolveAttributeTarget(withoutColorSection, "prebuilt", "CabinetColor")).toBeNull();
  });

  it.each(shipped)("gives %s a cabinet builder target in the custom flow", (_, schema) => {
    expect(resolveAttributeTarget(schema, "custom", "CabinetType")?.sectionId).toBe("cabinet-type");
    expect(resolveAttributeTarget(schema, "custom", "Drawers")?.sectionId).toBe("cabinet-style");
  });

  it.each(shipped)("resolves every %s target to a step of the same flow", (_, schema) => {
    for (const flowId of CUSTOMIZATION_FLOW_IDS) {
      const paths = schema.flows[flowId].steps.map(({ path }) => path);
      for (const attributeId of ["CabinetColor", "CountertopColor", "Thickness", "sinkType"]) {
        const target = resolveAttributeTarget(schema, flowId, attributeId);
        if (target) expect(paths).toContain(target.path);
      }
    }
  });
});

describe("resolveScreenTarget", () => {
  it("finds the accessories page of each flow", () => {
    expect(resolveScreenTarget(ush, "prebuilt", "accessories")?.stepId).toBe("accessories");
    expect(resolveScreenTarget(ush, "custom", "accessories")?.stepId).toBe("accessories-custom");
  });

  it("finds nothing for a collection without the page", () => {
    expect(resolveScreenTarget(classSchema, "prebuilt", "accessories")).toBeNull();
    expect(resolveScreenTarget(classSchema, "custom", "accessories")).toBeNull();
  });
});

describe("toTargetUrl", () => {
  it("opens the section through ?accordion=", () => {
    expect(toTargetUrl({ stepId: "color", path: "/custom/color", sectionId: "cabinet-color" })).toBe(
      "/custom/color?accordion=cabinet-color",
    );
    expect(toTargetUrl({ stepId: "accessories", path: "/prebuilt/accessories" })).toBe("/prebuilt/accessories");
  });
});
