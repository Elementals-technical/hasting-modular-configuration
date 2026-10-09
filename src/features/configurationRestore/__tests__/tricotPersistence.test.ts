import { beforeEach, describe, expect, it, vi } from "vitest";
import { store } from "@/app/store";
import { tricotMatrixProfile, tricotTestBindings, tricotUi } from "@/entities/collection/__tests__/tricotFixtures";
import { resolveAttributeLabel } from "@/entities/collection/lib/customization/resolveAttributeLabel";
import {
  clearRestore,
  getAttributeValue,
  getCabinetEntries,
  getConfigurationSnapshot,
  getRuntimeSyncState,
  resetConfiguration,
  recordSceneState,
  setActiveCollectionId,
  setActiveRuntimeBindings,
  setAttributeValue,
} from "@/entities/configuration";
import type { ConfigurationRecord, SceneRestoreMatch } from "@/entities/configuration";
import { captureSnapshot } from "@/entities/history/lib/captureSnapshot";
import { restoreSnapshot } from "@/entities/history/lib/restoreSnapshot";
import { addProductId, reset, resetProducts, setActiveProfile } from "@/entities/product/model/store/slice";
import { changeAttribute } from "@/features/configurationCommands/lib/changeAttribute";
import { replayValues } from "@/features/configurationCommands/lib/replayValues";
import { createTestRuntimePort } from "@/features/playCanvasAdapter/lib/testRuntimePort";
import { createTestSceneRestorer } from "@/features/playCanvasAdapter/lib/testSceneRestorer";
import { restoreSidePanelState } from "@/features/sidePanel";
import { buildConfigurationMetadata } from "@/features/saveConfiguration/lib/buildConfigurationMetadata";
import { readConfigurationFragment } from "@/features/saveConfiguration/lib/legacyMetadata";
import { selectConfigurationSavePayload } from "@/features/saveConfiguration/lib/selectSavePayload";
import type { RestorePlan } from "../lib/buildRestorePlan";
import { restoreSavedConfiguration } from "../lib/restoreSavedConfiguration";

vi.mock("@/utils/functions/playcanvas/getOrderedProductIds", () => ({
  getOrderedProductIds: (ids: string[] = []) => ids,
}));
vi.mock("@/utils/functions/playcanvas/getConfig", () => ({
  getConfig: vi.fn(async (id: string) => ({
    ProductType: id.includes("-sc") ? "test-tricot-sc" : "test-tricot-sb",
    Width: 60,
    Height: 40,
    Depth: 52,
    Drawers: "1DW",
  })),
}));
vi.mock("@/utils/functions/playcanvas/setConfigBatch", () => ({
  setConfigBatch: vi.fn(async () => ({ updatedIds: [] })),
  runInBatchQueue: vi.fn(async (task: () => Promise<unknown>) => task()),
}));
vi.mock("@/features/sidePanel", async (original) => ({
  ...(await original<typeof import("@/features/sidePanel")>()),
  restoreSidePanelState: vi.fn(async () => undefined),
}));

const ids = ["test-tricot-sb-1", "test-tricot-sc-2"];
const setup = () => {
  store.dispatch(reset());
  store.dispatch(resetConfiguration());
  store.dispatch(clearRestore());
  store.dispatch(setActiveProfile(tricotMatrixProfile));
  store.dispatch(setActiveCollectionId("tricot"));
  store.dispatch(setActiveRuntimeBindings(tricotTestBindings));
};
beforeEach(() => {
  setup();
  vi.mocked(restoreSidePanelState).mockClear();
});

