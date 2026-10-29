import { describe, expect, it } from "vitest";

import lamePresetsDocument from "../../../../../../public/collections/lame/presets.json";
import lameProfileDocument from "../../../../../../public/collections/lame/product-profile.json";
import lameRuntimeBindingsDocument from "../../../../../../public/collections/lame/runtime-bindings.json";
import lameUiDocument from "../../../../../../public/collections/lame/ui.json";
import { CORE_ATTRIBUTE_IDS } from "@/entities/configuration/model/ownership";

import { parseProductProfile } from "../../parseProductProfile";
import { parseRuntimeBindings } from "../parseRuntimeBindings";
import { resolveProductConfig } from "../resolveProductConfig";
import { isStateOnlyResolution, resolveRuntimeBinding, selectRuntimeBinding } from "../resolveRuntimeBinding";
import { validateRuntimeBindings } from "../validateRuntimeBindings";

/**
 * The Lame scene of export v66: Lame-sink-cabinet and Lame-side-cabinet take the cabinet's own
 * values, one pattern goes on the whole composition, and the legs and the undertop are shared by
 * the composition. The countertop and the sizes are bound as the Mako scene takes them.
 */

const parsedProfile = parseProductProfile(lameProfileDocument);
const parsedBindings = parseRuntimeBindings(lameRuntimeBindingsDocument);

const lameProfile = () => {
  if (!parsedProfile.ok) throw new Error(`profile failed validation: ${JSON.stringify(parsedProfile.diagnostics)}`);
  return parsedProfile.profile;
};

const lameRuntimeBindings = () => {
  if (!parsedBindings.ok) throw new Error(`bindings failed validation: ${JSON.stringify(parsedBindings.diagnostics)}`);
  return parsedBindings.bindings;
};

const UI_FIELD_IDS = Object.values(lameUiDocument.sections).flatMap(({ fields }) =>
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
  CountertopStyle: "integrated",
  Drawers: "2",
  CabinetPattern: "Oxford",
  LegColor: "None",
  UndertopColor: "None",
  sinkType: "LB440",
};

const resolve = (attributeId: string, value: string | number) =>
  resolveRuntimeBinding(lameRuntimeBindings(), attributeId, value);

/**
 * A field whose binding is declared `unbound` (with its reason) never goes to the scene: such a value reaches
 * it another way, as the Dividers of the other collections do (Lame: the drawer organizers, `DividersOption`).
 */
const isDeclaredUnbound = (attributeId: string) => {
  const resolution = resolve(attributeId, "x");
  return !resolution.ok && resolution.reason === "unbound" && Boolean(resolution.detail);
};

const patchOf = (attributeId: string, value: string | number) => {
  const resolution = resolve(attributeId, value);
  return resolution.ok && !isStateOnlyResolution(resolution) ? resolution.patch : null;
};

const targetOf = (attributeId: string, value: string | number) => {
  const resolution = resolve(attributeId, value);
  return resolution.ok && !isStateOnlyResolution(resolution) ? resolution.target : null;
};

const placedWithNewProducts = (attributeId: string) => {
  const binding = selectRuntimeBinding(lameRuntimeBindings(), attributeId);
  return binding?.status === "bound" && binding.placedWithNewProducts === true;
};

