import { describe, expect, it } from "vitest";

import { configuratorColorGroups } from "@/entities/collection/__tests__/fixtures/configuratorColorGroups";
import { readCustomizationSchema } from "@/entities/collection/__tests__/fixtures/readCustomizationSchema";
import { ushProfile as profile } from "@/entities/collection/__tests__/ushProfileFixture";

import uiJson from "../../../../public/collections/urban-standard-height/ui.json";
import { resolveSectionFields } from "../lib/resolveSectionState";

const schema = readCustomizationSchema(uiJson);

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

  it("carries the hint ui.json declares for the current value, and none otherwise", () => {
    const withHint = resolveSectionFields(schema, "faucet-holes-amount", profile, { FaucetHolesAmount: "2" }, {});
    const withoutHint = resolveSectionFields(schema, "faucet-holes-amount", profile, { FaucetHolesAmount: "0" }, {});

    expect(withHint[0]?.field.hint).toBe("Faucet hole placement and spacing to be specified at time of order.");
    expect(withoutHint[0]?.field.hint).toBeUndefined();
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

  it("leaves options empty for an optionsRef field while the configurator is not loaded", () => {
    const resolved = resolveSectionFields(schema, "cabinet-color-custom", profile, {}, {});
    const cabinetColor = resolved.find(({ definition }) => definition.attributeId === "CabinetColor");

    expect(cabinetColor?.definition.optionsRef).toBe("CabinetColor");
    expect(cabinetColor?.field.options).toEqual([]);
  });

  it("resolves an optionsRef field from the configurator section the profile names in optionsSource", () => {
    const resolved = resolveSectionFields(schema, "cabinet-color-custom", profile, {}, {}, configuratorColorGroups);
    const options = resolved[0]?.field.options ?? [];

    expect(options.map((option) => option.value)).toEqual(["Old Cabinet Color", "New Cabinet Color"]);
    expect(options[0]?.desc).toBe("HPL");
    expect(options[0]?.traits).toMatchObject({
      sku: "HPL",
      materials: ["HPL"],
      colors: ["Old Cabinet Color"],
    });
  });

  it("adds the profile's reset value as the first option of a clearable optionsRef field", () => {
    const resolved = resolveSectionFields(schema, "groove-color", profile, {}, {}, configuratorColorGroups);

    expect(resolved[0]?.field.options.map((option) => option.value)).toEqual([
      "None",
      "Old Cabinet Color",
      "New Cabinet Color",
    ]);
  });

  it("keeps only the options listed in allowedValues enabled and carries the reason on the rest", () => {
    const resolved = resolveSectionFields(
      schema,
      "side-panels",
      profile,
      {},
      { "SidePanels.available": { available: true, reason: "Too long.", allowedValues: ["None", "NoG"] } },
    );
    const options = resolved[0]?.field.options ?? [];

    expect(options.filter((option) => option.enabled).map((option) => option.value)).toEqual(["None", "NoG"]);
    expect(options.find((option) => option.value === "UpperG")?.reason).toBe("Too long.");
  });

  it("hides a field whose availability result says it is not visible", () => {
    const resolved = resolveSectionFields(
      schema,
      "groove-color",
      profile,
      {},
      { "Handle.supportsGrooveColor": { available: false, visible: false } },
      configuratorColorGroups,
    );

    expect(resolved[0]?.field.visible).toBe(false);
  });

  it("joins the pictures the collection declares onto its own option catalog", () => {
    const resolved = resolveSectionFields(schema, "basin-style", profile, {}, {});
    const options = resolved[0]?.field.options ?? [];

    expect(resolved[0]?.definition.attributeId).toBe("sinkType");
    expect(options.find((option) => option.value === "Top_HPLPrisma")?.image).toBe(
      schema.optionImages?.sinkType?.Top_HPLPrisma,
    );
    // Every basin has one; "Vessel" is the plain cutout the collection declares no picture for.
    expect(options.filter((option) => option.image === undefined).map((option) => option.value)).toEqual(["Vessel"]);
  });

  it("leaves an option the collection declares no picture for without one, and keeps it listed", () => {
    const withoutPrisma = {
      ...schema,
      optionImages: { sinkType: { Top_HPLQuadra: "images/basin/quadro.jpg" } },
    };
    const options = resolveSectionFields(withoutPrisma, "basin-style", profile, {}, {})[0]?.field.options ?? [];

    expect(options.find((option) => option.value === "Top_HPLPrisma")?.image).toBeUndefined();
    expect(options.map((option) => option.value)).toContain("Top_HPLPrisma");
  });

  it("fills a configurator option that carries no picture of its own", () => {
    const declared = { ...schema, optionImages: { CabinetColor: { "Old Cabinet Color": "images/override.png" } } };
    const options =
      resolveSectionFields(declared, "cabinet-color-custom", profile, {}, {}, configuratorColorGroups)[0]?.field
        .options ?? [];

    // The fixture variant has image: null, so the declared picture fills the gap.
    expect(options.find((option) => option.value === "Old Cabinet Color")?.image).toBe("images/override.png");
    expect(options.find((option) => option.value === "New Cabinet Color")?.image).toBeUndefined();
  });

  it("returns no fields for an unknown or missing section", () => {
    expect(resolveSectionFields(schema, "does-not-exist", profile, {}, {})).toEqual([]);
    expect(resolveSectionFields(null, "drawer-panel-custom", profile, {}, {})).toEqual([]);
  });
});
