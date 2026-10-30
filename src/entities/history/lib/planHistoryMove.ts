import type { ConfigurationSnapshot, ScopedValue, StableCabinetKey } from "@/entities/configuration";
import {
  DRAWER_ORGANIZERS_KEY,
  readDrawerOrganizers,
  type DrawerName,
  type DrawerOrganizersV1,
} from "@/entities/configuration/model/drawerOrganizers";
import type { SceneSnapshot } from "@/entities/history/model/store/slice";

/**
 * Classifies an undo/redo move (step B of the organizers history spec): a move that changed only the Ph2
 * drawer organizers (and, at most, the two options the organizers panel owns) is replayed on the products
 * that stand in the scene through `organizers.setState`; anything else rebuilds the scene as before.
 *
 * Pure: it reads the two snapshots and nothing else. Every doubt answers `full`, since a wrong `full` only
 * costs a rebuild while a wrong `organizers` would leave the scene and the state apart.
 */

/** One product whose organizers the move changes; `runtimeId` is the one the product has NOW (from `current`). */
export type OrganizerWrite = {
  stableKey: StableCabinetKey;
  runtimeId: string;
  /** What the target holds; null when the target has no `DrawerOrganizers` key for the product. */
  state: DrawerOrganizersV1 | null;
  /** The drawers whose set differs between the two snapshots (the view follows one of them after the move). */
  drawers: DrawerName[];
};

/** The two product options the organizers panel owns (`state-only` in the runtime bindings). */
export type OrganizerOptionValues = { DividersOption?: string; DividersStyle?: string };

export type OrganizersMovePlan = {
  kind: "organizers";
  /** Products whose `DrawerOrganizers` differ, in composition order. May be empty when only the options differ. */
  writes: OrganizerWrite[];
  /** `target.configuration.values` when its `DividersOption`/`DividersStyle` entries differ from the current ones; else null. */
  values: Record<string, ScopedValue[]> | null;
  /** `target.productOptions.DividersOption/DividersStyle` for each one that differs from the current; else null. */
  productOptions: OrganizerOptionValues | null;
};

export type HistoryMovePlan = OrganizersMovePlan | { kind: "full"; reason: string };

/** `full` reason of a move with nothing to change: used by the dev check after a fast path. */
export const NO_DIFFERENCE = "no-difference";

/** Attributes whose configuration values and product options may differ on an organizers-only move. */
export const ORGANIZER_OPTION_IDS = ["DividersOption", "DividersStyle"] as const;

/** `positionX/Y/Z` of a product config are compared with this tolerance, in metres. */
export const POSITION_TOLERANCE_M = 1e-4;

/**
 * Plans the move from the snapshot the scene shows now (`current`) to the one undo/redo goes to (`target`).
 *
 * A full rebuild gives every product a new runtime id, so the two snapshots are compared by the stable keys
 * each one recorded (`cabinetKeys`): runtime ids in either snapshot are read as stable keys first.
 *
 * Returns `organizers` only when the move changes nothing but the `DrawerOrganizers` of some products and the
 * `ORGANIZER_OPTION_IDS` options/values; every other move, and any snapshot that cannot be read, is `full`
 * with a reason naming the first part found to differ (`"products-differ"`, `"config:Width"`, `"sceneLayout"`…).
 * Never throws and never changes the snapshots.
 *
 * Examples (stable key `cab-1`; runtime id `rt-a` now, `rt-old` in the target):
 * - only `rt-old.DrawerOrganizers` differs →
 *   `{ kind: "organizers", writes: [{ stableKey: "cab-1", runtimeId: "rt-a", state: <target's> }], values: null, productOptions: null }`;
 * - the target also has another `Width` → `{ kind: "full", reason: "config:Width" }`;
 * - both snapshots are the same → `{ kind: "full", reason: NO_DIFFERENCE }`.
 */
export function planHistoryMove(current: SceneSnapshot, target: SceneSnapshot): HistoryMovePlan {
  try {
    return classifyMove(current, target);
  } catch (error) {
    // A snapshot of an unexpected shape (an older client, a hand-edited state): the rebuild is the safe answer.
    const message = error instanceof Error ? error.message : String(error);
    return full(`normalize-failed: ${message}`);
  }
}

