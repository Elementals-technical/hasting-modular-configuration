import { beforeEach, describe, expect, it } from "vitest";

import { store } from "@/app/store";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import { ushRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/ushRuntimeBindingsFixture";
import type { ScenePatch } from "@/entities/collection";
import {
  resetConfiguration,
  setActiveCollectionId,
  setActiveRuntimeBindings,
  syncCabinets,
} from "@/entities/configuration";
import { buildSnapshotReplayValues } from "@/entities/history/lib/restoreSnapshot";
import type { SceneSnapshot } from "@/entities/history/model/store/slice";
import { reset, setActiveProfile } from "@/entities/product/model/store/slice";
import { replayValues } from "@/features/configurationCommands";
import type { SceneSelector } from "@/utils/functions/playcanvas/sceneBridge";

import { createPlayCanvasRuntimePort } from "../lib/createPlayCanvasRuntimePort";
import type { SceneBridge } from "../lib/createPlayCanvasRuntimePort";

/**
 * Undo rebuilds the products, then shows the snapshot's values on them through the runtime
 * port: each value once, in the phases of the collection, with the collection's own scene values.
 */

const CABINETS = ["Sink-Base-a", "Side-Shelf-b"];

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

const snapshotOptions = (options: Partial<SceneSnapshot["productOptions"]>) =>
  ({ productOptions: options }) as unknown as SceneSnapshot;

describe("undo values through the PlayCanvas adapter", () => {
  beforeEach(() => {
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
    store.dispatch(setActiveProfile(ushProfile));
    store.dispatch(setActiveCollectionId("urban-standard-height"));
    store.dispatch(setActiveRuntimeBindings(ushRuntimeBindings));
    store.dispatch(syncCabinets(CABINETS));
  });

  it("sends every value of the snapshot once, in the collection's phases", async () => {
    const { scene, calls } = createRecordedScene();
    const values = buildSnapshotReplayValues(
      snapshotOptions({
        CabinetColor: "Pulpis Chiaro TKH",
        CountertopColor: "Bianco Gloss TAN",
        HandleGrooveColor: "",
        sinkType: "Top_HPLPrisma",
        CountertopStyle: "Integrated",
        Thickness: "2.4",
        TowelBarOption: "Left",
        TowelBarColor: "Nero",
        VesselColor: "",
      }),
    );

    const result = await replayValues(
      { send: values, record: false },
      {
        getState: () => store.getState(),
        dispatch: (action) => store.dispatch(action),
        runtime: createPlayCanvasRuntimePort({ getBindings: () => ushRuntimeBindings, scene }),
        flow: "prebuilt",
      },
    );

    expect(result).toMatchObject({ status: "applied", skipped: [] });
    expect(calls).toEqual([
      { selector: { productType: "Sink-Base" }, patch: { sinkType: "Top_HPLPrisma" } },
      { selector: {}, patch: { CountertopStyle: "Integrated" } },
      { selector: {}, patch: { CabinetColor: "Pulpis Chiaro TKH" } },
      // The collection's own scene value for a Syntesi finish.
      { selector: {}, patch: { CountertopColor: "Bianco Gloss TAL" } },
      { selector: {}, patch: { Thickness: "2.4" } },
      { selector: {}, patch: { TowelBar: "None", TowelBarSide: "both" } },
      { selector: {}, patch: { TowelBar: "TowelBar40_R", TowelBarSide: "left" } },
      { selector: {}, patch: { TowelBarColor: "Nero" } },
    ]);
  });

  it("clears the towel bar once when the snapshot has none", async () => {
    const { scene, calls } = createRecordedScene();

    await replayValues(
      { send: buildSnapshotReplayValues(snapshotOptions({ TowelBarOption: "" })), record: false },
      {
        getState: () => store.getState(),
        dispatch: (action) => store.dispatch(action),
        runtime: createPlayCanvasRuntimePort({ getBindings: () => ushRuntimeBindings, scene }),
        flow: "prebuilt",
      },
    );

    expect(calls).toEqual([{ selector: {}, patch: { TowelBar: "None", TowelBarSide: "both" } }]);
  });
});
