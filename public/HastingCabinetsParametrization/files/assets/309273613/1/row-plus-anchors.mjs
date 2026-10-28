/**
 * "+" buttons for free-layout (modular) compositions: one "+" per row end, only where a cabinet of
 * the edge cabinet's size fits. Rows come from the placed cabinets' geometry (groupCabinetRows), so a
 * cabinet placed by Drag & Drop gets its own "+" like any other; interior joints get none.
 * Engine-free: anchors are the legacy AnchorCalculator entries `{ entity, left, right }`.
 */
import { groupCabinetRows, planPlacementSlots } from './placement-slots.mjs';
import { relativeBox } from './draft-collision.mjs';

/**
 * @param {{entity:{name:string}, left:any, right:any}[]} anchors  legacy anchors (mutated copies are returned)
 * @param {{id, box, pivotM}[]} cabinets  placed cabinets (world boxes and pivots)
 * @param {{id, box}[]} [obstacles]       extra bodies (the floor)
 * @returns the anchors with `left`/`right` kept only at free row ends
 */
export function rowEndPlusAnchors(anchors, cabinets, obstacles = []) {
    const byId = new Map(cabinets.map(c => [c.id, c]));
    const keep = new Map(); // cabinet id -> { left:boolean, right:boolean }
    for (const row of groupCabinetRows(cabinets)) {
        for (const [side, edgeId] of [['left', row.leftId], ['right', row.rightId]]) {
            const edge = byId.get(edgeId);
            if (!edge) continue;
            // A cabinet like the edge one, placed at this row end.
            const slots = planPlacementSlots({ cabinets, obstacles, draft: { relativeBox: relativeBox(edge.box, edge.pivotM) } });
            const slot = slots.find(s => s.kind === side && s.anchorCabinetId === edgeId);
            const flags = keep.get(edgeId) ?? { left: false, right: false };
            flags[side] = slot?.availability === 'available';
            keep.set(edgeId, flags);
        }
    }
    return anchors.map(anchor => {
        const flags = keep.get(anchor?.entity?.name) ?? { left: false, right: false };
        return { ...anchor, left: flags.left ? anchor.left : null, right: flags.right ? anchor.right : null };
    });
}