const full = (reason: string): HistoryMovePlan => ({ kind: "full", reason });

function classifyMove(current: SceneSnapshot, target: SceneSnapshot): HistoryMovePlan {
  // 1. Products are matched across a rebuild by stable key: a snapshot that cannot name each of its products
  //    by one (an older client, a product the configuration never recorded) cannot be matched.
  const currentView = readSnapshot(current);
  const targetView = readSnapshot(target);
  if (!currentView || !targetView) return full("no-cabinet-keys");

  // 2. The same products in the same order; anything else adds, removes or moves a cabinet.
  if (!isDeepEqual(currentView.order, targetView.order)) return full("products-differ");

  // 3. Everything the scene is built from, except the organizers, is the same.
  const fixedDifference = findFixedDifference(currentView, targetView);
  if (fixedDifference) return full(fixedDifference);

  // 4. Product options and configuration values: only the organizer options may differ (the panel's "None"
  //    step writes them together with the organizers).
  const optionDifference = findProductOptionDifference(current, target);
  if (optionDifference) return full(optionDifference);

  const valueDifference = findValueDifference(current.configuration, target.configuration);
  if (valueDifference) return full(valueDifference);

  // 5. The products whose organizers the move changes. A target value this build cannot read (another version,
  //    a broken value) cannot be written back through the organizers port; the rebuild hands it to the scene as is.
  const writes = planOrganizerWrites(currentView, targetView);
  if (!writes) return full("organizers-unreadable");

  // 6. The organizer options the move changes, in the product options and in the configuration values.
  const productOptions = changedOrganizerOptions(current, target);
  const values = changedOrganizerValues(current.configuration, target.configuration);

  // 7. Nothing changes at all: no step to replay (the dev check after a fast path reads this reason).
  const changesNothing = writes.length === 0 && productOptions === null && values === null;
  if (changesNothing) return full(NO_DIFFERENCE);

  return { kind: "organizers", writes, values, productOptions };
}

// ---------------------------------------------------------------------------------------------------------------
// Reading a snapshot by stable keys
// ---------------------------------------------------------------------------------------------------------------

/** Stable key of each runtime id, as one snapshot recorded it (`SceneSnapshot.cabinetKeys`). */
type StableKeys = ReadonlyMap<string, StableCabinetKey>;

/** One snapshot read for comparison, with the runtime ids of its products replaced by their stable keys. */
type SnapshotView = {
  snapshot: SceneSnapshot;
  keys: StableKeys;
  /** Stable key of each product, in composition order (`productIds`). */
  order: StableCabinetKey[];
  /** Each product config by stable key, compared without its organizers (see `normalizeProductConfig`). */
  configs: Map<StableCabinetKey, Record<string, unknown>>;
  /** The raw `DrawerOrganizers` value of each product config by stable key; undefined when it has no such key. */
  organizers: Map<StableCabinetKey, unknown>;
};

/** The view of a snapshot; null when it has no `cabinetKeys` or one of its products has no key in them. */
function readSnapshot(snapshot: SceneSnapshot): SnapshotView | null {
  // Snapshots of older clients carry no keys.
  if (!snapshot.cabinetKeys) return null;
  const keys: StableKeys = new Map(Object.entries(snapshot.cabinetKeys));

  const order: StableCabinetKey[] = [];
  for (const runtimeId of snapshot.productIds) {
    const stableKey = keys.get(runtimeId);
    // A product the configuration never recorded: nothing to match it by in the other snapshot.
    if (stableKey === undefined) return null;
    order.push(stableKey);
  }

  const configs = new Map<StableCabinetKey, Record<string, unknown>>();
  const organizers = new Map<StableCabinetKey, unknown>();
  for (const [runtimeId, config] of Object.entries(snapshot.productConfigs)) {
    const stableKey = toStableId(keys, runtimeId);
    configs.set(stableKey, normalizeProductConfig(config, runtimeId, stableKey));
    organizers.set(stableKey, config[DRAWER_ORGANIZERS_KEY]);
  }

  return { snapshot, keys, order, configs, organizers };
}

