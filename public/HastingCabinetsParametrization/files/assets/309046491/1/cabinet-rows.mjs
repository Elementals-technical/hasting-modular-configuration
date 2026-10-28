import { CABINET_LAYOUT_GAP_METERS } from '../composition/layout-constants.mjs';

/** Pure cabinet-rows engine for modular collections (HR-RW-03/HR-RW-04). Metres; world X is the row axis.
 * Row = { id, leftM, bottomM, zM, orderedCabinetIds } — a contiguous chain of cabinets on one
 * level (bottom Y, depth Z). leftM is the world X of the row's left edge; members are laid
 * left->right from it with gapM between them, so width change / removal / middle insert only
 * SHIFT the following members (widths never change). Rows are independent: reflowing one row
 * never moves another (an overlap stays a collision for the caller to show).
 * Extents: id -> { widthM, pivotFromLeftM } (pivotFromLeftM = pivotX - boundsMinX, default widthM/2).
 * Boxes:   id -> { minM:{x,y,z}, maxM:{x,y,z} } (world AABB). Maps or plain objects are accepted.
 */
export const DEFAULT_ROW_TOLERANCES = Object.freeze({ levelM: 0.005, contactM: 0.005 });
const EPS = 1e-6;
const get = (source, id) => source instanceof Map ? source.get(id) : source?.[id];
const entries = source => source instanceof Map ? [...source] : Object.entries(source ?? {});
const validId = id => typeof id === 'string' && id.length > 0;
const isVec = v => !!v && [v.x, v.y, v.z].every(Number.isFinite);
const isBox = b => !!b && isVec(b.minM) && isVec(b.maxM) && b.maxM.x >= b.minM.x;
const overlap = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0);
const isRow = r => !!r && validId(r.id) && [r.leftM, r.bottomM, r.zM].every(Number.isFinite) &&
    Array.isArray(r.orderedCabinetIds);
const cloneRow = r => ({ id: r.id, leftM: r.leftM, bottomM: r.bottomM, zM: r.zM,
    orderedCabinetIds: [...r.orderedCabinetIds] });
const clampIndex = (index, length) => Number.isInteger(index) ? Math.min(Math.max(index, 0), length) : length;
const assertRow = row => { if (!isRow(row)) throw new TypeError('Invalid cabinet row'); };
const assertId = id => { if (!validId(id)) throw new TypeError('Invalid cabinet id'); };
const gapOf = opts => {
    const gapM = opts?.gapM ?? CABINET_LAYOUT_GAP_METERS;
    if (!Number.isFinite(gapM) || gapM < 0) throw new TypeError('Invalid row gap');
    return gapM;
};
const widthOf = opts => {
    if (!Number.isFinite(opts?.widthM) || opts.widthM <= 0) throw new TypeError('Row edge change needs widthM');
    return opts.widthM;
};
const tolerancesOf = t => {
    const tol = { ...DEFAULT_ROW_TOLERANCES, ...(t ?? {}) };
    if (![tol.levelM, tol.contactM].every(v => Number.isFinite(v) && v >= 0)) throw new TypeError('Invalid row tolerances');
    return tol;
};
const extentOf = (extents, id) => {
    const e = get(extents, id);
    const pivot = e?.pivotFromLeftM ?? e?.widthM / 2;
    if (!Number.isFinite(e?.widthM) || e.widthM <= 0 || !Number.isFinite(pivot)) {
        throw new TypeError(`Missing row extent for cabinet ${id}`);
    }
    return { widthM: e.widthM, pivotFromLeftM: pivot };
};

/** { widthM, pivotFromLeftM } from a world AABB and the entity pivot X. */
export function extentFromBox(box, pivotXM) {
    if (!isBox(box) || !Number.isFinite(pivotXM)) throw new TypeError('Invalid cabinet box');
    return { widthM: box.maxM.x - box.minM.x, pivotFromLeftM: pivotXM - box.minM.x };
}

/** Lay members left->right from row.leftM -> [{ id, leftM, rightM, pivotXM }]. */
export function reflowRow(row, extents, opts = {}) {
    assertRow(row);
    const gapM = gapOf(opts);
    let x = row.leftM;
    return row.orderedCabinetIds.map((id, i) => {
        const e = extentOf(extents, id);
        if (i) x += gapM;
        const leftM = x;
        x += e.widthM;
        return { id, leftM, rightM: x, pivotXM: leftM + e.pivotFromLeftM };
    });
}

export const reflowRows = (rows, extents, opts = {}) => rows.flatMap(row => reflowRow(row, extents, opts));

/** Index 0 on a non-empty row = LEFT END: leftM moves left by widthM+gap so members stay put.
 * Any other index keeps leftM and shifts the following members right. */
