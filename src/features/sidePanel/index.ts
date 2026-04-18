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
} from "./lib/sidePanelRules";

// Constants
export { SIDE_PANEL_AVAILABILITY, SIDE_PANELS_NONE, SYNTESI_MATERIAL_TOKEN } from "./lib/constants";

// Middleware
export { setupSidePanelListener } from "./lib/sidePanelMiddleware";
