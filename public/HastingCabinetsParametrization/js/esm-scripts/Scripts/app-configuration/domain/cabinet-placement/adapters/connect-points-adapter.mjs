import { CONNECT_POINT_KINDS, edgePoints, mergeConnectPoints } from '../columns/connect-points.mjs';

/**
 * World connect points of the declared nodes under `entity` (connect-points.mjs). Each declaration is
 * { node, kind } (CONNECT_POINT_KINDS); an unknown kind is a registry mistake and throws. A node that is missing,
 * hidden (bounds null), without an X extent, or whose bounds throw, is skipped; [] when nothing was measured.
 * Example: [{ node: 'UD_Handle_LateralP_Top', kind: 'x-faces' }] measured at x 0.60..0.65, y 0.28..0.56 ->
 *   [{ xM: 0.60, side: 'left', node: 'UD_Handle_LateralP_Top', yMinM: 0.28, yMaxM: 0.56 }, { xM: 0.65, side: 'right', … }].
 * @param {{ findByName(name:string): object|null } | null} entity  the cabinet root
 * @param {{ node:string, kind:string }[]} declarations
 * @param {{ bounds(node): { minM:{x,y,z}, maxM:{x,y,z} } | null }} options  world box of a node, null when nothing is visible
 */ function measureConnectPointsM(entity, declarations, { bounds }) {
    // No entity in the scene (not built yet): nothing to measure.
    if (!entity) return [];
    const points = [];
    for (const { node, kind } of declarations ?? []){
        if (kind !== CONNECT_POINT_KINDS.xFaces) throw new TypeError(`Unknown connect point kind ${kind} on ${node}`);
        const box = measuredBox(entity.findByName(node), bounds);
        if (box) points.push(...edgePoints(box, node));
    }
    return mergeConnectPoints(points);
}
/** The node's box, or null when the node is missing, hidden, failed to measure or has no X extent (a face needs one). */ function measuredBox(node, bounds) {
    if (!node) return null;
    try {
        const box = bounds(node);
        const hasExtentX = Number.isFinite(box?.minM?.x) && Number.isFinite(box?.maxM?.x) && box.maxM.x > box.minM.x;
        return hasExtentX && Number.isFinite(box.minM.y) && Number.isFinite(box.maxM.y) ? box : null;
    } catch  {
        return null;
    }
}

export { measureConnectPointsM };
