/**
 * PosePort over a simple pose driver (engine-free).
 *
 * A driver is `{ read(): { u, v }, write({ u, v }): void | Promise<void> }` — the object's current offset in the
 * frame and a writer. The port adds what the core requires from a PosePort: identity
 * checks, the pose revision (bumped only when the offset actually changes), read-back of the pose
 * the writer produced, and SPATIAL_POSE_APPLY_FAILED with expected/actual on any divergence.
 */
import { SPATIAL_MANIPULATION_ERROR_CODE } from '../core/contracts/errors.mjs';
import { deepFreeze } from '../core/contracts/immutable.mjs';
import { buildFramePointM } from '../core/motion/frame.mjs';
import { createSpatialError } from './reports.mjs';

const finite = value => typeof value === 'number' && Number.isFinite(value);

const fail = (message, expected, actual) => createSpatialError(
  SPATIAL_MANIPULATION_ERROR_CODE.POSE_APPLY_FAILED,
  message,
  { expected, actual }
);

const readOffset = driver => {
  const offset = driver.read();
  if (!finite(offset?.u) || !finite(offset?.v)) {
    throw fail('Pose driver reports a non-finite offset', { finite: true }, { finite: false, u: offset?.u ?? null, v: offset?.v ?? null });
  }
  return { u: offset.u, v: offset.v };
};

export function createDriverPosePort({ instanceId, getBindingGeneration, driver }) {
  if (!driver || typeof driver.read !== 'function' || typeof driver.write !== 'function') {
    throw new TypeError('createDriverPosePort requires a driver { read, write }');
  }
  let current = driver;
  let poseRevision = 0;
  let frame = null;

  const assertLive = () => {
    if (current === null) {
      throw createSpatialError(SPATIAL_MANIPULATION_ERROR_CODE.DESTROYED, 'Pose port released', {
        expected: { released: false },
        actual: { released: true }
      });
    }
  };
  const assertIdentity = (actualInstanceId, actualGeneration) => {
    const expected = { instanceId, bindingGeneration: getBindingGeneration() };
    if (actualInstanceId !== expected.instanceId || actualGeneration !== expected.bindingGeneration) {
      throw fail('Pose request targets another instance or binding generation', expected, {
        instanceId: actualInstanceId,
        bindingGeneration: actualGeneration
      });
    }
    return expected.bindingGeneration;
  };
  const pose = (bindingGeneration, offsetM) => deepFreeze({
    instanceId,
    bindingGeneration,
    poseRevision,
    offsetM: { u: offsetM.u, v: offsetM.v },
    pivotWorldM: buildFramePointM(frame, offsetM)
  });

  return Object.freeze({
    async readPose(request) {
      assertLive();
      const bindingGeneration = assertIdentity(request?.instanceId, request?.bindingGeneration);
      frame = request.frame;
      return pose(bindingGeneration, readOffset(current));
    },

    async apply(plan) {
      assertLive();
      const bindingGeneration = assertIdentity(plan?.instanceId, plan?.bindingGeneration);
      if (plan?.expectedPoseRevision !== poseRevision) {
        throw fail('Pose plan was built against another pose revision', { expectedPoseRevision: poseRevision }, {
          expectedPoseRevision: plan?.expectedPoseRevision ?? null
        });
      }
      if (frame === null) throw fail('Pose apply requires a preceding readPose', { frameRead: true }, { frameRead: false });
      const planned = plan.planned?.offsetM;
      if (!finite(planned?.u) || !finite(planned?.v)) throw fail('Pose plan offset is not finite', { finite: true }, { finite: false });
      const before = readOffset(current);
      try {
        await current.write({ u: planned.u, v: planned.v });
      } catch (error) {
        throw fail(`Pose driver write failed: ${error?.message ?? error}`, { written: true }, { written: false });
      }
      const actual = readOffset(current);
      if (!Object.is(actual.u, planned.u) || !Object.is(actual.v, planned.v)) {
        throw fail('Pose driver applied a divergent pose', { u: planned.u, v: planned.v }, actual);
      }
      if (!Object.is(actual.u, before.u) || !Object.is(actual.v, before.v)) poseRevision += 1;
      return pose(bindingGeneration, actual);
    },

    release() {
      current = null;
      frame = null;
    }
  });
}
