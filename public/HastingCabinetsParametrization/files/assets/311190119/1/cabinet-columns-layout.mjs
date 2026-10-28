import { CABINET_LAYOUT_GAP_METERS } from '../../composition/layout-constants.mjs';
import { DEFAULT_ROW_TOLERANCES } from '../cabinet-rows.mjs';
import { CABINET_COLUMNS_POLICY_ID, addToColumn, cabinetsOfRow, columnRowFromBoxes, columnSlotFor, findCabinetPlace, insertPlace,
    layoutColumnRow, placeForHeight, removeCabinet } from '../columns/cabinet-columns.mjs';
import { extentFromBox } from '../cabinet-rows.mjs';
import { CABINET_ROWS_FEATURE, CABINET_ROW_LAYOUT_KIND, assignSupportGroups, sinkCabinetDetector } from './cabinet-rows-layout.mjs';
import { DEFAULT_EXCLUDED_NODE_FRAGMENTS, measureEntityBoundsM } from '../../spatial-manipulation/playcanvas/scene-measure.mjs';
import { DEFAULT_COUNTERTOP_SUPPORT_GROUP_ID } from '../../countertop/countertop-support-resolver.mjs';
import { cabinetLevelM, withLevel } from '../cabinet-footprint.mjs';
import { measureFloorColliderBox } from '../../scene/room/room-offset.mjs';

/**
 * Column rows for modular collections with `columns: true` (Urban Duplex) on real scene bounds.
 * The pure model is domain/cabinet-placement/columns/cabinet-columns.mjs; this file adds the composition
 * bookkeeping (stored rows, product order, SupportGroupId) and the FreeLayoutPolicy.
 *
 * Storage: the composition store has one rows feature (CompositionStore.getCabinetRows/setCabinetRows,
 * features.localCabinetRows). A column collection keeps its OWN row shape there, written and read
 * directly, never through pruneRows/cloneRow (they would drop topM and places):
 *   { id, leftM, bottomM, topM, zM, places, orderedCabinetIds }   orderedCabinetIds = cabinetsOfRow(row)
 * A stored row without `places` (an older scene) is read back from the cabinet boxes (columnRowFromBoxes).
 */
export const CABINET_COLUMN_ROWS_FEATURE = CABINET_ROWS_FEATURE;
/** Suffix of the SupportGroupId of a column's bottom cabinet: it is not a countertop support. */
export const UNDER_TOP_GROUP_SUFFIX = '~under';
const CENTIMETRES_PER_METRE = 100;
const POSITION_EPSILON_M = 1e-6;
/** Two cabinet tops this close are one countertop plane: the default toleranceM of the countertop support resolver
 * (countertop-support-resolver.mjs), which calls a wider spread of support tops non-coplanar. */
const COUNTERTOP_PLANE_TOLERANCE_M = 0.001;

const read = (snapshot, key) => typeof snapshot?.get === 'function' ? snapshot.get(key) : snapshot?.[key];
const isVec = v => !!v && ['x', 'y', 'z'].every(axis => Number.isFinite(v[axis]));
const isBox = b => !!b && isVec(b.minM) && isVec(b.maxM) && b.maxM.x > b.minM.x;
const groupOf = snapshot => read(snapshot, 'SupportGroupId') || DEFAULT_COUNTERTOP_SUPPORT_GROUP_ID;
/** Two cabinets this close in X touch (the row contact tolerance, cabinet-rows.mjs). */
const { contactM } = DEFAULT_ROW_TOLERANCES;
const touchesX = (a, b) => a.minM.x <= b.maxM.x + contactM && b.minM.x <= a.maxM.x + contactM;
const rowBoxes = (row, boxes) => Object.fromEntries(cabinetsOfRow(row).filter(id => boxes[id]).map(id => [id, boxes[id]]));
const poseAt = (pose, x, y, z) => {
    if (typeof pose?.clone !== 'function') return { x, y, z };
    const next = pose.clone(); next.x = x; next.y = y; next.z = z;
    return next;
};

