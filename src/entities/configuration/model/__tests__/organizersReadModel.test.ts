import { describe, expect, it } from "vitest";

import { store } from "@/app/store";
import contractFixture from "@/features/drawerOrganizers/__tests__/fixtures/contract/contract.v1.json";

import { readDrawerOrganizers, type DrawerOrganizersRead } from "../drawerOrganizers";
import { getConfigurationSnapshot, getOrganizersByCabinet } from "../store/selectors";
import {
  configurationReducer,
  recordOrganizers,
  recordSceneState,
  resetConfiguration,
  restoreCabinets,
  restoreConfigurationFragment,
  syncCabinets,
} from "../store/slice";
import type { ConfigurationState } from "../types";

/**
 * `configuration.organizersByCabinet`: a read-only copy of each product's `DrawerOrganizers` scene key
 * (concept §6.2, OPUS-C §4.5). It follows receipts, scene events and the scene reader, never the snapshot.
 */

const stateOfCase = (name: string): DrawerOrganizersRead => {
  const found = contractFixture.cases.find((testCase) => testCase.name === name);
  if (!found) throw new Error(`no contract case ${name}`);
  return readDrawerOrganizers(found.expected.state);
};

const SC120 = stateOfCase("sc120-example1");
const SB60 = stateOfCase("sb60-example2");
const SIZE = { width: 60, height: 50, depth: 46 };

const placed = (...runtimeIds: string[]): ConfigurationState =>
  configurationReducer(undefined, syncCabinets(runtimeIds));

describe("recordOrganizers", () => {
  it("records what the scene holds, by stable key", () => {
    const next = configurationReducer(placed("rt-a", "rt-b"), recordOrganizers({ stableKey: "cab-2", entry: SC120 }));

    expect(next.organizersByCabinet).toEqual({ "cab-2": SC120 });
    expect(SC120.status).toBe("ok");
  });

  it("removes the entry of a product whose organizers are gone (absent is never kept)", () => {
    const withEntry = configurationReducer(placed("rt-a"), recordOrganizers({ stableKey: "cab-1", entry: SC120 }));

    const next = configurationReducer(withEntry, recordOrganizers({ stableKey: "cab-1", entry: { status: "absent" } }));

    expect(next.organizersByCabinet).toEqual({});
    expect(
      configurationReducer(placed("rt-a"), recordOrganizers({ stableKey: "cab-1", entry: { status: "absent" } })),
    ).toEqual(placed("rt-a"));
  });

  it("keeps the reference of an entry the scene reports again unchanged", () => {
    const withEntry = configurationReducer(placed("rt-a"), recordOrganizers({ stableKey: "cab-1", entry: SC120 }));

    const next = configurationReducer(
      withEntry,
      recordOrganizers({ stableKey: "cab-1", entry: structuredClone(SC120) }),
    );

    expect(next).toBe(withEntry);
    expect(next.organizersByCabinet["cab-1"]).toBe(withEntry.organizersByCabinet["cab-1"]);
  });

  it("keeps data of a newer build as unsupported, never as empty", () => {
    const entry: DrawerOrganizersRead = { status: "unsupported-version", version: 2 };
    const next = configurationReducer(placed("rt-a"), recordOrganizers({ stableKey: "cab-1", entry }));

    expect(next.organizersByCabinet["cab-1"]).toEqual(entry);
  });
});