const givenChoices = async (flow: "prebuilt" | "custom") => {
  ids.forEach((id) => store.dispatch(addProductId(id)));
  store.dispatch(
    recordSceneState({
      order: ids,
      cabinets: ids.map((runtimeId) => ({ runtimeId, dimensions: { width: 60, height: 40, depth: 52 } })),
    }),
  );
  const runtime = createTestRuntimePort();
  const deps = { getState: store.getState, dispatch: store.dispatch, runtime: runtime.port, flow };
  expect(
    (await changeAttribute({ attributeId: "CountertopColor", scope: "countertop", value: "Matte White" }, deps)).status,
  ).toBe("applied");
  expect(
    (await changeAttribute({ attributeId: "CabinetColor", scope: "global", value: "Noce Canaletto 933" }, deps)).status,
  ).toBe("applied");
  for (const [index, cabinet] of getCabinetEntries(store.getState()).entries()) {
    expect(
      (
        await changeAttribute(
          {
            attributeId: "DrawerPanelFluting",
            scope: "cabinet",
            cabinetId: cabinet.stableKey,
            value: index ? "Satin" : "Twill",
          },
          deps,
        )
      ).status,
    ).toBe("applied");
  }
  // One groove colour for the composition, as its cabinet colour.
  expect(
    (await changeAttribute({ attributeId: "HandleGrooveColor", scope: "global", value: "Zafferano 412 MT" }, deps))
      .status,
  ).toBe("applied");
  expect((await changeAttribute({ attributeId: "SidePanels", scope: "global", value: "No" }, deps)).status).toBe(
    "applied",
  );
  return { deps, runtime };
};

