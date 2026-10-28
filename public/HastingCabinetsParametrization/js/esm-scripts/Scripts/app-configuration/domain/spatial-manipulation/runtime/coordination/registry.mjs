import { SPATIAL_MANIPULATION_SCHEMA_VERSION } from '../../core/contracts/constants.mjs';
import { SPATIAL_MANIPULATION_ERROR_CODE } from '../../core/contracts/errors.mjs';
import { deepFreeze } from '../../core/contracts/immutable.mjs';
import { validateRuntimeBindingV1 } from '../../core/contracts/validators.mjs';
import { createHierarchyIndexV1, validateTransformHierarchySnapshotV1 } from './hierarchy.mjs';
import { createTransformLeaseBookV1, protectedTransformIdsForBindingV1 } from './leases.mjs';

const makeError = (code, message, details = {})=>{
    const error = new Error(message);
    error.code = code;
    for (const [key, value] of Object.entries(details)){
        error[key] = value;
    }
    return error;
};
const requireStringId = (value, field)=>{
    if (typeof value !== 'string' || value.length === 0) {
        throw makeError(SPATIAL_MANIPULATION_ERROR_CODE.INVALID_INPUT, `Invalid ${field}`, {
            field
        });
    }
    return value;
};
const requirePointerType = (value)=>{
    if (value !== 'mouse' && value !== 'touch') {
        throw makeError(SPATIAL_MANIPULATION_ERROR_CODE.INVALID_INPUT, 'Invalid pointerType', {
            field: 'pointerType'
        });
    }
    return value;
};
const buildHierarchyIndexFromBindings = (records)=>{
    const facts = new Map();
    let hierarchyRevision = 0;
    for (const record of records){
        hierarchyRevision = Math.max(hierarchyRevision, record.binding.hierarchy.hierarchyRevision);
        for (const node of record.binding.hierarchy.nodes){
            const previous = facts.get(node.transformId);
            if (previous !== undefined && previous !== node.parentTransformId) {
                throw makeError(SPATIAL_MANIPULATION_ERROR_CODE.INVALID_INPUT, 'Conflicting hierarchy facts', {
                    field: 'hierarchy.nodes'
                });
            }
            facts.set(node.transformId, node.parentTransformId);
        }
    }
    const hierarchy = validateTransformHierarchySnapshotV1({
        schemaVersion: SPATIAL_MANIPULATION_SCHEMA_VERSION,
        hierarchyRevision,
        nodes: [
            ...facts.entries()
        ].sort(([left], [right])=>left.localeCompare(right)).map(([transformId, parentTransformId])=>({
                transformId,
                parentTransformId
            }))
    });
    return createHierarchyIndexV1(hierarchy);
};
const instanceDto = (record)=>deepFreeze({
        instanceId: record.binding.instanceId,
        objectId: record.binding.objectId,
        dependencyScopeId: record.binding.dependencyScopeId,
        binding: record.binding,
        protectedTransformIds: record.protectedTransformIds.slice()
    });
