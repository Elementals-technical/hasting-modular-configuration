import makoProfileDocument from "../../../../public/collections/mako/product-profile.json";

import { parseProductProfile } from "../lib/parseProductProfile";
import type { ProductProfile } from "../model/productProfile";

/**
 * The production Mako profile, parsed once for tests.
 *
 * Tests read the very document the loader serves, so a change to the shipped profile
 * shows up as a failing expectation rather than passing against a stale copy.
 */
export const makoProfile: ProductProfile = (() => {
  const result = parseProductProfile(makoProfileDocument);

  if (!result.ok) {
    throw new Error(
      `Packaged Mako profile failed validation: ${result.diagnostics.map(({ dataPath }) => dataPath).join(", ")}`,
    );
  }

  return result.profile;
})();
