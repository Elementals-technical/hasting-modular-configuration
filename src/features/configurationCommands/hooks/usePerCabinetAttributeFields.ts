import { useMemo } from "react";

import { selectRuntimeBinding, useActiveCollection, type PerCabinetAttribute } from "@/entities/collection";
import {
  getActiveProductProfile,
  getActiveRuntimeBindings,
  getCabinetEntries,
  getValuesByAttributeId,
} from "@/entities/configuration";
import { selectFlutingState } from "@/entities/product/model/store/derivedSelectors";
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
  const bindings = useAppSelector(getActiveRuntimeBindings);
  const fluting = useAppSelector(selectFlutingState);
  const recorded = useAppSelector(getValuesByAttributeId);
  const firstCabinetId = useAppSelector((state) => getCabinetEntries(state)[0]?.stableKey);

  return useMemo(
    () =>
      attributes?.length
        ? buildPerCabinetAttributeFields({
            profile,
            schema,
            recorded,
            firstCabinetId,
            attributes,
            cabinetId,
            pending,
          }).map((field) => {
            const binding = bindings ? selectRuntimeBinding(bindings, field.attributeId) : null;
            return {
              ...field,
              canApplyToAll:
                binding?.status === "bound" && binding.perProduct === true && binding.target.kind === "product",
              options:
                field.attributeId === "DrawerPanelFluting"
                  ? field.options.map((option) => ({
                      ...option,
                      disabled: !fluting.options.some(({ value, enabled }) => value === option.value && enabled),
                    }))
                  : field.options,
            };
          })
        : NO_FIELDS,
    [attributes, bindings, cabinetId, firstCabinetId, fluting, pending, profile, recorded, schema],
  );
};
