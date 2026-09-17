import { beforeEach, describe, expect, it, vi } from "vitest";

import { store } from "@/app/store";
import {
  clearRestore,
  getAttributeValue,
  getCabinetEntries,
  getRestoreState,
  resetConfiguration,
  setActiveCollectionId,
  setAttributeValue,
  syncCabinets,
} from "@/entities/configuration";
import type { ConfigurationRecord, SceneRestoreMatch } from "@/entities/configuration";
import { clearHistory } from "@/entities/history/model/store/slice";
import { addProductId, reset, resetProducts } from "@/entities/product/model/store/slice";
import { createTestSceneRestorer } from "@/features/playCanvasAdapter/lib/testSceneRestorer";
import { buildConfigurationMetadata } from "@/features/saveConfiguration/lib/buildConfigurationMetadata";
import { readConfigurationFragment } from "@/features/saveConfiguration/lib/legacyMetadata";
import { selectConfigurationSavePayload } from "@/features/saveConfiguration/lib/selectSavePayload";

import type { RestorePlan } from "../lib/buildRestorePlan";
import { restoreSavedConfiguration } from "../lib/restoreSavedConfiguration";

vi.mock("@/utils/functions/playcanvas/setConfigBatch", () => ({
  setConfigBatch: vi.fn(async () => ({ updatedIds: [] })),
  runInBatchQueue: vi.fn(async (task: () => Promise<unknown>) => task()),
}));

vi.mock("@/utils/functions/playcanvas/getOrderedProductIds", () => ({
  getOrderedProductIds: (fallback: string[] = []) => fallback,
}));

vi.mock("@/utils/functions/playcanvas/getConfig", () => ({
  getConfig: vi.fn(async () => ({ Width: 60 })),
}));

/**
 * The full circle of C07/C08/C09: save what the state holds, read it back, restore it (C12).
 *
 * The unit tests cover each step on its own; this one proves the three agree — a value that
 * survives the fragment must come back addressed to the same product and drawer.
 */

const USH = "urban-standard-height";
const CONFIG_ID = "24601";
const RUNTIME_IDS = ["Sink-Base-aaa111", "Sink-Base-bbb222"];

const givenConfiguration = () => {
  store.dispatch(reset());
  store.dispatch(resetConfiguration());
  store.dispatch(clearHistory());
  store.dispatch(setActiveCollectionId(USH));
  store.dispatch(syncCabinets(RUNTIME_IDS));

  const [first, second] = getCabinetEntries(store.getState());
  store.dispatch(
    setAttributeValue({
      attributeId: "TestFinish",
      target: { scope: "cabinet", cabinetId: first.stableKey },
      value: "Gloss",
    }),
  );
  store.dispatch(
    setAttributeValue({
      attributeId: "TestFinish",
      target: { scope: "cabinet", cabinetId: second.stableKey },
      value: "Matte",
    }),
  );
  store.dispatch(
    setAttributeValue({
      attributeId: "DividersStyle",
      target: { scope: "drawer", cabinetId: first.stableKey, drawerType: "Bot" },
      value: "Option A",
    }),
  );
  store.dispatch(setAttributeValue({ attributeId: "BookMatching", target: { scope: "global" }, value: "enabled" }));

  return { first, second };
};

const savedRecordFromState = (): ConfigurationRecord => {
  const { uiState, fragment } = selectConfigurationSavePayload(store.getState());

  return {
    configuration: Object.fromEntries(RUNTIME_IDS.map((id) => [id, { ProductType: "Sink-Base", Width: 60 }])),
    metadata: buildConfigurationMetadata({
      path: "/custom/summary",
      orderedProductIds: RUNTIME_IDS,
      uiState,
      swatchOrder: {
        selectedMaterials: [],
        manualSelectedMaterials: [],
        isAutofillEnabled: false,
        hasSubmittedCart: false,
      },
      fragment,
    }),
  };
};

const restoreRecord = (record: ConfigurationRecord) => {
  const scene = createTestSceneRestorer();
  const applyPage = vi.fn(async (_plan: RestorePlan, matches: SceneRestoreMatch[]) => {
    store.dispatch(resetProducts());
    matches.forEach(({ runtimeId }) => store.dispatch(addProductId(runtimeId)));
  });

  return restoreSavedConfiguration(CONFIG_ID, {
    dispatch: store.dispatch,
    getState: store.getState,
    loadRecord: async () => record,
    restorer: scene.restorer,
    applyPage,
  });
};

beforeEach(() => {
  store.dispatch(reset());
  store.dispatch(resetConfiguration());
  // `resetConfiguration` keeps the restore status on purpose, and a restored id is never restored twice.
  store.dispatch(clearRestore());
});

describe("save → read → restore", () => {
  it("brings back every value addressed to the product and drawer it was saved for", async () => {
    const { first, second } = givenConfiguration();
    const record = savedRecordFromState();

    store.dispatch(reset());
    store.dispatch(resetConfiguration());
    store.dispatch(setActiveCollectionId(USH));

    const result = await restoreRecord(record);

    expect(result.status).toBe("restored");
    expect(getRestoreState(store.getState()).status).toBe("restored");

    const restored = getCabinetEntries(store.getState());
    expect(restored.map(({ stableKey }) => stableKey)).toEqual([first.stableKey, second.stableKey]);
    expect(getAttributeValue(store.getState(), "TestFinish", { scope: "cabinet", cabinetId: first.stableKey })).toBe(
      "Gloss",
    );
    expect(getAttributeValue(store.getState(), "TestFinish", { scope: "cabinet", cabinetId: second.stableKey })).toBe(
      "Matte",
    );
    expect(
      getAttributeValue(store.getState(), "DividersStyle", {
        scope: "drawer",
        cabinetId: first.stableKey,
        drawerType: "Bot",
      }),
    ).toBe("Option A");
    expect(getAttributeValue(store.getState(), "BookMatching", { scope: "global" })).toBe("enabled");
  });

  it("reads back what it saved, without losing a target", () => {
    givenConfiguration();
    const record = savedRecordFromState();

    const { fragment, issues, isLegacy } = readConfigurationFragment(record.metadata);

    expect(issues).toEqual([]);
    expect(isLegacy).toBe(false);
    expect(fragment.collectionId).toBe(USH);
    expect(fragment.values).toEqual(selectConfigurationSavePayload(store.getState()).fragment.values);
  });

  it("restores a link saved before the fragment existed as the default collection", async () => {
    const legacy: ConfigurationRecord = {
      configuration: Object.fromEntries(RUNTIME_IDS.map((id) => [id, { ProductType: "Sink-Base", Width: 60 }])),
      metadata: {
        path: "/custom/summary",
        orderedProductIds: RUNTIME_IDS,
        uiState: { CabinetColor: "Castagno chiaro 1C1" },
      },
    };

    expect(readConfigurationFragment(legacy.metadata).isLegacy).toBe(true);

    store.dispatch(setActiveCollectionId(USH));
    const result = await restoreRecord(legacy);

    expect(result.status).toBe("restored");
    expect(getCabinetEntries(store.getState())).toHaveLength(RUNTIME_IDS.length);
  });
});
