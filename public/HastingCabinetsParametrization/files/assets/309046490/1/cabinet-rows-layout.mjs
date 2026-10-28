import { CABINET_LAYOUT_GAP_METERS } from '../../composition/layout-constants.mjs';
import { DEFAULT_ROW_TOLERANCES, adjacentTarget, classifyDrop, deriveRows, extentFromBox, findCabinetRow,
    placeCabinet, pruneRows, reflowRow, removeFromRow, swapCabinets } from '../cabinet-rows.mjs';
import { measureEntityBoundsM } from '../../spatial-manipulation/playcanvas/scene-measure.mjs';
import { resolveBasinTopProduct } from '../../countertop/countertop-role.mjs';
import { DEFAULT_COUNTERTOP_SUPPORT_GROUP_ID } from '../../countertop/countertop-support-resolver.mjs';
import { isBasinTopOffset, pickBasinTopHome } from '../basin-top-home.mjs';
import { cabinetLevelM, normalizeRowLevels, withLevel } from '../cabinet-footprint.mjs';
import { SINK_BASE_LEVEL_TOLERANCE_M, isThinCountertop } from '../../countertop/tandem/tandem-countertops.mjs';

/**
 * Cabinet rows for modular collections (rules HR-RW-01–HR-RW-05, docs/rules-manifest.md) on real scene bounds.
 *
 * ONE state for both ways of adding: composition features.localCabinetRows (B's Row JSON, next to
 * the positions; survives serialize/importCompositions; portable presets carry it as localLayouts).
 * - createCabinetRowsLayoutPolicy: the FreeLayoutPolicy composition-manager's preserve branch calls
 *   for the standard API (addProductByLeft/Right, addProduct, setProductByParams, presetProducts ->
 *   placeNew; setConfig width, removeProduct, swapProducts -> reflow).
 * - planCabinetDrop / reconcileRows / rowsToLayouts / assignSupportGroups: the pure helpers the
 *   local runtime's drag-and-drop Apply and preset import use on the CompositionDocument.
 * Only affected rows are re-laid (left edge fixed, followers shift, widths never change); other rows
 * never move (HR-RW-04). HR-RW-05: the basin top's SupportGroupId stays with the row of the sink cabinet, every
 * other row gets its own group, so the attached top follows one row. HR-RW-11: a row standing on cabinets (or
 * hanging over them) follows their top when their height changes (liftRowsOverResizedCabinets).
 */
export const CABINET_ROWS_FEATURE = 'localCabinetRows';
export const CABINET_ROWS_POLICY_ID = 'cabinet-rows-v1';
/** Not 'standard-run': anchorPositionM here is the row's LEFT EDGE / bottom / depth centre. */
export const CABINET_ROW_LAYOUT_KIND = 'cabinet-row';

const EPS = 1e-6;
/** A never-observed row counts as laid out while every member sits this close to its slot. */
const SLOT_TOLERANCE_M = 0.001;
const read = (snapshot, key) => typeof snapshot?.get === 'function' ? snapshot.get(key) : snapshot?.[key];
const get = (source, id) => source instanceof Map ? source.get(id) : source?.[id];
const keysOf = source => source instanceof Map ? [...source.keys()] : Object.keys(source ?? {});
const isVec = v => !!v && ['x', 'y', 'z'].every(axis => Number.isFinite(v[axis]));
const isBox = b => !!b && isVec(b.minM) && isVec(b.maxM) && b.maxM.x > b.minM.x;
const groupOf = snapshot => read(snapshot, 'SupportGroupId') || DEFAULT_COUNTERTOP_SUPPORT_GROUP_ID;
const overlapX = (a, b) => Math.min(a.maxM.x, b.maxM.x) - Math.max(a.minM.x, b.minM.x);
const overlapZ = (a, b) => Math.min(a.maxM.z, b.maxM.z) - Math.max(a.minM.z, b.minM.z);
/** One box is over the other in plan: X ranges overlap by more than contactM (a neighbour that only touches is not), Z ranges overlap. */
const footprintsOverlap = (a, b, contactM) => overlapX(a, b) > contactM && overlapZ(a, b) > EPS;
const newRowTarget = box => ({ kind: 'new-row', row: { leftM: box.minM.x, bottomM: box.minM.y, zM: (box.minM.z + box.maxM.z) / 2 } });
const toleranceOf = tolerances => ({ ...DEFAULT_ROW_TOLERANCES, ...(tolerances ?? {}) });
const poseAt = (pose, x, y, z) => {
    if (typeof pose?.clone !== 'function') return { x, y, z };
    const next = pose.clone(); next.x = x; next.y = y; next.z = z;
    return next;
};

