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
import { configurationValueOf, resolveRuntimeBinding } from "../resolveRuntimeBinding";
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

  it("checks both product registrations and every delivered lacquer material against the actual export", () => {
    const exportDocument = JSON.parse(sceneConfig) as { assets: Record<string, { type: string; name: string }> };
    const materials = new Set(
      Object.values(exportDocument.assets)
        .filter((a) => a.type === "material")
        .map((a) => a.name),
    );
    for (const type of Object.values(bindings.productTypes))
      expect(bundle).toContain(`registry.registerProduct("${type}"`);
    for (const id of ["CabinetColor", "HandleGrooveColor"]) {
      const binding = bindings.bindings.find((b) => b.attributeId === id);
      if (binding?.status !== "bound" || binding.values.kind !== "map") throw new Error("Missing palette");
      expect(Object.keys(binding.values.patches)).toHaveLength(20);
      for (const [value, scenePatch] of Object.entries(binding.values.patches)) {
        const sceneMaterial = String(scenePatch[id]);
        expect(materials.has(sceneMaterial), sceneMaterial).toBe(true);
        expect(normalizeOptionValue(tricotProfile, id, sceneMaterial)).toBe(value);
        expect(configurationValueOf(bindings, id, sceneMaterial, value)).toBe(value);
        expect(findProductConfigBindingErrors(bindings, { [id]: sceneMaterial })).toEqual([]);
      }
    }
  });

  it.each(["Noce Canaletto 933", "Rovere Oro 932", "Rovere Termocotto 931"])(
    "keeps missing wood asset %s pending without substituting another wood",
    (value) => {
      expect(patch("CabinetColor", value)).toMatchObject({
        ok: false,
        reason: "unbound",
        detail: expect.stringContaining("wood-veneer"),
      });
      expect(findProductConfigBindingErrors(bindings, { CabinetColor: value })).toHaveLength(1);
    },
  );

  it.each(["DrawerPanelFluting", "SidePanels", "CountertopColor", "Thickness", "sinkType", "CountertopStyle"])(
    "does not call missing visual %s state-only",
    (id) => {
      expect(patch(id, "anything")).toMatchObject({ ok: false, reason: "unbound", detail: expect.any(String) });
      expect(findProductConfigBindingErrors(bindings, { [id]: "anything" })).toHaveLength(1);
    },
  );

  it("does not expand matte catalogs from the developer's gloss example or change preset defaults", () => {
    expect(patch("HandleGrooveColor", "Acqua 419 Lacquered GL")).toMatchObject({ ok: false });
    expect(tricotProfile.defaults).toMatchObject({
      CabinetColor: "Rovere Oro 932",
      DrawerPanelFluting: "Cannette",
      HandleGrooveColor: "Nero 433 MT",
      sinkType: "LB440",
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
