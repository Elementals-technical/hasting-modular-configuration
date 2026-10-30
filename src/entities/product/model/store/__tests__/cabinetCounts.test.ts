import { beforeEach, describe, expect, it } from "vitest";

import udProfileDocument from "../../../../../../public/collections/urban-duplex/product-profile.json";
import udRuntimeBindingsDocument from "../../../../../../public/collections/urban-duplex/runtime-bindings.json";
import { store } from "@/app/store";
import {
  parseProductProfile,
  parseRuntimeBindings,
  type ProductProfile,
  type RuntimeBindingSet,
} from "@/entities/collection";
import { makoProfile } from "@/entities/collection/__tests__/makoProfileFixture";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import { makoRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/makoRuntimeBindingsFixture";
import { ushRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/ushRuntimeBindingsFixture";
import { resetConfiguration, setActiveRuntimeBindings } from "@/entities/configuration";

import { selectCabinetTypesAtLimit } from "../selectors";
import { addProductId, replaceCollectionData, reset } from "../slice";

/**
 * A vanity takes two Sink Bases and two Side Shelves: the builder's cards, its "+" and the in-scene
 * menu add no more. They count the placed products by cabinet type, which the scene id of a
 * collection other than Urban does not spell (`Mako-sink-cabinet-…`).
 */

const udProfile = (() => {
  const result = parseProductProfile(udProfileDocument);
  if (!result.ok) throw new Error("the packaged Urban Duplex profile must parse");

  return result.profile;
})();

const udRuntimeBindings = (() => {
  const result = parseRuntimeBindings(udRuntimeBindingsDocument);
  if (!result.ok) throw new Error("the packaged Urban Duplex runtime bindings must parse");

  return result.bindings;
})();

const place = (profile: ProductProfile, bindings: RuntimeBindingSet, ids: string[]) => {
  store.dispatch(replaceCollectionData({ profile, cabinetCatalog: null }));
  store.dispatch(setActiveRuntimeBindings(bindings));
  ids.forEach((id) => store.dispatch(addProductId(id)));
};

/** The cabinet types at their limit, each with the reason code it gives. */
const limits = () => {
  const atLimit = selectCabinetTypesAtLimit(store.getState());
  return Object.fromEntries(Object.entries(atLimit).map(([cabinetType, limit]) => [cabinetType, limit?.code]));
};

beforeEach(() => {
  store.dispatch(reset());
  store.dispatch(resetConfiguration());
});

describe("cabinet types at their limit", () => {
  it("counts the Urban Standard Height Sink Bases and Side Shelves", () => {
    place(ushProfile, ushRuntimeBindings, ["Sink-Base-a1", "Sink-Base-b2", "Side-Shelf-c3", "Sink-Cabinet-d4"]);

    expect(limits()).toEqual({ "Sink-Base": "cabinet.sinkBaseLimit" });
  });

  it("counts the Sink Bases of a collection whose scene names them otherwise", () => {
    place(makoProfile, makoRuntimeBindings, ["Mako-sink-cabinet-a1", "Mako-side-cabinet-b2", "Mako-sink-cabinet-c3"]);

    expect(limits()).toEqual({ "Sink-Base": "cabinet.sinkBaseLimit" });
  });

  it("leaves a type below its limit open", () => {
    place(makoProfile, makoRuntimeBindings, ["Mako-sink-cabinet-a1", "Mako-side-cabinet-b2"]);

    expect(limits()).toEqual({});
  });

  it("tells the Side Shelves from the Open Shelves whose scene type starts their name", () => {
    // Urban Duplex places a Side Shelf as `UD-open-shelves-side`, an Open Shelf as `UD-open-shelves`.
    place(udProfile, udRuntimeBindings, [
      "UD-sink-cabinet-a1",
      "UD-open-shelves-side-b2",
      "UD-open-shelves-c3",
      "UD-open-shelves-side-d4",
    ]);

    expect(limits()).toEqual({ "Side-Shelf": "cabinet.sideShelfLimit" });
  });

  it("gives the text a collection without a message of its own shows", () => {
    place(ushProfile, ushRuntimeBindings, ["Sink-Base-a1", "Sink-Base-b2"]);

    expect(selectCabinetTypesAtLimit(store.getState())["Sink-Base"]).toEqual({
      code: "cabinet.sinkBaseLimit",
      text: "Vanity configurations allow a maximum of two Sink Base units.",
    });
  });

  it("answers with the same object while the cabinets stay the same", () => {
    place(ushProfile, ushRuntimeBindings, ["Sink-Base-a1", "Sink-Base-b2"]);

    expect(selectCabinetTypesAtLimit(store.getState())).toBe(selectCabinetTypesAtLimit(store.getState()));
  });

  it("counts nothing while no collection is active", () => {
    store.dispatch(replaceCollectionData({ profile: null, cabinetCatalog: null }));
    store.dispatch(setActiveRuntimeBindings(null));
    store.dispatch(addProductId("Sink-Base-a1"));
    store.dispatch(addProductId("Sink-Base-b2"));

    expect(limits()).toEqual({});
  });
});
