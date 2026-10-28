import { SPATIAL_MANIPULATION_ERROR_CODE, throwSpatialInvalidInput } from '../core/contracts/errors.mjs';
import { assertPlainData, assertExactKeys, deepFreeze, pathOf } from '../core/contracts/immutable.mjs';
import { createSpatialError, createDefaultCollisionObservation, createDefaultSnapObservation, copyPlainData, createObservationSet } from './reports.mjs';
import { createCollisionObservationSetV1 } from '../core/collision/observation.mjs';
import { evaluateAabbCollisionsM } from '../core/collision/aabb.mjs';

// Module-level helpers of the manipulation instance (validation, tuples, observations, ids).
// Split out of instance.mjs (spatial-manipulation V2, P2); behaviour unchanged.
const MOTION_SOURCE = new Set([
    'pointer',
    'api',
    'host',
    'restore'
]);
const CONSTRAINT_MODES = new Set([
    'respect',
    'bypass'
]);
const GRID_MODES = new Set([
    'respect',
    'skip'
]);
const UV_KEYS = [
    'u',
    'v'
];
const OPTIONS_KEYS = [
    'constraintMode',
    'gridMode'
];
const RESET_KEYS = [
    'offsetM',
    'constraintMode'
];
const META_KEYS = [
    'commandId',
    'correlationId',
    'source'
];
const APPLIED_POSE_KEYS = [
    'instanceId',
    'bindingGeneration',
    'poseRevision',
    'offsetM',
    'pivotWorldM'
];
const VEC3_KEYS = [
    'x',
    'y',
    'z'
];
const COLLISION_SNAPSHOT_KEYS = [
    'schemaVersion',
    'readiness',
    'coverage',
    'instanceId',
    'objectId',
    'dependencyScopeId',
    'bindingGeneration',
    'worldSpaceId',
    'frameId',
    'frameRevision',
    'policyRevision',
    'sourceGeometryRevision',
    'targetSceneRevision',
    'queryRevision',
    'membershipRevision',
    'queryId',
    'referenceSourcePivotM',
    'sourceVolumes',
    'targetVolumes',
    'missing',
    'diagnostics'
];
const COLLISION_VOLUME_KEYS = [
    'volumeId',
    'ownerObjectId',
    'partId',
    'role',
    'rigidGroupId',
    'profile',
    'shape'
];
const PROFILE_KEYS = [
    'id',
    'version'
];
const SHAPE_KEYS = [
    'kind',
    'box'
];
const AABB_KEYS = [
    'minM',
    'maxM'
];
const TUPLE_FIELDS = [
    'dependencyScopeId',
    'bindingGeneration',
    'worldSpaceId',
    'frameId',
    'frameRevision',
    'policyRevision',
    'sourceGeometryRevision',
    'targetSceneRevision',
    'membershipRevision',
    'queryId',
    'queryRevision'
];
const READINESS = new Set([
    'ready',
    'pending',
    'unsupported',
    'disabled'
]);
const STALE_DIAGNOSTIC_CODES = new Set([
    SPATIAL_MANIPULATION_ERROR_CODE.DEPENDENCY_CHANGED_AFTER_APPLY,
    SPATIAL_MANIPULATION_ERROR_CODE.STALE_GEOMETRY
]);
const COVERAGE = new Set([
    'complete',
    'partial',
    'none'
]);
const isFiniteNumber = (value)=>typeof value === 'number' && Number.isFinite(value);
const isRevision = (value)=>Number.isSafeInteger(value) && value >= 0;
const isStringId = (value)=>typeof value === 'string' && value.length > 0;
const assertUv = (value, field)=>{
    assertPlainData(value, field);
    assertExactKeys(value, UV_KEYS, field);
    if (!value || !isFiniteNumber(value.u) || !isFiniteNumber(value.v)) {
        throwSpatialInvalidInput(field);
    }
    return {
        u: value.u,
        v: value.v
    };
};
const assertVec3 = (value, field)=>{
    assertPlainData(value, field);
    assertExactKeys(value, VEC3_KEYS, field);
    for (const axis of VEC3_KEYS){
        if (!isFiniteNumber(value[axis])) {
            throwSpatialInvalidInput(pathOf(field, axis));
        }
    }
    return {
        x: value.x,
        y: value.y,
        z: value.z
    };
};
const assertRevisionValue = (value, field)=>{
    if (!isRevision(value)) {
        throwSpatialInvalidInput(field);
    }
    return value;
};
const assertStringId = (value, field)=>{
    if (!isStringId(value)) {
        throwSpatialInvalidInput(field);
    }
    return value;
};
const assertProfile = (value, field)=>{
    assertPlainData(value, field);
    assertExactKeys(value, PROFILE_KEYS, field);
    if (!Number.isSafeInteger(value.version) || value.version <= 0) {
        throwSpatialInvalidInput(pathOf(field, 'version'));
    }
    return {
        id: assertStringId(value.id, pathOf(field, 'id')),
        version: value.version
    };
};
const assertAabb = (value, field)=>{
    assertPlainData(value, field);
    assertExactKeys(value, AABB_KEYS, field);
    const minM = assertVec3(value.minM, pathOf(field, 'minM'));
    const maxM = assertVec3(value.maxM, pathOf(field, 'maxM'));
    for (const axis of VEC3_KEYS){
        if (minM[axis] >= maxM[axis]) {
            throwSpatialInvalidInput(pathOf(field, axis));
        }
    }
    return {
        minM,
        maxM
    };
};
const assertCollisionVolume = (value, field)=>{
    assertPlainData(value, field);
    assertExactKeys(value, COLLISION_VOLUME_KEYS, field);
    const shapeField = pathOf(field, 'shape');
    assertPlainData(value.shape, shapeField);
    assertExactKeys(value.shape, SHAPE_KEYS, shapeField);
    if (value.shape.kind !== 'aabb') {
        throwSpatialInvalidInput(pathOf(shapeField, 'kind'));
    }
    return {
        volumeId: assertStringId(value.volumeId, pathOf(field, 'volumeId')),
        ownerObjectId: assertStringId(value.ownerObjectId, pathOf(field, 'ownerObjectId')),
        partId: assertStringId(value.partId, pathOf(field, 'partId')),
        role: assertStringId(value.role, pathOf(field, 'role')),
        rigidGroupId: assertStringId(value.rigidGroupId, pathOf(field, 'rigidGroupId')),
        profile: assertProfile(value.profile, pathOf(field, 'profile')),
        shape: {
            kind: 'aabb',
            box: assertAabb(value.shape.box, pathOf(shapeField, 'box'))
        }
    };
};
const assertPlainArray = (value, field)=>{
    assertPlainData(value, field);
    if (!Array.isArray(value)) {
        throwSpatialInvalidInput(field);
    }
    return value;
};
const normalizePlainArray = (value, field)=>assertPlainArray(value, field).map((item, index)=>{
        assertPlainData(item, pathOf(field, index));
        return copyPlainData(item);
    });