/** The stable key of a runtime id; any other string (not a product of the snapshot) is returned as it is. */
const toStableId = (keys: StableKeys, value: string): string => keys.get(value) ?? value;

/**
 * A copy of a product config as it is compared: `entityName` (the product's runtime id) becomes its stable key,
 * and `DrawerOrganizers` is left out, since the organizers are the part the move may change (compared on their own).
 */
function normalizeProductConfig(
  config: Record<string, unknown>,
  runtimeId: string,
  stableKey: StableCabinetKey,
): Record<string, unknown> {
  const normalized = { ...config };
  delete normalized[DRAWER_ORGANIZERS_KEY];
  if (normalized.entityName === runtimeId) normalized.entityName = stableKey;
  return normalized;
}

/**
 * The scene layout as it is compared: the runtime ids it holds (`cabinetIds` values, and every string of the
 * scene document that is exactly a runtime id) become stable keys. Null when the snapshot has no layout.
 */
function normalizeLayout(view: SnapshotView): unknown {
  const layout = view.snapshot.sceneLayout;
  if (!layout) return null;

  return {
    ...layout,
    document: replaceRuntimeIds(layout.document, view.keys),
    cabinetIds: mapRecordValues(layout.cabinetIds, (runtimeId) => toStableId(view.keys, runtimeId)),
  };
}

/** A copy of plain data in which every string equal to a runtime id is its stable key; longer strings are kept. */
function replaceRuntimeIds(value: unknown, keys: StableKeys): unknown {
  if (typeof value === "string") return toStableId(keys, value);
  if (Array.isArray(value)) return value.map((item) => replaceRuntimeIds(item, keys));
  if (isRecord(value)) return mapRecordValues(value, (item) => replaceRuntimeIds(item, keys));
  return value;
}

// ---------------------------------------------------------------------------------------------------------------
// Parts the move must leave as they are
// ---------------------------------------------------------------------------------------------------------------

/**
 * Parts of a snapshot an organizers-only move leaves as they are, each read with runtime ids as stable keys and
 * compared with `isDeepEqual`. `name` is the `full` reason when the two snapshots differ in the part.
 * Read by `findFixedDifference`; to add a part, add an entry here.
 */
const FIXED_PARTS: ReadonlyArray<{ name: string; read: (view: SnapshotView) => unknown }> = [
  { name: "productsPresets", read: (view) => view.snapshot.productsPresets },
  { name: "activeCabinetType", read: (view) => view.snapshot.activeCabinetType },
  { name: "selectedDimensions", read: (view) => view.snapshot.selectedDimensions },
  {
    name: "placedDividers",
    read: (view) =>
      view.snapshot.placedDividers?.map((divider) => ({
        ...divider,
        cabinetId: toStableId(view.keys, divider.cabinetId),
      })),
  },
  {
    name: "placedCabinetStyles",
    read: (view) => mapRecordKeys(view.snapshot.placedCabinetStyles, (runtimeId) => toStableId(view.keys, runtimeId)),
  },
  { name: "sceneLayout", read: normalizeLayout },
  // A snapshot of an older client has no configuration: equal when both lack it, never when only one does.
  { name: "configuration", read: (view) => (view.snapshot.configuration ? "present" : "absent") },
  { name: "configuration.collectionId", read: (view) => view.snapshot.configuration?.collectionId },
  { name: "configuration.version", read: (view) => view.snapshot.configuration?.version },
  {
    name: "configuration.cabinets",
    read: (view) =>
      view.snapshot.configuration?.cabinets.map((cabinet) => ({
        ...cabinet,
        runtimeId: toStableId(view.keys, cabinet.runtimeId),
      })),
  },
];

/**
 * The first part (other than organizers and options) in which the two snapshots differ, as a reason; else null.
 * `selectedProductConfig` is not compared: it is the builder's selection, not the scene (a rebuild replaces it with
 * the first product's whole config), and the fast path keeps the products, so the current selection stays valid.
 */
function findFixedDifference(current: SnapshotView, target: SnapshotView): string | null {
  const configDifference = findProductConfigDifference(current, target);
  if (configDifference) return configDifference;

  for (const part of FIXED_PARTS) {
    if (!isDeepEqual(part.read(current), part.read(target))) return part.name;
  }
  return null;
}

