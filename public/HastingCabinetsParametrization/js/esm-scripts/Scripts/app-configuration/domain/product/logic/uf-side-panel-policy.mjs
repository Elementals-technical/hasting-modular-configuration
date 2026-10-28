import { tableValue } from './side-panel-tables.mjs';
import { isCentralGrooveTall } from './uf-cabinet-height-policy.mjs';

const UF_SIDE_PANEL_PROFILE = 'uf';
const UF_SIDE_PANEL_TEMPLATE = 'UF_SidePanel';
const UF_SIDE_PANEL_PRODUCTS = Object.freeze({
    left: 'UF-SidePanel_Left',
    right: 'UF-SidePanel_Right'
});
const UF_SIDE_PANEL_NODES = Object.freeze({
    point: 'UF_SidePanel_Point',
    inlayBottom: 'UF_SidePanel_Inlay_Bot',
    inlayTop: 'UF_SidePanel_Inlay_Top',
    panelBottom: 'UF_SidePanel_Panel_Bot',
    panelFull: 'UF_SidePanel_Panel_Full',
    panelTop: 'UF_SidePanel_Panel_Top'
});
const UF_SIDE_PANEL_PART_NAMES = Object.freeze([
    UF_SIDE_PANEL_NODES.inlayBottom,
    UF_SIDE_PANEL_NODES.inlayTop,
    UF_SIDE_PANEL_NODES.panelBottom,
    UF_SIDE_PANEL_NODES.panelFull,
    UF_SIDE_PANEL_NODES.panelTop
]);
const UF_SIDE_PANEL_FACES = Object.freeze({
    end: 'end',
    joint: 'joint'
});
const { inlayBottom, inlayTop, panelBottom, panelFull, panelTop } = UF_SIDE_PANEL_NODES;
// Every table is keyed by the UF height of uf-cabinet-height-policy: 53 / 56 / 88 / 91 as in the NEW sheet D130:G130.
// Appearance: PTO heights (53 / 88) have no groove, UG / CG heights (56 / 91) have the upper one.
const TYPE_BY_HEIGHT = Object.freeze({
    53: 'NoG',
    56: 'UpperG',
    88: 'NoG',
    91: 'UpperG'
});
// Panel_Top stands at 0.56 in the v69 template (on top of Inlay_Bot / Panel_Bot); the NEW sheet gives MoveY only for joints (C159, F159, I159).
const PANEL_TOP_BASE_Y = 0.56;
// End panel: visible parts per cabinet height (NEW sheet D130:G136; the 91 UG column has no Inlay_Top).
const VISIBLE_PARTS_BY_HEIGHT = Object.freeze({
    53: Object.freeze([
        panelBottom
    ]),
    56: Object.freeze([
        inlayBottom,
        panelBottom
    ]),
    88: Object.freeze([
        panelFull
    ]),
    91: Object.freeze([
        inlayBottom,
        panelBottom,
        panelTop
    ])
});
// Panel_Top height stretch of the end panel (NEW sheet H136): SmartStretch moves its top by half the stretch, 0.88 + 0.03 = 0.91.
// Every other part and height has none; Panel_Full is v69 0-0.88 and stands at 88 unstretched.
const PANEL_TOP_STRETCH_BY_HEIGHT = Object.freeze({
    91: 0.06
});
// Central Groove is the 91 height (isCentralGrooveTall); its appearance stays 'UpperG'.
// Its end panel (NEW sheet I130:J136): both inlays, Panel_Top unstretched.
const CENTRAL_GROOVE_END = Object.freeze({
    visibleParts: Object.freeze([
        inlayBottom,
        inlayTop,
        panelBottom,
        panelTop
    ]),
    panelTopStretchY: 0
});
// Joint panel of the taller cabinet, keyed by taller height, then shorter neighbour height (NEW sheet A152:J159).
const JOINT_BY_HEIGHT_PAIR = Object.freeze({
    88: Object.freeze({
        53: Object.freeze({
            visibleParts: Object.freeze([
                panelTop
            ]),
            panelTopMoveY: 0.53,
            panelTopStretchY: 0.06
        })
    }),
    91: Object.freeze({
        56: Object.freeze({
            visibleParts: Object.freeze([
                inlayTop,
                panelTop
            ]),
            panelTopMoveY: 0.56,
            panelTopStretchY: 0
        })
    })
});
// Joint of the 91 Central Groove cabinet, keyed by shorter neighbour height.
// NEW sheet E153:G159 equals the PTO column (H153:J159): Panel_Top 0.53 + stretch 0.06 ends at 0.88 on a 0.91 cabinet.
const CENTRAL_GROOVE_JOINT_BY_NEIGHBOUR = Object.freeze({
    56: Object.freeze({
        visibleParts: Object.freeze([
            panelTop
        ]),
        panelTopMoveY: 0.53,
        panelTopStretchY: 0.06
    })
});
// Depth stretch applied to all five parts, used as written in the guide (guide calls it StretchZ).
const DEPTH_STRETCH = Object.freeze({
    // The mesh is back-anchored, so the front moves by half the stretch: 46 recedes 4 cm (NEW sheet B136:B137).
    46: -0.08,
    50: 0
});
const isSupportedSide = (side)=>side === 'left' || side === 'right';
const isSupportedFace = (face)=>face === UF_SIDE_PANEL_FACES.end || face === UF_SIDE_PANEL_FACES.joint;
const unresolvedPlan = (reason)=>Object.freeze({
        status: 'unresolved',
        reason
    });
