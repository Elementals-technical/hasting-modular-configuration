import { deepFreeze } from '../spatial-manipulation/core/contracts/immutable.mjs';

const COUNTERTOP_READINESS = deepFreeze({
    WAITING: 'waiting',
    READY: 'ready'
});
const COUNTERTOP_PLACEMENT_STATE = deepFreeze({
    WAITING: 'waiting',
    ATTACHED: 'attached',
    MOVED: 'moved'
});
const COUNTERTOP_MOTION_STATE = deepFreeze({
    IDLE: 'idle',
    MOVING: 'moving'
});
const COUNTERTOP_INTERACTION_STATE = deepFreeze({
    IDLE: 'idle',
    SELECTED: 'selected',
    DRAGGING: 'dragging'
});
const COUNTERTOP_CHANGE_REASON = deepFreeze({
    CURRENT: 'current',
    SELECTION: 'selection',
    RESET: 'reset',
    LAYOUT: 'layout',
    RESTORED: 'restored',
    OFFSET: 'offset',
    LENGTH: 'length',
    LENGTH_SETTLED: 'length-settled',
    LENGTH_LIMITS: 'length-limits',
    VALIDATION: 'validation',
    VERTICAL_LOCK: 'vertical-lock',
    SINK_LANDING: 'sink-landing'
});
const COUNTERTOP_ERROR_CODE = deepFreeze({
    NOT_READY: 'COUNTERTOP_NOT_READY',
    INVALID_INPUT: 'COUNTERTOP_INVALID_INPUT',
    ATTACHED: 'COUNTERTOP_ATTACHED',
    DESTROYED: 'COUNTERTOP_DESTROYED',
    VERTICAL_LOCKED: 'COUNTERTOP_VERTICAL_LOCKED',
    POSE_INVALID: 'COUNTERTOP_POSE_INVALID'
});
const COUNTERTOP_PUBLIC_CONTRACT_V1 = deepFreeze({
    version: 1,
    readiness: COUNTERTOP_READINESS,
    placementState: COUNTERTOP_PLACEMENT_STATE,
    motionState: COUNTERTOP_MOTION_STATE,
    interactionState: COUNTERTOP_INTERACTION_STATE,
    changeReason: COUNTERTOP_CHANGE_REASON,
    errorCode: COUNTERTOP_ERROR_CODE
});

export { COUNTERTOP_CHANGE_REASON, COUNTERTOP_ERROR_CODE, COUNTERTOP_INTERACTION_STATE, COUNTERTOP_MOTION_STATE, COUNTERTOP_PLACEMENT_STATE, COUNTERTOP_PUBLIC_CONTRACT_V1, COUNTERTOP_READINESS };
