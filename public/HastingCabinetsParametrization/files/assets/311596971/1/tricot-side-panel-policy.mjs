export const TRICOT_SIDE_PANEL_PROFILE = 'tricot';
export const TRICOT_SIDE_PANEL_TEMPLATE = 'Tricot_SidePanel';
export const TRICOT_SIDE_PANEL_PRODUCTS = Object.freeze({
    left: 'Tricot-SidePanel_Left',
    right: 'Tricot-SidePanel_Right'
});

export const TRICOT_SIDE_PANEL_NODES = Object.freeze({
    panel: 'Tricot_SidePanel_Panel'
});

// The Tricot body has one size: 40 cm high, 52 cm deep. The artist modelled Tricot_SidePanel_Panel
// at exactly that size (1 × 40 × 52 cm, origin at the back bottom corner), so the panel needs no stretch.
export const TRICOT_BODY_HEIGHT_CM = 40;

// The Tricot pattern is only on the fronts, so the panel is a plain one without a groove (guide sheet Tricot, rows 76-87).
const TRICOT_SIDE_PANEL_TYPE = 'NoG';

const isSupportedSide = side => side === 'left' || side === 'right';

const unresolvedPlan = reason => Object.freeze({ status: 'unresolved', reason });

/**
 * The Tricot side panel appearance: always a plain panel.
 * @example resolveTricotSidePanelType() // → 'NoG'
 */
export function resolveTricotSidePanelType() {
    return TRICOT_SIDE_PANEL_TYPE;
}

/**
 * Convert a Tricot panel side into an idempotent scene plan.
 * Only end faces exist: Tricot cabinets all have the same height, so there are no joint strips.
 * @example resolveTricotSidePanelPlan({ side: 'left' }) // → { status: 'resolved', panel: { scaleX: -1 }, ... }
 */
export function resolveTricotSidePanelPlan({ side, face = 'end' } = {}) {
    // 1. Side and face decide whether a panel can exist at all.
    if (!isSupportedSide(side)) return unresolvedPlan('unsupported-side');
    if (face !== 'end') return unresolvedPlan('unsupported-face');

    // 2. The guide mirrors the panel with scale x −1 on the left.
    return Object.freeze({
        status: 'resolved',
        face,
        appearance: TRICOT_SIDE_PANEL_TYPE,
        panel: Object.freeze({ scaleX: side === 'left' ? -1 : 1 })
    });
}
