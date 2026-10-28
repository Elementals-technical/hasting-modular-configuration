import {
  SPATIAL_MANIPULATION_EVENT,
  SPATIAL_MANIPULATION_SCHEMA_VERSION
} from '../core/contracts/constants.mjs';
import { SPATIAL_MANIPULATION_ERROR_CODE } from '../core/contracts/errors.mjs';
import { deepFreeze } from '../core/contracts/immutable.mjs';
import { createCollisionObservationSetV1 } from '../core/collision/observation.mjs';

export const createSpatialError = (code, message, details = {}) => {
  const error = new Error(message);
  error.code = code;
  for (const [key, value] of Object.entries(details)) {
    error[key] = value;
  }
  return error;
};

export const normalizeRuntimeError = (error, code, message) => {
  return createSpatialError(code, message, { cause: error });
};

export const copyPlainData = value => {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(copyPlainData);
  }
  const copy = {};
  for (const key of Object.keys(value)) {
    copy[key] = copyPlainData(value[key]);
  }
  return copy;
};

export const publicAppliedPose = pose => {
  if (pose === null) {
    return null;
  }
  return {
    instanceId: pose.instanceId,
    bindingGeneration: pose.bindingGeneration,
    poseRevision: pose.poseRevision,
    offsetM: { ...pose.offsetM },
    pivotWorldM: { ...pose.pivotWorldM }
  };
};

export const createDiagnostic = (code, message, expected = undefined, actual = undefined) => deepFreeze({
  code,
  ...(message ? { message } : {}),
  ...(expected ? { expected: copyPlainData(expected) } : {}),
  ...(actual ? { actual: copyPlainData(actual) } : {})
});

const stampFrom = ({
  instanceId,
  objectId,
  dependencyScopeId,
  bindingGeneration,
  worldSpaceId,
  frameId,
  frameRevision,
  policyRevision,
  sourceGeometryRevision = 0,
  targetSceneRevision = 0,
  poseRevision = 0,
  queryRevision = 0,
  projectionRevision
}) => ({
  instanceId,
  objectId,
  dependencyScopeId,
  bindingGeneration,
  worldSpaceId,
  frameId,
  frameRevision,
  ...(projectionRevision === undefined ? {} : { projectionRevision }),
  policyRevision,
  sourceGeometryRevision,
  targetSceneRevision,
  poseRevision,
  queryRevision
});

export const createObservationSet = ({
  status,
  coverage,
  stamp,
  queryId,
  membershipRevision = 0,
  results = [],
  truncated = false,
  missing = [],
  diagnostics = []
}) => deepFreeze({
  status,
  coverage,
  stamp: copyPlainData(stamp),
  queryId,
  membershipRevision,
  results: copyPlainData(results),
  truncated,
  missing: copyPlainData(missing),
  diagnostics: copyPlainData(diagnostics)
});

export const createDefaultSnapObservation = state => createObservationSet({
  status: state.config.snapping.enabled ? 'pending' : 'disabled',
  coverage: 'none',
  stamp: stampFrom({
    instanceId: state.instanceId,
    objectId: state.objectId,
    dependencyScopeId: state.binding.dependencyScopeId,
    bindingGeneration: state.binding.bindingGeneration,
    worldSpaceId: state.config.frame.worldSpaceId,
    frameId: state.config.frame.frameId,
    frameRevision: state.config.frame.frameRevision,
    policyRevision: state.policyRevision,
    poseRevision: state.applied?.poseRevision ?? 0
  }),
  queryId: `${state.instanceId}:snap:none`
});

export const createDefaultCollisionObservation = state => {
  const observation = createObservationSet({
    status: state.config.collision.enabled ? 'pending' : 'disabled',
    coverage: 'none',
    stamp: stampFrom({
      instanceId: state.instanceId,
      objectId: state.objectId,
      dependencyScopeId: state.binding.dependencyScopeId,
      bindingGeneration: state.binding.bindingGeneration,
      worldSpaceId: state.config.frame.worldSpaceId,
      frameId: state.config.frame.frameId,
      frameRevision: state.config.frame.frameRevision,
      policyRevision: state.policyRevision,
      poseRevision: state.applied?.poseRevision ?? 0
    }),
    queryId: `${state.instanceId}:collision:none`
  });
  return createCollisionObservationSetV1(observation);
};

export const createMotionFeedback = ({
  instanceId,
  dependencyScopeId,
  sequence,
  commandSequence,
  commandId,
  correlationId,
  gestureId,
  source,
  reason,
  outcome,
  previousApplied,
  requested,
  planned,
  applied,
  actualDeltaM,
  corrections,
  snap,
  collision,
  diagnostics
}) => deepFreeze({
  schemaVersion: SPATIAL_MANIPULATION_SCHEMA_VERSION,
  instanceId,
  dependencyScopeId,
  sequence,
  commandSequence,
  commandId,
  ...(correlationId ? { correlationId } : {}),
  ...(gestureId ? { gestureId } : {}),
  source,
  reason,
  outcome,
  previousApplied: publicAppliedPose(previousApplied),
  requested: requested ? copyPlainData(requested) : null,
  planned: planned ? copyPlainData(planned) : null,
  applied: publicAppliedPose(applied),
  actualDeltaM: { ...actualDeltaM },
  corrections: copyPlainData(corrections),
  snap: copyPlainData(snap),
  collision: copyPlainData(collision),
  diagnostics: copyPlainData(diagnostics)
});

export const createSpatialEvent = ({
  event = SPATIAL_MANIPULATION_EVENT.MOTION_APPLIED,
  instanceId,
  sequence,
  commandSequence,
  commandId,
  correlationId,
  gestureId,
  reason,
  state,
  report
}) => deepFreeze({
  schemaVersion: SPATIAL_MANIPULATION_SCHEMA_VERSION,
  event,
  instanceId,
  sequence,
  ...(commandSequence === undefined ? {} : { commandSequence }),
  ...(commandId === undefined ? {} : { commandId }),
  ...(correlationId ? { correlationId } : {}),
  ...(gestureId ? { gestureId } : {}),
  reason,
  state: copyPlainData(state),
  ...(report === undefined ? {} : { report: copyPlainData(report) })
});
