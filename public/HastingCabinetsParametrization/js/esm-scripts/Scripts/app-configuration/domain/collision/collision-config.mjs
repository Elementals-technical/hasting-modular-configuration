const COLLISION_CONFIG_SCHEMA_VERSION = 1;
const COLLISION_PROFILE_VERSION = 1;
const COLLISION_CONFIG_DEFAULT_EPSILON_M = 0.000001;
const COLLISION_CONFIG_MODE = Object.freeze({
    HIGHLIGHT: 'highlight'
});
const COLLISION_CONFIG_ERROR_CODE = Object.freeze({
    INVALID_INPUT: 'COUNTERTOP_INVALID_INPUT'
});
const CONFIG_KEYS = Object.freeze(new Set([
    'schemaVersion',
    'profileId',
    'profileVersion',
    'enabled',
    'mode',
    'epsilonM',
    'participation'
]));
const PARTICIPATION_KEYS = Object.freeze(new Set([
    'excludedProductIds',
    'excludedPartRoles'
]));
const hasOwn = (record, key)=>Object.prototype.hasOwnProperty.call(record, key);
const isObjectRecord = (value)=>Boolean(value && typeof value === 'object' && !Array.isArray(value));
const createInvalidInputError = (message, details = {})=>{
    const error = new Error(message);
    error.code = COLLISION_CONFIG_ERROR_CODE.INVALID_INPUT;
    Object.assign(error, details);
    return error;
};
const requireObjectRecord = (value, field)=>{
    if (!isObjectRecord(value)) {
        throw createInvalidInputError(`${field} must be an object`, {
            field
        });
    }
    return value;
};
const requireKnownKeys = (value, supportedKeys, field)=>{
    const unsupportedKeys = Object.keys(value).filter((key)=>!supportedKeys.has(key));
    if (unsupportedKeys.length === 0) return;
    throw createInvalidInputError(`Unsupported ${field} field${unsupportedKeys.length > 1 ? 's' : ''}: ${unsupportedKeys.join(', ')}`, {
        field,
        fields: unsupportedKeys
    });
};
const requirePresentKeys = (value, supportedKeys, field)=>{
    const missingKeys = [
        ...supportedKeys
    ].filter((key)=>!hasOwn(value, key));
    if (missingKeys.length === 0) return;
    throw createInvalidInputError(`${field} missing required field${missingKeys.length > 1 ? 's' : ''}: ${missingKeys.join(', ')}`, {
        field,
        fields: missingKeys
    });
};
const requireSchemaVersion = (value)=>{
    if (value !== COLLISION_CONFIG_SCHEMA_VERSION) {
        throw createInvalidInputError(`schemaVersion must be ${COLLISION_CONFIG_SCHEMA_VERSION}`, {
            field: 'schemaVersion',
            schemaVersion: value
        });
    }
    return value;
};
const requireStringId = (value, field)=>{
    if (typeof value !== 'string' || value.length === 0) {
        throw createInvalidInputError(`${field} must be a non-empty string`, {
            field
        });
    }
    return value;
};
const requirePositiveInteger = (value, field)=>{
    if (!Number.isSafeInteger(value) || value <= 0) {
        throw createInvalidInputError(`${field} must be a positive integer`, {
            field
        });
    }
    return value;
};
const requireBoolean = (value, field)=>{
    if (typeof value !== 'boolean') {
        throw createInvalidInputError(`${field} must be a boolean`, {
            field
        });
    }
    return value;
};
const requireEpsilonM = (value)=>{
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        throw createInvalidInputError('epsilonM must be a finite number greater than or equal to zero', {
            field: 'epsilonM'
        });
    }
    return value;
};
const requireMode = (value)=>{
    if (value !== COLLISION_CONFIG_MODE.HIGHLIGHT) {
        throw createInvalidInputError('mode must be "highlight"', {
            field: 'mode',
            mode: value
        });
    }
    return value;
};
const freezeConfig = (config)=>Object.freeze({
        ...config,
        participation: Object.freeze({
            excludedProductIds: Object.freeze([
                ...config.participation.excludedProductIds
            ]),
            excludedPartRoles: Object.freeze([
                ...config.participation.excludedPartRoles
            ])
        })
    });