const normalizeCollisionVolumes = (value, field)=>assertPlainArray(value, field).map((item, index)=>assertCollisionVolume(item, pathOf(field, index)));
const assertOptions = (value = {}, { requireConstraintMode = false, allowGridMode = true } = {})=>{
    assertPlainData(value, 'options');
    assertExactKeys(value, allowGridMode ? OPTIONS_KEYS : [
        'constraintMode'
    ], 'options');
    const constraintMode = value.constraintMode ?? (requireConstraintMode ? undefined : 'respect');
    const gridMode = allowGridMode ? value.gridMode ?? (constraintMode === 'bypass' ? 'skip' : 'respect') : constraintMode === 'bypass' ? 'skip' : 'respect';
    if (!CONSTRAINT_MODES.has(constraintMode)) {
        throwSpatialInvalidInput('constraintMode');
    }
    if (!GRID_MODES.has(gridMode)) {
        throwSpatialInvalidInput('gridMode');
    }
    return {
        constraintMode,
        gridMode
    };
};
const assertResetRequest = (request)=>{
    assertPlainData(request, 'request');
    assertExactKeys(request, RESET_KEYS, 'request');
    return {
        offsetM: assertUv(request.offsetM, 'request.offsetM'),
        ...assertOptions({
            constraintMode: request.constraintMode
        }, {
            requireConstraintMode: true,
            allowGridMode: false
        })
    };
};
const makePivot = (frame, offsetM)=>({
        x: frame.originM.x + frame.uAxis.x * offsetM.u + frame.vAxis.x * offsetM.v,
        y: frame.originM.y + frame.uAxis.y * offsetM.u + frame.vAxis.y * offsetM.v,
        z: frame.originM.z + frame.uAxis.z * offsetM.u + frame.vAxis.z * offsetM.v
    });
