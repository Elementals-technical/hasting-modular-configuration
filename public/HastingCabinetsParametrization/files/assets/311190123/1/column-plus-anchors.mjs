/**
 * "+" buttons for column rows (the `columns: true` policy, Urban Duplex first). Pure: no PlayCanvas, metres.
 *
 * A column row is one tier between the floor (row.bottomM) and the countertop plane (row.topM); a place holds
 * one full cabinet or a column of two low cabinets (cabinet-columns.mjs). The user builds a column with "+":
 *
 *   kind        where the new cabinet goes (probe box)                       button point (x, y)
 *   left        past the left row end, where the runtime puts it (R1): a low   (row.leftM, row.bottomM + half low height)
 *               one hangs from the plane, a full one stands on the floor —
 *               the probe is the whole tier on the floor, holding both poses
 *   right       the same past the right row end                               (right edge of the last place, same y)
 *   left-top    past the left row end, a low one hanging from the plane        (row.leftM, row.topM - half low height)
 *   right-top   past the right row end, a low one hanging from the plane       (right edge of the last place, same y)
 *   top         a low one above a column bottom that has no top                (place centre, bottom box top + half low height)
 *   bottom      a low one below a column top that has no bottom                (place centre, row.bottomM + half low height)
 *
 * The button z is the front face of the place: row.zM + half the place depth (as zFront in AnchorCalculator).
 * The UI decides which "+" to show and which product a click adds; this module only says where a cabinet fits.
 */
import { detectDraftCollision, DRAFT_COLLISION_REASON } from '../draft-collision.mjs';
import { cabinetsOfPlace, isColumn } from './cabinet-columns.mjs';
import { SLOT_GAP_M } from '../placement-slots.mjs';

/** Height of an Urban Duplex low cabinet (the "28"). Only sizes the probe box of a low cabinet; the UI picks the real product. */
export const LOW_CABINET_HEIGHT_M = 0.28;
const HALF_LOW_CABINET_HEIGHT_M = LOW_CABINET_HEIGHT_M / 2;

export const COLUMN_PLUS_KINDS = Object.freeze(['left', 'right', 'left-top', 'right-top', 'top', 'bottom']);

function boxOf(boxes, id) {
    if (boxes instanceof Map) return boxes.get(id) ?? null;
    return boxes?.[id] ?? null;
}

/**
 * X span and depth of a place from its measured cabinets: { leftM, rightM, widthM, depthM, cabinetId }.
 * cabinetId = the first cabinet of the place (the top of a column before its bottom).
 * Returns null when no cabinet of the place is measured.
 */
function placeGeometry(place, boxes) {
    const measured = cabinetsOfPlace(place)
        .map(id => ({ id, box: boxOf(boxes, id) }))
        .filter(entry => entry.box);
    // Nothing measured: the place cannot carry a "+".
    if (!measured.length) return null;
    const leftM = Math.min(...measured.map(entry => entry.box.minM.x));
    const rightM = Math.max(...measured.map(entry => entry.box.maxM.x));
    const depthM = Math.max(...measured.map(entry => entry.box.maxM.z - entry.box.minM.z));
    return { leftM, rightM, widthM: rightM - leftM, depthM, cabinetId: measured[0].id };
}

/** A probe box: X from probeLeftM, Y from probeBottomM (a low cabinet's height unless heightM says otherwise), Z centred on the row. */
function probeBox({ probeLeftM, probeBottomM, widthM, depthM, row, heightM = LOW_CABINET_HEIGHT_M }) {
    return {
        minM: { x: probeLeftM, y: probeBottomM, z: row.zM - depthM / 2 },
        maxM: { x: probeLeftM + widthM, y: probeBottomM + heightM, z: row.zM + depthM / 2 },
    };
}

/**
 * The probe of a 'left' / 'right' "+": the whole tier on the floor. R1 puts a low cabinet hanging at the plane and a
 * full one on the floor; the tier box holds both, so the "+" shows only where either fits.
 * Example: tier 0..0.56 -> probe y 0..0.56 (not 0..0.28: no cabinet ever stands there as a low one on the floor).
 */
function rowEndProbe({ probeLeftM, widthM, depthM, row }) {
    return probeBox({ probeLeftM, probeBottomM: row.bottomM, widthM, depthM, row, heightM: row.topM - row.bottomM });
}

/** One "+" with its availability (same reasons shape as makeSlot in placement-slots.mjs). */
function makePlus({ kind, cabinetId, row, positionM, probe, neighbours }) {
    const collision = detectDraftCollision({ box: probe, neighbours, levelM: probe.minM.y });
    const colliding = collision.status === 'colliding';
    let reasons = [];
    if (colliding) reasons = [Object.freeze({ code: DRAFT_COLLISION_REASON, collidesWith: Object.freeze([...collision.collidesWith]) })];
    return Object.freeze({
        id: `${kind}:${cabinetId}`,
        kind,
        cabinetId,
        rowId: row.id,
        positionM: Object.freeze({ ...positionM }),
        availability: colliding ? 'unavailable' : 'available',
        reasons: Object.freeze(reasons),
    });
}

