import { detectDraftCollision, boxAt, DRAFT_COLLISION_REASON } from './draft-collision.mjs';
import { cabinetLevelM } from './cabinet-footprint.mjs';
import { DEFAULT_ROW_TOLERANCES } from './cabinet-rows.mjs';
import { CABINET_LAYOUT_GAP_METERS } from '../composition/layout-constants.mjs';
import { cabinetsOfRow, cabinetsOfPlace, isColumn, isLowerThanTier } from './columns/cabinet-columns.mjs';

/** Gap between a row end and the slot past it: the layout gap between cabinets. */ const SLOT_GAP_M = CABINET_LAYOUT_GAP_METERS;
const PARK_GAP_M = 0.3;
/** Reason of a column 'top' / 'bottom' slot the draft is too tall for (over the plane, or into the top above it). */ const SLOT_DOES_NOT_FIT_REASON = 'DOES_NOT_FIT';
const compareIds = (a, b)=>String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
/** Row LEVEL of a cabinet = its pivot Y (Plan A); the mesh bottom only when no pivot is known. */ const levelOf = (c)=>cabinetLevelM(c?.pivotM) ?? c.box.minM.y;
const byMinX = (a, b)=>a.box.minM.x - b.box.minM.x || levelOf(a) - levelOf(b) || compareIds(a.id, b.id);
/**
 * @param {{id:string, box:{minM,maxM}, pivotM:{x,y,z}}[]} cabinets
 * @returns {ReadonlyArray<{id, cabinetIds, minX, maxX, bottomY, leftId, rightId}>} sorted by minX
 */ function groupCabinetRows(cabinets, { levelToleranceM = 0.005, contactToleranceM = 0.002 } = {}) {
    const list = (Array.isArray(cabinets) ? cabinets : []).filter((c)=>c && c.box && c.box.minM && c.box.maxM);
    // 1) level bands: sort by LEVEL = pivot Y (ties by x, id) and chain consecutive levels within tolerance.
    //    A sink (mesh ~6 cm below its pivot) and a plain cabinet at the same pivot Y share one band.
    const byLevel = [
        ...list
    ].sort((a, b)=>levelOf(a) - levelOf(b) || byMinX(a, b));
    const bands = [];
    for (const cabinet of byLevel){
        const band = bands[bands.length - 1];
        const level = levelOf(cabinet);
        if (band && Math.abs(level - band.lastY) <= levelToleranceM) {
            band.members.push(cabinet);
            band.lastY = level;
        } else {
            bands.push({
                members: [
                    cabinet
                ],
                lastY: level
            });
        }
    }
    // 2) within a band: sort by minX and split where the gap to the running right edge exceeds contact tolerance.
    const rows = [];
    for (const band of bands){
        const sorted = [
            ...band.members
        ].sort(byMinX);
        let current = null;
        for (const cabinet of sorted){
            if (current && cabinet.box.minM.x - current.maxX <= contactToleranceM) {
                current.members.push(cabinet);
                current.maxX = Math.max(current.maxX, cabinet.box.maxM.x);
            } else {
                current = {
                    members: [
                        cabinet
                    ],
                    maxX: cabinet.box.maxM.x
                };
                rows.push(current);
            }
        }
    }
    return Object.freeze(rows.map(({ members, maxX })=>{
        const cabinetIds = Object.freeze(members.map((c)=>c.id));
        return Object.freeze({
            id: 'row-' + cabinetIds[0],
            cabinetIds,
            minX: Math.min(...members.map((c)=>c.box.minM.x)),
            maxX,
            bottomY: Math.min(...members.map(levelOf)),
            leftId: cabinetIds[0],
            rightId: cabinetIds[cabinetIds.length - 1]
        });
    }).sort((a, b)=>a.minX - b.minX || a.bottomY - b.bottomY || compareIds(a.id, b.id)));
}
/** fits: false for a column slot the draft is too tall for; it stays a slot, unavailable with SLOT_DOES_NOT_FIT_REASON. */ function makeSlot({ kind, rowId, anchorCabinetId, positionM, relativeBox, neighbours, rowCabinetIds, fits = true }) {
    const position = Object.freeze({
        x: positionM.x,
        y: positionM.y,
        z: positionM.z
    });
    const collision = detectDraftCollision({
        box: boxAt(relativeBox, position),
        neighbours,
        levelM: position.y
    });
    const colliding = collision.status === 'colliding';
    const reasons = [];
    if (!fits) reasons.push(Object.freeze({
        code: SLOT_DOES_NOT_FIT_REASON
    }));
    if (colliding) reasons.push(Object.freeze({
        code: DRAFT_COLLISION_REASON,
        collidesWith: Object.freeze([
            ...collision.collidesWith
        ])
    }));
    const slot = Object.freeze({
        id: `${kind}:${anchorCabinetId ?? 'none'}`,
        kind,
        rowId,
        anchorCabinetId,
        positionM: position,
        availability: reasons.length ? 'unavailable' : 'available',
        reasons: Object.freeze(reasons),
        // The row's cabinets (left to right): a caller can prefer the row of any of them, even from a copy.
        rowCabinetIds: Object.freeze([
            ...rowCabinetIds ?? []
        ])
    });
    return slot;
}
/**
 * @param {object} input
 * @param {{id, box, pivotM}[]} input.cabinets   committed cabinets
 * @param {{relativeBox:{minM,maxM}}} input.draft the new cabinet's box relative to its pivot
 * @param {{id, box}[]} input.obstacles          extra bodies (e.g. floor)
 * @param {{id, leftM, bottomM, topM, zM, places}[]} [input.columnRows]  column rows (cabinet-columns.mjs) of a columns
 *   collection: the slots are then those of planColumnSlots instead of the level bands below. Absent = the rows layout.
 */ function planPlacementSlots({ cabinets = [], draft, obstacles = [], columnRows = null } = {}) {
    const relativeBox = draft?.relativeBox;
    if (!relativeBox?.minM || !relativeBox?.maxM) throw new TypeError('draft.relativeBox is required');
    const list = Array.isArray(cabinets) ? cabinets : [];
    const neighbours = [
        ...list,
        ...Array.isArray(obstacles) ? obstacles : []
    ].filter(Boolean).map(({ id, box, bodyOnly })=>bodyOnly ? {
            id,
            box,
            bodyOnly
        } : {
            id,
            box
        });
    // A columns collection: its rows are one tier, not level bands (a hanging top is no row of its own).
    if (Array.isArray(columnRows)) {
        const boxes = new Map(list.map((c)=>[
                c.id,
                c.box
            ]));
        const pivotZOf = new Map(list.map((c)=>[
                c.id,
                c.pivotM?.z ?? (c.box.minM.z + c.box.maxM.z) / 2
            ]));
        return Object.freeze(planColumnSlots(columnRows, boxes, {
            relativeBox,
            neighbours,
            pivotZOf
        }));
    }
    const byId = new Map(list.map((c)=>[
            c.id,
            c
        ]));
    const rows = groupCabinetRows(list);
    const slots = [];
    for (const row of rows){
        const left = byId.get(row.leftId);
        const right = byId.get(row.rightId);
        slots.push(makeSlot({
            kind: 'left',
            rowId: row.id,
            anchorCabinetId: row.leftId,
            relativeBox,
            neighbours,
            rowCabinetIds: row.cabinetIds,
            positionM: {
                x: row.minX - SLOT_GAP_M - relativeBox.maxM.x,
                y: left.pivotM.y,
                z: left.pivotM.z
            }
        }));
        slots.push(makeSlot({
            kind: 'right',
            rowId: row.id,
            anchorCabinetId: row.rightId,
            relativeBox,
            neighbours,
            rowCabinetIds: row.cabinetIds,
            positionM: {
                x: row.maxX + SLOT_GAP_M - relativeBox.minM.x,
                y: right.pivotM.y,
                z: right.pivotM.z
            }
        }));
    }
    if (rows.length) {
        const rightmost = rows.reduce((best, row)=>row.maxX > best.maxX ? row : best);
        const anchor = byId.get(rightmost.rightId);
        const globalMaxX = Math.max(...rows.map((row)=>row.maxX));
        slots.push(makeSlot({
            kind: 'park',
            rowId: null,
            anchorCabinetId: rightmost.rightId,
            relativeBox,
            neighbours,
            positionM: {
                x: globalMaxX + PARK_GAP_M - relativeBox.minM.x,
                y: anchor.pivotM.y,
                z: anchor.pivotM.z
            }
        }));
    } else {
        slots.push(parkAtOrigin(relativeBox, neighbours));
    }
    return Object.freeze(slots);
}
/** The park slot of an empty composition: the pivot at the origin. */ function parkAtOrigin(relativeBox, neighbours) {
    return makeSlot({
        kind: 'park',
        rowId: null,
        anchorCabinetId: null,
        relativeBox,
        neighbours,
        positionM: {
            x: 0,
            y: 0,
            z: 0
        }
    });
}
/** X span of a column place from its cabinets' boxes, or null when none is known. */ function columnPlaceSpan(place, boxes) {
    const placeBoxes = cabinetsOfPlace(place).map((id)=>boxes.get(id)).filter(Boolean);
    // No committed box: the place has no span.
    if (!placeBoxes.length) return null;
    return {
        leftM: Math.min(...placeBoxes.map((box)=>box.minM.x)),
        rightM: Math.max(...placeBoxes.map((box)=>box.maxM.x))
    };
}
/**
 * Column slots (rows with columns): pivot positions of the draft (pivot at its body bottom, its height
 * relativeBox.maxM.y = the body above the pivot). Z: the pivot Z of the row's cabinets — all cabinets of a row share
 * it, and a UD mesh is not centred on its pivot in Z, so centring the draft's mesh box on the row's config centre
 * would push every added cabinet 17 cm back (seen 14.10: 0, −0.173, −0.346).
 * 1. 'left' / 'right': past the row ends at the pose the runtime gives the draft (R1): a draft lower than the tier
 *    hangs, its top at row.topM; a tier-tall one stands on row.bottomM. One slot per end: a "hanging" end slot would
 *    be the same pose (a low draft hangs anyway, a tall one hanging from the plane stands on the floor).
 * 2. 'top': over a column bottom with no top, at the place's left edge, on the bottom box; unavailable
 *    (SLOT_DOES_NOT_FIT_REASON) when the draft would rise over the plane.
 * 3. 'bottom': under a column top with no bottom, at the place's left edge, on row.bottomM; unavailable when the
 *    draft does not fit under the top.
 * 4. 'park': PARK_GAP_M right of the right-most row, at that row's end pose.
 * Example: row [56 a 0..0.6][hanging 28 t 0.6005..1.0005], a 0.4 x 0.28 draft -> left:a (x -0.2005, y 0.28),
 *   right:t (x 1.201, y 0.28), bottom:t (x 0.8005, y 0), park:t; a 0.6 x 0.56 draft -> left:a and right:t at y 0,
 *   bottom:t unavailable, park:t.
 */ function planColumnSlots(rows, boxes, { relativeBox, neighbours, pivotZOf }) {
    const draftHeightM = relativeBox.maxM.y;
    const { levelM } = DEFAULT_ROW_TOLERANCES;
    // The pivot Z the row's cabinets stand on (the first member's); row.zM only as a fallback for a row without one.
    const zM = (row)=>{
        const [first] = cabinetsOfRow(row);
        return pivotZOf?.get(first) ?? row.zM;
    };
    const endLevelM = (row)=>isLowerThanTier(draftHeightM, row) ? row.topM - draftHeightM : row.bottomM;
    const slots = [];
    let rightmost = null;
    for (const row of rows){
        // An empty row has no ends.
        if (!row?.places?.length) continue;
        const shared = {
            rowId: row.id,
            relativeBox,
            neighbours,
            rowCabinetIds: cabinetsOfRow(row)
        };
        // 1. Row ends.
        const firstPlace = row.places[0];
        const first = columnPlaceSpan(firstPlace, boxes);
        if (first) {
            slots.push(makeSlot({
                ...shared,
                kind: 'left',
                anchorCabinetId: cabinetsOfPlace(firstPlace)[0],
                positionM: {
                    x: first.leftM - SLOT_GAP_M - relativeBox.maxM.x,
                    y: endLevelM(row),
                    z: zM(row)
                }
            }));
        }
        const lastPlace = row.places.at(-1);
        const last = columnPlaceSpan(lastPlace, boxes);
        if (last) {
            const anchorCabinetId = cabinetsOfPlace(lastPlace)[0];
            slots.push(makeSlot({
                ...shared,
                kind: 'right',
                anchorCabinetId,
                positionM: {
                    x: last.rightM + SLOT_GAP_M - relativeBox.minM.x,
                    y: endLevelM(row),
                    z: zM(row)
                }
            }));
            if (!rightmost || last.rightM > rightmost.rightM) rightmost = {
                row,
                rightM: last.rightM,
                anchorCabinetId
            };
        }
        // 2-3. Half columns: a lone bottom gets 'top', a lone top gets 'bottom'. A draft too tall for it still gets the
        //      slot, unavailable: the scene shows that "+" whatever is added, and its click must find an option to refuse.
        for (const place of row.places){
            const loneBottom = isColumn(place) && place.top == null && place.bottom != null;
            const loneTop = isColumn(place) && place.bottom == null && place.top != null;
            const span = columnPlaceSpan(place, boxes);
            // A full place, a complete column or an unmeasured one: nothing to complete.
            if (!span || !(loneBottom || loneTop)) continue;
            const x = span.leftM - relativeBox.minM.x;
            if (loneBottom) {
                const bottomTopM = boxes.get(place.bottom).maxM.y;
                const fitsUnderPlane = bottomTopM + draftHeightM <= row.topM + levelM;
                slots.push(makeSlot({
                    ...shared,
                    kind: 'top',
                    anchorCabinetId: place.bottom,
                    fits: fitsUnderPlane,
                    positionM: {
                        x,
                        y: bottomTopM,
                        z: zM(row)
                    }
                }));
            } else {
                const fitsUnderTop = draftHeightM <= boxes.get(place.top).minM.y - row.bottomM + levelM;
                slots.push(makeSlot({
                    ...shared,
                    kind: 'bottom',
                    anchorCabinetId: place.top,
                    fits: fitsUnderTop,
                    positionM: {
                        x,
                        y: row.bottomM,
                        z: zM(row)
                    }
                }));
            }
        }
    }
    // 4. Park.
    if (!rightmost) return [
        ...slots,
        parkAtOrigin(relativeBox, neighbours)
    ];
    const { row, rightM, anchorCabinetId } = rightmost;
    return [
        ...slots,
        makeSlot({
            kind: 'park',
            rowId: null,
            anchorCabinetId,
            relativeBox,
            neighbours,
            positionM: {
                x: rightM + PARK_GAP_M - relativeBox.minM.x,
                y: endLevelM(row),
                z: zM(row)
            }
        })
    ];
}
/** Default slot for a new cabinet (see contract in module doc). */ function pickDefaultSlot(slots, { preferCabinetId = null } = {}) {
    const list = Array.isArray(slots) ? slots.filter(Boolean) : [];
    if (!list.length) return null;
    const available = list.filter((s)=>s.availability === 'available' && s.kind !== 'park');
    if (preferCabinetId != null) {
        const preferredRowIds = new Set(list.filter((s)=>s.kind !== 'park' && (s.anchorCabinetId === preferCabinetId || (s.rowCabinetIds || []).includes(preferCabinetId))).map((s)=>s.rowId));
        const inRow = (kind)=>available.find((s)=>s.kind === kind && preferredRowIds.has(s.rowId));
        const preferred = inRow('right') || inRow('left');
        if (preferred) return preferred;
    }
    const rights = available.filter((s)=>s.kind === 'right');
    if (rights.length) return rights.reduce((best, s)=>s.positionM.x > best.positionM.x ? s : best);
    const left = available.find((s)=>s.kind === 'left');
    if (left) return left;
    return list.find((s)=>s.kind === 'park') || null;
}

export { PARK_GAP_M, SLOT_DOES_NOT_FIT_REASON, SLOT_GAP_M, groupCabinetRows, pickDefaultSlot, planPlacementSlots };
