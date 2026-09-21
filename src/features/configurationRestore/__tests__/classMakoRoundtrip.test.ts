import { beforeEach, describe, expect, it, vi } from "vitest";

import { store } from "@/app/store";
import type { ProductProfile } from "@/entities/collection";
import { parseProductProfile } from "@/entities/collection/lib/parseProductProfile";
import { resolveCollection } from "@/entities/collection/lib/resolveCollection";
import {
  clearRestore,
  getActiveCollectionId,
  getAttributeValue,
  getCabinetEntries,
  resetConfiguration,
  setActiveCollectionId,
  syncCabinets,
} from "@/entities/configuration";
import type { AttributeValue, ConfigurationRecord, SceneRestoreMatch, ValueTarget } from "@/entities/configuration";
import { clearHistory } from "@/entities/history/model/store/slice";
import { addProductId, reset, resetProducts, setActiveProfile } from "@/entities/product/model/store/slice";
import { changeAttribute } from "@/features/configurationCommands/lib/changeAttribute";
import type { AttributeChange } from "@/features/configurationCommands/model/types";
import { createTestRuntimePort } from "@/features/playCanvasAdapter";
import { createTestSceneRestorer } from "@/features/playCanvasAdapter/lib/testSceneRestorer";
import { buildConfigurationMetadata } from "@/features/saveConfiguration/lib/buildConfigurationMetadata";
import { readSavedCollectionIdentity } from "@/features/saveConfiguration/lib/legacyMetadata";
import { selectConfigurationSavePayload } from "@/features/saveConfiguration/lib/selectSavePayload";

import classProfileDocument from "../../../../public/collections/class/product-profile.json";
import makoProfileDocument from "../../../../public/collections/mako/product-profile.json";
import registry from "../../../../public/collections/registry.json";
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
 * C13: Class and Mako go through the same command, Save and restore as USH, with the
 * attributes USH does not have — Class's side and frame colours, Mako's handle and leg
 * colours — and a basin chosen for one sink base of two.
 *
 * The scene is the test port: this proves what C hands over and records, not what the real
 * scene does with it (I07).
 */

const CONFIG_ID = "13013";
const RUNTIME_IDS = ["Sink-Base-aaa111", "Sink-Base-bbb222"];

const parseProfile = (document: unknown): ProductProfile => {
  const result = parseProductProfile(document);
  if (!result.ok) throw new Error("collection profile failed validation");
  return result.profile;
};

type Addressed = { attributeId: string; target: ValueTarget; value: AttributeValue };

type Case = {
  collectionId: string;
  profile: ProductProfile;
  changes: (first: string, second: string) => Addressed[];
};

const CASES: Case[] = [
  {
    collectionId: "class",
    profile: parseProfile(classProfileDocument),
    changes: (first, second) => [
      { attributeId: "CabinetSideColor", target: { scope: "global" }, value: "Nebbia 402 MT" },
      { attributeId: "FrameColor", target: { scope: "global" }, value: "Seta 406 MT" },
      { attributeId: "sinkType", target: { scope: "basin", sinkBaseId: first }, value: "LB440" },
      { attributeId: "sinkType", target: { scope: "basin", sinkBaseId: second }, value: "LB175" },
    ],
  },
  {
    collectionId: "mako",
    profile: parseProfile(makoProfileDocument),
    changes: (first, second) => [
      { attributeId: "HandleColor", target: { scope: "cabinet", cabinetId: first }, value: "Gold" },
      { attributeId: "HandleColor", target: { scope: "cabinet", cabinetId: second }, value: "Silver" },
      { attributeId: "LegColor", target: { scope: "cabinet", cabinetId: first }, value: "Silver" },
      { attributeId: "LegColor", target: { scope: "cabinet", cabinetId: second }, value: "Gold" },
      { attributeId: "sinkType", target: { scope: "basin", sinkBaseId: second }, value: "LB575" },
    ],
  },
];

const toChange = ({ attributeId, target, value }: Addressed): AttributeChange =>
  ({ attributeId, value, ...target }) as AttributeChange;

const openCollection = ({ collectionId, profile }: Case) => {
  store.dispatch(setActiveProfile(profile));
  store.dispatch(setActiveCollectionId(collectionId));
};

const givenChanges = async (testCase: Case) => {
  openCollection(testCase);
  store.dispatch(syncCabinets(RUNTIME_IDS));

  const [first, second] = getCabinetEntries(store.getState());
  const addressed = testCase.changes(first.stableKey, second.stableKey);
  const runtime = createTestRuntimePort();
  const statuses: string[] = [];

  for (const change of addressed) {
    const result = await changeAttribute(toChange(change), {
      getState: () => store.getState(),
      dispatch: (action) => store.dispatch(action),
      runtime: runtime.port,
      flow: "custom",
    });
    statuses.push(result.status);
  }

  return { addressed, runtime, statuses };
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

describe.each(CASES)("$collectionId: change → save → open", (testCase) => {
  it("applies each change through the command and hands the scene its address", async () => {
    const { addressed, runtime, statuses } = await givenChanges(testCase);

    expect(statuses).toEqual(addressed.map(() => "applied"));
    expect(runtime.calls.map(([change]) => [change.attributeId, change.target, change.value])).toEqual(
      addressed.map(({ attributeId, target, value }) => [attributeId, target, value]),
    );
    expect(runtime.contexts.every((context) => context.collectionId === testCase.collectionId)).toBe(true);
  });

  it("saves the order with its own collection, which the registry opens again", async () => {
    await givenChanges(testCase);
    const { metadata } = savedRecordFromState();

    expect(readSavedCollectionIdentity(metadata)).toEqual({ kind: "id", collectionId: testCase.collectionId });

    const resolution = resolveCollection({
      registry,
      urlCollectionId: null,
      savedCollection: { collectionId: testCase.collectionId },
    });
    expect(resolution.ok && resolution.collectionId).toBe(testCase.collectionId);
  });

  it("brings every value back to the cabinet or basin it was chosen for", async () => {
    const { addressed } = await givenChanges(testCase);
    const record = savedRecordFromState();

    startOver();
    openCollection(testCase);
    const result = await restoreRecord(record);

    expect(result.status).toBe("restored");
    expect(getActiveCollectionId(store.getState())).toBe(testCase.collectionId);

    const lost = addressed.flatMap(({ attributeId, target, value }) => {
      const restored = getAttributeValue(store.getState(), attributeId, target);
      return restored === value ? [] : [{ attributeId, target, saved: value, restored }];
    });
    expect(lost).toEqual([]);
  });

  it("is not opened into another collection", async () => {
    const { addressed } = await givenChanges(testCase);
    const record = savedRecordFromState();

    startOver();
    store.dispatch(setActiveCollectionId("urban-standard-height"));
    const result = await restoreRecord(record);

    expect(result).toMatchObject({ status: "failed", reason: "collection" });
    expect(
      addressed.filter(({ attributeId, target }) => getAttributeValue(store.getState(), attributeId, target) != null),
    ).toEqual([]);
  });
});
