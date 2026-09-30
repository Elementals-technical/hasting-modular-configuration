/** Scene id PlayCanvas reports when a cabinet draft collides with the floor. */
export const FLOOR_COLLISION_ID = "Floor_R1";

export const DRAFT_HINTS = {
  cabinetCollision: "This cabinet overlaps another cabinet. Move it to a free spot to apply.",
  belowFloor: "This cabinet goes below the floor. Move it up to apply.",
  generic: "This position is not valid. Move the cabinet to apply.",
} as const;

type Reason = { code?: unknown; params?: { collidesWith?: unknown } };

const asRecord = (v: unknown): Record<string, unknown> | null =>
  typeof v === "object" && v !== null ? (v as Record<string, unknown>) : null;

const ids = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

const reasonHint = (reason: Reason, fallbackIds: string[]): string => {
  if (reason.code !== "CABINET_COLLISION") return DRAFT_HINTS.generic;
  const hits = ids(reason.params?.collidesWith);
  const collidesWith = hits.length ? hits : fallbackIds;
  if (collidesWith.length > 0 && collidesWith.every((id) => id === FLOOR_COLLISION_ID)) return DRAFT_HINTS.belowFloor;
  return DRAFT_HINTS.cabinetCollision;
};

/** Validation of a draft as PlayCanvas publishes it: `null` when unknown (older engine, no draft). */
export function draftValidationStatus(draft: unknown): "valid" | "invalid" | null {
  const status = asRecord(asRecord(draft)?.validation)?.status;
  return status === "valid" || status === "invalid" ? status : null;
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
    const reasons = (Array.isArray(validation.reasons) ? validation.reasons : [])
      .map(asRecord)
      .filter((r): r is Record<string, unknown> => r !== null) as Reason[];
    if (reasons.length === 0) return DRAFT_HINTS.generic;
    const hints = reasons.map((r) => reasonHint(r, collisionIds));
    return (
      hints.find((h) => h === DRAFT_HINTS.cabinetCollision) ??
      hints.find((h) => h === DRAFT_HINTS.belowFloor) ??
      DRAFT_HINTS.generic
    );
  }
  if (collision?.status === "colliding") return reasonHint({ code: "CABINET_COLLISION" }, collisionIds);
  return null;
}
