import { SPATIAL_MANIPULATION_SCHEMA_VERSION } from '../../core/contracts/constants.mjs';
import { SPATIAL_MANIPULATION_ERROR_CODE } from '../../core/contracts/errors.mjs';
import { deepFreeze } from '../../core/contracts/immutable.mjs';
import { createHierarchyIndexV1 } from './hierarchy.mjs';

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
const uniqueStringIds = (values, field)=>{
    if (!Array.isArray(values)) {
        throw makeError(SPATIAL_MANIPULATION_ERROR_CODE.INVALID_INPUT, `Invalid ${field}`, {
            field
        });
    }
    const seen = new Set();
    const output = [];
    for(let index = 0; index < values.length; index += 1){
        const id = requireStringId(values[index], `${field}[${index}]`);
        if (seen.has(id)) {
            throw makeError(SPATIAL_MANIPULATION_ERROR_CODE.INVALID_INPUT, `Duplicate ${field}`, {
                field: `${field}[${index}]`
            });
        }
        seen.add(id);
        output.push(id);
    }
    return output;
};
const ownerKeyOf = ({ instanceId, gestureId })=>`${instanceId}\u0000${gestureId}`;
const leaseDto = ({ leaseId, instanceId, gestureId, dependencyScopeId, protectedTransformIds, status })=>deepFreeze({
        schemaVersion: SPATIAL_MANIPULATION_SCHEMA_VERSION,
        leaseId,
        kind: 'transform-write',
        instanceId,
        gestureId,
        dependencyScopeId,
        protectedTransformIds: protectedTransformIds.slice(),
        status
    });
const protectedTransformIdsForBindingV1 = (binding)=>uniqueStringIds([
        ...binding.transformTargetIds,
        ...binding.spatialDependencyTransformIds
    ], 'protectedTransformIds');
