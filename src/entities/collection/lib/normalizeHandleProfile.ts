import type {
  CabinetHandleRelations,
  HandleHeightConstraint,
  NormalizedHandleProfile,
} from "../model/handleProfile";
import type { CabinetMatrixLegacyAdapter } from "../model/productProfile";

/**
 * Turns the legacy cabinet-matrix rows into generic handle relations.
 *
 * The handle -> column mapping comes from the profile adapter, so this function never
 * tests a handle id. Adding a fourth handle to the source is a data change:
 * one more entry in `columns.forcedHeightByHandle`, no code branch.
 *
 * Ownership: C defines the target shape and this transformation; A calls it while loading
 * the rows for the active collection (CONTRACTS §2, C-HANDLE-EXAMPLE §3).
 */

/** Row of the cabinet matrix with keys already normalized to snake_case lower. */
export type NormalizedMatrixRow = Record<string, string>;

/** Parses "1:56|2:53|1+inner:56" into { "1": 56, "2": 53, "1+inner": 56 }. */
export const parseHeightMapping = (raw: string): Record<string, number> =>
  Object.fromEntries(
    raw.split("|").flatMap((entry) => {
      const colonIdx = entry.indexOf(":");
      if (colonIdx === -1) return [];

      const key = entry.slice(0, colonIdx).trim();
      const num = Number(entry.slice(colonIdx + 1).trim());

      return key && Number.isFinite(num) ? [[key, num] as const] : [];
    }),
  );

const parseDelimitedList = (value: unknown): string[] => {
  if (value === null || value === undefined) return [];

  const raw = String(value).trim();
  if (!raw) return [];

  return raw
    .split("|")
    .map((entry) => entry.trim())
    .filter(Boolean);
};

export type NormalizeHandleProfileArgs = {
  rows: NormalizedMatrixRow[];
  adapter: CabinetMatrixLegacyAdapter;
  /**
   * Maps a legacy drawers spelling ("1D") to its canonical option value ("1").
   * Supplied by the caller from the Drawers catalog so aliases stay in one place.
   */
  normalizeDrawers?: (value: string) => string;
};

export const normalizeHandleProfile = ({
  rows,
  adapter,
  normalizeDrawers = (value) => value,
}: NormalizeHandleProfileArgs): NormalizedHandleProfile => {
  const { columns } = adapter;
  const relations: CabinetHandleRelations[] = [];
  const constraints: HandleHeightConstraint[] = [];

  for (const row of rows) {
    const cabinetType = String(row[columns.cabinetType] ?? "").trim();
    if (!cabinetType) continue;

    const forcedHeightByHandle: Record<string, Record<string, number>> = {};
    const requiresDrawersByHandle: Record<string, string[]> = {};

    for (const [handleId, columnName] of Object.entries(columns.forcedHeightByHandle)) {
      const rawMapping = row[columnName]?.trim();
      if (!rawMapping) continue;

      const byDrawers: Record<string, number> = {};

      for (const [drawersRaw, heightCm] of Object.entries(parseHeightMapping(rawMapping))) {
        const drawers = normalizeDrawers(drawersRaw);
        byDrawers[drawers] = heightCm;
        constraints.push({ cabinetType, handleId, drawers, forcedHeightCm: heightCm });
      }

      if (Object.keys(byDrawers).length > 0) {
        forcedHeightByHandle[handleId] = byDrawers;
      }
    }

    for (const [handleId, columnName] of Object.entries(columns.requiresDrawersByHandle)) {
      const allowed = parseDelimitedList(row[columnName]).map(normalizeDrawers);
      if (allowed.length > 0) {
        requiresDrawersByHandle[handleId] = allowed;
      }
    }

    relations.push({ cabinetType, forcedHeightByHandle, requiresDrawersByHandle });
  }

  return { relations, constraints };
};

/** Looks up the required height without knowing which handle ids exist. */
export const resolveForcedHeight = (
  relations: CabinetHandleRelations | null | undefined,
  handleId: string | null | undefined,
  drawers: string | null | undefined,
): number | null => {
  if (!relations || !handleId || !drawers) return null;
  return relations.forcedHeightByHandle[handleId]?.[drawers] ?? null;
};

/** Every height this handle can force on this cabinet type, regardless of drawers. */
export const resolvePossibleForcedHeights = (
  relations: CabinetHandleRelations | null | undefined,
  handleId: string | null | undefined,
): number[] => {
  if (!relations || !handleId) return [];
  return Object.values(relations.forcedHeightByHandle[handleId] ?? {}).filter((value) => Number.isFinite(value));
};

/** Empty restriction means the handle is allowed for any drawers value. */
export const isHandleAllowedForDrawers = (
  relations: CabinetHandleRelations | null | undefined,
  handleId: string | null | undefined,
  drawers: string | null | undefined,
): boolean => {
  if (!relations || !handleId) return true;

  const required = relations.requiresDrawersByHandle[handleId];
  if (!required?.length) return true;

  return Boolean(drawers) && required.includes(drawers as string);
};
