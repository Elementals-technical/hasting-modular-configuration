import { beforeEach, describe, expect, it } from "vitest";

import { store } from "@/app/store";
import fixtureRulesCabinetTable from "@/entities/collection/__tests__/fixtures/collections/fixture-rules/cabinet-table.json";
import fixtureRulesProfileDocument from "@/entities/collection/__tests__/fixtures/collections/fixture-rules/product-profile.json";
import fixtureRulesBindingsDocument from "@/entities/collection/__tests__/fixtures/collections/fixture-rules/runtime-bindings.json";
import fixtureUiBindingsDocument from "@/entities/collection/__tests__/fixtures/collections/fixture-ui/runtime-bindings.json";
import { ushRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/ushRuntimeBindingsFixture";
import { parseProductProfile } from "@/entities/collection/lib/parseProductProfile";
import { parseRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/parseRuntimeBindings";
import type { ProductProfile, RuntimeBindingSet, ScenePatch } from "@/entities/collection";
import { getCabinetEntries, resetConfiguration, setActiveCollectionId, syncCabinets } from "@/entities/configuration";
import type { RuntimeChange, RuntimeContext } from "@/entities/configuration";
import type { ProductDatatable } from "@/entities/product/api";
import { buildCabinetCatalogFromMatrix } from "@/entities/product/lib/matrixCabinet";
import {
  reset,
  setActiveCabinetType,
  setActiveProfile,
  setCabinetCatalog,
  setSelectedDimensions,
  setSelectedProductConfig,
} from "@/entities/product/model/store/slice";
import { changeAttribute } from "@/features/configurationCommands/lib/changeAttribute";
import type { ChangeAttributeDeps } from "@/features/configurationCommands/lib/changeAttribute";
import type { SceneSelector } from "@/utils/functions/playcanvas/sceneBridge";

import { createPlayCanvasRuntimePort } from "../lib/createPlayCanvasRuntimePort";
import type { SceneBridge } from "../lib/createPlayCanvasRuntimePort";

/**
 * The two test profiles of TESTING §2 through the real adapter.
 *
 * They cannot be opened in the browser (the production registry lists only USH), so this
 * is their evidence for I06: the scene receives the key a new attribute is bound to, and a
 * choice the profile's rules disallow never reaches the scene.
 */

type FakeScene = SceneBridge & { calls: { selector: SceneSelector; patch: ScenePatch }[] };

const createFakeScene = (productIds: string[]): FakeScene => {
  const scene: FakeScene = {
    calls: [],
    isReady: () => true,
    async apply(selector, patch) {
      scene.calls.push({ selector, patch });
      // Like the real scene: a broadcast updates every product.
      return { status: "applied", updatedIds: selector.productIds ?? productIds };
    },
  };
  return scene;
};

const parseBindings = (document: unknown): RuntimeBindingSet => {
  const result = parseRuntimeBindings(document);
  if (!result.ok) throw new Error("fixture runtime bindings failed validation");
  return result.bindings;
};

const parseProfile = (document: unknown): ProductProfile => {
  const result = parseProductProfile(document);
  if (!result.ok) throw new Error("fixture profile failed validation");
  return result.profile;
};

describe("fixture-ui through the adapter", () => {
  const fixtureUiBindings = parseBindings(fixtureUiBindingsDocument);
  const testFinish: RuntimeChange = {
    attributeId: "TestGrooveFinish",
    target: { scope: "global" },
    value: "test-finish",
  };

  const context = (collectionId: string): RuntimeContext => ({
    collectionId,
    flow: "custom",
    resolveRuntimeId: () => "rt-1",
    cabinetRuntimeIds: ["rt-1"],
  });

  it("sends the new attribute to every product under the scene key it is bound to", async () => {
    const scene = createFakeScene(["rt-1"]);
    const port = createPlayCanvasRuntimePort({ getBindings: () => fixtureUiBindings, scene });

    const result = await port.apply([testFinish], context("fixture-ui"));

    expect(result.status).toBe("applied");
    expect(scene.calls).toEqual([{ selector: {}, patch: { HandleGrooveColor: "test-finish" } }]);
  });

  it("finds no translation for it in the USH table, so nothing is sent", async () => {
    const scene = createFakeScene(["rt-1"]);
    const port = createPlayCanvasRuntimePort({ getBindings: () => ushRuntimeBindings, scene });

    const result = await port.apply([testFinish], context("urban-standard-height"));

    expect(result.status).toBe("unsupported");
    expect(scene.calls).toEqual([]);
  });
});

describe("fixture-rules through the command service and the adapter", () => {
  const RUNTIME_ID = "Fixture-Cabinet-rt1";
  const profile = parseProfile(fixtureRulesProfileDocument);
  const bindings = parseBindings(fixtureRulesBindingsDocument);

  beforeEach(() => {
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
    store.dispatch(setActiveProfile(profile));
    store.dispatch(setActiveCollectionId("fixture-rules"));
    store.dispatch(
      setCabinetCatalog(
        buildCabinetCatalogFromMatrix(fixtureRulesCabinetTable as unknown as ProductDatatable, profile),
      ),
    );
    store.dispatch(setActiveCabinetType("Fixture-Cabinet"));
    store.dispatch(setSelectedDimensions({ width: 60, depth: 50.5, height: 56 }));
    store.dispatch(setSelectedProductConfig({ Drawers: "2D", Handle: "handle_urban_topcut" }));
    store.dispatch(syncCabinets([RUNTIME_ID]));
  });

  const changeDrawers = async (value: string) => {
    const scene = createFakeScene([RUNTIME_ID]);
    const deps: ChangeAttributeDeps = {
      getState: () => store.getState(),
      dispatch: (action) => store.dispatch(action),
      runtime: createPlayCanvasRuntimePort({ getBindings: () => bindings, scene }),
      flow: "custom",
    };
    const cabinetId = getCabinetEntries(store.getState())[0].stableKey;

    const result = await changeAttribute({ attributeId: "Drawers", value, scope: "cabinet", cabinetId }, deps);
    return { result, scene };
  };

  it("blocks a drawers value the profile does not allow before any scene command", async () => {
    const { result, scene } = await changeDrawers("1");

    expect(result.status).toBe("blocked");
    expect(scene.calls).toEqual([]);
  });

  it("sends the allowed drawers to the cabinet in the scene's spelling", async () => {
    const { result, scene } = await changeDrawers("2");

    expect(result.status).toBe("applied");
    expect(scene.calls).toContainEqual({ selector: { productIds: [RUNTIME_ID] }, patch: { Drawers: "2D" } });
    expect(scene.calls.some(({ patch }) => patch.Drawers === "1D")).toBe(false);
  });
});
