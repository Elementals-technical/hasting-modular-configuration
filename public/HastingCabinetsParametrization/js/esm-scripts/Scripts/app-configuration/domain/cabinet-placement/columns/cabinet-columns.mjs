import { CABINET_LAYOUT_GAP_METERS } from '../../composition/layout-constants.mjs';
import { DEFAULT_ROW_TOLERANCES } from '../cabinet-rows.mjs';

/**
 * Column rows — the "columns" layout behaviour (Urban Duplex first, Andriy 13.10). Pure: no PlayCanvas,
 * metres, world X is the row axis. Each function returns a new row; the input row is never changed.
 *
 * A column row is ONE tier between the floor and the countertop plane. In that tier a place holds either
 * one cabinet standing on the floor, or a COLUMN of two lower cabinets (28 over 28 next to a 56):
 *
 *   topM    ─────────────────────────────────  countertop plane: every top of the row is here
 *           [  56  ][ top 28    ][  56  ]
 *           [      ][ bottom 28 ][      ]
 *   bottomM ─────────────────────────────────  floor
 *
 *   Row   = { id, leftM, bottomM, topM, zM, places }    places left -> right
 *   Place = { full: id }                                one cabinet on the floor (e.g. the 56)
 *         | { top: id | null, bottom: id | null, bottomOffsetM? }
 *                                                       a column: `top` hangs from the plane, `bottom` stands on the floor
 *
 * bottomOffsetM (m) = left edge of the bottom − left edge of the top, any sign; no field = 0 (aligned).
 * Only a drag & drop makes a shifted column: the cabinet stays where it was released. The maker builds such
 * columns, e.g. a top SB 70 at x 0..0.70 over a bottom SC 70 at x 0.45..1.15 (25 cm overlap):
 *
 *           [ top SB 70        ]
 *                    [ bottom SC 70     ][ next place ]      bottomOffsetM 0.45
 *
 * The "+" fills a column aligned; a preset only replays what was stored. A column with one cabinet is never
 * shifted: its stored form has no bottomOffsetM (columnPlace).
 *
 * A column is not a second tier: the placement kernel counts a place once (HR-PL-02).
 * Who uses it: a modular collection with `columns: true` (modular-collections.mjs) — its layout policy
 * (adapters/cabinet-columns-layout.mjs), the local runtime's document rows and drag snap (column-snap.mjs), the "+"
 * planners (column-plus-anchors.mjs, placement-slots.mjs) and the compact presets (compact-preset.mjs).
 * Sizes: id -> { widthM, heightM, pivotFromLeftM? } — the cabinet pivot is at its bottom; pivotFromLeftM defaults to widthM / 2.
 */ /** localLayouts.policyId of a column row (portable presets keep the policy id, not the places). */ const CABINET_COLUMNS_POLICY_ID = 'cabinet-columns-v1';
