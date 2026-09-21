import { beforeEach, describe, expect, it } from "vitest";

import { store } from "@/app/store";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import { ushRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/ushRuntimeBindingsFixture";
import {
  getRuntimeSyncState,
  resetConfiguration,
  setActiveCollectionId,
  setActiveRuntimeBindings,
  syncCabinets,
} from "@/entities/configuration";
import { getBookMatching, getCabinetColor } from "@/entities/product/model/store/selectors";
import { reset, setActiveProfile } from "@/entities/product/model/store/slice";
import { createTestRuntimePort } from "@/features/playCanvasAdapter";

import { replayValues, type ReplayDeps } from "../lib/replayValues";

const depsWith = (runtime: ReplayDeps["runtime"]): ReplayDeps => ({
  getState: () => store.getState(),
  dispatch: (action) => store.dispatch(action),
  runtime,
  flow: "custom",
});

describe("replayValues", () => {
  beforeEach(() => {
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
    store.dispatch(setActiveProfile(ushProfile));
    store.dispatch(setActiveCollectionId("urban-standard-height"));
    store.dispatch(setActiveRuntimeBindings(ushRuntimeBindings));
    store.dispatch(syncCabinets(["runtime-a", "runtime-b"]));
  });

  it("addresses each value at the scope its attribute declares and sends the set once", async () => {
    const runtime = createTestRuntimePort();

    const result = await replayValues(
      {
        send: {
          CabinetColor: "Ardesia DD GL",
          HandleGrooveColor: "Blu Pavone A6 MT",
          Thickness: "2.375",
          CountertopStyle: "Vessel",
          VesselColor: "Bianco",
        },
        record: false,
      },
      depsWith(runtime.port),
    );

    expect(result).toMatchObject({ status: "applied", skipped: [] });
    expect(runtime.calls).toHaveLength(1);
    expect(runtime.calls[0].map(({ attributeId, target, value }) => [attributeId, target, value])).toEqual([
      ["CabinetColor", { scope: "global" }, "Ardesia DD GL"],
      ["HandleGrooveColor", { scope: "cabinet", cabinetId: "cab-1" }, "Blu Pavone A6 MT"],
      // An identity value reaches the scene as stored.
      ["Thickness", { scope: "countertop" }, "2.375"],
      // A value map is keyed by the canonical option, not the legacy spelling state keeps.
      ["CountertopStyle", { scope: "countertop" }, "vessel"],
      ["VesselColor", { scope: "basin" }, "Bianco"],
    ]);
    // The state already holds these values, so nothing is recorded.
    expect(getCabinetColor(store.getState())).not.toBe("Ardesia DD GL");
  });

  it("skips a value the scene has no translation for and still sends the rest", async () => {
    const runtime = createTestRuntimePort();

    const result = await replayValues(
      { send: { CabinetColor: "Ardesia DD GL", TowelBarOption: "Sideways", DividersStyle: "Oak" }, record: false },
      depsWith(runtime.port),
    );

    expect(result.status).toBe("applied");
    expect(result.skipped).toEqual([
      { attributeId: "DividersStyle", value: "Oak", reason: "no-target" },
      { attributeId: "TowelBarOption", value: "Sideways", reason: "no-translation" },
    ]);
    expect(runtime.calls[0].map(({ attributeId }) => attributeId)).toEqual(["CabinetColor"]);
  });

  it("records the sent and the record-only values when asked", async () => {
    const runtime = createTestRuntimePort();

    await replayValues(
      { send: { CabinetColor: "Ardesia DD GL" }, recordOnly: { BookMatching: "enabled" }, record: true },
      depsWith(runtime.port),
    );

    expect(runtime.calls[0].map(({ attributeId }) => attributeId)).toEqual(["CabinetColor"]);
    expect(getCabinetColor(store.getState())).toBe("Ardesia DD GL");
    expect(getBookMatching(store.getState())).toBe("enabled");
  });

  it("records nothing when the scene is not ready", async () => {
    const runtime = createTestRuntimePort();
    runtime.setReady(false);

    const result = await replayValues(
      { send: { CabinetColor: "Ardesia DD GL" }, recordOnly: { BookMatching: "enabled" }, record: true },
      depsWith(runtime.port),
    );

    expect(result).toMatchObject({ status: "error", code: "runtime-not-ready" });
    expect(getCabinetColor(store.getState())).not.toBe("Ardesia DD GL");
    expect(getBookMatching(store.getState())).toBe("");
  });

  it("holds Save after a replay the scene took only in part", async () => {
    const runtime = createTestRuntimePort();
    runtime.failNext((change) => change.attributeId === "Thickness");

    const result = await replayValues(
      { send: { CabinetColor: "Ardesia DD GL", Thickness: "2.4" }, record: true },
      depsWith(runtime.port),
    );

    expect(result.status).toBe("partial");
    expect(getCabinetColor(store.getState())).toBe("Ardesia DD GL");
    expect(getRuntimeSyncState(store.getState()).needsSync).toBe(true);
  });
});
