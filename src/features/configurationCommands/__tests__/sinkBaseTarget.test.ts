import { beforeEach, describe, expect, it } from "vitest";

import { store } from "@/app/store";
import { makoProfile } from "@/entities/collection/__tests__/makoProfileFixture";
import { makoRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/makoRuntimeBindingsFixture";
import {
  getAttributeValue,
  getCabinetEntries,
  resetConfiguration,
  setActiveCollectionId,
  setActiveRuntimeBindings,
  setAttributeValue,
  syncCabinets,
} from "@/entities/configuration";
import { reset, setActiveCabinetType, setActiveProfile } from "@/entities/product/model/store/slice";
import { createTestRuntimePort } from "@/features/playCanvasAdapter";

import { changeAttribute } from "../lib/changeAttribute";
import { evaluateChange } from "../lib/evaluateChange";
import { resolveChangeRequest } from "../lib/resolveChangeRequest";

/**
 * The scene names a product after its scene type (`Mako-sink-cabinet-k3j4h5g6f`), so a Mako
 * Sink Base is found through the runtime bindings, not by a "sink-base" in its id.
 */

beforeEach(() => {
  store.dispatch(reset());
  store.dispatch(resetConfiguration());
  store.dispatch(setActiveProfile(makoProfile));
  store.dispatch(setActiveCollectionId("mako"));
  store.dispatch(setActiveRuntimeBindings(makoRuntimeBindings));
  // The builder's last pick is a Side Cabinet, so only the placed products can name the Sink Base.
  store.dispatch(setActiveCabinetType("Sink-Cabinet"));
  store.dispatch(syncCabinets(["Mako-side-cabinet-a1b2c3d4e", "Mako-sink-cabinet-k3j4h5g6f"]));
});

describe("a Mako basin value", () => {
  it("is planned for the placed Sink Base, not the Side Cabinet", () => {
    const request = resolveChangeRequest(store.getState(), "sinkType", "LB440");
    if (!request) throw new Error("a placed Sink Base names the basin");

    expect(evaluateChange(request, store.getState())).toMatchObject({
      kind: "planned",
      plan: [{ attributeId: "sinkType", target: { scope: "basin", sinkBaseId: "cab-2" }, value: "LB440" }],
    });
  });

  it("is planned for that Sink Base", () => {
    const evaluation = evaluateChange(
      { attributeId: "sinkType", value: "LB440", scope: "basin", sinkBaseId: "cab-2" },
      store.getState(),
    );

    expect(evaluation).toMatchObject({ kind: "planned" });
  });
});

describe("a basin picked for a Mako composition of two Sink Bases", () => {
  beforeEach(() => {
    store.dispatch(syncCabinets(["Mako-sink-cabinet-k3j4h5g6f", "Mako-sink-cabinet-m7n8p9q0r"]));
    // Placing a model records the basin of the whole composition: here the Mako default.
    store.dispatch(setAttributeValue({ attributeId: "sinkType", target: { scope: "basin" }, value: "VA005" }));
  });

  it("goes on every Sink Base, so none keeps the basin it had", async () => {
    const request = resolveChangeRequest(store.getState(), "sinkType", "VA024");
    if (!request) throw new Error("a placed Sink Base names the basin");

    const result = await changeAttribute(request, {
      getState: () => store.getState(),
      dispatch: (action) => store.dispatch(action),
      runtime: createTestRuntimePort().port,
      flow: "custom",
    });

    // The price reads the basin of each Sink Base before the composition's.
    const state = store.getState();
    expect(result.status).toBe("applied");
    expect(
      getCabinetEntries(state).map(({ stableKey }) =>
        getAttributeValue(state, "sinkType", { scope: "basin", sinkBaseId: stableKey }),
      ),
    ).toEqual(["VA024", "VA024"]);
  });
});