/**
 * The row's countertop plane from the collection's tier height (pack.geometry.tierHeightM): topM = bottomM + tierHeightM.
 * The highest member (columnRowFromBoxes) is only the fallback without a tier height: a lone bottom 28 would
 * otherwise put the plane at 0.28. Example: { bottomM: 0, topM: 0.28 }, 0.56 -> { bottomM: 0, topM: 0.56 }.
 */
export function withTierPlane(row, tierHeightM) {
    // No tier height in the pack: keep the plane read from the boxes.
    if (!(tierHeightM > 0)) return row;
    return { ...row, topM: row.bottomM + tierHeightM };
}

/** The stored form of a column row (see the file comment). */
export const toStoredColumnRow = row => ({ id: row.id, leftM: row.leftM, bottomM: row.bottomM, topM: row.topM, zM: row.zM,
    places: structuredClone(row.places), orderedCabinetIds: cabinetsOfRow(row) });

/** Rows sorted left -> right (one tier: the level does not order them). */
export const sortColumnRows = rows => [...rows].sort((a, b) => a.leftM - b.leftM || (a.id < b.id ? -1 : 1));

/** orderProductIds order: rows left -> right, inside a row the top of a column before its bottom. */
export const columnRowOrder = rows => sortColumnRows(rows).flatMap(cabinetsOfRow);

/**
 * Column rows from boxes alone: cabinets whose X spans touch (gap <= 5 mm) form one row, whatever their level.
 * Example: a 56 at x 0..0.6 and two 28 at x 0.6005..1.0 -> one row, places [{ full }, { top, bottom }].
 * A group that is not a valid column row (a place of three cabinets, or of two not one over the other) falls apart
 * into one row per cabinet.
 * floorM (m): the floor every derived row stands on; with it a lone hanging 28 (level 0.28) is a `top`, not a
 *   `bottom` on a floor at 0.28. Example: a 28 at y 0.28..0.56, { floorM: 0, tierHeightM: 0.56 } -> [{ top, bottom: null }].
 */
export function deriveColumnRows(boxes, { tierHeightM = null, floorM = null } = {}) {
    const byLeft = Object.entries(boxes).sort(([, a], [, b]) => a.minM.x - b.minM.x);
    const groups = [];
    for (const [id, box] of byLeft) {
        const last = groups.at(-1);
        if (last && box.minM.x <= last.rightM + contactM) { last.ids.push(id); last.rightM = Math.max(last.rightM, box.maxM.x); }
        else groups.push({ ids: [id], rightM: box.maxM.x });
    }
    return groups.flatMap(group => {
        const groupBoxes = Object.fromEntries(group.ids.map(id => [id, boxes[id]]));
        const options = { tierHeightM, floorM };
        try { return [columnRowFromBoxes(`columns-${group.ids[0]}`, groupBoxes, options)]; }
        catch { return group.ids.map(id => columnRowFromBoxes(`columns-${id}`, { [id]: boxes[id] }, options)); }
    });
}

/**
 * A stored column place with its bottom shift read again from the boxes of its two cabinets: a legacy
 * setPosition (or an older scene) may have moved one of them since the place was stored.
 * Only the pair is read (columnRowFromBoxes of two boxes), never the whole row: a widened neighbour that now
 * overlaps the column in X would otherwise join the place and break the row.
 * The stored place is kept when a box is missing or the pair no longer overlaps in X (it is not one place any more).
 * Example: stored { top: 't', bottom: 'b' }, t at x 0..0.70 (level 0.28), b at x 0.45..1.15 (level 0)
 *   -> { top: 't', bottom: 'b', bottomOffsetM: 0.45 }.
 */
function placeWithShiftFromBoxes(place, boxes, options) {
    const bothCabinets = place.top != null && place.bottom != null;
    // A full place or a column with one cabinet has no shift.
    if (!bothCabinets) return place;
    const topBox = boxes[place.top], bottomBox = boxes[place.bottom];
    // A cabinet without a box: nothing to read the shift from.
    if (!topBox || !bottomBox) return place;
    let pair;
    try { pair = columnRowFromBoxes('pair', { [place.top]: topBox, [place.bottom]: bottomBox }, options); } catch { return place; }
    const [read] = pair.places;
    const samePlace = pair.places.length === 1 && read.top === place.top && read.bottom === place.bottom;
    // The two boxes no longer form this column: keep what was stored.
    if (!samePlace) return place;
    return read;
}

