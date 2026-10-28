/**
 * Public API of the Ph2 drawer organizers (ROW-MTL-43): what the rest of the app imports. The rest of the
 * folder (`model`, `lib`, `ui`) is the feature's own; other code reaches into it by deep path only where a
 * card says so (the Accessories page, the Summary builders).
 */
export { DrawerOrganizerLayer } from "./ui/DrawerOrganizerLayer";
export { DividerOptionsPanel, usePlayerLeftInset } from "./ui/DividerOptionsPanel";
export { useOrganizerSection } from "./lib/useOrganizerSection";
export { organizerOverlayStore } from "./lib/organizerOverlayStore";
export { selectOrganizersEnabled, selectOrganizerFocus } from "./model/store/selectors";
export { readOrganizerRules } from "./model/rules";
