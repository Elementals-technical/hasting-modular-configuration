import { beforeEach, describe, expect, it } from "vitest";

import { store } from "@/app/store";
import type { ProductProfile, RuntimeBindingSet } from "@/entities/collection";
import { makoProfile } from "@/entities/collection/__tests__/makoProfileFixture";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import { makoRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/makoRuntimeBindingsFixture";
import { ushRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/ushRuntimeBindingsFixture";
import { resetConfiguration, setActiveRuntimeBindings } from "@/entities/configuration";

import { getSideShelfCount, getSinkBaseCount } from "../selectors";
import { addProductId, replaceCollectionData, reset } from "../slice";

/**
 * The builder and the in-scene menu allow two Sink Bases and two Side Shelves. They count the
 * placed products by cabinet type, which the scene id of a collection other than Urban does not
 * spell (`Mako-sink-cabinet-…`).
 */

const place = (profile: ProductProfile, bindings: RuntimeBindingSet, ids: string[]) => {
  store.dispatch(replaceCollectionData({ profile, cabinetCatalog: null }));
  store.dispatch(setActiveRuntimeBindings(bindings));
  ids.forEach((id) => store.dispatch(addProductId(id)));
};

beforeEach(() => {
  store.dispatch(reset());
  store.dispatch(resetConfiguration());
});

describe("placed cabinet counts", () => {
  it("counts the Urban Standard Height Sink Bases and Side Shelves", () => {
    place(ushProfile, ushRuntimeBindings, ["Sink-Base-a1", "Sink-Base-b2", "Side-Shelf-c3", "Sink-Cabinet-d4"]);

    expect(getSinkBaseCount(store.getState())).toBe(2);
    expect(getSideShelfCount(store.getState())).toBe(1);
  });

  it("counts the Sink Bases of a collection whose scene names them otherwise", () => {
    place(makoProfile, makoRuntimeBindings, ["Mako-sink-cabinet-a1", "Mako-side-cabinet-b2", "Mako-sink-cabinet-c3"]);

    expect(getSinkBaseCount(store.getState())).toBe(2);
    expect(getSideShelfCount(store.getState())).toBe(0);
  });

  it("counts nothing while no collection is active", () => {
    store.dispatch(replaceCollectionData({ profile: null, cabinetCatalog: null }));
    store.dispatch(setActiveRuntimeBindings(null));
    store.dispatch(addProductId("Sink-Base-a1"));

    expect(getSinkBaseCount(store.getState())).toBe(0);
  });
});
