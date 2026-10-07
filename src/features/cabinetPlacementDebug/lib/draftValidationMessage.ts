/** Scene id PlayCanvas reports when a cabinet draft collides with the floor. */
export const FLOOR_COLLISION_ID = "Floor_R1";

export const DRAFT_HINTS = {
  cabinetCollision: "This cabinet overlaps another cabinet. Move it to a free spot to apply.",
  belowFloor: "This cabinet goes below the floor. Move it up to apply.",
  generic: "This position is not valid. Move the cabinet to apply.",
  /** Prefix for a placement the engine cannot decide yet (an open product question). */
  unsupported: "Awaiting a product decision: ",
  pending: "Checking this position…",
} as const;

export type DraftValidationStatus = "valid" | "invalid" | "unsupported" | "pending";

/** A placement-rule reason as PlayCanvas publishes it (validation.reasons[]). */
type Reason = { code?: unknown; message?: unknown; params?: { collidesWith?: unknown } };

const asRecord = (v: unknown): Record<string, unknown> | null =>
  typeof v === "object" && v !== null ? (v as Record<string, unknown>) : null;

const ids = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

const reasonHint = (reason: Reason, fallbackIds: string[]): string => {
  // Placement rules (SB/SC stacking, tiers, …) carry their own text from the collection's rule pack.
  if (reason.code !== "CABINET_COLLISION") {
    return typeof reason.message === "string" && reason.message.trim() ? reason.message : DRAFT_HINTS.generic;
  }
  const hits = ids(reason.params?.collidesWith);
  const collidesWith = hits.length ? hits : fallbackIds;
  if (collidesWith.length > 0 && collidesWith.every((id) => id === FLOOR_COLLISION_ID)) return DRAFT_HINTS.belowFloor;
  return DRAFT_HINTS.cabinetCollision;
};

/** Validation of a draft as PlayCanvas publishes it: `null` when unknown (older engine, no draft).
 * `unsupported` = an open product question blocks Apply; `pending` = not evaluated yet. */
export function draftValidationStatus(draft: unknown): DraftValidationStatus | null {
  const status = asRecord(asRecord(draft)?.validation)?.status;
  return status === "valid" || status === "invalid" || status === "unsupported" || status === "pending" ? status : null;
}

/**
 * User-facing hint for a draft PlayCanvas rejects, or `null` when the spot is free. Reads
 * `validation.reasons` first; falls back to `collision` for engines without `validation`.
 * Cabinet collisions win over the floor so the user is told about the cabinet first.
 */
export function draftInvalidHint(draft: unknown): string | null {
  const d = asRecord(draft);
  if (!d) return null;
  const collision = asRecord(d.collision);
  const collisionIds = ids(collision?.collidesWith);
  const validation = asRecord(d.validation);
  if (validation) {
    if (validation.status === "valid") return null;
    if (validation.status === "pending") return DRAFT_HINTS.pending;
    const reasons = (Array.isArray(validation.reasons) ? validation.reasons : [])
      .map(asRecord)
      .filter((r): r is Record<string, unknown> => r !== null) as Reason[];
    if (reasons.length === 0) return DRAFT_HINTS.generic;
    const hints = reasons.map((r) => reasonHint(r, collisionIds));
    const hint =
      hints.find((h) => h === DRAFT_HINTS.cabinetCollision) ??
      hints.find((h) => h === DRAFT_HINTS.belowFloor) ??
      hints.find((h) => h !== DRAFT_HINTS.generic) ??
      DRAFT_HINTS.generic;
    return validation.status === "unsupported" ? DRAFT_HINTS.unsupported + hint : hint;
  }
  if (collision?.status === "colliding") return reasonHint({ code: "CABINET_COLLISION" }, collisionIds);
  return null;
}