const createSpatialCoordinatorV1 = (options = {})=>{
    const runtimeId = requireStringId(options.runtimeId ?? 'spatial-runtime', 'runtimeId');
    const records = new Map();
    let activeGesture = null;
    let hierarchyIndex = createHierarchyIndexV1({
        schemaVersion: SPATIAL_MANIPULATION_SCHEMA_VERSION,
        hierarchyRevision: 0,
        nodes: []
    });
    let leases = createTransformLeaseBookV1({
        runtimeId,
        hierarchyIndex
    });
    let destroyed = false;
    const assertLive = ()=>{
        if (destroyed) {
            throw makeError(SPATIAL_MANIPULATION_ERROR_CODE.DESTROYED, 'Coordinator destroyed');
        }
    };
    const createLeaseBookWithExisting = (nextHierarchyIndex, existingLeases)=>{
        const nextLeases = createTransformLeaseBookV1({
            runtimeId,
            hierarchyIndex: nextHierarchyIndex
        });
        for (const lease of existingLeases){
            nextLeases.acquire({
                instanceId: lease.instanceId,
                gestureId: lease.gestureId,
                dependencyScopeId: lease.dependencyScopeId,
                transformIds: lease.protectedTransformIds
            });
        }
        return nextLeases;
    };
    const rebuildLeases = ()=>{
        const heldLeases = leases.snapshot();
        const nextHierarchyIndex = buildHierarchyIndexFromBindings(records.values());
        const nextLeases = createLeaseBookWithExisting(nextHierarchyIndex, heldLeases);
        hierarchyIndex = nextHierarchyIndex;
        leases = nextLeases;
    };
    const registerInstance = (binding)=>{
        assertLive();
        const normalizedBinding = validateRuntimeBindingV1(binding);
        if (records.has(normalizedBinding.instanceId)) {
            throw makeError(SPATIAL_MANIPULATION_ERROR_CODE.INVALID_INPUT, 'Duplicate instanceId', {
                field: 'instanceId'
            });
        }
        const record = {
            binding: normalizedBinding,
            protectedTransformIds: protectedTransformIdsForBindingV1(normalizedBinding)
        };
        const nextRecords = new Map(records);
        nextRecords.set(normalizedBinding.instanceId, record);
        const nextHierarchyIndex = buildHierarchyIndexFromBindings(nextRecords.values());
        const nextLeases = createLeaseBookWithExisting(nextHierarchyIndex, leases.snapshot());
        records.set(normalizedBinding.instanceId, record);
        hierarchyIndex = nextHierarchyIndex;
        leases = nextLeases;
        return instanceDto(record);
    };
    const getInstance = (instanceId)=>{
        assertLive();
        const record = records.get(requireStringId(instanceId, 'instanceId'));
        return record ? instanceDto(record) : null;
    };
    const unregisterInstance = (instanceId)=>{
        assertLive();
        requireStringId(instanceId, 'instanceId');
        const record = records.get(instanceId);
        if (!record) {
            return null;
        }
        leases.releaseInstance(instanceId);
        if (activeGesture?.instanceId === instanceId) {
            activeGesture = null;
        }
        records.delete(instanceId);
        rebuildLeases();
        return instanceDto(record);
    };
    const beginGesture = (input)=>{
        assertLive();
        const instanceId = requireStringId(input?.instanceId, 'instanceId');
        const gestureId = requireStringId(input?.gestureId, 'gestureId');
        const pointerType = requirePointerType(input?.pointerType);
        const pointerId = requireStringId(input?.pointerId, 'pointerId');
        const record = records.get(instanceId);
        if (!record) {
            throw makeError(SPATIAL_MANIPULATION_ERROR_CODE.INVALID_INPUT, 'Unknown instanceId', {
                field: 'instanceId'
            });
        }
        if (activeGesture) {
            const sameOwner = activeGesture.instanceId === instanceId && activeGesture.gestureId === gestureId;
            if (!sameOwner) {
                throw makeError(SPATIAL_MANIPULATION_ERROR_CODE.BUSY, 'Viewport gesture already active', {
                    activeGesture: deepFreeze({
                        ...activeGesture
                    })
                });
            }
            return leases.acquire({
                instanceId,
                gestureId,
                dependencyScopeId: record.binding.dependencyScopeId,
                transformIds: record.protectedTransformIds
            });
        }
        const lease = leases.acquire({
            instanceId,
            gestureId,
            dependencyScopeId: record.binding.dependencyScopeId,
            transformIds: record.protectedTransformIds
        });
        activeGesture = {
            instanceId,
            gestureId,
            pointerType,
            pointerId
        };
        return lease;
    };
    const endGesture = (input)=>{
        assertLive();
        const instanceId = requireStringId(input?.instanceId, 'instanceId');
        const gestureId = requireStringId(input?.gestureId, 'gestureId');
        if (!activeGesture || activeGesture.instanceId !== instanceId || activeGesture.gestureId !== gestureId) {
            return snapshot();
        }
        const ownerLease = leases.snapshot().find((lease)=>lease.instanceId === instanceId && lease.gestureId === gestureId);
        if (ownerLease) {
            leases.release({
                leaseId: ownerLease.leaseId,
                instanceId,
                gestureId
            });
        }
        activeGesture = null;
        return snapshot();
    };
    const acquireTransformLease = (input)=>{
        assertLive();
        const instanceId = requireStringId(input?.instanceId, 'instanceId');
        if (!records.has(instanceId)) {
            throw makeError(SPATIAL_MANIPULATION_ERROR_CODE.INVALID_INPUT, 'Unknown instanceId', {
                field: 'instanceId'
            });
        }
        return leases.acquire(input);
    };
    const releaseTransformLease = (input)=>{
        assertLive();
        const released = leases.release(input);
        if (activeGesture?.instanceId === released.instanceId && activeGesture?.gestureId === released.gestureId) {
            activeGesture = null;
        }
        return released;
    };
    const assertCanWriteTransforms = (input)=>{
        assertLive();
        return leases.assertCanWriteTransforms(input);
    };
    function snapshot() {
        return deepFreeze({
            schemaVersion: SPATIAL_MANIPULATION_SCHEMA_VERSION,
            runtimeId,
            activeGesture: activeGesture ? {
                ...activeGesture
            } : null,
            instances: [
                ...records.values()
            ].map(instanceDto).sort((left, right)=>left.instanceId.localeCompare(right.instanceId)),
            leases: leases.snapshot()
        });
    }
    const destroy = ()=>{
        if (!destroyed) {
            leases.destroy();
            records.clear();
            activeGesture = null;
            destroyed = true;
        }
        return deepFreeze({
            runtimeId,
            status: 'destroyed'
        });
    };
    return Object.freeze({
        registerInstance,
        getInstance,
        unregisterInstance,
        beginGesture,
        endGesture,
        acquireTransformLease,
        releaseTransformLease,
        assertCanWriteTransforms,
        snapshot,
        destroy
    });
};

export { createSpatialCoordinatorV1 };
