import { throwSpatialInvalidInput } from '../contracts/errors.mjs';
import { deepFreeze, assertPlainData, assertExactKeys, pathOf } from '../contracts/immutable.mjs';

const OBSERVATION_KEYS = Object.freeze([
    'status',
    'coverage',
    'stamp',
    'queryId',
    'membershipRevision',
    'results',
    'truncated',
    'missing',
    'diagnostics'
]);
const READINESS = Object.freeze(new Set([
    'ready',
    'pending',
    'unsupported',
    'disabled'
]));
const COVERAGE = Object.freeze(new Set([
    'complete',
    'partial',
    'none'
]));
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
const requireRevision = (value, path)=>{
    if (!Number.isSafeInteger(value) || value < 0) {
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
const requireEnum = (value, allowed, path)=>{
    if (!allowed.has(value)) {
        throwSpatialInvalidInput(path);
    }
    return value;
};
const copyPlainData = (value)=>{
    if (value === null || typeof value !== 'object') {
        return value;
    }
    if (Array.isArray(value)) {
        return value.map((item)=>copyPlainData(item));
    }
    const copy = {};
    for (const key of Object.keys(value)){
        copy[key] = copyPlainData(value[key]);
    }
    return copy;
};
const clonePlainArray = (value, path)=>requireArray(value, path).map((item, index)=>{
        const itemPath = pathOf(path, index);
        assertPlainData(item, itemPath);
        return copyPlainData(item);
    });
const normalizeObservationSet = (value)=>{
    assertPlainData(value, 'observation');
    assertExactKeys(value, OBSERVATION_KEYS, 'observation');
    assertPlainData(value.stamp, 'stamp');
    return {
        status: requireEnum(value.status, READINESS, 'status'),
        coverage: requireEnum(value.coverage, COVERAGE, 'coverage'),
        stamp: copyPlainData(value.stamp),
        queryId: requireStringId(value.queryId, 'queryId'),
        membershipRevision: requireRevision(value.membershipRevision, 'membershipRevision'),
        results: clonePlainArray(value.results, 'results'),
        truncated: requireBool(value.truncated, 'truncated'),
        missing: clonePlainArray(value.missing, 'missing'),
        diagnostics: clonePlainArray(value.diagnostics, 'diagnostics')
    };
};
function deriveCollisionVerdictV1(observation) {
    const status = observation?.status;
    if (status === 'disabled') {
        return deepFreeze({
            status: 'disabled',
            hasCollision: false,
            reason: null
        });
    }
    if (status !== 'ready') {
        return deepFreeze({
            status: 'unknown',
            hasCollision: null,
            reason: READINESS.has(status) ? status : 'invalid-observation'
        });
    }
    if (observation.coverage !== 'complete') {
        return deepFreeze({
            status: 'unknown',
            hasCollision: null,
            reason: observation.coverage === 'partial' ? 'partial' : 'incomplete'
        });
    }
    if (observation.truncated) {
        return deepFreeze({
            status: 'unknown',
            hasCollision: null,
            reason: 'truncated'
        });
    }
    if (Array.isArray(observation.missing) && observation.missing.length > 0) {
        return deepFreeze({
            status: 'unknown',
            hasCollision: null,
            reason: 'missing-required-geometry'
        });
    }
    if (!Array.isArray(observation.results)) {
        return deepFreeze({
            status: 'unknown',
            hasCollision: null,
            reason: 'invalid-observation'
        });
    }
    if (observation.results.length > 0) {
        return deepFreeze({
            status: 'colliding',
            hasCollision: true,
            reason: null
        });
    }
    return deepFreeze({
        status: 'clear',
        hasCollision: false,
        reason: null
    });
}
function createCollisionObservationSetV1(value) {
    const observation = normalizeObservationSet(value);
    return deepFreeze({
        ...observation,
        verdict: deriveCollisionVerdictV1(observation)
    });
}

export { createCollisionObservationSetV1, deriveCollisionVerdictV1 };
