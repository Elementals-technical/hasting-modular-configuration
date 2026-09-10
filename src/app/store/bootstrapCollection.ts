import { getPackagedProductProfile, loadPackagedProductProfile } from "@/entities/collection";
import { setActiveCollectionId } from "@/entities/configuration/model/store/slice";
import { setActiveProfile } from "@/entities/product/model/store/slice";

import type { store as AppStore } from "./index";

/**
 * Puts the packaged collection profile into the store at startup.
 *
 * This is the phase-1 stand-in for the collection loader: consumers already read the
 * profile through `getActiveProductProfile`, so replacing this with A's
 * `useActiveCollection()` result does not touch them.
 *
 * TODO(A06): drive this from the resolved active collection instead of the packaged file.
 */
export const bootstrapActiveCollection = (store: typeof AppStore): void => {
  const result = loadPackagedProductProfile();

  if (!result.ok) {
    // A missing or malformed packaged profile must be visible, not silently swallowed:
    // without it every catalog is empty and the configurator offers nothing.
    console.error("[collection] packaged ProductProfile failed validation", result.diagnostics);
    return;
  }

  store.dispatch(setActiveCollectionId(result.profile.collectionId));
  store.dispatch(setActiveProfile(getPackagedProductProfile()));
};
