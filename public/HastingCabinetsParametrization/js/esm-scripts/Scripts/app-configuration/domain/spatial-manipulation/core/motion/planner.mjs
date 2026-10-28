import { SPATIAL_MANIPULATION_SCHEMA_VERSION } from '../contracts/constants.mjs';
import { throwSpatialInvalidInput } from '../contracts/errors.mjs';
import { deepFreeze, assertPlainData, assertExactKeys, pathOf } from '../contracts/immutable.mjs';
import { buildFramePointM, normalizeMotionFrameV1, requireVec3M } from './frame.mjs';
import { clampOffsetToBoundsM, normalizeMotionBoundsM } from './bounds.mjs';
import { normalizeUvM, resolveDragGridOffsetM, snapOffsetToGridM, normalizeMotionGrid, MOTION_AXES } from './grid.mjs';

const REQUEST_KEYS = [
    'schemaVersion',
    'instanceId',
    'commandId',
    'dependencyScopeId',
    'bindingGeneration',
    'frame',
    'policyRevision',
    'currentApplied',
    'expectedPoseRevision',
    'requestedOffsetM',
    'commandKind',
    'constraintMode',
    'gridMode',
    'motion',
    'snapResolution',
    'drag'
];
const CURRENT_APPLIED_KEYS = [
    'instanceId',
    'dependencyScopeId',
    'bindingGeneration',
    'frameRevision',
    'policyRevision',
    'poseRevision',
    'offsetM',
    'pivotWorldM'
];
const MOTION_KEYS = [
    'allowedAxes',
    'boundsM',
    'grid'
];
const DRAG_KEYS = [
    'rawOffsetM',
    'priorAppliedRequestM'
];
const SNAP_KEYS = [
    'schemaVersion',
    'proposedOffsetM',
    'correctionM',
    'snappedAxes',
    'pairs',
    'nextLatch',
    'diagnostics'
];
const COMMAND_KINDS = Object.freeze(new Set([
    'set',
    'move',
    'gesture-update',
    'reset',
    'align'
]));
const CONSTRAINT_MODES = Object.freeze(new Set([
    'respect',
    'bypass'
]));
const GRID_MODES = Object.freeze(new Set([
    'respect',
    'skip'
]));
const requireSchemaVersion = (value, path)=>{
    if (value !== SPATIAL_MANIPULATION_SCHEMA_VERSION) {
        throwSpatialInvalidInput(path);
    }
    return value;
};
const requireStringId = (value, path)=>{
    if (typeof value !== 'string' || value.length === 0) {
        throwSpatialInvalidInput(path);
    }
    return value;
};
const requireRevision = (value, path)=>{
    if (!Number.isSafeInteger(value) || value < 0) {
        throwSpatialInvalidInput(path);
    }
    return value;
};
const normalizeAxisList = (value, path)=>{
    if (!Array.isArray(value)) {
        throwSpatialInvalidInput(path);
    }
    const seen = new Set();
    return value.map((axis, index)=>{
        if (!MOTION_AXES.includes(axis) || seen.has(axis)) {
            throwSpatialInvalidInput(pathOf(path, index));
        }
        seen.add(axis);
        return axis;
    });
};
const normalizeMotion = (value, path)=>{
    assertPlainData(value, path);
    assertExactKeys(value, MOTION_KEYS, path);
    return {
        allowedAxes: normalizeAxisList(value.allowedAxes, pathOf(path, 'allowedAxes')),
        boundsM: normalizeMotionBoundsM(value.boundsM, pathOf(path, 'boundsM')),
        grid: normalizeMotionGrid(value.grid, pathOf(path, 'grid'))
    };
};
const normalizeCurrentApplied = (value, path)=>{
    assertPlainData(value, path);
    assertExactKeys(value, CURRENT_APPLIED_KEYS, path);
    return {
        instanceId: requireStringId(value.instanceId, pathOf(path, 'instanceId')),
        dependencyScopeId: requireStringId(value.dependencyScopeId, pathOf(path, 'dependencyScopeId')),
        bindingGeneration: requireRevision(value.bindingGeneration, pathOf(path, 'bindingGeneration')),
        frameRevision: requireRevision(value.frameRevision, pathOf(path, 'frameRevision')),
        policyRevision: requireRevision(value.policyRevision, pathOf(path, 'policyRevision')),
        poseRevision: requireRevision(value.poseRevision, pathOf(path, 'poseRevision')),
        offsetM: normalizeUvM(value.offsetM, pathOf(path, 'offsetM')),
        pivotWorldM: requireVec3M(value.pivotWorldM, pathOf(path, 'pivotWorldM'))
    };
};
const normalizeSnapResolution = (value, path)=>{
    if (value === null || value === undefined) return null;
    assertPlainData(value, path);
    assertExactKeys(value, SNAP_KEYS, path);
    requireSchemaVersion(value.schemaVersion, pathOf(path, 'schemaVersion'));
    return {
        schemaVersion: SPATIAL_MANIPULATION_SCHEMA_VERSION,
        proposedOffsetM: normalizeUvM(value.proposedOffsetM, pathOf(path, 'proposedOffsetM')),
        correctionM: normalizeUvM(value.correctionM, pathOf(path, 'correctionM')),
        snappedAxes: normalizeAxisList(value.snappedAxes, pathOf(path, 'snappedAxes')),
        pairs: Array.isArray(value.pairs) ? value.pairs : throwSpatialInvalidInput(pathOf(path, 'pairs')),
        nextLatch: value.nextLatch ?? null,
        diagnostics: Array.isArray(value.diagnostics) ? value.diagnostics : throwSpatialInvalidInput(pathOf(path, 'diagnostics'))
    };
};
const normalizeDrag = (value, path)=>{
    if (value === null || value === undefined) return null;
    assertPlainData(value, path);
    assertExactKeys(value, DRAG_KEYS, path);
    return {
        rawOffsetM: normalizeUvM(value.rawOffsetM, pathOf(path, 'rawOffsetM')),
        priorAppliedRequestM: normalizeUvM(value.priorAppliedRequestM, pathOf(path, 'priorAppliedRequestM'))
    };
};
const normalizeRequest = (request)=>{
    assertPlainData(request, '');
    assertExactKeys(request, REQUEST_KEYS, '');
    requireSchemaVersion(request.schemaVersion, 'schemaVersion');
    const commandKind = request.commandKind;
    if (!COMMAND_KINDS.has(commandKind)) {
        throwSpatialInvalidInput('commandKind');
    }
    const constraintMode = request.constraintMode ?? 'respect';
    if (!CONSTRAINT_MODES.has(constraintMode)) {
        throwSpatialInvalidInput('constraintMode');
    }
    const gridMode = request.gridMode ?? 'respect';
    if (!GRID_MODES.has(gridMode)) {
        throwSpatialInvalidInput('gridMode');
    }
    return {
        schemaVersion: SPATIAL_MANIPULATION_SCHEMA_VERSION,
        instanceId: requireStringId(request.instanceId, 'instanceId'),
        commandId: requireStringId(request.commandId, 'commandId'),
        dependencyScopeId: requireStringId(request.dependencyScopeId, 'dependencyScopeId'),
        bindingGeneration: requireRevision(request.bindingGeneration, 'bindingGeneration'),
        frame: normalizeMotionFrameV1(request.frame, 'frame'),
        policyRevision: requireRevision(request.policyRevision, 'policyRevision'),
        currentApplied: normalizeCurrentApplied(request.currentApplied, 'currentApplied'),
        expectedPoseRevision: requireRevision(request.expectedPoseRevision, 'expectedPoseRevision'),
        requestedOffsetM: normalizeUvM(request.requestedOffsetM, 'requestedOffsetM'),
        commandKind,
        constraintMode,
        gridMode,
        motion: normalizeMotion(request.motion, 'motion'),
        snapResolution: normalizeSnapResolution(request.snapResolution, 'snapResolution'),
        drag: normalizeDrag(request.drag, 'drag')
    };
};
const assertIdentity = (request)=>{
    const current = request.currentApplied;
    if (current.instanceId !== request.instanceId) {
        throwSpatialInvalidInput('currentApplied.instanceId');
    }
    if (current.dependencyScopeId !== request.dependencyScopeId) {
        throwSpatialInvalidInput('currentApplied.dependencyScopeId');
    }
    if (current.bindingGeneration !== request.bindingGeneration) {
        throwSpatialInvalidInput('currentApplied.bindingGeneration');
    }
    if (current.frameRevision !== request.frame.frameRevision) {
        throwSpatialInvalidInput('currentApplied.frameRevision');
    }
    if (current.policyRevision !== request.policyRevision) {
        throwSpatialInvalidInput('currentApplied.policyRevision');
    }
    if (current.poseRevision !== request.expectedPoseRevision) {
        throwSpatialInvalidInput('currentApplied.poseRevision');
    }
};
const assertCommandContract = (request)=>{
    if (request.constraintMode === 'bypass') {
        if (request.commandKind === 'gesture-update') {
            throwSpatialInvalidInput('constraintMode');
        }
        if (request.gridMode !== 'skip') {
            throwSpatialInvalidInput('gridMode');
        }
    }
    if (request.commandKind === 'gesture-update' && !request.drag) {
        throwSpatialInvalidInput('drag');
    }
    if (request.commandKind !== 'gesture-update' && request.drag !== null) {
        throwSpatialInvalidInput('drag');
    }
    if (request.commandKind !== 'gesture-update' && request.snapResolution !== null) {
        throwSpatialInvalidInput('snapResolution');
    }
    if (request.commandKind === 'align' && request.gridMode !== 'skip') {
        throwSpatialInvalidInput('gridMode');
    }
    if (request.commandKind === 'reset' && request.constraintMode !== 'bypass') {
        throwSpatialInvalidInput('constraintMode');
    }
};
const changedAxes = (beforeM, afterM)=>MOTION_AXES.filter((axis)=>!Object.is(beforeM[axis], afterM[axis]));
const makeCorrection = (order, kind, beforeM, afterM, reason, axes = changedAxes(beforeM, afterM))=>deepFreeze({
        order,
        kind,
        axes,
        ruleId: `motion.${kind}`,
        beforeM: {
            ...beforeM
        },
        afterM: {
            ...afterM
        },
        reason
    });