describe("lame runtime bindings", () => {
  it("cover the profile and every required attribute without a finding", () => {
    expect(validateRuntimeBindings(lameProfile(), lameRuntimeBindings(), REQUIRED_ATTRIBUTE_IDS)).toEqual([]);
  });

  it("place both cabinet types as the products of the Lame scene", () => {
    expect(lameRuntimeBindings().productTypes).toEqual({
      "Sink-Base": "Lame-sink-cabinet",
      "Sink-Cabinet": "Lame-side-cabinet",
    });
    expect(lameRuntimeBindings().unplacedProductTypes).toBeUndefined();
  });

  it("let every shared value of a model and every field but the cabinet type through", () => {
    const fields = UI_FIELD_IDS.filter((id) => id !== "CabinetType" && !isDeclaredUnbound(id));

    for (const attributeId of [...SHARED_PRESET_VALUES, ...fields]) {
      expect(resolve(attributeId, MAPPED_VALUE[attributeId] ?? "x").ok, attributeId).toBe(true);
    }
  });

  it("record the one G58 handle without a scene call: the scene has no handle style key", () => {
    expect(isStateOnlyResolution(resolve("Handle", "G58"))).toBe(true);
  });

  it("send a drawer style to its cabinet together with its height, as the scene keeps them apart", () => {
    expect(patchOf("Drawers", "1")).toEqual({ Drawers: "1D", Height: 26 });
    expect(patchOf("Drawers", "2")).toEqual({ Drawers: "2D", Height: 52 });
    expect(targetOf("Drawers", "1")).toEqual({ kind: "product" });
  });

  it("put one pattern on the composition, Gessato as the scene spells it, and on a cabinet placed later", () => {
    expect(patchOf("CabinetPattern", "Gessato")).toEqual({ CabinetPattern: "Gessatto" });
    for (const pattern of ["Galles", "Oxford", "Piquet", "Plisse"]) {
      expect(patchOf("CabinetPattern", pattern)).toEqual({ CabinetPattern: pattern });
    }
    expect(targetOf("CabinetPattern", "Oxford")).toEqual({ kind: "all" });
    expect(placedWithNewProducts("CabinetPattern")).toBe(true);
  });

  it("paint the cabinets and the handles in the scene's material names", () => {
    expect(patchOf("CabinetColor", "Antracite 400 MT")).toEqual({ CabinetColor: "Antracite 400 Lacquered MT" });
    expect(patchOf("CabinetColor", "Acqua 419 GL")).toEqual({ CabinetColor: "Acqua 419 Lacquered GL" });
    expect(patchOf("HandleColor", "Nero 433 MT")).toEqual({ HandleColor: "Nero 433 Lacquered MT" });
    expect(patchOf("HandleColor", "Gold")).toEqual({ HandleColor: "Gold" });
  });

  // The scene shares one pair of legs and one undertop while any Lame cabinet enables them, and paints
  // their caps and slab in the handle colour while none of their own is given.
  it("switch the composition's legs and undertop with their colour, on every product", () => {
    expect(patchOf("LegColor", "")).toEqual({ ShowLegs: "Disable", LegCapColor: "" });
    expect(patchOf("LegColor", "None")).toEqual({ ShowLegs: "Enable", LegCapColor: "None" });
    expect(patchOf("LegColor", "Silver")).toEqual({ ShowLegs: "Enable", LegCapColor: "Silver" });
    expect(patchOf("LegColor", "Acqua 419 MT")).toEqual({ ShowLegs: "Enable", LegCapColor: "Acqua 419 Lacquered MT" });

    expect(patchOf("UndertopColor", "")).toEqual({ ShowUndertop: "Disable", UndertopColor: "" });
    expect(patchOf("UndertopColor", "None")).toEqual({ ShowUndertop: "Enable", UndertopColor: "None" });
    expect(patchOf("UndertopColor", "Gold")).toEqual({ ShowUndertop: "Enable", UndertopColor: "Gold" });
    expect(patchOf("UndertopColor", "Seta 406 MT")).toEqual({
      ShowUndertop: "Enable",
      UndertopColor: "Seta 406 Lacquered MT",
    });

    // Not `{ productType: "Lame-" }`: the scene selector addresses a product type by its full name only.
    expect(targetOf("LegColor", "None")).toEqual({ kind: "all" });
    expect(targetOf("UndertopColor", "None")).toEqual({ kind: "all" });
    expect(placedWithNewProducts("UndertopColor")).toBe(true);
  });

  it("give the sink cabinet its basin, and hold back VA030, which the scene has no sink for", () => {
    expect(patchOf("sinkType", "LB440")).toEqual({ sinkType: "Top_LB440" });
    expect(patchOf("sinkType", "Iris")).toEqual({ sinkType: "Vessel_Iris" });
    expect(patchOf("sinkType", "None")).toEqual({ sinkType: "Vessel" });
    expect(targetOf("sinkType", "LB440")).toEqual({ kind: "productType", productType: "Lame-sink-cabinet" });
    expect(resolve("sinkType", "VA030")).toMatchObject({ ok: false, reason: "unbound" });

    expect(patchOf("VesselColor", "Antracite 400 GL")).toEqual({ VesselColor: "Antracite 400 Lacquered GL" });
    expect(targetOf("VesselColor", "Antracite 400 GL")).toEqual({
      kind: "productType",
      productType: "Lame-sink-cabinet",
    });
  });

  // resolveSceneSelector addresses a product type by its full name, so "Lame-" would reach no product.
  it("address a product type only by the full name of a Lame scene product", () => {
    const sceneTypes = Object.values(lameRuntimeBindings().productTypes);

    for (const binding of lameRuntimeBindings().bindings) {
      if (binding.status !== "bound" || binding.target.kind !== "productType") continue;
      expect(sceneTypes, binding.attributeId).toContain(binding.target.productType);
    }
  });

  it("place a cabinet of a model with legs as the scene takes it", () => {
    const model = lamePresetsDocument.find(({ title }) => title === 'Lame Vanity · 24" 1-Drawer Legs');
    const product = model?.presetProducts[0];
    if (!product) throw new Error("the 24-inch one-drawer model with legs is missing");

    const config = resolveProductConfig(lameRuntimeBindings(), product);

    expect(config).toMatchObject({
      name: "Sink-Base",
      Width: 60,
      Height: 26,
      Depth: 52,
      Drawers: "1D",
      CabinetColor: "Antracite 400 Lacquered MT",
      HandleColor: "Antracite 400 Lacquered MT",
      CabinetPattern: "Oxford",
      ShowLegs: "Enable",
      LegCapColor: "None",
    });
    // G58 is recorded, not sent: the scene has no handle style key.
    expect(config).not.toHaveProperty("Handle");
    expect(config).not.toHaveProperty("LegColor");
  });

  it("send the sizes and the countertop as the Mako scene takes them", () => {
    expect(patchOf("Height", 26)).toEqual({ Height: 26 });
    expect(patchOf("Height", 52)).toEqual({ Height: 52 });
    expect(patchOf("Width", 80)).toEqual({ Width: 80 });
    expect(patchOf("Depth", 52)).toEqual({ Depth: 52 });
    expect(patchOf("CountertopStyle", "vessel")).toEqual({ CountertopStyle: "Vessel" });
    expect(patchOf("CountertopColor", "Antracite 400 MT")).toEqual({ CountertopColor: "Antracite 400 Glass MT" });
    // The default top of Lame, which the scene names after its material.
    expect(patchOf("CountertopColor", "Matte White")).toEqual({ CountertopColor: "Solid Surface Matte White" });
  });
});