describe("recordSceneState and the organizers copy", () => {
  it("leaves a product without the key (USH and every other collection) on the same path, with the same objects", () => {
    const before = configurationReducer(
      placed("rt-a", "rt-b"),
      recordSceneState({ order: ["rt-a", "rt-b"], cabinets: [{ runtimeId: "rt-a", dimensions: SIZE }] }),
    );

    const after = configurationReducer(
      before,
      recordSceneState({ order: ["rt-a", "rt-b"], cabinets: [{ runtimeId: "rt-a", dimensions: { ...SIZE } }] }),
    );

    expect(after).toBe(before);
    expect(after.cabinets).toBe(before.cabinets);
    expect(after.dimensionsByCabinet).toBe(before.dimensionsByCabinet);
    expect(after.organizersByCabinet).toBe(before.organizersByCabinet);
  });

  it("records the key the reader saw, removes one that reads absent, and keeps a product it did not report", () => {
    let state = configurationReducer(
      placed("rt-a", "rt-b", "rt-c"),
      recordOrganizers({ stableKey: "cab-2", entry: SB60 }),
    );
    state = configurationReducer(state, recordOrganizers({ stableKey: "cab-3", entry: SC120 }));

    state = configurationReducer(
      state,
      recordSceneState({
        order: ["rt-a", "rt-b", "rt-c"],
        cabinets: [
          { runtimeId: "rt-a", dimensions: SIZE, organizers: SC120 },
          { runtimeId: "rt-b", dimensions: SIZE, organizers: { status: "absent" } },
        ],
      }),
    );

    expect(state.organizersByCabinet).toEqual({ "cab-1": SC120, "cab-3": SC120 });
  });

  it("drops an entry left for a product that is no longer placed", () => {
    // E.g. a receipt recorded for a cabinet removed while the command ran.
    let state = configurationReducer(placed("rt-a"), recordOrganizers({ stableKey: "cab-9", entry: SB60 }));

    state = configurationReducer(state, recordSceneState({ order: ["rt-a"], cabinets: [] }));

    expect(state.organizersByCabinet).toEqual({});
  });
});

describe("cleaning the copy by stable key", () => {
  it("drops a removed product's entry when the cabinets are synced", () => {
    const state = configurationReducer(placed("rt-a", "rt-b"), recordOrganizers({ stableKey: "cab-2", entry: SB60 }));

    expect(configurationReducer(state, syncCabinets(["rt-a"])).organizersByCabinet).toEqual({});
  });

  it("drops entries of products a restored fragment does not have", () => {
    let state = configurationReducer(placed("rt-a", "rt-b"), recordOrganizers({ stableKey: "cab-1", entry: SC120 }));
    state = configurationReducer(state, recordOrganizers({ stableKey: "cab-2", entry: SB60 }));

    state = configurationReducer(
      state,
      restoreConfigurationFragment({ values: {}, cabinets: [{ stableKey: "cab-2", runtimeId: "rt-b", index: 0 }] }),
    );

    expect(state.organizersByCabinet).toEqual({ "cab-2": SB60 });
  });

  it("empties the copy when the scene is rebuilt (undo, redo, restore): the reader fills it again", () => {
    let state = configurationReducer(placed("rt-a"), recordOrganizers({ stableKey: "cab-1", entry: SC120 }));

    state = configurationReducer(state, restoreCabinets({ stableKeys: ["cab-1"], runtimeIds: ["rt-new"] }));
    expect(state.organizersByCabinet).toEqual({});

    state = configurationReducer(
      state,
      recordSceneState({ order: ["rt-new"], cabinets: [{ runtimeId: "rt-new", dimensions: SIZE, organizers: SC120 }] }),
    );
    expect(state.organizersByCabinet).toEqual({ "cab-1": SC120 });
  });
});

describe("the copy is not saved", () => {
  it("is in neither the snapshot nor reset state", () => {
    store.dispatch(resetConfiguration());
    store.dispatch(syncCabinets(["rt-a"]));
    store.dispatch(recordOrganizers({ stableKey: "cab-1", entry: SC120 }));

    expect(getOrganizersByCabinet(store.getState())).toEqual({ "cab-1": SC120 });
    expect(JSON.stringify(getConfigurationSnapshot(store.getState()))).not.toContain("columns");

    store.dispatch(resetConfiguration());
    expect(getOrganizersByCabinet(store.getState())).toEqual({});
  });
});