/**
 * Stored column rows for the cabinets that exist now, WITHOUT moving any of them.
 * 1. A stored row without places (older scene, a document layout) is read back from the boxes of its cabinets,
 *    on its stored floor (raw.bottomM) or else on options.floorM.
 * 2. A stored row with places keeps them; the shift of each two-cabinet column is read again from the boxes.
 * 3. Cabinets that no longer exist leave their rows (removeCabinet); an empty row disappears.
 * 4. Cabinets in no row get rows from their boxes (deriveColumnRows) on options.floorM.
 * -> Row[]. Example: stored [{ id: 'r', orderedCabinetIds: ['x'], bottomM: 0 }], x a 28 at y 0.28..0.56, tierHeightM 0.56
 *   -> [{ id: 'r', bottomM: 0, topM: 0.56, places: [{ top: 'x', bottom: null }] }].
 */
export function reconcileColumnRows(stored, boxes, { tierHeightM = null, floorM = null } = {}) {
    const ids = new Set(Object.keys(boxes));
    const rows = [];
    for (const raw of Array.isArray(stored) ? stored : []) {
        const rowFloorM = Number.isFinite(raw?.bottomM) ? raw.bottomM : floorM;
        const options = { tierHeightM, floorM: rowFloorM };
        let row;
        if (!Array.isArray(raw?.places)) {
            // 1. Older row: no places stored (columnRowFromBoxes puts the plane at the tier height).
            const members = Object.fromEntries((raw?.orderedCabinetIds ?? []).filter(id => ids.has(id)).map(id => [id, boxes[id]]));
            if (!Object.keys(members).length) continue;
            try { row = columnRowFromBoxes(raw.id, members, options); } catch { continue; }
        } else {
            // 2. Stored places: refresh the column shifts from the boxes. The stored plane is set again from the tier
            //    height: a row stored before the pack had one carries its highest member (0.28 for a lone 28).
            const places = raw.places.map(place => placeWithShiftFromBoxes(place, boxes, options));
            row = withTierPlane({ ...structuredClone(raw), places }, tierHeightM);
        }
        // 3. Prune to the existing cabinets.
        for (const id of cabinetsOfRow(row)) {
            if (!ids.has(id)) row = removeCabinet(row, id);
        }
        if (row.places.length) rows.push(row);
    }
    // 4. Orphans.
    const placed = new Set(rows.flatMap(cabinetsOfRow));
    const orphans = Object.fromEntries([...ids].filter(id => !placed.has(id)).map(id => [id, boxes[id]]));
    return [...rows, ...deriveColumnRows(orphans, { tierHeightM, floorM })];
}

/**
 * Top of a cabinet in its column row (m): a column `top` hangs from the row plane; a full place or a column `bottom`
 * stands on the row floor and ends at floor + Height. null when no row holds it or its Height (cm) is unknown.
 * Example: row { bottomM: 0, topM: 0.56 }, { top: 'b' } -> 0.56; { full: 'd' } with Height 28 -> 0.28.
 */
function cabinetTopM(rows, products, id) {
    const found = findCabinetPlace(rows, id);
    // Not in any row: no place to read its top from.
    if (!found) return null;
    if (found.slot === 'top') return found.row.topM;
    const heightCm = Number(read(products?.[id], 'Height'));
    // No Height: the top cannot be told.
    if (!Number.isFinite(heightCm)) return null;
    return found.row.bottomM + heightCm / CENTIMETRES_PER_METRE;
}

/**
 * True when the cabinet is in the sink cabinet's group but its top ends below the sink cabinet's top, so the
 * countertop does not rest on it. Example (Multi-Level 70″): sink top 0.56, the open shelf beside it 0.56 -> false;
 * a lone 28 on the floor beside them (top 0.28) -> true.
 */
