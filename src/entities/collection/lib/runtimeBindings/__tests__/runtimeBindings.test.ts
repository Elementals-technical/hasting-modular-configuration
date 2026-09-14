import { describe, expect, it } from "vitest";

import { CORE_ATTRIBUTE_IDS } from "@/entities/configuration/model/ownership";
import { validateCustomizationSchema } from "@/features/collectionCustomization";

import ushUiDocument from "../../../../../../public/collections/urban-standard-height/ui.json";

import { normalizeOptionValue } from "../../productProfileSelectors";
import { findMissingBindings, resolveRuntimeBinding } from "../resolveRuntimeBinding";
import { validateRuntimeBindings } from "../validateRuntimeBindings";
import type { ProductProfile } from "../../../model/productProfile";
import type { RuntimeBindingSet } from "../../../model/runtimeBindings";

import { ushProfile } from "../../../__tests__/ushProfileFixture";
import { ushRuntimeBindings } from "./ushRuntimeBindingsFixture";

/** Every field of the USH UI description (B's ui.json). */
const USH_UI_FIELD_IDS = (() => {
  const result = validateCustomizationSchema(ushUiDocument);
  if (!result.ok) throw new Error("Packaged USH ui.json failed validation");

  return Object.values(result.schema.sections).flatMap(({ fields }) => fields.map(({ attributeId }) => attributeId));
})();

// Attributes that need a scene decision: what the UI lets the user change, and what C's
// commands can send without a field of their own — the C01 registry plus the dimensions,
// which C plans as dependencies (a handle change carries Height) and the registry does
// not list yet.
const REQUIRED_ATTRIBUTE_IDS = [...new Set([...USH_UI_FIELD_IDS, ...CORE_ATTRIBUTE_IDS, "Height", "Width", "Depth"])];

