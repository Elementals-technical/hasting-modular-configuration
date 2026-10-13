import { describe, expect, it } from "vitest";

import urbanDuplexProfileDocument from "../../../../../../public/collections/urban-duplex/product-profile.json";
import urbanDuplexRuntimeBindingsDocument from "../../../../../../public/collections/urban-duplex/runtime-bindings.json";
import urbanDuplexUiDocument from "../../../../../../public/collections/urban-duplex/ui.json";
import { CORE_ATTRIBUTE_IDS } from "@/entities/configuration/model/ownership";

import { parseProductProfile } from "../../parseProductProfile";
import { parseRuntimeBindings } from "../parseRuntimeBindings";
import { resolveCabinetTypeOfRuntimeId } from "../resolveCabinetType";
import { resolveProductConfig } from "../resolveProductConfig";
import { isStateOnlyResolution, resolveRuntimeBinding } from "../resolveRuntimeBinding";
import { validateRuntimeBindings } from "../validateRuntimeBindings";

/**
 * The scene places the four Urban Duplex products: the drawer cabinets (UD-sink-cabinet,
 * UD-side-cabinet) and the shelves (UD-open-shelves, UD-open-shelves-side). It lays out their sizes,
 * drawers, handles and basin, paints the base and the lateral panel apart, and puts the lateral
 * panel on either side.
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
const MAPPED_VALUE: Record<string, string> = {
  Drawers: "2",
  Handle: "UG",
  TowelBarOption: "Left",
  LateralPanelSide: "L",
};

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

  it("place every cabinet type as its UD scene product, the open shelves included", () => {
    expect(urbanDuplexRuntimeBindings().productTypes).toEqual({
      "Sink-Base": "UD-sink-cabinet",
      "Sink-Cabinet": "UD-side-cabinet",
      "Open-Shelf": "UD-open-shelves",
      "Side-Shelf": "UD-open-shelves-side",
    });
    expect(urbanDuplexRuntimeBindings().unplacedProductTypes).toBeUndefined();
  });

  it("read a placed product back as its cabinet type, though one scene type starts the other", () => {
    const cabinetTypeOf = (runtimeId: string) =>
      resolveCabinetTypeOfRuntimeId(urbanDuplexProfile(), urbanDuplexRuntimeBindings(), runtimeId);

    expect(cabinetTypeOf("UD-open-shelves-side-k3j4h5g6f")).toBe("Side-Shelf");
    expect(cabinetTypeOf("UD-open-shelves-k3j4h5g6f")).toBe("Open-Shelf");
    expect(cabinetTypeOf("UD-sink-cabinet-k3j4h5g6f")).toBe("Sink-Base");
    expect(cabinetTypeOf("UD-side-cabinet-k3j4h5g6f")).toBe("Sink-Cabinet");
  });

  it("let every shared value of a model and every field but the cabinet type through", () => {
    for (const attributeId of [...SHARED_PRESET_VALUES, ...UI_FIELD_IDS.filter((id) => id !== "CabinetType")]) {
      expect(resolve(attributeId, MAPPED_VALUE[attributeId] ?? "x").ok, attributeId).toBe(true);
    }
  });

  it("record the colours that are not Urban Duplex options without a scene call", () => {
    for (const [attributeId, value] of [
      ["CabinetColor", "Bianco Calce DA ST"],
      ["HandleGrooveColor", "Pulpis Chiaro TKH"],
      ["VesselColor", "Bianco Gloss TAL"],
    ]) {
      expect(isStateOnlyResolution(resolve(attributeId, value)), attributeId).toBe(true);
    }
  });

  it("send the base panel colour as the cabinet colour of the drawer cabinets and the open shelf", () => {
    expect(resolve("BasePanelColor", "Castagno Scuro 1C3")).toMatchObject({
      target: { kind: "productType", productType: "UD-sink-cabinet" },
      patch: { CabinetColor: "Castagno Scuro 1C3" },
      also: [
        {
          target: { kind: "productType", productType: "UD-side-cabinet" },
          patch: { CabinetColor: "Castagno Scuro 1C3" },
        },
        {
          target: { kind: "productType", productType: "UD-open-shelves" },
          patch: { CabinetColor: "Castagno Scuro 1C3" },
        },
      ],
    });
  });

  it("send the lateral panel colour to the lateral part, the grooves and the open side shelf", () => {
    expect(resolve("LateralPanelColor", "Metal bronzo 2MD")).toMatchObject({
      target: { kind: "all" },
      patch: { CabinetColorLateral: "Metal bronzo 2MD" },
      also: [
        { target: { kind: "all" }, patch: { HandleGrooveColor: "Metal bronzo 2MD" } },
        {
          target: { kind: "productType", productType: "UD-open-shelves-side" },
          patch: { CabinetColor: "Metal bronzo 2MD" },
        },
      ],
    });
  });

  it("place each product of a model with the colours of its own type", () => {
    const colours = { BasePanelColor: "Bianco Calce DA ST", LateralPanelColor: "Pulpis Chiaro TKH" };
    const placedAs = (sceneType: string) =>
      resolveProductConfig(urbanDuplexRuntimeBindings(), colours, undefined, sceneType);

    // A drawer cabinet: its body, its lateral part and its grooves.
    expect(placedAs("UD-sink-cabinet")).toEqual({
      CabinetColor: "Bianco Calce DA ST",
      CabinetColorLateral: "Pulpis Chiaro TKH",
      HandleGrooveColor: "Pulpis Chiaro TKH",
    });
    // The open shelf is the base panel colour; the open side shelf the lateral one, as its SKU spells it.
    expect(placedAs("UD-open-shelves").CabinetColor).toBe("Bianco Calce DA ST");
    expect(placedAs("UD-open-shelves-side").CabinetColor).toBe("Pulpis Chiaro TKH");
  });

  it("give both panel colours to a product placed later", () => {
    for (const attributeId of ["BasePanelColor", "LateralPanelColor"]) {
      const binding = urbanDuplexRuntimeBindings().bindings.find((entry) => entry.attributeId === attributeId);

      expect(binding, attributeId).toMatchObject({ status: "bound", placedWithNewProducts: true });
    }
  });

  it("put the lateral panel on the side chosen for the composition", () => {
    expect(patchOf("LateralPanelSide", "L")).toEqual({ HandleSide: "Left" });
    expect(patchOf("LateralPanelSide", "R")).toEqual({ HandleSide: "Right" });
    expect(resolve("LateralPanelSide", "L")).toMatchObject({ target: { kind: "all" } });
  });

  it("show a cabinet of another Urban series, which has no lateral panel, with the full handles", () => {
    expect(patchOf("Series", "URDPX")).toEqual({ HandleStyle: "Duplex" });
    expect(patchOf("Series", "URSTD")).toEqual({ HandleStyle: "Default" });
    expect(patchOf("Series", "URLH")).toEqual({ HandleStyle: "Default" });

    // The series goes after the handle, so a model's own cabinet keeps its handles.
    const placed = resolveProductConfig(urbanDuplexRuntimeBindings(), { Series: "URSTD", Handle: "UG" });
    expect(placed).toEqual({ HandleStyle: "Default" });
  });

  it("send the sizes and the three drawer styles in the spellings the scene config keeps", () => {
    expect(patchOf("Height", 56)).toEqual({ Height: 56 });
    // 50 and 46 cm, as the cabinet table and the Pricing give them; not the 50.5 of Urban Standard Height.
    expect(patchOf("Depth", 46)).toEqual({ Depth: 46 });
    expect(patchOf("Depth", 50)).toEqual({ Depth: 50 });
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
