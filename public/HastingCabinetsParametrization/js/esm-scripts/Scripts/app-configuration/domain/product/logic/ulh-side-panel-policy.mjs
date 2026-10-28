import { tableValue } from './side-panel-tables.mjs';

const ULH_SIDE_PANEL_PROFILE = 'ulh';
const ULH_SIDE_PANEL_PRODUCTS = Object.freeze({
    left: 'ULH-SidePanel_Left',
    right: 'ULH-SidePanel_Right'
});
const ULH_SIDE_PANEL_NODES = Object.freeze({
    point: 'ULH_UniSidePanelPoint',
    panel: 'ULH_UniSidePanel_Panel',
    inlay: 'ULH_UniSidePanel_Inlay'
});
const SIDE_PANEL_TYPES = Object.freeze({
    NO_GROOVE: 'NoG',
    UPPER_GROOVE: 'UpperG'
});
const NO_GROOVE_STRETCH_Y = Object.freeze({
    25: 0,
    28: 0.123,
    35: 0.263,
    38: 0.323,
    50: 0.563,
    56: 0.683
});
const UPPER_GROOVE_MOVE_Y = Object.freeze({
    25: 0,
    28: 0.03,
    35: 0.1,
    38: 0.13,
    50: 0.25,
    56: 0.31
});
const UPPER_GROOVE_STRETCH_Y = Object.freeze({
    25: 0,
    28: 0.06,
    35: 0.2,
    38: 0.26,
    50: 0.5,
    56: 0.62
});
const DEPTH_STRETCH_Z = Object.freeze({
    46: 0,
    50: 0.09
});
function resolveULHSidePanelType({ handle, requestedType } = {}) {
    if (handle === 'handle_urban_topcut') return SIDE_PANEL_TYPES.UPPER_GROOVE;
    if (handle === 'handle_pto') return SIDE_PANEL_TYPES.NO_GROOVE;
    if (requestedType === SIDE_PANEL_TYPES.UPPER_GROOVE) return SIDE_PANEL_TYPES.UPPER_GROOVE;
    if (requestedType === SIDE_PANEL_TYPES.NO_GROOVE) return SIDE_PANEL_TYPES.NO_GROOVE;
    return SIDE_PANEL_TYPES.NO_GROOVE;
}
/**
 * Convert ULH product state into an idempotent scene plan.
 * Values are the artist-approved SmartStretch/position values from the ULH guide.
 */ function resolveULHSidePanelPlan({ handle, requestedType, height, depth, side } = {}) {
    if (side !== 'left' && side !== 'right') {
        return Object.freeze({
            status: 'unresolved',
            reason: 'unsupported-side'
        });
    }
    const appearance = resolveULHSidePanelType({
        handle,
        requestedType
    });
    const depthStretchZ = tableValue(DEPTH_STRETCH_Z, depth);
    if (depthStretchZ === null) {
        return Object.freeze({
            status: 'unresolved',
            reason: 'unsupported-depth',
            appearance
        });
    }
    const noGrooveStretchY = tableValue(NO_GROOVE_STRETCH_Y, height);
    const upperGrooveMoveY = tableValue(UPPER_GROOVE_MOVE_Y, height);
    const upperGrooveStretchY = tableValue(UPPER_GROOVE_STRETCH_Y, height);
    if (noGrooveStretchY === null || upperGrooveMoveY === null || upperGrooveStretchY === null) {
        return Object.freeze({
            status: 'unresolved',
            reason: 'unsupported-height',
            appearance
        });
    }
    const upperGroove = appearance === SIDE_PANEL_TYPES.UPPER_GROOVE;
    return Object.freeze({
        status: 'resolved',
        reason: 'ulh-side-panel-resolved',
        profile: ULH_SIDE_PANEL_PROFILE,
        appearance,
        point: Object.freeze({
            visible: true,
            scaleX: side === 'left' ? -1 : 1
        }),
        panel: Object.freeze({
            visible: true,
            stretchY: upperGroove ? upperGrooveStretchY : noGrooveStretchY,
            stretchZ: upperGroove ? 0 : depthStretchZ
        }),
        inlay: Object.freeze({
            visible: upperGroove,
            moveY: upperGroove ? upperGrooveMoveY : 0,
            stretchY: 0,
            stretchZ: upperGroove ? depthStretchZ : 0
        })
    });
}

export { ULH_SIDE_PANEL_NODES, ULH_SIDE_PANEL_PRODUCTS, ULH_SIDE_PANEL_PROFILE, resolveULHSidePanelPlan, resolveULHSidePanelType };