function endsBelowSinkCabinetTop(cabinetTop, sinkCabinetTop) {
    // A top that cannot be told: leave the cabinet where the rows rule put it.
    if (cabinetTop === null || sinkCabinetTop === null) return false;
    return cabinetTop < sinkCabinetTop - COUNTERTOP_PLANE_TOLERANCE_M;
}

/**
 * SupportGroupId of every cabinet of the column rows. Reason: the countertop support resolver averages the tops of
 * ONE group and calls a spread over 1 mm unresolved (the top then hangs in the air), so the countertop's group holds
 * only the cabinets in the sink cabinet's plane.
 * 1. The rows rule (HR-RW-05, assignSupportGroups) on cabinetsOfRow: the sink cabinet's row gets the countertop group.
 * 2. Every column `bottom` gets `${group}~under`: it ends 28 cm below the plane.
 * 3. In the sink cabinet's group, every cabinet whose top ends below the sink cabinet's top gets `${group}~under` too
 *    (a lone low cabinet whose stored place is still `full`). A row without a sink cabinet keeps step 1 and 2.
 * Example: [56 a][top b / bottom c] in group 'group-1' -> a, b: 'group-1'; c: 'group-1~under'.
 * Example (Multi-Level 70″): [top shelf][top sink][full low, 28 high] -> shelf, sink: 'group-1'; low: 'group-1~under'.
 */
export function columnSupportGroups(rows, products, { isSinkCabinet = () => false, pendingIds = [] } = {}) {
    // 1. The rows rule.
    const asRows = rows.map(row => ({ id: row.id, leftM: row.leftM, bottomM: row.bottomM, zM: row.zM, orderedCabinetIds: cabinetsOfRow(row) }));
    const groups = assignSupportGroups(asRows, products, { isSinkCabinet, pendingIds });
    const sinkCabinetId = [...groups.keys()].find(id => !pendingIds.includes(id) && products?.[id] != null && isSinkCabinet(products[id]));
    const countertopGroup = sinkCabinetId === undefined ? null : groups.get(sinkCabinetId);
    const sinkCabinetTop = sinkCabinetId === undefined ? null : cabinetTopM(rows, products, sinkCabinetId);
    for (const [id, group] of groups) {
        // 2. A column's bottom is never a countertop support.
        const isColumnBottom = findCabinetPlace(rows, id)?.slot === 'bottom';
        // 3. A cabinet of the countertop group that ends below the sink cabinet's plane.
        const isBelowCountertopPlane = group === countertopGroup && endsBelowSinkCabinetTop(cabinetTopM(rows, products, id), sinkCabinetTop);
        if (isColumnBottom || isBelowCountertopPlane) groups.set(id, `${group}${UNDER_TOP_GROUP_SUFFIX}`);
    }
    return groups;
}

/** Column rows -> document.localLayouts (anchor = left edge / floor / depth centre, like the rows layout). */
export const columnRowsToLayouts = (rows, frameId) => sortColumnRows(rows).map(row => ({ id: row.id,
    kind: CABINET_ROW_LAYOUT_KIND, frameId, anchorPositionM: { x: row.leftM, y: row.bottomM, z: row.zM },
    orderedCabinetIds: cabinetsOfRow(row), policyId: CABINET_COLUMNS_POLICY_ID }));

/**
 * Drag-and-drop Apply for columns: the dropped cabinet (id, box) joins the row whose X range it touches
 * or overlaps; the row's places are read again from the boxes (so a 28 dropped onto another 28 becomes
 * the top or bottom of a column). No such row, or a place with three cabinets -> a new row of one cabinet.
 * rows: the rows WITHOUT the dropped cabinet. -> { rows, rowId } (rowId: the row now holding the cabinet)
 */
