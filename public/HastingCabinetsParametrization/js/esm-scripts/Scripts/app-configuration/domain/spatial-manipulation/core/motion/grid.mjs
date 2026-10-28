import { throwSpatialInvalidInput } from '../contracts/errors.mjs';
import { deepFreeze, assertPlainData, assertExactKeys, pathOf } from '../contracts/immutable.mjs';

const MOTION_AXES = Object.freeze([
    'u',
    'v'
]);
const DEFAULT_DRAG_HYSTERESIS_RATIO = 0.1;
const GRID_KEYS = [
    'originM',
    'stepM',
    'dragHysteresisRatio'
];
const UV_KEYS = [
    'u',
    'v'
];
const FLOAT_COMPARISON_ULPS = 8;
const requireNumber = (value, path)=>{
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throwSpatialInvalidInput(path);
    }
    return value;
};
const normalizeUvM = (value, path = 'offsetM', defaults = {
    u: 0,
    v: 0
})=>{
    assertPlainData(value, path);
    assertExactKeys(value, UV_KEYS, path);
    return {
        u: Object.hasOwn(value, 'u') ? requireNumber(value.u, pathOf(path, 'u')) : defaults.u,
        v: Object.hasOwn(value, 'v') ? requireNumber(value.v, pathOf(path, 'v')) : defaults.v
    };
};
const normalizeGridOriginM = (value, path)=>{
    assertExactKeys(value, UV_KEYS, path);
    return {
        u: Object.hasOwn(value, 'u') ? requireNumber(value.u, pathOf(path, 'u')) : 0,
        v: Object.hasOwn(value, 'v') ? requireNumber(value.v, pathOf(path, 'v')) : 0
    };
};
const normalizeGridStepM = (value, path)=>{
    assertExactKeys(value, UV_KEYS, path);
    const stepM = {};
    for (const axis of MOTION_AXES){
        if (!Object.hasOwn(value, axis)) continue;
        const step = requireNumber(value[axis], pathOf(path, axis));
        if (step <= 0) {
            throwSpatialInvalidInput(pathOf(path, axis));
        }
        stepM[axis] = step;
    }
    return stepM;
};
const normalizeMotionGrid = (value, path = 'grid')=>{
    if (value === null || value === undefined) {
        return deepFreeze({
            originM: {
                u: 0,
                v: 0
            },
            stepM: {},
            dragHysteresisRatio: DEFAULT_DRAG_HYSTERESIS_RATIO
        });
    }
    assertPlainData(value, path);
    assertExactKeys(value, GRID_KEYS, path);
    const dragHysteresisRatio = requireNumber(value.dragHysteresisRatio, pathOf(path, 'dragHysteresisRatio'));
    if (dragHysteresisRatio < 0 || dragHysteresisRatio >= 0.5) {
        throwSpatialInvalidInput(pathOf(path, 'dragHysteresisRatio'));
    }
    return deepFreeze({
        originM: normalizeGridOriginM(value.originM, pathOf(path, 'originM')),
        stepM: normalizeGridStepM(value.stepM, pathOf(path, 'stepM')),
        dragHysteresisRatio
    });
};
const sameNumberM = (left, right)=>{
    if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
    if (Object.is(left, right)) return true;
    const scale = Math.max(Math.abs(left), Math.abs(right), 1);
    return Math.abs(left - right) <= Number.EPSILON * FLOAT_COMPARISON_ULPS * scale;
};
const snapAxisToGridM = (valueM, originM, stepM)=>{
    if (!Number.isFinite(stepM) || stepM <= 0) return valueM;
    const scaled = (valueM - originM) / stepM;
    const sign = Math.sign(scaled);
    const absolute = Math.abs(scaled);
    const lower = Math.floor(absolute);
    const fraction = absolute - lower;
    const unitTolerance = Number.EPSILON * FLOAT_COMPARISON_ULPS;
    const snappedUnits = fraction + unitTolerance < 0.5 ? lower : lower + 1;
    const snapped = originM + sign * snappedUnits * stepM;
    return Object.is(snapped, -0) ? 0 : snapped;
};
const resolveHystereticGridAxisM = (rawValueM, appliedValueM, originM, stepM, dragHysteresisRatio)=>{
    if (sameNumberM(rawValueM, appliedValueM)) return appliedValueM;
    if (!Number.isFinite(stepM) || stepM <= 0) return rawValueM;
    const snappedAppliedM = snapAxisToGridM(appliedValueM, originM, stepM);
    if (!sameNumberM(snappedAppliedM, appliedValueM)) {
        const snappedRawM = snapAxisToGridM(rawValueM, originM, stepM);
        return (rawValueM - appliedValueM) * (snappedRawM - appliedValueM) < 0 ? appliedValueM : snappedRawM;
    }
    const deltaUnits = (rawValueM - snappedAppliedM) / stepM;
    if (!Number.isFinite(deltaUnits)) return snapAxisToGridM(rawValueM, originM, stepM);
    const thresholdUnits = 0.5 + dragHysteresisRatio;
    const absoluteUnits = Math.abs(deltaUnits);
    const unitTolerance = Number.EPSILON * FLOAT_COMPARISON_ULPS;
    if (absoluteUnits + unitTolerance < thresholdUnits) return snappedAppliedM;
    const crossedSteps = 1 + Math.floor(absoluteUnits - thresholdUnits + unitTolerance);
    return snappedAppliedM + Math.sign(deltaUnits) * crossedSteps * stepM;
};
const normalizeAxisSet = (axes, path)=>{
    if (axes === null || axes === undefined) return new Set(MOTION_AXES);
    if (!Array.isArray(axes)) throwSpatialInvalidInput(path);
    const set = new Set();
    axes.forEach((axis, index)=>{
        if (!MOTION_AXES.includes(axis) || set.has(axis)) {
            throwSpatialInvalidInput(pathOf(path, index));
        }
        set.add(axis);
    });
    return set;
};
const snapOffsetToGridM = (offsetM, grid, allowedAxes = MOTION_AXES)=>{
    const offset = normalizeUvM(offsetM, 'offsetM');
    const normalizedGrid = normalizeMotionGrid(grid);
    const allowed = normalizeAxisSet(allowedAxes, 'allowedAxes');
    const snapped = {
        ...offset
    };
    for (const axis of MOTION_AXES){
        if (!allowed.has(axis)) continue;
        snapped[axis] = snapAxisToGridM(offset[axis], normalizedGrid.originM[axis], normalizedGrid.stepM[axis]);
    }
    return deepFreeze(snapped);
};
const resolveDragGridOffsetM = ({ rawOffsetM, priorAppliedRequestM, currentOffsetM, grid, allowedAxes, semanticSnappedAxes } = {})=>{
    const raw = normalizeUvM(rawOffsetM, 'rawOffsetM');
    const requested = normalizeUvM(priorAppliedRequestM, 'priorAppliedRequestM');
    const current = normalizeUvM(currentOffsetM, 'currentOffsetM');
    const normalizedGrid = normalizeMotionGrid(grid);
    const allowed = normalizeAxisSet(allowedAxes, 'allowedAxes');
    const semantic = normalizeAxisSet(semanticSnappedAxes ?? [], 'semanticSnappedAxes');
    const result = {
        ...current
    };
    for (const axis of MOTION_AXES){
        if (!allowed.has(axis)) continue;
        result[axis] = semantic.has(axis) ? requested[axis] : resolveHystereticGridAxisM(raw[axis], current[axis], normalizedGrid.originM[axis], normalizedGrid.stepM[axis], normalizedGrid.dragHysteresisRatio);
    }
    return deepFreeze(result);
};

export { DEFAULT_DRAG_HYSTERESIS_RATIO, MOTION_AXES, normalizeMotionGrid, normalizeUvM, resolveDragGridOffsetM, snapAxisToGridM, snapOffsetToGridM };
