import { describe, expect, it } from "vitest";

import ulhProfileDocument from "../../../../../../public/collections/urban-low-height/product-profile.json";
import ulhUiDocument from "../../../../../../public/collections/urban-low-height/ui.json";
import { CORE_ATTRIBUTE_IDS } from "@/entities/configuration/model/ownership";

import { parseProductProfile } from "../../parseProductProfile";
import { isStateOnlyResolution, resolveRuntimeBinding } from "../resolveRuntimeBinding";
import { validateRuntimeBindings } from "../validateRuntimeBindings";

import { ulhRuntimeBindings } from "./ulhRuntimeBindingsFixture";

/**
 * The Urban Low Height scene products and the keys they read, as the scene export registers
 * them: ULH-sink-cabinet, ULH-side-cabinet and ULH-Open-Shelf with Width, Height, Depth, Handle
 * and CabinetColor (RuleWidthULHCabinet, RuleHeightULHCabinet, RuleHandleULHCabinet,
 * RuleMaterialsCabinetULH). There is no ULH-Open-Side-Shelf yet.
 */

const parsed = parseProductProfile(ulhProfileDocument);

const ulhProfile = () => {
  if (!parsed.ok) throw new Error(`profile failed validation: ${JSON.stringify(parsed.diagnostics)}`);
  return parsed.profile;
};

// What the loader requires: the C01 registry, the fields of ui.json and the dimensions.
const REQUIRED_ATTRIBUTE_IDS = [
  ...new Set([
    ...CORE_ATTRIBUTE_IDS,
    ...Object.values(ulhUiDocument.sections).flatMap(({ fields }) => fields.map(({ attributeId }) => attributeId)),
    "Height",
    "Width",
    "Depth",
  ]),
];

const patchOf = (attributeId: string, value: string | number) => {
  const resolution = resolveRuntimeBinding(ulhRuntimeBindings, attributeId, value);
  return resolution.ok && !isStateOnlyResolution(resolution) ? resolution.patch : null;
};

describe("urban-low-height runtime bindings", () => {
  it("cover the profile and every required attribute without a finding", () => {
    expect(validateRuntimeBindings(ulhProfile(), ulhRuntimeBindings, REQUIRED_ATTRIBUTE_IDS)).toEqual([]);
  });

  it("place Sink Base, Side Cabinet and Open Shelf as the ULH scene products", () => {
    expect(ulhRuntimeBindings.productTypes).toEqual({
      "Sink-Base": "ULH-sink-cabinet",
      "Side-Cabinet": "ULH-side-cabinet",
      "Open-Shelf": "ULH-Open-Shelf",
    });
  });

  it("declare Open Side Shelf as not placeable until the scene has its product", () => {
    expect(Object.keys(ulhRuntimeBindings.unplacedProductTypes ?? {})).toEqual(["Open-Side-Shelf"]);
  });

  it("send the sizes, the handle and the one drawer style under the keys the ULH scene reads", () => {
    expect(patchOf("Width", 80)).toEqual({ Width: 80 });
    expect(patchOf("Height", 35)).toEqual({ Height: 35 });
    expect(patchOf("Depth", 46)).toEqual({ Depth: 46 });
    expect(patchOf("Handle", "handle_pto")).toEqual({ Handle: "handle_pto" });
    expect(patchOf("Drawers", "1")).toEqual({ Drawers: "1D" });
  });

  it("send the basin and the vessel colour to every ULH Sink Base, as Urban Standard Height does", () => {
    expect(resolveRuntimeBinding(ulhRuntimeBindings, "sinkType", "Top_HPLPrisma")).toMatchObject({
      ok: true,
      target: { kind: "productType", productType: "ULH-sink-cabinet" },
      patch: { sinkType: "Top_HPLPrisma" },
    });
    expect(patchOf("sinkType", "")).toEqual({ sinkType: "Vessel" });
    expect(patchOf("VesselColor", "Bianco")).toEqual({ VesselColor: "Bianco" });
  });

  it("record the countertop style, the fluting and the groove colour without a scene call", () => {
    for (const attributeId of ["CountertopStyle", "DrawerPanelFluting", "HandleGrooveColor"]) {
      expect(isStateOnlyResolution(resolveRuntimeBinding(ulhRuntimeBindings, attributeId, "x"))).toBe(true);
    }
  });
});
