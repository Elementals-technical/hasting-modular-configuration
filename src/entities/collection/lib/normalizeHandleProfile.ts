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
 * tests a handle id. The Urban table has a column per handle (`columns.forcedHeightByHandle`);
 * every other table has one column for all handles (`columns.forcedHeight`), where a height
 * may name no handle at all ("1:26|2:52"). Adding a handle is a data change either way.
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

/** "handleId<separator>drawers" -> [handleId, drawers]; an entry without the separator names no handle. */
const splitHandleEntry = (entry: string, separator: string): [string | null, string] => {
  const index = entry.indexOf(separator);
  return index === -1 ? [null, entry] : [entry.slice(0, index).trim(), entry.slice(index + 1).trim()];
};

export type NormalizeHandleProfileArgs = {
  rows: NormalizedMatrixRow[];
  adapter: Pick<CabinetMatrixLegacyAdapter, "columns">;
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
    const forcedHeightByDrawers: Record<string, number> = {};
    const requiresDrawersByHandle: Record<string, string[]> = {};

    const addForcedHeight = (handleId: string | null, drawersRaw: string, forcedHeightCm: number) => {
      const drawers = normalizeDrawers(drawersRaw);
      if (handleId) (forcedHeightByHandle[handleId] ??= {})[drawers] = forcedHeightCm;
      else forcedHeightByDrawers[drawers] = forcedHeightCm;
      constraints.push({ cabinetType, handleId, drawers, forcedHeightCm });
    };

    const addAllowedDrawers = (handleId: string, drawersRaw: string) => {
      (requiresDrawersByHandle[handleId] ??= []).push(normalizeDrawers(drawersRaw));
    };

    for (const [handleId, columnName] of Object.entries(columns.forcedHeightByHandle)) {
      for (const [drawers, heightCm] of Object.entries(parseHeightMapping(row[columnName] ?? ""))) {
        addForcedHeight(handleId, drawers, heightCm);
      }
    }

    for (const [handleId, columnName] of Object.entries(columns.requiresDrawersByHandle)) {
      for (const drawers of parseDelimitedList(row[columnName])) addAllowedDrawers(handleId, drawers);
    }

    if (columns.forcedHeight) {
      for (const [key, heightCm] of Object.entries(parseHeightMapping(row[columns.forcedHeight] ?? ""))) {
        const [handleId, drawers] = splitHandleEntry(key, "/");
        addForcedHeight(handleId, drawers, heightCm);
      }
    }

    if (columns.handleDrawerConfigs) {
      for (const entry of parseDelimitedList(row[columns.handleDrawerConfigs])) {
        const [handleId, drawers] = splitHandleEntry(entry, ":");
        if (handleId && drawers) addAllowedDrawers(handleId, drawers);
      }
    }

    relations.push({ cabinetType, forcedHeightByHandle, forcedHeightByDrawers, requiresDrawersByHandle });
  }

  return { relations, constraints };
};

/** The height these drawers require whatever the handle, when the source declares one. */
export const resolveDrawersForcedHeight = (
  relations: CabinetHandleRelations | null | undefined,
  drawers: string | null | undefined,
): number | null => {
  if (!relations || !drawers) return null;
  return relations.forcedHeightByDrawers[drawers] ?? null;
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
