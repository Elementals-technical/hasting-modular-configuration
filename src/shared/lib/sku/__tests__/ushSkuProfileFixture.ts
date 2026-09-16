import ushCabinetSkuMappings from "../../../../../public/collections/urban-standard-height/cabinet-sku-mappings.json";

import { resolveSkuProfile } from "../resolveSkuProfile";
import type { SkuProfile } from "../skuProfile";

/**
 * The USH SKU profile, resolved from the mappings the collection ships.
 *
 * Tests read the very file A loads, so a change to the shipped mappings shows up as a
 * failing SKU expectation rather than passing against a copy.
 */
export const ushSkuProfile: SkuProfile = (() => {
  const resolution = resolveSkuProfile({ id: "urban-standard-height", cabinetSkuMappings: ushCabinetSkuMappings });

  if (resolution.status !== "ready") {
    throw new Error(`USH SKU profile did not resolve: ${resolution.reason}`);
  }

  return resolution.profile;
})();
