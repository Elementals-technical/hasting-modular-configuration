import { describe, expect, it } from "vitest";

import { parseProductProfile } from "../lib/parseProductProfile";
import ushProfile from "../../../../public/collections/urban-standard-height/product-profile.json";
import configurator4 from "./fixtures/remote/configurator-4.json";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

describe("parseProductProfile", () => {
  it("reads when a change waits for confirmation and rejects an unknown condition", () => {
    const result = parseProductProfile(ushProfile);
    if (!result.ok) throw new Error("fixture must parse");

    expect(result.profile.attributes.find(({ attributeId }) => attributeId === "Handle")?.confirmation).toEqual({
      when: "cabinetsPlaced",
      reasonCode: "handle.appliesToAllCabinets",
    });

    const broken = clone(ushProfile) as { attributes: { attributeId: string; confirmation?: unknown }[] };
    const handle = broken.attributes.find(({ attributeId }) => attributeId === "Handle");
    if (handle) handle.confirmation = { when: "always", reasonCode: "handle.appliesToAllCabinets" };

    const rejected = parseProductProfile(broken);

    expect(rejected.ok).toBe(false);
    expect(rejected.ok ? [] : rejected.diagnostics.map(({ dataPath }) => dataPath)).toContain(
      "/attributes/Handle/confirmation",
    );
  });

  it("accepts the USH profile and keeps catalog order", () => {
    const result = parseProductProfile(ushProfile);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.profile.collectionId).toBe("urban-standard-height");
    expect(result.profile.sourceRefs).toEqual({
      configuratorId: 4,
      countertopMatrixTableId: 438,
      cabinetMatrixTableId: 439,
    });

    const handles = result.profile.attributes.find((attribute) => attribute.attributeId === "Handle");
    expect(handles?.options?.map((option) => option.value)).toEqual([
      "handle_pto",
      "handle_urban_topcut",
      "handle_urban_botcut",
    ]);

    const cabinetTypes = result.profile.attributes.find((attribute) => attribute.attributeId === "CabinetType");
    expect(cabinetTypes?.options).toHaveLength(5);

    const drawers = result.profile.attributes.find((attribute) => attribute.attributeId === "Drawers");
    expect(drawers?.options?.map((option) => option.value)).toEqual(["1", "2", "1+inner"]);
  });

  it("keeps the initial value and the computed fallback separate", () => {
    const result = parseProductProfile(ushProfile);
    if (!result.ok) throw new Error("fixture must parse");

    const handle = result.profile.attributes.find((attribute) => attribute.attributeId === "Handle");

    expect(handle?.initialValue).toBe("");
    expect(handle?.effectiveFallbackValue).toBe("handle_urban_topcut");
  });

  it("reports a duplicate option with its exact data path", () => {
    const raw = clone(ushProfile) as Record<string, unknown>;
    const attributes = raw.attributes as { attributeId: string; options?: unknown[] }[];
    const handle = attributes.find((attribute) => attribute.attributeId === "Handle");
    handle?.options?.push({ value: "handle_pto", label: "Duplicate", order: 40 });

    const result = parseProductProfile(raw);

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.diagnostics).toContainEqual({
      code: "attribute.duplicate_option",
      dataPath: "/attributes/Handle/options/3/value",
      message: 'duplicate option value "handle_pto" in this attribute',
    });
  });

  it("rejects a fallback value that is not in the catalog", () => {
    const raw = clone(ushProfile) as Record<string, unknown>;
    const attributes = raw.attributes as { attributeId: string; effectiveFallbackValue?: string }[];
    const handle = attributes.find((attribute) => attribute.attributeId === "Handle");
    if (handle) handle.effectiveFallbackValue = "handle_does_not_exist";

    const result = parseProductProfile(raw);

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.diagnostics).toContainEqual({
      code: "attribute.value_outside_catalog",
      dataPath: "/attributes/Handle/effectiveFallbackValue",
      message: 'effectiveFallbackValue "handle_does_not_exist" is not present in the option catalog',
    });
  });

  it("rejects an unknown scope", () => {
    const raw = clone(ushProfile) as Record<string, unknown>;
    const attributes = raw.attributes as { attributeId: string; scope: string }[];
    const handle = attributes.find((attribute) => attribute.attributeId === "Handle");
    if (handle) handle.scope = "wardrobe";

    const result = parseProductProfile(raw);

    expect(result.ok).toBe(false);
    if (result.ok) return;

    const diagnostic = result.diagnostics.find((entry) => entry.code === "attribute.invalid_scope");
    expect(diagnostic?.dataPath).toBe("/attributes/Handle/scope");
  });

  it("turns malformed JSON into a diagnostic instead of throwing", () => {
    const result = parseProductProfile("{ not json");

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.diagnostics[0].code).toBe("profile.invalid_json");
    expect(result.diagnostics[0].dataPath).toBe("/");
  });

  it("declares the colours with the configurator section their options come from", () => {
    const result = parseProductProfile(ushProfile);
    if (!result.ok) throw new Error("fixture must parse");

    const proxyNames = new Set(
      Array.from(JSON.stringify(configurator4).matchAll(/"proxyName":"([^"]*)"/g), (match) => match[1]),
    );

    for (const [attributeId, scope, section] of [
      ["CabinetColor", "global", "Cabinet Color"],
      ["CountertopColor", "countertop", "Countertop Color"],
      ["VesselColor", "basin", "Vessels"],
      ["TowelBarColor", "global", "Towel Bar Color"],
    ]) {
      const attribute = result.profile.attributes.find((entry) => entry.attributeId === attributeId);

      expect(attribute, attributeId).toMatchObject({ scope, optionsSource: `configurator:${section}` });
      expect(attribute?.options, attributeId).toBeUndefined();
      expect(proxyNames.has(section), section).toBe(true);
    }
  });

  it("reads the rule sections of the USH profile", () => {
    const result = parseProductProfile(ushProfile);
    if (!result.ok) throw new Error("fixture must parse");

    const { ruleData } = result.profile;

    expect(ruleData.fluting?.eligibleMaterialAliases).toContain("LACM");
    expect(ruleData.grainDirection?.excludedFinishesByMaterial.HPL).toEqual(["TKP", "TKQ", "TKN"]);
    expect(ruleData.bookMatching?.horizontalMinimumAdjacentDrawerCabinets).toBe(2);
    expect(ruleData.sidePanels?.availability).toHaveLength(6);
    expect(ruleData.syntesi?.maxCabinetCount).toBe(1);
    expect(ruleData.countertopFallbacks?.restrictedIntegratedDepthsCm).toEqual([46]);
    expect(ruleData.materialNormalization?.aliases.tekormud).toEqual(["tekorund", "sstm"]);
  });

  it("accepts a profile without an optional rule section and leaves it out", () => {
    const raw = clone(ushProfile) as { ruleData: Record<string, unknown> };
    delete raw.ruleData.fluting;

    const result = parseProductProfile(raw);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect("fluting" in result.profile.ruleData).toBe(false);
  });

  it("reports every broken field of a rule section with its data path", () => {
    const raw = clone(ushProfile) as { ruleData: { sidePanels: Record<string, unknown> } };
    raw.ruleData.sidePanels.exactBlockedCabinetLengthCm = "340";
    raw.ruleData.sidePanels.availability = [{ height: "53H", handleType: "1D", cabinetType: "SBSC" }];

    const result = parseProductProfile(raw);

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.diagnostics).toEqual([
      {
        code: "ruleData.invalid_section",
        dataPath: "/ruleData/sidePanels/exactBlockedCabinetLengthCm",
        message: "exactBlockedCabinetLengthCm must be a finite number",
      },
      {
        code: "ruleData.invalid_section",
        dataPath: "/ruleData/sidePanels/availability",
        message: "availability must be an array of { height, handleType, cabinetType, allowed }",
      },
    ]);
  });

  it("rejects a rule section that is not an object", () => {
    const raw = clone(ushProfile) as { ruleData: Record<string, unknown> };
    raw.ruleData.fluting = ["LACM"];

    const result = parseProductProfile(raw);

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.diagnostics).toContainEqual({
      code: "ruleData.invalid_section",
      dataPath: "/ruleData/fluting",
      message: "fluting must be an object",
    });
  });

  it("reads the Drag & Drop section and rejects a flag that is not a boolean", () => {
    const raw = clone(ushProfile) as { ruleData: Record<string, unknown> };
    raw.ruleData.dragDrop = { enabled: true };

    const result = parseProductProfile(raw);
    if (!result.ok) throw new Error("a profile with Drag & Drop must parse");
    expect(result.profile.ruleData.dragDrop).toEqual({ enabled: true });

    raw.ruleData.dragDrop = { enabled: "yes" };
    const rejected = parseProductProfile(raw);

    expect(rejected.ok).toBe(false);
    expect(rejected.ok ? [] : rejected.diagnostics).toContainEqual({
      code: "ruleData.invalid_section",
      dataPath: "/ruleData/dragDrop/enabled",
      message: "enabled must be a boolean",
    });
  });

  it("keeps the countertop capabilities a Thickness option declares and rejects one that is not a boolean", () => {
    const raw = clone(ushProfile) as { attributes: { attributeId: string; options?: Record<string, unknown>[] }[] };
    const thickness = raw.attributes.find(({ attributeId }) => attributeId === "Thickness");
    const lifting = thickness?.options?.find(({ value }) => value === "5.125");
    if (!thickness?.options || !lifting) throw new Error("the USH profile must list a 5.125 thickness");
    lifting.capabilities = { countertopSlides: true, countertopLifts: true };

    const result = parseProductProfile(raw);
    if (!result.ok) throw new Error("a profile with countertop capabilities must parse");
    const options = result.profile.attributes.find(({ attributeId }) => attributeId === "Thickness")?.options ?? [];
    expect(options.find(({ value }) => value === "5.125")?.capabilities).toEqual({
      supportsGrooveColor: false,
      countertopSlides: true,
      countertopLifts: true,
    });
    expect(options.find(({ value }) => value === "4")?.capabilities).toBeUndefined();

    lifting.capabilities = { countertopLifts: "yes" };
    const rejected = parseProductProfile(raw);

    expect(rejected.ok).toBe(false);
    expect(rejected.ok ? [] : rejected.diagnostics).toContainEqual({
      code: "profile.invalid_field_type",
      dataPath: `/attributes/Thickness/options/${thickness.options.indexOf(lifting)}/capabilities/countertopLifts`,
      message: "countertopLifts must be a boolean",
    });
  });

  it("reads drawer style groups and rejects a malformed one", () => {
    const raw = clone(ushProfile) as { ruleData: Record<string, unknown> };
    raw.ruleData.drawerStyleGroups = [["1", "1+inner"], ["2"]];

    const accepted = parseProductProfile(raw);
    expect(accepted.ok ? accepted.profile.ruleData.drawerStyleGroups : null).toEqual([["1", "1+inner"], ["2"]]);

    raw.ruleData.drawerStyleGroups = [["1"], []];
    const rejected = parseProductProfile(raw);

    expect(rejected.ok ? [] : rejected.diagnostics).toContainEqual({
      code: "ruleData.invalid_section",
      dataPath: "/ruleData/drawerStyleGroups",
      message: "drawerStyleGroups must be an array of non-empty string arrays",
    });
  });

  it("reads a field's own price tiers and rejects a tier out of 1-4 or a SKU code in lower case", () => {
    const raw = clone(ushProfile) as { ruleData: Record<string, unknown> };
    raw.ruleData.priceTiers = { byAttribute: { CabinetColor: { LACM: 1, WDV: 2 } } };

    const accepted = parseProductProfile(raw);
    expect(accepted.ok ? accepted.profile.ruleData.priceTiers : null).toEqual({
      byAttribute: { CabinetColor: { LACM: 1, WDV: 2 } },
    });

    for (const broken of [{ CabinetColor: { WDV: 5 } }, { CabinetColor: { WDV: 1.5 } }, { CabinetColor: { wdv: 2 } }]) {
      raw.ruleData.priceTiers = { byAttribute: broken };
      const rejected = parseProductProfile(raw);
      expect(rejected.ok ? [] : rejected.diagnostics).toContainEqual({
        code: "ruleData.invalid_section",
        dataPath: "/ruleData/priceTiers/byAttribute",
        message: "byAttribute must be a map of field id to { upper-case SKU material code: tier 1-4 }",
      });
    }
  });

  it("reports a missing legacy adapter column mapping", () => {
    const raw = clone(ushProfile) as Record<string, unknown>;
    const ruleData = raw.ruleData as Record<string, { columns: Record<string, unknown> }>;
    delete ruleData.cabinetMatrixLegacyAdapter.columns.handlesAllowed;

    const result = parseProductProfile(raw);

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.diagnostics).toContainEqual({
      code: "adapter.missing_column",
      dataPath: "/ruleData/cabinetMatrixLegacyAdapter/columns/handlesAllowed",
      message: 'column mapping "handlesAllowed" is required',
    });
  });

  it("reads the one-column-for-all-handles mappings and rejects an empty one", () => {
    const raw = clone(ushProfile) as Record<string, unknown>;
    const ruleData = raw.ruleData as Record<string, { columns: Record<string, unknown> }>;
    ruleData.cabinetMatrixLegacyAdapter.columns.forcedHeight = "forced_height_cm";
    ruleData.cabinetMatrixLegacyAdapter.columns.handleDrawerConfigs = "handle_drawer_configs";

    const result = parseProductProfile(raw);
    expect(result.ok && result.profile.ruleData.cabinetMatrixLegacyAdapter.columns).toMatchObject({
      forcedHeight: "forced_height_cm",
      handleDrawerConfigs: "handle_drawer_configs",
    });

    ruleData.cabinetMatrixLegacyAdapter.columns.forcedHeight = "";
    const rejected = parseProductProfile(raw);
    expect(rejected.ok ? [] : rejected.diagnostics).toContainEqual({
      code: "adapter.missing_column",
      dataPath: "/ruleData/cabinetMatrixLegacyAdapter/columns/forcedHeight",
      message: 'column mapping "forcedHeight" must be a column name',
    });
  });

  it("reads the heights drawers come in and rejects an entry without heights", () => {
    const raw = clone(ushProfile) as Record<string, unknown>;
    const ruleData = raw.ruleData as Record<string, Record<string, unknown>>;
    ruleData.cabinetMatrixLegacyAdapter.heightsByDrawers = { "1": [53, 38, 28] };

    const result = parseProductProfile(raw);
    expect(result.ok && result.profile.ruleData.cabinetMatrixLegacyAdapter.heightsByDrawers).toEqual({
      "1": [53, 38, 28],
    });
    // Absent in a collection whose table says every height.
    const plain = parseProductProfile(ushProfile);
    expect(plain.ok && "heightsByDrawers" in plain.profile.ruleData.cabinetMatrixLegacyAdapter).toBe(false);

    for (const broken of [{ "1": [] }, { "1": [53, 0] }, { "1": "53|38" }, [53, 38]]) {
      ruleData.cabinetMatrixLegacyAdapter.heightsByDrawers = broken;
      const rejected = parseProductProfile(raw);
      expect(rejected.ok ? [] : rejected.diagnostics).toContainEqual({
        code: "ruleData.invalid_section",
        dataPath: "/ruleData/cabinetMatrixLegacyAdapter/heightsByDrawers",
        message: "heightsByDrawers must map a drawers value to a non-empty list of heights in cm",
      });
    }
  });

  it("reads the cabinets other series supply and rejects a module without widths or heights", () => {
    const raw = clone(ushProfile) as Record<string, unknown>;
    const ruleData = raw.ruleData as Record<string, unknown>;
    const modules = [
      { series: "URSTD", cabinetType: "Sink-Cabinet", widthsCm: [25, 60], heightsByDrawers: { "2": [56], "1": [53] } },
      { series: "URLH", cabinetType: "Sink-Cabinet", widthsCm: [25], heightsByDrawers: { "1": [38, 28] } },
    ];
    ruleData.seriesModules = modules;

    const result = parseProductProfile(raw);
    expect(result.ok && result.profile.ruleData.seriesModules).toEqual(modules);
    // Absent in a collection that places its own cabinets only.
    const plain = parseProductProfile(ushProfile);
    expect(plain.ok && plain.profile.ruleData.seriesModules).toBeUndefined();

    for (const broken of [
      [],
      "URSTD",
      [{ ...modules[0], series: "" }],
      [{ ...modules[0], widthsCm: [] }],
      [{ ...modules[0], widthsCm: [25, 0] }],
      [{ ...modules[0], heightsByDrawers: {} }],
      [{ ...modules[0], heightsByDrawers: { "2": [] } }],
      // One variant of a cabinet type per series.
      [modules[0], modules[0]],
    ]) {
      ruleData.seriesModules = broken;
      const rejected = parseProductProfile(raw);
      expect(rejected.ok ? [] : rejected.diagnostics).toContainEqual({
        code: "ruleData.invalid_section",
        dataPath: "/ruleData/seriesModules",
        message:
          "seriesModules must list, once per series and cabinet type, positive widths and the heights of each drawer style",
      });
    }
  });
});
