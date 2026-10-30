import { beforeEach, describe, expect, it } from "vitest";

import { store } from "@/app/store";
import {
  getCabinetEntries,
  resetConfiguration,
  setActiveCollectionId,
  setAttributeValue,
  syncCabinets,
} from "@/entities/configuration";
import type { ProductDatatable } from "@/entities/product/api";
import { getPlacedCabinetStyles } from "@/entities/product/model/store/selectors";
import { buildCabinetCatalogFromMatrix } from "@/entities/product/lib/matrixCabinet";
import {
  reset,
  setActiveCabinetType,
  setCabinetCatalog,
  setSelectedDimensions,
  setSelectedProductConfig,
  setActiveProfile,
} from "@/entities/product/model/store/slice";
import { changeAttribute, type ChangeAttributeDeps } from "@/features/configurationCommands/lib/changeAttribute";
import { createTestRuntimePort } from "@/features/playCanvasAdapter";
import { buildConfigurationMetadata } from "@/features/saveConfiguration/lib/buildConfigurationMetadata";
import { readSavedCollectionIdentity } from "@/features/saveConfiguration/lib/legacyMetadata";
import { selectConfigurationSavePayload } from "@/features/saveConfiguration/lib/selectSavePayload";

import fixtureRulesCabinetTable from "./fixtures/collections/fixture-rules/cabinet-table.json";
import fixtureRulesProfileDocument from "./fixtures/collections/fixture-rules/product-profile.json";
import fixtureRegistry from "./fixtures/collections/registry.json";
import { parseProductProfile } from "../lib/parseProductProfile";
import { resolveCollection } from "../lib/resolveCollection";
import type { ProductProfile } from "..";

/**
 * State, change and Save on a collection that is not USH (C12).
 *
 * `fixture-rules` cannot be opened in the browser — the production registry lists only USH —
 * so this is its evidence: a value the profile forbids never reaches the state, an allowed one
 * does, and the saved order carries the collection it was made in.
 */

const RUNTIME_ID = "Fixture-Cabinet-rt1";

const parseProfile = (document: unknown): ProductProfile => {
  const result = parseProductProfile(document);
  if (!result.ok) throw new Error("fixture profile failed validation");
  return result.profile;
};

const profile = parseProfile(fixtureRulesProfileDocument);

const changeDrawers = async (value: string) => {
  const runtime = createTestRuntimePort();
  const deps: ChangeAttributeDeps = {
    getState: () => store.getState(),
    dispatch: (action) => store.dispatch(action),
    runtime: runtime.port,
    flow: "custom",
  };
  const cabinetId = getCabinetEntries(store.getState())[0].stableKey;

  const result = await changeAttribute({ attributeId: "Drawers", value, scope: "cabinet", cabinetId }, deps);

  return { result, runtime, cabinetId };
};

const savedMetadata = () => {
  const { uiState, fragment } = selectConfigurationSavePayload(store.getState());

  return buildConfigurationMetadata({
    path: "/custom/summary",
    orderedProductIds: [RUNTIME_ID],
    uiState,
    swatchOrder: {
      selectedMaterials: [],
      manualSelectedMaterials: [],
      isAutofillEnabled: false,
      hasSubmittedCart: false,
    },
    fragment,
  });
};

beforeEach(() => {
  store.dispatch(reset());
  store.dispatch(resetConfiguration());
  store.dispatch(setActiveProfile(profile));
  store.dispatch(setActiveCollectionId("fixture-rules"));
  store.dispatch(
    setCabinetCatalog(buildCabinetCatalogFromMatrix(fixtureRulesCabinetTable as unknown as ProductDatatable, profile)),
  );
  store.dispatch(setActiveCabinetType("Fixture-Cabinet"));
  store.dispatch(setSelectedDimensions({ width: 60, depth: 50.5, height: 56 }));
  store.dispatch(setSelectedProductConfig({ Drawers: "2D", Handle: "handle_urban_topcut" }));
  store.dispatch(syncCabinets([RUNTIME_ID]));
});

describe("fixture-rules: state, change and Save", () => {
  it("keeps a value the profile forbids out of the state and the scene", async () => {
    const { result, runtime } = await changeDrawers("1");

    expect(result.status).toBe("blocked");
    expect(runtime.calls).toHaveLength(0);
    expect(getPlacedCabinetStyles(store.getState())[RUNTIME_ID]).toBeUndefined();
  });

  it("records an allowed value against the cabinet that got it", async () => {
    const { result } = await changeDrawers("2");

    expect(result.status).toBe("applied");
    // Drawers is a typed core value: it is recorded per product in the slice, not in the fragment.
    expect(getPlacedCabinetStyles(store.getState())[RUNTIME_ID]).toBe("2");
  });

  it("saves the order with the collection it was made in, and nothing from USH", async () => {
    const { cabinetId } = await changeDrawers("2");
    // A value that has already moved off the typed state travels in the fragment, addressed per product.
    store.dispatch(
      setAttributeValue({ attributeId: "TestFinish", target: { scope: "cabinet", cabinetId }, value: "Matte" }),
    );
    const metadata = savedMetadata();

    expect(metadata.collectionId).toBe("fixture-rules");
    expect(metadata.configuration.collectionId).toBe("fixture-rules");
    expect(metadata.configuration.values).toMatchObject({ [`cabinet:${cabinetId}`]: { TestFinish: "Matte" } });
    expect(readSavedCollectionIdentity(metadata)).toEqual({ kind: "id", collectionId: "fixture-rules" });
  });

  it("resolves back to the same collection when that order is opened", async () => {
    await changeDrawers("2");
    const metadata = savedMetadata();
    const identity = readSavedCollectionIdentity(metadata);
    const collectionId = identity.kind === "id" ? identity.collectionId : null;

    const resolution = resolveCollection({
      registry: fixtureRegistry,
      urlCollectionId: null,
      savedCollection: { collectionId },
    });

    expect(resolution.ok).toBe(true);
    if (resolution.ok) expect(resolution.collectionId).toBe("fixture-rules");
  });
});
