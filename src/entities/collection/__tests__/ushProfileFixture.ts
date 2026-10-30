import ushProfileDocument from "../../../../public/collections/urban-standard-height/product-profile.json";

import { parseProductProfile } from "../lib/parseProductProfile";
import type { ProductProfile } from "../model/productProfile";

/**
 * The production USH profile, parsed once for tests.
 *
 * Tests read the very document the loader serves, so a change to the shipped profile
 * shows up as a failing expectation rather than passing against a stale copy.
 */
export const ushProfile: ProductProfile = (() => {
  const result = parseProductProfile(ushProfileDocument);

  if (!result.ok) {
    throw new Error(
      `Packaged USH profile failed validation: ${result.diagnostics.map(({ dataPath }) => dataPath).join(", ")}`,
    );
  }

  return result.profile;
})();