const offsetsEqual = (left, right)=>Object.is(left.u, right.u) && Object.is(left.v, right.v);
const vec3Equal = (left, right)=>Object.is(left.x, right.x) && Object.is(left.y, right.y) && Object.is(left.z, right.z);
const actualDelta = (previous, applied)=>({
        u: (applied?.offsetM.u ?? 0) - (previous?.offsetM.u ?? 0),
        v: (applied?.offsetM.v ?? 0) - (previous?.offsetM.v ?? 0)
    });
const normalizePose = (value, state, field)=>{
    assertPlainData(value, field);
    assertExactKeys(value, APPLIED_POSE_KEYS, field);
    if (!value || value.instanceId !== state.instanceId || value.bindingGeneration !== state.binding.bindingGeneration) {
        throw createSpatialError(SPATIAL_MANIPULATION_ERROR_CODE.POSE_APPLY_FAILED, `Invalid ${field}`, {
            field
        });
    }
    const offsetM = assertUv(value.offsetM, `${field}.offsetM`);
    const pivotWorldM = assertVec3(value.pivotWorldM, `${field}.pivotWorldM`);
    if (!isRevision(value.poseRevision)) {
        throw createSpatialError(SPATIAL_MANIPULATION_ERROR_CODE.POSE_APPLY_FAILED, `Invalid ${field}`, {
            field: `${field}.poseRevision`
        });
    }
    return deepFreeze({
        instanceId: state.instanceId,
        dependencyScopeId: state.binding.dependencyScopeId,
        bindingGeneration: state.binding.bindingGeneration,
        frameRevision: state.config.frame.frameRevision,
        policyRevision: state.policyRevision,
        poseRevision: value.poseRevision,
        offsetM,
        pivotWorldM
    });
};
const assertReadMatchesCurrent = (pose, state)=>{
    if (!state.applied) {
        return;
    }
    if (pose.poseRevision !== state.applied.poseRevision || !offsetsEqual(pose.offsetM, state.applied.offsetM) || !vec3Equal(pose.pivotWorldM, state.applied.pivotWorldM)) {
        throw createSpatialError(SPATIAL_MANIPULATION_ERROR_CODE.POSE_APPLY_FAILED, 'PosePort.readPose drifted from current pose');
    }
};
const assertPorts = (ports)=>{
    if (!ports || typeof ports.pose?.readPose !== 'function' || typeof ports.pose?.apply !== 'function') {
        throwSpatialInvalidInput('ports.pose');
    }
    if (!ports.geometry || typeof ports.geometry.readCollisionSnapshot !== 'function' || typeof ports.geometry.readSnapSnapshot !== 'function') {
        throwSpatialInvalidInput('ports.geometry');
    }
};
const assertCreateRequest = (request)=>{
    if (!request || typeof request !== 'object' || Array.isArray(request)) {
        throwSpatialInvalidInput('request');
    }
    assertPorts(request.ports);
};
const stableCommandId = (meta, idFactory, state)=>{
    const commandId = meta?.commandId ?? idFactory('command', {
        instanceId: state.instanceId
    });
    if (!isStringId(commandId)) {
        throwSpatialInvalidInput('meta.commandId');
    }
    return commandId;
};
const normalizeMeta = (meta, idFactory, state)=>{
    const value = meta ?? {};
    assertPlainData(value, 'meta');
    assertExactKeys(value, META_KEYS, 'meta');
    const commandId = stableCommandId(meta, idFactory, state);
    const source = value.source ?? 'api';
    if (!MOTION_SOURCE.has(source)) {
        throwSpatialInvalidInput('meta.source');
    }
    if (value.correlationId !== undefined && !isStringId(value.correlationId)) {
        throwSpatialInvalidInput('meta.correlationId');
    }
    return {
        commandId,
        source,
        ...value.correlationId ? {
            correlationId: value.correlationId
        } : {}
    };
};
const tupleFromCollisionSnapshot = (snapshot)=>{
    const tuple = {};
    for (const field of TUPLE_FIELDS){
        tuple[field] = snapshot[field];
    }
    return tuple;
};
const tuplesEqual = (left, right)=>TUPLE_FIELDS.every((field)=>Object.is(left?.[field], right?.[field]));
const staticCollisionTuple = (snapshot, state)=>({
        instanceId: state.instanceId,
        objectId: state.objectId,
        dependencyScopeId: state.binding.dependencyScopeId,
        bindingGeneration: state.binding.bindingGeneration,
        worldSpaceId: state.config.frame.worldSpaceId,
        frameId: state.config.frame.frameId,
        frameRevision: state.config.frame.frameRevision,
        policyRevision: state.policyRevision
    });
