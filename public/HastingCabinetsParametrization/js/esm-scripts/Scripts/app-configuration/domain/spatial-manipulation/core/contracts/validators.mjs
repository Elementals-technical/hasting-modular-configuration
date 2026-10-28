import { SPATIAL_MANIPULATION_SCHEMA_VERSION } from './constants.mjs';
import { throwSpatialInvalidInput } from './errors.mjs';
import { assertPlainData, assertExactKeys, deepFreeze, pathOf } from './immutable.mjs';
import { normalizeMotionFrameV1 } from '../motion/frame.mjs';

const CONFIG_KEYS = [
    'schemaVersion',
    'instanceId',
    'objectId',
    'scopeId',
    'frame',
    'motion',
    'snapping',
    'collision'
];
const MOTION_KEYS = [
    'allowedAxes',
    'boundsM',
    'grid'
];
const BOUNDS_KEYS = [
    'u',
    'v'
];
const BOUND_KEYS = [
    'min',
    'max'
];
const GRID_KEYS = [
    'originM',
    'stepM',
    'dragHysteresisRatio'
];
const UV_KEYS = [
    'u',
    'v'
];
const SNAPPING_KEYS = [
    'enabled',
    'profile',
    'pointerProfiles'
];
const POINTER_PROFILE_KEYS = [
    'mouse',
    'touch'
];
const THRESHOLD_KEYS = [
    'engagePx',
    'releasePx',
    'switchMarginPx',
    'tieEpsilonPx'
];
const PROFILE_KEYS = [
    'id',
    'version'
];
const COLLISION_KEYS = [
    'enabled',
    'mode',
    'epsilonM',
    'profile'
];
const BINDING_KEYS = [
    'schemaVersion',
    'instanceId',
    'objectId',
    'bindingGeneration',
    'readiness',
    'dependencyScopeId',
    'transformGroupId',
    'pickTargetIds',
    'transformTargetIds',
    'affectedTransformIds',
    'spatialDependencyTransformIds',
    'presentationTargetIds',
    'hierarchy'
];
const HIERARCHY_KEYS = [
    'schemaVersion',
    'hierarchyRevision',
    'nodes'
];
const HIERARCHY_NODE_KEYS = [
    'transformId',
    'parentTransformId'
];
const VALID_AXES = Object.freeze(new Set([
    'u',
    'v'
]));
const VALID_BINDING_READINESS = Object.freeze(new Set([
    'ready',
    'pending',
    'unsupported'
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
const requireBool = (value, path)=>{
    if (typeof value !== 'boolean') {
        throwSpatialInvalidInput(path);
    }
    return value;
};
const requireNumber = (value, path)=>{
    if (typeof value !== 'number' || !Number.isFinite(value)) {
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
const requirePositiveVersion = (value, path)=>{
    if (!Number.isSafeInteger(value) || value <= 0) {
        throwSpatialInvalidInput(path);
    }
    return value;
};
const requireArray = (value, path)=>{
    if (!Array.isArray(value)) {
        throwSpatialInvalidInput(path);
    }
    return value;
};
const requireUniqueStringIds = (value, path)=>{
    const input = requireArray(value, path);
    const seen = new Set();
    return input.map((item, index)=>{
        const field = pathOf(path, index);
        const id = requireStringId(item, field);
        if (seen.has(id)) {
            throwSpatialInvalidInput(field);
        }
        seen.add(id);
        return id;
    });
};
const requireAllowedAxes = (value, path)=>{
    const input = requireArray(value, path);
    const seen = new Set();
    return input.map((item, index)=>{
        const field = pathOf(path, index);
        if (!VALID_AXES.has(item)) {
            throwSpatialInvalidInput(field);
        }
        if (seen.has(item)) {
            throwSpatialInvalidInput(field);
        }
        seen.add(item);
        return item;
    });
};
const requireUvNumbers = (value, path)=>{
    assertExactKeys(value, UV_KEYS, path);
    return {
        u: requireNumber(value.u, pathOf(path, 'u')),
        v: requireNumber(value.v, pathOf(path, 'v'))
    };
};
const normalizeBoundsM = (value, path)=>{
    assertExactKeys(value, BOUNDS_KEYS, path);
    const bounds = {};
    for (const axis of BOUNDS_KEYS){
        if (Object.hasOwn(value, axis)) {
            const field = pathOf(path, axis);
            assertExactKeys(value[axis], BOUND_KEYS, field);
            const min = requireNumber(value[axis].min, pathOf(field, 'min'));
            const max = requireNumber(value[axis].max, pathOf(field, 'max'));
            if (min > max) {
                throwSpatialInvalidInput(field);
            }
            bounds[axis] = {
                min,
                max
            };
        }
    }
    return bounds;
};
const normalizeGrid = (value, path)=>{
    assertExactKeys(value, GRID_KEYS, path);
    const originM = requireUvNumbers(value.originM, pathOf(path, 'originM'));
    const stepPath = pathOf(path, 'stepM');
    assertExactKeys(value.stepM, UV_KEYS, stepPath);
    const stepM = {};
    for (const axis of UV_KEYS){
        if (Object.hasOwn(value.stepM, axis)) {
            const field = pathOf(stepPath, axis);
            const step = requireNumber(value.stepM[axis], field);
            if (step <= 0) {
                throwSpatialInvalidInput(field);
            }
            stepM[axis] = step;
        }
    }
    const dragHysteresisRatio = requireNumber(value.dragHysteresisRatio, pathOf(path, 'dragHysteresisRatio'));
    if (dragHysteresisRatio < 0 || dragHysteresisRatio >= 0.5) {
        throwSpatialInvalidInput(pathOf(path, 'dragHysteresisRatio'));
    }
    return {
        originM,
        stepM,
        dragHysteresisRatio
    };
};
const normalizeProfileRef = (value, path)=>{
    assertExactKeys(value, PROFILE_KEYS, path);
    return {
        id: requireStringId(value.id, pathOf(path, 'id')),
        version: requirePositiveVersion(value.version, pathOf(path, 'version'))
    };
};
const normalizeThresholds = (value, path)=>{
    assertExactKeys(value, THRESHOLD_KEYS, path);
    const engagePx = requireNumber(value.engagePx, pathOf(path, 'engagePx'));
    const releasePx = requireNumber(value.releasePx, pathOf(path, 'releasePx'));
    const switchMarginPx = requireNumber(value.switchMarginPx, pathOf(path, 'switchMarginPx'));
    const tieEpsilonPx = requireNumber(value.tieEpsilonPx, pathOf(path, 'tieEpsilonPx'));
    if (engagePx < 0) {
        throwSpatialInvalidInput(pathOf(path, 'engagePx'));
    }
    if (releasePx <= engagePx) {
        throwSpatialInvalidInput(pathOf(path, 'releasePx'));
    }
    if (switchMarginPx < 0) {
        throwSpatialInvalidInput(pathOf(path, 'switchMarginPx'));
    }
    if (tieEpsilonPx < 0) {
        throwSpatialInvalidInput(pathOf(path, 'tieEpsilonPx'));
    }
    return {
        engagePx,
        releasePx,
        switchMarginPx,
        tieEpsilonPx
    };
};
const normalizePointerProfiles = (value, path)=>{
    assertExactKeys(value, POINTER_PROFILE_KEYS, path);
    return {
        mouse: normalizeThresholds(value.mouse, pathOf(path, 'mouse')),
        touch: normalizeThresholds(value.touch, pathOf(path, 'touch'))
    };
};
const validateManipulationConfigV1 = (value)=>{
    assertPlainData(value, '');
    assertExactKeys(value, CONFIG_KEYS, '');
    const snappingPath = 'snapping';
    const collisionPath = 'collision';
    assertExactKeys(value.motion, MOTION_KEYS, 'motion');
    assertExactKeys(value.snapping, SNAPPING_KEYS, snappingPath);
    assertExactKeys(value.collision, COLLISION_KEYS, collisionPath);
    const collisionMode = value.collision.mode;
    if (collisionMode !== 'observe') {
        throwSpatialInvalidInput(pathOf(collisionPath, 'mode'));
    }
    const epsilonM = requireNumber(value.collision.epsilonM, pathOf(collisionPath, 'epsilonM'));
    if (epsilonM < 0) {
        throwSpatialInvalidInput(pathOf(collisionPath, 'epsilonM'));
    }
    return deepFreeze({
        schemaVersion: requireSchemaVersion(value.schemaVersion, 'schemaVersion'),
        instanceId: requireStringId(value.instanceId, 'instanceId'),
        objectId: requireStringId(value.objectId, 'objectId'),
        scopeId: requireStringId(value.scopeId, 'scopeId'),
        frame: normalizeMotionFrameV1(value.frame, 'frame'),
        motion: {
            allowedAxes: requireAllowedAxes(value.motion.allowedAxes, 'motion.allowedAxes'),
            boundsM: normalizeBoundsM(value.motion.boundsM, 'motion.boundsM'),
            grid: normalizeGrid(value.motion.grid, 'motion.grid')
        },
        snapping: {
            enabled: requireBool(value.snapping.enabled, pathOf(snappingPath, 'enabled')),
            profile: normalizeProfileRef(value.snapping.profile, pathOf(snappingPath, 'profile')),
            pointerProfiles: normalizePointerProfiles(value.snapping.pointerProfiles, pathOf(snappingPath, 'pointerProfiles'))
        },
        collision: {
            enabled: requireBool(value.collision.enabled, pathOf(collisionPath, 'enabled')),
            mode: collisionMode,
            epsilonM,
            profile: normalizeProfileRef(value.collision.profile, pathOf(collisionPath, 'profile'))
        }
    });
};
const normalizeHierarchy = (value, path, requiredNodeIds)=>{
    assertExactKeys(value, HIERARCHY_KEYS, path);
    const nodesInput = requireArray(value.nodes, pathOf(path, 'nodes'));
    const seen = new Set();
    const parentById = new Map();
    const nodes = nodesInput.map((node, index)=>{
        const nodePath = pathOf(pathOf(path, 'nodes'), index);
        assertExactKeys(node, HIERARCHY_NODE_KEYS, nodePath);
        const transformId = requireStringId(node.transformId, pathOf(nodePath, 'transformId'));
        if (seen.has(transformId)) {
            throwSpatialInvalidInput(pathOf(nodePath, 'transformId'));
        }
        seen.add(transformId);
        const parentTransformId = node.parentTransformId;
        if (parentTransformId !== null) {
            requireStringId(parentTransformId, pathOf(nodePath, 'parentTransformId'));
            if (parentTransformId === transformId) {
                throwSpatialInvalidInput(pathOf(nodePath, 'parentTransformId'));
            }
        }
        parentById.set(transformId, parentTransformId);
        return {
            transformId,
            parentTransformId
        };
    });
    for (const parentTransformId of parentById.values()){
        if (parentTransformId !== null && !parentById.has(parentTransformId)) {
            throwSpatialInvalidInput(pathOf(path, 'nodes'));
        }
    }
    for (const transformId of parentById.keys()){
        const visiting = new Set();
        let current = transformId;
        while(current !== null){
            if (visiting.has(current)) {
                throwSpatialInvalidInput(pathOf(path, 'nodes'));
            }
            visiting.add(current);
            current = parentById.get(current);
            if (current !== null && current !== undefined && !parentById.has(current)) {
                throwSpatialInvalidInput(pathOf(path, 'nodes'));
            }
        }
    }
    for (const requiredId of requiredNodeIds){
        if (!parentById.has(requiredId)) {
            throwSpatialInvalidInput(pathOf(path, 'nodes'));
        }
    }
    return {
        schemaVersion: requireSchemaVersion(value.schemaVersion, pathOf(path, 'schemaVersion')),
        hierarchyRevision: requireRevision(value.hierarchyRevision, pathOf(path, 'hierarchyRevision')),
        nodes
    };
};
const validateRuntimeBindingV1 = (value)=>{
    assertPlainData(value, '');
    assertExactKeys(value, BINDING_KEYS, '');
    const readiness = value.readiness;
    if (!VALID_BINDING_READINESS.has(readiness)) {
        throwSpatialInvalidInput('readiness');
    }
    const pickTargetIds = requireUniqueStringIds(value.pickTargetIds, 'pickTargetIds');
    const transformTargetIds = requireUniqueStringIds(value.transformTargetIds, 'transformTargetIds');
    const affectedTransformIds = requireUniqueStringIds(value.affectedTransformIds, 'affectedTransformIds');
    const spatialDependencyTransformIds = requireUniqueStringIds(value.spatialDependencyTransformIds, 'spatialDependencyTransformIds');
    const presentationTargetIds = requireUniqueStringIds(value.presentationTargetIds, 'presentationTargetIds');
    const hierarchy = normalizeHierarchy(value.hierarchy, 'hierarchy', new Set([
        ...transformTargetIds,
        ...spatialDependencyTransformIds
    ]));
    return deepFreeze({
        schemaVersion: requireSchemaVersion(value.schemaVersion, 'schemaVersion'),
        instanceId: requireStringId(value.instanceId, 'instanceId'),
        objectId: requireStringId(value.objectId, 'objectId'),
        bindingGeneration: requireRevision(value.bindingGeneration, 'bindingGeneration'),
        readiness,
        dependencyScopeId: requireStringId(value.dependencyScopeId, 'dependencyScopeId'),
        transformGroupId: requireStringId(value.transformGroupId, 'transformGroupId'),
        pickTargetIds,
        transformTargetIds,
        affectedTransformIds,
        spatialDependencyTransformIds,
        presentationTargetIds,
        hierarchy
    });
};

export { validateManipulationConfigV1, validateRuntimeBindingV1 };