const createTransformLeaseBookV1 = ({ runtimeId, hierarchyIndex })=>{
    requireStringId(runtimeId, 'runtimeId');
    if (!hierarchyIndex || typeof hierarchyIndex.isAncestorOf !== 'function' || typeof hierarchyIndex.hasTransform !== 'function') {
        throw makeError(SPATIAL_MANIPULATION_ERROR_CODE.INVALID_INPUT, 'Invalid hierarchyIndex', {
            field: 'hierarchyIndex'
        });
    }
    const heldLeases = new Map();
    const releasedLeases = new Map();
    const conflictForTransforms = (transformIds, requesterKey)=>{
        const writes = uniqueStringIds(transformIds, 'transformIds');
        const conflicts = [];
        for (const lease of heldLeases.values()){
            if (ownerKeyOf(lease) === requesterKey) {
                continue;
            }
            for (const writeId of writes){
                for (const protectedId of lease.protectedTransformIds){
                    if (writeId === protectedId || hierarchyIndex.isAncestorOf(writeId, protectedId)) {
                        conflicts.push({
                            leaseId: lease.leaseId,
                            instanceId: lease.instanceId,
                            gestureId: lease.gestureId,
                            writeTransformId: writeId,
                            protectedTransformId: protectedId
                        });
                    }
                }
            }
        }
        return conflicts;
    };
    const throwIfConflict = (transformIds, requesterKey)=>{
        const conflicts = conflictForTransforms(transformIds, requesterKey);
        if (conflicts.length > 0) {
            throw makeError(SPATIAL_MANIPULATION_ERROR_CODE.LEASE_CONFLICT, 'Transform lease conflict', {
                conflicts: deepFreeze(conflicts)
            });
        }
    };
    const acquire = (input)=>{
        const instanceId = requireStringId(input?.instanceId, 'instanceId');
        const gestureId = requireStringId(input?.gestureId, 'gestureId');
        const dependencyScopeId = requireStringId(input?.dependencyScopeId, 'dependencyScopeId');
        const protectedTransformIds = uniqueStringIds(input?.transformIds, 'transformIds');
        for (const transformId of protectedTransformIds){
            if (!hierarchyIndex.hasTransform(transformId)) {
                throw makeError(SPATIAL_MANIPULATION_ERROR_CODE.INVALID_INPUT, 'Unknown transformId', {
                    field: 'transformIds'
                });
            }
        }
        const requesterKey = ownerKeyOf({
            instanceId,
            gestureId
        });
        const existing = heldLeases.get(requesterKey);
        if (existing) {
            return leaseDto(existing);
        }
        throwIfConflict(protectedTransformIds, requesterKey);
        const leaseId = `${runtimeId}:${instanceId}:${gestureId}:${dependencyScopeId}`;
        const lease = {
            leaseId,
            instanceId,
            gestureId,
            dependencyScopeId,
            protectedTransformIds,
            status: 'held'
        };
        heldLeases.set(requesterKey, lease);
        return leaseDto(lease);
    };
    const release = (input)=>{
        const leaseId = requireStringId(input?.leaseId, 'leaseId');
        const instanceId = requireStringId(input?.instanceId, 'instanceId');
        const gestureId = requireStringId(input?.gestureId, 'gestureId');
        const requesterKey = ownerKeyOf({
            instanceId,
            gestureId
        });
        const held = heldLeases.get(requesterKey);
        if (held) {
            if (held.leaseId !== leaseId) {
                throw makeError(SPATIAL_MANIPULATION_ERROR_CODE.LEASE_CONFLICT, 'Lease owner mismatch', {
                    leaseId
                });
            }
            heldLeases.delete(requesterKey);
            const released = {
                ...held,
                status: 'released'
            };
            releasedLeases.set(leaseId, released);
            return leaseDto(released);
        }
        const released = releasedLeases.get(leaseId);
        if (released && released.instanceId === instanceId && released.gestureId === gestureId) {
            return leaseDto(released);
        }
        throw makeError(SPATIAL_MANIPULATION_ERROR_CODE.LEASE_CONFLICT, 'Lease owner mismatch', {
            leaseId
        });
    };
    const releaseOwner = ({ instanceId, gestureId })=>{
        const requesterKey = ownerKeyOf({
            instanceId: requireStringId(instanceId, 'instanceId'),
            gestureId: requireStringId(gestureId, 'gestureId')
        });
        const held = heldLeases.get(requesterKey);
        if (!held) {
            return null;
        }
        heldLeases.delete(requesterKey);
        const released = {
            ...held,
            status: 'released'
        };
        releasedLeases.set(released.leaseId, released);
        return leaseDto(released);
    };
    const releaseInstance = (instanceId)=>{
        requireStringId(instanceId, 'instanceId');
        for (const lease of [
            ...heldLeases.values()
        ]){
            if (lease.instanceId === instanceId) {
                releaseOwner(lease);
            }
        }
    };
    const assertCanWriteTransforms = (input)=>{
        const instanceId = requireStringId(input?.instanceId, 'instanceId');
        const gestureId = typeof input?.gestureId === 'string' && input.gestureId.length > 0 ? input.gestureId : '';
        const requesterKey = gestureId.length > 0 ? ownerKeyOf({
            instanceId,
            gestureId
        }) : null;
        const transformIds = uniqueStringIds(input?.transformIds, 'transformIds');
        for (const transformId of transformIds){
            if (!hierarchyIndex.hasTransform(transformId)) {
                throw makeError(SPATIAL_MANIPULATION_ERROR_CODE.INVALID_INPUT, 'Unknown transformId', {
                    field: 'transformIds'
                });
            }
        }
        throwIfConflict(transformIds, requesterKey);
        return deepFreeze({
            allowed: true,
            conflicts: []
        });
    };
    const snapshot = ()=>deepFreeze([
            ...heldLeases.values()
        ].sort((left, right)=>left.leaseId.localeCompare(right.leaseId)).map((lease)=>leaseDto(lease)));
    const destroy = ()=>{
        for (const lease of [
            ...heldLeases.values()
        ]){
            releaseOwner(lease);
        }
    };
    return Object.freeze({
        acquire,
        release,
        releaseOwner,
        releaseInstance,
        assertCanWriteTransforms,
        snapshot,
        destroy
    });
};
const createTransformLeaseBookForHierarchyV1 = ({ runtimeId, hierarchy })=>createTransformLeaseBookV1({
        runtimeId,
        hierarchyIndex: createHierarchyIndexV1(hierarchy)
    });

export { createTransformLeaseBookForHierarchyV1, createTransformLeaseBookV1, protectedTransformIdsForBindingV1 };
