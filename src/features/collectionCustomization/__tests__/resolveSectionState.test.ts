import { describe, expect, it } from "vitest";

import { parseProductProfile, validateCustomizationSchema } from "@/entities/collection";

import productProfileJson from "../../../../public/collections/urban-standard-height/product-profile.json";
import uiJson from "../../../../public/collections/urban-standard-height/ui.json";
import { resolveSectionFields } from "../lib/resolveSectionState";

const validatedSchema = validateCustomizationSchema(uiJson);
if (!validatedSchema.ok) throw new Error("fixture ui.json failed validation");
const schema = validatedSchema.schema;

const parsedProfile = parseProductProfile(productProfileJson);
if (!parsedProfile.ok) throw new Error("fixture product-profile.json failed validation");
const profile = parsedProfile.profile;

describe("resolveSectionFields", () => {
  it("reads the field list for a section straight from the schema", () => {
    const resolved = resolveSectionFields(schema, "drawer-panel-custom", profile, {}, {});

    expect(resolved.map(({ definition }) => definition.attributeId)).toEqual(["DrawerPanelFluting"]);
  });

  it("builds a field's options from the product profile's own catalog when optionsRef is absent", () => {
    const resolved = resolveSectionFields(schema, "drawer-panel-custom", profile, {}, {});
    const fluting = resolved.find(({ definition }) => definition.attributeId === "DrawerPanelFluting");

    expect(fluting?.field.options.map((option) => option.value)).toEqual([
      "None",
      "FlutingVerticalA",
      "FlutingVerticalB",
      "FlutingHorizontalA",
      "FlutingHorizontalB",
    ]);
    expect(fluting?.field.options.find((option) => option.value === "FlutingVerticalA")?.label).toBe(
      "Vertical Asymmetrical",
    );
  });

  it("reads the current value from productOptions by attributeId", () => {
    const resolved = resolveSectionFields(
      schema,
      "drawer-panel-custom",
      profile,
      { DrawerPanelFluting: "FlutingVerticalB" },
      {},
    );

    expect(resolved[0]?.field.value).toBe("FlutingVerticalB");
  });

  it("resolves availabilityRef through the passed-in availability results", () => {
    const available = resolveSectionFields(
      schema,
      "drawer-panel-custom",
      profile,
      {},
      {
        "DrawerPanelFluting.available": { available: true },
      },
    );
    const unavailable = resolveSectionFields(
      schema,
      "drawer-panel-custom",
      profile,
      {},
      {
        "DrawerPanelFluting.available": { available: false, reason: "Requires Lacquer Matte." },
      },
    );

    expect(available[0]?.field.enabled).toBe(true);
    expect(unavailable[0]?.field.enabled).toBe(false);
    expect(unavailable[0]?.field.disabledReason).toBe("Requires Lacquer Matte.");
  });

  it("resolves every field declared for a section, in declared order", () => {
    const resolved = resolveSectionFields(schema, "grain-direction-custom", profile, {}, {});

    expect(resolved.map(({ definition }) => definition.attributeId)).toEqual(["GrainDirection", "BookMatching"]);
  });

  it("leaves options empty for a field that names an external optionsRef", () => {
    const resolved = resolveSectionFields(schema, "cabinet-color-custom", profile, {}, {});
    const cabinetColor = resolved.find(({ definition }) => definition.attributeId === "CabinetColor");

    expect(cabinetColor?.definition.optionsRef).toBe("CabinetColor");
    expect(cabinetColor?.field.options).toEqual([]);
  });

  it("returns no fields for an unknown or missing section", () => {
    expect(resolveSectionFields(schema, "does-not-exist", profile, {}, {})).toEqual([]);
    expect(resolveSectionFields(null, "drawer-panel-custom", profile, {}, {})).toEqual([]);
  });
});
