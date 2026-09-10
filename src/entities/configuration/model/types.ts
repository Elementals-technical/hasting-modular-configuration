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
  | { scope: "global" | "countertop" | "basin" }
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

export type ConfigurationState = {
  /** Active collection, supplied by A. Never inferred from a source id such as 4/438/439. */
  collectionId: string | null;
  cabinets: CabinetEntry[];
  /** Monotonic counter behind stableKey generation; never reused within a session. */
  nextCabinetSeq: number;
  /**
   * Values of attributes that have been migrated off the typed core.
   * Invariant: an attributeId lives either here or in the typed product slice — never in both.
   */
  valuesByAttributeId: Record<string, ScopedValue[]>;
};

/** Serialized form shared by Save/Share, history and the price consumer. */
export type ConfigurationSnapshot = {
  collectionId: string | null;
  /** Version of this fragment, so a legacy reader can tell old payloads apart. */
  version: number;
  cabinets: CabinetEntry[];
  values: Record<string, ScopedValue[]>;
};

export const CONFIGURATION_SNAPSHOT_VERSION = 1;

export const isSameTarget = (a: ValueTarget, b: ValueTarget): boolean => {
  if (a.scope !== b.scope) return false;

  if (a.scope === "cabinet" && b.scope === "cabinet") {
    return a.cabinetId === b.cabinetId;
  }

  if (a.scope === "drawer" && b.scope === "drawer") {
    return a.cabinetId === b.cabinetId && a.drawerType === b.drawerType;
  }

  return true;
};

/** Stable string form of a target, for diagnostics and test assertions. */
export const formatTarget = (target: ValueTarget): string => {
  if (target.scope === "cabinet") return `cabinet:${target.cabinetId}`;
  if (target.scope === "drawer") return `drawer:${target.cabinetId}:${target.drawerType}`;
  return target.scope;
};