const collisionSnapshotStaticTuple = (snapshot)=>({
        instanceId: snapshot?.instanceId,
        objectId: snapshot?.objectId,
        dependencyScopeId: snapshot?.dependencyScopeId,
        bindingGeneration: snapshot?.bindingGeneration,
        worldSpaceId: snapshot?.worldSpaceId,
        frameId: snapshot?.frameId,
        frameRevision: snapshot?.frameRevision,
        policyRevision: snapshot?.policyRevision
    });
const assertStaticCollisionTuple = (snapshot, state)=>{
    const expected = staticCollisionTuple(snapshot, state);
    const actual = collisionSnapshotStaticTuple(snapshot);
    for (const [field, value] of Object.entries(expected)){
        if (!Object.is(value, actual[field])) {
            throw createSpatialError(SPATIAL_MANIPULATION_ERROR_CODE.STALE_GEOMETRY, 'Stale collision snapshot', {
                expected,
                actual
            });
        }
    }
};
const snapSnapshotStaticTuple = (snapshot)=>({
        instanceId: snapshot?.instanceId,
        objectId: snapshot?.objectId,
        dependencyScopeId: snapshot?.dependencyScopeId,
        bindingGeneration: snapshot?.bindingGeneration,
        frameId: snapshot?.frameId,
        frameRevision: snapshot?.frameRevision,
        policyRevision: snapshot?.policyRevision
    });
