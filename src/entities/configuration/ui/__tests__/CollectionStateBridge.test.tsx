// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { Provider } from "react-redux";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { store } from "@/app/store";
import { ActiveCollectionContext, type ActiveCollectionState, type LoadedCollectionData } from "@/entities/collection";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import { getActiveCollectionId, getActiveProductProfile } from "@/entities/configuration";
import { getCabinetCatalog } from "@/entities/product/model/store/selectors";
import { reset, setActiveProfile, setCabinetCatalog } from "@/entities/product/model/store/slice";
import type { ConfiguratorCatalog } from "@/shared/config/configurator/typeCabinetCatalog";

import { CollectionStateBridge } from "../CollectionStateBridge";
import { resetConfiguration, setActiveCollectionId } from "../../model/store/slice";

const cabinets: ConfiguratorCatalog = {
  typeCabinetRules: [{ code: "Sink-Base", widths: [60], depths: [46], heights: [56], drawers: ["1", "2"] }],
};

const readyState = (overrides: Partial<LoadedCollectionData> = {}): ActiveCollectionState => {
  const data = {
    id: "urban-standard-height",
    manifest: { id: "urban-standard-height", label: "USH", defaults: {} },
    diagnostics: [],
    sources: { local: {}, remote: {} },
    catalog: { productProfile: ushProfile, cabinets },
    ...overrides,
  } as LoadedCollectionData;

  return { status: "ready", collectionId: data.id, data };
};

const bridgeTree = (state: ActiveCollectionState) => (
  <Provider store={store}>
    <ActiveCollectionContext.Provider value={state}>
      <CollectionStateBridge />
    </ActiveCollectionContext.Provider>
  </Provider>
);

const renderBridge = (state: ActiveCollectionState) => render(bridgeTree(state));

const populateUshCollectionData = () => {
  store.dispatch(setActiveCollectionId("urban-standard-height"));
  store.dispatch(setActiveProfile(ushProfile));
  store.dispatch(setCabinetCatalog(cabinets));
};

afterEach(cleanup);

describe("CollectionStateBridge", () => {
  beforeEach(() => {
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
    store.dispatch(setActiveCollectionId(null));
    // `reset` deliberately keeps the active collection's profile and catalog, so a test
    // starting from "no collection" has to clear them explicitly.
    store.dispatch(setActiveProfile(null));
    store.dispatch(setCabinetCatalog({ typeCabinetRules: [] }));
  });

  it("publishes the ready collection into the store", () => {
    renderBridge(readyState());

    const state = store.getState();
    expect(getActiveCollectionId(state)).toBe("urban-standard-height");
    expect(getActiveProductProfile(state)?.collectionId).toBe("urban-standard-height");
    expect(getCabinetCatalog(state).typeCabinetRules).toHaveLength(1);
  });

  it("clears a previous ready collection while the next identity is resolving", () => {
    populateUshCollectionData();
    renderBridge({ status: "resolving" });

    const state = store.getState();
    expect(getActiveCollectionId(state)).toBeNull();
    expect(getActiveProductProfile(state)).toBeNull();
    expect(getCabinetCatalog(state).typeCabinetRules).toEqual([]);
    expect(state.rootStateUI.product.productOptions.CabinetColor).toBe("");
    expect(state.rootStateUI.product.productOptions.CountertopColor).toBe("");
  });

  it("clears a previous ready collection while the next collection is loading", () => {
    populateUshCollectionData();
    renderBridge({ status: "loading", collectionId: "fixture-ui" });

    const state = store.getState();
    expect(getActiveCollectionId(state)).toBeNull();
    expect(getActiveProductProfile(state)).toBeNull();
    expect(getCabinetCatalog(state).typeCabinetRules).toEqual([]);
    expect(state.rootStateUI.product.productOptions.CabinetColor).toBe("");
  });

  it("clears a previous ready collection when the next collection fails", () => {
    populateUshCollectionData();
    renderBridge({
      status: "error",
      collectionId: "mako",
      error: { code: "unknown-collection", message: "Unknown collection: mako" },
    });

    // A failed load must not leave the previous collection's data in place either.
    expect(getActiveCollectionId(store.getState())).toBeNull();
    expect(getActiveProductProfile(store.getState())).toBeNull();
    expect(getCabinetCatalog(store.getState()).typeCabinetRules).toEqual([]);
    expect(store.getState().rootStateUI.product.productOptions.CabinetColor).toBe("");
  });

  it("replaces defaults and clears a catalog omitted by the next ready collection", () => {
    populateUshCollectionData();
    const fixtureProfile = {
      ...ushProfile,
      collectionId: "fixture-ui",
      defaults: { CabinetColor: "Fixture Blue" },
    };
    renderBridge(
      readyState({
        id: "fixture-ui",
        manifest: { id: "fixture-ui", label: "Fixture UI", defaults: {} },
        catalog: { productProfile: fixtureProfile },
      }),
    );

    const state = store.getState();
    expect(getActiveCollectionId(state)).toBe("fixture-ui");
    expect(getActiveProductProfile(state)?.collectionId).toBe("fixture-ui");
    expect(state.rootStateUI.product.productOptions.CabinetColor).toBe("Fixture Blue");
    expect(state.rootStateUI.product.productOptions.CountertopColor).toBe("");
    expect(getCabinetCatalog(state).typeCabinetRules).toEqual([]);
  });

  it("clears published collection data when the bridge unmounts", () => {
    const view = renderBridge(readyState());
    expect(getActiveCollectionId(store.getState())).toBe("urban-standard-height");

    view.unmount();

    expect(getActiveCollectionId(store.getState())).toBeNull();
    expect(getActiveProductProfile(store.getState())).toBeNull();
    expect(getCabinetCatalog(store.getState()).typeCabinetRules).toEqual([]);
  });

  it("clears ready data when the same mounted bridge receives an error", () => {
    const view = renderBridge(readyState());
    expect(getActiveCollectionId(store.getState())).toBe("urban-standard-height");

    view.rerender(
      bridgeTree({
        status: "error",
        collectionId: "unknown",
        error: { code: "unknown-collection", message: "Unknown collection" },
      }),
    );

    expect(getActiveCollectionId(store.getState())).toBeNull();
    expect(getActiveProductProfile(store.getState())).toBeNull();
  });
});
