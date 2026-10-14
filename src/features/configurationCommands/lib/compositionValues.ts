import type { RootState } from "@/app/store";
import { selectAttribute, selectDefaultValue, selectRuntimeBinding } from "@/entities/collection";
import {
  compositionValueOf,
  getActiveProductProfile,
  getActiveRuntimeBindings,
  getCabinetEntries,
  getValuesByAttributeId,
  isSameTarget,
} from "@/entities/configuration";
import type { AttributeValue } from "@/entities/configuration";
import type { ProductProfile, RuntimeBindingSet } from "@/entities/collection";

import { isBroadcastCabinetValue, TYPED_COMMIT_ATTRIBUTE_IDS } from "./commitChange";

/** Sizes are read from the scene and drawer styles go with the composition, so neither is carried. */
export const NOT_CARRIED_ATTRIBUTE_IDS: ReadonlySet<string> = new Set(["Width", "Height", "Depth", "Drawers"]);

/**
 * A cabinet value that is the cabinet's alone: its binding addresses one product, so the scene
 * never gives it to the others, and the state holds it at that cabinet (the series of an Urban
 * Duplex cabinet). A size, the drawers and a value with a typed projection have their own path.
 */
export const isOwnCabinetValue = (
  profile: ProductProfile | null,
  bindings: RuntimeBindingSet | null | undefined,
  attributeId: string,
): boolean => {
  if (NOT_CARRIED_ATTRIBUTE_IDS.has(attributeId) || TYPED_COMMIT_ATTRIBUTE_IDS.includes(attributeId)) return false;
  if (selectAttribute(profile, attributeId)?.scope !== "cabinet") return false;

  const binding = bindings ? selectRuntimeBinding(bindings, attributeId) : null;
  return binding?.status === "bound" && binding.target.kind === "product";
};

/**
 * What the state holds for one placed cabinet alone: the values that are its own
 * (`isOwnCabinetValue`), and with `sentToOne` those the scene can also send to one product (the
 * side of its lateral panel). The scene config of a cabinet names neither, so a copy of the
 * cabinet and the rules for it take them from here.
 */
export const selectOwnCabinetValues = (
  state: RootState,
  runtimeId: string,
  { sentToOne = false }: { sentToOne?: boolean } = {},
): Record<string, AttributeValue> => {
  const profile = getActiveProductProfile(state);
  const bindings = getActiveRuntimeBindings(state);
  const cabinetId = getCabinetEntries(state).find((cabinet) => cabinet.runtimeId === runtimeId)?.stableKey;
  if (!profile || !bindings || !cabinetId) return {};

  const recorded = getValuesByAttributeId(state);

  return Object.fromEntries(
    profile.attributes.flatMap(({ attributeId }): [string, AttributeValue][] => {
      const binding = selectRuntimeBinding(bindings, attributeId);
      const isSentToOne = sentToOne && binding?.status === "bound" && binding.perProduct === true;
      if (!isOwnCabinetValue(profile, bindings, attributeId) && !isSentToOne) return [];

      const own = recorded[attributeId]?.find(({ target }) =>
        isSameTarget(target, { scope: "cabinet", cabinetId }),
      )?.value;
      return own === undefined || own === null || own === "" ? [] : [[attributeId, own]];
    }),
  );
};

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
