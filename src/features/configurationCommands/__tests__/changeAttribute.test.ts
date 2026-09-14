import { beforeEach, describe, expect, it } from "vitest";

import { store } from "@/app/store";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import type { ProductProfile } from "@/entities/collection";
import {
  getAttributeValue,
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
  setHandleGrooveColor,
  setSelectedProductConfig,
} from "@/entities/product/model/store/slice";

import { changeAttribute } from "../lib/changeAttribute";
import type { ChangeAttributeDeps } from "../lib/changeAttribute";
import { confirmAttributeChange } from "../lib/confirmAttributeChange";
import { createTestRuntimePort } from "@/features/playCanvasAdapter";
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

    const result = await confirmAttributeChange(asked.preview, deps);

    expect(result).toMatchObject({ status: "partial", needsSync: true });
    if (result.status !== "partial") return;

    expect(result.failed[0].change.attributeId).toBe("Height");

    // The rejected change is not written by the command service.
    expect(dispatched).not.toContain("product/setSelectedDimensions");
    // What the scene did apply is recorded.
    expect(dispatched).toContain("product/setSelectedProductConfig");
    expect(store.getState().rootStateUI.product.selectedProductConfig?.Handle).toBe("handle_pto");

    // Known gap, owned by C06: `setSelectedProductConfig` re-runs the rules inside the
    // reducer and derives the forced height on its own, so the value still converges even
    // though the runtime refused it. Until rule evaluation moves out of the reducers,
    // `needsSync` is the only signal that state and scene may disagree.
    expect(store.getState().rootStateUI.product.selectedDimensions.height).toBe(50);
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
