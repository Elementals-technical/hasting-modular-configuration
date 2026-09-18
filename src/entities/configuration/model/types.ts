import type { AttributeScope } from "@/entities/collection";

/**
 * Configuration state model — what the user has chosen, addressed by target.
 *
 * The product catalog (what may exist) lives in ProductProfile and belongs to the
 * collection domain. This module owns only the chosen values, their addressing,
 * and the stable identity/order of the products they are attached to.
 */

export type Scope = AttributeScope;

/** C-owned identity of a product in the composition. Survives reordering and restore. */
export type StableCabinetKey = string;

/** Drawer slot inside a cabinet. Matches PlacedDivider["drawerType"] in the product slice. */
export type DrawerType = "Top" | "TopFull" | "Bot";

/**
 * Address of a value. Configuration-wide scopes carry no id;
 * per-product scopes carry the stable key, never the runtime id.
 */
export type ValueTarget =
  | { scope: "global" | "countertop" }
  /**
   * A legacy save can address the whole composition's basin. New writes always carry
   * the sink-base stable key so two basins cannot overwrite one another.
   */
  | { scope: "basin"; sinkBaseId?: StableCabinetKey }
  | { scope: "cabinet"; cabinetId: StableCabinetKey }
  | { scope: "drawer"; cabinetId: StableCabinetKey; drawerType: DrawerType };

export type AttributeValue = string | number | boolean | null;

export type ScopedValue = {
  target: ValueTarget;
  value: AttributeValue;
};

/**
 * One product in the composition.
 * `stableKey` is owned by C, `runtimeId` and the real order are owned by I —
 * C only records what the scene reports (CONTRACTS §6).
 */
export type CabinetEntry = {
  stableKey: StableCabinetKey;
  runtimeId: string;
  index: number;
};

/** Size of one product as the scene reports it, in cm. Null when the scene has no value. */
export type CabinetDimensions = {
  width: number | null;
  height: number | null;
  depth: number | null;
};

export type ConfigurationState = {
  /** Active collection, supplied by A. Never inferred from a source id such as 4/438/439. */
  collectionId: string | null;
  cabinets: CabinetEntry[];
  /**
   * Actual size of each product, recorded from the scene (I04). Not part of the snapshot:
   * the saved per-product config already carries the size.
   */
  dimensionsByCabinet: Record<StableCabinetKey, CabinetDimensions>;
  /** Monotonic counter behind stableKey generation; never reused within a session. */
  nextCabinetSeq: number;
  /**
   * Values of attributes that have been migrated off the typed core.
   * Invariant: an attributeId lives either here or in the typed product slice — never in both.
   */
  valuesByAttributeId: Record<string, ScopedValue[]>;
  /** Service state of restoring a saved configuration (C09). */
  restore: RestoreState;
  /** A runtime command changed only part of its agreed set; saving must wait for a scene sync. */
  runtimeSync: RuntimeSyncState;
};

export type RuntimeSyncState = {
  needsSync: boolean;
};

/**
 * - restoring: a restore is running;
 * - restored: the saved configuration came back whole;
 * - partial: the scene was rebuilt but not completely;
 * - failed: the restore stopped, before the scene was touched unless reported otherwise.
 */
export type RestoreStatus = "idle" | "restoring" | "restored" | "partial" | "failed";

/**
 * Why a restore did not come back whole:
 * - not-found: the saved configuration could not be loaded;
 * - collection: its collection is missing, empty, another one, or failed to load;
 * - invalid: the saved payload failed the checks;
 * - scene: the scene could not be rebuilt;
 * - partial: the scene came back only in part.
 */
export type RestoreFailureReason = "not-found" | "collection" | "invalid" | "scene" | "partial";

export type RestoreState = {
  configId: string | null;
  status: RestoreStatus;
  /** Why it failed, for partial and failed; shown to the user. */
  reason: RestoreFailureReason | null;
  /** What went wrong, for partial and failed; for diagnostics. */
  message: string | null;
};

/** Serialized form shared by Save/Share, history and the price consumer. */
export type ConfigurationSnapshot = {
  collectionId: string | null;
  /** Version of this fragment, so a legacy reader can tell old payloads apart. */
  version: number;
  cabinets: CabinetEntry[];
  values: Record<string, ScopedValue[]>;
};

export const CONFIGURATION_SNAPSHOT_VERSION = 2;

export const isSameTarget = (a: ValueTarget, b: ValueTarget): boolean => {
  if (a.scope !== b.scope) return false;

  if (a.scope === "cabinet" && b.scope === "cabinet") {
    return a.cabinetId === b.cabinetId;
  }

  if (a.scope === "drawer" && b.scope === "drawer") {
    return a.cabinetId === b.cabinetId && a.drawerType === b.drawerType;
  }

  if (a.scope === "basin" && b.scope === "basin") {
    return a.sinkBaseId === b.sinkBaseId;
  }

  return true;
};

/** Stable string form of a target, for diagnostics and test assertions. */
export const formatTarget = (target: ValueTarget): string => {
  if (target.scope === "cabinet") return `cabinet:${target.cabinetId}`;
  if (target.scope === "drawer") return `drawer:${target.cabinetId}:${target.drawerType}`;
  if (target.scope === "basin" && target.sinkBaseId) return `basin:${target.sinkBaseId}`;
  return target.scope;
};

const isDrawerType = (value: string | undefined): value is DrawerType =>
  value === "Top" || value === "TopFull" || value === "Bot";

/** Reads a target back from its `formatTarget` form; null for a key this build does not know. */
export const parseTarget = (key: string): ValueTarget | null => {
  if (key === "global" || key === "countertop" || key === "basin") return { scope: key };

  const [scope, cabinetId, drawerType, ...rest] = key.split(":");
  if (!cabinetId || rest.length > 0) return null;

  if (scope === "cabinet" && drawerType === undefined) return { scope, cabinetId };
  if (scope === "drawer" && isDrawerType(drawerType)) return { scope, cabinetId, drawerType };
  if (scope === "basin" && drawerType === undefined) return { scope, sinkBaseId: cabinetId };

  return null;
};
