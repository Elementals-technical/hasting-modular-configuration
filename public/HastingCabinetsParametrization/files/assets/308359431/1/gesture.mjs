import { SPATIAL_MANIPULATION_SCHEMA_VERSION } from '../core/contracts/constants.mjs';
import { SPATIAL_MANIPULATION_ERROR_CODE, throwSpatialInvalidInput } from '../core/contracts/errors.mjs';
import {
  assertExactKeys,
  assertPlainData,
  deepFreeze,
  pathOf
} from '../core/contracts/immutable.mjs';
import { AXIS_PENDING, createAxisIntentV1 } from '../core/motion/axis-intent.mjs';
import { buildFramePointM } from '../core/motion/frame.mjs';

const BEGIN_KEYS = ['gestureId', 'pointerType', 'pointerId', 'startScreenPx', 'projectionRevision', 'altActive'];
const UPDATE_KEYS = ['gestureId', 'requestedOffsetM', 'screenPointPx', 'screenAxisBasis', 'projectionRevision', 'altActive'];
const END_KEYS = ['gestureId'];
const CANCEL_KEYS = ['gestureId', 'reason'];
const VEC2_KEYS = ['x', 'y'];
const UV_KEYS = ['u', 'v'];
const BASIS_KEYS = ['u', 'v'];
const MOTION_AXES = ['u', 'v'];
const POINTER_TYPES = new Set(['mouse', 'touch']);
const RESIDUAL_COMPARISON_ULPS = 16;

const isStringId = value => typeof value === 'string' && value.length > 0;
const isFiniteNumber = value => typeof value === 'number' && Number.isFinite(value);
const isRevision = value => Number.isSafeInteger(value) && value >= 0;

const assertStringId = (value, field) => {
  if (!isStringId(value)) {
    throwSpatialInvalidInput(field);
  }
  return value;
};

const assertRevision = (value, field) => {
  if (!isRevision(value)) {
    throwSpatialInvalidInput(field);
  }
  return value;
};

const assertBoolean = (value, field) => {
  if (typeof value !== 'boolean') {
    throwSpatialInvalidInput(field);
  }
  return value;
};

const assertVec2 = (value, field) => {
  assertPlainData(value, field);
  assertExactKeys(value, VEC2_KEYS, field);
  if (!isFiniteNumber(value.x) || !isFiniteNumber(value.y)) {
    throwSpatialInvalidInput(field);
  }
  return { x: value.x, y: value.y };
};

const assertUv = (value, field) => {
  assertPlainData(value, field);
  assertExactKeys(value, UV_KEYS, field);
  if (!isFiniteNumber(value.u) || !isFiniteNumber(value.v)) {
    throwSpatialInvalidInput(field);
  }
  return { u: value.u, v: value.v };
};

const assertBasis = (value, field) => {
  assertPlainData(value, field);
  assertExactKeys(value, BASIS_KEYS, field);
  return {
    u: assertVec2(value.u, pathOf(field, 'u')),
    v: assertVec2(value.v, pathOf(field, 'v'))
  };
};

export const normalizeBeginGestureRequest = request => {
  assertPlainData(request, 'request');
  assertExactKeys(request, BEGIN_KEYS, 'request');
  if (!POINTER_TYPES.has(request.pointerType)) {
    throwSpatialInvalidInput('request.pointerType');
  }
  return deepFreeze({
    gestureId: assertStringId(request.gestureId, 'request.gestureId'),
    pointerType: request.pointerType,
    pointerId: assertStringId(request.pointerId, 'request.pointerId'),
    startScreenPx: assertVec2(request.startScreenPx, 'request.startScreenPx'),
    projectionRevision: assertRevision(request.projectionRevision, 'request.projectionRevision'),
    altActive: assertBoolean(request.altActive, 'request.altActive')
  });
};

export const normalizeUpdateGestureRequest = request => {
  assertPlainData(request, 'request');
  assertExactKeys(request, UPDATE_KEYS, 'request');
  return deepFreeze({
    gestureId: assertStringId(request.gestureId, 'request.gestureId'),
    requestedOffsetM: assertUv(request.requestedOffsetM, 'request.requestedOffsetM'),
    screenPointPx: assertVec2(request.screenPointPx, 'request.screenPointPx'),
    screenAxisBasis: assertBasis(request.screenAxisBasis, 'request.screenAxisBasis'),
    projectionRevision: assertRevision(request.projectionRevision, 'request.projectionRevision'),
    altActive: assertBoolean(request.altActive, 'request.altActive')
  });
};

export const normalizeEndGestureRequest = request => {
  assertPlainData(request, 'request');
  assertExactKeys(request, END_KEYS, 'request');
  return deepFreeze({
    gestureId: assertStringId(request.gestureId, 'request.gestureId')
  });
};

export const normalizeCancelGestureRequest = request => {
  assertPlainData(request, 'request');
  assertExactKeys(request, CANCEL_KEYS, 'request');
  return deepFreeze({
    gestureId: assertStringId(request.gestureId, 'request.gestureId'),
    reason: assertStringId(request.reason, 'request.reason')
  });
};