const assertStaticSnapTuple = (snapshot, state)=>{
    const expected = {
        instanceId: state.instanceId,
        objectId: state.objectId,
        dependencyScopeId: state.binding.dependencyScopeId,
        bindingGeneration: state.binding.bindingGeneration,
        frameId: state.config.frame.frameId,
        frameRevision: state.config.frame.frameRevision,
        policyRevision: state.policyRevision
    };
    const actual = snapSnapshotStaticTuple(snapshot);
    for (const [field, value] of Object.entries(expected)){
        if (!Object.is(value, actual[field])) {
            throw createSpatialError(SPATIAL_MANIPULATION_ERROR_CODE.STALE_GEOMETRY, 'Stale snap snapshot', {
                expected,
                actual
            });
        }
    }
};
const expectedGeometryRequest = (state, channel, queryId)=>{
    // Channel-aware stamp source: the snap channel expects the accepted snap tuple, the
    // collision channel the accepted collision tuple (public-api.md §4, §6).
    const observation = channel === 'snap' ? state.snap : state.collision;
    return {
        instanceId: state.instanceId,
        objectId: state.objectId,
        channel,
        expected: {
            dependencyScopeId: state.binding.dependencyScopeId,
            bindingGeneration: state.binding.bindingGeneration,
            worldSpaceId: state.config.frame.worldSpaceId,
            frameId: state.config.frame.frameId,
            frameRevision: state.config.frame.frameRevision,
            policyRevision: state.policyRevision,
            sourceGeometryRevision: observation.stamp.sourceGeometryRevision,
            targetSceneRevision: observation.stamp.targetSceneRevision,
            membershipRevision: observation.membershipRevision,
            queryId,
            queryRevision: observation.stamp.queryRevision
        }
    };
};
const SNAP_TUPLE_FIELDS = TUPLE_FIELDS.filter((field)=>field !== 'worldSpaceId');
const tupleFromSnapSnapshot = (snapshot)=>{
    const tuple = {};
    for (const field of SNAP_TUPLE_FIELDS){
        tuple[field] = snapshot[field];
    }
    return tuple;
};
const validateCollisionSnapshotShape = (snapshot, state)=>{
    assertPlainData(snapshot, 'collisionSnapshot');
    assertExactKeys(snapshot, COLLISION_SNAPSHOT_KEYS, 'collisionSnapshot');
    if (!READINESS.has(snapshot.readiness)) {
        throwSpatialInvalidInput('collisionSnapshot.readiness');
    }
    if (!COVERAGE.has(snapshot.coverage)) {
        throwSpatialInvalidInput('collisionSnapshot.coverage');
    }
    const copy = {
        schemaVersion: snapshot.schemaVersion,
        readiness: snapshot.readiness,
        coverage: snapshot.coverage,
        instanceId: assertStringId(snapshot.instanceId, 'collisionSnapshot.instanceId'),
        objectId: assertStringId(snapshot.objectId, 'collisionSnapshot.objectId'),
        dependencyScopeId: assertStringId(snapshot.dependencyScopeId, 'collisionSnapshot.dependencyScopeId'),
        bindingGeneration: assertRevisionValue(snapshot.bindingGeneration, 'collisionSnapshot.bindingGeneration'),
        worldSpaceId: assertStringId(snapshot.worldSpaceId, 'collisionSnapshot.worldSpaceId'),
        frameId: assertStringId(snapshot.frameId, 'collisionSnapshot.frameId'),
        frameRevision: assertRevisionValue(snapshot.frameRevision, 'collisionSnapshot.frameRevision'),
        policyRevision: assertRevisionValue(snapshot.policyRevision, 'collisionSnapshot.policyRevision'),
        sourceGeometryRevision: assertRevisionValue(snapshot.sourceGeometryRevision, 'collisionSnapshot.sourceGeometryRevision'),
        targetSceneRevision: assertRevisionValue(snapshot.targetSceneRevision, 'collisionSnapshot.targetSceneRevision'),
        queryRevision: assertRevisionValue(snapshot.queryRevision, 'collisionSnapshot.queryRevision'),
        membershipRevision: assertRevisionValue(snapshot.membershipRevision, 'collisionSnapshot.membershipRevision'),
        queryId: assertStringId(snapshot.queryId, 'collisionSnapshot.queryId'),
        referenceSourcePivotM: assertVec3(snapshot.referenceSourcePivotM, 'collisionSnapshot.referenceSourcePivotM'),
        sourceVolumes: normalizeCollisionVolumes(snapshot.sourceVolumes, 'collisionSnapshot.sourceVolumes'),
        targetVolumes: normalizeCollisionVolumes(snapshot.targetVolumes, 'collisionSnapshot.targetVolumes'),
        missing: normalizePlainArray(snapshot.missing, 'collisionSnapshot.missing'),
        diagnostics: normalizePlainArray(snapshot.diagnostics, 'collisionSnapshot.diagnostics')
    };
    if (copy.schemaVersion !== 1) {
        throwSpatialInvalidInput('collisionSnapshot.schemaVersion');
    }
    if (copy.instanceId !== state.instanceId || copy.objectId !== state.objectId) {
        throw createSpatialError(SPATIAL_MANIPULATION_ERROR_CODE.STALE_GEOMETRY, 'Invalid collision snapshot');
    }
    assertStaticCollisionTuple(copy, state);
    return copy;
};
const observationFromCollisionSnapshot = (snapshot, state, applied, diagnostics = [])=>{
    const deltaWorldM = applied ? {
        x: applied.pivotWorldM.x - snapshot.referenceSourcePivotM.x,
        y: applied.pivotWorldM.y - snapshot.referenceSourcePivotM.y,
        z: applied.pivotWorldM.z - snapshot.referenceSourcePivotM.z
    } : {
        x: 0,
        y: 0,
        z: 0
    };
    const canEvaluate = snapshot.readiness === 'ready' && Array.isArray(snapshot.sourceVolumes) && snapshot.sourceVolumes.length > 0;
    const results = canEvaluate ? evaluateAabbCollisionsM({
        schemaVersion: 1,
        sourceVolumes: snapshot.sourceVolumes,
        targetVolumes: snapshot.targetVolumes,
        sourceDeltaWorldM: deltaWorldM,
        epsilonM: state.config.collision.epsilonM
    }) : [];
    const observation = createObservationSet({
        status: snapshot.readiness,
        coverage: snapshot.coverage,
        stamp: {
            instanceId: state.instanceId,
            objectId: state.objectId,
            dependencyScopeId: snapshot.dependencyScopeId,
            bindingGeneration: snapshot.bindingGeneration,
            worldSpaceId: snapshot.worldSpaceId,
            frameId: snapshot.frameId,
            frameRevision: snapshot.frameRevision,
            policyRevision: snapshot.policyRevision,
            sourceGeometryRevision: snapshot.sourceGeometryRevision,
            targetSceneRevision: snapshot.targetSceneRevision,
            poseRevision: applied?.poseRevision ?? 0,
            queryRevision: snapshot.queryRevision
        },
        queryId: snapshot.queryId,
        membershipRevision: snapshot.membershipRevision,
        results,
        truncated: false,
        missing: snapshot.missing ?? [],
        diagnostics: [
            ...snapshot.diagnostics ?? [],
            ...diagnostics
        ]
    });
    return createCollisionObservationSetV1(observation);
};
const staleCollisionObservation = (snapshot, state, applied, diagnostic)=>{
    const observation = createObservationSet({
        status: 'pending',
        coverage: 'none',
        stamp: {
            instanceId: state.instanceId,
            objectId: state.objectId,
            dependencyScopeId: state.binding.dependencyScopeId,
            bindingGeneration: state.binding.bindingGeneration,
            worldSpaceId: state.config.frame.worldSpaceId,
            frameId: state.config.frame.frameId,
            frameRevision: state.config.frame.frameRevision,
            policyRevision: state.policyRevision,
            sourceGeometryRevision: snapshot?.sourceGeometryRevision ?? 0,
            targetSceneRevision: snapshot?.targetSceneRevision ?? 0,
            poseRevision: applied?.poseRevision ?? 0,
            queryRevision: snapshot?.queryRevision ?? 0
        },
        queryId: snapshot?.queryId ?? `${state.instanceId}:collision:stale`,
        membershipRevision: snapshot?.membershipRevision ?? 0,
        diagnostics: [
            diagnostic
        ]
    });
    return createCollisionObservationSetV1(observation);
};
const markPoseFailurePendingState = (currentState)=>{
    // public-api.md §8: a failed apply marks the binding pending/non-current; later motion
    // rejects SPATIAL_NOT_READY until a newer rebind installs a fresh binding. The instance
    // closure wraps this pure transition as `markPoseFailurePending` to publish `lifecyclechange`.
    const pending = {
        ...currentState,
        lifecycle: 'pending',
        binding: deepFreeze({
            ...currentState.binding,
            readiness: 'pending'
        })
    };
    return {
        ...pending,
        snap: createDefaultSnapObservation(pending),
        collision: createDefaultCollisionObservation(pending)
    };
};
const tupleFromObservation = (observation)=>({
        dependencyScopeId: observation.stamp.dependencyScopeId,
        bindingGeneration: observation.stamp.bindingGeneration,
        worldSpaceId: observation.stamp.worldSpaceId,
        frameId: observation.stamp.frameId,
        frameRevision: observation.stamp.frameRevision,
        policyRevision: observation.stamp.policyRevision,
        sourceGeometryRevision: observation.stamp.sourceGeometryRevision,
        targetSceneRevision: observation.stamp.targetSceneRevision,
        membershipRevision: observation.membershipRevision,
        queryId: observation.queryId,
        queryRevision: observation.stamp.queryRevision
    });