const normalizeVersionCollection = (versions, field)=>{
    if (Array.isArray(versions)) return versions.map((value)=>requirePositiveInteger(value, field));
    if (versions instanceof Set) return [
        ...versions
    ].map((value)=>requirePositiveInteger(value, field));
    throw createInvalidInputError(`${field} must be an array or Set`, {
        field
    });
};
const getSupportedProfileVersions = (supportedProfiles, profileId)=>{
    if (supportedProfiles == null) return null;
    if (supportedProfiles instanceof Map) return supportedProfiles.get(profileId) ?? null;
    if (isObjectRecord(supportedProfiles)) return supportedProfiles[profileId] ?? null;
    throw createInvalidInputError('supportedProfiles must be an object or Map', {
        field: 'supportedProfiles'
    });
};
const normalizeRegistry = (options = {})=>{
    const registry = requireObjectRecord(options, 'collisionConfigOptions');
    const defaultProfileId = requireStringId(registry.defaultProfileId, 'defaultProfileId');
    const defaultProfileVersion = requirePositiveInteger(registry.defaultProfileVersion ?? COLLISION_PROFILE_VERSION, 'defaultProfileVersion');
    const supportedProfiles = registry.supportedProfiles ?? {
        [defaultProfileId]: Object.freeze([
            defaultProfileVersion
        ])
    };
    const supportedPartRoles = registry.supportedPartRoles ?? [];
    if (!Array.isArray(supportedPartRoles) && !(supportedPartRoles instanceof Set)) {
        throw createInvalidInputError('supportedPartRoles must be an array or Set', {
            field: 'supportedPartRoles'
        });
    }
    return Object.freeze({
        defaultProfileId,
        defaultProfileVersion,
        supportedProfiles,
        supportedPartRoles: Object.freeze([
            ...new Set([
                ...supportedPartRoles
            ].map((role)=>requireStringId(role, 'supportedPartRoles')))
        ])
    });
};
const requireSupportedProfile = (profileId, profileVersion, registry)=>{
    const versions = getSupportedProfileVersions(registry.supportedProfiles, profileId);
    if (versions == null) {
        throw createInvalidInputError(`Unsupported collision profile "${profileId}"`, {
            field: 'profileId',
            profileId
        });
    }
    const normalizedVersions = normalizeVersionCollection(versions, `supportedProfiles.${profileId}`);
    if (!normalizedVersions.includes(profileVersion)) {
        throw createInvalidInputError(`Unsupported collision profile version ${profileVersion} for "${profileId}"`, {
            field: 'profileVersion',
            profileId,
            profileVersion
        });
    }
};
const normalizeStringArray = (value, field, isSupported = ()=>true)=>{
    if (!Array.isArray(value)) {
        throw createInvalidInputError(`${field} must be an array`, {
            field
        });
    }
    const result = [];
    const seen = new Set();
    for (const item of value){
        const normalized = requireStringId(item, field);
        if (!isSupported(normalized)) {
            throw createInvalidInputError(`Unsupported ${field} value "${normalized}"`, {
                field,
                value: normalized
            });
        }
        if (seen.has(normalized)) continue;
        seen.add(normalized);
        result.push(normalized);
    }
    return result;
};
const normalizeParticipation = (participation, registry, base = null, field = 'participation')=>{
    const value = requireObjectRecord(participation, field);
    requireKnownKeys(value, PARTICIPATION_KEYS, field);
    if (base === null) {
        requirePresentKeys(value, PARTICIPATION_KEYS, field);
    }
    const baseParticipation = base ?? {
        excludedProductIds: [],
        excludedPartRoles: []
    };
    const supportedRoles = new Set(registry.supportedPartRoles);
    return Object.freeze({
        excludedProductIds: Object.freeze(hasOwn(value, 'excludedProductIds') ? normalizeStringArray(value.excludedProductIds, `${field}.excludedProductIds`) : [
            ...baseParticipation.excludedProductIds
        ]),
        excludedPartRoles: Object.freeze(hasOwn(value, 'excludedPartRoles') ? normalizeStringArray(value.excludedPartRoles, `${field}.excludedPartRoles`, (role)=>supportedRoles.has(role)) : [
            ...baseParticipation.excludedPartRoles
        ])
    });
};
/**
 * Produce the durable project default config from injected profile/role data.
 * The pure collision module deliberately does not know scene or product names.
 */ function createDefaultCollisionConfig(options) {
    const registry = normalizeRegistry(options);
    requireSupportedProfile(registry.defaultProfileId, registry.defaultProfileVersion, registry);
    return freezeConfig({
        schemaVersion: COLLISION_CONFIG_SCHEMA_VERSION,
        profileId: registry.defaultProfileId,
        profileVersion: registry.defaultProfileVersion,
        enabled: true,
        mode: COLLISION_CONFIG_MODE.HIGHLIGHT,
        epsilonM: COLLISION_CONFIG_DEFAULT_EPSILON_M,
        participation: {
            excludedProductIds: [],
            excludedPartRoles: []
        }
    });
}
function requireCollisionConfig(config, options) {
    const registry = normalizeRegistry(options);
    const value = requireObjectRecord(config, 'collisionConfig');
    requireKnownKeys(value, CONFIG_KEYS, 'collisionConfig');
    requirePresentKeys(value, CONFIG_KEYS, 'collisionConfig');
    const profileId = requireStringId(value.profileId, 'profileId');
    const profileVersion = requirePositiveInteger(value.profileVersion, 'profileVersion');
    requireSupportedProfile(profileId, profileVersion, registry);
    return freezeConfig({
        schemaVersion: requireSchemaVersion(value.schemaVersion),
        profileId,
        profileVersion,
        enabled: requireBoolean(value.enabled, 'enabled'),
        mode: requireMode(value.mode),
        epsilonM: requireEpsilonM(value.epsilonM),
        participation: normalizeParticipation(value.participation, registry)
    });
}
function applyCollisionConfigPatch(currentConfig, patch, options) {
    const registry = normalizeRegistry(options);
    const current = requireCollisionConfig(currentConfig, registry);
    const value = requireObjectRecord(patch, 'collisionConfigPatch');
    requireKnownKeys(value, CONFIG_KEYS, 'collisionConfigPatch');
    const candidate = {
        schemaVersion: hasOwn(value, 'schemaVersion') ? value.schemaVersion : current.schemaVersion,
        profileId: hasOwn(value, 'profileId') ? value.profileId : current.profileId,
        profileVersion: hasOwn(value, 'profileVersion') ? value.profileVersion : current.profileVersion,
        enabled: hasOwn(value, 'enabled') ? value.enabled : current.enabled,
        mode: hasOwn(value, 'mode') ? value.mode : current.mode,
        epsilonM: hasOwn(value, 'epsilonM') ? value.epsilonM : current.epsilonM,
        participation: hasOwn(value, 'participation') ? normalizeParticipation(value.participation, registry, current.participation, 'collisionConfigPatch.participation') : current.participation
    };
    return requireCollisionConfig(candidate, registry);
}

export { COLLISION_CONFIG_DEFAULT_EPSILON_M, COLLISION_CONFIG_ERROR_CODE, COLLISION_CONFIG_MODE, COLLISION_CONFIG_SCHEMA_VERSION, COLLISION_PROFILE_VERSION, applyCollisionConfigPatch, createDefaultCollisionConfig, requireCollisionConfig };
