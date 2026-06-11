import type { DividerSlot, DividerType, PlacementDecision } from "./types";

/**
 * User-facing warning texts. The strings below are UX-frozen — they must stay
 * byte-identical to the legacy page-level implementations.
 */
export const DIVIDER_NO_SELECTION_WARNING = "Select a Divider option before placing it.";

export const DIVIDER_SLOT_MISMATCH_WARNING =
  "Selected Divider does not match this placement slot. Choose the matching Divider option.";

export const DIVIDER_CANNOT_PLACE_WARNING =
  "Selected Divider does not fit here. Choose another available option.";

export const DIVIDER_NO_CONTEXT_WARNING = "Open a drawer before placing a Divider.";

const getDividerOptionLabel = (type: string) => `Option ${type}`;

const formatDividerOptionsList = (available: readonly string[]) =>
  available.map(getDividerOptionLabel).join(", ");

export const buildUnavailableDividerWarning = (dividerType: string, available: readonly string[]) => {
  if (available.length > 0) {
    return `${getDividerOptionLabel(dividerType)} does not fit here. Choose one of: ${formatDividerOptionsList(available)}.`;
  }

  return `${getDividerOptionLabel(dividerType)} does not fit here. No Divider option is available for this slot.`;
};

export const buildDividerPlacementWarning = (
  selectedDividerType: DividerType | null,
  available: readonly string[],
) => {
  if (!selectedDividerType) return DIVIDER_NO_SELECTION_WARNING;
  if (!available.includes(selectedDividerType)) return buildUnavailableDividerWarning(selectedDividerType, available);

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
): PlacementDecision {
  if (!slot) {
    return { ok: false, reason: "no-context", message: DIVIDER_NO_CONTEXT_WARNING };
  }

  if (!selectedType) {
    return { ok: false, reason: "no-selection", message: DIVIDER_NO_SELECTION_WARNING };
  }

  if (!slot.availableTypes.includes(selectedType)) {
    return {
      ok: false,
      reason: "type-unavailable",
      message: buildUnavailableDividerWarning(selectedType, slot.availableTypes),
    };
  }

  if (slot.canPlace === false) {
    return { ok: false, reason: "cannot-place", message: DIVIDER_CANNOT_PLACE_WARNING };
  }

  if (slot.placementType && slot.placementType !== selectedType) {
    return { ok: false, reason: "slot-mismatch", message: DIVIDER_SLOT_MISMATCH_WARNING };
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
