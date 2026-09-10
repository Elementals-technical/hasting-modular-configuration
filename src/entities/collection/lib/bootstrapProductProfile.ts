import ushProfileDocument from "../data/ush-product-profile.phase1.json";
import { parseProductProfile } from "./parseProductProfile";
import type { ProfileDiagnostic } from "./parseProductProfile";
import type { ProductProfile } from "../model/productProfile";

/**
 * Phase 1 source of the active ProductProfile: the packaged USH document.
 *
 * CONTRACTS §4 allows the packaged registry as a bootstrap fallback. This is that
 * fallback and nothing more — it must be replaced by the collection loader (A06) as soon
 * as `useActiveCollection()` can supply the profile of whichever collection is active.
 * It deliberately does not pick a collection: it returns the one document in the package.
 *
 * TODO(A06): read the profile from the active collection instead of this import, and
 * add the `productProfile` entry to `CollectionManifest.localData`.
 */

export type BootstrapProductProfileResult =
  | { ok: true; profile: ProductProfile }
  | { ok: false; diagnostics: ProfileDiagnostic[] };

let cached: BootstrapProductProfileResult | null = null;

export const loadPackagedProductProfile = (): BootstrapProductProfileResult => {
  if (!cached) {
    cached = parseProductProfile(ushProfileDocument);
  }

  return cached;
};

/** The packaged profile, or null when the packaged document fails validation. */
export const getPackagedProductProfile = (): ProductProfile | null => {
  const result = loadPackagedProductProfile();
  return result.ok ? result.profile : null;
};
