import type { ProductProfile } from "@/entities/collection";
import type { PresetProduct } from "@/entities/product/types";
import type { SidePanelAvailabilityResult, SidePanelReasonCode } from "@/features/configurator-rule-core/options/types";
import type { CountertopLengthGuard } from "@/features/configurator-rule-core/countertop";
import type { SidePanelEdgeState, SidePanelTargetSide } from "@/features/sidePanel";
import type { FieldRuntimeState } from "@/entities/collection";
import type { ProductOptionData } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";

import { formatSidePanelsExceedMaxReason } from "@/features/configurator-rule-core/countertop";
import {
  isGrooveType,
  mapCabinetTypeToGroup,
  mapSidePanelDrawersToHandleType,
  resolveSidePanelAvailabilityForEdges,
  sidePanelAvailabilityRule,
} from "@/features/sidePanel";

import { sidePanelOptionImages } from "./optionImages";

type FieldAvailabilityInputs = {
  selectorAvailability: SidePanelAvailabilityResult;
  presets: PresetProduct[];
  selectedSceneProduct: string | null;
  activeProfile: ProductProfile | null;
  edgeState: SidePanelEdgeState;
  height: number | null;
  fallbackEdgeDrawers: string | null;
  selectedDrawers: string | null;
};

/** Side panel availability for the selected cabinet: the selector's result, or the first preset before any click. */
export const resolveSidePanelFieldAvailability = ({
  selectorAvailability,
  presets,
  selectedSceneProduct,
  activeProfile,
  edgeState,
  height,
  fallbackEdgeDrawers,
  selectedDrawers,
}: FieldAvailabilityInputs): SidePanelAvailabilityResult => {
  const firstPreset = presets[0];
  const selectedAvailability =
    selectorAvailability.allowed.size > 0 || selectorAvailability.reason || selectedSceneProduct || !firstPreset
      ? selectorAvailability
      : sidePanelAvailabilityRule(
          {
            height: firstPreset.Height ?? null,
            handleType: mapSidePanelDrawersToHandleType(firstPreset.Drawers ?? null, activeProfile),
            cabinetType: mapCabinetTypeToGroup(firstPreset.name ?? null, activeProfile),
          },
          activeProfile,
        );

  return resolveSidePanelAvailabilityForEdges({
    selectedAvailability,
    edgeState,
    height,
    edgeDrawers: fallbackEdgeDrawers ?? selectedDrawers,
    profile: activeProfile,
  });
};

/** The total countertop width once the groove is applied to the target side. */
export const projectedTotalAfterGrooveChange = (
  value: string,
  targetSide: SidePanelTargetSide,
  currentCabinetOnly: number | null,
  leftStatus: string,
  rightStatus: string,
): number | null => {
  if (currentCabinetOnly === null) return null;
  if (value === "None" || targetSide === null) return currentCabinetOnly;
  const leftAfter = targetSide !== "right" || leftStatus === "active";
  const rightAfter = targetSide !== "left" || rightStatus === "active";
  return currentCabinetOnly + (leftAfter ? 1 : 0) + (rightAfter ? 1 : 0);
};

type BuildOptionsArgs = {
  field: FieldRuntimeState | undefined;
  isBlockedByLength: boolean;
  availability: SidePanelAvailabilityResult;
  lengthGuard: CountertopLengthGuard;
  targetSide: SidePanelTargetSide;
  leftStatus: string;
  rightStatus: string;
  /** Active collection: the length reason comes from its `messages`. */
  profile: ProductProfile | null;
};

const SYNTESI_BLOCKED_REASON: SidePanelReasonCode = "syntesi-countertop";

/** The groove options of the field, disabled by the matrix, the Syntesi rule or the countertop length. */
export const buildSidePanelOptions = ({
  field,
  isBlockedByLength,
  availability,
  lengthGuard,
  targetSide,
  leftStatus,
  rightStatus,
  profile,
}: BuildOptionsArgs): ProductOptionData[] => {
  const catalog: ProductOptionData[] = (field?.options ?? []).map((option) => ({
    id: option.value,
    title: option.label ?? option.value,
    isShortDesc: false,
    metadata: { value: option.value, image: sidePanelOptionImages[option.value] },
  }));
  if (isBlockedByLength) return catalog.filter((option) => option.metadata?.value === "None");

  const isSyntesiBlocked = availability.allowed.size === 0 && availability.reasonCode === SYNTESI_BLOCKED_REASON;

  return catalog.flatMap((option) => {
    const value = option.metadata?.value;
    if (value === "None") return [option];
    if (isSyntesiBlocked) return [{ ...option, isAvailable: false, disabledReason: availability.reason }];
    if (!value || !isGrooveType(value) || value === "None" || !availability.allowed.has(value)) return [];

    const totalAfter = projectedTotalAfterGrooveChange(
      value,
      targetSide,
      lengthGuard.currentCabinetOnly,
      leftStatus,
      rightStatus,
    );
    if (totalAfter === null || lengthGuard.max === null || lengthGuard.canAccommodateTotal(totalAfter)) return [option];
    return [
      {
        ...option,
        isAvailable: false,
        disabledReason: formatSidePanelsExceedMaxReason(totalAfter, lengthGuard.max, profile),
      },
    ];
  });
};
