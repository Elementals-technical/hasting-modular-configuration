import { throwSpatialInvalidInput } from '../contracts/errors.mjs';
import { deepFreeze, assertPlainData, assertExactKeys, pathOf } from '../contracts/immutable.mjs';

const SCHEMA_VERSION = 1;
const AXES_3D = Object.freeze([
    'x',
    'y',
    'z'
]);
const REQUEST_KEYS = Object.freeze([
    'schemaVersion',
    'sourceVolumes',
    'targetVolumes',
    'sourceDeltaWorldM',
    'epsilonM'
]);
const AABB_KEYS = Object.freeze([
    'minM',
    'maxM'
]);
const VEC3_KEYS = Object.freeze([
    'x',
    'y',
    'z'
]);
const VOLUME_KEYS = Object.freeze([
    'volumeId',
    'ownerObjectId',
    'partId',
    'role',
    'rigidGroupId',
    'profile',
    'shape'
]);
const PROFILE_KEYS = Object.freeze([
    'id',
    'version'
]);
const SHAPE_KEYS = Object.freeze([
    'kind',
    'box'
]);
const requireNumber = (value, path)=>{
    if (typeof value !== 'number' || !Number.isFinite(value)) {
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
const requireEpsilonM = (value = 0, path = 'epsilonM')=>{
    const epsilonM = requireNumber(value, path);
    if (epsilonM < 0) {
        throwSpatialInvalidInput(path);
    }
    return epsilonM;
};
const normalizeVec3M = (value, path)=>{
    assertExactKeys(value, VEC3_KEYS, path);
    return {
        x: requireNumber(value.x, pathOf(path, 'x')),
        y: requireNumber(value.y, pathOf(path, 'y')),
        z: requireNumber(value.z, pathOf(path, 'z'))
    };
};
const normalizeAabbM = (value, path)=>{
    assertExactKeys(value, AABB_KEYS, path);
    const minM = normalizeVec3M(value.minM, pathOf(path, 'minM'));
    const maxM = normalizeVec3M(value.maxM, pathOf(path, 'maxM'));
    for (const axis of AXES_3D){
        if (minM[axis] >= maxM[axis]) {
            throwSpatialInvalidInput(pathOf(path, axis));
        }
    }
    return {
        minM,
        maxM
    };
};
const normalizeProfileRef = (value, path)=>{
    assertExactKeys(value, PROFILE_KEYS, path);
    return {
        id: requireStringId(value.id, pathOf(path, 'id')),
        version: requireRevision(value.version, pathOf(path, 'version'))
    };
};
const normalizeCollisionVolume = (value, path)=>{
    assertExactKeys(value, VOLUME_KEYS, path);
    const shapePath = pathOf(path, 'shape');
    assertExactKeys(value.shape, SHAPE_KEYS, shapePath);
    if (value.shape.kind !== 'aabb') {
        throwSpatialInvalidInput(pathOf(shapePath, 'kind'));
    }
    return {
        volumeId: requireStringId(value.volumeId, pathOf(path, 'volumeId')),
        ownerObjectId: requireStringId(value.ownerObjectId, pathOf(path, 'ownerObjectId')),
        partId: requireStringId(value.partId, pathOf(path, 'partId')),
        role: requireStringId(value.role, pathOf(path, 'role')),
        rigidGroupId: requireStringId(value.rigidGroupId, pathOf(path, 'rigidGroupId')),
        profile: normalizeProfileRef(value.profile, pathOf(path, 'profile')),
        shape: {
            kind: 'aabb',
            box: normalizeAabbM(value.shape.box, pathOf(shapePath, 'box'))
        }
    };
};
const logicalVolumeKey = (volume)=>JSON.stringify([
        volume.ownerObjectId,
        volume.partId,
        volume.volumeId
    ]);
const normalizeVolumes = (value, path, { requireNonEmpty })=>{
    const input = requireArray(value, path);
    if (requireNonEmpty && input.length === 0) {
        throwSpatialInvalidInput(path);
    }
    const seen = new Set();
    return input.map((item, index)=>{
        const itemPath = pathOf(path, index);
        const volume = normalizeCollisionVolume(item, itemPath);
        const key = logicalVolumeKey(volume);
        if (seen.has(key)) {
            throwSpatialInvalidInput(pathOf(itemPath, 'volumeId'));
        }
        seen.add(key);
        return volume;
    });
};
const calculateOverlapM = (left, right, epsilonM)=>{
    const overlapM = {};
    for (const axis of AXES_3D){
        const overlap = Math.min(left.maxM[axis], right.maxM[axis]) - Math.max(left.minM[axis], right.minM[axis]);
        if (overlap <= epsilonM) {
            return null;
        }
        overlapM[axis] = overlap;
    }
    return overlapM;
};
const translatedAabbM = (box, deltaM)=>{
    const translated = {
        minM: {},
        maxM: {}
    };
    for (const axis of AXES_3D){
        translated.minM[axis] = box.minM[axis] + deltaM[axis];
        translated.maxM[axis] = box.maxM[axis] + deltaM[axis];
        if (!Number.isFinite(translated.minM[axis]) || !Number.isFinite(translated.maxM[axis])) {
            throwSpatialInvalidInput(`deltaM.${axis}`);
        }
    }
    return translated;
};
const spatialRefForVolume = (volume)=>({
        objectId: volume.ownerObjectId,
        partId: volume.partId,
        volumeId: volume.volumeId
    });
const hitTuple = (source, target)=>[
        source.ownerObjectId,
        source.partId,
        source.volumeId,
        target.ownerObjectId,
        target.partId,
        target.volumeId
    ];
const compareHitTuples = (left, right)=>{
    for(let index = 0; index < left.sortTuple.length; index += 1){
        const compared = left.sortTuple[index].localeCompare(right.sortTuple[index]);
        if (compared !== 0) {
            return compared;
        }
    }
    return 0;
};
const normalizeEvaluationRequest = (request)=>{
    assertPlainData(request, 'request');
    assertExactKeys(request, REQUEST_KEYS, 'request');
    return {
        schemaVersion: request.schemaVersion,
        sourceVolumes: normalizeVolumes(request.sourceVolumes, 'sourceVolumes', {
            requireNonEmpty: true
        }),
        targetVolumes: normalizeVolumes(request.targetVolumes, 'targetVolumes', {
            requireNonEmpty: false
        }),
        sourceDeltaWorldM: normalizeVec3M(request.sourceDeltaWorldM, 'sourceDeltaWorldM'),
        epsilonM: request.epsilonM === undefined ? 0 : requireEpsilonM(request.epsilonM, 'epsilonM')
    };
};
function intersectAabbM(a, b, epsilonM = 0) {
    assertPlainData(a, 'a');
    assertPlainData(b, 'b');
    const left = normalizeAabbM(a, 'a');
    const right = normalizeAabbM(b, 'b');
    const epsilon = requireEpsilonM(epsilonM, 'epsilonM');
    return calculateOverlapM(left, right, epsilon) !== null;
}
function translateAabbM(box, deltaM) {
    assertPlainData(box, 'box');
    assertPlainData(deltaM, 'deltaM');
    const source = normalizeAabbM(box, 'box');
    const delta = normalizeVec3M(deltaM, 'deltaM');
    return deepFreeze(translatedAabbM(source, delta));
}
function evaluateAabbCollisionsM(request = {}) {
    const normalized = normalizeEvaluationRequest(request);
    if (normalized.schemaVersion !== SCHEMA_VERSION) {
        throwSpatialInvalidInput('schemaVersion');
    }
    const hits = [];
    for (const source of normalized.sourceVolumes){
        const sourceKey = logicalVolumeKey(source);
        const sourceAabbM = translatedAabbM(source.shape.box, normalized.sourceDeltaWorldM);
        for (const target of normalized.targetVolumes){
            if (sourceKey === logicalVolumeKey(target)) {
                continue;
            }
            const targetAabbM = target.shape.box;
            const overlapM = calculateOverlapM(sourceAabbM, targetAabbM, normalized.epsilonM);
            if (overlapM === null) {
                continue;
            }
            const sortTuple = hitTuple(source, target);
            hits.push({
                sortTuple,
                hit: {
                    hitId: JSON.stringify(sortTuple),
                    source: spatialRefForVolume(source),
                    target: spatialRefForVolume(target),
                    sourceAabbM,
                    targetAabbM,
                    overlapM,
                    epsilonM: normalized.epsilonM,
                    fidelity: 'world-aabb',
                    sourceProfile: source.profile,
                    targetProfile: target.profile
                }
            });
        }
    }
    hits.sort(compareHitTuples);
    return deepFreeze(hits.map(({ hit })=>hit));
}

export { evaluateAabbCollisionsM, intersectAabbM, translateAabbM };
