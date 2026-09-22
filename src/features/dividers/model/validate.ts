import { selectMessageOr, selectOption, type ProductProfile } from "@/entities/collection";

import type { DividerSlot, DividerType, PlacementDecision, PlacementRejectionReason } from "./types";

/**
 * Legacy English texts, kept byte-identical to the former page-level implementations. They
 * are the fallback for a collection without `messages`; the shown text comes from the
 * collection through the reason codes below.
 */
export const DIVIDER_NO_SELECTION_WARNING = "Select a Divider option before placing it.";

export const DIVIDER_SLOT_MISMATCH_WARNING =
  "Selected Divider does not match this placement slot. Choose the matching Divider option.";

export const DIVIDER_CANNOT_PLACE_WARNING =
  "Selected Divider does not fit here. Choose another available option.";

export const DIVIDER_NO_CONTEXT_WARNING = "Open a drawer before placing a Divider.";

export const REASON_DIVIDER_NO_CONTEXT = "divider.noContext";
export const REASON_DIVIDER_NO_SELECTION = "divider.noSelection";
export const REASON_DIVIDER_TYPE_UNAVAILABLE = "divider.typeUnavailable";
export const REASON_DIVIDER_NO_TYPE_AVAILABLE = "divider.noTypeAvailable";
export const REASON_DIVIDER_CANNOT_PLACE = "divider.cannotPlace";
export const REASON_DIVIDER_SLOT_MISMATCH = "divider.slotMismatch";

/** The divider style's label in the collection ("Option A" in USH, "Oak" in Class). */
const getDividerOptionLabel = (type: string, profile: ProductProfile | null) =>
  selectOption(profile, "DividersStyle", type)?.label ?? `Option ${type}`;

const formatDividerOptionsList = (available: readonly string[], profile: ProductProfile | null) =>
  available.map((type) => getDividerOptionLabel(type, profile)).join(", ");

type DividerReason = { reasonCode: string; message: string };

/** Why this divider style does not fit the slot: the code and the text for it. */
export const unavailableDividerReason = (
  dividerType: string,
  available: readonly string[],
  profile: ProductProfile | null,
): DividerReason => {
  const option = getDividerOptionLabel(dividerType, profile);

  if (available.length > 0) {
    const options = formatDividerOptionsList(available, profile);
    return {
      reasonCode: REASON_DIVIDER_TYPE_UNAVAILABLE,
      message: selectMessageOr(
        profile,
        REASON_DIVIDER_TYPE_UNAVAILABLE,
        `${option} does not fit here. Choose one of: ${options}.`,
        { option, options },
      ),
    };
  }

  return {
    reasonCode: REASON_DIVIDER_NO_TYPE_AVAILABLE,
    message: selectMessageOr(
      profile,
      REASON_DIVIDER_NO_TYPE_AVAILABLE,
      `${option} does not fit here. No Divider option is available for this slot.`,
      { option },
    ),
  };
};

export const buildUnavailableDividerWarning = (
  dividerType: string,
  available: readonly string[],
  profile: ProductProfile | null = null,
) => unavailableDividerReason(dividerType, available, profile).message;

const rejection = (
  reason: Exclude<PlacementRejectionReason, "type-unavailable">,
  reasonCode: string,
  legacyText: string,
  profile: ProductProfile | null,
): PlacementDecision => ({
  ok: false,
  reason,
  reasonCode,
  message: selectMessageOr(profile, reasonCode, legacyText),
});

export const buildDividerPlacementWarning = (
  selectedDividerType: DividerType | null,
  available: readonly string[],
  profile: ProductProfile | null = null,
) => {
  if (!selectedDividerType) return selectMessageOr(profile, REASON_DIVIDER_NO_SELECTION, DIVIDER_NO_SELECTION_WARNING);
  if (!available.includes(selectedDividerType)) {
    return buildUnavailableDividerWarning(selectedDividerType, available, profile);
  }

  return null;
};

let placementTraceSequence = 0;

const createPlacementTraceId = () => {
  placementTraceSequence += 1;
  return `validate-place-${Date.now()}-${placementTraceSequence}`;
};

/**
 * Pure placement gate. Check order is fixed:
 * no-context → no-selection → type-unavailable → cannot-place → slot-mismatch → ok.
 *
 * The slot-mismatch check is the regression guard for the real bug where a "B"
 * divider was placed into a `candidate:...:A` slot.
 */
export function validatePlacement(
  selectedType: DividerType | null,
  slot: DividerSlot | null,
  traceId?: string,
  profile: ProductProfile | null = null,
): PlacementDecision {
  if (!slot) {
    return rejection("no-context", REASON_DIVIDER_NO_CONTEXT, DIVIDER_NO_CONTEXT_WARNING, profile);
  }

  if (!selectedType) {
    return rejection("no-selection", REASON_DIVIDER_NO_SELECTION, DIVIDER_NO_SELECTION_WARNING, profile);
  }

  if (!slot.availableTypes.includes(selectedType)) {
    return { ok: false, reason: "type-unavailable", ...unavailableDividerReason(selectedType, slot.availableTypes, profile) };
  }

  if (slot.canPlace === false) {
    return rejection("cannot-place", REASON_DIVIDER_CANNOT_PLACE, DIVIDER_CANNOT_PLACE_WARNING, profile);
  }

  if (slot.placementType && slot.placementType !== selectedType) {
    return rejection("slot-mismatch", REASON_DIVIDER_SLOT_MISMATCH, DIVIDER_SLOT_MISMATCH_WARNING, profile);
  }

  return {
    ok: true,
    command: {
      kind: "place",
      slot,
      type: selectedType,
      traceId: traceId ?? createPlacementTraceId(),
    },
  };
}
