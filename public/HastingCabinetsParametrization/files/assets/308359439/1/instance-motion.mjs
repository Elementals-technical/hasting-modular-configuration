// Pose port I/O and the motion command path (setOffset/moveBy/reset execution, FIFO admission).
// Split out of instance.mjs (spatial-manipulation V2, P2). Shared instance state and the other
// sections are reached through `ctx`; this section registers its functions on it.
import { SPATIAL_MANIPULATION_ERROR_CODE, throwSpatialInvalidInput } from '../core/contracts/errors.mjs';
import { SPATIAL_MANIPULATION_EVENT } from '../core/contracts/constants.mjs';
import {
  actualDelta,
  assertReadMatchesCurrent,
  assertStaticSnapTuple,
  expectedGeometryRequest,
  normalizeMeta,
  normalizePose,
  observationFromCollisionSnapshot,
  offsetsEqual,
  staleCollisionObservation,
  tupleFromCollisionSnapshot,
  tuplesEqual,
  validateCollisionSnapshotShape,
  vec3Equal
} from './instance-support.mjs';
import {
  createDiagnostic,
  createMotionFeedback,
  createSpatialError,
  createSpatialEvent,
  normalizeRuntimeError
} from './reports.mjs';
import { createMotionPlanV1 } from '../core/motion/planner.mjs';
import { normalizeSnapGeometrySnapshotV1 } from '../core/snapping/candidates.mjs';

