import { CABINET_LAYOUT_GAP_METERS } from '../../composition/layout-constants.mjs';
import { DEFAULT_ROW_TOLERANCES } from '../cabinet-rows.mjs';
import { cabinetsOfRow, isLowerThanTier, cabinetsOfPlace } from './cabinet-columns.mjs';
import { mergeConnectPoints, edgePoints, alignments, overlapsInY, BODY_NODE, nearestAlignment, connectPointsOf } from './connect-points.mjs';

/** Snap distance for a drop into a column (Andriy 13.10): closer than this the cabinet lands exactly there. */ const COLUMN_SNAP_M = 0.03;
/** A top must rest on at least 10 cm of its bottom (and a bottom carry 10 cm of its top) to stay shifted where it was dropped. */ const MIN_OVERLAP_M = 0.10;
/**
 * A face pose closer than this (5 mm) to the centred pose is the centred pose: a measured face a hair off it leaves no shift.
 * Why 5 mm here and 1 mm for SAME_FACE_M (connect-points.mjs): a row-end face 3 mm out still collides, so it must stay a
 * face of its own; a stacked cabinet does not touch its support sideways, so 3 mm off centred is only a measuring error.
 */ const SAME_POSE_M = 0.005;
/** On equal distance the smaller rank wins: a column slot before a row end. */ const TARGET_RANK = {
    top: 0,
    bottom: 0,
    'row-end-top': 1,
    'row-end-bottom': 1,
    floor: 2
};
/**
 * Where a dragged cabinet snaps in the column rows: { positionM, kind }, or null when it stays where the pointer put it.
 * The runtime moves the draft to positionM; kind names the target (diagnostics, tests).
 * 1. Candidate targets: the free slots of the columns (aligned or shifted, slotPivotX), both ends of every row (checked for fit).
 * 2. The nearest target within snapM wins; on equal distance a column slot wins over a row end.
 * 3. Nothing near: the floor under the cabinet, when the floor is within snapM.
 * The snap moves the cabinet in X and Y only; its Z stays as dragged.
 *
 * Example: a 56 at x 0..0.6 and a bottom 28 at x 0.6005..1.0005 (row topM 0.56). A 0.4 × 0.28 cabinet
 * dropped with its pivot at (0.82, 0.30) is 2.8 cm from the free top -> { positionM: { x: 0.8005, y: 0.28, z }, kind: 'top' }.
 * Shifted example: a bottom 70 at x 0.45..1.15. A 0.7 × 0.28 cabinet dropped with its pivot at (0.40, 0.30) rests on
 *   30 cm of it -> { positionM: { x: 0.40, y: 0.28, z }, kind: 'top' }.
 * Panel example: the 56 carries a lateral panel at x 0.60..0.65, y 0.28..0.56 and nothing stands right of it.
 *   The 0.4 × 0.28 cabinet dropped at (0.86, 0.29) meets the panel's end: its left face at 0.65 + 0.0005 ->
 *   { positionM: { x: 0.8505, y: 0.28, z }, kind: 'row-end-top' }.
 *
 * @param {{ relativeBox:{minM,maxM}, relativeConnectPoints?:Array, positionM:{x,y,z} }} draft  the cabinet box relative
 *   to its pivot, the faces of its own panels relative to its pivot (connect-points.mjs), and the raw pivot
 * @param {Row[]} rows  column rows (cabinet-columns.mjs)
 * @param {Map|Object} boxes  id -> world box of every cabinet of the rows
 * @param {{ floorM:number, snapM?:number, levelM?:number, gapM?:number }} options  levelM: a cabinet up to this much
 *   taller than the free space still fits (the row tolerance); gapM: between a row end and the cabinet put next to it
 * @returns {{ positionM:{x,y,z}, kind:'top'|'bottom'|'row-end-top'|'row-end-bottom'|'floor' } | null}
 */ function snapDraftIntoColumn(draft, rows, boxes, options) {
    const { floorM, snapM = COLUMN_SNAP_M, levelM = DEFAULT_ROW_TOLERANCES.levelM, gapM = CABINET_LAYOUT_GAP_METERS } = options;
    const relativeBox = draft?.relativeBox;
    const rawPositionM = draft?.positionM;
    // No measured box or no pivot: nothing to snap.
    if (!relativeBox?.minM || !relativeBox?.maxM || !rawPositionM) return null;
    const draftHeightM = relativeBox.maxM.y - relativeBox.minM.y;
    // The draft's faces: its box edges and the faces of its own panels.
    const draftShape = {
        relativeBox,
        points: mergeConnectPoints([
            ...edgePoints(relativeBox),
            ...draft.relativeConnectPoints ?? []
        ])
    };
    // 1. Candidate targets of every row.
    const targets = (rows ?? []).flatMap((row)=>[
            ...columnSlotTargets(row, draftShape, draftHeightM, {
                boxes,
                levelM,
                snapM,
                rawPositionM
            }),
            ...rowEndTargets(row, draftShape, draftHeightM, {
                boxes,
                levelM,
                gapM
            })
        ]);
    // 2. The nearest target within snapM.
    const nearest = nearestTarget(targets, rawPositionM, snapM);
    if (nearest) return resultAt(nearest, rawPositionM);
    // 3. The floor under the cabinet. It is a fallback: it is always at least as close as a column's
    //    free bottom (same Y, no X move), so as a regular candidate it would hide every 'bottom' target.
    const floorTarget = {
        kind: 'floor',
        pivotXM: rawPositionM.x,
        pivotYM: floorM
    };
    if (distanceToTarget(floorTarget, rawPositionM) <= snapM) return resultAt(floorTarget, rawPositionM);
    return null;
}
/**
 * The free slots of the row's columns.
 * 'top': on the bottom cabinet, when the draft stays under the countertop plane.
 * 'bottom': on the row floor, when the draft fits under the hanging top.
 * X of a slot: aligned (centred on the cabinet already there), on a panel face, or shifted (the raw X of the drop) —
 * see slotPivotX.
 */ function columnSlotTargets(row, draftShape, draftHeightM, { boxes, levelM, snapM, rawPositionM }) {
    const targets = [];
    for (const place of row.places){
        const freeTop = place.top === null && place.bottom != null;
        const freeBottom = place.bottom === null && place.top != null;
        if (freeTop) {
            const bottomBox = boxOfCabinet(boxes, place.bottom);
            const pivotYM = bottomBox.maxM.y;
            const fitsUnderPlane = pivotYM + draftHeightM <= row.topM + levelM;
            if (fitsUnderPlane) {
                const pivotXM = slotPivotX(bottomBox, draftShape, {
                    rawPositionM,
                    snapM
                });
                targets.push({
                    kind: 'top',
                    pivotXM,
                    pivotYM
                });
            }
        }
        if (freeBottom) {
            const topBox = boxOfCabinet(boxes, place.top);
            const fitsUnderTop = draftHeightM <= topBox.minM.y - row.bottomM + levelM;
            if (fitsUnderTop) {
                const pivotXM = slotPivotX(topBox, draftShape, {
                    rawPositionM,
                    snapM
                });
                targets.push({
                    kind: 'bottom',
                    pivotXM,
                    pivotYM: row.bottomM
                });
            }
        }
    }
    return targets;
}
/**
 * Pivot X of a draft going into a column slot over or under `supportBox` (the cabinet already in the column).
 * 1. A near pose first: of the aligned pose (draft centred on supportBox — the "+" look) and the face pose (facePose:
 *    a draft face on a support face, e.g. under a panel face), the one nearer to the raw X lands when it is within
 *    snapM; on an equal miss the aligned pose wins. A hand that misses the aligned pose by a centimetre does not
 *    leave a 1 cm shift (keeps the old drops).
 * 2. Shifted: else, when the dropped draft overlaps supportBox in X by at least MIN_OVERLAP_M, it keeps its raw X.
 *    The target then moves the draft in Y only, so its distance (distanceToTarget) is the Y distance alone.
 * 3. Else aligned: the draft does not rest on the column; that target is usually too far to snap.
 * Example: supportBox x 0.45..1.15, a 0.7 wide draft dropped 2 cm above the slot with its pivot at x 0.40
 *   (box 0.05..0.75, 30 cm on the support) -> 0.40 (shifted); at x 0.15 (box -0.20..0.50, 5 cm on it) -> 0.80 (aligned).
 * Face example: supportBox x 0.6005..1.0005 with a panel at x 0.75..0.90, a 0.4 wide draft dropped at x 0.96:
 *   aligned 0.8005 misses by 15.95 cm, its left face under the panel's left face (0.75 + 0.2) by 1 cm -> 0.95.
 */ function slotPivotX(supportBox, draftShape, { rawPositionM, snapM }) {
    const { relativeBox } = draftShape;
    const alignedPivotXM = centredPivotX(supportBox, relativeBox);
    // 1. Near a pose in X. Only X counts here — Y is checked by nearestTarget — so the 3 cm window does not
    //    shrink with the Y miss (a 2 cm X miss is a hand miss, never a wanted shift).
    const alignedMissM = Math.abs(alignedPivotXM - rawPositionM.x);
    const nearFace = facePose(supportBox, draftShape, {
        rawPivotXM: rawPositionM.x,
        alignedPivotXM
    });
    const faceMissM = nearFace ? Math.abs(nearFace.pivotXM - rawPositionM.x) : Infinity;
    // Strict `<`: on an exact tie the aligned pose wins.
    const faceIsNearer = faceMissM < alignedMissM;
    if (faceIsNearer && faceMissM <= snapM) return nearFace.pivotXM;
    if (alignedMissM <= snapM) return alignedPivotXM;
    // 2. Resting on enough of the support: the draft stays where it was released (shifted = the raw X).
    if (overlapInX(supportBox, relativeBox, rawPositionM.x) >= MIN_OVERLAP_M) return rawPositionM.x;
    // 3. Not on the column: the aligned X.
    return alignedPivotXM;
}
/**
 * The face pose nearest to the raw X in a column: a draft face on a support face, any two sides (stacked cabinets
 * do not touch sideways, so a left face may sit under a right face). A pair counts when
 *   - at least one of the two faces is a panel: a box edge on a box edge is the aligned / shifted logic of plain
 *     boxes, so without panels the targets stay those of today;
 *   - the draft still rests on MIN_OVERLAP_M of the support, as a shifted drop must;
 *   - the pose is more than SAME_POSE_M from the aligned pose: a panel face a few millimetres off the centred pose
 *     must not leave a few-millimetre shift (the aligned pose takes that drop).
 * Example: support panel left face 0.75, draft left face −0.2 -> pivotXM 0.95 (draft 0.75..1.15, 25 cm on 0.6005..1.0005).
 * null when no pair counts.
 */ function facePose(supportBox, draftShape, { rawPivotXM, alignedPivotXM }) {
    const { relativeBox, points } = draftShape;
    const hasPanel = (draft, target)=>draft.node !== BODY_NODE || target.node !== BODY_NODE;
    const restsOnSupport = (pivotXM)=>overlapInX(supportBox, relativeBox, pivotXM) >= MIN_OVERLAP_M;
    const offAligned = (pivotXM)=>Math.abs(pivotXM - alignedPivotXM) > SAME_POSE_M;
    const pair = (draft, target, pivotXM)=>hasPanel(draft, target) && restsOnSupport(pivotXM) && offAligned(pivotXM);
    return nearestAlignment(points, connectPointsOf(supportBox), {
        rawPivotXM,
        pair
    });
}
/** How much of supportBox (m, in X) the draft covers with its pivot at pivotXM; negative when they are apart. */ function overlapInX(supportBox, relativeBox, pivotXM) {
    const draftLeftM = pivotXM + relativeBox.minM.x;
    const draftRightM = pivotXM + relativeBox.maxM.x;
    return Math.min(draftRightM, supportBox.maxM.x) - Math.max(draftLeftM, supportBox.minM.x);
}
/**
 * Both ends of the row, the draft gapM away from an end face, on two levels:
 *   'row-end-bottom'  standing on the row floor — every draft: a 56 put beside the row sticks to its end, and so does
 *                     a 28 put on the floor beside a hanging 28 (a bottom with no top over it yet, Andriy 13.10);
 *   'row-end-top'     hanging from the countertop plane — only a draft lower than the row (R1); one as high as the row
 *                     would hang on the floor, which is the 'row-end-bottom' pose.
 * Each face of the end (endFaces) pairs with each inward face of the draft (left end: the draft's right faces) when
 * the two overlap in Y at the target pose — a panel on the lower half of a 56 does not catch a cabinet hanging at
 * the plane. Every pair is one target; nearestTarget picks the nearest.
 * Example: a 56 at x 0..0.6 with a lateral panel at x 0.60..0.65, y 0.28..0.56, a 0.4 × 0.28 draft (left face −0.2)
 *   -> right-end targets at y 0.28 and pivot x 0.8005 (0.6 + 0.0005 + 0.2) and 0.8505 (on the panel: 0.65 + 0.0005 + 0.2).
 * Without panels each end has one pair, the row edge with the draft's box edge: the targets of plain boxes.
 */ function rowEndTargets(row, draftShape, draftHeightM, { boxes, levelM, gapM }) {
    const rowBoxes = cabinetsOfRow(row).map((id)=>boxOfCabinet(boxes, id));
    // An empty row has no ends.
    if (rowBoxes.length === 0) return [];
    const hangs = isLowerThanTier(draftHeightM, row, levelM);
    const levels = [
        {
            kind: 'row-end-bottom',
            pivotYM: row.bottomM
        }
    ];
    if (hangs) levels.unshift({
        kind: 'row-end-top',
        pivotYM: row.topM - draftHeightM
    });
    const ends = [
        {
            place: row.places[0],
            outward: 'left',
            inward: 'right',
            edgeM: Math.min(...rowBoxes.map((box)=>box.minM.x)),
            signedGapM: -gapM
        },
        {
            place: row.places.at(-1),
            outward: 'right',
            inward: 'left',
            edgeM: Math.max(...rowBoxes.map((box)=>box.maxM.x)),
            signedGapM: gapM
        }
    ];
    return levels.flatMap(({ kind, pivotYM })=>ends.flatMap((end)=>{
            const touchesInY = (draft, target)=>overlapsInY(draft, target, pivotYM, levelM);
            const draftFaces = draftShape.points.filter((point)=>point.side === end.inward);
            return alignments(draftFaces, endFaces(row, boxes, end), {
                gapM: end.signedGapM,
                pair: touchesInY
            }).map(({ pivotXM })=>({
                    kind,
                    pivotXM,
                    pivotYM
                }));
        }));
}
/**
 * The outward faces of a row end: the row edge, which spans the whole tier (a new place starts next to the end place
 * at any height: a cabinet hangs right of a lone bottom 28 too), then the outward panel faces of the end place's
 * cabinets. A panel face at the row edge is the row edge.
 * Example: right end, a 56 at x 0..0.6 with a lateral panel at x 0.60..0.65, y 0.28..0.56, tier 0..0.56 ->
 *   [right 0.6 (y 0..0.56), right 0.65 (y 0.28..0.56)].
 */ function endFaces(row, boxes, { place, outward, edgeM }) {
    const rowEdge = {
        xM: edgeM,
        side: outward,
        node: BODY_NODE,
        yMinM: row.bottomM,
        yMaxM: row.topM
    };
    const panelFaces = cabinetsOfPlace(place).flatMap((id)=>boxOfCabinet(boxes, id).connectPointsM ?? []).filter((point)=>point.side === outward);
    return mergeConnectPoints([
        rowEdge,
        ...panelFaces
    ]);
}
/**
 * The target nearest to the raw pivot within snapM, null when none is close. The targets are ranked first
 * (TARGET_RANK, a stable sort) and only a strictly nearer one replaces the best, so on equal distance the
 * better-ranked target wins: a column slot over a row end.
 */ function nearestTarget(targets, rawPositionM, snapM) {
    const ranked = [
        ...targets
    ].sort((a, b)=>TARGET_RANK[a.kind] - TARGET_RANK[b.kind]);
    let best = null;
    let bestDistanceM = Infinity;
    for (const target of ranked){
        const distanceM = distanceToTarget(target, rawPositionM);
        // Too far to snap, or not nearer than a target of the same or a better rank.
        if (distanceM > snapM || distanceM >= bestDistanceM) continue;
        best = target;
        bestDistanceM = distanceM;
    }
    return best;
}
/**
 * How far the cabinet moves to reach the target, in XY. The box moves with its pivot, so the distance
 * between the lower-left corners of the box (raw pose vs target pose) equals the distance between the pivots.
 * A shifted column slot keeps the raw X, so for it this is the Y distance alone: "within 3 cm" means 3 cm above or below the slot.
 */ function distanceToTarget(target, rawPositionM) {
    return Math.hypot(target.pivotXM - rawPositionM.x, target.pivotYM - rawPositionM.y);
}
/** Pivot X that puts the draft's centre over the centre of the given box. */ function centredPivotX(box, relativeBox) {
    const boxCentreM = (box.minM.x + box.maxM.x) / 2;
    const draftCentreFromPivotM = (relativeBox.minM.x + relativeBox.maxM.x) / 2;
    return boxCentreM - draftCentreFromPivotM;
}
/** The world box of a row cabinet; throws when it is missing (the runtime then leaves the draft unsnapped). */ function boxOfCabinet(boxes, id) {
    const box = boxes instanceof Map ? boxes.get(id) : boxes?.[id];
    if (!box?.minM || !box?.maxM) throw new TypeError(`Missing box for cabinet ${id}`);
    return box;
}
function resultAt({ kind, pivotXM, pivotYM }, rawPositionM) {
    return {
        positionM: {
            x: pivotXM,
            y: pivotYM,
            z: rawPositionM.z
        },
        kind
    };
}

export { COLUMN_SNAP_M, MIN_OVERLAP_M, snapDraftIntoColumn };
