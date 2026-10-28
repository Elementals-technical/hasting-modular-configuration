/**
 * Which cabinet row keeps the basin top's SupportGroupId when no row carries the sink
 * (e.g. the sink cabinet was deleted and its row split into pieces that all still hold the group).
 *
 * Product rule:
 * - Standard basin top (SpatialOffsetM ~ {0,0}): the piece that stands under the top the MOST
 *   (largest X overlap between the piece's cabinets' X range and the top's current X range) keeps
 *   the group; the other pieces get their own group (-> a cover). Ties -> leftmost piece.
 * - Offset (remote) top: no recalculation -> null, the caller keeps the group where it is.
 *
 * Pure: no PlayCanvas. The offset lives on the snapshot as `SpatialOffsetM: { x, y }` (m)
 * (see composition/spatial/composition-spatial.mjs, countertop-layout-policy.isCountertopAttached).
 */
import { isCountertopAttached } from '../countertop/countertop-layout-policy.mjs';

const SPATIAL_OFFSET_KEY = 'SpatialOffsetM';
const finite = value => typeof value === 'number' && Number.isFinite(value);
const isRange = r => !!r && finite(r.minX) && finite(r.maxX) && r.maxX >= r.minX;
const EPS = 1e-6;

/** True when the basin top snapshot is moved off its standard position (`SpatialOffsetM` != 0). */
export function isBasinTopOffset(snapshot) {
    if (!snapshot) return false;
    const value = typeof snapshot.get === 'function' ? snapshot.get(SPATIAL_OFFSET_KEY) : snapshot[SPATIAL_OFFSET_KEY];
    const offset = value && finite(value.x) && finite(value.y) ? value : { x: 0, y: 0 };
    return !isCountertopAttached(offset);
}

/** Union X range of a row's cabinets, or null when any cabinet is unmeasured. */
function rowRangeX(row, cabinetRangeX) {
    let minX = Infinity, maxX = -Infinity;
    for (const id of row?.orderedCabinetIds ?? []) {
        const r = cabinetRangeX(id);
        if (!isRange(r)) return null;
        minX = Math.min(minX, r.minX); maxX = Math.max(maxX, r.maxX);
    }
    return minX <= maxX ? { minX, maxX } : null;
}

/**
 * candidateRows: rows that hold the top's group and have no sink.
 * topRangeX: { minX, maxX } | null — the basin top's current world X range.
 * cabinetRangeX: id -> { minX, maxX } | null.
 * -> the row to keep the top group, or null (no decision: caller falls through to its current logic).
 */
export function pickBasinTopHome(candidateRows, { topRangeX = null, cabinetRangeX = () => null, isTopOffset = false } = {}) {
    if (isTopOffset || !Array.isArray(candidateRows) || !candidateRows.length || !isRange(topRangeX) ||
        typeof cabinetRangeX !== 'function') return null;
    if (candidateRows.length === 1) return candidateRows[0];
    let best = null;
    for (const row of candidateRows) {
        const range = rowRangeX(row, cabinetRangeX);
        if (!range) return null;
        const overlap = Math.max(0, Math.min(range.maxX, topRangeX.maxX) - Math.max(range.minX, topRangeX.minX));
        if (!best || overlap > best.overlap + EPS ||
            (Math.abs(overlap - best.overlap) <= EPS && range.minX < best.minX)) best = { row, overlap, minX: range.minX };
    }
    return best.overlap > EPS ? best.row : null;
}