/** A column offset is kept to a micrometre; anything smaller is float noise of world boxes, i.e. no offset. */ const MICROMETRES_PER_METRE = 1e6;
const CENTIMETRES_PER_METRE = 100;
/** The two slots of a column, the top first (the order of cabinetsOfPlace). */ const COLUMN_SLOTS = Object.freeze([
    'top',
    'bottom'
]);
/** A column place names its slots ({ top, bottom }, either may be null); a full place has `full`. */ const isColumn = (place)=>Object.hasOwn(place, 'top') || Object.hasOwn(place, 'bottom');
/**
 * R1 (Andriy 13.10): is a cabinet of this height lower than the row's tier? Such a cabinet hangs from the plane
 * (a column `top`) wherever it is added; one as tall as the tier stands on the floor. levelM: the row tolerance,
 * so a 55.8 cm cabinet in a 56 tier is a full one. Example: tier 0..0.56 -> 0.28 true, 0.56 false.
 */ function isLowerThanTier(heightM, row, levelM = DEFAULT_ROW_TOLERANCES.levelM) {
    return heightM < row.topM - row.bottomM - levelM;
}
/**
 * The place a new cabinet takes beside the row (R1): a lower one hangs as the top of a column with a free bottom,
 * a tier-tall one fills the place. Example: tier 0..0.56, 'x' 0.28 high -> { top: 'x', bottom: null }; 0.56 -> { full: 'x' }.
 */ function placeForHeight(row, id, heightM, levelM = DEFAULT_ROW_TOLERANCES.levelM) {
    if (isLowerThanTier(heightM, row, levelM)) return {
        top: id,
        bottom: null
    };
    return {
        full: id
    };
}
/** Cabinet ids of a place, the top one first. { full: 'a' } -> ['a']; { top: 'b', bottom: null } -> ['b']. */ function cabinetsOfPlace(place) {
    if (!isColumn(place)) return [
        place.full
    ];
    return COLUMN_SLOTS.map((slot)=>place[slot]).filter((id)=>id != null);
}
/** Every cabinet id of the row, left to right, the top of a column before its bottom. */ const cabinetsOfRow = (row)=>row.places.flatMap(cabinetsOfPlace);
/**
 * The shift of a column's bottom from its top (m): the place's bottomOffsetM when the column holds both
 * cabinets, else 0. A full place and a column with one cabinet are never shifted.
 */ function bottomOffsetOf(place) {
    if (!isColumn(place)) return 0;
    const bothCabinets = place.top != null && place.bottom != null;
    // One cabinet: nothing to be shifted against.
    if (!bothCabinets) return 0;
    return place.bottomOffsetM ?? 0;
}
/**
 * How far each slot's cabinet starts right of the place's left edge (m). The place's left edge is its
 * left-most cabinet, so at least one of the two shifts is 0.
 * Example: bottomOffsetM 0.45 -> { full: 0, top: 0, bottom: 0.45 }; bottomOffsetM -0.2 -> { full: 0, top: 0.2, bottom: 0 }.
 */ function slotShiftsOf(place) {
    const bottomOffsetM = bottomOffsetOf(place);
    return {
        full: 0,
        top: Math.max(0, -bottomOffsetM),
        bottom: Math.max(0, bottomOffsetM)
    };
}
/** An offset rounded to a micrometre; a smaller one (and -0) is 0. */ function roundOffset(offsetM) {
    const roundedM = Math.round(offsetM * MICROMETRES_PER_METRE) / MICROMETRES_PER_METRE;
    if (roundedM === 0) return 0;
    return roundedM;
}
/**
 * A column place in its stored form: both slots named; bottomOffsetM only when the column holds two
 * cabinets AND is really shifted. An aligned column has no field (no field = 0), so places stored before
 * shifted columns existed still compare equal.
 * Example: { top: 'a', bottom: 'b', bottomOffsetM: 0 } -> { top: 'a', bottom: 'b' };
 *          { bottom: 'b', bottomOffsetM: 0.3 } -> { top: null, bottom: 'b' } (one cabinet is never shifted).
 */ function columnPlace({ top, bottom, bottomOffsetM }) {
    const place = {
        top: top ?? null,
        bottom: bottom ?? null
    };
    const bothCabinets = place.top !== null && place.bottom !== null;
    const offsetM = roundOffset(bottomOffsetM ?? 0);
    if (bothCabinets && offsetM !== 0) place.bottomOffsetM = offsetM;
    return place;
}
/**
 * Where each cabinet of the row stands: Map id -> { pivotXM, pivotYM, zM }.
 * 1. Places go left -> right from row.leftM with gapM between them.
 * 2. Inside a place a cabinet starts at the place's left edge plus its slot shift (slotShiftsOf): both cabinets
 *    of an aligned column start at the edge; in a shifted column the left-most one does.
 * 3. A place is as wide as its right-most cabinet edge (shift + width).
 * 4. A full cabinet and a column's bottom stand on the floor (bottomM); a column's top hangs so its top is at topM.
 * Example (gapM 0.0005): row { leftM: 0, bottomM: 0, topM: 0.56, places: [{ full: 'a' }, { top: 'b', bottom: 'c' }] },
 *   all 0.4 wide, b and c 0.28 high -> a { pivotXM: 0.2, pivotYM: 0 }, b { pivotXM: 0.6005, pivotYM: 0.28 }, c { pivotXM: 0.6005, pivotYM: 0 }.
 * Shifted example: places [{ top: 't', bottom: 'b', bottomOffsetM: 0.45 }, { bottom: 's' }], t and b 0.7 wide, s 0.35 wide
 *   -> t pivotXM 0.35, b pivotXM 0.80, the place is 1.15 wide, s pivotXM 1.15 + 0.0005 + 0.175.
 */ function layoutColumnRow(row, sizes, { gapM = CABINET_LAYOUT_GAP_METERS } = {}) {
    const sizeOf = (id)=>{
        const size = sizes instanceof Map ? sizes.get(id) : sizes?.[id];
        if (!(size?.widthM > 0) || !(size?.heightM > 0)) throw new TypeError(`Missing size for cabinet ${id}`);
        return size;
    };
    const positions = new Map();
    let placeLeftM = row.leftM;
    for (const place of row.places){
        const shiftOfSlot = slotShiftsOf(place);
        let placeWidthM = 0;
        for (const id of cabinetsOfPlace(place)){
            const size = sizeOf(id);
            const slot = slotOf(place, id);
            // 2. The cabinet starts at the place's left edge plus its slot shift.
            const cabinetLeftM = placeLeftM + shiftOfSlot[slot];
            const pivotXM = cabinetLeftM + (size.pivotFromLeftM ?? size.widthM / 2);
            // 3. The place reaches the right edge of its right-most cabinet.
            placeWidthM = Math.max(placeWidthM, shiftOfSlot[slot] + size.widthM);
            // 4. Only a column's top hangs from the plane; everything else stands on the floor.
            const pivotYM = slot === 'top' ? row.topM - size.heightM : row.bottomM;
            positions.set(id, {
                pivotXM,
                pivotYM,
                zM: row.zM
            });
        }
        // 1. The next place starts after this one and the gap.
        placeLeftM += placeWidthM + gapM;
    }
    return positions;
}
/** The slot of the place that holds the cabinet: 'full' | 'top' | 'bottom', or null when the place does not have it. */ function slotOf(place, id) {
    if (!isColumn(place)) return place.full === id ? 'full' : null;
    return COLUMN_SLOTS.find((slot)=>place[slot] === id) ?? null;
}
/**
 * Box of a cabinet from its pivot (bottom centre) and its config in centimetres; Z is centred on the pivot.
 * Example: positionM { x: 0.3, y: 0, z: 0 }, { Width: 60, Height: 56, Depth: 46 }
 *   -> { minM: { x: 0, y: 0, z: -0.23 }, maxM: { x: 0.6, y: 0.56, z: 0.23 } }
 * null when a size or the position is missing.
 */ function boxFromPivot(positionM, { Width, Height, Depth = 0 } = {}) {
    const widthM = Number(Width) / CENTIMETRES_PER_METRE, heightM = Number(Height) / CENTIMETRES_PER_METRE;
    const depthM = (Number(Depth) || 0) / CENTIMETRES_PER_METRE;
    const knownPosition = [
        'x',
        'y',
        'z'
    ].every((axis)=>Number.isFinite(positionM?.[axis]));
    // Unknown size or position: the cabinet has no box to place it by.
    if (!(widthM > 0) || !(heightM > 0) || !knownPosition) return null;
    return {
        minM: {
            x: positionM.x - widthM / 2,
            y: positionM.y,
            z: positionM.z - depthM / 2
        },
        maxM: {
            x: positionM.x + widthM / 2,
            y: positionM.y + heightM,
            z: positionM.z + depthM / 2
        }
    };
}
/** Where a cabinet is: { row, placeIndex, slot: 'full' | 'top' | 'bottom' }, or null when no row has it. */ function findCabinetPlace(rows, id) {
    for (const row of rows){
        for (const [placeIndex, place] of row.places.entries()){
            const slot = slotOf(place, id);
            if (slot) return {
                row,
                placeIndex,
                slot
            };
        }
    }
    return null;
}
/**
 * A new place at `index` (0 = left end, places.length = right end).
 * place: { full: id } for a cabinet on the floor, { top: id } for a hanging one, { bottom: id } for a low one on the floor.
 * A column is stored in its canonical form (columnPlace): a bottomOffsetM survives only with both cabinets.
 */ function insertPlace(row, index, place) {
    const normalized = isColumn(place) ? columnPlace(place) : {
        full: place.full
    };
    if (cabinetsOfPlace(normalized).length === 0) throw new TypeError('A place needs a cabinet');
    const at = Math.min(Math.max(index, 0), row.places.length);
    return {
        ...row,
        places: [
            ...row.places.slice(0, at),
            normalized,
            ...row.places.slice(at)
        ]
    };
}
/**
 * Puts a cabinet into the free slot ('top' or 'bottom') of the column at placeIndex; the completed column is aligned
 * (the "+"). A shifted column comes only from a drag & drop, read back from the boxes (columnRowFromBoxes).
 * Throws when the place is not a column or the slot is taken: a column holds one top and one bottom.
 */ function addToColumn(row, placeIndex, slot, id) {
    const place = row.places[placeIndex];
    if (!place || !isColumn(place)) throw new TypeError(`Place ${placeIndex} is not a column`);
    if (!COLUMN_SLOTS.includes(slot)) throw new TypeError(`Unknown column slot ${slot}`);
    if (place[slot] != null) throw new TypeError(`Column slot ${slot} is taken`);
    const places = [
        ...row.places
    ];
    places[placeIndex] = columnPlace({
        top: place.top,
        bottom: place.bottom,
        [slot]: id
    });
    return {
        ...row,
        places
    };
}
/**
 * The free column slot a legacy add ("+" click -> setProductByParams(type, anchorId, side, config)) asks for:
 * side 'top' = over the anchor (a lone bottom), side 'bottom' = under the anchor (a hanging top).
 * -> { placeIndex, slot } or null (another side, the anchor is not in this row, its place is full or not a column).
 * Example: row [{ full:'a' }, { top:null, bottom:'c' }], anchor 'c', side 'top' -> { placeIndex: 1, slot: 'top' }.
 */ function columnSlotFor(row, anchorId, side) {
    if (side !== 'top' && side !== 'bottom') return null;
    const found = row && anchorId ? findCabinetPlace([
        row
    ], anchorId) : null;
    // The anchor is not in this row, or stands alone in a full place: no column to complete.
    if (!found || found.slot === 'full') return null;
    const place = row.places[found.placeIndex];
    // The slot is already taken (the "+" was stale).
    if (place[side] != null) return null;
    return {
        placeIndex: found.placeIndex,
        slot: side
    };
}
/**
 * The row without the cabinet. A full place disappears; a column keeps its other cabinet and
 * disappears only when it becomes empty. The places to the right close the gap (layoutColumnRow).
 * A cabinet that is not in the row: the row is returned unchanged.
 * 1. A full place, or a column left empty: the place goes.
 * 2. A column left with one cabinet: it is aligned again (one cabinet is never shifted).
 * 3. The remaining cabinet must not jump: in a shifted column it may start right of the place's edge
 *    (remainingShiftM); without its partner it starts AT the edge. In the first place the row's left edge
 *    moves right by that shift, so the cabinet keeps its X and the places to its right keep theirs.
 *    In a later place the row has no per-place edge to move: the remaining cabinet closes that gap like
 *    every removal does (open: keeping it still there needs a per-place left edge in the Row shape).
 * Example: [{ top: 't', bottom: 'b', bottomOffsetM: 0.45 }, …] at leftM 0, remove 't'
 *   -> leftM 0.45, places [{ top: null, bottom: 'b' }, …]; b stays at x 0.45..1.15.
 */ function removeCabinet(row, id) {
    const found = findCabinetPlace([
        row
    ], id);
    // Not in this row: nothing to remove.
    if (!found) return row;
    const { placeIndex, slot } = found;
    const place = row.places[placeIndex];
    const remainingSlot = slot === 'top' ? 'bottom' : 'top';
    const remainingId = slot === 'full' ? null : place[remainingSlot];
    // 1. Nothing left in the place: it goes, the places to the right close the gap.
    if (remainingId == null) return {
        ...row,
        places: row.places.filter((_, index)=>index !== placeIndex)
    };
    // 2. The column keeps the other cabinet, aligned.
    const places = [
        ...row.places
    ];
    places[placeIndex] = columnPlace({
        ...place,
        [slot]: null,
        bottomOffsetM: 0
    });
    // 3. The remaining cabinet keeps its X: in the first place the row edge takes over its shift.
    const remainingShiftM = slotShiftsOf(place)[remainingSlot];
    const isFirstPlace = placeIndex === 0;
    if (isFirstPlace && remainingShiftM > 0) return {
        ...row,
        leftM: row.leftM + remainingShiftM,
        places
    };
    return {
        ...row,
        places
    };
}
/**
 * A column row read back from world boxes — for a composition that stores no places (an older
 * scene, or a portable preset, which keeps only the cabinet order). boxes: id -> { minM, maxM } with
 * minM.y = the cabinet's level (its pivot Y). Returns { id, leftM, bottomM, topM, zM, places }.
 * 1. The row stands on floorM when it is given, else on its lowest level; its plane is its highest top.
 * 2. Cabinets whose X spans overlap share one place, left -> right (a shifted pair still overlaps: one place).
 * 3. In a place: the cabinet on the row level is `bottom` (or `full` when it reaches the plane), the one above it is `top`.
 * 4. A column with two cabinets keeps its shift: bottomOffsetM = bottom left edge − top left edge (no field when 0).
 * Example: a 56 at x 0..0.6 and two 28 at x 0.6..1.0 (levels 0 and 0.28) -> places [{ full }, { top, bottom }].
 * Shifted example: a top 70 at x 0..0.70 (level 0.28) and a bottom 70 at x 0.45..1.15 (level 0)
 *   -> places [{ top, bottom, bottomOffsetM: 0.45 }], leftM 0.
 * Throws on a place that is not a column: more than two cabinets, or two whose X spans overlap while the upper one
 *   does not stand on the lower one on the row level (callers then read one row per cabinet).
 * tierHeightM (m): the collection's tier height; the plane is then bottom + tierHeightM (a lone 28 beside nothing is still a column).
 * floorM (m): the floor of the row. Without it a lone HANGING 28 (level 0.28, nothing under it) would be read as
 *   standing on a floor at 0.28; with it the cabinet is above the floor, i.e. a `top`.
 * Floor example: a 28 at y 0.28..0.56, { floorM: 0, tierHeightM: 0.56 } -> bottomM 0, topM 0.56,
 *   places [{ top: id, bottom: null }]; without floorM -> bottomM 0.28 and places [{ top: null, bottom: id }].
 */ function columnRowFromBoxes(id, boxes, { levelM = DEFAULT_ROW_TOLERANCES.levelM, tierHeightM = null, floorM = null } = {}) {
    const entries = boxes instanceof Map ? [
        ...boxes
    ] : Object.entries(boxes ?? {});
    if (!entries.length) throw new TypeError('A column row needs at least one cabinet');
    // 1. Row level and plane. The given floor wins over the lowest member (a lone hanging cabinet is not on
    //    the floor). With the collection's tier height the plane is fixed (bottom + tier), so a lone low
    //    cabinet is a column with a free slot; without it the plane is the highest member (fallback).
    const lowestLevelM = Math.min(...entries.map(([, box])=>box.minM.y));
    const floorGiven = Number.isFinite(floorM);
    const bottomM = floorGiven ? floorM : lowestLevelM;
    const highestTopM = Math.max(...entries.map(([, box])=>box.maxM.y));
    const topM = tierHeightM > 0 ? bottomM + tierHeightM : highestTopM;
    const zM = entries.reduce((sum, [, box])=>sum + (box.minM.z + box.maxM.z) / 2, 0) / entries.length;
    // 2. Places: overlapping X spans, left -> right. Spans that only touch (within the row contact) are two places.
    const { contactM } = DEFAULT_ROW_TOLERANCES;
    const byLeft = [
        ...entries
    ].sort(([, a], [, b])=>a.minM.x - b.minM.x);
    const groups = [];
    for (const [cabinetId, box] of byLeft){
        const last = groups.at(-1);
        const overlapsLast = last && box.minM.x < last.rightM - contactM;
        if (overlapsLast) {
            last.members.push([
                cabinetId,
                box
            ]);
            last.rightM = Math.max(last.rightM, box.maxM.x);
        } else groups.push({
            members: [
                [
                    cabinetId,
                    box
                ]
            ],
            rightM: box.maxM.x
        });
    }
    // 3. Slots inside a place.
    const onRowLevel = (box)=>Math.abs(box.minM.y - bottomM) <= levelM;
    const reachesPlane = (box)=>Math.abs(box.maxM.y - topM) <= levelM;
    const places = groups.map((group)=>{
        const memberIds = ()=>group.members.map(([cabinetId])=>cabinetId).join(', ');
        const [lower, upper, extra] = group.members.sort(([, a], [, b])=>a.minM.y - b.minM.y);
        if (extra) throw new TypeError(`More than two cabinets in one place: ${memberIds()}`);
        // 4. Two cabinets: a column with the shift it stands with.
        if (upper) {
            const [lowerId, lowerBox] = lower;
            const [upperId, upperBox] = upper;
            const standsOnLower = Math.abs(upperBox.minM.y - lowerBox.maxM.y) <= levelM;
            // Overlapping in X without one standing on the other on the floor (a 56 beside a hanging 28 a few cm
            // into it, two 28 side by side on the floor): not a column, two cabinets in one place.
            if (!standsOnLower || !onRowLevel(lowerBox)) throw new TypeError(`Not a column: ${memberIds()}`);
            return columnPlace({
                top: upperId,
                bottom: lowerId,
                bottomOffsetM: lowerBox.minM.x - upperBox.minM.x
            });
        }
        const [cabinetId, box] = lower;
        if (onRowLevel(box) && reachesPlane(box)) return {
            full: cabinetId
        };
        return onRowLevel(box) ? {
            top: null,
            bottom: cabinetId
        } : {
            top: cabinetId,
            bottom: null
        };
    });
    return {
        id,
        leftM: byLeft[0][1].minM.x,
        bottomM,
        topM,
        zM,
        places
    };
}

export { CABINET_COLUMNS_POLICY_ID, COLUMN_SLOTS, addToColumn, bottomOffsetOf, boxFromPivot, cabinetsOfPlace, cabinetsOfRow, columnPlace, columnRowFromBoxes, columnSlotFor, findCabinetPlace, insertPlace, isColumn, isLowerThanTier, layoutColumnRow, placeForHeight, removeCabinet };
