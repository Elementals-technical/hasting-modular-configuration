// Service (mutations)
export {
  applyGroove,
  deleteSide,
  autoRemoveSide,
  autoRestoreSide,
  bootBothSides,
  applyGrooveToActiveSides,
  autoRemoveBoth,
  restoreSidePanelState,
  reapplySidePanelsForPreset,
  resolveGroove,
  isGrooveType,
  type SidePanelSide,
  type SidePanelStatus,
  type GrooveType,
} from "./lib/sidePanelService";

// Hooks
export { useSidePanelActions } from "./hooks/useSidePanelActions";
export { useSidePanelEnforce } from "./hooks/useSidePanelEnforce";
export { useSceneTotalWidthWithSidePanels } from "./hooks/useSceneTotalWidthWithSidePanels";

// Selectors
export {
  getSidePanelsOption,
  getSidePanelLeftStatus,
  getSidePanelRightStatus,
  selectSidePanelAvailability,
  mapCabinetTypeToGroup,
} from "./model/selectors";

// Rules
export {
  sidePanelAvailabilityRule,
  sidePanelSpecRule,
  sidePanelCountertopLengthRule,
  syntesiSidePanelRule,
  SIDE_PANEL_OPEN_SHELF_UNAVAILABLE_REASON,
  SIDE_PANEL_SIDE_SHELF_UNAVAILABLE_REASON,
} from "./lib/sidePanelRules";

export {
  buildSidePanelEdgeState,
  isShelfSidePanelReason,
  isShelfSidePanelReasonCode,
  mapSidePanelDrawersToHandleType,
  resolveSelectedSidePanelSide,
  resolveSidePanelAvailabilityForEdges,
  resolveSidePanelTargetSide,
  type SidePanelEntitySide,
  type SidePanelEdgeState,
  type SidePanelTargetSide,
} from "./lib/sidePanelEdgeCompatibility";

// Constants
export { SIDE_PANEL_AVAILABILITY, SIDE_PANELS_NONE, SYNTESI_MATERIAL_TOKEN } from "./lib/constants";

// Reasons registry (panel-level blocks + non-blocking notice)
export {
  formatSidePanelGrooveLabel,
  formatSidePanelSideLabel,
  isSidePanelGrooveAvailableForSide,
  resolveSidePanelGridActiveValue,
  resolveSidePanelSyncPrompt,
  type SidePanelApplySide,
  type SidePanelSyncPrompt,
} from "./lib/sidePanelSelectionState";

export {
  resolveSidePanelBlock,
  resolveSidePanelHint,
  resolveSidePanelNotice,
  isSidePanelLengthBlocked,
  formatSidePanelLength340Reason,
  SIDE_PANEL_BLOCK_REASONS,
  SIDE_PANEL_LENGTH_BLOCK_CM,
  SIDE_PANEL_SELECT_END_HINT,
  type SidePanelReasonCtx,
  type SidePanelNotice,
  type SidePanelBlockReason,
  type SidePanelBlockId,
} from "./lib/sidePanelReasons";

export { SidePanelNoticeBox } from "./ui/SidePanelNoticeBox";
export { SidePanelSyncConfirmModal } from "./ui/SidePanelSyncConfirmModal";

// Middleware
export { setupSidePanelListener } from "./lib/sidePanelMiddleware";
