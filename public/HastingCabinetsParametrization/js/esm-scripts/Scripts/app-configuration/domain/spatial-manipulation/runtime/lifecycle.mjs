import { throwSpatialInvalidInput, SPATIAL_MANIPULATION_ERROR_CODE } from '../core/contracts/errors.mjs';
import { assertPlainData, assertExactKeys, deepFreeze, pathOf } from '../core/contracts/immutable.mjs';
import { validateManipulationConfigV1, validateRuntimeBindingV1 } from '../core/contracts/validators.mjs';

const INVALIDATION_KEYS = [
    'dependencyScopeId',
    'channels',
    'bindingGeneration',
    'sourceGeometryRevision',
    'targetSceneRevision',
    'reason'
];
const REFRESH_KEYS = [
    'dependencyScopeId',
    'channels'
];
const CONFIG_PATCH_KEYS = [
    'frame',
    'motion',
    'snapping',
    'collision'
];
const MOTION_PATCH_KEYS = [
    'allowedAxes',
    'boundsM',
    'grid'
];
const SNAPPING_PATCH_KEYS = [
    'enabled',
    'profile',
    'pointerProfiles'
];
const COLLISION_PATCH_KEYS = [
    'enabled',
    'mode',
    'epsilonM',
    'profile'
];
const CHANNELS = new Set([
    'snap',
    'collision'
]);
const AXES = new Set([
    'u',
    'v'
]);
const isStringId = (value)=>typeof value === 'string' && value.length > 0;
const isRevision = (value)=>Number.isSafeInteger(value) && value >= 0;
const assertStringId = (value, field)=>{
    if (!isStringId(value)) {
        throwSpatialInvalidInput(field);
    }
    return value;
};
const assertRevision = (value, field)=>{
    if (!isRevision(value)) {
        throwSpatialInvalidInput(field);
    }
    return value;
};
const normalizeChannels = (channels, field)=>{
    assertPlainData(channels, field);
    if (!Array.isArray(channels) || channels.length === 0) {
        throwSpatialInvalidInput(field);
    }
    const seen = new Set();
    const normalized = [];
    channels.forEach((channel, index)=>{
        if (!CHANNELS.has(channel) || seen.has(channel)) {
            throwSpatialInvalidInput(pathOf(field, index));
        }
        seen.add(channel);
        normalized.push(channel);
    });
    return normalized;
};
const normalizeGeometryInvalidationV1 = (request)=>{
    assertPlainData(request, 'request');
    assertExactKeys(request, INVALIDATION_KEYS, 'request');
    return deepFreeze({
        dependencyScopeId: assertStringId(request.dependencyScopeId, 'request.dependencyScopeId'),
        channels: normalizeChannels(request.channels, 'request.channels'),
        bindingGeneration: assertRevision(request.bindingGeneration, 'request.bindingGeneration'),
        sourceGeometryRevision: assertRevision(request.sourceGeometryRevision, 'request.sourceGeometryRevision'),
        targetSceneRevision: assertRevision(request.targetSceneRevision, 'request.targetSceneRevision'),
        reason: assertStringId(request.reason, 'request.reason')
    });
};
const normalizeGeometryRefreshV1 = (request)=>{
    const value = request ?? {};
    assertPlainData(value, 'request');
    assertExactKeys(value, REFRESH_KEYS, 'request');
    return deepFreeze({
        dependencyScopeId: value.dependencyScopeId === undefined ? null : assertStringId(value.dependencyScopeId, 'request.dependencyScopeId'),
        channels: value.channels === undefined ? [
            'snap',
            'collision'
        ] : normalizeChannels(value.channels, 'request.channels')
    });
};
const copyPlainData = (value)=>{
    if (value === null || typeof value !== 'object') {
        return value;
    }
    if (Array.isArray(value)) {
        return value.map(copyPlainData);
    }
    const copy = {};
    for (const key of Object.keys(value)){
        copy[key] = copyPlainData(value[key]);
    }
    return copy;
};
const POINTER_PROFILE_KEYS = [
    'mouse',
    'touch'
];
// Ruling R3: only these patch paths change plan/snapshot semantics and bump policyRevision.
const POLICY_SECTIONS = Object.freeze({
    frame: true,
    motion: true,
    snapping: new Set([
        'profile',
        'pointerProfiles'
    ]),
    collision: new Set([
        'profile'
    ])
});
const definedKeys = (value)=>Object.keys(value).filter((key)=>value[key] !== undefined);
const patchBumpsPolicy = (normalizedPatch)=>Object.entries(POLICY_SECTIONS).some(([section, rule])=>{
        const value = normalizedPatch[section];
        if (value === undefined) {
            return false;
        }
        if (rule === true) {
            return true;
        }
        return definedKeys(value).some((key)=>rule.has(key));
    });
