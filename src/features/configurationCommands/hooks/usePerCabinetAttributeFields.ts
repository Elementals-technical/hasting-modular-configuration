import { useMemo } from "react";

import { useActiveCollection, type PerCabinetAttribute } from "@/entities/collection";
import { getActiveProductProfile, getCabinetEntries, getValuesByAttributeId } from "@/entities/configuration";
import type { StableCabinetKey } from "@/entities/configuration";
import { useAppSelector } from "@/shared/hooks/store/redux";

import { buildPerCabinetAttributeFields, type PerCabinetAttributeField } from "../lib/perCabinetAttributes";

const NO_FIELDS: PerCabinetAttributeField[] = [];

/**
 * The cabinet values the active collection offers for one cabinet alone, as a selector shows
 * them for `cabinetId` — or for the cabinet being added, when `null`, whose config is `pending`.
 */
export const usePerCabinetAttributeFields = (
  attributes: readonly PerCabinetAttribute[] | undefined,
  cabinetId: StableCabinetKey | null,
  pending: Readonly<Record<string, unknown>> | null = null,
): PerCabinetAttributeField[] => {
  const schema = useActiveCollection((collection) => collection.catalog.customization ?? null);
  const profile = useAppSelector(getActiveProductProfile);
  const recorded = useAppSelector(getValuesByAttributeId);
  const firstCabinetId = useAppSelector((state) => getCabinetEntries(state)[0]?.stableKey);

  return useMemo(
    () =>
      attributes?.length
        ? buildPerCabinetAttributeFields({ profile, schema, recorded, firstCabinetId, attributes, cabinetId, pending })
        : NO_FIELDS,
    [attributes, cabinetId, firstCabinetId, pending, profile, recorded, schema],
  );
};