export function insertIntoRow(row, id, index, opts = {}) {
    assertRow(row); assertId(id);
    const ids = row.orderedCabinetIds;
    if (ids.includes(id)) throw new TypeError(`Cabinet ${id} is already in row ${row.id}`);
    const at = clampIndex(index, ids.length), next = cloneRow(row);
    next.orderedCabinetIds = [...ids.slice(0, at), id, ...ids.slice(at)];
    if (at === 0 && ids.length) next.leftM = row.leftM - widthOf(opts) - gapOf(opts);
    return next;
}

/** Left edge fixed, following members shift left; last member -> null (row removed).
 * detach:true (a MOVE out of the row) with the first member keeps the rest in place (needs widthM). */
export function removeFromRow(row, id, opts = {}) {
    assertRow(row);
    const ids = row.orderedCabinetIds, i = ids.indexOf(id);
    if (i < 0) return cloneRow(row);
    if (ids.length === 1) return null;
    const next = cloneRow(row);
    next.orderedCabinetIds = ids.filter(x => x !== id);
    if (opts.detach && i === 0) next.leftM = row.leftM + widthOf(opts) + gapOf(opts);
    return next;
}

export function findCabinetRow(rows, id) {
    for (const row of Array.isArray(rows) ? rows : []) {
        const index = isRow(row) ? row.orderedCabinetIds.indexOf(id) : -1;
        if (index >= 0) return { row, index };
    }
    return null;
}

/** Sanitised clone: drops invalid/duplicate rows, cabinets already seen in an earlier row and,
 * when existingIds is given, cabinets that no longer exist (left edge fixed); empty rows removed. */
export function pruneRows(rows, existingIds) {
    const keep = existingIds == null ? null : new Set(existingIds);
    const seenCabinets = new Set(), seenRows = new Set(), out = [];
    for (const row of Array.isArray(rows) ? rows : []) {
        if (!isRow(row) || seenRows.has(row.id)) continue;
        const ids = [];
        for (const id of row.orderedCabinetIds) {
            if (validId(id) && !seenCabinets.has(id) && (!keep || keep.has(id))) { ids.push(id); seenCabinets.add(id); }
        }
        if (!ids.length) continue;
        seenRows.add(row.id);
        out.push({ ...cloneRow(row), orderedCabinetIds: ids });
    }
    return out;
}

/** Exchange two cabinets' slots (within one row or across rows); the caller reflows. */
export const swapCabinets = (rows, idA, idB) => pruneRows(rows).map(row => ({ ...row,
    orderedCabinetIds: row.orderedCabinetIds.map(id => id === idA ? idB : id === idB ? idA : id) }));

const uniqueRowId = (rows, base) => {
    const taken = new Set(rows.map(r => r.id));
    let id = base;
    for (let n = 2; taken.has(id); n++) id = `${base}~${n}`;
    return id;
};

/** Standard left/right add next to anchorId -> join target (null when the anchor has no row). */
export function adjacentTarget(rows, anchorId, side = 'right') {
    const hit = findCabinetRow(rows, anchorId);
    return hit ? { kind: 'join', rowId: hit.row.id, index: side === 'left' ? hit.index : hit.index + 1 } : null;
}

/** Decide where a dropped/previewed cabinet goes. drop = { id?, minM, maxM }; drop.id (a move) is
 * ignored as a row member. Same level = |bottom - row.bottomM| <= levelM and Z overlap with the
 * row's members. Join when the drop overlaps the row's X span by > contactM (index: after the member
 * whose right edge the drop's left edge touches, else before the member whose left edge its right
 * edge touches, else by drop centre vs member centres) or touches a row end within contactM;
 * best = largest X overlap. Otherwise
 * { kind:'new-row', row:{ leftM, bottomM, zM } } (a template placeCabinet materialises). */