/**
 * Normalizes a `ManipulationConfigPatchV1`. Without `currentConfig` it returns the frozen
 * normalized patch. With `currentConfig` (ruling R4) it deep-merges the patch per contract
 * sub-key (`snapping.pointerProfiles.mouse`/`.touch` individually, other section keys by key),
 * validates the merged config with `validateManipulationConfigV1` and returns
 * `{ patch, config, bumpsPolicy }`; validation failure throws before any state changes.
 */ const normalizeConfigPatchV1 = (patch, currentConfig)=>{
    assertPlainData(patch, 'patch');
    assertExactKeys(patch, CONFIG_PATCH_KEYS, 'patch');
    const normalizedPatch = {};
    if (patch.frame !== undefined) {
        normalizedPatch.frame = copyPlainData(patch.frame);
    }
    if (patch.motion !== undefined) {
        assertPlainData(patch.motion, 'patch.motion');
        assertExactKeys(patch.motion, MOTION_PATCH_KEYS, 'patch.motion');
        normalizedPatch.motion = copyPlainData(patch.motion);
        if (patch.motion.allowedAxes !== undefined) {
            const axes = patch.motion.allowedAxes;
            assertPlainData(axes, 'patch.motion.allowedAxes');
            // Ruling R9 (2026-09-16): an empty list is valid (every axis frozen by policy), as at create time.
            if (!Array.isArray(axes)) {
                throwSpatialInvalidInput('patch.motion.allowedAxes');
            }
            const seen = new Set();
            normalizedPatch.motion.allowedAxes = axes.map((axis, index)=>{
                if (!AXES.has(axis) || seen.has(axis)) {
                    throwSpatialInvalidInput(pathOf('patch.motion.allowedAxes', index));
                }
                seen.add(axis);
                return axis;
            });
        }
    }
    if (patch.snapping !== undefined) {
        assertPlainData(patch.snapping, 'patch.snapping');
        assertExactKeys(patch.snapping, SNAPPING_PATCH_KEYS, 'patch.snapping');
        normalizedPatch.snapping = copyPlainData(patch.snapping);
        if (patch.snapping.pointerProfiles !== undefined) {
            assertPlainData(patch.snapping.pointerProfiles, 'patch.snapping.pointerProfiles');
            assertExactKeys(patch.snapping.pointerProfiles, POINTER_PROFILE_KEYS, 'patch.snapping.pointerProfiles');
        }
    }
    if (patch.collision !== undefined) {
        assertPlainData(patch.collision, 'patch.collision');
        assertExactKeys(patch.collision, COLLISION_PATCH_KEYS, 'patch.collision');
        normalizedPatch.collision = copyPlainData(patch.collision);
    }
    if (!currentConfig) {
        return deepFreeze(normalizedPatch);
    }
    const mergeSection = (current, section)=>{
        const merged = copyPlainData(current);
        for (const key of definedKeys(section ?? {})){
            merged[key] = copyPlainData(section[key]);
        }
        return merged;
    };
    const currentProfiles = currentConfig.snapping.pointerProfiles;
    const patchProfiles = normalizedPatch.snapping?.pointerProfiles ?? {};
    const candidate = {
        ...copyPlainData(currentConfig),
        ...normalizedPatch.frame === undefined ? {} : {
            frame: copyPlainData(normalizedPatch.frame)
        },
        motion: mergeSection(currentConfig.motion, normalizedPatch.motion),
        snapping: {
            ...mergeSection(currentConfig.snapping, normalizedPatch.snapping),
            pointerProfiles: {
                mouse: copyPlainData(patchProfiles.mouse ?? currentProfiles.mouse),
                touch: copyPlainData(patchProfiles.touch ?? currentProfiles.touch)
            }
        },
        collision: mergeSection(currentConfig.collision, normalizedPatch.collision)
    };
    const config = validateManipulationConfigV1(candidate);
    return deepFreeze({
        patch: normalizedPatch,
        config,
        bumpsPolicy: patchBumpsPolicy(normalizedPatch)
    });
};
const normalizeRebindRequestV1 = (binding, state)=>{
    const normalized = validateRuntimeBindingV1(binding);
    if (normalized.instanceId !== state.instanceId || normalized.objectId !== state.objectId) {
        throwSpatialInvalidInput('binding.instanceId');
    }
    if (normalized.bindingGeneration <= state.binding.bindingGeneration) {
        const error = new Error('Stale runtime binding');
        error.code = SPATIAL_MANIPULATION_ERROR_CODE.STALE_BINDING;
        error.expected = deepFreeze({
            bindingGeneration: state.binding.bindingGeneration + 1
        });
        error.actual = deepFreeze({
            bindingGeneration: normalized.bindingGeneration
        });
        throw error;
    }
    return normalized;
};

export { normalizeConfigPatchV1, normalizeGeometryInvalidationV1, normalizeGeometryRefreshV1, normalizeRebindRequestV1 };
