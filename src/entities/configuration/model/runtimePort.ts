import type { RuntimeBindingFailureReason, RuntimeFlow } from "@/entities/collection";

import type { AttributeValue, CabinetDimensions, StableCabinetKey, ValueTarget } from "./types";

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
 * - failed: a command failed before anything reached the scene, which is untouched;
 * - partial: the scene changed before a command failed. `applied` lists the changes
 *   that fully went through and may be empty, e.g. when a towel bar was cleared but the
 *   new side failed. The runtime API is not atomic, so this is reported, not hidden.
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

/** The actual size of one product, keyed by the id the scene knows. */
export type SceneCabinetState = {
  runtimeId: string;
  dimensions: CabinetDimensions;
};

/**
 * What the scene actually holds (I04):
 * - ready: `order` is the composition order of every product the scene has; `cabinets` has
 *   one entry per requested product the scene has, never a size borrowed from another one;
 * - not-ready: nothing could be read, so C keeps what it recorded before.
 */
export type SceneStateResult =
  | { status: "ready"; order: string[]; cabinets: SceneCabinetState[] }
  | { status: "not-ready" };

/**
 * Reads the actual result of the scene. The scene fires no events of its own for sizes or
 * order, so C reads after the actions that change them; I never writes Redux.
 */
export type ConfigurationSceneReader = {
  read(runtimeIds: readonly string[]): Promise<SceneStateResult>;
};

/** One product to rebuild, as saved: its old id, its type and its full config. */
export type SceneRestoreProduct = {
  /** The id the product had when it was saved; the result maps it to the new runtime id. */
  sourceId: string;
  productType: string;
  /** Null when the saved payload has no config for the product. */
  config: Record<string, unknown> | null;
};

/** The composition to rebuild, in composition order. */
export type SceneRestoreRequest = {
  products: readonly SceneRestoreProduct[];
};

export type SceneRestoreIssueCode =
  | "empty-composition"
  | "duplicate-source"
  | "invalid-config"
  | "unknown-product-type"
  | "bindings-unavailable";

/** A reason found before the scene is touched; any issue keeps the scene as it is. */
export type SceneRestoreIssue = {
  code: SceneRestoreIssueCode;
  sourceId?: string;
  message: string;
};

export type SceneRestoreMatch = {
  sourceId: string;
  runtimeId: string;
};

export type SceneRestoreFailure = {
  sourceId: string;
  code: "not-created" | "config-rejected" | "order-mismatch" | "scene-error";
  message: string;
};

/**
 * Outcome of rebuilding the scene (I05):
 * - not-ready / rejected: nothing was removed, the scene is untouched;
 * - restored: every product was created and configured in order;
 * - partial: the scene was cleared and only part of the composition came back. `matches`
 *   lists what exists now, so C can record it and treat the state as inconsistent.
 */
export type SceneRestoreResult =
  | { status: "not-ready" }
  | { status: "rejected"; issues: SceneRestoreIssue[] }
  | { status: "restored"; matches: SceneRestoreMatch[]; scene: SceneStateResult }
  | { status: "partial"; matches: SceneRestoreMatch[]; failed: SceneRestoreFailure[]; scene: SceneStateResult };

/**
 * Rebuilds a composition. C decides the collection and checks the payload first; the
 * restorer checks what only the runtime knows before its first destructive call.
 */
export type ConfigurationSceneRestorer = {
  preflight(request: SceneRestoreRequest): SceneRestoreIssue[];
  restore(request: SceneRestoreRequest): Promise<SceneRestoreResult>;
};

/** One side panel type on one side of the composition. "None" removes the panel. */
export type SidePanelPlacement = {
  panel: string;
  side: "left" | "right" | "both";
};

export type SidePanelApplyResult =
  | { status: "applied" }
  | { status: "not-ready" }
  | { status: "failed"; message: string }
  | { status: "partial"; message: string };

/**
 * The side panels of the composition. The scene takes a panel type together with its side, so
 * a panel is one placement rather than one value of a binding. A single cabinet is both edges.
 */
export type ConfigurationSidePanelPort = {
  apply(placements: readonly SidePanelPlacement[], cabinetCount?: number): Promise<SidePanelApplyResult>;
};