/** Stable reading order: lower level first (bottom beyond levelM), then left edge. */
export function sortRows(rows, levelM = DEFAULT_ROW_TOLERANCES.levelM) {
    return [...rows].sort((a, b) => Math.abs(a.bottomM - b.bottomM) > levelM ? a.bottomM - b.bottomM
        : a.leftM - b.leftM || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** orderProductIds order: row by row, left -> right inside a row. */
export const rowOrder = rows => sortRows(pruneRows(rows)).flatMap(row => row.orderedCabinetIds);

export const rowsToLayouts = (rows, frameId) => sortRows(pruneRows(rows)).map(row => ({ id: row.id,
    kind: CABINET_ROW_LAYOUT_KIND, frameId, anchorPositionM: { x: row.leftM, y: row.bottomM, z: row.zM },
    orderedCabinetIds: [...row.orderedCabinetIds], policyId: CABINET_ROWS_POLICY_ID }));

export const layoutsToRows = layouts => pruneRows((Array.isArray(layouts) ? layouts : [])
    .filter(layout => layout?.policyId === CABINET_ROWS_POLICY_ID && isVec(layout.anchorPositionM))
    .map(layout => ({ id: layout.id, leftM: layout.anchorPositionM.x, bottomM: layout.anchorPositionM.y,
        zM: layout.anchorPositionM.z, orderedCabinetIds: layout.orderedCabinetIds })));

/** Rows for the given cabinets WITHOUT moving any of them. Stored rows are pruned to the existing
 * cabinets (a row that lost members is reported in `shrunk`: its followers close the gap when it is
 * laid out). No usable rows = one-time migration (deriveRows). A cabinet missing from every row joins
 * the row it touches at an end, otherwise it gets its own row (an overlap stays a collision). */
export function reconcileRows(stored, boxes, { tolerances, gapM = CABINET_LAYOUT_GAP_METERS } = {}) {
    const tol = toleranceOf(tolerances), ids = keysOf(boxes), before = Array.isArray(stored) ? stored : [];
    let rows = pruneRows(before, ids);
    const shrunk = new Set(rows.filter(row => before.find(old => old?.id === row.id)?.orderedCabinetIds?.length !==
        row.orderedCabinetIds.length).map(row => row.id));
    // Several rows: nothing moves -- every shrunk row splits at each missing cabinet, pieces keep their places.
    if (rows.length > 1 && shrunk.size) {
        const taken = new Set(rows.map(row => row.id));
        rows = rows.flatMap(row => shrunk.has(row.id) ? splitAtGaps(before.find(old => old?.id === row.id), row, boxes, taken) : [row]);
        shrunk.clear();
    }
    const placed = new Set(rows.flatMap(row => row.orderedCabinetIds));
    const orphans = ids.filter(id => !placed.has(id)).sort((a, b) => get(boxes, a).minM.x - get(boxes, b).minM.x);
    if (!orphans.length) return { rows, shrunk };
    if (!rows.length) return { rows: deriveRows(boxes, tol), shrunk };
    for (const id of orphans) {
        const box = get(boxes, id);
        let target = classifyDrop({ rows, boxes, drop: { id, minM: box.minM, maxM: box.maxM }, tolerances: tol });
        if (target.kind === 'join' && rows.find(row => row.id === target.rowId).orderedCabinetIds
            .some(member => overlapX(get(boxes, member), box) > tol.contactM)) target = newRowTarget(box);
        rows = placeCabinet(rows, id, target, { widthM: box.maxM.x - box.minM.x, gapM });
    }
    return { rows, shrunk };
}

/** Pieces of `row` between missing cabinets of its stored version `old`; each keeps its measured left edge. */
function splitAtGaps(old, row, boxes, taken = new Set()) {
    const alive = new Set(row.orderedCabinetIds), pieces = [[]];
    for (const id of old.orderedCabinetIds) alive.has(id) ? pieces.at(-1).push(id) : pieces.at(-1).length && pieces.push([]);
    let k = 0;
    // Piece ids stay unique across repeated splits (row~1 may already exist from an earlier split).
    const nextId = () => { do k++; while (taken.has(`${row.id}~${k}`)); taken.add(`${row.id}~${k}`); return `${row.id}~${k}`; };
    return pieces.filter(ids => ids.length).map((ids, i) => ({ ...row, id: i ? nextId() : row.id,
        leftM: get(boxes, ids[0]).minM.x, orderedCabinetIds: ids }));
}

/** Left-most member of a 2+ row changed width: the row grows to the LEFT (others stay). */
export const growLeftHeads = (rows, before, extents) => rows.map(row => {
    const head = row.orderedCabinetIds[0], was = get(before, head), now = get(extents, head);
    return row.orderedCabinetIds.length < 2 || !was || !now ? row : { ...row, leftM: row.leftM - (now.widthM - was.widthM) };
});

/**
 * HR-RW-11: a row standing on cabinets, or hanging over them, keeps its distance to the highest top under it.
 * The UI sets one Height on every cabinet (also on each Handle change: Upper Groove 38, Push to open 35), so the
 * rows above follow the new top: a stacked row never goes into the row below, and a gap above it stays the same.
 * Rows are taken from the lowest up, so a row that moved carries the rows above it.
 * Heights are measured (top - level), like the widths: setConfig re-lays the rows before the new Height reaches the
 * composition, but after the product rules stretched the mesh.
 * - rows: the stored rows; boxes: id -> { minM, maxM } now (minM.y = the cabinet's level, maxM.y = its top, X/Z = its footprint)
 * - heightsBeforeM: id -> height (m, top - level) when the cabinet was last laid out; a cabinet missing there has not changed
 * -> Map<rowId, liftM> of the rows that move (positive = up); a row that stays is not in it.
 * @example lower row 'r' [a] at 0, a 0.35 -> 0.38; upper row 'q' [u] at 0.35 over a -> Map { 'q' => 0.03 }
 * @example the same, but 'q' hangs at 0.45 (a 0.10 gap) -> Map { 'q' => 0.03 }: u goes to 0.48, the gap stays 0.10
 */
export function liftRowsOverResizedCabinets(rows, boxes, heightsBeforeM, tolerances) {
    const tol = toleranceOf(tolerances);
    const liftOfCabinetM = new Map();
    const liftOfRowM = new Map();
    const isMeasured = id => isBox(get(boxes, id));
    const heightNowOf = id => get(boxes, id).maxM.y - get(boxes, id).minM.y;
    const heightBeforeOf = id => get(heightsBeforeM, id) ?? heightNowOf(id);
    const topBeforeOf = id => get(boxes, id).minM.y + heightBeforeOf(id);
    // A cabinet in a row that already moved carries that move on its top.
    const topNowOf = id => get(boxes, id).maxM.y + (liftOfCabinetM.get(id) ?? 0);

    for (const row of sortRows(pruneRows(rows), tol.levelM)) {
        // 1. The cabinets under this row: not in it, their top at or below its bottom, under one of its cabinets.
        const isOutsideRow = id => !row.orderedCabinetIds.includes(id);
        const isBelowRow = id => topBeforeOf(id) <= row.bottomM + tol.levelM;
        const isUnderRowCabinet = id => row.orderedCabinetIds.some(member =>
            isMeasured(member) && footprintsOverlap(get(boxes, member), get(boxes, id), tol.contactM));
        const cabinetsUnder = keysOf(boxes).filter(id => isMeasured(id) && isOutsideRow(id) && isBelowRow(id) && isUnderRowCabinet(id));
        // 2. Nothing under the row (the lowest row, or one hanging on the wall by itself): it stays.
        if (!cabinetsUnder.length) continue;

        // 3. The row moves as far as the highest top under it moved.
        const highestTopBeforeM = Math.max(...cabinetsUnder.map(topBeforeOf));
        const highestTopNowM = Math.max(...cabinetsUnder.map(topNowOf));
        const liftM = highestTopNowM - highestTopBeforeM;
        // 4. That top did not move (EPS: float noise): the row stays.
        if (Math.abs(liftM) <= EPS) continue;
        liftOfRowM.set(row.id, liftM);
        for (const id of row.orderedCabinetIds) liftOfCabinetM.set(id, liftM);
    }
    return liftOfRowM;
}

/** Pivot X of every member of the given rows (left edge fixed, HR-RW-03). Other rows are not touched (HR-RW-04). */
export function layoutRows(rows, rowIds, extents, gapM = CABINET_LAYOUT_GAP_METERS) {
    const slots = new Map();
    for (const row of rows) if (rowIds.has(row.id)) for (const slot of reflowRow(row, extents, { gapM })) slots.set(slot.id, slot.pivotXM);
    return slots;
}

/** Drag-and-drop Apply (HR-RW-01). `id` is the dropped cabinet (new or moved), `box` its preview box at the
 * drop; `boxes` hold the other cabinets (and, for a move, the moved cabinet's ORIGINAL box). A move
 * first leaves its row unless it stays in the same row (a reorder keeping the left edge): with one row
 * left its followers close the gap (HR-RW-03 removal), with several rows nobody moves and the row splits. Then the drop joins/inserts into a row or starts one.
 * keepSourceRow: nobody moves even with one row left (a moved sink base, D&D Shifting SB: its neighbours stay).
 * -> { rows, target, slots: Map<id, pivotXM> (affected rows only), bottomM (join level | null) } */
export function planCabinetDrop({ rows, boxes, extents, id, box, gapM = CABINET_LAYOUT_GAP_METERS, tolerances, keepSourceRow = false } = {}) {
    if (!isBox(box)) throw new TypeError('Invalid drop box');
    const others = Object.fromEntries(keysOf(boxes).filter(key => key !== id).map(key => [key, get(boxes, key)]));
    const target = classifyDrop({ rows, boxes: others, drop: { id, minM: box.minM, maxM: box.maxM }, tolerances: toleranceOf(tolerances) });
    const widthM = get(extents, id)?.widthM, source = findCabinetRow(rows, id), dirty = new Set();
    let next;
    if (source && target.kind === 'join' && target.rowId === source.row.id) {
        next = placeCabinet(rows, id, target, { widthM, gapM });
        // Reordered to the LEFT END: like any left-end insert the others stay, the row grows to the left.
        if (target.index === 0 && source.index > 0) next = next.map(row => row.id !== source.row.id ? row
            : { ...row, leftM: source.row.leftM - widthM - gapM });
    } else {
        next = pruneRows(rows).flatMap(row => row.id !== source?.row.id ? [row] : [removeFromRow(row, id)].filter(Boolean));
        const left = source && next.find(row => row.id === source.row.id);
        // Rule 2026-09-30 (same as delete): several rows left -> nobody moves, the source row splits at
        // the hole (pieces id, id~1); a single row left -> its followers close the gap.
        if (left && (next.length > 1 || keepSourceRow)) { const taken = new Set(next.map(r => r.id)); next = next.flatMap(row => row === left ? splitAtGaps(source.row, row, boxes, taken) : [row]); }
        else if (left) dirty.add(source.row.id);
        next = placeCabinet(next, id, target, { widthM, gapM });
    }
    const row = findCabinetRow(next, id).row;
    dirty.add(row.id);
    return { rows: next, target, slots: layoutRows(next, dirty, extents, gapM),
        bottomM: target.kind === 'join' ? row.bottomM : null };
}

/** snapshot -> true for a cabinet that carries the basin (registered sink mount + a sink chosen). */
export const sinkCabinetDetector = getProductConfig => snapshot => {
    const sink = read(snapshot, 'sinkType');
    return typeof sink === 'string' && sink !== '' && sink !== 'None' && typeof getProductConfig === 'function' &&
        !!getProductConfig(read(snapshot, 'productType'))?.sinkMount;
};

/** HR-RW-05: the basin top covers ONE row (a thick top also the rows of sink bases at its level, see below). Its row (the sink cabinet's row; else the row already holding the
 * top's group; else the first row) keeps the top's SupportGroupId, every other row gets its row id, so
 * the countertop never has to be rewritten. products: id -> snapshot (cabinets and the basin top).
 * pendingIds: cabinets without a snapshot yet. -> Map<cabinetId, SupportGroupId>. */
export function assignSupportGroups(rows, products, { isSinkCabinet = () => false, pendingIds = [],
    topRangeX = null, cabinetRangeX = () => null } = {}) {
    const top = resolveBasinTopProduct(products);
    const topGroup = top.status === 'found' ? groupOf(top.snapshot) : DEFAULT_COUNTERTOP_SUPPORT_GROUP_ID;
    const pending = new Set(pendingIds), sorted = sortRows(pruneRows(rows));
    const known = id => !pending.has(id) && get(products, id) != null;
    const holds = row => row.orderedCabinetIds.some(id => known(id) && groupOf(get(products, id)) === topGroup);
    const sink = row => row.orderedCabinetIds.some(id => known(id) && isSinkCabinet(get(products, id)));
    // No sink left (the sink cabinet was deleted, its row split): a standard top stays with the piece
    // under it the most; an offset (remote) top is not recalculated -> the old holder keeps it.
    const home = sorted.find(row => sink(row) && holds(row)) ?? sorted.find(sink) ??
        pickBasinTopHome(sorted.filter(holds), { topRangeX, cabinetRangeX,
            isTopOffset: top.status === 'found' && isBasinTopOffset(top.snapshot) }) ??
        sorted.find(holds) ?? sorted[0];
    // Tandem vanities (Andriy 23.10): a THICK standard top is extended over every other row whose sink base stands at
    // the level of the home row's sink base (tops compared); a thin top is cloned instead (tandem-countertops.mjs), so
    // such a row keeps its own group. A row at another level keeps its own group (the drag refuses that placement).
    const homeSinkTop = sinkTopM(home, products, known, isSinkCabinet);
    const extendsTop = row => row !== home && top.status === 'found' && !isThinCountertop(top.snapshot) &&
        !isBasinTopOffset(top.snapshot) && homeSinkTop !== null && sink(row) &&
        Math.abs((sinkTopM(row, products, known, isSinkCabinet) ?? Infinity) - homeSinkTop) <= SINK_BASE_LEVEL_TOLERANCE_M;
    const groups = new Map();
    for (const row of sorted) {
        const group = row === home || extendsTop(row) ? topGroup : row.id === topGroup ? `${row.id}~row` : row.id;
        for (const id of row.orderedCabinetIds) groups.set(id, group);
    }
    return groups;
}

/** Top (m) of the first sink base of `row`: its level (row.bottomM) + Height (cm); null when unknown. */
function sinkTopM(row, products, known, isSinkCabinet) {
    if (!row || !Number.isFinite(row.bottomM)) return null;
    const id = row.orderedCabinetIds.find(member => known(member) && isSinkCabinet(get(products, member)));
    const heightCm = Number(read(get(products, id), 'Height'));
    return id && Number.isFinite(heightCm) && heightCm > 0 ? row.bottomM + heightCm / 100 : null;
}

/**
 * FreeLayoutPolicy (see cabinet-local-runtime.mjs) installed while a modular collection owns the
 * composition. Works only on a composition whose cabinets all match the collection and which stores
 * rows (CompositionStore.getCabinetRows/setCabinetRows); otherwise it returns null and
 * composition-manager keeps its existing preserve-mode behaviour.
 *   placeNew(entity, entities, composition, prevEntityId, side) -> [{ entity, position, index, isChanged, config? }] | null
 *   reflow(composition, reason, detail?) -> { movedIds, rows } | null   (detail: { reason:'swap', productIds:[a,b] })
 *   observe(composition?) -> Promise   (no movement: migrate/prune rows, seed widths, fix groups + notify rules)
 */
export function createCabinetRowsLayoutPolicy({ app, compositionId = null, matches = null, getProductConfig = null,
    measure = measureEntityBoundsM, levelFromPivot = measure === measureEntityBoundsM, gapM = CABINET_LAYOUT_GAP_METERS,
    tolerances } = {}) {
    // Plan A: X/Z extents come from the mesh (`measure`); a cabinet's LEVEL (box.minM.y fed to row logic) is its
    // pivot Y (a sink bowl hangs ~6 cm below it). Off by default when a custom `measure` is injected (tests).
    const tol = toleranceOf(tolerances), isSinkCabinet = sinkCabinetDetector(getProductConfig);
    // Extent of each cabinet when it was last laid out/observed: a width change is detected against it.
    const seen = new Map();
    // Height (m, measured top - level) of each cabinet when it was last laid out/observed: a height change is detected
    // against it (the rows above follow the new top, HR-RW-11).
    const seenHeightsM = new Map();
    let destroyed = false;
    const cabinetsOf = composition => Object.entries(composition.getAllProducts?.() ?? {})
        .filter(([, snapshot]) => read(snapshot, 'category') === 'cabinets');
    const owns = composition => !destroyed && !!composition && typeof composition.getCabinetRows === 'function' &&
        typeof composition.setCabinetRows === 'function' && (!compositionId || composition.compositionId === compositionId) &&
        (typeof matches !== 'function' || cabinetsOf(composition).every(([, snapshot]) => matches(read(snapshot, 'productType'))));
    // boxOf(entity, isCabinet): mesh box; a cabinet's minM.y is replaced by its pivot level (withLevel).
    const boxOf = (entity, isCabinet = false) => {
        const mesh = entity ? measure(entity) : null;
        const box = levelFromPivot && isCabinet && isBox(mesh) ? withLevel(mesh, cabinetLevelM(entity)) : mesh;
        return isBox(box) ? { minM: { ...box.minM }, maxM: { ...box.maxM } } : null;
    };
    // Stored rows normalized to the measured levels (old rows may keep the mesh bottom); nobody moves.
    const storedRows = (composition, boxes) =>
        normalizeRowLevels(composition.getCabinetRows(), id => boxes?.[id]?.minM?.y ?? null).rows;
    const measureAll = entities => {
        const boxes = {}, extents = {}, byId = {};
        for (const entity of entities) {
            const box = boxOf(entity, true), pivotX = entity?.getPosition?.()?.x;
            if (!box || !Number.isFinite(pivotX)) return null;
            boxes[entity.name] = box; extents[entity.name] = extentFromBox(box, pivotX); byId[entity.name] = entity;
        }
        return { boxes, extents, byId };
    };
    const entitiesOf = composition => cabinetsOf(composition).map(([id]) => app?.root?.findByName?.(id)).filter(Boolean);
    const changed = (a, b) => Math.abs(a.widthM - b.widthM) > EPS || Math.abs(a.pivotFromLeftM - b.pivotFromLeftM) > EPS;
    const slotsMatch = (row, { boxes, extents }) => reflowRow(row, extents, { gapM })
        .every(slot => Math.abs(boxes[slot.id].minM.x - slot.leftM) <= SLOT_TOLERANCE_M);
    /** Rows whose member changed width/pivot since it was last seen (or, never seen, is off its slot). */
    const resized = (rows, measured) => new Set(rows.filter(row =>
        row.orderedCabinetIds.some(id => seen.has(id) && changed(seen.get(id), measured.extents[id])) ||
        (row.orderedCabinetIds.some(id => !seen.has(id)) && !slotsMatch(row, measured))).map(row => row.id));
    /** Persist rows/order/groups only where they differ (no feedback loop through lastModified). */
    function commit(composition, rows, extents, pendingIds = [], boxes = null) {
        const next = sortRows(pruneRows(rows), tol.levelM), stored = composition.getCabinetRows();
        if (Array.isArray(stored) ? JSON.stringify(sortRows(pruneRows(stored), tol.levelM)) !== JSON.stringify(next) : next.length) {
            composition.setCabinetRows(next);
        }
        const order = composition.getOrderProductIds?.() ?? {};
        next.flatMap(row => row.orderedCabinetIds).forEach((id, index) => { if (order[id] !== index) composition.setOrderProductId(id, index); });
        for (const [id, extent] of Object.entries(extents)) seen.set(id, extent);
        for (const [id, box] of Object.entries(boxes ?? {})) seenHeightsM.set(id, box.maxM.y - box.minM.y);
        const products = composition.getAllProducts(), top = resolveBasinTopProduct(products);
        const rangeOf = box => box ? { minX: box.minM.x, maxX: box.maxM.x } : null;
        const topRangeX = top.status === 'found' ? rangeOf(boxOf(app?.root?.findByName?.(top.productId))) : null;
        const cabinetRangeX = id => rangeOf(boxes?.[id] ?? boxOf(app?.root?.findByName?.(id), true));
        const groups = assignSupportGroups(next, products, { isSinkCabinet, pendingIds, topRangeX, cabinetRangeX });
        const changedGroupIds = [];
        for (const [id, group] of groups) {
            const snapshot = products[id];
            if (!snapshot || pendingIds.includes(id) || groupOf(snapshot) === group) continue;
            composition.addProduct(id, typeof snapshot.createNext === 'function'
                ? snapshot.createNext({ SupportGroupId: group }) : { ...snapshot, SupportGroupId: group });
            changedGroupIds.push(id);
        }
        return { rows: next, groups, changedGroupIds };
    }
    const extremeOf = (entities, boxes, side) => entities.reduce((best, item) => !best ? item
        : side === 'left' ? (boxes[item.name].minM.x < boxes[best.name].minM.x ? item : best)
            : (boxes[item.name].maxM.x > boxes[best.name].maxM.x ? item : best), null);

    return {
        placeNew(entity, entities, composition, prevEntityId, side) {
            if (!entity?.name || !owns(composition)) return null;
            const existing = (entities ?? []).filter(item => item && item !== entity && item.name !== entity.name);
            const measured = measureAll(existing), box = boxOf(entity, true), pose = entity.getPosition?.();
            if (!measured || !box || !isVec(pose)) return null;
            const extent = extentFromBox(box, pose.x), side_ = side === 'left' ? 'left' : 'right';
            const { rows, shrunk } = reconcileRows(storedRows(composition, measured.boxes), measured.boxes, { tolerances: tol, gapM });
            const inRows = existing.filter(item => findCabinetRow(rows, item.name));
            // Anchor: the requested cabinet, else the physical extreme (right end of the right-most cabinet's row).
            const anchor = inRows.find(item => item.name === prevEntityId) ?? extremeOf(inRows, measured.boxes, side_);
            let target, y = 0, z = 0;
            if (anchor) {
                target = adjacentTarget(rows, anchor.name, side_);
                const at = anchor.getPosition(); y = at.y; z = at.z;
            } else {
                // First cabinet: the legacy seed pose (pivot at the origin) starts the first row
                // (bottomM relative to the pivot: 0 with the pivot level).
                target = { kind: 'new-row', row: { leftM: -extent.pivotFromLeftM, bottomM: box.minM.y - pose.y,
                    zM: (box.minM.z + box.maxM.z) / 2 - pose.z } };
            }
            const next = placeCabinet(rows, entity.name, target, { widthM: extent.widthM, gapM });
            const extents = { ...measured.extents, [entity.name]: extent };
            const slots = layoutRows(next, new Set([...shrunk, findCabinetRow(next, entity.name).row.id]), extents, gapM);
            const { rows: stored, groups } = commit(composition, next, extents, [entity.name], measured.boxes);
            const order = stored.flatMap(row => row.orderedCabinetIds);
            const results = [{ entity, position: poseAt(pose, slots.get(entity.name), y, z), index: order.indexOf(entity.name),
                isChanged: true, config: { SupportGroupId: groups.get(entity.name) } }];
            for (const item of existing) {
                const x = slots.get(item.name), p = item.getPosition();
                if (x !== undefined && Math.abs(x - p.x) > EPS) {
                    results.push({ entity: item, position: poseAt(p, x, p.y, p.z), index: order.indexOf(item.name), isChanged: true });
                }
            }
            return results;
        },
        reflow(composition, reason = 'recalculate', detail = null) {
            if (!owns(composition)) return null;
            const measured = measureAll(entitiesOf(composition));
            if (!measured) return null;
            let { rows, shrunk } = reconcileRows(storedRows(composition, measured.boxes), measured.boxes, { tolerances: tol, gapM });
            rows = growLeftHeads(rows, seen, measured.extents);
            const dirty = new Set([...shrunk, ...resized(rows, measured)]), pair = detail?.productIds, movedIds = [];
            if (reason === 'swap' && Array.isArray(pair) && pair.length === 2 && pair.every(id => findCabinetRow(rows, id))) {
                const [a, b] = pair, rowA = findCabinetRow(rows, a).row.id, rowB = findCabinetRow(rows, b).row.id;
                rows = swapCabinets(rows, a, b);
                dirty.add(rowA); dirty.add(rowB);
                if (rowA !== rowB) {
                    // Across rows the pair also trades levels (root Y/Z); X comes from the row layout below.
                    const pa = measured.byId[a].getPosition(), pb = measured.byId[b].getPosition(), [ay, az] = [pa.y, pa.z];
                    measured.byId[a].setPosition(pa.x, pb.y, pb.z); measured.byId[b].setPosition(pb.x, ay, az);
                    movedIds.push(a, b);
                }
            }
            for (const [id, x] of layoutRows(rows, dirty, measured.extents, gapM)) {
                const entity = measured.byId[id], p = entity.getPosition();
                if (Math.abs(x - p.x) <= EPS) continue;
                entity.setPosition(x, p.y, p.z); if (!movedIds.includes(id)) movedIds.push(id);
            }
            // Rows standing on a cabinet whose height changed follow its top (HR-RW-11). Only Y: X is laid out above.
            // A swap changes no height, so the boxes measured before it give no lift.
            const liftsM = liftRowsOverResizedCabinets(rows, measured.boxes, seenHeightsM, tol);
            rows = rows.map(row => liftsM.has(row.id) ? { ...row, bottomM: row.bottomM + liftsM.get(row.id) } : row);
            for (const row of rows) {
                const liftM = liftsM.get(row.id);
                // Nothing under this row changed height: it stays.
                if (liftM === undefined) continue;
                for (const id of row.orderedCabinetIds) {
                    const entity = measured.byId[id], p = entity.getPosition();
                    entity.setPosition(p.x, p.y + liftM, p.z);
                    if (!movedIds.includes(id)) movedIds.push(id);
                }
            }
            const { rows: stored, groups, changedGroupIds } = commit(composition, rows, measured.extents, [], measured.boxes);
            return { reason, movedIds, rows: stored, groups, changedGroupIds };
        },
        async observe(composition = app?.compositionManager?.getActiveComposition?.(), { authoritative = false } = {}) {
            if (!owns(composition)) return null;
            const measured = measureAll(entitiesOf(composition));
            if (!measured) return null;
            const { rows, shrunk } = reconcileRows(storedRows(composition, measured.boxes), measured.boxes, { tolerances: tol, gapM });
            // A delete or a width change still waiting for reflow: committing now would overwrite `seen` and the
            // stored rows, and reflow would then find nothing to re-lay (head grows left / gap closes). Leave it.
            // authoritative (replace/adopt): no reflow follows, the scene positions are the truth -> commit anyway.
            if (!authoritative && (shrunk.size || rows.some(row => row.orderedCabinetIds.some(id => seen.has(id) && measured.extents[id] &&
                changed(seen.get(id), measured.extents[id]))))) return null;
            const result = commit(composition, rows, measured.extents, [], measured.boxes);
            const last = result.changedGroupIds.at(-1), manager = app?.compositionManager;
            // Groups changed outside a command (migration, a sink cabinet joined another row): rerun the top/cover rules.
            if (last) await manager?.aggregator?.onProductChanged?.(composition.compositionId, last,
                { SupportGroupId: result.groups.get(last) }, manager.getAllCompositions?.());
            return result;
        },
        destroy() { destroyed = true; seen.clear(); }
    };
}
