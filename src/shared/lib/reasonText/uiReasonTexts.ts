/**
 * Interface wording for reason codes, in one place (DEV-08).
 *
 * A collection may override any of these by declaring the same code in its `messages`; the
 * provider in `features/collectionCustomization` reads the collection first. These texts are
 * what the user sees when the collection says nothing, so they must stay product-neutral:
 * anything true for one collection only belongs in that collection's `messages`.
 *
 * Adding a locale later means one map per locale here and a locale choice in the provider;
 * nothing outside this folder resolves a code to text.
 */
export const UI_REASON_TEXTS: Record<string, string> = {
  /** A disabled option of a grid or a field. */
  "ui.optionUnavailable": "Not available for selected configuration",
  /** A value that cannot be chosen at all, shown next to a whole control. */
  "ui.valueUnavailable": "Not available.",
  /** Cabinet styles the collection does not allow in one composition (`ruleData.drawerStyleGroups`). */
  "drawers.mixingRestricted": "These cabinet styles cannot be mixed in one vanity configuration.",
  /* Countertop placement (ConfiguratorAPI.countertop validation slugs, phase 1). */
  TRAP_KEEPOUT: "Too close to the sink trap.",
  BASIN_EDGE_TOO_CLOSE: "Sink too close to the countertop edge.",
  SINK_BASE_NOT_COVERED: "The countertop must cover the sink cabinet.",
  SINK_LANDING_GAP: "The sink can't go here.",
  SINK_LANDING_UNFIT: "The sink can't go on this cabinet.",
  COUNTERTOP_COLLISION: "The countertop overlaps another object.",
  COUNTERTOP_VERTICAL_LOCKED: "This countertop can only slide left or right.",
  /* Countertop movement mode by thickness (shown when the mode switches). */
  "countertop.mode.offset": "4″ countertop: it can only slide left or right.",
  "countertop.mode.free": "This countertop can be moved and lifted.",
  "countertop.mode.none": "This countertop stays in the standard position.",
  /** Appended when the switch auto-corrected the pose. */
  "countertop.mode.lowered": "It was lowered onto the cabinets.",
  "countertop.mode.reset": "It was returned to the standard position.",
};
