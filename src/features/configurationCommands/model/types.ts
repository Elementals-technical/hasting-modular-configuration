import type { AttributeValue, DrawerType, StableCabinetKey, ValueTarget } from "@/entities/configuration";

/**
 * The single path through which a value changes.
 *
 * B sends an intent, C decides whether it is allowed and what else has to change,
 * I executes the agreed set in the scene. Nothing else may write the same value.
 */

/**
 * Request from the UI.
 *
 * CONTRACTS §3 enumerates `global | countertop | cabinet`, but the ProductProfile and
 * the configuration model both address five scopes — `sinkType` is `basin` and
 * `DividersStyle` is `drawer`. The wider set is used here; the contract needs the same
 * widening before B writes its UI description against three.
 */
export type AttributeChange = { attributeId: string; value: AttributeValue } & (
  | { scope: "global" | "countertop" | "basin" }
  | { scope: "cabinet"; cabinetId: StableCabinetKey }
  | { scope: "drawer"; cabinetId: StableCabinetKey; drawerType: DrawerType }
);

/** One entry of the agreed set handed to I. */
export type PlannedChange = {
  attributeId: string;
  target: ValueTarget;
  value: AttributeValue;
  /** Whether the user asked for this, or a rule requires it alongside. */
  origin: "requested" | "dependency";
  /** Stable code explaining a dependency; B resolves it to text. */
  reasonCode?: string;
};

export type FailedChange = {
  change: PlannedChange;
  message: string;
};

export type ChangeErrorCode =
  | "no-active-profile"
  | "unknown-attribute"
  | "scope-mismatch"
  | "unknown-target";

export type ChangeBlockedReason = {
  attributeId: string;
  reasonCode: string;
  /** Legacy English fallback from profile.messages; B owns display and translation. */
  reason: string;
};

/**
 * Outcome of a change.
 *
 * `confirmation-required` is deliberately absent: preview/confirm/cancel is C05.
 * `partial` exists because the runtime API is not atomic — CONTRACTS §"Узгодження з I"
 * requires reporting the actual result instead of promising atomicity.
 */
export type ChangeResult =
  | { status: "applied"; plan: PlannedChange[] }
  | ({ status: "blocked" } & ChangeBlockedReason)
  | { status: "partial"; applied: PlannedChange[]; failed: FailedChange[]; needsSync: true }
  | { status: "error"; code: ChangeErrorCode; message: string };

export type RuntimeApplyResult = {
  applied: PlannedChange[];
  failed: FailedChange[];
};

/**
 * What C needs from the runtime.
 *
 * I owns the real port (`entities/configuration/model/runtimePort.ts`, task I02) and the
 * mapping of semantic ids onto scene keys. This declares only the consumer side, so the
 * command service can be written and tested before that port exists.
 *
 * `resolveRuntimeId` is passed in because C addresses products by stable key while the
 * scene knows only runtime ids; the translation stays on C's side of the boundary.
 *
 * TODO(I02): replace with the port type once I publishes it.
 */
export type ConfigurationRuntimePort = {
  apply(
    changes: PlannedChange[],
    resolveRuntimeId: (cabinetId: StableCabinetKey) => string | null,
  ): Promise<RuntimeApplyResult>;
};
