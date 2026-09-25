import { describe, expect, it } from "vitest";

import classProfileDocument from "../../../../../../public/collections/class/product-profile.json";
import classUiDocument from "../../../../../../public/collections/class/ui.json";
import { CORE_ATTRIBUTE_IDS } from "@/entities/configuration/model/ownership";

import { parseProductProfile } from "../../parseProductProfile";
import { isStateOnlyResolution, resolveRuntimeBinding } from "../resolveRuntimeBinding";
import { validateRuntimeBindings } from "../validateRuntimeBindings";

import { classRuntimeBindings } from "./classRuntimeBindingsFixture";

/**
 * The Class scene products and options, as the scene documents them: Class-side-cabinet and
 * Class-sink-cabinet, Width, Height 40/52, InnerDrawer Enable/Disable and the three colour
 * slots (docs/class-collection-runtime-facts.md, RuleDrawersCabinetClass, RuleMaterialsCabinetClass).
 */

const parsed = parseProductProfile(classProfileDocument);

const classProfile = () => {
  if (!parsed.ok) throw new Error(`profile failed validation: ${JSON.stringify(parsed.diagnostics)}`);
  return parsed.profile;
};

// What the loader requires: the C01 registry, the fields of ui.json and the dimensions.
const REQUIRED_ATTRIBUTE_IDS = [
  ...new Set([
    ...CORE_ATTRIBUTE_IDS,
    ...Object.values(classUiDocument.sections).flatMap(({ fields }) => fields.map(({ attributeId }) => attributeId)),
    "Height",
    "Width",
    "Depth",
  ]),
];

const patchOf = (attributeId: string, value: string | number) => {
  const resolution = resolveRuntimeBinding(classRuntimeBindings, attributeId, value);
  return resolution.ok && !isStateOnlyResolution(resolution) ? resolution.patch : null;
};

describe("class runtime bindings", () => {
  it("cover the profile and every required attribute without a finding", () => {
    expect(validateRuntimeBindings(classProfile(), classRuntimeBindings, REQUIRED_ATTRIBUTE_IDS)).toEqual([]);
  });

  it("place Sink Base and Side Cabinet as the Class scene products", () => {
    expect(classRuntimeBindings.productTypes).toEqual({
      "Sink-Base": "Class-sink-cabinet",
      "Sink-Cabinet": "Class-side-cabinet",
    });
  });

  it("send the drawer style as the height and inner drawer the scene lays the drawers out from", () => {
    expect(patchOf("Drawers", "1")).toEqual({ Drawers: "1D", Height: 40, InnerDrawer: "Disable" });
    expect(patchOf("Drawers", "2")).toEqual({ Drawers: "2D", Height: 52, InnerDrawer: "Disable" });
    expect(patchOf("Drawers", "1+inner")).toEqual({ Drawers: "1DWID", Height: 40, InnerDrawer: "Enable" });
    expect(patchOf("Height", 40)).toEqual({ Height: 40 });
    expect(resolveRuntimeBinding(classRuntimeBindings, "Height", 26)).toMatchObject({ reason: "unknown-value" });
  });

  it("send the three colour slots and the countertop colour as material names", () => {
    expect(patchOf("CabinetColor", "Nebbia 402 MT")).toEqual({ CabinetColor: "Nebbia 402 MT" });
    expect(patchOf("CabinetSideColor", "Nebbia 402 MT")).toEqual({ CabinetSideColor: "Nebbia 402 MT" });
    expect(patchOf("FrameColor", "Nebbia 402 MT")).toEqual({ FrameColor: "Nebbia 402 MT" });
    expect(patchOf("CountertopColor", "Matte White")).toEqual({ CountertopColor: "Matte White" });
  });

  it("record the countertop style, basin and faucet holes without a scene call", () => {
    for (const attributeId of ["CountertopStyle", "sinkType", "FaucetHolesAmount"]) {
      expect(isStateOnlyResolution(resolveRuntimeBinding(classRuntimeBindings, attributeId, "x"))).toBe(true);
    }
  });
});