/** The four row-end "+" (left, left-top, right, right-top) of a row. */
function rowEndPluses(row, boxes, neighbours) {
    const firstPlace = row.places[0];
    const lastPlace = row.places.at(-1);
    const first = placeGeometry(firstPlace, boxes);
    const last = placeGeometry(lastPlace, boxes);
    const pluses = [];
    // 1. Left end: the new cabinet is as wide as the first place and ends one slot gap left of the row.
    if (first) {
        const probeLeftM = row.leftM - SLOT_GAP_M - first.widthM;
        const zM = row.zM + first.depthM / 2;
        const shared = { cabinetId: first.cabinetId, row, neighbours };
        pluses.push(makePlus({ ...shared, kind: 'left',
            positionM: { x: row.leftM, y: row.bottomM + HALF_LOW_CABINET_HEIGHT_M, z: zM },
            probe: rowEndProbe({ probeLeftM, widthM: first.widthM, depthM: first.depthM, row }) }));
        pluses.push(makePlus({ ...shared, kind: 'left-top',
            positionM: { x: row.leftM, y: row.topM - HALF_LOW_CABINET_HEIGHT_M, z: zM },
            probe: probeBox({ probeLeftM, probeBottomM: row.topM - LOW_CABINET_HEIGHT_M, widthM: first.widthM, depthM: first.depthM, row }) }));
    }
    // 2. Right end: the new cabinet is as wide as the last place and starts one slot gap right of it.
    if (last) {
        const probeLeftM = last.rightM + SLOT_GAP_M;
        const zM = row.zM + last.depthM / 2;
        const shared = { cabinetId: last.cabinetId, row, neighbours };
        pluses.push(makePlus({ ...shared, kind: 'right',
            positionM: { x: last.rightM, y: row.bottomM + HALF_LOW_CABINET_HEIGHT_M, z: zM },
            probe: rowEndProbe({ probeLeftM, widthM: last.widthM, depthM: last.depthM, row }) }));
        pluses.push(makePlus({ ...shared, kind: 'right-top',
            positionM: { x: last.rightM, y: row.topM - HALF_LOW_CABINET_HEIGHT_M, z: zM },
            probe: probeBox({ probeLeftM, probeBottomM: row.topM - LOW_CABINET_HEIGHT_M, widthM: last.widthM, depthM: last.depthM, row }) }));
    }
    return pluses;
}

/** The "+" that completes a half column: 'top' above a lone bottom, 'bottom' below a lone top. */
function columnPlus(place, row, boxes, neighbours) {
    // A full place or a complete column has nothing to complete.
    if (!isColumn(place)) return null;
    const hasTop = place.top != null;
    const hasBottom = place.bottom != null;
    if (hasTop === hasBottom) return null;
    const geometry = placeGeometry(place, boxes);
    // The present cabinet is not measured: no point to put the "+" at.
    if (!geometry) return null;
    const centreXM = geometry.leftM + geometry.widthM / 2;
    const zM = row.zM + geometry.depthM / 2;
    const shared = { row, neighbours };
    // 1. Lone bottom: the new cabinet sits on top of it.
    if (hasBottom) {
        const bottomTopM = boxOf(boxes, place.bottom).maxM.y;
        return makePlus({ ...shared, kind: 'top', cabinetId: place.bottom,
            positionM: { x: centreXM, y: bottomTopM + HALF_LOW_CABINET_HEIGHT_M, z: zM },
            probe: probeBox({ probeLeftM: geometry.leftM, probeBottomM: bottomTopM, widthM: geometry.widthM, depthM: geometry.depthM, row }) });
    }
    // 2. Lone top: the new cabinet stands on the floor under it.
    return makePlus({ ...shared, kind: 'bottom', cabinetId: place.top,
        positionM: { x: centreXM, y: row.bottomM + HALF_LOW_CABINET_HEIGHT_M, z: zM },
        probe: probeBox({ probeLeftM: geometry.leftM, probeBottomM: row.bottomM, widthM: geometry.widthM, depthM: geometry.depthM, row }) });
}

/**
 * Every "+" of the column rows, each checked against all cabinets and obstacles.
 * @param {object} input
 * @param {{id, leftM, bottomM, topM, zM, places}[]} input.rows  column rows (cabinet-columns.mjs)
 * @param {Map|object} input.boxes  cabinet id -> { minM, maxM } world box
 * @param {{id, box, bodyOnly?}[]} [input.obstacles]  extra bodies (the floor)
 * @returns {{id, kind, cabinetId, rowId, positionM, availability, reasons}[]}
 * Example: row [56 'a'][bottom 28 'b'] -> left:a, left-top:a, right:b, right-top:b, top:b (no 'bottom': b has no top above it).
 */
export function planColumnPlusButtons({ rows = [], boxes = {}, obstacles = [] } = {}) {
    const boxEntries = boxes instanceof Map ? [...boxes] : Object.entries(boxes ?? {});
    const cabinetNeighbours = boxEntries.map(([id, box]) => ({ id, box }));
    const obstacleNeighbours = (Array.isArray(obstacles) ? obstacles : []).filter(Boolean);
    const neighbours = [...cabinetNeighbours, ...obstacleNeighbours];
    const pluses = [];
    for (const row of Array.isArray(rows) ? rows : []) {
        // An empty row has no ends.
        if (!row?.places?.length) continue;
        pluses.push(...rowEndPluses(row, boxes, neighbours));
        for (const place of row.places) {
            const plus = columnPlus(place, row, boxes, neighbours);
            if (plus) pluses.push(plus);
        }
    }
    return pluses;
}
