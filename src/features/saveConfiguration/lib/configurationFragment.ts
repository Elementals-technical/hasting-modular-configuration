import type { AttributeValue, CabinetEntry, ConfigurationSnapshot, ValueTarget } from "@/entities/configuration";
import { formatTarget } from "@/entities/configuration";

/**
 * Versioned fragment of the save payload that carries collection identity, product
 * order and values addressed by target.
 *
 * It sits next to the existing `uiState` rather than replacing it: three restore paths
 * still read the flat shape, and `Top_*` entries plus accessories live in the untouched
 * `configuration` map. Removing the old fields is only possible once C08 and C09 have
 * moved every reader onto this fragment.
 */

export const CONFIGURATION_FRAGMENT_VERSION = 1;

/** Product identity as saved: the stable key plus its place in the composition. */
export type SavedCabinet = {
  stableKey: string;
  index: number;
};

/**
 * Values grouped by target key.
 *
 * The key is the serialized `ValueTarget` — "global", "cabinet:cab-1",
 * "drawer:cab-1:Top" — so `cabinet-1:Height` never merges with `cabinet-2:Height`.
 */
export type SavedValuesByTarget = Record<string, Record<string, AttributeValue>>;

export type ConfigurationFragment = {
  version: number;
  /** Collection this configuration belongs to; null for a payload saved before C07. */
  collectionId: string | null;
  cabinets: SavedCabinet[];
  values: SavedValuesByTarget;
};

/** Builds the fragment from the shared snapshot produced by the configuration model. */
export const buildConfigurationFragment = (snapshot: ConfigurationSnapshot): ConfigurationFragment => {
  const values: SavedValuesByTarget = {};

  for (const [attributeId, scopedValues] of Object.entries(snapshot.values)) {
    for (const scoped of scopedValues) {
      const key = formatTarget(scoped.target);
      values[key] = { ...(values[key] ?? {}), [attributeId]: scoped.value };
    }
  }

  return {
    version: CONFIGURATION_FRAGMENT_VERSION,
    collectionId: snapshot.collectionId,
    cabinets: snapshot.cabinets.map((entry: CabinetEntry) => ({
      stableKey: entry.stableKey,
      index: entry.index,
    })),
    values,
  };
};

/** Reads one value out of a fragment without re-deriving the target key format. */
export const readFragmentValue = (
  fragment: ConfigurationFragment,
  attributeId: string,
  target: ValueTarget,
): AttributeValue | undefined => fragment.values[formatTarget(target)]?.[attributeId];

/** Every attribute id present in the fragment, for diagnostics and residue checks. */
export const listFragmentAttributeIds = (fragment: ConfigurationFragment): string[] => {
  const ids = new Set<string>();

  for (const byAttribute of Object.values(fragment.values)) {
    for (const attributeId of Object.keys(byAttribute)) {
      ids.add(attributeId);
    }
  }

  return [...ids].sort();
};