export function classifyDrop({ rows = [], boxes, drop, tolerances } = {}) {
    if (!isBox(drop)) throw new TypeError('Invalid drop box');
    const tol = tolerancesOf(tolerances), [a, b] = [drop.minM.x, drop.maxM.x], centre = (a + b) / 2;
    const centreOf = id => { const box = get(boxes, id); return isBox(box) ? (box.minM.x + box.maxM.x) / 2 : NaN; };
    let best = null;
    for (const row of Array.isArray(rows) ? rows : []) {
        if (!isRow(row) || Math.abs(drop.minM.y - row.bottomM) > tol.levelM) continue;
        const members = row.orderedCabinetIds.filter(id => id !== drop.id);
        const memberBoxes = members.map(id => get(boxes, id)).filter(isBox);
        if (!memberBoxes.length) continue;
        const zMin = Math.min(...memberBoxes.map(x => x.minM.z)), zMax = Math.max(...memberBoxes.map(x => x.maxM.z));
        if (overlap(drop.minM.z, drop.maxM.z, zMin, zMax) <= EPS) continue;
        const left = Math.min(...memberBoxes.map(x => x.minM.x)), right = Math.max(...memberBoxes.map(x => x.maxM.x));
        const score = overlap(a, b, left, right);
        let index;
        if (score > tol.contactM) {
            // A snapped drop (abut-right/left, placement options) touches a member edge: that edge picks the
            // slot; the centre rule lands one off for unequal widths or across the layout gap.
            const touches = (id, edge, x) => { const m = get(boxes, id); return isBox(m) && Math.abs(x - m[edge].x) <= tol.contactM; };
            const after = members.findIndex(id => touches(id, 'maxM', a)), before = members.findIndex(id => touches(id, 'minM', b));
            index = after >= 0 ? after + 1 : before >= 0 ? before : members.findIndex(id => centreOf(id) > centre);
            if (index < 0) index = members.length;
        } else if (Math.abs(a - right) <= tol.contactM) index = members.length;
        else if (Math.abs(b - left) <= tol.contactM) index = 0;
        else continue;
        if (!best || score > best.score + EPS) best = { score, rowId: row.id, index };
    }
    if (best) return { kind: 'join', rowId: best.rowId, index: best.index };
    return { kind: 'new-row', row: { leftM: a, bottomM: drop.minM.y, zM: (drop.minM.z + drop.maxM.z) / 2 } };
}

/** Apply a target (classifyDrop / adjacentTarget) for cabinet id -> new rows array (input untouched).
 * A new cabinet or a move from another row follows insertIntoRow (index 0 = left end, members stay);
 * the move leaves its source row with removeFromRow(detach). Reorder within the SAME row keeps leftM.
 * opts: { widthM (of id; needed for left-end insert / detaching a first member), gapM }. */
export function placeCabinet(rows, id, target, opts = {}) {
    assertId(id);
    const list = pruneRows(rows), source = list.find(r => r.orderedCabinetIds.includes(id)) ?? null;
    const leave = r => [removeFromRow(r, id, { ...opts, detach: true })].filter(Boolean);
    if (target?.kind === 'join') {
        const dest = list.find(r => r.id === target.rowId);
        if (!dest) throw new TypeError(`Unknown cabinet row ${target.rowId}`);
        if (dest === source) {
            const rest = dest.orderedCabinetIds.filter(x => x !== id), at = clampIndex(target.index, rest.length);
            const next = { ...dest, orderedCabinetIds: [...rest.slice(0, at), id, ...rest.slice(at)] };
            return list.map(r => r === dest ? next : r);
        }
        return list.flatMap(r => r === source ? leave(r) : r === dest ? [insertIntoRow(r, id, target.index, opts)] : [r]);
    }
    if (target?.kind === 'new-row') {
        const kept = list.flatMap(r => r === source ? leave(r) : [r]), t = target.row ?? {};
        const row = { id: uniqueRowId(kept, `row-${id}`), leftM: t.leftM, bottomM: t.bottomM, zM: t.zM, orderedCabinetIds: [id] };
        assertRow(row);
        return [...kept, row];
    }
    throw new TypeError('Invalid cabinet row target');
}

/** Migration for compositions/presets without stored rows: group by level (bottom within levelM,
 * Z overlap), chain along X while |gap| <= contactM. Ids 'row-<first cabinet id>'. */
export function deriveRows(boxes, tolerances) {
    const tol = tolerancesOf(tolerances);
    const items = entries(boxes).filter(([id, box]) => validId(id) && isBox(box))
        .sort(([ia, a], [ib, b]) => a.minM.x - b.minM.x || a.minM.y - b.minM.y || (ia < ib ? -1 : ia > ib ? 1 : 0));
    const chains = [];
    for (const [id, box] of items) {
        let best = null, bestGap = Infinity;
        for (const chain of chains) {
            const gap = Math.abs(box.minM.x - chain.last.maxM.x);
            if (Math.abs(box.minM.y - chain.bottomM) > tol.levelM || gap > tol.contactM ||
                overlap(box.minM.z, box.maxM.z, chain.last.minM.z, chain.last.maxM.z) <= EPS) continue;
            if (gap < bestGap) { best = chain; bestGap = gap; }
        }
        if (best) { best.orderedCabinetIds.push(id); best.last = box; continue; }
        chains.push({ id: `row-${id}`, leftM: box.minM.x, bottomM: box.minM.y, zM: (box.minM.z + box.maxM.z) / 2,
            orderedCabinetIds: [id], last: box });
    }
    return chains.map(cloneRow)
        .sort((r, s) => r.bottomM - s.bottomM || r.leftM - s.leftM || (r.id < s.id ? -1 : r.id > s.id ? 1 : 0));
}
