import { beforeEach, describe, expect, it } from "vitest";

import { store } from "@/app/store";
import { makoProfile } from "@/entities/collection/__tests__/makoProfileFixture";
import { makoRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/makoRuntimeBindingsFixture";
import {
  resetConfiguration,
  setActiveCollectionId,
  setActiveRuntimeBindings,
  syncCabinets,
} from "@/entities/configuration";
import { reset, setActiveCabinetType, setActiveProfile } from "@/entities/product/model/store/slice";

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
  it("is addressed at the placed Sink Base", () => {
    expect(resolveChangeRequest(store.getState(), "sinkType", "LB440")).toEqual({
      attributeId: "sinkType",
      value: "LB440",
      scope: "basin",
      sinkBaseId: "cab-2",
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
