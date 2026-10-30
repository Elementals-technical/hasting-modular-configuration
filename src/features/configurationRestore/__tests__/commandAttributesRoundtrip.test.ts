import { beforeEach, describe, expect, it, vi } from "vitest";

import { store } from "@/app/store";
import { selectAttribute, selectOptions } from "@/entities/collection";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import {
  clearRestore,
  getAttributeOwnership,
  getAttributeValue,
  getCabinetEntries,
  resetConfiguration,
  setActiveCollectionId,
  syncCabinets,
} from "@/entities/configuration";
import type { AttributeValue, ConfigurationRecord, SceneRestoreMatch, ValueTarget } from "@/entities/configuration";
import { clearHistory } from "@/entities/history/model/store/slice";
import { addProductId, reset, resetProducts, setActiveProfile } from "@/entities/product/model/store/slice";
import { commitChange, TYPED_COMMIT_ATTRIBUTE_IDS } from "@/features/configurationCommands/lib/commitChange";
import type { PlannedChange } from "@/features/configurationCommands/model/types";
import { createTestSceneRestorer } from "@/features/playCanvasAdapter/lib/testSceneRestorer";
import { buildConfigurationMetadata } from "@/features/saveConfiguration/lib/buildConfigurationMetadata";
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
 * DEV-09: every attribute the command path writes survives Save and comes back to the address
 * it was chosen for — the configuration, the countertop, one basin, one cabinet, one drawer.
 *
 * Two sink bases get different values wherever the attribute is per product, so a value that
 * lands on the wrong basin or cabinet fails here, not only one that is lost.
 */

const USH = "urban-standard-height";
const CONFIG_ID = "31337";
const RUNTIME_IDS = ["Sink-Base-aaa111", "Sink-Base-bbb222"];

/** Kept in each product's scene config, not in the configuration map (I04). */
const SCENE_DIMENSIONS = ["Width", "Depth", "Height"];

/** Values for attributes the profile does not list options for. */
const FREE_VALUES: Record<string, [string, string]> = {
  SidePanelLeft: ["active", "auto-removed"],
  SidePanelRight: ["none", "active"],
};

/** Two distinct values the attribute can take, so neighbouring addresses can be told apart. */
const twoValues = (attributeId: string): [string, string] => {
  const noneValue = selectAttribute(ushProfile, attributeId)?.noneValue;
  const options = selectOptions(ushProfile, attributeId)
    .map(({ value }) => value)
    .filter((value) => value !== "" && value !== noneValue);

  if (FREE_VALUES[attributeId]) return FREE_VALUES[attributeId];
  if (options.length >= 2) return [options[0], options[1]];
  return [`${attributeId} one`, `${attributeId} two`];
};

type Addressed = { attributeId: string; target: ValueTarget; value: AttributeValue };

/** Where the attribute is addressed, with the value each address gets. */
const addressesOf = (attributeId: string, firstKey: string, secondKey: string): Addressed[] => {
  const scope = getAttributeOwnership(attributeId)?.scope;
  const [one, two] = twoValues(attributeId);

  switch (scope) {
    case "global":
    case "countertop":
      return [{ attributeId, target: { scope }, value: one }];
    case "basin":
      return [
        { attributeId, target: { scope, sinkBaseId: firstKey }, value: one },
        { attributeId, target: { scope, sinkBaseId: secondKey }, value: two },
      ];
    case "cabinet":
      return [
        { attributeId, target: { scope, cabinetId: firstKey }, value: one },
        { attributeId, target: { scope, cabinetId: secondKey }, value: two },
      ];
    case "drawer":
      return [
        { attributeId, target: { scope, cabinetId: firstKey, drawerType: "Bot" }, value: one },
        { attributeId, target: { scope, cabinetId: secondKey, drawerType: "Top" }, value: two },
      ];
    default:
      throw new Error(`${attributeId} has no scope in the ownership registry`);
  }
};

