import { describe, expect, it } from "vitest";

import ufsProfileDocument from "../../../../../../public/collections/urban-freestanding/product-profile.json";
import ufsRuntimeBindingsDocument from "../../../../../../public/collections/urban-freestanding/runtime-bindings.json";
import ufsUiDocument from "../../../../../../public/collections/urban-freestanding/ui.json";
import { CORE_ATTRIBUTE_IDS } from "@/entities/configuration/model/ownership";

import { parseProductProfile } from "../../parseProductProfile";
import { parseRuntimeBindings } from "../parseRuntimeBindings";
import { resolveCabinetTypeOfRuntimeId } from "../resolveCabinetType";
import { isStateOnlyResolution, resolveRuntimeBinding } from "../resolveRuntimeBinding";
import { validateRuntimeBindings } from "../validateRuntimeBindings";

/**
 * The Urban Freestanding scene products as the scene export registers them: UF-sink-cabinet and
 * UF-side-cabinet with Width, Height and Depth (RuleWidthCabinetUrbanFreestanding,
 * RuleHeightCabinetUrbanFreestanding, RuleDepthCabinetUrbanFreestanding), whose drawers and handle
 * grooves follow Height, and the open shelves UF-open-shelves and UF-open-shelves-side. All four
 * take CabinetColor; the two drawer cabinets also paint HandleGrooveColor.
 */

const parsedProfile = parseProductProfile(ufsProfileDocument);
const parsedBindings = parseRuntimeBindings(ufsRuntimeBindingsDocument);

const ufsProfile = () => {
  if (!parsedProfile.ok) throw new Error(`profile failed validation: ${JSON.stringify(parsedProfile.diagnostics)}`);
  return parsedProfile.profile;
};

const ufsRuntimeBindings = () => {
  if (!parsedBindings.ok) throw new Error(`bindings failed validation: ${JSON.stringify(parsedBindings.diagnostics)}`);
  return parsedBindings.bindings;
};

// What the loader requires: the C01 registry, the fields of ui.json and the dimensions.
const REQUIRED_ATTRIBUTE_IDS = [
  ...new Set([
    ...CORE_ATTRIBUTE_IDS,
    ...Object.values(ufsUiDocument.sections).flatMap(({ fields }) => fields.map(({ attributeId }) => attributeId)),
    "Height",
    "Width",
    "Depth",
  ]),
];

const patchOf = (attributeId: string, value: string | number) => {
  const resolution = resolveRuntimeBinding(ufsRuntimeBindings(), attributeId, value);
  return resolution.ok && !isStateOnlyResolution(resolution) ? resolution.patch : null;
};

describe("urban-freestanding runtime bindings", () => {
  it("cover the profile and every required attribute without a finding", () => {
    expect(validateRuntimeBindings(ufsProfile(), ufsRuntimeBindings(), REQUIRED_ATTRIBUTE_IDS)).toEqual([]);
  });

  it("place every cabinet type as its UF scene product, the open shelves included", () => {
    expect(ufsRuntimeBindings().productTypes).toEqual({
      "Sink-Base": "UF-sink-cabinet",
      "Sink-Cabinet": "UF-side-cabinet",
      "Open-Shelf": "UF-open-shelves",
      "Side-Shelf": "UF-open-shelves-side",
    });
    expect(ufsRuntimeBindings().unplacedProductTypes).toBeUndefined();
  });

  it("read a placed product back as its cabinet type, though one scene type starts the other", () => {
    const cabinetTypeOf = (runtimeId: string) =>
      resolveCabinetTypeOfRuntimeId(ufsProfile(), ufsRuntimeBindings(), runtimeId);

    expect(cabinetTypeOf("UF-open-shelves-side-k3j4h5g6f")).toBe("Side-Shelf");
    expect(cabinetTypeOf("UF-open-shelves-k3j4h5g6f")).toBe("Open-Shelf");
    expect(cabinetTypeOf("UF-sink-cabinet-k3j4h5g6f")).toBe("Sink-Base");
    expect(cabinetTypeOf("UF-side-cabinet-k3j4h5g6f")).toBe("Sink-Cabinet");
  });

  it("send the catalog sizes as they are, since the player reads them back from the scene", () => {
    expect(patchOf("Height", 91)).toEqual({ Height: 91 });
    expect(patchOf("Height", 88)).toEqual({ Height: 88 });
    expect(patchOf("Depth", 46)).toEqual({ Depth: 46 });
    expect(patchOf("Width", 25)).toEqual({ Width: 25 });
  });

  it("send the handle and the one drawer style in the spellings the scene config keeps", () => {
    expect(patchOf("Handle", "UG")).toEqual({ Handle: "UG" });
    expect(patchOf("Drawers", "2")).toEqual({ Drawers: "2D" });
  });

  it("send the basin and the vessel colour to every UF Sink Base", () => {
    expect(resolveRuntimeBinding(ufsRuntimeBindings(), "sinkType", "Top_HPLPrisma")).toMatchObject({
      ok: true,
      target: { kind: "productType", productType: "UF-sink-cabinet" },
      patch: { sinkType: "Top_HPLPrisma" },
    });
    expect(patchOf("sinkType", "")).toEqual({ sinkType: "Vessel" });
    expect(patchOf("VesselColor", "Bianco")).toEqual({ VesselColor: "Bianco" });
  });

  it("send the groove colour to every product, and a cleared one as the scene's None", () => {
    expect(resolveRuntimeBinding(ufsRuntimeBindings(), "HandleGrooveColor", "Acqua 419 Lacquered GL")).toMatchObject({
      ok: true,
      target: { kind: "all" },
      patch: { HandleGrooveColor: "Acqua 419 Lacquered GL" },
    });
    expect(patchOf("HandleGrooveColor", "")).toEqual({ HandleGrooveColor: "None" });
  });

  it("record the countertop style and the fluting without a scene call", () => {
    for (const attributeId of ["CountertopStyle", "DrawerPanelFluting"]) {
      expect(isStateOnlyResolution(resolveRuntimeBinding(ufsRuntimeBindings(), attributeId, "x"))).toBe(true);
    }
  });
});