export function placeColumnDrop(rows, boxes, id, box, { tierHeightM = null, floorM = null } = {}) {
    const target = rows.find(row => Object.values(rowBoxes(row, boxes)).some(member => touchesX(member, box)));
    const alone = columnRowFromBoxes(`columns-${id}`, { [id]: box }, { tierHeightM, floorM });
    // 1. Nothing touched: the cabinet starts its own row.
    if (!target) return { rows: [...rows, alone], rowId: alone.id };
    // 2. The touched row read again with the drop in it, on that row's floor (a top dropped with a shift over a
    //    bottom keeps the shift: columnRowFromBoxes reads bottomOffsetM from the boxes).
    const targetFloorM = Number.isFinite(target.bottomM) ? target.bottomM : floorM;
    try {
        const joined = columnRowFromBoxes(target.id, { ...rowBoxes(target, boxes), [id]: box }, { tierHeightM, floorM: targetFloorM });
        return { rows: rows.map(row => row === target ? joined : row), rowId: joined.id };
    } catch {
        // 3. Not a column (a third cabinet, or two side by side in one place): the drop starts its own row (the collision
        //    rule reports the overlap).
        return { rows: [...rows, alone], rowId: alone.id };
    }
}

/**
 * The floor a dropped cabinet that starts its own row stands on (m), so that it stays where the drag showed it:
 * 1. the floor of a stored row whose plane is at the drop's top (±5 mm: the drop hangs from that plane);
 * 2. the stored floor of the row it left;
 * 3. the floor every stored row shares;
 * 4. `fallbackM` (the measured room floor).
 * Reason (config 15280, Andriy 23.10): the stored rows of a preset stand on 0 while the room floor collider measures
 * -0.0315; an SB set apart started a row on the collider and hung 3.15 cm lower than the SB beside it — its top no
 * longer level with the other (SINK_BASE_TOPS_SPLIT), although the drag had shown and validated it level.
 * Example: stored [{ orderedCabinetIds: ['a', 'b'], bottomM: 0, topM: 0.56 }], 'b' dropped apart with its top at 0.56,
 *   fallback -0.0315 -> 0.
 */
export function dropFloorM(stored, id, fallbackM = null, { dropTopM = null, tierHeightM = null, levelM = 0.005 } = {}) {
    const rows = (Array.isArray(stored) ? stored : []).filter(row => Number.isFinite(row?.bottomM));
    const planeOf = row => Number.isFinite(row.topM) ? row.topM : Number.isFinite(tierHeightM) ? row.bottomM + tierHeightM : null;
    const level = Number.isFinite(dropTopM) ? rows.find(row => Math.abs((planeOf(row) ?? Infinity) - dropTopM) <= levelM) : null;
    if (level) return level.bottomM;
    const left = rows.find(row => (row.orderedCabinetIds ?? []).includes(id));
    if (left) return left.bottomM;
    const floors = rows.map(row => row.bottomM);
    const shared = floors.length && floors.every(floor => Math.abs(floor - floors[0]) <= COUNTERTOP_PLANE_TOLERANCE_M);
    return shared ? floors[0] : fallbackM;
}

/** Sizes for layoutColumnRow from boxes: width and pivot from the box, height from `heightOf(id)` or the box. */
export function columnSizes(boxes, pivotXOf, heightOf = () => null) {
    const sizes = new Map();
    for (const [id, box] of Object.entries(boxes)) {
        const extent = extentFromBox(box, pivotXOf(id));
        sizes.set(id, { widthM: extent.widthM, pivotFromLeftM: extent.pivotFromLeftM, heightM: heightOf(id) ?? box.maxM.y - box.minM.y });
    }
    return sizes;
}

/** Name fragment of the UD handle panels (UD_Handle_BaseP_*, _LateralP_*, _Full_*). */
const HANDLE_PANEL_NAME_FRAGMENT = 'UD_Handle_';

/**
 * Layout box of a cabinet: its mesh box, with X taken without the handle panels. Reason: the open side shelf rule
 * (RuleOpenSideShelfNeighboursUrbanDuplex) stretches the handles of a cabinet over the neighbouring shelf; with the
 * handles in the box the cabinet looked 15 cm wider and the next reflow (e.g. a Depth change) pushed the shelf away.
 * Y and Z stay the full mesh box, so row levels and row Z (zM) do not move.
 * Example: SB 0..0.70 with handles stretched to 0.85 -> X 0..0.70; Y/Z as measured.
 */
