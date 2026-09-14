import { beforeEach, describe, expect, it } from "vitest";

import { store } from "@/app/store";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import { ushRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/ushRuntimeBindingsFixture";
import type { ScenePatch } from "@/entities/collection";
import { resetConfiguration, setActiveCollectionId, syncCabinets } from "@/entities/configuration";
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
import { changeAttribute, confirmAttributeChange } from "@/features/configurationCommands";
import type { ChangeAttributeDeps } from "@/features/configurationCommands";
import type { SceneSelector } from "@/utils/functions/playcanvas/sceneBridge";

import { createPlayCanvasRuntimePort } from "../lib/createPlayCanvasRuntimePort";
import type { SceneBridge } from "../lib/createPlayCanvasRuntimePort";

/**
 * C's command service with I's real adapter over a recorded scene: one user action must
 * reach the scene as one ordered set, with no command repeated.
 */

const CABINETS = ["runtime-a", "runtime-b"];

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

const createRecordedScene = () => {
  const calls: { selector: SceneSelector; patch: ScenePatch }[] = [];
  const scene: SceneBridge = {
    isReady: () => true,
    async apply(selector, patch) {
      calls.push({ selector, patch });
      return { status: "applied", updatedIds: selector.productIds ?? CABINETS };
    },
  };
  return { scene, calls };
};

describe("changeAttribute through the PlayCanvas adapter", () => {
  beforeEach(() => {
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
    store.dispatch(setActiveProfile(ushProfile));
    store.dispatch(setActiveCollectionId("urban-standard-height"));
    store.dispatch(setCabinetCatalog(buildCabinetCatalogFromMatrix(matrix, ushProfile)));
    store.dispatch(setActiveCabinetType("Sink-Base"));
    store.dispatch(setSelectedProductConfig({ Drawers: "1D", Handle: "handle_urban_topcut" }));
    store.dispatch(syncCabinets(CABINETS));
  });

  it("sends a handle change as handle, height, groove reset, each once", async () => {
    store.dispatch(setHandleGrooveColor("Pulpis Chiaro TKH"));
    const { scene, calls } = createRecordedScene();

    const deps: ChangeAttributeDeps = {
      getState: () => store.getState(),
      dispatch: (action) => store.dispatch(action),
      runtime: createPlayCanvasRuntimePort({ getBindings: () => ushRuntimeBindings, scene }),
      flow: "custom",
    };

    const asked = await changeAttribute(
      { attributeId: "Handle", value: "handle_pto", scope: "cabinet", cabinetId: "cab-1" },
      deps,
    );

    // Placed cabinets: the user is asked first, and the scene hears nothing yet.
    expect(asked.status).toBe("confirmation-required");
    expect(calls).toHaveLength(0);
    if (asked.status !== "confirmation-required") return;

    const result = await confirmAttributeChange(asked.preview, deps);

    expect(result.status).toBe("applied");
    expect(calls).toEqual([
      { selector: {}, patch: { Handle: "handle_pto" } },
      { selector: {}, patch: { Height: 50 } },
      { selector: {}, patch: { HandleGrooveColor: "None" } },
    ]);
    expect(store.getState().rootStateUI.product.selectedProductConfig?.Handle).toBe("handle_pto");
  });

  it("sends a drawers change to the addressed cabinet in the scene's spelling", async () => {
    const { scene, calls } = createRecordedScene();

    const result = await changeAttribute(
      { attributeId: "Drawers", value: "2", scope: "cabinet", cabinetId: "cab-2" },
      {
        getState: () => store.getState(),
        dispatch: (action) => store.dispatch(action),
        runtime: createPlayCanvasRuntimePort({ getBindings: () => ushRuntimeBindings, scene }),
        flow: "custom",
      },
    );

    expect(result.status).toBe("applied");
    expect(calls[0]).toEqual({ selector: { productIds: ["runtime-b"] }, patch: { Drawers: "2D" } });
    // Every command of the one action is distinct.
    expect(new Set(calls.map((call) => JSON.stringify(call))).size).toBe(calls.length);
  });
});
