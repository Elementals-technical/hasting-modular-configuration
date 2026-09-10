/**
 * Normalized handle relations — the target format C needs from whatever source
 * a collection uses (CONTRACTS §2, C-HANDLE-EXAMPLE §2).
 *
 * Phase 1 fills these from the three legacy 439 columns via `normalizeHandleProfile`.
 * Phase 2 can fill them from rows keyed by handleId without touching consumers,
 * because rule code reads the relation, never a handle-specific field name.
 */

/** One "cabinet type + handle + drawers -> required height" row. */
export type HandleHeightConstraint = {
  cabinetType: string;
  handleId: string;
  drawers: string;
  forcedHeightCm: number;
};

/** Per cabinet type, the generic handle relations extracted from the source. */
export type CabinetHandleRelations = {
  cabinetType: string;
  /** handleId -> drawers value -> forced height in cm. */
  forcedHeightByHandle: Record<string, Record<string, number>>;
  /** handleId -> drawers values that allow this handle. Empty/absent means "no restriction". */
  requiresDrawersByHandle: Record<string, string[]>;
};

export type NormalizedHandleProfile = {
  relations: CabinetHandleRelations[];
  /** Flat view of the same data, for parity checks and diagnostics. */
  constraints: HandleHeightConstraint[];
};