export function measureLayoutBoxM(entity) {
    const meshBox = measureEntityBoundsM(entity);
    // Nothing measurable: the caller treats the cabinet as not measured yet.
    if (!meshBox) return meshBox;
    const withoutHandles = measureEntityBoundsM(entity, {
        excludeNameFragments: [...DEFAULT_EXCLUDED_NODE_FRAGMENTS, HANDLE_PANEL_NAME_FRAGMENT]
    });
    // Only handle panels are visible (not a real cabinet state): keep the mesh box.
    if (!withoutHandles) return meshBox;
    return { minM: { ...meshBox.minM, x: withoutHandles.minM.x }, maxM: { ...meshBox.maxM, x: withoutHandles.maxM.x } };
}

/**
 * FreeLayoutPolicy (contract: cabinet-local-runtime.mjs) of a modular collection with `columns: true`.
 * Example: UD row [56][top 28 / bottom 28][56]; the first 56 gets narrower -> reflow moves the column and
 * the last 56 left by the difference; deleting the bottom 28 keeps the top 28 hanging in its place.
 *   placeNew(entity, entities, composition, prevEntityId, side) -> [{ entity, position, index, isChanged, config? }] | null
 *   reflow(composition, reason, detail?) -> { reason, movedIds, rows } | null
 *   observe(composition?, { authoritative }) -> Promise<{ rows, groups, changedGroupIds } | null>   (nothing moves)
 *   columnRows(composition?) -> { rows, boxes } | null   (stored column rows reconciled with the measured boxes, mesh with
 *       the level from the pivot; null while the policy does not own the composition or a cabinet is not measurable)
 */
