import type { RootState } from "@/app/store";
import { selectDefaultValue, selectRuntimeBinding } from "@/entities/collection";
import {
  compositionValueOf,
  getActiveProductProfile,
  getActiveRuntimeBindings,
  getCabinetEntries,
  getValuesByAttributeId,
} from "@/entities/configuration";
import type { AttributeValue } from "@/entities/configuration";

import { isBroadcastCabinetValue, TYPED_COMMIT_ATTRIBUTE_IDS } from "./commitChange";

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

/**
 * The configuration's values a product placed later is given with its config
 * (`placedWithNewProducts` of the binding): the panel colours of Urban Duplex, which the scene
 * keeps per product. What the configuration holds, or the collection's starting value while
 * nothing was chosen; a value recorded as empty stays empty.
 *
 * Unlike `selectBroadcastValues` these are not recorded at the new cabinet: the configuration
 * already holds them once for all.
 *
 * `chosenOnly` leaves the starting values out: a model is placed with its own colours unless
 * the configuration holds a choice, which then goes on every product of the model.
 */
export const selectPlacedWithValues = (
  state: RootState,
  { chosenOnly = false }: { chosenOnly?: boolean } = {},
): Record<string, AttributeValue> => {
  const profile = getActiveProductProfile(state);
  const bindings = getActiveRuntimeBindings(state);
  if (!profile || !bindings) return {};

  const recorded = getValuesByAttributeId(state);
  const firstCabinetId = getCabinetEntries(state)[0]?.stableKey;

  return Object.fromEntries(
    profile.attributes.flatMap(({ attributeId }): [string, AttributeValue][] => {
      const binding = selectRuntimeBinding(bindings, attributeId);
      if (binding?.status !== "bound" || !binding.placedWithNewProducts) return [];
      // A value with a typed projection travels in the builder's own config; a cabinet value the
      // scene broadcasts is inherited and recorded by `selectBroadcastValues`.
      if (TYPED_COMMIT_ATTRIBUTE_IDS.includes(attributeId)) return [];
      if (isBroadcastCabinetValue(profile, bindings, attributeId)) return [];

      const held = compositionValueOf(recorded[attributeId], firstCabinetId);
      const value = held !== undefined ? held : chosenOnly ? null : selectDefaultValue(profile, attributeId);
      return value === null || value === "" ? [] : [[attributeId, value]];
    }),
  );
};
