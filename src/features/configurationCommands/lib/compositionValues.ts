import type { RootState } from "@/app/store";
import { selectDefaultValue } from "@/entities/collection";
import {
  compositionValueOf,
  getActiveProductProfile,
  getActiveRuntimeBindings,
  getCabinetEntries,
  getValuesByAttributeId,
} from "@/entities/configuration";
import type { AttributeValue } from "@/entities/configuration";

import { isBroadcastCabinetValue } from "./commitChange";

/**
 * The values every cabinet of the composition holds, for a cabinet that joins it.
 *
 * For each value the scene gives all cabinets at once (`isBroadcastCabinetValue`): what the
 * composition holds, or the collection's starting value while nothing was recorded yet. A value
 * recorded as empty stays empty: legs that were switched off are not put back by a default.
 */
export const selectBroadcastValues = (state: RootState): Record<string, AttributeValue> => {
  const profile = getActiveProductProfile(state);
  const bindings = getActiveRuntimeBindings(state);
  if (!profile || !bindings) return {};

  const recorded = getValuesByAttributeId(state);
  const firstCabinetId = getCabinetEntries(state)[0]?.stableKey;

  return Object.fromEntries(
    profile.attributes.flatMap(({ attributeId }): [string, AttributeValue][] => {
      if (!isBroadcastCabinetValue(profile, bindings, attributeId)) return [];

      const held = compositionValueOf(recorded[attributeId], firstCabinetId);
      const value = held === undefined ? selectDefaultValue(profile, attributeId) : held;
      return value === null || value === "" ? [] : [[attributeId, value]];
    }),
  );
};