export const installMotionCommands = ctx => {

  const readCurrentPose = async () => {
    try {
      const pose = await ctx.ports.pose.readPose({
        instanceId: ctx.state.instanceId,
        objectId: ctx.state.objectId,
        dependencyScopeId: ctx.state.binding.dependencyScopeId,
        bindingGeneration: ctx.state.binding.bindingGeneration,
        frame: ctx.state.config.frame
      });
      const normalized = normalizePose(pose, ctx.state, 'readPose');
      assertReadMatchesCurrent(normalized, ctx.state);
      return normalized;
    } catch (error) {
      throw normalizeRuntimeError(
        error,
        SPATIAL_MANIPULATION_ERROR_CODE.POSE_APPLY_FAILED,
        'PosePort.readPose failed'
      );
    }
  };

  const applyPlan = async (plan, previous) => {
    try {
      const actual = normalizePose(await ctx.ports.pose.apply(plan), ctx.state, 'apply');
      if (!offsetsEqual(actual.offsetM, plan.planned.offsetM)) {
        throw createSpatialError(SPATIAL_MANIPULATION_ERROR_CODE.POSE_APPLY_FAILED, 'PosePort applied divergent pose');
      }
      if (!vec3Equal(actual.pivotWorldM, plan.planned.pivotWorldM)) {
        throw createSpatialError(SPATIAL_MANIPULATION_ERROR_CODE.POSE_APPLY_FAILED, 'PosePort applied divergent pivot');
      }
      const changed = !offsetsEqual(previous.offsetM, actual.offsetM);
      if (changed && actual.poseRevision <= plan.expectedPoseRevision) {
        throw createSpatialError(SPATIAL_MANIPULATION_ERROR_CODE.POSE_APPLY_FAILED, 'PosePort did not increment changed pose revision');
      }
      if (!changed && actual.poseRevision !== plan.expectedPoseRevision) {
        throw createSpatialError(SPATIAL_MANIPULATION_ERROR_CODE.POSE_APPLY_FAILED, 'PosePort changed revision for unchanged pose');
      }
      return actual;
    } catch (error) {
      ctx.state = ctx.markPoseFailurePending(ctx.state);
      throw normalizeRuntimeError(
        error,
        SPATIAL_MANIPULATION_ERROR_CODE.POSE_APPLY_FAILED,
        'PosePort.apply failed'
      );
    }
  };

  const readCollisionSnapshot = async () => {
    if (!ctx.state.config.collision.enabled) {
      return null;
    }
    try {
      const snapshot = await ctx.ports.geometry.readCollisionSnapshot(
        expectedGeometryRequest(ctx.state, 'collision', ctx.state.collision.queryId)
      );
      return validateCollisionSnapshotShape(snapshot, ctx.state);
    } catch (error) {
      throw normalizeRuntimeError(
        error,
        SPATIAL_MANIPULATION_ERROR_CODE.STALE_GEOMETRY,
        'GeometryPort.readCollisionSnapshot failed'
      );
    }
  };

  const readSnapSnapshot = async () => {
    if (!ctx.state.config.snapping.enabled) {
      return null;
    }
    try {
      const snapshot = await ctx.ports.geometry.readSnapSnapshot(
        expectedGeometryRequest(ctx.state, 'snap', ctx.state.snap.queryId)
      );
      const normalized = normalizeSnapGeometrySnapshotV1(snapshot, 'snapSnapshot');
      assertStaticSnapTuple(normalized, ctx.state);
      return normalized;
    } catch (error) {
      throw normalizeRuntimeError(
        error,
        SPATIAL_MANIPULATION_ERROR_CODE.STALE_GEOMETRY,
        'GeometryPort.readSnapSnapshot failed'
      );
    }
  };

  const readCollisionSnapshotAfterApply = async (preCollisionSnapshot, applied) => {
    try {
      return await readCollisionSnapshot();
    } catch (error) {
      const diagnostic = createDiagnostic(
        SPATIAL_MANIPULATION_ERROR_CODE.DEPENDENCY_CHANGED_AFTER_APPLY,
        'Spatial dependency validation failed after apply',
        preCollisionSnapshot ? tupleFromCollisionSnapshot(preCollisionSnapshot) : undefined,
        {
          code: error?.code ?? 'GEOMETRY_POST_APPLY_FAILED',
          message: error?.message ?? 'Geometry post-apply validation failed'
        }
      );
      return {
        snapshot: preCollisionSnapshot,
        diagnostic,
        observation: staleCollisionObservation(preCollisionSnapshot, ctx.state, applied, diagnostic)
      };
    }
  };

  const executeMotion = async command => {
    let lease = null;
    ctx.assertLive();
    if (ctx.state.binding.readiness !== 'ready') {
      throw createSpatialError(SPATIAL_MANIPULATION_ERROR_CODE.NOT_READY, 'Binding is not ready');
    }
    if (!command.gestureId && ctx.state.activeGesture) {
      // public-api.md §5.1: programmatic motion during an active gesture is BUSY, decided at the
      // FIFO head before any lease acquisition (holds without a coordinator too).
      throw createSpatialError(SPATIAL_MANIPULATION_ERROR_CODE.BUSY, 'Programmatic motion rejected during active gesture', {
        expected: { activeGesture: null },
        actual: { gestureId: ctx.state.activeGesture.gestureId }
      });
    }
    try {
      if (ctx.coordinator && !command.useGestureLease) {
        const registered = ctx.coordinator.getInstance(ctx.state.instanceId);
        lease = ctx.coordinator.acquireTransformLease({
          instanceId: ctx.state.instanceId,
          gestureId: command.commandId,
          dependencyScopeId: ctx.state.binding.dependencyScopeId,
          transformIds: registered?.protectedTransformIds ?? [
            ...ctx.state.binding.transformTargetIds,
            ...ctx.state.binding.spatialDependencyTransformIds
          ]
        });
      }

      const previous = await readCurrentPose();

      const requestedOffsetM = command.resolveRequestedOffset(previous);
      const snapRead = command.resolveSnap
        ? await command.resolveSnap(previous)
        : { resolution: null, observation: ctx.state.snap, snapshot: null };
      const plan = createMotionPlanV1({
        schemaVersion: 1,
        instanceId: ctx.state.instanceId,
        commandId: command.commandId,
        dependencyScopeId: ctx.state.binding.dependencyScopeId,
        bindingGeneration: ctx.state.binding.bindingGeneration,
        frame: ctx.state.config.frame,
        policyRevision: ctx.state.policyRevision,
        currentApplied: previous,
        expectedPoseRevision: previous.poseRevision,
        requestedOffsetM,
        commandKind: command.commandKind,
        constraintMode: command.constraintMode,
        gridMode: command.gridMode,
        // Gesture updates may restrict allowed axes to the mouse Alt intent axis (ruling R2);
        // programmatic commands never set `command.motion`.
        motion: command.motion ?? ctx.state.config.motion,
        snapResolution: snapRead.resolution,
        drag: command.drag ?? null
      });

      const plannedChanged = !offsetsEqual(previous.offsetM, plan.planned.offsetM);
      let preCollisionSnapshot = null;
      let applied = previous;
      // Snap-sample diagnostics (§9 unavailable geometry, gesture-scope drift) surface on the report.
      let diagnostics = snapRead.diagnostics ? [...snapRead.diagnostics] : [];
      let collision = ctx.state.collision;
      let snap = snapRead.observation ?? ctx.state.snap;

      if (plannedChanged) {
        preCollisionSnapshot = await readCollisionSnapshot();
        try {
          applied = await applyPlan(plan, previous);
        } catch (error) {
          if (command.gestureId && ctx.state.activeGesture?.gestureId === command.gestureId) {
            ctx.terminalGestureFailure({
              gestureId: command.gestureId,
              commandSequence: command.commandSequence,
              meta: command,
              previous,
              error,
              expected: { expectedPoseRevision: plan.expectedPoseRevision, plannedU: plan.planned.offsetM.u, plannedV: plan.planned.offsetM.v }
            });
          }
          throw error;
        }
        if (snapRead.finalize) {
          snap = snapRead.finalize(applied);
        }
        const postRead = await readCollisionSnapshotAfterApply(preCollisionSnapshot, applied);
        if (postRead?.diagnostic) {
          diagnostics = [...diagnostics, postRead.diagnostic];
          collision = postRead.observation;
        } else if (preCollisionSnapshot && postRead) {
          const postCollisionSnapshot = postRead;
          // A gesture verifies the tuple captured at beginGesture (§7 step 5); a programmatic
          // command verifies the tuple it captured pre-apply.
          const preTuple = tupleFromCollisionSnapshot(preCollisionSnapshot);
          const postTuple = tupleFromCollisionSnapshot(postCollisionSnapshot);
          const expected = command.capturedCollisionTuple ?? preTuple;
          const actual = !tuplesEqual(expected, preTuple) ? preTuple : (!tuplesEqual(expected, postTuple) ? postTuple : null);
          if (actual) {
            const diagnostic = createDiagnostic(
              SPATIAL_MANIPULATION_ERROR_CODE.DEPENDENCY_CHANGED_AFTER_APPLY,
              'Spatial dependency tuple changed after apply',
              expected,
              actual
            );
            diagnostics = [...diagnostics, diagnostic];
            // A gesture's stale observation is stamped with its captured tuple, never the drifted one.
            collision = staleCollisionObservation(command.capturedCollisionTuple ?? postCollisionSnapshot, ctx.state, applied, diagnostic);
          } else {
            try {
              collision = observationFromCollisionSnapshot(preCollisionSnapshot, ctx.state, applied);
            } catch (error) {
              const diagnostic = createDiagnostic(
                SPATIAL_MANIPULATION_ERROR_CODE.DEPENDENCY_CHANGED_AFTER_APPLY,
                'Spatial observation evaluation failed after apply',
                expected,
                {
                  code: error?.code ?? 'OBSERVATION_EVALUATION_FAILED',
                  message: error?.message ?? 'Observation evaluation failed'
                }
              );
              diagnostics = [...diagnostics, diagnostic];
              collision = staleCollisionObservation(preCollisionSnapshot, ctx.state, applied, diagnostic);
            }
          }
        }
      }

      // F2: a command commits only the snap observation it computed; otherwise the commit-time state.
      if (!command.resolveSnap) snap = ctx.state.snap;
      const sequence = ctx.state.sequence + 1;
      const report = createMotionFeedback({
        instanceId: ctx.state.instanceId,
        dependencyScopeId: ctx.state.binding.dependencyScopeId,
        sequence,
        commandSequence: command.commandSequence,
        commandId: command.commandId,
        correlationId: command.correlationId,
        gestureId: command.gestureId,
        source: command.source,
        reason: command.reason,
        outcome: plannedChanged ? 'applied' : 'unchanged',
        previousApplied: previous,
        requested: plan.requested,
        planned: plan.planned,
        applied,
        actualDeltaM: actualDelta(previous, applied),
        corrections: plan.corrections,
        snap,
        collision,
        diagnostics
      });

      ctx.state = {
        ...ctx.state,
        lifecycle: command.gestureId ? 'gesturing' : 'ready',
        sequence,
        commandSequence: command.commandSequence,
        applied,
        lastMotion: report,
        snap,
        collision
      };

      ctx.events.publish(createSpatialEvent({
        event: SPATIAL_MANIPULATION_EVENT.MOTION_APPLIED,
        instanceId: ctx.state.instanceId,
        sequence,
        commandSequence: command.commandSequence,
        commandId: command.commandId,
        correlationId: command.correlationId,
        gestureId: command.gestureId,
        reason: command.reason,
        state: ctx.stateDto(),
        report
      }));

      return report;
    } finally {
      if (lease && ctx.coordinator) {
        ctx.coordinator.releaseTransformLease({
          leaseId: lease.leaseId,
          instanceId: ctx.state.instanceId,
          gestureId: command.commandId
        });
      }
    }
  };

  const enqueueMotion = (request, meta) => {
    ctx.assertLive();
    const normalizedMeta = normalizeMeta(meta, ctx.effectiveIdFactory, ctx.state);
    if (ctx.usedCommandIds.has(normalizedMeta.commandId)) {
      throwSpatialInvalidInput('meta.commandId');
    }
    ctx.usedCommandIds.add(normalizedMeta.commandId);
    const commandSequence = ctx.queue.acceptedWatermark + 1;
    return ctx.queue.enqueue(commandSequence, () => executeMotion({
      ...request,
      ...normalizedMeta,
      commandSequence
    }));
  };

  // public-api.md §5.1: every lifecycle command normalizes CommandMeta at acceptance, enforces
  // commandId uniqueness within the live instance and carries the meta into reports/events.
  const acceptMeta = meta => {
    const normalizedMeta = normalizeMeta(meta, ctx.effectiveIdFactory, ctx.state);
    if (ctx.usedCommandIds.has(normalizedMeta.commandId)) {
      throwSpatialInvalidInput('meta.commandId');
    }
    ctx.usedCommandIds.add(normalizedMeta.commandId);
    return normalizedMeta;
  };

  const enqueueLifecycle = (meta, handler) => {
    ctx.assertLive();
    const normalizedMeta = acceptMeta(meta);
    const commandSequence = ctx.queue.acceptedWatermark + 1;
    return ctx.queue.enqueue(commandSequence, () => {
      ctx.assertLive();
      return handler(commandSequence, normalizedMeta);
    });
  };

  Object.assign(ctx, {
    readCurrentPose,
    applyPlan,
    readCollisionSnapshot,
    readSnapSnapshot,
    readCollisionSnapshotAfterApply,
    executeMotion,
    enqueueMotion,
    acceptMeta,
    enqueueLifecycle
  });
};