const resultIds = (observation)=>(observation.results ?? []).map((result)=>result.hitId ?? result.pairId).sort();
const observationTransition = (previous, next)=>previous.status !== next.status || previous.coverage !== next.coverage || previous.truncated !== next.truncated || (previous.verdict?.status ?? null) !== (next.verdict?.status ?? null) || resultIds(previous).join('|') !== resultIds(next).join('|');
const compareRevisionPair = (requested, accepted)=>{
    const fields = [
        'sourceGeometryRevision',
        'targetSceneRevision'
    ];
    if (fields.some((field)=>requested[field] < accepted[field])) {
        return 'lower';
    }
    if (fields.every((field)=>requested[field] === accepted[field])) {
        return 'equal';
    }
    return 'higher';
};
const createScopedIdFactory = ()=>{
    let runtimeCounter = 0;
    const commandCounters = new Map();
    return (kind, context = {})=>{
        if (kind === 'runtime') {
            runtimeCounter += 1;
            return `runtime-${runtimeCounter}`;
        }
        const instanceId = context.instanceId ?? 'runtime';
        const current = commandCounters.get(instanceId) ?? 0;
        const next = current + 1;
        commandCounters.set(instanceId, next);
        return `${instanceId}-${kind}-${next}`;
    };
};

export { AABB_KEYS, APPLIED_POSE_KEYS, COLLISION_SNAPSHOT_KEYS, COLLISION_VOLUME_KEYS, CONSTRAINT_MODES, COVERAGE, GRID_MODES, META_KEYS, MOTION_SOURCE, OPTIONS_KEYS, PROFILE_KEYS, READINESS, RESET_KEYS, SHAPE_KEYS, SNAP_TUPLE_FIELDS, STALE_DIAGNOSTIC_CODES, TUPLE_FIELDS, UV_KEYS, VEC3_KEYS, actualDelta, assertAabb, assertCollisionVolume, assertCreateRequest, assertOptions, assertPlainArray, assertPorts, assertProfile, assertReadMatchesCurrent, assertResetRequest, assertRevisionValue, assertStaticCollisionTuple, assertStaticSnapTuple, assertStringId, assertUv, assertVec3, collisionSnapshotStaticTuple, compareRevisionPair, createScopedIdFactory, expectedGeometryRequest, isFiniteNumber, isRevision, isStringId, makePivot, markPoseFailurePendingState, normalizeCollisionVolumes, normalizeMeta, normalizePlainArray, normalizePose, observationFromCollisionSnapshot, observationTransition, offsetsEqual, resultIds, snapSnapshotStaticTuple, stableCommandId, staleCollisionObservation, staticCollisionTuple, tupleFromCollisionSnapshot, tupleFromObservation, tupleFromSnapSnapshot, tuplesEqual, validateCollisionSnapshotShape, vec3Equal };
