import { cloneData, isFiniteVec3, outcome, reason } from './cabinet-contracts.mjs';

/** Pure local-frame planner. anchorPositionM is the FIRST member's center.
 * Numeric comparison is floating-point roundoff only, not a product/contact tolerance.
 */
export function planStandardInsertion({ cabinets, layout, candidate, side } = {}) {
    const invalid = () => outcome('invalid', [reason('INVALID_STANDARD_RUN')]);
    if (!Array.isArray(cabinets) || !layout || layout.kind !== 'standard-run' ||
        !isFiniteVec3(layout.anchorPositionM) || !['left', 'right'].includes(side) ||
        !candidate || typeof candidate.id !== 'string' || !candidate.id ||
        !Number.isFinite(candidate.widthM) || candidate.widthM <= 0 ||
        !Array.isArray(layout.orderedCabinetIds) || !layout.orderedCabinetIds.length) return invalid();
    const map = new Map(cabinets.map(c => [c.id, c]));
    const ids = layout.orderedCabinetIds;
    if (map.size !== cabinets.length || map.has(candidate.id) || new Set(ids).size !== ids.length) return invalid();
    const members = ids.map(id => map.get(id));
    if (members.some(c => !c || c.placementMode !== 'standard' || c.frameId !== layout.frameId ||
        !isFiniteVec3(c.positionM) || !Number.isFinite(c.widthM) || c.widthM <= 0)) return invalid();
    const anchor = layout.anchorPositionM;
    let x = anchor.x;
    const close = (a,b) => Math.abs(a-b) <= Number.EPSILON * 16 * Math.max(1, Math.abs(a), Math.abs(b));
    for (let i = 0; i < members.length; i++) {
        if (i) x += (members[i-1].widthM + members[i].widthM) / 2;
        const p = members[i].positionM;
        if (!close(p.x, x) || !close(p.y, anchor.y) || !close(p.z, anchor.z)) {
            return outcome('unsupported', [reason('STANDARD_RUN_REQUIRES_RESOLUTION', ['Q-STANDARD-GROUP'])]);
        }
    }
    const end = side === 'left' ? members[0] : members.at(-1);
    const centerX = end.positionM.x + (side === 'left' ? -1 : 1) * (end.widthM + candidate.widthM) / 2;
    if (!Number.isFinite(centerX)) return invalid();
    const positionM = { x: centerX, y: anchor.y, z: anchor.z };
    const newLayout = cloneData(layout);
    newLayout.orderedCabinetIds = side === 'left' ? [candidate.id, ...ids] : [...ids, candidate.id];
    if (side === 'left') newLayout.anchorPositionM = { ...positionM };
    return outcome('valid', [], { layout: newLayout,
        positions: [...members.map(c => ({ id:c.id, positionM:{ ...c.positionM } })),
            { id:candidate.id, positionM }] });
}
