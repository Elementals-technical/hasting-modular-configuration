/**
 * Which text of the collection's `messages` the UI shows for what 3D reports. 3D sends stable codes; the
 * keys and the wording belong to the collection profile (`messages.organizer.*`). Kept here, and not in
 * features/configurationCommands, so the reason-code guard tests never ask USH for these texts.
 */

/** Correction code -> message key. `null`: only the log, the user is not told. */
export const CORRECTION_MESSAGE_KEYS: Readonly<Record<string, string | null>> = {
  OUT_OF_RANGE: "organizer.trimmed",
  IN_LOCKED_ZONE: "organizer.trimmed",
  MALFORMED: "organizer.trimmed",
  DUPLICATE_SLOT: "organizer.trimmed",
  DRAWER_ABSENT: "organizer.drawerRemoved",
  NOT_OFFERED: "organizer.drawerRemoved",
  UNSUPPORTED_WIDTH: "organizer.unavailable",
  UNSUPPORTED_VERSION: "organizer.updateRequired",
  POSITIONS_FIXED: null,
  UNKNOWN_STYLE: null,
  HOLE: null,
  RENDER_TIMEOUT: null,
};

/** Error code of a rejected command -> message key; every other code reads `organizer.placeFailed`. */
export const ERROR_MESSAGE_KEYS: Readonly<Record<string, string>> = {
  ORGANIZERS_SLOT_UNAVAILABLE: "organizer.placeFailed",
  ORGANIZERS_NOT_READY: "organizer.placeFailed",
  ORGANIZERS_DRAWER_UNAVAILABLE: "organizer.unavailable",
  ORGANIZERS_UNSUPPORTED_VERSION: "organizer.updateRequired",
};

/** Hints, limits and toasts the panel raises itself. */
export const ORGANIZER_MESSAGE_KEYS = {
  hintOpenDrawer: "organizer.hintOpenDrawer",
  lockedZone: "organizer.lockedZone",
  drawerFull: "organizer.drawerFull",
  unavailable: "organizer.unavailable",
  maxPositions: "organizer.maxPositions",
  columnRemoved: "organizer.columnRemoved",
  cleared: "organizer.cleared",
  typeChanged: "organizer.typeChanged",
  undoHint: "organizer.undoHint",
  oakPending: "organizer.oakPending",
} as const;

const PLACE_FAILED = "organizer.placeFailed";

/** The key to tell the user about a correction, or null when it is only logged (or the code is new). */
export const messageKeyForCorrection = (code: string): string | null =>
  Object.hasOwn(CORRECTION_MESSAGE_KEYS, code) ? CORRECTION_MESSAGE_KEYS[code] : null;

export const messageKeyForError = (code: string): string =>
  Object.hasOwn(ERROR_MESSAGE_KEYS, code) ? ERROR_MESSAGE_KEYS[code] : PLACE_FAILED;
