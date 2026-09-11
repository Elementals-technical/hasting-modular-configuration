import type { RuntimeBindingFailureReason, RuntimeFlow } from "@/entities/collection";

import type { AttributeValue, StableCabinetKey, ValueTarget } from "./types";

/**
 * runtimePort — the one boundary between C and the PlayCanvas scene.
 *
 * Ownership (CONTRACTS §2): I. This file is types only; the implementation lives in
 * features/playCanvasAdapter. C hands over an agreed set of semantic changes and gets
 * back one result whose status says exactly what happened, so C never reads the iframe
 * and never guesses success from a wrapper's return value.
 */

/** One agreed change, in C's terms. C's PlannedChange fits as is. */
export type RuntimeChange = {
  attributeId: string;
  target: ValueTarget;
  value: AttributeValue;
};

/** What the adapter needs to address the scene. Supplied by C with each set. */
export type RuntimeContext = {
  collectionId: string;
  /** Some attributes reach different products in prebuilt and custom. */
  flow: RuntimeFlow;
  /** C addresses cabinets by stable key; the scene knows only runtime ids. */
  resolveRuntimeId: (cabinetId: StableCabinetKey) => string | null;
  /** Runtime ids of every placed cabinet, for bindings that target all cabinets. */
  cabinetRuntimeIds: readonly string[];
};

/** A change the collection has no scene translation for. Nothing was sent for it. */
export type UnsupportedRuntimeChange<T extends RuntimeChange = RuntimeChange> = {
  change: T;
  reason: RuntimeBindingFailureReason;
  detail?: string;
};

export type RuntimeFailureCode =
  /** The change addresses a cabinet the scene has no runtime id for. */
  | "unknown-target"
  /** The scene answered, but the addressed product was not updated. */
  | "product-not-found"
  /** The scene refused the command. */
  | "scene-rejected"
  /** The command threw inside the scene or the bridge. */
  | "scene-error"
  /** The scene stopped being ready in the middle of a set. */
  | "not-ready"
  /** An earlier command of the set failed, so this one was not sent. */
  | "not-attempted";

export type FailedRuntimeChange<T extends RuntimeChange = RuntimeChange> = {
  change: T;
  code: RuntimeFailureCode;
  message: string;
};

/**
 * Outcome of one set. Each status is distinct, so readiness, success and failure are
 * never inferred from each other:
 * - applied: every change reached the scene;
 * - not-ready / unsupported: nothing was sent;
 * - failed: the first command failed, nothing was applied;
 * - partial: some changes were applied before one failed. The runtime API is not
 *   atomic, so this is reported rather than hidden.
 */
export type RuntimeApplyResult<T extends RuntimeChange = RuntimeChange> =
  | { status: "applied"; applied: T[] }
  | { status: "not-ready" }
  | { status: "unsupported"; unsupported: UnsupportedRuntimeChange<T>[] }
  | { status: "failed"; failed: FailedRuntimeChange<T>[] }
  | { status: "partial"; applied: T[]; failed: FailedRuntimeChange<T>[] };

export type ConfigurationRuntimePort = {
  /** Whether the scene can take commands now. */
  isReady(): boolean;
  apply<T extends RuntimeChange>(changes: readonly T[], context: RuntimeContext): Promise<RuntimeApplyResult<T>>;
};
