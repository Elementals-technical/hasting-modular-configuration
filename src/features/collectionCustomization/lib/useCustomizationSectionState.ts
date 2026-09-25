import { useMemo } from "react";

import { hasCapability, selectAttribute, selectOptions, useActiveCollection } from "@/entities/collection";
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
import {
  getSupportedCountertopFaucetHoles,
  normalizeBasinKey,
  useCountertopRules,
} from "@/features/configurator-rule-core/countertop";
import { selectSidePanelAvailability } from "@/features/sidePanel/model/selectors";
import { useAppSelector } from "@/shared/hooks/store/redux";

import { useCountertopRuleState } from "./useCountertopRuleState";
import { resolveSectionFields } from "./resolveSectionState";

import type { ProductProfile } from "@/entities/collection";

import type { FieldAvailability, FieldAvailabilityResults, ResolvedCustomizationField } from "./resolveSectionState";
import type { CountertopRuleState } from "./useCountertopRuleState";

export type { ResolvedCustomizationField } from "./resolveSectionState";

export type ResolvedCustomizationSection = {
  sectionId: string;
  label: string;
  /** The countertop step's label for this section while the style is vessel; absent otherwise. */
  labelWhenVessel?: string;
  defaultOpen: boolean;
  fields: ResolvedCustomizationField[];
};

// Profile options intersected with the matrix, as the FaucetHolesAmount sourcePolicy says.
const useAllowedFaucetHoles = (allowedFaucetHoles: CountertopRuleState["allowedFaucetHoles"]): string[] | undefined => {
  const rules = useCountertopRules();

  return useMemo(() => {
    const supported = allowedFaucetHoles.size ? [...allowedFaucetHoles] : getSupportedCountertopFaucetHoles(rules);
    return supported.length ? supported : undefined;
  }, [allowedFaucetHoles, rules]);
};

const COUNTERTOP_STYLES = ["integrated", "vessel"] as const;

// The styles the matrix allows for the current colour and sizes; the reason is the first refused style's.
const resolveCountertopStyleAvailability = ({ styleAvailability }: CountertopRuleState): FieldAvailability => {
  const refused = COUNTERTOP_STYLES.map((style) => styleAvailability[style]).find(({ isAvailable }) => !isAvailable);

  return {
    available: true,
    allowedValues: COUNTERTOP_STYLES.filter((style) => styleAvailability[style].isAvailable),
    reason: refused?.disabledReason,
    reasonCode: refused?.reasonCode,
    reasonParams: refused?.reasonParams,
  };
};

// Only the basins of the chosen style are shown, as the USH countertop screen shows them: an
// integrated basin needs a matrix row for the current colour, and is enabled when the thickness
// and Sink Base width fit it too; a vessel has no rows and follows the vessel Sink Base minimum.
// A vessel countertop without a basin keeps its cutout: the profile's noneValue, chosen until
// a vessel is.
const resolveBasinAvailability = (
  profile: ProductProfile | null,
  { matchingRules, allowedBasinKeys, vesselSinkAvailability }: CountertopRuleState,
  countertopStyle: string | null | undefined,
): FieldAvailability => {
  const isVesselStyle = (countertopStyle ?? "").trim().toLowerCase() === "vessel";
  const noneValue = selectAttribute(profile, "sinkType")?.noneValue;
  const materialBasinKeys = new Set(matchingRules.map(({ basinStyle }) => normalizeBasinKey(basinStyle)));
  const basins = selectOptions(profile, "sinkType");
  const valuesWhere = (predicate: (basin: (typeof basins)[number]) => boolean) =>
    basins.filter(predicate).map(({ value }) => value);

  return {
    available: true,
    visibleValues: valuesWhere(({ value, category }) =>
      category === "vessel" ? isVesselStyle : !isVesselStyle && materialBasinKeys.has(normalizeBasinKey(value)),
    ),
    allowedValues: valuesWhere(({ value, category }) =>
      category === "vessel"
        ? isVesselStyle && (value === noneValue || vesselSinkAvailability.isAvailable)
        : !isVesselStyle && allowedBasinKeys.has(normalizeBasinKey(value)),
    ),
    reasonCode: "change.notAvailable",
    valueWhenEmpty: isVesselStyle ? noneValue : undefined,
  };
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
  const countertopRuleState = useCountertopRuleState();
  const allowedFaucetHoles = useAllowedFaucetHoles(countertopRuleState.allowedFaucetHoles);

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
      "BookMatching.available": {
        available: bookMatching.enabled,
        reason: bookMatching.reason,
        reasonCode: bookMatching.reasonCode,
      },
      "Handle.supportsGrooveColor": { available: supportsGrooveColor, visible: supportsGrooveColor },
      "SidePanels.available": {
        available: sidePanels.allowed.size > 0,
        reason: sidePanels.reason,
        // The rule's own reasonCode groups the blockers; the text is named by messageCode.
        reasonCode: sidePanels.messageCode,
        allowedValues: [...sidePanels.allowed],
      },
      "TowelBarColor.available": { available: hasTowelBar, visible: hasTowelBar },
      "DividersStyle.available": { available: isCustomizingDividers, visible: isCustomizingDividers },
      "Countertop.isVesselStyle": { available: isVesselStyle, visible: isVesselStyle },
      "FaucetHolesAmount.allowed": { available: true, allowedValues: allowedFaucetHoles },
      "CountertopStyle.allowed": resolveCountertopStyleAvailability(countertopRuleState),
      "sinkType.allowed": resolveBasinAvailability(profile, countertopRuleState, countertopStyle),
    }),
    [
      allowedFaucetHoles,
      bookMatching.enabled,
      bookMatching.reason,
      bookMatching.reasonCode,
      countertopRuleState,
      countertopStyle,
      fluting,
      grainDirection,
      hasTowelBar,
      isCustomizingDividers,
      isVesselStyle,
      profile,
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
        if (!section || section.enabled === false) return [];

        return [
          {
            sectionId,
            label: section.label,
            ...(section.labelWhenVessel ? { labelWhenVessel: section.labelWhenVessel } : {}),
            defaultOpen: section.defaultOpen ?? false,
            fields: resolveSectionFields(schema, sectionId, profile, productOptions, availabilityResults, configurator),
          },
        ];
      }),
    [availabilityResults, configurator, productOptions, profile, schema, stepId],
  );
};
