import { beforeEach, describe, expect, it } from "vitest";

import classProfileDocument from "../../../../public/collections/class/product-profile.json";
import ulhProfileDocument from "../../../../public/collections/urban-low-height/product-profile.json";
import lameBindingsDocument from "../../../../public/collections/lame/runtime-bindings.json";
import lameProfileDocument from "../../../../public/collections/lame/product-profile.json";
import { store } from "@/app/store";
import type { ProductProfile, RuntimeBindingSet } from "@/entities/collection";
import { makoProfile } from "@/entities/collection/__tests__/makoProfileFixture";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import { parseProductProfile } from "@/entities/collection/lib/parseProductProfile";
import { classRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/classRuntimeBindingsFixture";
import { makoRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/makoRuntimeBindingsFixture";
import { ulhRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/ulhRuntimeBindingsFixture";
import { ushRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/ushRuntimeBindingsFixture";
import { parseRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/parseRuntimeBindings";
import {
  resetConfiguration,
  setActiveCollectionId,
  setActiveRuntimeBindings,
  setAttributeValue,
  syncCabinets,
} from "@/entities/configuration";
import { reset, setActiveProfile } from "@/entities/product/model/store/slice";

import { isBroadcastCabinetValue } from "../lib/commitChange";
import { selectBroadcastValues } from "../lib/compositionValues";

/**
 * Which values belong to the whole composition is read from the collection's own data: a
 * cabinet value its binding sends to every cabinet. No collection or attribute is named in code.
 */

const profileOf = (document: unknown): ProductProfile => {
  const parsed = parseProductProfile(document);
  if (!parsed.ok) throw new Error("the packaged profile must parse");
  return parsed.profile;
};
const bindingsOf = (document: unknown): RuntimeBindingSet => {
  const parsed = parseRuntimeBindings(document);
  if (!parsed.ok) throw new Error("the packaged bindings must parse");
  return parsed.bindings;
};

const broadcastOf = (profile: ProductProfile, bindings: RuntimeBindingSet) =>
  profile.attributes
    .map(({ attributeId }) => attributeId)
    .filter((attributeId) => isBroadcastCabinetValue(profile, bindings, attributeId));

describe("isBroadcastCabinetValue", () => {
  it("finds the handle and leg colours of Mako, which its scene paints on every cabinet", () => {
    expect(broadcastOf(makoProfile, makoRuntimeBindings)).toEqual(["HandleColor", "LegColor"]);
  });

  it("leaves a value with a typed projection on its own path, though the scene broadcasts it too", () => {
    expect(isBroadcastCabinetValue(makoProfile, makoRuntimeBindings, "Handle")).toBe(false);
    expect(isBroadcastCabinetValue(ushProfile, ushRuntimeBindings, "HandleGrooveColor")).toBe(false);
  });

  it("finds none in the Urban collections or in Class", () => {
    expect(broadcastOf(ushProfile, ushRuntimeBindings)).toEqual([]);
    expect(broadcastOf(profileOf(ulhProfileDocument), ulhRuntimeBindings)).toEqual([]);
    expect(broadcastOf(profileOf(classProfileDocument), classRuntimeBindings)).toEqual([]);
  });

  it("does not count a value the scene never receives", () => {
    // Lamè records its handle and leg colours without a scene call.
    expect(broadcastOf(profileOf(lameProfileDocument), bindingsOf(lameBindingsDocument))).toEqual([]);
  });

  it("does not count a value of another scope, or any value without the collection's bindings", () => {
    expect(isBroadcastCabinetValue(makoProfile, makoRuntimeBindings, "CabinetColor")).toBe(false);
    expect(isBroadcastCabinetValue(makoProfile, null, "HandleColor")).toBe(false);
    expect(isBroadcastCabinetValue(null, makoRuntimeBindings, "HandleColor")).toBe(false);
  });
});

describe("selectBroadcastValues", () => {
  const open = (profile: ProductProfile, collectionId: string, bindings: RuntimeBindingSet) => {
    store.dispatch(setActiveProfile(profile));
    store.dispatch(setActiveCollectionId(collectionId));
    store.dispatch(setActiveRuntimeBindings(bindings));
  };
  const record = (attributeId: string, cabinetId: string, value: string) =>
    store.dispatch(setAttributeValue({ attributeId, target: { scope: "cabinet", cabinetId }, value }));

  beforeEach(() => {
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
    open(makoProfile, "mako", makoRuntimeBindings);
  });

  it("starts an empty composition at the collection's own values", () => {
    // Mako starts its handles in a colour; its legs have no starting value, so none is given.
    expect(selectBroadcastValues(store.getState())).toEqual({ HandleColor: "Antracite 400 MT" });
  });

  it("gives what the composition holds, over the collection's starting value", () => {
    store.dispatch(syncCabinets(["Mako-sink-cabinet-a", "Mako-side-cabinet-b"]));
    record("HandleColor", "cab-1", "Gold");
    record("LegColor", "cab-1", "None");

    expect(selectBroadcastValues(store.getState())).toEqual({ HandleColor: "Gold", LegColor: "None" });
  });

  it("gives nothing for a value recorded as empty: legs switched off stay off", () => {
    store.dispatch(syncCabinets(["Mako-sink-cabinet-a"]));
    record("LegColor", "cab-1", "");
    record("HandleColor", "cab-1", "");

    expect(selectBroadcastValues(store.getState())).toEqual({});
  });

  it("gives nothing in a collection without such values", () => {
    open(ushProfile, "urban-standard-height", ushRuntimeBindings);

    expect(selectBroadcastValues(store.getState())).toEqual({});
  });
});
