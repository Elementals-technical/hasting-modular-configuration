/**
 * Current standard countertop layout constants.
 *
 * Cabinet and side-panel widths come from the legacy product configuration in
 * centimetres. Bounds, gaps, pivot corrections and returned values are scene
 * metres.
 */ const SIDE_SHELF_WIDTH_LEGACY_CM = 15;
const SIDE_PANEL_WIDTH_LEGACY_CM = 1;
const SINGLE_SIDE_PANEL_OFFSET_M = 0.005;
const COUNTERTOP_INTRINSIC_LENGTH_M = 0.6;
const LEGACY_CM_PER_METER = 100;
function legacyCentimetersToMeters(value) {
    return Number(value) / LEGACY_CM_PER_METER;
}
function resolveCabinetWidthLegacyCm(cabinet) {
    return cabinet?.isSideShelf ? SIDE_SHELF_WIDTH_LEGACY_CM : Number(cabinet?.widthLegacyCm);
}
function resolveBoundsM(cabinet) {
    const bounds = cabinet?.boundsM;
    const centerX = Number(bounds?.centerX ?? bounds?.center?.x);
    const halfExtentX = Number(bounds?.halfExtentX ?? bounds?.halfExtents?.x);
    if (!Number.isFinite(centerX) || !Number.isFinite(halfExtentX)) {
        return null;
    }
    return {
        centerX,
        halfExtentX
    };
}
function calculateCabinetBounds(cabinets) {
    let groupMinXM = Infinity;
    let groupMaxXM = -Infinity;
    for (const cabinet of cabinets){
        const bounds = resolveBoundsM(cabinet);
        if (!bounds) continue;
        groupMinXM = Math.min(groupMinXM, bounds.centerX - bounds.halfExtentX);
        groupMaxXM = Math.max(groupMaxXM, bounds.centerX + bounds.halfExtentX);
    }
    if (!Number.isFinite(groupMinXM) || !Number.isFinite(groupMaxXM)) {
        return {
            hasBounds: false,
            groupCenterXM: 0,
            groupMinXM: 0,
            groupMaxXM: 0
        };
    }
    return {
        hasBounds: true,
        groupCenterXM: (groupMinXM + groupMaxXM) / 2,
        groupMinXM,
        groupMaxXM
    };
}
function calculateSidePanelOffsetM(sidePanels) {
    const hasLeftPanel = sidePanels.some((panel)=>panel?.side === "left");
    const hasRightPanel = sidePanels.some((panel)=>panel?.side === "right");
    if (hasLeftPanel && !hasRightPanel) return -SINGLE_SIDE_PANEL_OFFSET_M;
    if (!hasLeftPanel && hasRightPanel) return SINGLE_SIDE_PANEL_OFFSET_M;
    return 0;
}
/**
 * Calculates the current automatic countertop length in scene metres.
 *
 * layoutItemCount intentionally remains separate from cabinets.length because
 * the existing rule counts every cabinet entity for gaps, even when its
 * product configuration is unavailable and its width is skipped.
 */ function calculateCountertopAutoLengthM({ cabinets = [], layoutItemCount = cabinets.length, sidePanels = [], cabinetGapM = 0 } = {}) {
    const cabinetWidthM = cabinets.reduce((totalM, cabinet)=>totalM + legacyCentimetersToMeters(resolveCabinetWidthLegacyCm(cabinet)), 0);
    const layoutGapM = Math.max(Number(layoutItemCount) - 1, 0) * Number(cabinetGapM);
    const sidePanelWidthM = legacyCentimetersToMeters(sidePanels.length * SIDE_PANEL_WIDTH_LEGACY_CM);
    return cabinetWidthM + layoutGapM + sidePanelWidthM;
}
/**
 * Calculates the standard X anchor from immutable, plain-data inputs.
 */ function calculateCountertopBaseX({ cabinets = [], sidePanels = [], countertopIntrinsicPivotXM = 0 } = {}) {
    const bounds = calculateCabinetBounds(cabinets);
    const sidePanelOffsetM = calculateSidePanelOffsetM(sidePanels);
    const cabinetBaseXM = bounds.hasBounds ? bounds.groupCenterXM - Number(countertopIntrinsicPivotXM) : 0;
    return {
        baseXM: cabinetBaseXM + sidePanelOffsetM,
        cabinetBaseXM,
        sidePanelOffsetM,
        intrinsicPivotCorrectionXM: Number(countertopIntrinsicPivotXM),
        ...bounds
    };
}
/**
 * Produces the complete current standard layout plan without reading or
 * mutating PlayCanvas entities.
 */ function calculateStandardCountertopLayout({ cabinets = [], layoutItemCount = cabinets.length, sidePanels = [], cabinetGapM = 0, countertopIntrinsicPivotXM = 0, countertopIntrinsicLengthM = COUNTERTOP_INTRINSIC_LENGTH_M } = {}) {
    const autoLengthM = calculateCountertopAutoLengthM({
        cabinets,
        layoutItemCount,
        sidePanels,
        cabinetGapM
    });
    const base = calculateCountertopBaseX({
        cabinets,
        sidePanels,
        countertopIntrinsicPivotXM
    });
    return {
        autoLengthM,
        stretchXM: autoLengthM - Number(countertopIntrinsicLengthM),
        ...base
    };
}
// ---------------------------------------------------------------------------
// Length rule (countertop on the modules model)
// ---------------------------------------------------------------------------
/** Offsets within this distance (m) of the standard position count as "attached". */ const COUNTERTOP_ATTACHED_EPSILON_M = 1e-6;
/** The countertop sits on its composition (no offset from its standard position). */ function isCountertopAttached(offsetM, epsilonM = COUNTERTOP_ATTACHED_EPSILON_M) {
    const x = Number(offsetM?.x ?? 0);
    const y = Number(offsetM?.y ?? 0);
    return (!Number.isFinite(x) || Math.abs(x) <= epsilonM) && (!Number.isFinite(y) || Math.abs(y) <= epsilonM);
}
/**
 * Effective countertop length (m).
 *
 * - Attached to the composition (no offset): the composition's length, always.
 * - Moved off it: a custom length when one is set, otherwise the composition's length.
 */ function resolveCountertopLengthM({ autoLengthM, customLengthM = null, offsetM = null } = {}) {
    const auto = Number(autoLengthM);
    if (isCountertopAttached(offsetM)) return auto;
    const custom = Number(customLengthM);
    return customLengthM != null && Number.isFinite(custom) && custom > 0 ? custom : auto;
}

export { COUNTERTOP_ATTACHED_EPSILON_M, COUNTERTOP_INTRINSIC_LENGTH_M, SIDE_PANEL_WIDTH_LEGACY_CM, SIDE_SHELF_WIDTH_LEGACY_CM, SINGLE_SIDE_PANEL_OFFSET_M, calculateCountertopAutoLengthM, calculateCountertopBaseX, calculateStandardCountertopLayout, isCountertopAttached, legacyCentimetersToMeters, resolveCountertopLengthM };
