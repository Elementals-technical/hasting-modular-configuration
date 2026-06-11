/**
 * Pure domain model for the Divider feature.
 *
 * No imports from PlayCanvas transport, React, or Redux are allowed in this
 * directory — everything here must stay side-effect free and unit-testable.
 * See docs/divider-architecture-migration-plan.md (§T1).
 */

export type DividerType = "A" | "B" | "C";

export type DrawerType = "Top" | "TopFull" | "Bot";

export type DividerContext = {
  cabinetId: string;
  drawerType: DrawerType;
};

export type DividerSlotKind = "candidate" | "occupied";

export type DividerSlotDisabledReason = "select-divider" | "does-not-fit" | "no-space" | null;

export type DividerSlotPosition = {
  start: number;
  center: number;
  end: number;
};

/** Normalized slot shape produced by `normalizeSlotInfo` from any raw PlayCanvas callback payload. */
export type DividerSlot = {
  context: DividerContext;
  zone: string;
  key: string;
  kind: DividerSlotKind;
  /** For candidate slots: which divider type this slot is built for (parsed from payload or key). */
  placementType: DividerType | null;
  /** For occupied slots: the type of the divider currently placed there. */
  occupiedType: DividerType | null;
  /** For occupied slots: runtime state id required by removeDividerFromSlot. */
  stateId: string | null;
  availableTypes: readonly DividerType[];
  canPlace: boolean;
  disabledReason: DividerSlotDisabledReason;
  /** World-space coordinates (meters) used for overlay rendering. */
  position: DividerSlotPosition | null;
  zoneIndex: number | null;
  /**
   * Zone-local start offset in cm (e.g. 9.01 from "candidate:Top:siphon_right:right:9.01:A").
   * REQUIRED by the runtime's Facade.updateSlot for add — without it the placement is
   * rejected with "no start position in options". Comes from the raw payload's top level
   * or its nested `slot` object.
   */
  start: number | null;
  /** Zone packing anchor of the candidate ("left" | "right"). */
  anchor: "left" | "right" | null;
};

export type DividerAvailability = {
  context: DividerContext;
  types: readonly DividerType[];
  fetchedAt: number;
};

export type DividerPlaceCommand = {
  kind: "place";
  slot: DividerSlot;
  type: DividerType;
  traceId: string;
};

export type DividerRemoveCommand = {
  kind: "remove";
  slot: DividerSlot;
  traceId: string;
};

export type DividerShowSlotsCommand = {
  kind: "showSlots";
  context: DividerContext;
  selectedType: DividerType | null;
  traceId: string;
};

export type DividerHideSlotsCommand = {
  kind: "hideSlots";
  traceId: string;
};

export type DividerCommand =
  | DividerPlaceCommand
  | DividerRemoveCommand
  | DividerShowSlotsCommand
  | DividerHideSlotsCommand;

export type PlacementRejectionReason =
  | "no-selection"
  | "type-unavailable"
  | "slot-mismatch"
  | "cannot-place"
  | "no-context";

export type PlacementDecision =
  | { ok: true; command: DividerPlaceCommand }
  | { ok: false; reason: PlacementRejectionReason; message: string };
