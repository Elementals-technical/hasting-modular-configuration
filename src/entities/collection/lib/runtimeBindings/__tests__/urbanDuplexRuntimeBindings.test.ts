import { describe, expect, it } from "vitest";

import urbanDuplexProfileDocument from "../../../../../../public/collections/urban-duplex/product-profile.json";
import urbanDuplexRuntimeBindingsDocument from "../../../../../../public/collections/urban-duplex/runtime-bindings.json";
import urbanDuplexUiDocument from "../../../../../../public/collections/urban-duplex/ui.json";
import { CORE_ATTRIBUTE_IDS } from "@/entities/configuration/model/ownership";

import { parseProductProfile } from "../../parseProductProfile";
import { parseRuntimeBindings } from "../parseRuntimeBindings";
import { isStateOnlyResolution, resolveRuntimeBinding } from "../resolveRuntimeBinding";
import { validateRuntimeBindings } from "../validateRuntimeBindings";

/**
 * The scene places the Urban Duplex drawer cabinets (UD-sink-cabinet, UD-side-cabinet) and lays out their
 * sizes, drawers, handles and basin; it has no panel colours, so those are recorded for the SKU only.
 */

const parsedProfile = parseProductProfile(urbanDuplexProfileDocument);
const parsedBindings = parseRuntimeBindings(urbanDuplexRuntimeBindingsDocument);

const urbanDuplexProfile = () => {
  if (!parsedProfile.ok) throw new Error(`profile failed validation: ${JSON.stringify(parsedProfile.diagnostics)}`);
  return parsedProfile.profile;
};

const urbanDuplexRuntimeBindings = () => {
  if (!parsedBindings.ok) throw new Error(`bindings failed validation: ${JSON.stringify(parsedBindings.diagnostics)}`);
  return parsedBindings.bindings;
};

const UI_FIELD_IDS = Object.values(urbanDuplexUiDocument.sections).flatMap(({ fields }) =>
  fields.map(({ attributeId }) => attributeId),
);

// What the loader requires: the C01 registry, the fields of ui.json and the dimensions.
const REQUIRED_ATTRIBUTE_IDS = [...new Set([...CORE_ATTRIBUTE_IDS, ...UI_FIELD_IDS, "Height", "Width", "Depth"])];

/** The values a model shares with every cabinet of it; one without a translation rejects the model. */
const SHARED_PRESET_VALUES = [
  "CabinetColor",
  "HandleGrooveColor",
  "CountertopColor",
  "sinkType",
  "CountertopStyle",
  "VesselColor",
  "Thickness",
];

/** A value of each attribute a mapped binding translates; any other attribute takes any value. */
const MAPPED_VALUE: Record<string, string> = { Drawers: "2", Handle: "UG", Depth: "50", TowelBarOption: "Left" };

const resolve = (attributeId: string, value: string | number) =>
  resolveRuntimeBinding(urbanDuplexRuntimeBindings(), attributeId, value);

const patchOf = (attributeId: string, value: string | number) => {
  const resolution = resolve(attributeId, value);
  return resolution.ok && !isStateOnlyResolution(resolution) ? resolution.patch : null;
};

describe("urban-duplex runtime bindings", () => {
  it("cover the profile and every required attribute without a finding", () => {
    expect(validateRuntimeBindings(urbanDuplexProfile(), urbanDuplexRuntimeBindings(), REQUIRED_ATTRIBUTE_IDS)).toEqual(
      [],
    );
  });

  it("place the drawer cabinets as the scene's UD products; the shelves wait for products of their own", () => {
    expect(urbanDuplexRuntimeBindings().productTypes).toEqual({
      "Sink-Base": "UD-sink-cabinet",
      "Sink-Cabinet": "UD-side-cabinet",
    });
    expect(Object.keys(urbanDuplexRuntimeBindings().unplacedProductTypes ?? {})).toEqual(["Open-Shelf", "Side-Shelf"]);
  });

  it("let every shared value of a model and every field but the cabinet type through", () => {
    for (const attributeId of [...SHARED_PRESET_VALUES, ...UI_FIELD_IDS.filter((id) => id !== "CabinetType")]) {
      expect(resolve(attributeId, MAPPED_VALUE[attributeId] ?? "x").ok, attributeId).toBe(true);
    }
  });

  it("record the panel colours, the side of the lateral panel and the series without a scene call", () => {
    for (const [attributeId, value] of [
      ["BasePanelColor", "Bianco Calce DA ST"],
      ["LateralPanelColor", "Pulpis Chiaro TKH"],
      ["LateralPanelSide", "L"],
      ["Series", "URSTD"],
      ["VesselColor", "Bianco Gloss TAL"],
    ]) {
      expect(isStateOnlyResolution(resolve(attributeId, value)), attributeId).toBe(true);
    }
  });

  it("send the sizes and the three drawer styles in the spellings the scene config keeps", () => {
    expect(patchOf("Height", 56)).toEqual({ Height: 56 });
    // The scene lays out 46 and 50.5 cm; the cabinet table's 50 is its 50.5.
    expect(patchOf("Depth", 46)).toEqual({ Depth: 46 });
    expect(patchOf("Depth", 50)).toEqual({ Depth: 50.5 });
    expect(patchOf("Width", 60)).toEqual({ Width: 60 });
    // Upper Groove is the Duplex handle (RuleHandleCabinetUrbanDuplex reads HandleStyle).
    expect(patchOf("Handle", "UG")).toEqual({ HandleStyle: "Duplex" });
    expect(patchOf("Drawers", "2")).toEqual({ Drawers: "2D" });
    expect(patchOf("Drawers", "1")).toEqual({ Drawers: "1D" });
    expect(patchOf("Drawers", "1+inner")).toEqual({ Drawers: "1DWID" });
  });

  it("send the basin to the sink base only, with the vessel placeholder for an empty one", () => {
    expect(patchOf("sinkType", "Top_HPLStrip")).toEqual({ sinkType: "Top_HPLStrip" });
    const binding = urbanDuplexRuntimeBindings().bindings.find(({ attributeId }) => attributeId === "sinkType");
    expect(binding).toMatchObject({
      status: "bound",
      target: { kind: "productType", productType: "UD-sink-cabinet" },
      values: { emptyValue: "Vessel" },
    });
  });
});