export function createColumnRowsLayoutPolicy({ app, compositionId = null, matches = null, getProductConfig = null,
    measure = measureLayoutBoxM, levelFromPivot = measure === measureLayoutBoxM || measure === measureEntityBoundsM, gapM = CABINET_LAYOUT_GAP_METERS,
    tierHeightM = null } = {}) {
    const isSinkCabinet = sinkCabinetDetector(getProductConfig);
    let destroyed = false;
    /**
     * The floor rows without a stored floor stand on (m): the top of the room floor collider (as the runtime's drag
     * snap reads it), else 0. Reason: without a floor a lone hanging 28 is read as a `bottom` standing at 0.28.
     */
    const floorLevelM = () => {
        try { return measureFloorColliderBox(app)?.maxM?.y ?? 0; } catch { return 0; }
    };
    const rowOptions = () => ({ tierHeightM, floorM: floorLevelM() });
    const activeComposition = () => app?.compositionManager?.getActiveComposition?.();
    const cabinetsOf = composition => Object.entries(composition.getAllProducts?.() ?? {})
        .filter(([, snapshot]) => read(snapshot, 'category') === 'cabinets');
    const owns = composition => !destroyed && !!composition && typeof composition.getCabinetRows === 'function' &&
        typeof composition.setCabinetRows === 'function' && (!compositionId || composition.compositionId === compositionId) &&
        (typeof matches !== 'function' || cabinetsOf(composition).every(([, snapshot]) => matches(read(snapshot, 'productType'))));
    // Mesh box; a cabinet's minM.y is its pivot level (a sink bowl hangs below the pivot), as in the rows layout.
    const boxOf = entity => {
        const mesh = entity ? measure(entity) : null;
        const box = levelFromPivot && isBox(mesh) ? withLevel(mesh, cabinetLevelM(entity)) : mesh;
        return isBox(box) ? { minM: { ...box.minM }, maxM: { ...box.maxM } } : null;
    };
    /** Height in metres from the snapshot (Height, cm) or the catalog default; null when unknown. */
    const heightOf = snapshot => {
        const height = Number(read(snapshot, 'Height') ?? getProductConfig?.(read(snapshot, 'productType'))?.defaultConfig?.Height);
        return height > 0 ? height / CENTIMETRES_PER_METRE : null;
    };
    /** Boxes and entities of the given entities; null while one of them cannot be measured. */
    const measureAll = entities => {
        const boxes = {}, byId = {};
        for (const entity of entities) {
            const box = boxOf(entity);
            if (!box || !Number.isFinite(entity?.getPosition?.()?.x)) return null;
            boxes[entity.name] = box; byId[entity.name] = entity;
        }
        return { boxes, byId };
    };
    const entitiesOf = composition => cabinetsOf(composition).map(([id]) => app?.root?.findByName?.(id)).filter(Boolean);
    const sizesOf = (composition, measured, extra = {}) => {
        const products = composition.getAllProducts?.() ?? {};
        const boxes = { ...measured.boxes, ...extra.boxes };
        const byId = { ...measured.byId, ...extra.byId };
        return columnSizes(boxes, id => byId[id].getPosition().x, id => products[id] ? heightOf(products[id]) : null);
    };
    /** Persist rows / order / groups only where they differ (no feedback loop through lastModified). */
    function commit(composition, rows, pendingIds = []) {
        const next = sortColumnRows(rows).map(toStoredColumnRow);
        if (JSON.stringify(composition.getCabinetRows() ?? []) !== JSON.stringify(next)) composition.setCabinetRows(next);
        const order = composition.getOrderProductIds?.() ?? {};
        columnRowOrder(next).forEach((id, index) => { if (order[id] !== index) composition.setOrderProductId(id, index); });
        const products = composition.getAllProducts();
        const groups = columnSupportGroups(next, products, { isSinkCabinet, pendingIds });
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

    return {
        /** Rows of this policy may hold columns (scene-manager plans the column "+" buttons on columnRows()). */
        columns: true,
        /** The rows and the boxes they were read from: the scene "+" are planned on the same boxes (one measurement). */
        columnRows(composition = activeComposition()) {
            if (!owns(composition)) return null;
            const measured = measureAll(entitiesOf(composition));
            if (!measured) return null;
            return { rows: reconcileColumnRows(composition.getCabinetRows(), measured.boxes, rowOptions()), boxes: measured.boxes };
        },
        placeNew(entity, entities, composition, prevEntityId, side) {
            if (!entity?.name || !owns(composition)) return null;
            const existing = (entities ?? []).filter(item => item && item !== entity && item.name !== entity.name);
            const measured = measureAll(existing), box = boxOf(entity), pose = entity.getPosition?.();
            // Not measurable yet: keep composition-manager's own placement.
            if (!measured || !box || !isVec(pose)) return null;
            let rows = reconcileColumnRows(composition.getCabinetRows(), measured.boxes, rowOptions());
            const sizes = sizesOf(composition, measured, { boxes: { [entity.name]: box }, byId: { [entity.name]: entity } });
            const size = sizes.get(entity.name);
            // 1. The row to extend: the requested cabinet's row, else the right-most (or left-most) row.
            const sorted = sortColumnRows(rows);
            const requested = prevEntityId ? findCabinetPlace(rows, prevEntityId)?.row : null;
            const fallback = side === 'left' ? sorted[0] : sorted.at(-1);
            const anchorRow = requested ?? fallback ?? null;
            let rowId, z = pose.z;
            // 2a. Into the anchor's column ("+" kinds 'top' / 'bottom' of the scene plus buttons, HR-RW-10): the anchor
            //     is the cabinet already in that column; its free slot takes the new cabinet, nothing else moves.
            const columnSlot = columnSlotFor(anchorRow, prevEntityId, side);
            if (anchorRow && columnSlot) {
                const next = addToColumn(anchorRow, columnSlot.placeIndex, columnSlot.slot, entity.name);
                rows = rows.map(row => row === anchorRow ? next : row);
                rowId = next.id;
                z = measured.byId[prevEntityId].getPosition().z;
            } else if (anchorRow) {
                // 2b. A new place at the end of the row; on the left end the row grows to the left (others stay).
                const index = side === 'left' || side === 'left-top' ? 0 : anchorRow.places.length;
                // R1: a cabinet lower than the tier hangs from the plane (top slot) whatever "+" asked for it
                // ('left' / 'right' / 'left-top' / 'right-top'); a tall one fills the place.
                // Example: 28 on 'right' of [56] -> { top: id, bottom: null }.
                let next = insertPlace(anchorRow, index, placeForHeight(anchorRow, entity.name, size.heightM));
                if (index === 0) next = { ...next, leftM: anchorRow.leftM - size.widthM - gapM };
                rows = rows.map(row => row === anchorRow ? next : row);
                rowId = next.id;
                z = measured.byId[cabinetsOfRow(anchorRow)[0]].getPosition().z;
            } else {
                // 3. First cabinet: the legacy seed pose (pivot at the origin) starts the first row; the seed level is
                //    the row's floor. A cabinet lower than the tier hangs from the plane (top slot, its top is the
                //    countertop plane); a tall one stands on the floor. Example (tier 0.56): a 28 -> { top: id, bottom: null },
                //    floor 0, plane 0.56, pivot y 0.28; a 56 -> { full: id }, pivot y 0.
                const bottomM = box.minM.y - pose.y;
                const firstRow = { id: `columns-${entity.name}`, leftM: -size.pivotFromLeftM, bottomM,
                    topM: bottomM + (tierHeightM ?? size.heightM), zM: (box.minM.z + box.maxM.z) / 2 - pose.z };
                rows = [{ ...firstRow, places: [placeForHeight(firstRow, entity.name, size.heightM)] }];
                rowId = rows[0].id;
            }
            const row = rows.find(candidate => candidate.id === rowId);
            const positions = layoutColumnRow(row, sizes, { gapM });
            const { rows: stored, groups } = commit(composition, rows, [entity.name]);
            const order = columnRowOrder(stored);
            const placed = positions.get(entity.name);
            const results = [{ entity, position: poseAt(pose, placed.pivotXM, placed.pivotYM, z), index: order.indexOf(entity.name),
                isChanged: true, config: { SupportGroupId: groups.get(entity.name) } }];
            for (const item of existing) {
                const target = positions.get(item.name), p = item.getPosition();
                if (!target || Math.abs(target.pivotXM - p.x) <= POSITION_EPSILON_M) continue;
                results.push({ entity: item, position: poseAt(p, target.pivotXM, p.y, p.z), index: order.indexOf(item.name), isChanged: true });
            }
            return results;
        },
        reflow(composition, reason = 'recalculate') {
            if (!owns(composition)) return null;
            const measured = measureAll(entitiesOf(composition));
            if (!measured) return null;
            // A removed cabinet left its row (removeCabinet); the places to its right close the gap.
            const rows = reconcileColumnRows(composition.getCabinetRows(), measured.boxes, rowOptions());
            const sizes = sizesOf(composition, measured), movedIds = [];
            for (const row of rows) {
                for (const [id, target] of layoutColumnRow(row, sizes, { gapM })) {
                    const entity = measured.byId[id], p = entity.getPosition();
                    // Only a column's top follows the plane in Y; everything else keeps its level.
                    const hangs = findCabinetPlace([row], id)?.slot === 'top';
                    const y = hangs ? target.pivotYM : p.y;
                    if (Math.abs(target.pivotXM - p.x) <= POSITION_EPSILON_M && Math.abs(y - p.y) <= POSITION_EPSILON_M) continue;
                    entity.setPosition(target.pivotXM, y, p.z); movedIds.push(id);
                }
            }
            const { rows: stored, groups, changedGroupIds } = commit(composition, rows);
            return { reason, movedIds, rows: stored, groups, changedGroupIds };
        },
        async observe(composition = activeComposition()) {
            if (!owns(composition)) return null;
            const measured = measureAll(entitiesOf(composition));
            if (!measured) return null;
            const rows = reconcileColumnRows(composition.getCabinetRows(), measured.boxes, rowOptions());
            const result = commit(composition, rows);
            const last = result.changedGroupIds.at(-1), manager = app?.compositionManager;
            // Groups changed outside a command (migration, a bottom moved under a top): rerun the top/cover rules.
            if (last) await manager?.aggregator?.onProductChanged?.(composition.compositionId, last,
                { SupportGroupId: result.groups.get(last) }, manager.getAllCompositions?.());
            return result;
        },
        destroy() { destroyed = true; }
    };
}