// `AppliedPoseV1` (data-model.md §8): exactly the five public fields, no runtime stamps.
const publicStartPose = pose => ({
  instanceId: pose.instanceId,
  bindingGeneration: pose.bindingGeneration,
  poseRevision: pose.poseRevision,
  offsetM: { u: pose.offsetM.u, v: pose.offsetM.v },
  pivotWorldM: { x: pose.pivotWorldM.x, y: pose.pivotWorldM.y, z: pose.pivotWorldM.z }
});

/**
 * Public `ManipulationStateV1.activeGesture` record (data-model.md §8): the accepted
 * binding/frame/policy/scope stamps and the public start pose only. Runtime-private gesture
 * facts (latch, axis intent, rebase, prior request) live in `createGestureRuntimeState`.
 */
export const createGestureSnapshot = ({ request, state, applied }) => deepFreeze({
  gestureId: request.gestureId,
  pointerType: request.pointerType,
  pointerId: request.pointerId,
  startApplied: publicStartPose(applied),
  bindingGeneration: state.binding.bindingGeneration,
  frameRevision: state.config.frame.frameRevision,
  policyRevision: state.policyRevision,
  dependencyScopeId: state.binding.dependencyScopeId
});

const gestureStamps = (snapshot, state) => ({
  expected: {
    bindingGeneration: snapshot?.bindingGeneration ?? null,
    dependencyScopeId: snapshot?.dependencyScopeId ?? null,
    frameRevision: snapshot?.frameRevision ?? null,
    policyRevision: snapshot?.policyRevision ?? null
  },
  actual: {
    bindingGeneration: state.binding.bindingGeneration,
    dependencyScopeId: state.binding.dependencyScopeId,
    frameRevision: state.config.frame.frameRevision,
    policyRevision: state.policyRevision
  }
});

/**
 * public-api.md §5.3: ordinary cancel/update are gated on the captured binding/frame/policy
 * stamps only (ruling R1: geometry revision drift is not a stale gesture). Returns `null`
 * when current, otherwise the stale code with the expected/actual stamp tuples (NFR-06).
 */
export const describeGestureSnapshotDrift = (snapshot, state) => {
  const { expected, actual } = gestureStamps(snapshot, state);
  let code = null;
  if (!snapshot
    || expected.bindingGeneration !== actual.bindingGeneration
    || expected.dependencyScopeId !== actual.dependencyScopeId) {
    code = SPATIAL_MANIPULATION_ERROR_CODE.STALE_BINDING;
  } else if (expected.frameRevision !== actual.frameRevision) {
    code = SPATIAL_MANIPULATION_ERROR_CODE.STALE_FRAME;
  } else if (expected.policyRevision !== actual.policyRevision) {
    code = SPATIAL_MANIPULATION_ERROR_CODE.STALE_POLICY;
  }
  if (code === null) {
    return null;
  }
  return deepFreeze({ code, expected, actual });
};

export const isGestureSnapshotCurrent = (snapshot, state) => describeGestureSnapshotDrift(snapshot, state) === null;

/**
 * Runtime-private per-gesture state. It is never copied into public DTOs: the axis-intent
 * handle is a capability, and latch/prior-request facts are instance internals.
 */
export const createGestureRuntimeState = ({ request, applied, snapTuple = null, collisionTuple = null }) => {
  const axisIntent = createAxisIntentV1();
  axisIntent.reset(request.startScreenPx, AXIS_PENDING);
  return {
    gestureId: request.gestureId,
    pointerType: request.pointerType,
    pointerId: request.pointerId,
    startScreenPx: { ...request.startScreenPx },
    projectionRevision: request.projectionRevision,
    altActive: request.altActive,
    axisIntent,
    intentAxis: AXIS_PENDING,
    rebaseM: { u: 0, v: 0 },
    snapLatch: null,
    lastSnap: null,
    priorRequestM: { ...applied.offsetM },
    priorAppliedM: { ...applied.offsetM },
    snapTuple,
    collisionTuple
  };
};

const rebaseOnApplied = (gesture, requestedOffsetM, appliedOffsetM) => {
  gesture.rebaseM = {
    u: appliedOffsetM.u - requestedOffsetM.u,
    v: appliedOffsetM.v - requestedOffsetM.v
  };
};

const effectiveRequest = (gesture, requestedOffsetM) => ({
  u: requestedOffsetM.u + gesture.rebaseM.u,
  v: requestedOffsetM.v + gesture.rebaseM.v
});

const sampleResult = (gesture, request, allowedAxes, { rebase = false, intentAxis = null } = {}) => deepFreeze({
  allowedAxes: allowedAxes.slice(),
  rebase,
  intentAxis,
  requestedOffsetM: effectiveRequest(gesture, request.requestedOffsetM)
});

