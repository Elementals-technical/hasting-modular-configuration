import { useActiveCollection } from "@/entities/collection";
import { getActiveProductProfile } from "@/entities/configuration";
import {
  selectBookMatchingState,
  selectFlutingState,
  selectGrainDirectionState,
} from "@/entities/product/model/store/derivedSelectors";
import { useAppSelector } from "@/shared/hooks/store/redux";

import { resolveSectionFields } from "./resolveSectionState";

import type { FieldAvailabilityResults, ResolvedCustomizationField } from "./resolveSectionState";

export type { ResolvedCustomizationField } from "./resolveSectionState";

const useFieldAvailabilityResults = (): FieldAvailabilityResults => {
  const fluting = useAppSelector(selectFlutingState);
  const grainDirection = useAppSelector(selectGrainDirectionState);
  const bookMatching = useAppSelector(selectBookMatchingState);

  return {
    "DrawerPanelFluting.available": fluting,
    "GrainDirection.available": grainDirection,
    "BookMatching.available": { available: bookMatching.enabled, reason: bookMatching.reason },
  };
};

export const useCustomizationSectionFields = (sectionId: string): ResolvedCustomizationField[] => {
  const activeCollection = useActiveCollection();
  const profile = useAppSelector(getActiveProductProfile);
  const productOptions = useAppSelector((state) => state.rootStateUI.product.productOptions);
  const availabilityResults = useFieldAvailabilityResults();

  const schema = activeCollection.status === "ready" ? (activeCollection.data.catalog.customization ?? null) : null;

  return resolveSectionFields(schema, sectionId, profile, productOptions, availabilityResults);
};
