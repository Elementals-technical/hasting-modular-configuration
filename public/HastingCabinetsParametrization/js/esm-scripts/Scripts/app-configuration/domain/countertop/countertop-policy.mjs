const COUNTERTOP_SCHEMA_VERSION = 1;
const COUNTERTOP_LAYOUT_MODE = Object.freeze({
    STANDARD: 'standard',
    DRAG: 'drag'
});
const COUNTERTOP_INTERACTION_STATE = Object.freeze({
    IDLE: 'idle',
    SELECTED: 'selected',
    EDITING: 'editing',
    DRAGGING: 'dragging'
});
const COUNTERTOP_ATTACHMENT_STATE = Object.freeze({
    ATTACHED: 'attached',
    DETACHED: 'detached'
});
const COUNTERTOP_READINESS = Object.freeze({
    WAITING: 'waiting',
    READY: 'ready',
    DESTROYED: 'destroyed'
});
const COUNTERTOP_VALIDATION_STATE = Object.freeze({
    UNKNOWN: 'unknown',
    VALID: 'valid',
    INVALID: 'invalid'
});
const COUNTERTOP_ATTACHMENT_EPSILON_M = 0.000001;
const enumValues = (definition)=>Object.values(definition);
const finiteNumberOrDefault = (value, fallback)=>{
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
};
const resolveOffsetM = (offsetM)=>({
        x: finiteNumberOrDefault(offsetM?.x, 0),
        y: finiteNumberOrDefault(offsetM?.y, 0)
    });
function isCountertopLayoutMode(value) {
    return enumValues(COUNTERTOP_LAYOUT_MODE).includes(value);
}
function isCountertopInteractionState(value) {
    return enumValues(COUNTERTOP_INTERACTION_STATE).includes(value);
}
function isCountertopAttachmentState(value) {
    return enumValues(COUNTERTOP_ATTACHMENT_STATE).includes(value);
}
function isCountertopReadiness(value) {
    return enumValues(COUNTERTOP_READINESS).includes(value);
}
function isCountertopValidationState(value) {
    return enumValues(COUNTERTOP_VALIDATION_STATE).includes(value);
}
function resolveCountertopLayoutMode(value, fallback = COUNTERTOP_LAYOUT_MODE.STANDARD) {
    return isCountertopLayoutMode(value) ? value : fallback;
}
function resolveCountertopInteractionState(value, fallback = COUNTERTOP_INTERACTION_STATE.IDLE) {
    return isCountertopInteractionState(value) ? value : fallback;
}
function resolveCountertopReadiness(value, fallback = COUNTERTOP_READINESS.WAITING) {
    return isCountertopReadiness(value) ? value : fallback;
}
function resolveCountertopValidationState(value, fallback = COUNTERTOP_VALIDATION_STATE.UNKNOWN) {
    return isCountertopValidationState(value) ? value : fallback;
}
function calculateCountertopEffectivePositionM(layoutMode, basePositionM, offsetM) {
    if (!basePositionM) return null;
    const mode = resolveCountertopLayoutMode(layoutMode);
    if (mode === COUNTERTOP_LAYOUT_MODE.STANDARD) {
        return {
            x: basePositionM.x,
            y: basePositionM.y,
            z: basePositionM.z
        };
    }
    const offset = resolveOffsetM(offsetM);
    return {
        x: basePositionM.x + offset.x,
        y: basePositionM.y + offset.y,
        z: basePositionM.z
    };
}
function calculateCountertopEffectiveLengthM(layoutMode, baseLengthM, customLengthM) {
    const mode = resolveCountertopLayoutMode(layoutMode);
    if (mode === COUNTERTOP_LAYOUT_MODE.STANDARD) return baseLengthM;
    return customLengthM ?? baseLengthM;
}
function calculateCountertopAttachmentStateM(layoutMode, offsetM, epsilonM = COUNTERTOP_ATTACHMENT_EPSILON_M) {
    const mode = resolveCountertopLayoutMode(layoutMode);
    if (mode === COUNTERTOP_LAYOUT_MODE.STANDARD) {
        return COUNTERTOP_ATTACHMENT_STATE.ATTACHED;
    }
    const epsilon = Number.isFinite(epsilonM) && epsilonM >= 0 ? epsilonM : COUNTERTOP_ATTACHMENT_EPSILON_M;
    const offset = resolveOffsetM(offsetM);
    return Math.abs(offset.x) <= epsilon && Math.abs(offset.y) <= epsilon ? COUNTERTOP_ATTACHMENT_STATE.ATTACHED : COUNTERTOP_ATTACHMENT_STATE.DETACHED;
}

export { COUNTERTOP_ATTACHMENT_EPSILON_M, COUNTERTOP_ATTACHMENT_STATE, COUNTERTOP_INTERACTION_STATE, COUNTERTOP_LAYOUT_MODE, COUNTERTOP_READINESS, COUNTERTOP_SCHEMA_VERSION, COUNTERTOP_VALIDATION_STATE, calculateCountertopAttachmentStateM, calculateCountertopEffectiveLengthM, calculateCountertopEffectivePositionM, isCountertopAttachmentState, isCountertopInteractionState, isCountertopLayoutMode, isCountertopReadiness, isCountertopValidationState, resolveCountertopInteractionState, resolveCountertopLayoutMode, resolveCountertopReadiness, resolveCountertopValidationState };