const ROUNDTRIP_ATTRIBUTE_IDS = TYPED_COMMIT_ATTRIBUTE_IDS.filter((id) => !SCENE_DIMENSIONS.includes(id));

const givenEveryAttributeCommitted = (): Addressed[] => {
  store.dispatch(setActiveProfile(ushProfile));
  store.dispatch(setActiveCollectionId(USH));
  store.dispatch(syncCabinets(RUNTIME_IDS));

  const cabinets = getCabinetEntries(store.getState());
  const [first, second] = cabinets;
  const addressed = ROUNDTRIP_ATTRIBUTE_IDS.flatMap((id) => addressesOf(id, first.stableKey, second.stableKey));

  for (const { attributeId, target, value } of addressed) {
    const change: PlannedChange = { attributeId, target, value, origin: "requested" };
    const actions = commitChange(change, {
      selectedProductConfig: store.getState().rootStateUI.product.selectedProductConfig,
      resolveRuntimeId: (cabinetId) => cabinets.find(({ stableKey }) => stableKey === cabinetId)?.runtimeId ?? null,
      profile: ushProfile,
    });
    actions.forEach((action) => store.dispatch(action));
  }

  return addressed;
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

const startOver = () => {
  store.dispatch(reset());
  store.dispatch(resetConfiguration());
  store.dispatch(clearHistory());
  // `resetConfiguration` keeps the restore status on purpose, and a restored id is never restored twice.
  store.dispatch(clearRestore());
};

beforeEach(startOver);

describe("every attribute of the command path: save → open", () => {
  it("covers every attribute commitChange writes, except the scene's dimensions", () => {
    expect(ROUNDTRIP_ATTRIBUTE_IDS).toContain("sinkType");
    expect(ROUNDTRIP_ATTRIBUTE_IDS).toContain("DividersStyle");
    expect(ROUNDTRIP_ATTRIBUTE_IDS).toHaveLength(TYPED_COMMIT_ATTRIBUTE_IDS.length - SCENE_DIMENSIONS.length);
  });

  it("records every value at its address before Save", () => {
    const addressed = givenEveryAttributeCommitted();

    const missing = addressed.filter(
      ({ attributeId, target, value }) => getAttributeValue(store.getState(), attributeId, target) !== value,
    );

    expect(missing).toEqual([]);
  });

  it("brings every value back to the configuration, countertop, basin, cabinet or drawer it was saved for", async () => {
    const addressed = givenEveryAttributeCommitted();
    const record = savedRecordFromState();
    const savedValues = selectConfigurationSavePayload(store.getState()).fragment.values;

    startOver();
    store.dispatch(setActiveCollectionId(USH));
    const result = await restoreRecord(record);

    expect(result.status).toBe("restored");

    const lost = addressed.flatMap(({ attributeId, target, value }) => {
      const restored = getAttributeValue(store.getState(), attributeId, target);
      return restored === value ? [] : [{ attributeId, target, saved: value, restored }];
    });

    expect(lost).toEqual([]);
    expect(selectConfigurationSavePayload(store.getState()).fragment.values).toEqual(savedValues);
  });

  it("leaves the dimensions to the scene's product config", () => {
    givenEveryAttributeCommitted();
    const cabinetId = getCabinetEntries(store.getState())[0].stableKey;

    for (const attributeId of SCENE_DIMENSIONS) {
      const target: ValueTarget = { scope: "cabinet", cabinetId };
      commitChange(
        { attributeId, target, value: 60, origin: "requested" },
        { selectedProductConfig: null, resolveRuntimeId: () => null, profile: ushProfile },
      ).forEach((action) => store.dispatch(action));
    }

    const savedIds = Object.values(selectConfigurationSavePayload(store.getState()).fragment.values).flatMap((values) =>
      Object.keys(values),
    );
    expect(savedIds.filter((id) => SCENE_DIMENSIONS.includes(id))).toEqual([]);
  });
});
