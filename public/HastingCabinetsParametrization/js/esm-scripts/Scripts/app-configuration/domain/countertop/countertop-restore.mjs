import { COUNTERTOP_SCHEMA_VERSION, COUNTERTOP_LAYOUT_MODE } from './countertop-policy.mjs';
import { inchesToMeters } from './countertop-units.mjs';

const INVALID_INPUT_CODE = 'COUNTERTOP_INVALID_INPUT';
const PUBLIC_UNIT = 'inch';
const FULL_SNAPSHOT_KEYS = Object.freeze(new Set([
    'schemaVersion',
    'compositionId',
    'productId',
    'readiness',
    'revision',
    'layoutMode',
    'interactionState',
    'attachmentState',
    'position',
    'offset',
    'canMove',
    'size',
    'thickness',
    'customLength',
    'unit',
    'validation',
    'phase',
    'source'
]));
const METRIC_INTENT_KEYS = Object.freeze(new Set([
    'schemaVersion',
    'layoutMode',
    'offsetM',
    'customLengthM'
]));
const OFFSET_KEYS = Object.freeze(new Set([
    'x',
    'y'
]));
const isObjectRecord = (value)=>Boolean(value && typeof value === 'object' && !Array.isArray(value));
const createInvalidInputError = (message, details = {})=>{
    const error = new Error(message);
    error.code = INVALID_INPUT_CODE;
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
const requireSchemaVersion = (value)=>{
    if (value !== COUNTERTOP_SCHEMA_VERSION) {
        throw createInvalidInputError(`schemaVersion must be ${COUNTERTOP_SCHEMA_VERSION}`, {
            field: 'schemaVersion',
            schemaVersion: value
        });
    }
    return value;
};
const requireLayoutMode = (value)=>{
    if (value !== COUNTERTOP_LAYOUT_MODE.STANDARD && value !== COUNTERTOP_LAYOUT_MODE.DRAG) {
        throw createInvalidInputError('layoutMode must be "standard" or "drag"', {
            field: 'layoutMode'
        });
    }
    return value;
};
const requireFiniteNumber = (value, field)=>{
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw createInvalidInputError(`${field} must be a finite number`, {
            field
        });
    }
    return value;
};
const requireOffset = (value, field)=>{
    const offset = requireObjectRecord(value, field);
    requireKnownKeys(offset, OFFSET_KEYS, field);
    if (!Object.prototype.hasOwnProperty.call(offset, 'x') || !Object.prototype.hasOwnProperty.call(offset, 'y')) {
        throw createInvalidInputError(`${field} must contain x and y`, {
            field
        });
    }
    return {
        x: requireFiniteNumber(offset.x, `${field}.x`),
        y: requireFiniteNumber(offset.y, `${field}.y`)
    };
};
const requireCustomLength = (value, field)=>{
    if (value === null) return null;
    const length = requireFiniteNumber(value, field);
    if (length <= 0) {
        throw createInvalidInputError(`${field} must be null or greater than zero`, {
            field
        });
    }
    return length;
};
const rejectCustomDepthOrThickness = (payload)=>{
    const explicitFields = [
        'customDepth',
        'customThickness'
    ].filter((field)=>Object.prototype.hasOwnProperty.call(payload, field) || isObjectRecord(payload.size) && Object.prototype.hasOwnProperty.call(payload.size, field));
    if (explicitFields.length === 0) return;
    throw createInvalidInputError(`Custom countertop depth/thickness restore is unsupported: ${explicitFields.join(', ')}`, {
        fields: explicitFields
    });
};
/**
 * Validate a versioned public inch payload before any runtime mutation and
 * extract only durable manual intent. Documented full getState() snapshots are
 * accepted, but their derived/read-only fields are deliberately ignored.
 */ function parseCountertopRestoreState(payload) {
    const snapshot = requireObjectRecord(payload, 'restoreState');
    rejectCustomDepthOrThickness(snapshot);
    requireKnownKeys(snapshot, FULL_SNAPSHOT_KEYS, 'restoreState');
    requireSchemaVersion(snapshot.schemaVersion);
    if (snapshot.unit !== PUBLIC_UNIT) {
        throw createInvalidInputError('unit must be "inch"', {
            field: 'unit'
        });
    }
    if (!Object.prototype.hasOwnProperty.call(snapshot, 'customLength')) {
        throw createInvalidInputError('customLength is required', {
            field: 'customLength'
        });
    }
    const offset = requireOffset(snapshot.offset, 'offset');
    const customLength = requireCustomLength(snapshot.customLength, 'customLength');
    return Object.freeze({
        schemaVersion: COUNTERTOP_SCHEMA_VERSION,
        layoutMode: requireLayoutMode(snapshot.layoutMode),
        offsetM: Object.freeze({
            x: inchesToMeters(offset.x),
            y: inchesToMeters(offset.y)
        }),
        customLengthM: customLength === null ? null : inchesToMeters(customLength)
    });
}
/**
 * Defensive metric validation for direct service callers. This intentionally
 * has no defaults: a restore must never partially reinterpret malformed data.
 */ function requireCountertopRestoreIntentM(intentM) {
    const intent = requireObjectRecord(intentM, 'restoreIntentM');
    requireKnownKeys(intent, METRIC_INTENT_KEYS, 'restoreIntentM');
    requireSchemaVersion(intent.schemaVersion);
    if (!Object.prototype.hasOwnProperty.call(intent, 'customLengthM')) {
        throw createInvalidInputError('customLengthM is required', {
            field: 'customLengthM'
        });
    }
    return Object.freeze({
        schemaVersion: COUNTERTOP_SCHEMA_VERSION,
        layoutMode: requireLayoutMode(intent.layoutMode),
        offsetM: Object.freeze(requireOffset(intent.offsetM, 'offsetM')),
        customLengthM: requireCustomLength(intent.customLengthM, 'customLengthM')
    });
}

export { parseCountertopRestoreState, requireCountertopRestoreIntentM };