/** `"productConfigs"` when a product has a config in one snapshot only; `"config:<field>"` for a field; else null. */
function findProductConfigDifference(current: SnapshotView, target: SnapshotView): string | null {
  const stableKeys = new Set([...current.configs.keys(), ...target.configs.keys()]);
  for (const stableKey of stableKeys) {
    const currentConfig = current.configs.get(stableKey);
    const targetConfig = target.configs.get(stableKey);
    if (!currentConfig || !targetConfig) return "productConfigs";

    const field = findConfigFieldDifference(currentConfig, targetConfig);
    if (field) return `config:${field}`;
  }
  return null;
}

/** Fields of a product config holding where the product stands, in metres (compared within `POSITION_TOLERANCE_M`). */
const POSITION_FIELDS: readonly string[] = ["positionX", "positionY", "positionZ"];

/** The first field in which two configs differ; null when none does. */
function findConfigFieldDifference(current: Record<string, unknown>, target: Record<string, unknown>): string | null {
  for (const field of unionKeys(current, target)) {
    const same = POSITION_FIELDS.includes(field)
      ? isSamePosition(current[field], target[field])
      : isSameConfigValue(current[field], target[field]);
    if (!same) return field;
  }
  return null;
}

/**
 * Two values of a config field. A rebuilt product reads a numeric option back as the string the replay sent
 * (`Thickness: "0.5"` for a placed product's `0.5`): a number and the string of the same number are one value.
 */
function isSameConfigValue(current: unknown, target: unknown): boolean {
  if (isDeepEqual(current, target)) return true;
  return asNumber(current) !== null && asNumber(current) === asNumber(target);
}

/** The number a config value stands for: a finite number, or a string holding exactly one; null otherwise. */
function asNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Two coordinates of a product: a rebuild may put it back a float rounding away from where it stood. */
function isSamePosition(current: unknown, target: unknown): boolean {
  // Not two numbers (one is missing, a string…): compared as any other field.
  if (typeof current !== "number" || typeof target !== "number") return isDeepEqual(current, target);
  return Math.abs(current - target) <= POSITION_TOLERANCE_M;
}

// ---------------------------------------------------------------------------------------------------------------
// Options and values: only the organizer ones may differ
// ---------------------------------------------------------------------------------------------------------------

const isOrganizerOption = (attributeId: string): boolean =>
  (ORGANIZER_OPTION_IDS as readonly string[]).includes(attributeId);

/** `"productOptions:<id>"` for the first product option other than the organizer ones that differs; else null. */
function findProductOptionDifference(current: SceneSnapshot, target: SceneSnapshot): string | null {
  const currentOptions: Record<string, unknown> = current.productOptions;
  const targetOptions: Record<string, unknown> = target.productOptions;

  for (const optionId of unionKeys(currentOptions, targetOptions)) {
    // The organizer options may differ: collected by `changedOrganizerOptions`.
    if (isOrganizerOption(optionId)) continue;
    if (!isDeepEqual(currentOptions[optionId], targetOptions[optionId])) return `productOptions:${optionId}`;
  }
  return null;
}

/**
 * `"values:<attributeId>"` for the first configuration attribute other than the organizer ones whose values
 * differ; else null. Two snapshots without a configuration have no values to compare (one without it is
 * already a difference, see `FIXED_PARTS`).
 */
function findValueDifference(
  current: ConfigurationSnapshot | undefined,
  target: ConfigurationSnapshot | undefined,
): string | null {
  if (!current || !target) return null;

  for (const attributeId of unionKeys(current.values, target.values)) {
    // The organizer values may differ: collected by `changedOrganizerValues`.
    if (isOrganizerOption(attributeId)) continue;
    if (!isDeepEqual(current.values[attributeId], target.values[attributeId])) return `values:${attributeId}`;
  }
  return null;
}

