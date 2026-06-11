export type {
  DividerAvailability,
  DividerCommand,
  DividerContext,
  DividerHideSlotsCommand,
  DividerPlaceCommand,
  DividerRemoveCommand,
  DividerShowSlotsCommand,
  DividerSlot,
  DividerSlotDisabledReason,
  DividerSlotKind,
  DividerSlotPosition,
  DividerType,
  DrawerType,
  PlacementDecision,
  PlacementRejectionReason,
} from "./types";

export {
  dividerTypeSetsEqual,
  dividerTypesEqual,
  getDividerTypeFromOptionTitle,
  isDividerType,
  normalizeDividerType,
  normalizeDividerTypes,
  normalizeSlotInfo,
  sortDividerTypes,
} from "./normalize";

export {
  DIVIDER_CANNOT_PLACE_WARNING,
  DIVIDER_NO_CONTEXT_WARNING,
  DIVIDER_NO_SELECTION_WARNING,
  DIVIDER_SLOT_MISMATCH_WARNING,
  buildDividerPlacementWarning,
  buildUnavailableDividerWarning,
  validatePlacement,
} from "./validate";

export { deriveDividerOptions } from "./deriveOptions";
export type { DerivedDividerOption, DividerAvailabilityInput, DividerOptionBase } from "./deriveOptions";