describe("resolveRuntimeBinding", () => {
  it("translates a renamed value for the addressed cabinet", () => {
    expect(resolveRuntimeBinding(ushRuntimeBindings, "Drawers", "2")).toEqual({
      ok: true,
      attributeId: "Drawers",
      target: { kind: "product" },
      patch: { Drawers: "2D" },
      order: 10,
    });
    expect(resolveRuntimeBinding(ushRuntimeBindings, "Drawers", "1+inner")).toMatchObject({
      patch: { Drawers: "1DWID" },
    });
  });

  it("reports a value the table does not know instead of sending it", () => {
    expect(resolveRuntimeBinding(ushRuntimeBindings, "Drawers", "3")).toEqual({
      ok: false,
      attributeId: "Drawers",
      value: "3",
      reason: "unknown-value",
    });
    // The scene spelling is not a semantic value; it must not pass through a second time.
    expect(resolveRuntimeBinding(ushRuntimeBindings, "Drawers", "1D")).toMatchObject({ reason: "unknown-value" });
    expect(resolveRuntimeBinding(ushRuntimeBindings, "Drawers", "toString")).toMatchObject({
      reason: "unknown-value",
    });
  });

  it("sends an identity value unchanged", () => {
    expect(resolveRuntimeBinding(ushRuntimeBindings, "Handle", "handle_pto")).toMatchObject({
      ok: true,
      patch: { Handle: "handle_pto" },
    });
  });

  it("sends the declared empty value for a cleared groove color", () => {
    expect(resolveRuntimeBinding(ushRuntimeBindings, "HandleGrooveColor", "")).toMatchObject({
      patch: { HandleGrooveColor: "None" },
    });
    expect(resolveRuntimeBinding(ushRuntimeBindings, "HandleGrooveColor", null)).toMatchObject({
      patch: { HandleGrooveColor: "None" },
    });
    expect(resolveRuntimeBinding(ushRuntimeBindings, "HandleGrooveColor", "Black")).toMatchObject({
      patch: { HandleGrooveColor: "Black" },
    });
  });

  it("turns one option into several scene keys", () => {
    expect(resolveRuntimeBinding(ushRuntimeBindings, "TowelBarOption", "Left")).toEqual({
      ok: true,
      attributeId: "TowelBarOption",
      target: { kind: "all" },
      patch: { TowelBar: "TowelBar40_R", TowelBarSide: "left" },
      order: 70,
      resetBefore: { TowelBar: "None", TowelBarSide: "both" },
    });
    expect(resolveRuntimeBinding(ushRuntimeBindings, "TowelBarOption", "None")).toMatchObject({
      patch: { TowelBar: "None", TowelBarSide: "both" },
    });
  });

  it("hands out a copy, so a caller cannot edit the table", () => {
    const resolution = resolveRuntimeBinding(ushRuntimeBindings, "Drawers", "1");
    if (!resolution.ok) throw new Error("Drawers=1 must resolve");

    resolution.patch.Drawers = "changed";

    expect(resolveRuntimeBinding(ushRuntimeBindings, "Drawers", "1")).toMatchObject({ patch: { Drawers: "1D" } });
  });

  it("tells a missing entry from a declared unbound one", () => {
    expect(resolveRuntimeBinding(ushRuntimeBindings, "UnknownAttribute", "x")).toMatchObject({
      ok: false,
      reason: "no-binding",
    });
    expect(resolveRuntimeBinding(ushRuntimeBindings, "LedOption", "Auto Fill")).toMatchObject({
      ok: false,
      reason: "unbound",
      detail: expect.any(String),
    });
  });

  it("binds an attribute to a scene key with a different name", () => {
    // fixture-ui: the attribute name alone says nothing about the scene key.
    const fixtureUi: RuntimeBindingSet = {
      schemaVersion: 1,
      collectionId: "fixture-ui",
      productTypes: {},
      bindings: [
        {
          attributeId: "TestGrooveFinish",
          status: "bound",
          target: { kind: "all" },
          values: { kind: "identity", sceneKey: "HandleGrooveColor" },
        },
      ],
    };

    expect(resolveRuntimeBinding(fixtureUi, "TestGrooveFinish", "Walnut")).toMatchObject({
      patch: { HandleGrooveColor: "Walnut" },
    });
    expect(resolveRuntimeBinding(fixtureUi, "HandleGrooveColor", "Walnut")).toMatchObject({ reason: "no-binding" });
  });

  it("broadcasts the height, since a per-product call does not apply it", () => {
    expect(resolveRuntimeBinding(ushRuntimeBindings, "Height", 56)).toEqual({
      ok: true,
      attributeId: "Height",
      target: { kind: "all" },
      patch: { Height: 56 },
      order: 30,
    });
  });

  it("addresses the vessel color to every sink base", () => {
    expect(resolveRuntimeBinding(ushRuntimeBindings, "VesselColor", "Matte White")).toMatchObject({
      target: { kind: "productType", productType: "Sink-Base" },
      patch: { VesselColor: "Matte White" },
    });
  });

  it("paints every product in prebuilt and only the cabinets in custom", () => {
    expect(resolveRuntimeBinding(ushRuntimeBindings, "GrainDirection", "GrainVertical", "prebuilt")).toMatchObject({
      target: { kind: "all" },
      patch: { GrainDirection: "GrainVertical" },
    });
    expect(resolveRuntimeBinding(ushRuntimeBindings, "DrawerPanelFluting", "FlutingVerticalA", "custom")).toMatchObject(
      {
        target: { kind: "cabinets" },
        patch: { DrawerPanelFluting: "FlutingVerticalA" },
      },
    );
  });

  it("refuses a flow-dependent target without a flow instead of guessing one", () => {
    expect(resolveRuntimeBinding(ushRuntimeBindings, "GrainDirection", "GrainVertical")).toMatchObject({
      ok: false,
      reason: "flow-required",
    });
    expect(
      findMissingBindings(ushRuntimeBindings, [{ attributeId: "DrawerPanelFluting", value: "None" }], "custom"),
    ).toEqual([]);
  });

  it("sends the countertop style capitalized, as the scene receives it today", () => {
    expect(resolveRuntimeBinding(ushRuntimeBindings, "CountertopStyle", "vessel")).toMatchObject({
      target: { kind: "all" },
      patch: { CountertopStyle: "Vessel" },
    });
    expect(resolveRuntimeBinding(ushRuntimeBindings, "CountertopStyle", "integrated")).toMatchObject({
      patch: { CountertopStyle: "Integrated" },
    });
  });

  it("reaches the scene from the value state holds today", () => {
    // State stores "Vessel"; the profile alias turns it into the catalog value first.
    const value = normalizeOptionValue(ushProfile, "CountertopStyle", "Vessel");

    expect(value).toBe("vessel");
    expect(resolveRuntimeBinding(ushRuntimeBindings, "CountertopStyle", value)).toMatchObject({
      patch: { CountertopStyle: "Vessel" },
    });
  });

  it("sends a Syntesi countertop color under the Tekorlux name the scene knows", () => {
    expect(resolveRuntimeBinding(ushRuntimeBindings, "CountertopColor", "Bianco Gloss TAN")).toMatchObject({
      patch: { CountertopColor: "Bianco Gloss TAL" },
    });
    expect(resolveRuntimeBinding(ushRuntimeBindings, "CountertopColor", "Bianco Matte TAP")).toMatchObject({
      patch: { CountertopColor: "Bianco Matte TAM" },
    });
    expect(resolveRuntimeBinding(ushRuntimeBindings, "CountertopColor", "Cacao Orinoco FF MT")).toMatchObject({
      patch: { CountertopColor: "Cacao Orinoco FF MT" },
    });
  });

  it("sends the vessel placeholder when no basin is chosen", () => {
    expect(resolveRuntimeBinding(ushRuntimeBindings, "sinkType", "")).toMatchObject({ patch: { sinkType: "Vessel" } });
    expect(resolveRuntimeBinding(ushRuntimeBindings, "sinkType", "Vessel_Blade11")).toMatchObject({
      patch: { sinkType: "Vessel_Blade11" },
    });
  });
});