describe("Tricot persistence and collection vocabulary", () => {
  it.each(["prebuilt", "custom"] as const)(
    "round-trips %s identity, order, separate patterns and the groove colour",
    async (flow) => {
      await givenChoices(flow);
      // Preserve unapproved top/basin selections as metadata, not as a claim of scene support.
      store.dispatch(
        setAttributeValue({ attributeId: "CountertopColor", target: { scope: "countertop" }, value: "Glass 403 MT" }),
      );
      store.dispatch(
        setAttributeValue({ attributeId: "sinkType", target: { scope: "basin", sinkBaseId: "cab-1" }, value: "VA005" }),
      );
      const before = getConfigurationSnapshot(store.getState());
      const { uiState, fragment } = selectConfigurationSavePayload(store.getState());
      const record: ConfigurationRecord = {
        configuration: Object.fromEntries(
          ids.map((id) => [
            id,
            {
              ProductType: id.includes("-sc") ? "test-tricot-sc" : "test-tricot-sb",
              Width: 60,
              Height: 40,
              Depth: 52,
              Drawers: "1DW",
            },
          ]),
        ),
        metadata: buildConfigurationMetadata({
          path: `/${flow}/summary`,
          orderedProductIds: ids,
          uiState,
          fragment,
          swatchOrder: {
            selectedMaterials: [],
            manualSelectedMaterials: [],
            isAutofillEnabled: false,
            hasSubmittedCart: false,
          },
        }),
      };
      expect(readConfigurationFragment(record.metadata).fragment.collectionId).toBe("tricot");
      setup();
      const result = await restoreSavedConfiguration("tricot-test-save", {
        dispatch: store.dispatch,
        getState: store.getState,
        loadRecord: async () => record,
        restorer: createTestSceneRestorer().restorer,
        applyPage: async (_plan: RestorePlan, matches: SceneRestoreMatch[]) => {
          store.dispatch(resetProducts());
          matches.forEach(({ runtimeId }) => store.dispatch(addProductId(runtimeId)));
        },
      });
      expect(result.status, JSON.stringify(result)).toBe("restored");
      const after = getConfigurationSnapshot(store.getState());
      expect(after.collectionId).toBe("tricot");
      expect(after.values).toEqual(before.values);
      expect(after.cabinets.map(({ stableKey, index }) => [stableKey, index])).toEqual(
        before.cabinets.map(({ stableKey, index }) => [stableKey, index]),
      );
    },
  );

  it("undo and redo restore captured scoped values and replay each module, not the current choices", async () => {
    const { deps, runtime } = await givenChoices("custom");
    const before = await captureSnapshot(store.getState);
    await changeAttribute(
      { attributeId: "DrawerPanelFluting", scope: "cabinet", cabinetId: "cab-2", value: "Gessato" },
      deps,
    );
    const after = await captureSnapshot(store.getState);
    const replay = async (send: Parameters<typeof replayValues>[0]["send"]) => {
      const result = await replayValues({ send, record: false }, deps);
      expect(result.status, JSON.stringify(result)).toBe("applied");
      return result;
    };
    const scene = createTestSceneRestorer();
    scene.answerWith((request) => {
      const matches = request.products.map(({ sourceId, productType }, index) => ({
        sourceId,
        runtimeId: `${productType}-restored-${index}`,
      }));
      return {
        status: "restored",
        matches,
        scene: {
          status: "ready",
          order: matches.map((m) => m.runtimeId),
          cabinets: matches.map((m) => ({ runtimeId: m.runtimeId, dimensions: { width: 60, height: 40, depth: 52 } })),
        },
      };
    });
    for (const [snapshot, expected] of [
      [before, "Satin"],
      [after, "Gessato"],
    ] as const) {
      // The rebuilt scene must replace stale dimensions before matrix validation during replay.
      store.dispatch(
        recordSceneState({
          order: getCabinetEntries(store.getState()).map((c) => c.runtimeId),
          cabinets: getCabinetEntries(store.getState()).map((c) => ({
            runtimeId: c.runtimeId,
            dimensions: { width: 240, height: 40, depth: 52 },
          })),
        }),
      );
      const result = await restoreSnapshot(snapshot, {
        dispatch: store.dispatch,
        getState: store.getState,
        getBindings: () => tricotTestBindings,
        restorer: scene.restorer,
        replay,
      });
      expect(result.status).toBe("restored");
      expect(store.getState().rootStateUI.configuration.dimensionsByCabinet["cab-1"].width).toBe(60);
      expect(getAttributeValue(store.getState(), "DrawerPanelFluting", { scope: "cabinet", cabinetId: "cab-2" })).toBe(
        expected,
      );
      expect(
        runtime.calls
          .at(-1)
          ?.filter(({ attributeId }) => attributeId === "DrawerPanelFluting")
          .map(({ target, value }) => [target, value]),
      ).toEqual([
        [{ scope: "cabinet", cabinetId: "cab-1" }, "Twill"],
        [{ scope: "cabinet", cabinetId: "cab-2" }, expected],
      ]);
      expect(getRuntimeSyncState(store.getState()).needsSync).toBe(false);
    }
    expect(restoreSidePanelState).not.toHaveBeenCalled();
  });

  it("rejects incompatible saved patterns before scene replay and holds saving for sync", async () => {
    const { deps, runtime } = await givenChoices("custom");
    store.dispatch(
      setAttributeValue({
        attributeId: "DrawerPanelFluting",
        target: { scope: "cabinet", cabinetId: "cab-2" },
        value: "Loden",
      }),
    );
    const calls = runtime.calls.length;
    const result = await replayValues(
      { send: { CabinetColor: "Noce Canaletto 933", DrawerPanelFluting: "Twill" }, record: false },
      deps,
    );
    expect(result.status).toBe("error");
    expect(runtime.calls).toHaveLength(calls);
    expect(getRuntimeSyncState(store.getState()).needsSync).toBe(true);
  });

  it("rejects history from a different collection before rebuilding products", async () => {
    await givenChoices("custom");
    const snapshot = await captureSnapshot(store.getState);
    store.dispatch(setActiveCollectionId("class"));
    const scene = createTestSceneRestorer();
    expect(
      (
        await restoreSnapshot(snapshot, {
          dispatch: store.dispatch,
          getState: store.getState,
          getBindings: () => null,
          restorer: scene.restorer,
          replay: vi.fn(),
        })
      ).status,
    ).toBe("rejected");
    expect(scene.requests).toEqual([]);
  });

  it("reports incomplete history replay as partial, not a fully restored scene", async () => {
    const { deps } = await givenChoices("custom");
    store.dispatch(
      setAttributeValue({
        attributeId: "DrawerPanelFluting",
        target: { scope: "cabinet", cabinetId: "cab-2" },
        value: "Loden",
      }),
    );
    const snapshot = await captureSnapshot(store.getState);
    const result = await restoreSnapshot(snapshot, {
      dispatch: store.dispatch,
      getState: store.getState,
      getBindings: () => tricotTestBindings,
      restorer: createTestSceneRestorer().restorer,
      replay: (send) => replayValues({ send, record: false }, deps),
    });
    expect(result.status).toBe("partial");
    expect(getRuntimeSyncState(store.getState()).needsSync).toBe(true);
  });

  it("labels the pattern in Tricot vocabulary while preserving a legacy fallback", () => {
    expect(resolveAttributeLabel(tricotUi, "DrawerPanelFluting", "Drawer Panel Fluting")).toBe("Cabinet Pattern");
    expect(resolveAttributeLabel(null, "DrawerPanelFluting", "Drawer Panel Fluting")).toBe("Drawer Panel Fluting");
  });
});
