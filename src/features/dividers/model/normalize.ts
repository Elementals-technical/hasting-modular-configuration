import type {
  DividerSlot,
  DividerSlotDisabledReason,
  DividerSlotPosition,
  DividerType,
  DrawerType,
} from "./types";

const DIVIDER_TYPE_ORDER: readonly DividerType[] = ["A", "B", "C"];

const DRAWER_TYPES: readonly DrawerType[] = ["Top", "TopFull", "Bot"];

const DISABLED_REASONS: readonly NonNullable<DividerSlotDisabledReason>[] = [
  "select-divider",
  "does-not-fit",
  "no-space",
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isDividerType = (value: unknown): value is DividerType =>
  value === "A" || value === "B" || value === "C";

const isDrawerType = (value: unknown): value is DrawerType =>
  DRAWER_TYPES.some((type) => type === value);

export const normalizeDividerType = (value: unknown): DividerType | null =>
  isDividerType(value) ? value : null;

/** Filters unknown input down to valid divider types, preserving the incoming order. */
export const normalizeDividerTypes = (value: unknown): DividerType[] =>
  Array.isArray(value) ? value.filter(isDividerType) : [];

/** Stable A → B → C ordering with de-duplication. Use for availability state (value equality). */
export const sortDividerTypes = (types: Iterable<unknown> | null | undefined): readonly DividerType[] => {
  if (!types) return [];

  const present = new Set<DividerType>();
  for (const type of types) {
    if (isDividerType(type)) present.add(type);
  }

  return DIVIDER_TYPE_ORDER.filter((type) => present.has(type));
};

/** Value equality for divider type arrays — prevents effect loops on fresh-but-equal arrays. */
export const dividerTypesEqual = (
  a: readonly DividerType[] | null | undefined,
  b: readonly DividerType[] | null | undefined,
): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;

  return a.every((type, index) => type === b[index]);
};

/** Value equality for divider type sets (legacy page-level availability state). */
export const dividerTypeSetsEqual = (
  left: ReadonlySet<DividerType> | null,
  right: ReadonlySet<DividerType> | null,
): boolean => {
  if (left === right) return true;
  if (!left || !right) return false;
  if (left.size !== right.size) return false;

  for (const type of left) {
    if (!right.has(type)) return false;
  }

  return true;
};

/** Parses "Option A" / "Option B" / "Option C" UI labels into a domain divider type. */
export const getDividerTypeFromOptionTitle = (title: string): DividerType | null => {
  if (title.trim() === "Option A") return "A";
  if (title.trim() === "Option B") return "B";
  if (title.trim() === "Option C") return "C";
  return null;
};

const normalizePosition = (value: unknown): DividerSlotPosition | null => {
  if (!isRecord(value)) return null;

  const { start, center, end } = value;
  if (typeof start !== "number" || typeof center !== "number" || typeof end !== "number") return null;

  return { start, center, end };
};

const normalizeDisabledReason = (value: unknown): DividerSlotDisabledReason =>
  DISABLED_REASONS.find((reason) => reason === value) ?? null;

/** Fallback for candidate keys of the form "candidate:Bot:main:left:0:A". */
const parsePlacementTypeFromKey = (key: string): DividerType | null => {
  const segments = key.split(":");
  if (segments.length < 2) return null;

  return normalizeDividerType(segments[segments.length - 1]);
};

/**
 * Normalizes a raw slotInfo payload from any PlayCanvas callback into a `DividerSlot`.
 *
 * Supported raw shapes:
 * 1. Add-slot — `DividerSlotInfo` from setOnAddSlotClick.ts
 * 2. Occupied-slot — `OccupiedSlotInfo` from setOnOccupiedSlotClick.ts (has `dividerType` + `stateId`)
 * 3. Legacy — `DividerSlotClickInfo` from setDividerSlotClickHandler.ts (occupancy via `isOccupied`)
 */
export const normalizeSlotInfo = (raw: unknown): DividerSlot | null => {
  if (!isRecord(raw)) return null;

  const cabinetId = typeof raw.cabinetId === "string" ? raw.cabinetId : null;
  const drawerType = isDrawerType(raw.drawerType) ? raw.drawerType : null;
  const zone = typeof raw.zone === "string" ? raw.zone : null;
  const key = typeof raw.key === "string" ? raw.key : null;

  if (!cabinetId || !drawerType || !zone || !key) return null;

  const stateId = typeof raw.stateId === "string" ? raw.stateId : null;
  const occupiedType = normalizeDividerType(raw.dividerType);
  const isOccupied = raw.isOccupied === true || (stateId !== null && occupiedType !== null);
  const position = normalizePosition(raw.position);
  const zoneIndex = typeof raw.zoneIndex === "number" ? raw.zoneIndex : null;
  const context = { cabinetId, drawerType };

  if (isOccupied) {
    return {
      context,
      zone,
      key,
      kind: "occupied",
      placementType: null,
      occupiedType,
      stateId,
      availableTypes: [],
      canPlace: false,
      disabledReason: null,
      position,
      zoneIndex,
    };
  }

  return {
    context,
    zone,
    key,
    kind: "candidate",
    placementType: normalizeDividerType(raw.placementType) ?? parsePlacementTypeFromKey(key),
    occupiedType: null,
    stateId: null,
    availableTypes: normalizeDividerTypes(raw.availableTypes),
    canPlace: raw.canPlace !== false,
    disabledReason: normalizeDisabledReason(raw.disabledReason),
    position,
    zoneIndex,
  };
};