describe("findMissingBindings", () => {
  it("returns nothing when every change can be sent", () => {
    expect(
      findMissingBindings(ushRuntimeBindings, [
        { attributeId: "Drawers", value: "2" },
        { attributeId: "Handle", value: "handle_urban_topcut" },
      ]),
    ).toEqual([]);
  });

  it("reports every problem of the set, not only the first", () => {
    const missing = findMissingBindings(ushRuntimeBindings, [
      { attributeId: "Drawers", value: "3" },
      { attributeId: "Handle", value: "handle_pto" },
      { attributeId: "SidePanels", value: "UpperG" },
    ]);

    expect(missing.map(({ attributeId, reason }) => [attributeId, reason])).toEqual([
      ["Drawers", "unknown-value"],
      ["SidePanels", "unbound"],
    ]);
  });
});

describe("validateRuntimeBindings", () => {
  it("finds no gap between the USH profile and its bindings", () => {
    expect(validateRuntimeBindings(ushProfile, ushRuntimeBindings, REQUIRED_ATTRIBUTE_IDS)).toEqual([]);
  });

  it("has a scene decision for every field of the USH UI description", () => {
    const issues = validateRuntimeBindings(ushProfile, ushRuntimeBindings, USH_UI_FIELD_IDS);

    expect(issues.filter(({ code }) => code === "missing-binding")).toEqual([]);
  });

  it("finds a migrated attribute the profile does not list", () => {
    const set: RuntimeBindingSet = {
      ...ushRuntimeBindings,
      bindings: ushRuntimeBindings.bindings.filter(({ attributeId }) => attributeId !== "Height"),
    };

    expect(validateRuntimeBindings(ushProfile, set, REQUIRED_ATTRIBUTE_IDS)).toEqual([
      { code: "missing-binding", attributeId: "Height" },
    ]);
  });

  it("finds a cabinet type the scene cannot place", () => {
    const productTypes = Object.fromEntries(
      Object.entries(ushRuntimeBindings.productTypes).filter(([cabinetType]) => cabinetType !== "Side-Cabinet"),
    );

    expect(
      validateRuntimeBindings(ushProfile, { ...ushRuntimeBindings, productTypes }, REQUIRED_ATTRIBUTE_IDS),
    ).toEqual([{ code: "missing-product-type", attributeId: "CabinetType", value: "Side-Cabinet" }]);
  });

  it("finds a catalog option without a scene patch", () => {
    const profile: ProductProfile = {
      ...ushProfile,
      attributes: ushProfile.attributes.map((attribute) =>
        attribute.attributeId === "Drawers"
          ? { ...attribute, options: [...(attribute.options ?? []), { value: "3", label: "3", order: 99 }] }
          : attribute,
      ),
    };

    expect(validateRuntimeBindings(profile, ushRuntimeBindings, REQUIRED_ATTRIBUTE_IDS)).toEqual([
      { code: "missing-value", attributeId: "Drawers", value: "3" },
    ]);
  });

  it("finds an attribute nobody decided about", () => {
    const profile: ProductProfile = {
      ...ushProfile,
      attributes: [...ushProfile.attributes, { attributeId: "LegsStyle", scope: "cabinet" }],
    };

    expect(validateRuntimeBindings(profile, ushRuntimeBindings, REQUIRED_ATTRIBUTE_IDS)).toEqual([
      { code: "missing-binding", attributeId: "LegsStyle" },
    ]);
  });

  it("finds a leftover, a duplicate and a foreign binding set", () => {
    const set: RuntimeBindingSet = {
      schemaVersion: 1,
      collectionId: "another-collection",
      productTypes: ushRuntimeBindings.productTypes,
      bindings: [
        ...ushRuntimeBindings.bindings,
        { attributeId: "Handle", status: "unbound", reason: "duplicate" },
        { attributeId: "OldAttribute", status: "unbound", reason: "removed from the profile" },
      ],
    };

    expect(validateRuntimeBindings(ushProfile, set, REQUIRED_ATTRIBUTE_IDS)).toEqual([
      { code: "collection-mismatch" },
      { code: "duplicate-binding", attributeId: "Handle" },
      { code: "orphan-binding", attributeId: "OldAttribute" },
    ]);
  });
});
