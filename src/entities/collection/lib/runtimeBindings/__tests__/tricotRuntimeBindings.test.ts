import { describe, expect, it } from "vitest";
import bundle from "../../../../../../public/HastingCabinetsParametrization/js/esm.mjs?raw";
import sceneConfig from "../../../../../../public/HastingCabinetsParametrization/config.json?raw";

import {
  tricotProfile,
  tricotRuntimeBindings as bindings,
  tricotUi,
} from "@/entities/collection/__tests__/tricotFixtures";
import { CORE_ATTRIBUTE_IDS } from "@/entities/configuration/model/ownership";
import { normalizeOptionValue } from "../../productProfileSelectors";
import { collectCustomizationAttributeIds } from "../collectionRuntimeContract";
import { parseRuntimeBindings } from "../parseRuntimeBindings";
import { findProductConfigBindingErrors, resolveProductConfig } from "../resolveProductConfig";
import {
  configurationValueOf,
  isStateOnlyResolution,
  resolveRuntimeBinding,
  semanticValueOf,
} from "../resolveRuntimeBinding";
import { validateRuntimeBindings } from "../validateRuntimeBindings";

const patch = (id: string, value: string | number) => resolveRuntimeBinding(bindings, id, value);

describe("Tricot delivered runtime bindings", () => {
  it("covers the real profile, UI and core attributes with bindings or explicit pending reasons", () => {
    expect(
      validateRuntimeBindings(tricotProfile, bindings, [
        ...CORE_ATTRIBUTE_IDS,
        ...collectCustomizationAttributeIds(tricotUi),
        "Width",
        "Height",
        "Depth",
      ]),
    ).toEqual([]);
    expect(bindings.productTypes).toEqual({
      "Sink-Base": "Tricot-sink-cabinet",
      "Side-Cabinet": "Tricot-side-cabinet",
    });
    expect(bindings.strictProductConfig).toBe(true);
  });

  it.each([40, 60, 80, 100, 120])("sends width %s in cm, never converted to meters", (width) => {
    expect(patch("Width", width)).toMatchObject({ ok: true, target: { kind: "product" }, patch: { Width: width } });
    expect(resolveProductConfig(bindings, { Width: String(width), Height: 40, Depth: 52 })).toEqual({
      Width: width,
      Height: 40,
      Depth: 52,
    });
  });

  it.each([
    ["1", "1D"],
    ["2", "2D"],
    ["1+inner", "1DWID"],
  ])("maps drawer %s to %s without changing dimensions", (semantic, scene) => {
    expect(patch("Drawers", semantic)).toMatchObject({ ok: true, patch: { Drawers: scene } });
    expect(resolveProductConfig(bindings, { Drawers: semantic, Height: 40, Depth: 52 })).toEqual({
      Drawers: scene,
      Height: 40,
      Depth: 52,
    });
    expect(findProductConfigBindingErrors(bindings, { Drawers: scene })).toEqual([]);
  });

  it.each([
    ["Width", 0.6],
    ["Width", 56],
    ["Height", 52],
    ["Depth", 50],
    ["Drawers", "3D"],
    ["Drawers", "toString"],
  ])("rejects unsupported %s=%s", (id, value) => {
    expect(patch(String(id), value)).toMatchObject({ ok: false, reason: "unknown-value" });
    expect(findProductConfigBindingErrors(bindings, { [String(id)]: value })).toHaveLength(1);
  });

  it("checks both product registrations and every delivered lacquer and wood material against the actual export", () => {
    const exportDocument = JSON.parse(sceneConfig) as { assets: Record<string, { type: string; name: string }> };
    const materials = new Set(
      Object.values(exportDocument.assets)
        .filter((a) => a.type === "material")
        .map((a) => a.name),
    );
    for (const type of Object.values(bindings.productTypes))
      expect(bundle).toContain(`registry.registerProduct("${type}"`);
    // 20 lacquers each; the cabinet palette adds the 3 wood veneers.
    for (const [id, size] of [
      ["CabinetColor", 23],
      ["HandleGrooveColor", 20],
    ] as const) {
      const binding = bindings.bindings.find((b) => b.attributeId === id);
      if (binding?.status !== "bound" || binding.values.kind !== "map") throw new Error("Missing palette");
      expect(Object.keys(binding.values.patches)).toHaveLength(size);
      for (const [value, scenePatch] of Object.entries(binding.values.patches)) {
        const sceneMaterial = String(scenePatch[id]);
        expect(materials.has(sceneMaterial), sceneMaterial).toBe(true);
        // The bindings, not the profile, know the scene name: it reads back as the catalog value.
        expect(semanticValueOf(bindings, id, sceneMaterial)).toBe(value);
        expect(configurationValueOf(bindings, id, sceneMaterial, value)).toBe(value);
        expect(findProductConfigBindingErrors(bindings, { [id]: sceneMaterial })).toEqual([]);
      }
    }
  });

  it.each(["Noce Canaletto 933", "Rovere Oro 932", "Rovere Termocotto 931"])(
    "sends wood %s to the cabinets as the export's material of the same name, never another wood",
    (value) => {
      expect(patch("CabinetColor", value)).toMatchObject({
        ok: true,
        target: { kind: "cabinets" },
        patch: { CabinetColor: value },
      });
      expect(findProductConfigBindingErrors(bindings, { CabinetColor: value })).toEqual([]);
      expect(resolveProductConfig(bindings, { CabinetColor: value, Width: 60 })).toEqual({
        CabinetColor: value,
        Width: 60,
      });
      expect(semanticValueOf(bindings, "CabinetColor", value)).toBe(value);
    },
  );

  it.each([
    ["Loden", "Loden"],
    ["Cannette", "Cannette"],
    ["Twill", "Twill"],
    ["Gessato", "Gessatto"],
    ["Satin", "Satin"],
  ])("sends pattern %s to its own cabinet as the scene's CabinetPattern %s and reads it back", (semantic, scene) => {
    expect(patch("DrawerPanelFluting", semantic)).toMatchObject({
      ok: true,
      target: { kind: "product" },
      patch: { CabinetPattern: scene },
    });
    expect(resolveProductConfig(bindings, { DrawerPanelFluting: semantic })).toEqual({ CabinetPattern: scene });
    expect(normalizeOptionValue(tricotProfile, "DrawerPanelFluting", scene)).toBe(semantic);
    expect(findProductConfigBindingErrors(bindings, { CabinetPattern: scene })).toEqual([]);
  });

  it("keeps each pattern spelling under its own key", () => {
    expect(findProductConfigBindingErrors(bindings, { CabinetPattern: "Gessato" })).toHaveLength(1);
    expect(findProductConfigBindingErrors(bindings, { DrawerPanelFluting: "Gessatto" })).toHaveLength(1);
  });

  it("sends exactly the patterns the delivered export accepts on both products", () => {
    // The bundle lists Lame's patterns too; Tricot's are the ones of its own rule.
    const accepted = bundle.match(/name:"RulePatternCabinetTricot"[\s\S]*?valuesCabinetPattern=\[([^\]]*)\]/)?.[1];
    const binding = bindings.bindings.find((b) => b.attributeId === "DrawerPanelFluting");
    if (!accepted || binding?.status !== "bound" || binding.values.kind !== "map") throw new Error("Missing pattern");
    expect(new Set(Object.values(binding.values.patches).map((scenePatch) => scenePatch.CabinetPattern))).toEqual(
      new Set(JSON.parse(`[${accepted}]`)),
    );
    for (const type of Object.values(bindings.productTypes)) {
      const registration = bundle.match(new RegExp(`registerProduct\\("${type}".*?defaultConfig:\\{[^}]*\\}`))?.[0];
      expect(registration, type).toContain("{rule:RulePatternCabinetTricot,priority:70}");
    }
  });

  it.each(["SidePanels", "GrainDirection"])(
    "keeps missing visual %s unbound, not state-only: never sent, and a cabinet is placed without it",
    (id) => {
      expect(patch(id, "anything")).toMatchObject({ ok: false, reason: "unbound", detail: expect.any(String) });
      expect(findProductConfigBindingErrors(bindings, { [id]: "anything" })).toEqual([]);
      expect(resolveProductConfig(bindings, { [id]: "anything" })).toEqual({});
    },
  );

  it("sends each basin and vessel as Class does, as an authored sub-product of the sink base, and reads it back", () => {
    const basins = tricotProfile.attributes.find(({ attributeId }) => attributeId === "sinkType")?.options ?? [];
    for (const { value } of basins.filter(({ value }) => value !== "None")) {
      const resolution = patch("sinkType", value);
      if (!resolution.ok || !("patch" in resolution)) throw new Error(`No basin for ${value}`);
      expect(resolution.target).toEqual({ kind: "productType", productType: "Tricot-sink-cabinet" });
      const sceneBasin = String(resolution.patch.sinkType);
      expect(bundle, sceneBasin).toContain(`registry.registerProduct("${sceneBasin}"`);
      expect(configurationValueOf(bindings, "sinkType", sceneBasin, value)).toBe(value);
    }
    expect(patch("sinkType", "Iris")).toMatchObject({ patch: { sinkType: "Vessel_Iris" } });
    expect(patch("sinkType", "Frame")).toMatchObject({ patch: { sinkType: "Vessel_Frame" } });
    expect(patch("sinkType", "Plaza")).toMatchObject({ patch: { sinkType: "Vessel_Blade11" } });
    // None and a cleared basin, as a switch to the vessel style leaves it, are the empty vessel cutout.
    expect(patch("sinkType", "None")).toMatchObject({ patch: { sinkType: "Vessel" } });
    expect(patch("sinkType", "")).toMatchObject({ patch: { sinkType: "Vessel" } });
    // The scene's default basin is LB440's, so a sink base placed without a choice reads back as LB440.
    expect(patch("sinkType", "LB440")).toMatchObject({ patch: { sinkType: "Top_HPLPrisma" } });
    expect(findProductConfigBindingErrors(bindings, { sinkType: "Top_HPLPrisma" })).toEqual([]);
  });

  it("sends the vessel colour to the sink base as its lacquer material, and reads it back", () => {
    const scene = JSON.parse(sceneConfig) as { assets: Record<string, { name?: string; type?: string }> };
    const materials = new Set(
      Object.values(scene.assets)
        .filter(({ type }) => type === "material")
        .map(({ name }) => name),
    );

    expect(patch("VesselColor", "Salvia 415 MT")).toMatchObject({
      ok: true,
      target: { kind: "productType", productType: "Tricot-sink-cabinet" },
      patch: { VesselColor: "Salvia 415 Lacquered MT" },
    });
    expect(patch("VesselColor", "Zaffiro 411 GL")).toMatchObject({
      patch: { VesselColor: "Zaffiro 411 Lacquered GL" },
    });
    const binding = bindings.bindings.find(({ attributeId }) => attributeId === "VesselColor");
    if (binding?.status !== "bound" || binding.values.kind !== "identity") throw new Error("Missing vessel colour");
    const overrides = Object.entries(binding.values.overrides ?? {});
    expect(overrides).toHaveLength(40);
    for (const [value, material] of overrides) {
      expect(materials.has(String(material)), String(material)).toBe(true);
      expect(configurationValueOf(bindings, "VesselColor", String(material), value)).toBe(value);
    }
  });

  it("sends the countertop colour and thickness to the composition, and records the style, as Class does", () => {
    expect(patch("CountertopColor", "Matte White")).toMatchObject({
      ok: true,
      target: { kind: "all" },
      patch: { CountertopColor: "Solid Surface Matte White" },
    });
    expect(patch("CountertopColor", "Nebbia 402 MT")).toMatchObject({
      patch: { CountertopColor: "Nebbia 402 Glass MT" },
    });
    // Configurator 12 writes the HPL and Porcelain names in capitals; the scene in title case.
    expect(patch("CountertopColor", "ARDESIA NERA 328")).toMatchObject({
      patch: { CountertopColor: "Ardesia Nera 328" },
    });
    expect(configurationValueOf(bindings, "CountertopColor", "Ardesia Nera 328", "ARDESIA NERA 328")).toBe(
      "ARDESIA NERA 328",
    );
    expect(patch("Thickness", "4.75")).toMatchObject({
      ok: true,
      target: { kind: "all" },
      patch: { Thickness: "4.75" },
    });
    expect(isStateOnlyResolution(patch("CountertopStyle", "integrated"))).toBe(true);
    expect(isStateOnlyResolution(patch("CountertopStyle", "vessel"))).toBe(true);
  });

  it("passes the keys the scene writes into every product it places", () => {
    const sceneOwned = {
      category: "cabinets",
      topDrawerType: "Top",
      TopDrawerDividers: { zones: {} },
      BotDrawerDividers: { zones: {} },
      positionX: 0.6005,
      positionY: 0,
      positionZ: 0,
    };
    expect(findProductConfigBindingErrors(bindings, sceneOwned)).toEqual([]);
    expect(resolveProductConfig(bindings, sceneOwned)).toEqual(sceneOwned);
  });

  it("accepts the export's own default color on readback and never sends it", () => {
    const sceneDefault = "Antracite Matte OCF";
    expect(patch("CabinetColor", sceneDefault)).toMatchObject({ ok: false, reason: "unbound" });
    expect(findProductConfigBindingErrors(bindings, { CabinetColor: sceneDefault })).toEqual([]);
    expect(resolveProductConfig(bindings, { CabinetColor: sceneDefault, Width: 60 })).toEqual({ Width: 60 });
    expect(semanticValueOf(bindings, "CabinetColor", sceneDefault)).toBe(sceneDefault);
    // No wood is pending any more: a scene that still holds its default does not read as the chosen wood.
    expect(configurationValueOf(bindings, "CabinetColor", sceneDefault, "Rovere Oro 932")).toBe(sceneDefault);
    expect(configurationValueOf(bindings, "CabinetColor", sceneDefault, "Zafferano 412 MT")).toBe(sceneDefault);
    for (const type of Object.values(bindings.productTypes)) {
      const registration = bundle.match(new RegExp(`registerProduct\\("${type}".*?defaultConfig:\\{[^}]*\\}`))?.[0];
      expect(registration, type).toContain(`CabinetColor:"${sceneDefault}"`);
    }
  });

  it("still blocks an invalid value among valid ones", () => {
    expect(
      findProductConfigBindingErrors(bindings, { CabinetColor: "Rovere Oro 932", sinkType: "LB440", Height: 52 }),
    ).toEqual(['No approved scene translation for Height "52".']);
  });

  it("does not expand matte catalogs from the developer's gloss example or change preset defaults", () => {
    expect(patch("HandleGrooveColor", "Acqua 419 Lacquered GL")).toMatchObject({ ok: false });
    expect(tricotProfile.defaults).toMatchObject({
      CabinetColor: "Rovere Oro 932",
      DrawerPanelFluting: "Cannette",
      HandleGrooveColor: "Agata 407 MT",
      sinkType: "VA024",
    });
  });

  it("validates explicit per-value gaps and the strict opt-in without changing legacy behavior", () => {
    const raw = {
      schemaVersion: 1,
      collectionId: "test",
      productTypes: {},
      strictProductConfig: true,
      bindings: [
        {
          attributeId: "Color",
          status: "bound",
          target: { kind: "product" },
          values: { kind: "map", patches: { ready: { Color: "asset" } }, unboundValues: { pending: "not delivered" } },
        },
      ],
    };
    expect(parseRuntimeBindings(raw)).toMatchObject({ ok: true });
    for (const unboundValues of [{ pending: "" }, { ready: "ambiguous" }, []]) {
      expect(
        parseRuntimeBindings({
          ...raw,
          bindings: [{ ...raw.bindings[0], values: { ...raw.bindings[0].values, unboundValues } }],
        }),
      ).toMatchObject({ ok: false });
    }
    expect(parseRuntimeBindings({ ...raw, strictProductConfig: "true" })).toMatchObject({ ok: false });
    expect(
      findProductConfigBindingErrors(
        { ...bindings, strictProductConfig: undefined },
        { DrawerPanelFluting: "Cannette" },
      ),
    ).toEqual([]);
    expect(findProductConfigBindingErrors(bindings, { Unexpected: "unapproved", Height: null })).toHaveLength(2);
  });
});
