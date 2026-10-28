import { configureStore } from "@reduxjs/toolkit";
import type { ReactNode } from "react";
import { Provider } from "react-redux";

import { rootReducer } from "@/app/store/reducer";
import classProfileDocument from "../../../../public/collections/class/product-profile.json";
import { parseProductProfile } from "@/entities/collection/lib/parseProductProfile";
import { recordOrganizers, syncCabinets, type CabinetEntry } from "@/entities/configuration";
import type { DrawerOrganizersRead } from "@/entities/configuration/model/drawerOrganizers";
import { addProductId, setActiveProfile } from "@/entities/product/model/store/slice";

/**
 * A fresh store per test for the organizer hooks (the UI slice keeps busy / notice between tests otherwise),
 * with the Class profile, which offers organizers. Test helper, not a test file.
 */

export const classProfile = (() => {
  const parsed = parseProductProfile(classProfileDocument);
  if (!parsed.ok) throw new Error("class profile failed validation");
  return parsed.profile;
})();

export const createOrganizerTestStore = ({ runtimeIds = ["rt-1", "rt-2"], profile = classProfile } = {}) => {
  const store = configureStore({
    reducer: rootReducer,
    middleware: (getDefault) => getDefault({ serializableCheck: false, immutableCheck: false }),
  });
  store.dispatch(setActiveProfile(profile));
  // An empty composition starts the history over, so the products are placed for a step to be written.
  for (const runtimeId of runtimeIds) store.dispatch(addProductId(runtimeId));
  store.dispatch(syncCabinets(runtimeIds));
  return store;
};

export type OrganizerTestStore = ReturnType<typeof createOrganizerTestStore>;

export const withStore =
  (store: OrganizerTestStore) =>
  ({ children }: { children: ReactNode }) => <Provider store={store}>{children}</Provider>;

export const record = (store: OrganizerTestStore, stableKey: string, entry: DrawerOrganizersRead) =>
  store.dispatch(recordOrganizers({ stableKey, entry }));

export const ui = (store: OrganizerTestStore) => store.getState().rootStateUI.drawerOrganizersUi;
export const organizers = (store: OrganizerTestStore) => store.getState().rootStateUI.configuration.organizersByCabinet;
export const steps = (store: OrganizerTestStore) => store.getState().rootStateUI.history.past.length;
export const cabinets = (store: OrganizerTestStore): CabinetEntry[] =>
  store.getState().rootStateUI.configuration.cabinets;