// Only Panel_Top is lifted and stretched in height; every part is stretched in depth (all five meshes are unrotated).
const buildParts = ({ visibleParts, depthStretch, panelTopMoveY, panelTopStretchY })=>{
    const parts = {};
    for (const partName of UF_SIDE_PANEL_PART_NAMES){
        const isPanelTop = partName === panelTop;
        parts[partName] = Object.freeze({
            visible: visibleParts.includes(partName),
            stretch: Object.freeze({
                y: isPanelTop ? panelTopStretchY : 0,
                z: depthStretch
            }),
            moveY: isPanelTop ? panelTopMoveY : 0
        });
    }
    return Object.freeze(parts);
};
/**
 * Find the joint parts of a supported height pair; `height` is the taller cabinet.
 * Example: resolveUFJointPair({ height: 91, neighbourHeight: 56 }) // → { visibleParts, panelTopMoveY, panelTopStretchY }
 */ function resolveUFJointPair({ height, neighbourHeight, handle }) {
    if (isCentralGrooveTall(Number(height), handle)) return tableValue(CENTRAL_GROOVE_JOINT_BY_NEIGHBOUR, neighbourHeight);
    const jointsByNeighbourHeight = tableValue(JOINT_BY_HEIGHT_PAIR, height);
    if (jointsByNeighbourHeight === null) return null;
    return tableValue(jointsByNeighbourHeight, neighbourHeight);
}
/**
 * Resolve the UF side panel appearance from the cabinet height.
 * @example resolveUFSidePanelType({ height: 91 }) // → 'UpperG'
 */ function resolveUFSidePanelType({ height } = {}) {
    return tableValue(TYPE_BY_HEIGHT, height);
}
/**
 * Convert UF cabinet state into an idempotent scene plan for one side panel.
 * `height` / `neighbourHeight` are UF heights (53 / 56 / 88 / 91); `handle` is the taller cabinet's (CG picks the Central Groove column of 91).
 * Values are from the NEW sheet (A130:J159). Each part gets `{ visible, stretch: { y, z }, moveY }`: depth on Z for all, height on Y for Panel_Top.
 * @example resolveUFSidePanelPlan({ side: 'left', height: 91, depth: 50 }) // → resolved end panel plan
 */ function resolveUFSidePanelPlan({ side, face = UF_SIDE_PANEL_FACES.end, height, depth, neighbourHeight, handle } = {}) {
    // 1. Side and face decide whether a panel can exist at all.
    if (!isSupportedSide(side)) return unresolvedPlan('unsupported-side');
    if (!isSupportedFace(face)) return unresolvedPlan('unsupported-face');
    // 2. Height gives the end panel parts and the appearance (both tables share the same heights).
    const endVisibleParts = tableValue(VISIBLE_PARTS_BY_HEIGHT, height);
    if (endVisibleParts === null) return unresolvedPlan('unsupported-height');
    const appearance = resolveUFSidePanelType({
        height
    });
    // 3. Depth gives the stretch for every part, end or joint.
    const depthStretch = tableValue(DEPTH_STRETCH, depth);
    if (depthStretch === null) return unresolvedPlan('unsupported-depth');
    // 4. The end panel shows the parts of its height (91 Central Groove has its own); a joint face replaces them with the pair's.
    let partsSource = {
        visibleParts: endVisibleParts,
        panelTopMoveY: PANEL_TOP_BASE_Y,
        panelTopStretchY: tableValue(PANEL_TOP_STRETCH_BY_HEIGHT, height) ?? 0
    };
    if (face === UF_SIDE_PANEL_FACES.end && isCentralGrooveTall(Number(height), handle)) {
        partsSource = {
            ...partsSource,
            ...CENTRAL_GROOVE_END
        };
    }
    if (face === UF_SIDE_PANEL_FACES.joint) {
        partsSource = resolveUFJointPair({
            height,
            neighbourHeight,
            handle
        });
        if (partsSource === null) return unresolvedPlan('unsupported-joint');
    }
    // 5. Point scale mirrors the panel to the requested side.
    return Object.freeze({
        status: 'resolved',
        face,
        appearance,
        point: Object.freeze({
            scaleX: side === 'left' ? -1 : 1
        }),
        parts: buildParts({
            ...partsSource,
            depthStretch
        })
    });
}

export { UF_SIDE_PANEL_FACES, UF_SIDE_PANEL_NODES, UF_SIDE_PANEL_PART_NAMES, UF_SIDE_PANEL_PRODUCTS, UF_SIDE_PANEL_PROFILE, UF_SIDE_PANEL_TEMPLATE, resolveUFSidePanelPlan, resolveUFSidePanelType };
