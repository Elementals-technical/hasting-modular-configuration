const COUNTERTOP_MOVEMENT_AXIS = Object.freeze({
    X: 'x',
    Y: 'y'
});
const SUPPORTED_AXIS_KEYS = Object.freeze([
    'min',
    'max'
]);
const SUPPORTED_BOUNDS_KEYS = Object.freeze([
    'x',
    'y'
]);
const SUPPORTED_GRID_KEYS = Object.freeze([
    'x',
    'y'
]);
const COUNTERTOP_MOVEMENT_APPLY_STATUS = Object.freeze({
    ACCEPTED: 'accepted',
    REJECTED: 'rejected'
});
const COUNTERTOP_MOVEMENT_ERROR = Object.freeze({
    INVALID_BOUNDS: 'invalid-bounds',
    INVALID_GRID: 'invalid-grid'
});
const AXES_2D = Object.freeze([
    COUNTERTOP_MOVEMENT_AXIS.X,
    COUNTERTOP_MOVEMENT_AXIS.Y
]);
const isObject = (value)=>value !== null && typeof value === 'object' && !Array.isArray(value);
const finiteNumberOrNull = (value)=>{
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
};
const resolveOffsetM = (offset)=>{
    const source = offset || {};
    return {
        x: finiteNumberOrNull(source.x) ?? 0,
        y: finiteNumberOrNull(source.y) ?? 0
    };
};
const readAxisBounds = (bounds)=>{
    if (!isObject(bounds)) return false;
    const keys = Object.keys(bounds);
    if (keys.length !== SUPPORTED_AXIS_KEYS.length || SUPPORTED_AXIS_KEYS.some((key)=>!Object.prototype.hasOwnProperty.call(bounds, key))) {
        return false;
    }
    const min = finiteNumberOrNull(bounds.min);
    const max = finiteNumberOrNull(bounds.max);
    if (min === null || max === null || min > max) return false;
    return Object.freeze({
        min,
        max
    });
};
function normalizeCountertopMovementBoundsM(input) {
    if (!isObject(input)) {
        return Object.freeze({});
    }
    const topLevelKeys = Object.keys(input);
    if (topLevelKeys.some((key)=>!SUPPORTED_BOUNDS_KEYS.includes(key))) {
        return null;
    }
    const hasX = Object.prototype.hasOwnProperty.call(input, 'x');
    const hasY = Object.prototype.hasOwnProperty.call(input, 'y');
    const xBounds = hasX ? readAxisBounds(input.x) : null;
    const yBounds = hasY ? readAxisBounds(input.y) : null;
    if (xBounds === false || yBounds === false) return null;
    return Object.freeze({
        ...hasX ? {
            x: xBounds
        } : {},
        ...hasY ? {
            y: yBounds
        } : {}
    });
}
function normalizeCountertopMovementGridM(input) {
    if (!isObject(input)) {
        return Object.freeze({});
    }
    const topLevelKeys = Object.keys(input);
    if (topLevelKeys.some((key)=>!SUPPORTED_GRID_KEYS.includes(key))) {
        return null;
    }
    const gridM = {};
    for (const axis of AXES_2D){
        if (!Object.prototype.hasOwnProperty.call(input, axis)) continue;
        const value = input[axis];
        if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
            return null;
        }
        gridM[axis] = value;
    }
    return Object.freeze(gridM);
}
const snapAxisToGridM = (value, gridSizeM)=>{
    if (!gridSizeM) return value;
    const scaled = value / gridSizeM;
    const sign = Math.sign(scaled);
    const absolute = Math.abs(scaled);
    const lower = Math.floor(absolute);
    const fraction = absolute - lower;
    const snappedUnits = fraction < 0.5 ? lower : lower + 1;
    const snapped = sign * snappedUnits * gridSizeM;
    return Object.is(snapped, -0) ? 0 : snapped;
};
function snapCountertopMovementOffsetM(offsetM = {}, movementGridM = null) {
    const offset = resolveOffsetM(offsetM);
    const gridM = normalizeCountertopMovementGridM(movementGridM);
    if (gridM === null) return null;
    return Object.freeze({
        x: snapAxisToGridM(offset.x, gridM.x),
        y: snapAxisToGridM(offset.y, gridM.y)
    });
}
const noClampAxes = Object.freeze({
    x: false,
    y: false
});
function calculateCountertopMovementOffsetM({ currentOffsetM = {}, relativeDeltaOffsetM = {}, movementBoundsM = null, movementGridM = null } = {}) {
    const currentOffset = resolveOffsetM(currentOffsetM);
    const deltaOffset = resolveOffsetM(relativeDeltaOffsetM);
    const requestedOffsetM = Object.freeze({
        x: currentOffset.x + deltaOffset.x,
        y: currentOffset.y + deltaOffset.y
    });
    const boundsM = normalizeCountertopMovementBoundsM(movementBoundsM);
    if (boundsM === null) {
        return Object.freeze({
            status: COUNTERTOP_MOVEMENT_APPLY_STATUS.REJECTED,
            reason: COUNTERTOP_MOVEMENT_ERROR.INVALID_BOUNDS,
            requestedOffsetM,
            effectiveOffsetM: Object.freeze({
                ...currentOffset
            }),
            clampedAxes: noClampAxes
        });
    }
    const snappedOffsetM = snapCountertopMovementOffsetM(requestedOffsetM, movementGridM);
    if (snappedOffsetM === null) {
        return Object.freeze({
            status: COUNTERTOP_MOVEMENT_APPLY_STATUS.REJECTED,
            reason: COUNTERTOP_MOVEMENT_ERROR.INVALID_GRID,
            requestedOffsetM,
            effectiveOffsetM: Object.freeze({
                ...currentOffset
            }),
            clampedAxes: noClampAxes
        });
    }
    const effectiveOffsetM = {
        x: snappedOffsetM.x,
        y: snappedOffsetM.y
    };
    const clampedAxes = {
        x: false,
        y: false
    };
    for (const axis of AXES_2D){
        const bounds = boundsM[axis];
        if (!bounds) continue;
        const snapped = snappedOffsetM[axis];
        if (snapped < bounds.min) {
            clampedAxes[axis] = true;
            effectiveOffsetM[axis] = bounds.min;
        } else if (snapped > bounds.max) {
            clampedAxes[axis] = true;
            effectiveOffsetM[axis] = bounds.max;
        }
    }
    return Object.freeze({
        status: COUNTERTOP_MOVEMENT_APPLY_STATUS.ACCEPTED,
        reason: null,
        requestedOffsetM,
        effectiveOffsetM: Object.freeze(effectiveOffsetM),
        clampedAxes: Object.freeze(clampedAxes)
    });
}
function calculateCountertopCanMoveM({ currentOffsetM = {}, movementBoundsM = null, enabled = true } = {}) {
    const currentOffset = resolveOffsetM(currentOffsetM);
    const boundsM = normalizeCountertopMovementBoundsM(movementBoundsM);
    const disabled = Object.freeze({
        left: false,
        right: false,
        up: false,
        down: false
    });
    if (!enabled || boundsM === null) {
        return disabled;
    }
    return Object.freeze({
        left: boundsM.x ? currentOffset.x > boundsM.x.min : true,
        right: boundsM.x ? currentOffset.x < boundsM.x.max : true,
        up: boundsM.y ? currentOffset.y < boundsM.y.max : true,
        down: boundsM.y ? currentOffset.y > boundsM.y.min : true
    });
}

export { COUNTERTOP_MOVEMENT_APPLY_STATUS, COUNTERTOP_MOVEMENT_ERROR, calculateCountertopCanMoveM, calculateCountertopMovementOffsetM, normalizeCountertopMovementBoundsM, normalizeCountertopMovementGridM, snapCountertopMovementOffsetM };
