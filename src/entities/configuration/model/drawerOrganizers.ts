/**
 * Ph2 drawer organizers (ROW-MTL-43): the state key the scene writes and the types of the
 * `ConfiguratorAPI.organizers` contract v1 (OPUS-C §4.1–4.2).
 *
 * 3D owns every rule (ranges, locked zones, candidates, codec); the UI only reads what the scene
 * wrote. Shared fixtures that pin these shapes: src/features/drawerOrganizers/__tests__/fixtures/contract/
 * (canon in the 3D repo, tests/node/fixtures/drawer-organizers/).
 */

/** `productConfig.DrawerOrganizers` of an organizer product (Class / Mako / Tricot / Lame). */
export const DRAWER_ORGANIZERS_KEY = "DrawerOrganizers";
/** Data version this build reads and the scene writes. Any other version is left untouched. */
export const DRAWER_ORGANIZERS_VERSION = 1;

export type DrawerName = "Top" | "Bot";
export type OrganizerStyle = "Metal" | "Oak";
/** `slot`: signed 10 cm step from the drawer centre; `positions`: pressed cell buttons, 1 = back cell, at most `profile.maxActive` (5 for ROW-MTL-43). */
export type OrganizerColumn = { slot: number; positions: number[] };
export type OrganizerSet = { style: OrganizerStyle; columns: OrganizerColumn[] };
export type DrawerOrganizersV1 = { version: 1; Top?: OrganizerSet; Bot?: OrganizerSet };

export type CandidateSlot = {
  id: string /* "Top:+2" */;
  drawer: DrawerName;
  slot: number;
  side: "center" | "left" | "right";
};
export type DrawerDerived = {
  exists: boolean;
  offered: boolean;
  role: "single" | "outer" | "inner" | "main" | null;
  profile: { id: string; pitchM: number; positionCount: number; maxActive: number; codec: string } | null;
  maxSlot: number;
  capacity: number;
  count: number;
  lock: { fromSlot: number; toSlot: number; reason: "SINK_CUTOUT" } | null;
  candidates: CandidateSlot[];
  unavailable: null | "NO_DRAWER" | "NOT_OFFERED" | "LOCKED_FULL" | "FULL" | "UNSUPPORTED_WIDTH";
};
export type Correction = {
  code: string;
  severity: "dropped" | "fixed" | "info" | "error";
  drawer?: DrawerName;
  slot?: number;
  detail?: Record<string, unknown>;
};
export type OrganizersState = {
  productId: string;
  /** Grows monotonically per product. */
  revision: number;
  params: { collection: string; role: "SB" | "SC"; width: number; drawersMode: string };
  state: DrawerOrganizersV1 | null;
  drawers: Record<DrawerName, DrawerDerived>;
  lastCorrections: Correction[];
};
export type OrganizersReceipt = {
  /** partial: applied with a `fixed` or `dropped` correction; `info` corrections keep it `applied`. */
  status: "applied" | "noop" | "partial" | "rejected";
  state: OrganizersState | null;
  corrections: Correction[];
  error?: { code: string; message: string };
};

export type DrawerOrganizersRead =
  | { status: "absent" }
  | { status: "ok"; value: DrawerOrganizersV1 }
  | { status: "unsupported-version"; version: unknown }
  | { status: "malformed"; issue: string };

const DRAWERS: readonly DrawerName[] = ["Top", "Bot"];
const STYLES: readonly string[] = ["Metal", "Oak"];

/** A plain record by shape only: values may come from the PlayCanvas iframe (another realm), so no instanceof/prototype checks. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isIntegerList = (value: unknown): value is number[] =>
  Array.isArray(value) && value.every((item) => Number.isInteger(item));

/** What a part of the value reads as: a fresh copy, or the first shape problem found in it. */
type Parsed<T> = { value: T } | { issue: string };

function readColumn(raw: unknown, path: string): Parsed<OrganizerColumn> {
  if (!isRecord(raw)) return { issue: `${path} is not an object` };
  if (!Number.isInteger(raw.slot)) return { issue: `${path}.slot is not an integer` };
  if (!isIntegerList(raw.positions)) return { issue: `${path}.positions is not a list of integers` };
  // Fresh arrays: the result never shares memory with the scene's (or another realm's) object.
  return { value: { slot: raw.slot as number, positions: [...raw.positions] } };
}

function readSet(raw: unknown, drawer: DrawerName): Parsed<OrganizerSet> {
  if (!isRecord(raw)) return { issue: `${drawer} is not an object` };
  const style = raw.style;
  if (typeof style !== "string" || !STYLES.includes(style)) return { issue: `${drawer}.style is not Metal or Oak` };
  const rawColumns = raw.columns;
  if (!Array.isArray(rawColumns) || rawColumns.length === 0)
    return { issue: `${drawer}.columns is not a non-empty list` };

  const columns: OrganizerColumn[] = [];
  for (const [index, rawColumn] of rawColumns.entries()) {
    const column = readColumn(rawColumn, `${drawer}.columns[${index}]`);
    if ("issue" in column) return column;
    columns.push(column.value);
  }
  return { value: { style: style as OrganizerStyle, columns } };
}

/**
 * Reads productConfig.DrawerOrganizers as the scene wrote it. Never throws and never repairs: the rules live in 3D.
 *
 * - `undefined` / `null`, or `{ version: 1 }` without sets → `{ status: "absent" }`;
 * - `version` is a number other than 1 → `{ status: "unsupported-version", version }` (do not overwrite it);
 * - a set is `{ style: "Metal" | "Oak", columns: [{ slot: integer, positions: integer[] }, …] }` (non-empty);
 *   anything else, or a missing / non-numeric `version` → `{ status: "malformed", issue }`;
 * - extra keys are ignored; `value` is a fresh plain copy (`{ version: 1, Top?, Bot? }`).
 *
 * Example: `readDrawerOrganizers({ version: 1, Bot: { style: "Metal", columns: [{ slot: 0, positions: [2] }] } })`
 * → `{ status: "ok", value: { version: 1, Bot: { style: "Metal", columns: [{ slot: 0, positions: [2] }] } } }`.
 */
export function readDrawerOrganizers(raw: unknown): DrawerOrganizersRead {
  // 1. Nothing stored: the product has no organizers.
  if (raw === undefined || raw === null) return { status: "absent" };
  try {
    // 2. Version first: a newer build's data is reported, never read as v1 or as empty.
    if (!isRecord(raw)) return { status: "malformed", issue: "DrawerOrganizers is not an object" };
    if (typeof raw.version !== "number") return { status: "malformed", issue: "version is missing or not a number" };
    if (raw.version !== DRAWER_ORGANIZERS_VERSION) return { status: "unsupported-version", version: raw.version };

    // 3. Each present set is copied; a key holding `undefined` counts as no set.
    const value: DrawerOrganizersV1 = { version: 1 };
    for (const drawer of DRAWERS) {
      if (raw[drawer] === undefined) continue;
      const set = readSet(raw[drawer], drawer);
      if ("issue" in set) return { status: "malformed", issue: set.issue };
      value[drawer] = set.value;
    }

    // 4. `{ version: 1 }` without sets is the same as no key (the scene never writes it).
    const hasSets = value.Top !== undefined || value.Bot !== undefined;
    return hasSets ? { status: "ok", value } : { status: "absent" };
  } catch {
    // Only a hostile object gets here (a throwing getter or proxy trap): unreadable data is malformed, never an exception.
    return { status: "malformed", issue: "DrawerOrganizers could not be read" };
  }
}
