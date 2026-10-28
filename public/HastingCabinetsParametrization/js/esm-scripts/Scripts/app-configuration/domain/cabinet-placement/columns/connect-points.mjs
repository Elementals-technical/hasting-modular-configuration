/**
 * Connect points of a cabinet (Urban Duplex, spec L, Andriy 13.10). Pure: no PlayCanvas, metres, world X is the row axis.
 *
 * A dragged cabinet snaps face to face. Its faces are not only the carcass box: the Duplex handle carries a base
 * panel and a lateral panel (UD_Handle_BaseP_*, UD_Handle_LateralP_*) that the width / height rules stretch with
 * the carcass, and a neighbour must be able to meet the END of such a panel. A connect point is one X face of one
 * node, with the node's Y range (a face only touches what it overlaps in Y):
 *
 *   { xM, side: 'left' | 'right', node, yMinM, yMaxM }
 *
 * xM and the Y range are world metres, or relative to the cabinet pivot (toRelative) for a draft that moves.
 * A box without measured nodes has exactly two points, its edges (node 'body'): every consumer then behaves as
 * with plain boxes.
 */ /** The node name of the faces of a plain box (the cabinet's config box). */ const BODY_NODE = 'body';
/**
 * Kinds of connect points a product can declare per node (registry `connectPoints: [{ node, kind }]`).
 * 'x-faces': the node's left and right X faces with its Y range — the only kind so far (the Duplex panels).
 * A new way to connect (a corner, a Y face, a named point) is a new kind here plus its measurement in
 * adapters/connect-points-adapter.mjs; existing declarations keep working unchanged.
 */ const CONNECT_POINT_KINDS = Object.freeze({
    xFaces: 'x-faces'
});
/** Two faces of the same side closer than this (1 mm) are one face: a measured face that close to a box edge is that edge. */ const SAME_FACE_M = 1e-3;
/**
 * The two X faces of a box. Example: box x 0..0.6, y 0..0.56 ->
 *   [{ xM: 0, side: 'left', node: 'body', yMinM: 0, yMaxM: 0.56 }, { xM: 0.6, side: 'right', node: 'body', yMinM: 0, yMaxM: 0.56 }].
 */ function edgePoints(box, node = BODY_NODE) {
    const yRange = {
        yMinM: box.minM.y,
        yMaxM: box.maxM.y
    };
    return [
        {
            xM: box.minM.x,
            side: 'left',
            node,
            ...yRange
        },
        {
            xM: box.maxM.x,
            side: 'right',
            node,
            ...yRange
        }
    ];
}
/**
 * Every face of a box: its edges plus its measured faces (box.connectPointsM), merged.
 * Example: a 56 at x 0..0.6 with a lateral panel at x 0.60..0.65 -> faces left 0 (body), left 0.60 (panel),
 *   right 0.6 (body), right 0.65 (panel).
 */ function connectPointsOf(box) {
    return mergeConnectPoints([
        ...edgePoints(box),
        ...box.connectPointsM ?? []
    ]);
}
/**
 * Points sorted by X, one per face: a second point of the same side within SAME_FACE_M is dropped (the first wins,
 * so a box edge wins over a measured face beside it). Sorting is stable: equal X keeps the given order.
 * Example: box right edge 0.6 (body), a panel face right at 0.6002 and a panel face left at 0.6 ->
 *   [right 0.6 (body), left 0.6 (panel)]: 0.6002 is the box edge, the left face is another side.
 */ function mergeConnectPoints(points) {
    const faces = [];
    for (const point of points){
        const sameFace = faces.some((face)=>face.side === point.side && Math.abs(face.xM - point.xM) <= SAME_FACE_M);
        if (!sameFace) faces.push(point);
    }
    return faces.sort((a, b)=>a.xM - b.xM);
}
/** World points relative to a pivot. Example: a face at x 1.05, y 0.28..0.56 with the pivot (0.85, 0.28) -> x 0.20, y 0..0.28. */ function toRelative(points, pivotM) {
    return points.map((point)=>({
            ...point,
            xM: point.xM - pivotM.x,
            yMinM: point.yMinM - pivotM.y,
            yMaxM: point.yMaxM - pivotM.y
        }));
}
/**
 * Every pose that puts a draft face on a target face: pivotXM = target.xM + gapM − draft.xM, for each pair that
 * `pair(draft, target, pivotXM)` allows. gapM is signed by the caller (a face put left of the target: −gap).
 * Example: target right face 0.6, draft left face −0.2 (pivot-relative), gapM 0.0005 -> pivotXM 0.8005.
 */ function alignments(draftPoints, targetPoints, { gapM = 0, pair = ()=>true } = {}) {
    const poses = [];
    for (const target of targetPoints){
        for (const draft of draftPoints){
            const pivotXM = target.xM + gapM - draft.xM;
            if (pair(draft, target, pivotXM)) poses.push({
                pivotXM,
                draft,
                target
            });
        }
    }
    return poses;
}
/**
 * The alignment whose pivot is nearest to the raw pivot X (ties: the first in order), or null when no pair is allowed.
 * Example: target faces 0.6005 and 0.75 (left), draft left face −0.2, raw pivot 0.96 -> pivotXM 0.95 (0.75 + 0.2).
 */ function nearestAlignment(draftPoints, targetPoints, { rawPivotXM, gapM = 0, pair = ()=>true }) {
    let nearest = null;
    let nearestMissM = Infinity;
    for (const pose of alignments(draftPoints, targetPoints, {
        gapM,
        pair
    })){
        const missM = Math.abs(pose.pivotXM - rawPivotXM);
        if (missM < nearestMissM) {
            nearest = pose;
            nearestMissM = missM;
        }
    }
    return nearest;
}
/**
 * Whether a draft face (pivot-relative) and a target face (world) overlap in Y by more than toleranceM once the
 * draft stands at pivotYM. Faces that only meet at a level do not touch sideways.
 * Example: a panel at y 0..0.28 and a draft face 0..0.28 hanging at pivotYM 0.28 (y 0.28..0.56) -> false.
 */ function overlapsInY(draftPoint, targetPoint, pivotYM, toleranceM) {
    const overlapM = Math.min(draftPoint.yMaxM + pivotYM, targetPoint.yMaxM) - Math.max(draftPoint.yMinM + pivotYM, targetPoint.yMinM);
    return overlapM > toleranceM;
}

export { BODY_NODE, CONNECT_POINT_KINDS, alignments, connectPointsOf, edgePoints, mergeConnectPoints, nearestAlignment, overlapsInY, toRelative };
