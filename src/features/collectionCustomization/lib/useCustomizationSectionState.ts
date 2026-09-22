import { useMemo } from "react";

import { hasCapability, useActiveCollection } from "@/entities/collection";
import { getActiveProductProfile } from "@/entities/configuration";
import {
  selectBookMatchingState,
  selectFlutingState,
  selectGrainDirectionState,
} from "@/entities/product/model/store/derivedSelectors";
import {
  getCountertopStyle,
  getDividersOption,
  getProductsPresets,
  getSelectedProductConfig,
  getTowelBarOption,
} from "@/entities/product/model/store/selectors";
import { getSupportedCountertopFaucetHoles, useCountertopRules } from "@/features/configurator-rule-core/countertop";
import { selectSidePanelAvailability } from "@/features/sidePanel/model/selectors";
import { useAppSelector } from "@/shared/hooks/store/redux";

import { useCountertopRuleState } from "./useCountertopRuleState";
import { resolveSectionFields } from "./resolveSectionState";

import type { FieldAvailabilityResults, ResolvedCustomizationField } from "./resolveSectionState";

export type { ResolvedCustomizationField } from "./resolveSectionState";

export type ResolvedCustomizationSection = {
  sectionId: string;
  label: string;
  defaultOpen: boolean;
  fields: ResolvedCustomizationField[];
};

// Profile options intersected with the matrix, as the FaucetHolesAmount sourcePolicy says.
const useAllowedFaucetHoles = (): string[] | undefined => {
  const rules = useCountertopRules();
  const { allowedFaucetHoles } = useCountertopRuleState();

  return useMemo(() => {
    const supported = allowedFaucetHoles.size ? [...allowedFaucetHoles] : getSupportedCountertopFaucetHoles(rules);
    return supported.length ? supported : undefined;
  }, [allowedFaucetHoles, rules]);
};

// Keyed by the availabilityRef values of ui.json; each entry is a result an existing module already computes.
const useFieldAvailabilityResults = (): FieldAvailabilityResults => {
  const profile = useAppSelector(getActiveProductProfile);
  const fluting = useAppSelector(selectFlutingState);
  const grainDirection = useAppSelector(selectGrainDirectionState);
  const bookMatching = useAppSelector(selectBookMatchingState);
  const sidePanels = useAppSelector(selectSidePanelAvailability);
  const towelBarOption = useAppSelector(getTowelBarOption);
  const dividersOption = useAppSelector(getDividersOption);
  const countertopStyle = useAppSelector(getCountertopStyle);
  const selectedHandle = useAppSelector((state) => getSelectedProductConfig(state)?.Handle);
  const presetHandle = useAppSelector((state) => getProductsPresets(state)[0]?.Handle);
  const allowedFaucetHoles = useAllowedFaucetHoles();

  const handle = selectedHandle ?? presetHandle;
  const supportsGrooveColor = hasCapability(
    profile,
    "Handle",
    typeof handle === "string" ? handle : null,
    "supportsGrooveColor",
  );
  const hasTowelBar = Boolean(towelBarOption) && towelBarOption !== "None";
  const isCustomizingDividers = dividersOption === "Customize";
  const isVesselStyle = (countertopStyle ?? "").trim().toLowerCase() === "vessel";

  return useMemo(
    () => ({
      "DrawerPanelFluting.available": fluting,
      "GrainDirection.available": grainDirection,
      "BookMatching.available": { available: bookMatching.enabled, reason: bookMatching.reason },
      "Handle.supportsGrooveColor": { available: supportsGrooveColor, visible: supportsGrooveColor },
      "SidePanels.available": {
        available: sidePanels.allowed.size > 0,
        reason: sidePanels.reason,
        allowedValues: [...sidePanels.allowed],
      },
      "TowelBarColor.available": { available: hasTowelBar, visible: hasTowelBar },
      "DividersStyle.available": { available: isCustomizingDividers, visible: isCustomizingDividers },
      "Countertop.isVesselStyle": { available: isVesselStyle, visible: isVesselStyle },
      "FaucetHolesAmount.allowed": { available: true, allowedValues: allowedFaucetHoles },
    }),
    [
      allowedFaucetHoles,
      bookMatching.enabled,
      bookMatching.reason,
      fluting,
      grainDirection,
      hasTowelBar,
      isCustomizingDividers,
      isVesselStyle,
      sidePanels,
      supportsGrooveColor,
    ],
  );
};

const useSectionInputs = () => {
  const schema = useActiveCollection((collection) => collection.catalog.customization ?? null);
  const configurator = useActiveCollection((collection) => collection.catalog.configurator);
  const profile = useAppSelector(getActiveProductProfile);
  const productOptions = useAppSelector((state) => state.rootStateUI.product.productOptions);
  const availabilityResults = useFieldAvailabilityResults();

  return { schema, configurator, profile, productOptions, availabilityResults };
};

export const useCustomizationStepSections = (stepId: string): ResolvedCustomizationSection[] => {
  const { schema, configurator, profile, productOptions, availabilityResults } = useSectionInputs();

  return useMemo(
    () =>
      (schema?.steps[stepId]?.sectionIds ?? []).flatMap((sectionId) => {
        const section = schema?.sections[sectionId];
        if (!section) return [];

        return [
          {
            sectionId,
            label: section.label,
            defaultOpen: section.defaultOpen ?? false,
            fields: resolveSectionFields(schema, sectionId, profile, productOptions, availabilityResults, configurator),
          },
        ];
      }),
    [availabilityResults, configurator, productOptions, profile, schema, stepId],
  );
};
