export const SPATIAL_MANIPULATION_ERROR_CODE = Object.freeze({
  INVALID_INPUT: 'SPATIAL_INVALID_INPUT',
  NOT_READY: 'SPATIAL_NOT_READY',
  BUSY: 'SPATIAL_BUSY',
  LEASE_CONFLICT: 'SPATIAL_LEASE_CONFLICT',
  STALE_BINDING: 'SPATIAL_STALE_BINDING',
  STALE_FRAME: 'SPATIAL_STALE_FRAME',
  STALE_POLICY: 'SPATIAL_STALE_POLICY',
  STALE_GEOMETRY: 'SPATIAL_STALE_GEOMETRY',
  DEPENDENCY_CHANGED_AFTER_APPLY: 'SPATIAL_DEPENDENCY_CHANGED_AFTER_APPLY',
  SUPERSEDED: 'SPATIAL_SUPERSEDED',
  POSE_APPLY_FAILED: 'SPATIAL_POSE_APPLY_FAILED',
  DESTROYED: 'SPATIAL_DESTROYED'
});

const normalizeFields = fields => {
  const list = Array.isArray(fields) ? fields : [fields];
  const seen = new Set();
  const normalized = [];
  for (const field of list) {
    const value = typeof field === 'string' && field.length > 0 ? field : 'value';
    if (!seen.has(value)) {
      seen.add(value);
      normalized.push(value);
    }
  }
  return normalized;
};

export const createSpatialInvalidInputError = fields => {
  const normalized = normalizeFields(fields);
  const error = new Error(`Invalid spatial manipulation input: ${normalized.join(', ')}`);
  error.code = SPATIAL_MANIPULATION_ERROR_CODE.INVALID_INPUT;
  if (normalized.length === 1) {
    error.field = normalized[0];
  } else {
    error.fields = Object.freeze(normalized.slice());
  }
  return error;
};

export const throwSpatialInvalidInput = fields => {
  throw createSpatialInvalidInputError(fields);
};
