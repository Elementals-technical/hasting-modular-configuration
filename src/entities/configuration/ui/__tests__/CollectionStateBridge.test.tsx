// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { Provider } from "react-redux";
import { beforeEach, describe, expect, it } from "vitest";

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
  typeCabinetRules: [
    { code: "Sink-Base", widths: [60], depths: [46], heights: [56], drawers: ["1", "2"] },
  ],
};

const readyState = (overrides: Partial<LoadedCollectionData> = {}): ActiveCollectionState => ({
  status: "ready",
  collectionId: "urban-standard-height",
  data: {
    id: "urban-standard-height",
    manifest: { id: "urban-standard-height", label: "USH", defaults: {} },
    sources: { local: {}, remote: {} },
    catalog: { productProfile: ushProfile, cabinets },
    ...overrides,
  } as LoadedCollectionData,
});

const renderBridge = (state: ActiveCollectionState) =>
  render(
    <Provider store={store}>
      <ActiveCollectionContext.Provider value={state}>
        <CollectionStateBridge />
      </ActiveCollectionContext.Provider>
    </Provider>,
  );

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

  it("writes nothing while the collection is still resolving", () => {
    renderBridge({ status: "resolving" });

    const state = store.getState();
    expect(getActiveCollectionId(state)).toBeNull();
    expect(getActiveProductProfile(state)).toBeNull();
  });

  it("writes nothing when the collection failed to load", () => {
    renderBridge({
      status: "error",
      collectionId: "mako",
      error: { code: "unknown-collection", message: "Unknown collection: mako" },
    });

    // A failed load must not leave the previous collection's data in place either.
    expect(getActiveCollectionId(store.getState())).toBeNull();
    expect(getActiveProductProfile(store.getState())).toBeNull();
  });

  it("does not dispatch a catalog the collection did not provide", () => {
    renderBridge(readyState({ catalog: { productProfile: ushProfile } }));

    const state = store.getState();
    expect(getActiveProductProfile(state)).not.toBeNull();
    // The previous catalog stays rather than being replaced by an empty one.
    expect(getCabinetCatalog(state).typeCabinetRules).toEqual([]);
  });
});