/**
 * Ruling R2 (mouse Alt is core-owned). Mutates the runtime-private gesture state and returns
 * the sample's effective allowed axes and requested offset:
 *  - touch ignores `altActive`;
 *  - mouse without Alt keeps the configured axes;
 *  - mouse with Alt restricts motion to the screen-intent axis; `pending` freezes both axes;
 *  - Alt press/release and a sticky axis switch between chosen axes rebase on the currently
 *    applied offset (the sample's effective request equals the applied offset: no pose write).
 * Thresholds/dominance come from `motion/axis-intent.mjs` unchanged.
 */
export const resolveGestureAxes = (gesture, request, configuredAxes, appliedOffsetM) => {
  if (gesture.pointerType !== 'mouse') {
    return sampleResult(gesture, request, configuredAxes);
  }

  const altChanged = request.altActive !== gesture.altActive;
  gesture.altActive = request.altActive;
  if (altChanged) {
    gesture.intentAxis = AXIS_PENDING;
    gesture.axisIntent.reset(request.screenPointPx, AXIS_PENDING);
    rebaseOnApplied(gesture, request.requestedOffsetM, appliedOffsetM);
    return sampleResult(gesture, request, [], {
      rebase: true,
      intentAxis: request.altActive ? AXIS_PENDING : null
    });
  }

  if (!request.altActive) {
    return sampleResult(gesture, request, configuredAxes);
  }

  const previousAxis = gesture.intentAxis;
  const result = gesture.axisIntent.update(request.screenPointPx, request.screenAxisBasis);
  if (!result.valid) {
    // Degenerate screen basis: no axis decision from this sample, no motion.
    return sampleResult(gesture, request, [], { intentAxis: previousAxis });
  }
  gesture.intentAxis = result.axis;
  if (result.changed && previousAxis !== AXIS_PENDING) {
    gesture.axisIntent.reset(request.screenPointPx, result.axis);
    rebaseOnApplied(gesture, request.requestedOffsetM, appliedOffsetM);
    return sampleResult(gesture, request, [], { rebase: true, intentAxis: result.axis });
  }
  if (result.axis === AXIS_PENDING) {
    return sampleResult(gesture, request, [], { intentAxis: AXIS_PENDING });
  }
  return sampleResult(gesture, request, configuredAxes.filter(axis => axis === result.axis), {
    intentAxis: result.axis
  });
};

const sameNumberM = (left, right) => {
  if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
  if (Object.is(left, right)) return true;
  const scale = Math.max(Math.abs(left), Math.abs(right), 1);
  return Math.abs(left - right) <= Number.EPSILON * RESIDUAL_COMPARISON_ULPS * scale;
};

const measureResidual = ({ pair, residualM, applied, frame, metric }) => {
  const afterWorldM = buildFramePointM(frame, {
    u: applied.offsetM.u + residualM.u,
    v: applied.offsetM.v + residualM.v
  });
  let value = null;
  try {
    value = metric.measure(deepFreeze({
      schemaVersion: SPATIAL_MANIPULATION_SCHEMA_VERSION,
      source: { ...pair.source },
      target: { ...pair.target },
      beforeWorldM: { ...applied.pivotWorldM },
      afterWorldM,
      correctionM: { ...residualM }
    }));
  } catch {
    value = null;
  }
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return { value, unit: 'css-px' };
  }
  return { value: Math.hypot(residualM.u, residualM.v), unit: 'm' };
};

/**
 * public-api.md §2.4: the resolver output is pre-apply only; the runtime finalizes
 * `SnapPairObservationV1[]` against the actual applied pose. A pair is satisfied when every
 * controlled axis of the applied offset equals `requested + proposedCorrection`.
 */
export const finalizeSnapPairs = ({ resolution, requestedOffsetM, applied, frame, metric }) => (resolution?.pairs ?? []).map(pair => {
  const controlled = new Set(pair.controlledAxes);
  const residualM = { u: 0, v: 0 };
  const appliedCorrectionM = { u: 0, v: 0 };
  for (const axis of MOTION_AXES) {
    if (!controlled.has(axis)) continue;
    const targetM = requestedOffsetM[axis] + pair.proposedCorrectionM[axis];
    residualM[axis] = targetM - applied.offsetM[axis];
    appliedCorrectionM[axis] = applied.offsetM[axis] - requestedOffsetM[axis];
  }
  const satisfiedAtAppliedPose = MOTION_AXES
    .filter(axis => controlled.has(axis))
    .every(axis => sameNumberM(residualM[axis], 0));
  const distance = measureResidual({ pair, residualM, applied, frame, metric });
  return {
    pairId: pair.pairId,
    ruleId: pair.ruleId,
    source: { ...pair.source },
    target: { ...pair.target },
    controlledAxes: pair.controlledAxes.slice(),
    selection: pair.selection,
    satisfiedAtAppliedPose,
    appliedCorrectionM,
    residualM: {
      u: Object.is(residualM.u, -0) ? 0 : residualM.u,
      v: Object.is(residualM.v, -0) ? 0 : residualM.v
    },
    distance: {
      value: distance.value,
      unit: distance.unit,
      metricId: pair.distance.metricId,
      evaluatedAt: 'applied'
    },
    ...(pair.bundleId === undefined ? {} : { bundleId: pair.bundleId })
  };
});
