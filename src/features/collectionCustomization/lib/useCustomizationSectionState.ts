import { useMemo } from "react";

import {
  hasCapability,
  isVesselBasin,
  selectAttribute,
  selectOptions,
  useActiveCollection,
} from "@/entities/collection";
import { getActiveProductProfile, getCabinetEntries, getCompositionValues } from "@/entities/configuration";
import {
  selectBookMatchingState,
  selectFlutingState,
  selectGrainDirectionState,
} from "@/entities/product/model/store/derivedSelectors";
import {
  getActiveCountertopColor,
  getCountertopStyle,
  getDividersOption,
  getProductsPresets,
  getSelectedProductConfig,
  getSinkType,
  getTowelBarOption,
} from "@/entities/product/model/store/selectors";
import { isUndeterminedAt } from "@/entities/product/model/store/undeterminedRules";
import {
  evaluateCountertopMaterial,
  filterThicknessValuesByCountertopRules,
  findIntegratedBasinRules,
  getSupportedCountertopFaucetHoles,
  isMaterialCompatibleWithVesselStyle,
  isPreferredVesselFinish,
  normalizeBasinKey,
  REASON_COUNTERTOP_MATERIAL_BY_FAILURE,
  REASON_COUNTERTOP_MATERIAL_SELECTION,
  REASON_VESSEL_COLOR_UNAVAILABLE,
  selectMaterialAliasTable,
  useCountertopRules,
} from "@/features/configurator-rule-core/countertop";
import { selectSidePanelAvailability } from "@/features/sidePanel/model/selectors";
import { useAppSelector } from "@/shared/hooks/store/redux";
import { extractColorCode } from "@/shared/lib/sku";

import { useCountertopRuleState } from "./useCountertopRuleState";
import { resolveConfiguratorOptions, resolveSectionFields } from "./resolveSectionState";

import type { FieldOptionState, ProductProfile } from "@/entities/collection";
import type { ConfiguratorGroupCatalog } from "@/entities/collection/model/types";

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

// The countertop colours the matrix makes at the current depth, widths and composition, as the USH
// countertop screen enables them. Each option is judged by its own material, so a colour two
// materials list (an MT lacquer, as Tekorlux and as Glass MT) is refused where only one of them is
// made. The reason names the check every refused colour failed, or the selection when they differ.
const resolveCountertopColorAvailability = (
  profile: ProductProfile | null,
  configurator: ConfiguratorGroupCatalog | null,
  { materialRuleInputs }: CountertopRuleState,
): FieldAvailability => {
  const judge = ({ traits }: FieldOptionState) =>
    evaluateCountertopMaterial(traits?.materials ?? [], materialRuleInputs);
  const failures = new Set(
    resolveConfiguratorOptions(profile, "CountertopColor", configurator).flatMap(
      (option) => judge(option).failedBy ?? [],
    ),
  );
  const [failure] = failures;

  return {
    available: true,
    isOptionAllowed: (option) => judge(option).isCompatible,
    reasonCode:
      failures.size === 1 && failure
        ? REASON_COUNTERTOP_MATERIAL_BY_FAILURE[failure]
        : REASON_COUNTERTOP_MATERIAL_SELECTION,
  };
};

// The thicknesses the matrix gives the current colour, depth, style and widths, as the USH countertop
// screen offers them. Where it gives none, none is enabled: another row's thickness would price a top
// the table does not make.
const resolveThicknessAvailability = (
  profile: ProductProfile | null,
  { allowedThicknesses }: CountertopRuleState,
): FieldAvailability => {
  const values = selectOptions(profile, "Thickness").map(({ value }) => value);

  return {
    available: true,
    allowedValues: allowedThicknesses.size
      ? filterThicknessValuesByCountertopRules({ values, allowedThicknesses }).map(String)
      : [],
  };
};

// Only the basins of the chosen style are shown, as the USH countertop screen shows them: an
// integrated basin needs a matrix row for the current colour, and is enabled when the thickness
// and Sink Base width fit it too; a vessel has no rows and follows the vessel Sink Base minimum.
// Before a colour is chosen every row matches, so no integrated basin is enabled until one is, as
// the USH screen offers none before a material. A vessel countertop without a basin keeps its
// cutout: the profile's noneValue, chosen until a vessel is.
const resolveBasinAvailability = (
  profile: ProductProfile | null,
  { matchingRules, allowedBasinKeys, activeMaterialTokens, vesselSinkAvailability }: CountertopRuleState,
  countertopStyle: string | null | undefined,
  countertopColor: string | null | undefined,
): FieldAvailability => {
  const isVesselStyle = (countertopStyle ?? "").trim().toLowerCase() === "vessel";
  const noneValue = selectAttribute(profile, "sinkType")?.noneValue;
  const aliasTable = selectMaterialAliasTable(profile);
  const basins = selectOptions(profile, "sinkType");
  const valuesWhere = (predicate: (basin: (typeof basins)[number]) => boolean) =>
    basins.filter(predicate).map(({ value }) => value);
  // The matrix names a basin by its label, as the USH countertop step reads it ("HPL Cover 50").
  const rowsOf = ({ value, label }: (typeof basins)[number]) =>
    findIntegratedBasinRules({ name: value, title: label }, matchingRules, activeMaterialTokens, aliasTable);

  return {
    available: true,
    visibleValues: valuesWhere((basin) =>
      basin.category === "vessel" ? isVesselStyle : !isVesselStyle && rowsOf(basin).length > 0,
    ),
    allowedValues: valuesWhere((basin) =>
      basin.category === "vessel"
        ? isVesselStyle && (basin.value === noneValue || vesselSinkAvailability.isAvailable)
        : !isVesselStyle &&
          Boolean(countertopColor) &&
          rowsOf(basin).some(({ basinStyle }) => allowedBasinKeys.has(normalizeBasinKey(basinStyle))),
    ),
    reasonCode: "change.notAvailable",
    valueWhenEmpty: isVesselStyle ? noneValue : undefined,
  };
};