const addCorrection = (corrections, kind, beforeM, afterM, reason, axes)=>{
    const effectiveAxes = axes ?? changedAxes(beforeM, afterM);
    if (effectiveAxes.length === 0) return;
    corrections.push(makeCorrection(corrections.length, kind, beforeM, afterM, reason, effectiveAxes));
};
const applyAxisPermission = (requestedOffsetM, currentOffsetM, allowedAxes)=>{
    const allowed = new Set(allowedAxes);
    const offset = {
        ...requestedOffsetM
    };
    for (const axis of MOTION_AXES){
        if (!allowed.has(axis)) {
            offset[axis] = currentOffsetM[axis];
        }
    }
    return offset;
};
const resolveConstrainedOffsetM = (request)=>{
    const corrections = [];
    const currentOffsetM = request.currentApplied.offsetM;
    const requestedOffsetM = request.requestedOffsetM;
    let plannedOffsetM = applyAxisPermission(requestedOffsetM, currentOffsetM, request.motion.allowedAxes);
    addCorrection(corrections, 'axis-freeze', requestedOffsetM, plannedOffsetM, 'axis-not-allowed');
    if (request.snapResolution) {
        const beforeSnap = plannedOffsetM;
        plannedOffsetM = {
            ...plannedOffsetM
        };
        for (const axis of request.snapResolution.snappedAxes){
            plannedOffsetM[axis] = request.snapResolution.proposedOffsetM[axis];
        }
        addCorrection(corrections, 'semantic-snap', beforeSnap, plannedOffsetM, 'semantic-snap-resolution', request.snapResolution.snappedAxes.filter((axis)=>beforeSnap[axis] !== plannedOffsetM[axis]));
    }
    if (request.constraintMode === 'respect' && request.gridMode === 'respect') {
        const beforeGrid = plannedOffsetM;
        const semanticAxes = request.snapResolution?.snappedAxes ?? [];
        plannedOffsetM = request.commandKind === 'gesture-update' ? resolveDragGridOffsetM({
            rawOffsetM: request.drag.rawOffsetM,
            priorAppliedRequestM: plannedOffsetM,
            currentOffsetM,
            grid: request.motion.grid,
            allowedAxes: request.motion.allowedAxes,
            semanticSnappedAxes: semanticAxes
        }) : snapOffsetToGridM(plannedOffsetM, request.motion.grid, request.motion.allowedAxes);
        addCorrection(corrections, 'grid', beforeGrid, plannedOffsetM, 'grid');
    }
    if (request.constraintMode === 'respect') {
        const beforeBounds = plannedOffsetM;
        const bounded = clampOffsetToBoundsM(plannedOffsetM, request.motion.boundsM);
        plannedOffsetM = bounded.offsetM;
        addCorrection(corrections, 'bounds', beforeBounds, plannedOffsetM, 'bounds', bounded.clampedAxes);
    }
    return {
        plannedOffsetM,
        corrections
    };
};
const computeDeltaWorldM = (frame, currentOffsetM, plannedOffsetM)=>{
    const du = plannedOffsetM.u - currentOffsetM.u;
    const dv = plannedOffsetM.v - currentOffsetM.v;
    return {
        x: frame.uAxis.x * du + frame.vAxis.x * dv,
        y: frame.uAxis.y * du + frame.vAxis.y * dv,
        z: frame.uAxis.z * du + frame.vAxis.z * dv
    };
};
function createMotionPlanV1(input) {
    const request = normalizeRequest(input);
    assertIdentity(request);
    assertCommandContract(request);
    const { plannedOffsetM, corrections } = resolveConstrainedOffsetM(request);
    const requested = {
        offsetM: {
            ...request.requestedOffsetM
        },
        pivotWorldM: buildFramePointM(request.frame, request.requestedOffsetM)
    };
    const planned = {
        offsetM: {
            ...plannedOffsetM
        },
        pivotWorldM: buildFramePointM(request.frame, plannedOffsetM)
    };
    return deepFreeze({
        schemaVersion: SPATIAL_MANIPULATION_SCHEMA_VERSION,
        instanceId: request.instanceId,
        commandId: request.commandId,
        dependencyScopeId: request.dependencyScopeId,
        bindingGeneration: request.bindingGeneration,
        frameRevision: request.frame.frameRevision,
        policyRevision: request.policyRevision,
        expectedPoseRevision: request.expectedPoseRevision,
        requested,
        planned,
        deltaWorldM: computeDeltaWorldM(request.frame, request.currentApplied.offsetM, plannedOffsetM),
        corrections
    });
}

export { createMotionPlanV1 };