/** The target's value of each organizer product option that differs from the current one; null when none does. */
function changedOrganizerOptions(current: SceneSnapshot, target: SceneSnapshot): OrganizerOptionValues | null {
  const changed: OrganizerOptionValues = {};
  let anyChanged = false;

  for (const optionId of ORGANIZER_OPTION_IDS) {
    if (current.productOptions[optionId] === target.productOptions[optionId]) continue;
    changed[optionId] = target.productOptions[optionId];
    anyChanged = true;
  }
  return anyChanged ? changed : null;
}

/** All the target's values when any organizer attribute's values differ; else null (also without configurations). */
function changedOrganizerValues(
  current: ConfigurationSnapshot | undefined,
  target: ConfigurationSnapshot | undefined,
): Record<string, ScopedValue[]> | null {
  if (!current || !target) return null;

  const differs = ORGANIZER_OPTION_IDS.some(
    (attributeId) => !isDeepEqual(current.values[attributeId], target.values[attributeId]),
  );
  return differs ? target.values : null;
}

// ---------------------------------------------------------------------------------------------------------------
// Organizer writes
// ---------------------------------------------------------------------------------------------------------------

/**
 * One write per product whose raw `DrawerOrganizers` differs (a missing key differs from an object; two missing
 * keys are equal), in composition order, addressed by the runtime id the product has in `current`.
 * Null when a target value is neither absent nor a readable v1 value.
 */
function planOrganizerWrites(current: SnapshotView, target: SnapshotView): OrganizerWrite[] | null {
  const writes: OrganizerWrite[] = [];

  for (const [index, stableKey] of current.order.entries()) {
    const targetOrganizers = target.organizers.get(stableKey);
    if (isDeepEqual(current.organizers.get(stableKey), targetOrganizers)) continue;

    const read = readDrawerOrganizers(targetOrganizers);
    // `unsupported-version` or `malformed`: nothing this build may write.
    if (read.status !== "ok" && read.status !== "absent") return null;

    const state = read.status === "ok" ? read.value : null;
    const drawers = changedDrawers(current.organizers.get(stableKey), targetOrganizers);
    writes.push({ stableKey, runtimeId: current.snapshot.productIds[index], state, drawers });
  }
  return writes;
}

const DRAWER_NAMES: readonly DrawerName[] = ["Top", "Bot"];

/** The drawers whose set differs between two raw `DrawerOrganizers` values (a missing value has no sets). */
function changedDrawers(current: unknown, target: unknown): DrawerName[] {
  const setOf = (value: unknown, drawer: DrawerName) => (isRecord(value) ? value[drawer] : undefined);
  return DRAWER_NAMES.filter((drawer) => !isDeepEqual(setOf(current, drawer), setOf(target, drawer)));
}

// ---------------------------------------------------------------------------------------------------------------
// Plain data helpers
// ---------------------------------------------------------------------------------------------------------------

/** A plain record by shape only: configs may come from the PlayCanvas iframe (another realm). */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Keys of either record, each once, the left one's first. */
const unionKeys = (left: object, right: object): string[] => [
  ...new Set([...Object.keys(left), ...Object.keys(right)]),
];

/** A copy of a record with its values mapped. */
function mapRecordValues<T, R>(record: Record<string, T>, map: (value: T) => R): Record<string, R> {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, map(value)]));
}

/** A copy of a record with its keys mapped; undefined stays undefined (an optional part of an older snapshot). */
function mapRecordKeys<T>(
  record: Record<string, T> | undefined,
  map: (key: string) => string,
): Record<string, T> | undefined {
  if (!record) return undefined;
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [map(key), value]));
}

/**
 * Structural equality of plain data (what snapshots hold): primitives, arrays, plain records.
 * A record key holding `undefined` counts as no key, so `{ a: undefined }` equals `{}`.
 */
function isDeepEqual(left: unknown, right: unknown): boolean {
  if (left === right) return true;

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return false;
    if (left.length !== right.length) return false;
    return left.every((item, index) => isDeepEqual(item, right[index]));
  }

  if (isRecord(left) && isRecord(right)) {
    return unionKeys(left, right).every((key) => isDeepEqual(left[key], right[key]));
  }

  // Two different primitives, or a primitive and a record. NaN is the one value not === to itself.
  return Number.isNaN(left) && Number.isNaN(right);
}
