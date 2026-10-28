import { deepFreeze } from '../../spatial-manipulation/core/contracts/immutable.mjs';

const MODULES_READINESS = deepFreeze({
    WAITING: 'waiting',
    READY: 'ready'
});
const MODULES_PLACEMENT_STATE = deepFreeze({
    WAITING: 'waiting',
    STANDARD: 'standard',
    MOVED: 'moved'
});
const MODULES_MOTION_STATE = deepFreeze({
    IDLE: 'idle',
    MOVING: 'moving'
});
const MODULES_INTERACTION_STATE = deepFreeze({
    IDLE: 'idle',
    SELECTED: 'selected',
    DRAGGING: 'dragging'
});
const MODULES_RELATION_STATE = deepFreeze({
    UNKNOWN: 'unknown',
    FREE: 'free',
    LAYOUT_ADJACENT: 'layout-adjacent',
    SNAPPED: 'snapped',
    TOUCHING: 'touching',
    COLLIDING: 'colliding'
});
const MODULES_RELATION_KIND = deepFreeze({
    ALIGNED: 'aligned',
    TOUCHING: 'touching'
});
const MODULES_RELATION_MODE = deepFreeze({
    SIDE_BY_SIDE: 'side-by-side',
    ROW_EDGE: 'row-edge',
    FLUSH: 'flush',
    CENTERED: 'centered',
    FLOOR: 'floor',
    STACKED: 'stacked',
    LEVEL: 'level',
    ALIGNED: 'aligned'
});
const MODULES_CHANGE_REASON = deepFreeze({
    CURRENT: 'current',
    SELECTION: 'selection',
    DRAG_ENABLED: 'drag-enabled',
    REGISTERED: 'registered',
    REMOVED: 'removed',
    MOVE: 'move',
    OFFSET: 'offset',
    DRAG: 'drag',
    DRAG_START: 'drag-start',
    DRAG_END: 'drag-end',
    DRAG_CANCEL: 'drag-cancel',
    COLLISION: 'collision',
    COMPOSITION_ACTIVATED: 'composition-activated'
});
const MODULES_ERROR_CODE = deepFreeze({
    INVALID_INPUT: 'MODULES_INVALID_INPUT',
    NOT_READY: 'MODULES_NOT_READY',
    DESTROYED: 'MODULES_DESTROYED',
    MODULE_NOT_FOUND: 'MODULE_NOT_FOUND'
});
const MODULES_PUBLIC_CONTRACT_V1 = deepFreeze({
    version: 1,
    readiness: MODULES_READINESS,
    placementState: MODULES_PLACEMENT_STATE,
    motionState: MODULES_MOTION_STATE,
    interactionState: MODULES_INTERACTION_STATE,
    relationState: MODULES_RELATION_STATE,
    relationKind: MODULES_RELATION_KIND,
    relationMode: MODULES_RELATION_MODE,
    changeReason: MODULES_CHANGE_REASON,
    errorCode: MODULES_ERROR_CODE
});

export { MODULES_CHANGE_REASON, MODULES_ERROR_CODE, MODULES_INTERACTION_STATE, MODULES_MOTION_STATE, MODULES_PLACEMENT_STATE, MODULES_PUBLIC_CONTRACT_V1, MODULES_READINESS, MODULES_RELATION_KIND, MODULES_RELATION_MODE, MODULES_RELATION_STATE };
