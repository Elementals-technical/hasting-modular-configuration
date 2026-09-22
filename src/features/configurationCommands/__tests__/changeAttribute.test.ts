import { beforeEach, describe, expect, it } from "vitest";

import { store } from "@/app/store";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import { ushRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/ushRuntimeBindingsFixture";
import type { ProductProfile, ScenePatch } from "@/entities/collection";
import type { ProductOptionData } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";
import { buildCountertopStyleOptions } from "@/features/collectionCustomization";
import {
  getAttributeValue,
  getCabinetEntries,
  getRuntimeSyncState,
  resetConfiguration,
  setActiveCollectionId,
  syncCabinets,
} from "@/entities/configuration";
import type { ProductDatatable } from "@/entities/product/api";
import { buildCabinetCatalogFromMatrix } from "@/entities/product/lib/matrixCabinet";
import {
  reset,
  setActiveCabinetType,
  setActiveProfile,
  setCabinetCatalog,
  setCabinetColorMaterial,
  setHandleGrooveColor,
  setPlacedCabinetStyle,
  setSelectedProductConfig,
  setTowelBarColor,
} from "@/entities/product/model/store/slice";

import { changeAttribute } from "../lib/changeAttribute";
import type { ChangeAttributeDeps } from "../lib/changeAttribute";
import { confirmAttributeChange } from "../lib/confirmAttributeChange";
import { createPlayCanvasRuntimePort, createTestRuntimePort } from "@/features/playCanvasAdapter";
import type { TestRuntimePort } from "@/features/playCanvasAdapter";
import type { AttributeChange } from "../model/types";

const profile = ushProfile;

const matrix = {
  rows: [
    {
      cabinet_type: "Sink-Base",
      widths_cm: "60|80",
      depths_cm: "46",
      heights_cm: "50|53|56",
      drawer_configs: "1D|2D",
      handles_allowed: "handle_pto|handle_urban_topcut|handle_urban_botcut",
      supports_height: "50|53|56",
      handle_pto_forced_height_cm: "1D:50|2D:50",
      handle_urban_topcut_forced_height_cm: "1D:53|2D:56",
      handle_urban_botcut_forced_height_cm: "2D:56",
      handle_urban_botcut_requires_drawers: "2D",
    },
  ],
} as unknown as ProductDatatable;

/** Runs a change and confirms it when the profile asks, as a user clicking Confirm would. */
const runChange = async (change: AttributeChange, runtime = createTestRuntimePort()) => {
  const deps: ChangeAttributeDeps = {
    getState: () => store.getState(),
    dispatch: (action) => store.dispatch(action),
    runtime: runtime.port,
    flow: "custom",
  };
  const result = await changeAttribute(change, deps);

  return result.status === "confirmation-required" ? confirmAttributeChange(result.preview, deps) : result;
};

const setUpScene = () => {
  store.dispatch(reset());
  store.dispatch(resetConfiguration());
  store.dispatch(setActiveProfile(profile));
  store.dispatch(setActiveCollectionId("urban-standard-height"));
  store.dispatch(setCabinetCatalog(buildCabinetCatalogFromMatrix(matrix, profile)));
  store.dispatch(setActiveCabinetType("Sink-Base"));
  store.dispatch(setSelectedProductConfig({ Drawers: "1D", Handle: "handle_urban_topcut" }));
  store.dispatch(syncCabinets(["runtime-a", "runtime-b"]));
};

describe("changeAttribute", () => {
  beforeEach(setUpScene);

  it("applies an allowed change and hands the set to the runtime", async () => {
    const runtime = createTestRuntimePort();

    const result = await runChange(
      { attributeId: "Handle", value: "handle_pto", scope: "cabinet", cabinetId: "cab-1" },
      runtime,
    );

    expect(result.status).toBe("applied");
    expect(runtime.calls).toHaveLength(1);
    expect(runtime.calls[0][0]).toMatchObject({ attributeId: "Handle", value: "handle_pto" });
    expect(store.getState().rootStateUI.product.selectedProductConfig?.Handle).toBe("handle_pto");
  });

  it("translates the stable key to the runtime id for the scene", async () => {
    const runtime = createTestRuntimePort();

    await runChange(
      { attributeId: "Handle", value: "handle_pto", scope: "cabinet", cabinetId: "cab-2" },
      runtime,
    );

    expect(runtime.resolvedIds[0][0]).toBe("runtime-b");
  });

  it("hands the runtime the collection, the flow and the placed cabinets", async () => {
    const runtime = createTestRuntimePort();

    await runChange(
      { attributeId: "Handle", value: "handle_pto", scope: "cabinet", cabinetId: "cab-1" },
      runtime,
    );

    expect(runtime.contexts[0]).toMatchObject({
      collectionId: "urban-standard-height",
      flow: "custom",
      cabinetRuntimeIds: ["runtime-a", "runtime-b"],
    });
  });

  it.each([
    ["not ready", "runtime-not-ready", (runtime: TestRuntimePort) => runtime.setReady(false)],
    ["unsupported", "runtime-unsupported", (runtime: TestRuntimePort) => runtime.rejectNext(() => true)],
    ["failing on the first command", "runtime-failed", (runtime: TestRuntimePort) => runtime.failNext(() => true)],
  ])("records nothing when the scene is %s", async (_label, code, arrange) => {
    const runtime = createTestRuntimePort();
    arrange(runtime);

    const result = await runChange(
      { attributeId: "Handle", value: "handle_pto", scope: "cabinet", cabinetId: "cab-1" },
      runtime,
    );

    expect(result).toMatchObject({ status: "error", code });
    expect(store.getState().rootStateUI.product.selectedProductConfig?.Handle).toBe("handle_urban_topcut");
  });

  it("carries the dependent height in the same set", async () => {
    const runtime = createTestRuntimePort();

    await runChange(
      { attributeId: "Handle", value: "handle_pto", scope: "cabinet", cabinetId: "cab-1" },
      runtime,
    );

    expect(runtime.calls[0]).toContainEqual(
      expect.objectContaining({ attributeId: "Height", value: 50, origin: "dependency" }),
    );
    expect(store.getState().rootStateUI.product.selectedDimensions.height).toBe(50);
  });

  it("clears the groove colour by capability, not by handle id", async () => {
    store.dispatch(setHandleGrooveColor("Pulpis Chiaro TKH"));

    await runChange({ attributeId: "Handle", value: "handle_pto", scope: "cabinet", cabinetId: "cab-1" });

    expect(store.getState().rootStateUI.product.productOptions.HandleGrooveColor).toBe("");
    expect(store.getState().rootStateUI.product.productOptions.HandleGrooveColorSku).toBe("");
  });

  it("blocks a change the rules disallow and never calls the runtime", async () => {
    const runtime = createTestRuntimePort();

    const result = await runChange(
      { attributeId: "Handle", value: "handle_urban_botcut", scope: "cabinet", cabinetId: "cab-1" },
      runtime,
    );

    expect(result).toMatchObject({ status: "blocked", attributeId: "Handle" });
    expect(runtime.calls).toHaveLength(0);
    expect(store.getState().rootStateUI.product.selectedProductConfig?.Handle).toBe("handle_urban_topcut");
  });

  it("errors on a cabinet that does not exist", async () => {
    const runtime = createTestRuntimePort();

    const result = await runChange(
      { attributeId: "Handle", value: "handle_pto", scope: "cabinet", cabinetId: "cab-99" },
      runtime,
    );

    expect(result).toMatchObject({ status: "error", code: "unknown-target" });
    expect(runtime.calls).toHaveLength(0);
  });

  it("errors on a value addressed at the wrong scope", async () => {
    const result = await runChange({
      attributeId: "Handle",
      value: "handle_pto",
      scope: "global",
    } as AttributeChange);

    expect(result).toMatchObject({ status: "error", code: "scope-mismatch" });
  });

  it("reports a partial result and asks for sync when the runtime rejects part of the set", async () => {
    const runtime = createTestRuntimePort();
    runtime.failNext((change) => change.attributeId === "Height", "scene refused the height");

    const dispatched: string[] = [];

    const deps: ChangeAttributeDeps = {
      getState: () => store.getState(),
      dispatch: (action) => {
        dispatched.push(action.type);
        return store.dispatch(action);
      },
      runtime: runtime.port,
      flow: "custom",
    };

    const asked = await changeAttribute(
      { attributeId: "Handle", value: "handle_pto", scope: "cabinet", cabinetId: "cab-1" },
      deps,
    );
    if (asked.status !== "confirmation-required") throw new Error("a handle change with placed cabinets asks first");

    const heightBefore = store.getState().rootStateUI.product.selectedDimensions.height;

    const result = await confirmAttributeChange(asked.preview, deps);

    expect(result).toMatchObject({ status: "partial", needsSync: true });
    if (result.status !== "partial") return;

    expect(result.failed[0].change.attributeId).toBe("Height");

    // What the scene did apply is recorded.
    expect(dispatched).toContain("product/commitRuleSelection");
    expect(store.getState().rootStateUI.product.selectedProductConfig?.Handle).toBe("handle_pto");
    expect(getAttributeValue(store.getState(), "Handle", { scope: "cabinet", cabinetId: "cab-1" })).toBe("handle_pto");
    expect(getRuntimeSyncState(store.getState()).needsSync).toBe(true);

    // The refused height is not written, and the reducer does not derive it on its own:
    // the command is the only owner of the value (C06).
    expect(store.getState().rootStateUI.product.selectedDimensions.height).toBe(heightBefore);
  });

  it("stores an attribute that has no reducer field of its own", async () => {
    const extended: ProductProfile = {
      ...profile,
      attributes: [
        ...profile.attributes,
        {
          attributeId: "TestGrooveFinish",
          scope: "global",
          options: [
            { value: "None", label: "None", order: 10 },
            { value: "Matte", label: "Matte", order: 20 },
          ],
        },
      ],
    };
    store.dispatch(setActiveProfile(extended));

    const result = await runChange({ attributeId: "TestGrooveFinish", value: "Matte", scope: "global" });

    expect(result.status).toBe("applied");
    expect(getAttributeValue(store.getState(), "TestGrooveFinish", { scope: "global" })).toBe("Matte");
  });
});

describe("changeAttribute for values outside the rule selection", () => {
  beforeEach(setUpScene);

  const productOptions = () => store.getState().rootStateUI.product.productOptions;

  it("refuses fluting while the cabinet material does not allow it, and records it once allowed", async () => {
    store.dispatch(setCabinetColorMaterial("HPL"));
    const refusedRuntime = createTestRuntimePort();

    const refused = await runChange(
      { attributeId: "DrawerPanelFluting", value: "FlutingVerticalA", scope: "cabinet", cabinetId: "cab-1" },
      refusedRuntime,
    );

    expect(refused).toEqual({
      status: "blocked",
      attributeId: "DrawerPanelFluting",
      reasonCode: "fluting.notAvailable",
      reason: "Fluting is available only for Lacquer Matte (LACM).",
    });
    expect(refusedRuntime.calls).toHaveLength(0);

    store.dispatch(setCabinetColorMaterial("LACM"));
    const applied = await runChange({
      attributeId: "DrawerPanelFluting",
      value: "FlutingVerticalA",
      scope: "cabinet",
      cabinetId: "cab-1",
    });

    expect(applied.status).toBe("applied");
    expect(productOptions().DrawerPanelFluting).toBe("FlutingVerticalA");
    expect(
      getAttributeValue(store.getState(), "DrawerPanelFluting", { scope: "cabinet", cabinetId: "cab-1" }),
    ).toBe("FlutingVerticalA");
  });

  it("always allows clearing fluting", async () => {
    store.dispatch(setCabinetColorMaterial("HPL"));

    const result = await runChange({ attributeId: "DrawerPanelFluting", value: "None", scope: "cabinet", cabinetId: "cab-1" });

    expect(result.status).toBe("applied");
  });

  it("refuses a grain direction without an eligible material, and records it once eligible", async () => {
    const refused = await runChange({
      attributeId: "GrainDirection",
      value: "GrainVertical",
      scope: "cabinet",
      cabinetId: "cab-1",
    });

    expect(refused).toMatchObject({ status: "blocked", reasonCode: "grain.notAvailable" });

    store.dispatch(setCabinetColorMaterial("Essenze"));
    const applied = await runChange({
      attributeId: "GrainDirection",
      value: "GrainVertical",
      scope: "cabinet",
      cabinetId: "cab-1",
    });

    expect(applied.status).toBe("applied");
    expect(productOptions().GrainDirection).toBe("GrainVertical");
  });

  it("records the towel bar option and clears its colour when the towel bar is removed", async () => {
    await runChange({ attributeId: "TowelBarOption", value: "Left", scope: "global" });
    expect(productOptions().TowelBarOption).toBe("Left");

    store.dispatch(setTowelBarColor("Chrome"));
    const runtime = createTestRuntimePort();
    const result = await runChange({ attributeId: "TowelBarOption", value: "None", scope: "global" }, runtime);

    expect(result.status).toBe("applied");
    expect(runtime.calls[0].map(({ attributeId, value }) => [attributeId, value])).toEqual([
      ["TowelBarOption", "None"],
      ["TowelBarColor", ""],
    ]);
    expect(productOptions().TowelBarOption).toBe("None");
    expect(productOptions().TowelBarColor).toBe("");
  });

  it("records the thickness as the change carries it", async () => {
    const result = await runChange({ attributeId: "Thickness", value: "2.375", scope: "countertop" });

    expect(result.status).toBe("applied");
    expect(productOptions().Thickness).toBe("2.375");
  });
});

describe("changeAttribute for drawers", () => {
  const DRAWER_CABINETS = ["Sink-Base-60-a", "Sink-Base-80-b"];

  beforeEach(() => {
    setUpScene();
    store.dispatch(syncCabinets(DRAWER_CABINETS));
    DRAWER_CABINETS.forEach((id) => store.dispatch(setPlacedCabinetStyle({ id, value: "1" })));
  });

  it("switches every drawer cabinet and records the set in one rule pass", async () => {
    const runtime = createTestRuntimePort();
    const dispatched: string[] = [];
    const [first] = getCabinetEntries(store.getState());

    const result = await changeAttribute(
      { attributeId: "Drawers", value: "2", scope: "cabinet", cabinetId: first.stableKey },
      {
        getState: () => store.getState(),
        dispatch: (action) => {
          dispatched.push(action.type);
          return store.dispatch(action);
        },
        runtime: runtime.port,
        flow: "custom",
      },
    );

    expect(result.status).toBe("applied");
    expect(runtime.calls).toHaveLength(1);
    expect(runtime.calls[0].map(({ attributeId, value }) => [attributeId, value])).toEqual([
      ["Drawers", "2"],
      ["Drawers", "2"],
      ["Height", 56],
    ]);

    const product = store.getState().rootStateUI.product;
    expect(product.placedCabinetStyles).toEqual({ "Sink-Base-60-a": "2", "Sink-Base-80-b": "2" });
    expect(product.selectedProductConfig?.Drawers).toBe("2D");
    expect(product.selectedDimensions.height).toBe(56);
    expect(dispatched.filter((type) => type === "product/commitRuleSelection")).toHaveLength(1);
  });
});

describe("changeAttribute with a synthetic fourth handle", () => {
  beforeEach(setUpScene);

  const extendedProfile: ProductProfile = {
    ...profile,
    attributes: profile.attributes.map((attribute) =>
      attribute.attributeId === "Handle"
        ? {
            ...attribute,
            options: [
              ...(attribute.options ?? []),
              {
                value: "test_groove_handle",
                label: "Test Groove",
                order: 40,
                capabilities: { supportsGrooveColor: true },
              },
            ],
          }
        : attribute,
    ),
    ruleData: {
      cabinetMatrixLegacyAdapter: {
        ...profile.ruleData.cabinetMatrixLegacyAdapter,
        columns: {
          ...profile.ruleData.cabinetMatrixLegacyAdapter.columns,
          forcedHeightByHandle: {
            ...profile.ruleData.cabinetMatrixLegacyAdapter.columns.forcedHeightByHandle,
            test_groove_handle: "test_groove_handle_forced_height_cm",
          },
        },
      },
    },
  };

  const extendedMatrix = {
    rows: [
      {
        ...matrix.rows[0],
        handles_allowed: `${matrix.rows[0].handles_allowed}|test_groove_handle`,
        test_groove_handle_forced_height_cm: "1D:56|2D:56",
      },
    ],
  } as unknown as ProductDatatable;

  it("reaches the agreed set for I from fixture data alone", async () => {
    store.dispatch(setActiveProfile(extendedProfile));
    store.dispatch(setCabinetCatalog(buildCabinetCatalogFromMatrix(extendedMatrix, extendedProfile)));
    store.dispatch(setHandleGrooveColor("Pulpis Chiaro TKH"));

    const runtime = createTestRuntimePort();

    const result = await runChange(
      { attributeId: "Handle", value: "test_groove_handle", scope: "cabinet", cabinetId: "cab-1" },
      runtime,
    );

    expect(result.status).toBe("applied");
    expect(runtime.calls[0][0]).toMatchObject({ attributeId: "Handle", value: "test_groove_handle" });
    expect(runtime.calls[0]).toContainEqual(expect.objectContaining({ attributeId: "Height", value: 56 }));
    // Groove colour survives, because the capability decides — not a list of ids.
    expect(store.getState().rootStateUI.product.productOptions.HandleGrooveColor).toBe("Pulpis Chiaro TKH");
  });

  it("is rejected by a collection whose profile does not declare it", async () => {
    const result = await runChange({
      attributeId: "Handle",
      value: "test_groove_handle",
      scope: "cabinet",
      cabinetId: "cab-1",
    });

    expect(result).toMatchObject({ status: "blocked" });
  });
});

/**
 * The countertop step offers the styles its catalog builds from the profile, and the options
 * grid hands the command the value the picked card carries. The collection's value map is keyed
 * by the option value, so a catalog carrying only the label reached the scene as "unknown-value"
 * and the page's `status !== "applied"` guard dropped the click without a word.
 */
describe("changeAttribute for a value the collection maps for the scene", () => {
  const scenePatches: ScenePatch[] = [];

  const sceneRuntime = createPlayCanvasRuntimePort({
    getBindings: () => ushRuntimeBindings,
    scene: {
      isReady: () => true,
      async apply(_selector, patch) {
        scenePatches.push(patch);
        return { status: "applied", updatedIds: null };
      },
    },
  });

  /** What ProductOptionsGrid hands the command when a card is clicked. */
  const clickedValue = ({ title, name, metadata }: ProductOptionData) => metadata?.value ?? name ?? title;
  const clickedStyles = buildCountertopStyleOptions(profile).map((option) => [option.title, clickedValue(option)]);

  beforeEach(() => {
    scenePatches.length = 0;
  });

  it.each(clickedStyles)("applies the %s countertop style the page offers", async (_title, style) => {
    const result = await changeAttribute(
      { attributeId: "CountertopStyle", value: style, scope: "countertop" },
      {
        getState: () => store.getState(),
        dispatch: (action) => store.dispatch(action),
        runtime: sceneRuntime,
        flow: "prebuilt",
      },
    );

    expect(result.status).toBe("applied");
    expect(scenePatches).toHaveLength(1);
    expect(store.getState().rootStateUI.product.productOptions.CountertopStyle).toBe(style);
  });
});
