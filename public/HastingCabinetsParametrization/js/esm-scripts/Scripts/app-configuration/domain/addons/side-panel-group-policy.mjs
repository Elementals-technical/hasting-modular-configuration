import { DEFAULT_COUNTERTOP_SUPPORT_GROUP_ID } from '../countertop/countertop-support-resolver.mjs';
import { DEFAULT_ROW_TOLERANCES } from '../cabinet-placement/cabinet-rows.mjs';
import { sidePanelProfileOf } from './side-panel-profiles.mjs';

const EPS = 1e-6;
// Two cabinets "stand at the same bottom" when their bottoms differ by less than this.
const SAME_BOTTOM_TOLERANCE_M = 0.005;
const SIDES = [
    'left',
    'right'
];
const validBox = (box)=>box && [
        'x',
        'y',
        'z'
    ].every((axis)=>Number.isFinite(box.minM?.[axis]) && Number.isFinite(box.maxM?.[axis]) && box.maxM[axis] > box.minM[axis]);
/** True when `other` starts beyond the cabinet's `side` face and reaches it within the contact tolerance. */ function isBesideFace(cabinet, other, side, contactM) {
    const faceX = side === 'left' ? cabinet.boxM.minM.x : cabinet.boxM.maxM.x;
    const otherBox = other.boxM;
    if (side === 'left') {
        return otherBox.minM.x < faceX - EPS && otherBox.maxM.x >= faceX - contactM - EPS;
    }
    return otherBox.maxM.x > faceX + EPS && otherBox.minM.x <= faceX + contactM + EPS;
}
/** Classify the whole Y/Z face, including neighbours in other groups or at other levels. */ function classifySidePanelExposure(cabinet, side, cabinets, contactM = DEFAULT_ROW_TOLERANCES.contactM) {
    const box = cabinet.boxM;
    const rectangles = cabinets.filter((other)=>other.id !== cabinet.id).flatMap((other)=>{
        const b = other.boxM;
        if (!isBesideFace(cabinet, other, side, contactM)) return [];
        const y0 = Math.max(box.minM.y, b.minM.y), y1 = Math.min(box.maxM.y, b.maxM.y);
        const z0 = Math.max(box.minM.z, b.minM.z), z1 = Math.min(box.maxM.z, b.maxM.z);
        return y1 - y0 > EPS && z1 - z0 > EPS ? [
            {
                y0,
                y1,
                z0,
                z1
            }
        ] : [];
    });
    if (!rectangles.length) return 'exposed';
    // Several adjacent cabinets can together cover one face. Sweep Y and union their Z intervals.
    const levels = [
        ...new Set([
            box.minM.y,
            box.maxM.y,
            ...rectangles.flatMap((r)=>[
                    r.y0,
                    r.y1
                ])
        ])
    ].sort((a, b)=>a - b);
    for(let i = 1; i < levels.length; i++){
        if (levels[i] - levels[i - 1] <= EPS) continue;
        const y = (levels[i] + levels[i - 1]) / 2;
        const intervals = rectangles.filter((r)=>r.y0 <= y && r.y1 >= y).sort((a, b)=>a.z0 - b.z0);
        let end = box.minM.z;
        for (const r of intervals){
            if (r.z0 > end + EPS) break;
            end = Math.max(end, r.z1);
        }
        if (end < box.maxM.z - EPS) return 'partial';
    }
    return 'covered';
}
/**
 * Pure per-row plan. Identity is the actual edge cabinet + side, never the mutable group ID.
 * Edge faces get an 'end' panel when fully exposed; profiles that support joints also get a
 * 'joint' panel on a taller cabinet's face that is partly hidden by a shorter neighbour.
 * @example planGroupSidePanels(cabinets, { left: 'NoG', right: 'None' }).panels[0].key // 'cabinet-1:left'
 * @param {object[]} cabinets measured cabinets: { id, rowId?, config, boxM, depthBoxM?, support? }
 * @param {{ left?: string, right?: string }} selection requested panel type per side
 * @returns {{ status: string, reason?: string, panels: object[], faces: object[] }}
 */ function planGroupSidePanels(cabinets, selection = {}) {
    if (cabinets.some((cabinet)=>!validBox(cabinet.boxM))) {
        return {
            status: 'unresolved',
            reason: 'cabinet-bounds-missing',
            panels: [],
            faces: []
        };
    }
    const panels = [];
    const faces = [];
    // 1. Each row (or support group) gets panels only on its two outermost faces.
    for (const members of groupCabinetsByRow(cabinets)){
        planEdgePanels(members, cabinets, selection, panels, faces);
    }
    // 2. Faces partly hidden by a shorter neighbour get a joint strip where the profile has one.
    planJointPanels(cabinets, selection, panels, faces);
    return {
        status: 'ready',
        panels,
        faces
    };
}
const groupIdOf = (cabinet)=>cabinet.config.SupportGroupId || DEFAULT_COUNTERTOP_SUPPORT_GROUP_ID;
/** Group cabinets by row, falling back to the support group; every member carries its groupId. */ function groupCabinetsByRow(cabinets) {
    const groups = new Map();
    for (const cabinet of cabinets){
        const groupId = groupIdOf(cabinet);
        const key = cabinet.rowId || groupId;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push({
            ...cabinet,
            groupId
        });
    }
    return groups.values();
}
/** The member whose `side` face is outermost by X; ties resolve by id so the result is stable. */ function pickEdgeCabinet(members, side) {
    const byOuterFace = side === 'left' ? (first, second)=>first.boxM.minM.x - second.boxM.minM.x || first.id.localeCompare(second.id) : (first, second)=>second.boxM.maxM.x - first.boxM.maxM.x || first.id.localeCompare(second.id);
    return [
        ...members
    ].sort(byOuterFace)[0];
}
const isPanelTypeSelected = (requestedType)=>Boolean(requestedType) && requestedType !== 'None';
/** The cabinet's side panel profile when it can carry a panel product on `side`, else null. */ function panelProfileFor(cabinet, side) {
    const profile = sidePanelProfileOf(cabinet.support?.profile);
    if (!profile || !cabinet.support.productTypes?.[side]) return null;
    return profile;
}
function planEdgePanels(members, cabinets, selection, panels, faces) {
    for (const side of SIDES){
        // 1. Record the outermost face and how much of it is visible.
        const cabinet = pickEdgeCabinet(members, side);
        const exposure = classifySidePanelExposure(cabinet, side, cabinets);
        const requestedType = selection[side];
        const face = {
            cabinetId: cabinet.id,
            groupId: cabinet.groupId,
            side,
            face: 'end',
            exposure
        };
        faces.push(face);
        if (!isPanelTypeSelected(requestedType) || exposure !== 'exposed') continue;
        // 2. The cabinet must belong to a profile with a panel product for this side.
        const profile = panelProfileFor(cabinet, side);
        if (!profile) {
            face.reason = 'incompatible-cabinet';
            continue;
        }
        // 3. The profile decides whether this cabinet's size has an end panel.
        const plan = profile.resolvePlan({
            cabinetConfig: cabinet.config,
            requestedType,
            side,
            face: 'end'
        });
        if (plan.status !== 'resolved') {
            face.reason = plan.reason;
            continue;
        }
        panels.push(buildPanelItem({
            cabinet,
            side,
            profile,
            requestedType,
            plan,
            face: 'end',
            neighbour: null
        }));
    }
}
function planJointPanels(cabinets, selection, panels, faces) {
    for (const cabinet of cabinets){
        for (const side of SIDES){
            // 1. Only a taller cabinet of a joint-capable profile, partly hidden by a shorter neighbour
            //    of the same panel profile, qualifies (no joint next to open shelves or foreign cabinets).
            const requestedType = selection[side];
            if (!isPanelTypeSelected(requestedType)) continue;
            const profile = panelProfileFor(cabinet, side);
            if (!profile?.supportsJoints) continue;
            if (classifySidePanelExposure(cabinet, side, cabinets) !== 'partial') continue;
            const neighbour = findShorterNeighbourAtSameBottom(cabinet, side, cabinets, profile);
            if (!neighbour) continue;
            // 2. The profile decides whether this height pair has a joint strip.
            const groupId = groupIdOf(cabinet);
            const plan = profile.resolvePlan({
                cabinetConfig: cabinet.config,
                requestedType,
                side,
                face: 'joint',
                neighbourConfig: neighbour.config
            });
            if (plan.status !== 'resolved') {
                faces.push({
                    cabinetId: cabinet.id,
                    groupId,
                    side,
                    face: 'joint',
                    exposure: 'partial',
                    reason: plan.reason
                });
                continue;
            }
            panels.push(buildPanelItem({
                cabinet: {
                    ...cabinet,
                    groupId
                },
                side,
                profile,
                requestedType,
                plan,
                face: 'joint',
                neighbour
            }));
        }
    }
}
/**
 * A neighbour touching the cabinet's `side` face that is lower than the cabinet, stands on the
 * same floor level (bottoms within SAME_BOTTOM_TOLERANCE_M), overlaps it in depth and has side
 * panel support of the same profile.
 */ function findShorterNeighbourAtSameBottom(cabinet, side, cabinets, profile) {
    const contactM = DEFAULT_ROW_TOLERANCES.contactM;
    return cabinets.find((other)=>other.id !== cabinet.id && isBesideFace(cabinet, other, side, contactM) && hasPanelProfile(other, profile) && standsAtSameBottom(cabinet, other) && isShorter(other, cabinet) && overlapsInDepth(cabinet, other)) ?? null;
}
const hasPanelProfile = (cabinet, profile)=>cabinet.support?.profile === profile.id;
const standsAtSameBottom = (cabinet, other)=>Math.abs(cabinet.boxM.minM.y - other.boxM.minM.y) <= SAME_BOTTOM_TOLERANCE_M;
const isShorter = (candidate, cabinet)=>candidate.boxM.maxM.y < cabinet.boxM.maxM.y - EPS;
const overlapsInDepth = (cabinet, other)=>Math.min(cabinet.boxM.maxM.z, other.boxM.maxM.z) - Math.max(cabinet.boxM.minM.z, other.boxM.minM.z) > EPS;
/** Plan item for one panel; its config is the panel product config read by the profile's layout rule and RuleSidePanels. */ function buildPanelItem({ cabinet, side, profile, requestedType, plan, face, neighbour }) {
    const key = `${cabinet.id}:${side}`;
    const config = cabinet.config;
    return {
        key,
        cabinetId: cabinet.id,
        groupId: cabinet.groupId,
        side,
        boxM: cabinet.boxM,
        depthBoxM: cabinet.depthBoxM || cabinet.boxM,
        config: {
            productType: cabinet.support.productTypes[side],
            category: 'addons',
            side,
            SidePanelLayout: 'group-edge',
            SidePanelEdgeKey: key,
            SidePanelAnchorCabinetId: cabinet.id,
            SupportGroupId: cabinet.groupId,
            SidePanelProfile: profile.id,
            SidePanelRequestedType: requestedType,
            SidePanelType: plan.appearance,
            SidePanelFace: face,
            SidePanelNeighbourHeight: neighbour ? profile.bodyHeightOf(neighbour.config) : null,
            Height: config.Height,
            Depth: config.Depth,
            Handle: config.Handle,
            CabinetColor: config.CabinetColor,
            GrainDirection: config.GrainDirection || 'None',
            HandleGrooveColor: config.HandleGrooveColor || null
        }
    };
}

export { classifySidePanelExposure, planGroupSidePanels };