// The colours of the chosen vessel, as the USH countertop step offers them: those its compatibility
// allows by the material a colour is listed under and its colour code, its default finish first. The
// colour is the vessel's, so it is offered once a vessel is chosen; the empty cutout has none.
const resolveVesselColorAvailability = (
  profile: ProductProfile | null,
  configurator: ConfiguratorGroupCatalog | null,
  vesselStyle: string | null | undefined,
): FieldAvailability => {
  if (!isVesselBasin(profile, vesselStyle)) return { available: false, visible: false };

  const finishOf = ({ value, traits }: FieldOptionState) => ({
    vesselStyle,
    materialTokens: traits?.materials ?? [],
    colorCode: extractColorCode(value),
    profile,
  });
  const allowed = resolveConfiguratorOptions(profile, "VesselColor", configurator).filter((option) =>
    isMaterialCompatibleWithVesselStyle(finishOf(option)),
  );

  return {
    available: true,
    allowedValues: allowed.map(({ value }) => value),
    preferredValue: allowed.find((option) => isPreferredVesselFinish(finishOf(option)))?.value,
    reasonCode: REASON_VESSEL_COLOR_UNAVAILABLE,
  };
};

// Keyed by the availabilityRef values of ui.json; each entry is a result an existing module already computes.
const useFieldAvailabilityResults = (configurator: ConfiguratorGroupCatalog | null): FieldAvailabilityResults => {
  const profile = useAppSelector(getActiveProductProfile);
  const fluting = useAppSelector(selectFlutingState);
  const grainDirection = useAppSelector(selectGrainDirectionState);
  const bookMatching = useAppSelector(selectBookMatchingState);
  const sidePanels = useAppSelector(selectSidePanelAvailability);
  const towelBarOption = useAppSelector(getTowelBarOption);
  const dividersOption = useAppSelector(getDividersOption);
  const countertopStyle = useAppSelector(getCountertopStyle);
  const countertopColor = useAppSelector(getActiveCountertopColor);
  const sinkType = useAppSelector(getSinkType);
  const selectedHandle = useAppSelector((state) => getSelectedProductConfig(state)?.Handle);
  const presetHandle = useAppSelector((state) => getProductsPresets(state)[0]?.Handle);
  const countertopRuleState = useCountertopRuleState();
  const allowedFaucetHoles = useAllowedFaucetHoles(countertopRuleState.allowedFaucetHoles);
  // The leg colour a field sets at the first cabinet, unless the product decided none there (a
  // one-drawer Mako cabinet, MAKO-LEG-002): the command would refuse every value but Off.
  const legColorDetermined = useAppSelector((state) => {
    const activeProfile = getActiveProductProfile(state);
    const cabinetId = getCabinetEntries(state)[0]?.stableKey;
    return (
      !activeProfile ||
      !cabinetId ||
      !isUndeterminedAt(state, activeProfile, "LegColor", { scope: "cabinet", cabinetId })
    );
  });

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
      "LegColor.determined": { available: legColorDetermined, visible: legColorDetermined },
      "Countertop.isVesselStyle": { available: isVesselStyle, visible: isVesselStyle },
      "FaucetHolesAmount.allowed": { available: true, allowedValues: allowedFaucetHoles },
      "CountertopStyle.allowed": resolveCountertopStyleAvailability(countertopRuleState),
      "CountertopColor.allowed": resolveCountertopColorAvailability(profile, configurator, countertopRuleState),
      "Thickness.allowed": resolveThicknessAvailability(profile, countertopRuleState),
      "sinkType.allowed": resolveBasinAvailability(profile, countertopRuleState, countertopStyle, countertopColor),
      "VesselColor.allowed": resolveVesselColorAvailability(profile, configurator, sinkType),
    }),
    [
      allowedFaucetHoles,
      bookMatching.enabled,
      bookMatching.reason,
      bookMatching.reasonCode,
      configurator,
      countertopColor,
      countertopRuleState,
      countertopStyle,
      fluting,
      grainDirection,
      hasTowelBar,
      isCustomizingDividers,
      isVesselStyle,
      legColorDetermined,
      profile,
      sidePanels,
      sinkType,
      supportsGrooveColor,
    ],
  );
};

const useSectionInputs = () => {
  const schema = useActiveCollection((collection) => collection.catalog.customization ?? null);
  const configurator = useActiveCollection((collection) => collection.catalog.configurator);
  const profile = useAppSelector(getActiveProductProfile);
  const productOptions = useAppSelector((state) => state.rootStateUI.product.productOptions);
  const compositionValues = useAppSelector(getCompositionValues);
  // An attribute that left the typed options (Mako's leg and handle colours, Class's side and frame
  // colours) is shown as the composition holds it; the typed options keep their own values.
  const values = useMemo(() => ({ ...compositionValues, ...productOptions }), [compositionValues, productOptions]);
  const availabilityResults = useFieldAvailabilityResults(configurator);

  return { schema, configurator, profile, values, availabilityResults };
};

export const useCustomizationStepSections = (stepId: string): ResolvedCustomizationSection[] => {
  const { schema, configurator, profile, values, availabilityResults } = useSectionInputs();

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
            fields: resolveSectionFields(schema, sectionId, profile, values, availabilityResults, configurator),
          },
        ];
      }),
    [availabilityResults, configurator, values, profile, schema, stepId],
  );
};
