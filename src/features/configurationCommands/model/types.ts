import type {
  AttributeValue,
  DrawerType,
  FailedRuntimeChange,
  StableCabinetKey,
  ValueTarget,
} from "@/entities/configuration";

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
  | { scope: "global" | "countertop" }
  | { scope: "basin"; sinkBaseId?: StableCabinetKey }
  | { scope: "cabinet"; cabinetId: StableCabinetKey }
  | { scope: "drawer"; cabinetId: StableCabinetKey; drawerType: DrawerType }
);

/**
 * Dimensions are core scene commands, rather than ProductProfile options. Width is
 * owned by one cabinet; Depth is deliberately shared by the USH composition.
 */
export type DimensionChange =
  | { attributeId: "Width"; value: number; scope: "cabinet"; cabinetId: StableCabinetKey }
  | { attributeId: "Depth"; value: number; scope: "global" };

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

/** A change of the set the scene did not apply, with I's reason. */
export type FailedChange = FailedRuntimeChange<PlannedChange>;

export type ChangeErrorCode =
  | "no-active-profile"
  | "unknown-attribute"
  | "scope-mismatch"
  | "unknown-target"
  /** The scene cannot take commands yet; nothing was sent or recorded. */
  | "runtime-not-ready"
  /** The collection has no scene translation for part of the set; nothing was sent. */
  | "runtime-unsupported"
  /** The first scene command failed; nothing was applied. */
  | "runtime-failed";

export type ChangeBlockedReason = {
  attributeId: string;
  reasonCode: string;
  /** Legacy English fallback from profile.messages; B owns display and translation. */
  reason: string;
  /**
   * "undetermined": the product has no rule for this change yet (CONTRACTS §8), as opposed to
   * a rule that forbids it. B may show the two differently.
   */
  compatibility?: "undetermined";
};

/** Why a change waits for the user's confirmation. B resolves the code to text. */
export type ConfirmationReason = {
  attributeId: string;
  reasonCode: string;
  /** Legacy English fallback from profile.messages. */
  reason: string;
};

/**
 * A change held for confirmation. Nothing has been written or sent for it. Confirming
 * checks the change again against the state at that moment; cancelling is dropping it.
 */
export type ChangePreview = {
  change: AttributeChange;
  /** The set that would be applied, dependencies included. */
  plan: PlannedChange[];
  /** Why confirmation is asked first, then why each dependency belongs to the set. */
  reasons: ConfirmationReason[];
};

/**
 * Outcome of a change.
 *
 * `confirmation-required` carries a preview; nothing is written or sent until it is
 * confirmed. `replaced` says the state moved since the preview being confirmed, so the
 * set changed and is shown again instead of being applied.
 * `partial` exists because the runtime API is not atomic — CONTRACTS §"Узгодження з I"
 * requires reporting the actual result instead of promising atomicity.
 */
export type ChangeResult =
  | { status: "applied"; plan: PlannedChange[] }
  | { status: "confirmation-required"; preview: ChangePreview; replaced: boolean }
  | ({ status: "blocked" } & ChangeBlockedReason)
  | { status: "partial"; applied: PlannedChange[]; failed: FailedChange[]; needsSync: true }
  | { status: "error"; code: ChangeErrorCode; message: string };
