// Gesture commands: begin/update/end/cancel, coordinator leases, gesture feedback.
// Split out of instance.mjs (spatial-manipulation V2, P2). Shared instance state and the other
// sections are reached through `ctx`; this section registers its functions on it.
import { SPATIAL_MANIPULATION_ERROR_CODE } from '../core/contracts/errors.mjs';
import { SPATIAL_MANIPULATION_EVENT } from '../core/contracts/constants.mjs';
import {
  actualDelta,
  observationFromCollisionSnapshot,
  offsetsEqual,
  staleCollisionObservation,
  tupleFromCollisionSnapshot
} from './instance-support.mjs';
import {
  createDefaultCollisionObservation,
  createDefaultSnapObservation,
  createDiagnostic,
  createMotionFeedback,
  createSpatialError,
  createSpatialEvent
} from './reports.mjs';
import {
  createGestureRuntimeState,
  createGestureSnapshot,
  describeGestureSnapshotDrift,
  normalizeBeginGestureRequest,
  normalizeCancelGestureRequest,
  normalizeEndGestureRequest,
  normalizeUpdateGestureRequest,
  resolveGestureAxes
} from './gesture.mjs';
import { createMotionPlanV1 } from '../core/motion/planner.mjs';

export const installGestureCommands = ctx => {

  const activeGestureOrThrow = gestureId => {
    if (!ctx.state.activeGesture || ctx.state.activeGesture.gestureId !== gestureId) {
      throw createSpatialError(SPATIAL_MANIPULATION_ERROR_CODE.BUSY, 'Gesture is not active', {
        expected: { gestureId },
        actual: { gestureId: ctx.state.activeGesture?.gestureId ?? null }
      });
    }
    return ctx.state.activeGesture;
  };

  const assertGestureCurrent = gesture => {
    const drift = describeGestureSnapshotDrift(gesture, ctx.state);
    if (drift) {
      throw createSpatialError(drift.code, 'Gesture snapshot is stale', {
        expected: drift.expected,
        actual: drift.actual
      });
    }
  };

  const publishLifecycleEvent = ({ event, sequence, commandSequence, meta = {}, gestureId, reason, report }) => {
    ctx.events.publish(createSpatialEvent({
      event,
      instanceId: ctx.state.instanceId,
      sequence,
      commandSequence,
      commandId: meta.commandId,
      correlationId: meta.correlationId,
      gestureId,
      reason,
      state: ctx.stateDto(),
      report
    }));
  };

  // Exact MotionFeedbackV1 for gesture terminals that write no pose (begin/end/cancel-without-
  // restore, rebind/destroy cancels): requested/planned null, zero corrections, frozen observations.
  const gestureFeedback = ({
    sequence,
    commandSequence,
    meta,
    gestureId,
    reason,
    outcome,
    previousApplied,
    applied,
    requested = null,
    planned = null,
    corrections = [],
    snap = ctx.state.snap,
    collision = ctx.state.collision,
    diagnostics = []
  }) => createMotionFeedback({
    instanceId: ctx.state.instanceId,
    dependencyScopeId: ctx.state.binding.dependencyScopeId,
    sequence,
    commandSequence,
    commandId: meta.commandId,
    correlationId: meta.correlationId,
    gestureId,
    source: meta.source,
    reason,
    outcome,
    previousApplied,
    requested,
    planned,
    applied,
    // AC-17: `applied === null` means no pose write happened; the actual delta is zero.
    actualDeltaM: applied === null ? { u: 0, v: 0 } : actualDelta(previousApplied, applied),
    corrections,
    snap,
    collision,
    diagnostics
  });

  const endCoordinatorGesture = gestureId => {
    if (ctx.coordinator && gestureId) {
      ctx.coordinator.endGesture({ instanceId: ctx.state.instanceId, gestureId });
    }
  };

  /**
   * public-api.md §8: a PosePort failure during a gesture terminally cancels it exactly once
   * (`reason:"pose-port-failure"`), marks the binding pending/non-current with unknown
   * observations, releases the gesture lease and publishes no successful motion event.
   */
  const terminalGestureFailure = ({ gestureId, commandSequence, meta, previous, error, expected }) => {
    // Marked while the gesture is still active: the ready → pending notice is deferred and
    // published right after this terminal cancel (§7 event order).
    const marked = ctx.markPoseFailurePending(ctx.state);
    const sequence = marked.sequence + 1;
    endCoordinatorGesture(gestureId);
    ctx.gestureRuntime = null;
    ctx.state = {
      ...marked,
      sequence,
      commandSequence,
      activeGesture: null
    };
    const cancelReport = gestureFeedback({
      sequence,
      commandSequence,
      meta,
      gestureId,
      reason: 'cancel',
      outcome: 'rejected',
      previousApplied: previous,
      applied: null,
      diagnostics: [createDiagnostic(
        SPATIAL_MANIPULATION_ERROR_CODE.POSE_APPLY_FAILED,
        'Pose port failed during gesture',
        expected,
        { code: error?.code ?? 'POSE_PORT_FAILED', message: error?.message ?? 'PosePort failed' }
      )]
    });
    publishLifecycleEvent({
      event: SPATIAL_MANIPULATION_EVENT.GESTURE_CANCEL,
      sequence,
      commandSequence,
      meta,
      gestureId,
      reason: 'pose-port-failure',
      report: cancelReport
    });
    ctx.flushPoseFailureNotice({ commandSequence, meta });
  };

  const beginGesture = (request, meta) => {
    try {
      const normalized = normalizeBeginGestureRequest(request);
      return ctx.enqueueLifecycle(meta, async (commandSequence, normalizedMeta) => {
        const active = ctx.state.activeGesture;
        if (active) {
          const sameGesture = active.gestureId === normalized.gestureId
            && active.pointerType === normalized.pointerType
            && active.pointerId === normalized.pointerId;
          if (sameGesture) {
            // §5.3: duplicate begin of the same gesture is idempotent (no second gesturestart).
            return gestureFeedback({
              sequence: ctx.state.sequence,
              commandSequence,
              meta: normalizedMeta,
              gestureId: normalized.gestureId,
              reason: 'begin',
              outcome: 'unchanged',
              previousApplied: ctx.state.applied,
              applied: ctx.state.applied
            });
          }
          throw createSpatialError(SPATIAL_MANIPULATION_ERROR_CODE.BUSY, 'Gesture already active', {
            expected: { gestureId: normalized.gestureId, pointerType: normalized.pointerType, pointerId: normalized.pointerId },
            actual: { gestureId: active.gestureId, pointerType: active.pointerType, pointerId: active.pointerId }
          });
        }
        if (ctx.state.binding.readiness !== 'ready') {
          throw createSpatialError(SPATIAL_MANIPULATION_ERROR_CODE.NOT_READY, 'Binding is not ready', {
            expected: { readiness: 'ready' },
            actual: { readiness: ctx.state.binding.readiness, bindingGeneration: ctx.state.binding.bindingGeneration }
          });
        }
        let gestureLeaseHeld = false;
        try {
          if (ctx.coordinator) {
            ctx.coordinator.beginGesture({
              instanceId: ctx.state.instanceId,
              gestureId: normalized.gestureId,
              pointerType: normalized.pointerType,
              pointerId: normalized.pointerId
            });
            gestureLeaseHeld = true;
          }
          const applied = await ctx.readCurrentPose();
          const collisionSnapshot = await ctx.readCollisionSnapshot();
          if (collisionSnapshot) {
            ctx.acceptedSnapshots.collision = { snapshot: collisionSnapshot, tuple: tupleFromCollisionSnapshot(collisionSnapshot) };
          }
          const snapRead = await ctx.readSnapTupleAtBegin();
          const snapshot = createGestureSnapshot({ request: normalized, state: ctx.state, applied });
          const sequence = ctx.state.sequence + 1;
          ctx.gestureRuntime = createGestureRuntimeState({
            request: normalized,
            applied,
            snapTuple: snapRead.tuple,
            collisionTuple: collisionSnapshot ? tupleFromCollisionSnapshot(collisionSnapshot) : null
          });
          ctx.state = {
            ...ctx.state,
            lifecycle: 'gesturing',
            sequence,
            commandSequence,
            applied,
            activeGesture: snapshot
          };
          const report = gestureFeedback({
            sequence,
            commandSequence,
            meta: normalizedMeta,
            gestureId: normalized.gestureId,
            reason: 'begin',
            outcome: 'unchanged',
            previousApplied: applied,
            applied,
            diagnostics: snapRead.diagnostics
          });
          publishLifecycleEvent({
            event: SPATIAL_MANIPULATION_EVENT.GESTURE_START,
            sequence,
            commandSequence,
            meta: normalizedMeta,
            gestureId: normalized.gestureId,
            reason: 'begin',
            report
          });
          return report;
        } catch (error) {
          if (gestureLeaseHeld) {
            endCoordinatorGesture(normalized.gestureId);
          }
          throw error;
        }
      });
    } catch (error) {
      return Promise.reject(error);
    }
  };

  const updateGesture = (request, meta) => {
    try {
      ctx.assertLive();
      const normalized = normalizeUpdateGestureRequest(request);
      const normalizedMeta = ctx.acceptMeta(meta);
      const commandSequence = ctx.queue.acceptedWatermark + 1;
      return ctx.queue.enqueue(commandSequence, async () => {
        // §5.1: liveness and the active gesture are checked at the FIFO head, after earlier commands.
        ctx.assertLive();
        const gesture = activeGestureOrThrow(normalized.gestureId);
        assertGestureCurrent(gesture);
        const runtimeGesture = ctx.gestureRuntime;
        if (!runtimeGesture || runtimeGesture.gestureId !== gesture.gestureId) {
          // Defensive: a gesture whose runtime-private state is gone (e.g. a rebind that failed
          // after releasing gesture ownership) cannot continue without a lease.
          throw createSpatialError(SPATIAL_MANIPULATION_ERROR_CODE.BUSY, 'Gesture runtime state is no longer available', {
            expected: { gestureId: gesture.gestureId },
            actual: { gestureId: runtimeGesture?.gestureId ?? null }
          });
        }
        // Ruling R2: axis intent/rebase are resolved against the currently applied offset; the
        // head-time `state.applied` is the pose `readCurrentPose()` must match under the lease.
        const sample = resolveGestureAxes(runtimeGesture, normalized, ctx.state.config.motion.allowedAxes, ctx.state.applied.offsetM);
        let snapRead = null;
        let report;
        try {
          report = await ctx.executeMotion({
            commandKind: 'gesture-update',
            reason: 'move',
            constraintMode: 'respect',
            gridMode: 'respect',
            ...normalizedMeta,
            gestureId: normalized.gestureId,
            commandSequence,
            useGestureLease: true,
            projectionRevision: normalized.projectionRevision,
            // §7 step 5: the gesture verifies the collision tuple captured at beginGesture.
            capturedCollisionTuple: runtimeGesture.collisionTuple ?? undefined,
            motion: sample.allowedAxes.length === ctx.state.config.motion.allowedAxes.length
              ? ctx.state.config.motion
              : { ...ctx.state.config.motion, allowedAxes: sample.allowedAxes },
            drag: {
              rawOffsetM: sample.requestedOffsetM,
              priorAppliedRequestM: runtimeGesture.priorRequestM
            },
            resolveRequestedOffset: () => sample.requestedOffsetM,
            resolveSnap: async previous => {
              snapRead = await ctx.resolveGestureSnap({ request: normalized, sample, gesture: runtimeGesture, previous });
              return snapRead;
            }
          });
        } catch (error) {
          // §8: a PosePort failure before a verified applied pose (e.g. readPose) that the apply
          // branch did not already handle still ends the gesture with its one terminal cancel.
          if (
            error?.code === SPATIAL_MANIPULATION_ERROR_CODE.POSE_APPLY_FAILED
            && ctx.gestureRuntime === runtimeGesture
            && ctx.state.activeGesture?.gestureId === normalized.gestureId
          ) {
            terminalGestureFailure({
              gestureId: normalized.gestureId,
              commandSequence,
              meta: normalizedMeta,
              previous: ctx.state.applied,
              error,
              expected: { poseRevision: ctx.state.applied?.poseRevision ?? null }
            });
          }
          throw error;
        }
        if (ctx.gestureRuntime === runtimeGesture) {
          // Latch write-back (§2.4 latch rules) and per-gesture prior request/applied tracking.
          if (snapRead?.finalize) {
            runtimeGesture.snapLatch = snapRead.resolution ? snapRead.resolution.nextLatch : null;
            runtimeGesture.lastSnap = snapRead;
          }
          runtimeGesture.priorRequestM = { ...sample.requestedOffsetM };
          runtimeGesture.priorAppliedM = { ...report.applied.offsetM };
        }
        return report;
      });
    } catch (error) {
      return Promise.reject(error);
    }
  };

  const endGesture = (request, meta) => {
    try {
      const normalized = normalizeEndGestureRequest(request);
      return ctx.enqueueLifecycle(meta, (commandSequence, normalizedMeta) => {
        activeGestureOrThrow(normalized.gestureId);
        // §5.3/AC-18: final pairs are re-evaluated at the retained applied pose before the latch clears.
        const finalSnap = ctx.gestureRuntime?.lastSnap?.finalize
          ? ctx.gestureRuntime.lastSnap.finalize(ctx.state.applied)
          : ctx.state.snap;
        endCoordinatorGesture(normalized.gestureId);
        const sequence = ctx.state.sequence + 1;
        ctx.state = {
          ...ctx.state,
          lifecycle: 'ready',
          sequence,
          commandSequence,
          activeGesture: null,
          snap: finalSnap
        };
        ctx.gestureRuntime = null;
        const report = gestureFeedback({
          sequence,
          commandSequence,
          meta: normalizedMeta,
          gestureId: normalized.gestureId,
          reason: 'release',
          outcome: 'unchanged',
          previousApplied: ctx.state.applied,
          applied: ctx.state.applied,
          snap: finalSnap
        });
        publishLifecycleEvent({
          event: SPATIAL_MANIPULATION_EVENT.GESTURE_END,
          sequence,
          commandSequence,
          meta: normalizedMeta,
          gestureId: normalized.gestureId,
          reason: 'release',
          report
        });
        return report;
      });
    } catch (error) {
      return Promise.reject(error);
    }
  };

  const evaluateCollisionAtPose = async applied => {
    const read = await ctx.readCollisionSnapshotAfterApply(null, applied);
    if (!read) {
      return createDefaultCollisionObservation({ ...ctx.state, applied });
    }
    if (read.diagnostic) {
      return read.observation;
    }
    try {
      const observation = observationFromCollisionSnapshot(read, ctx.state, applied);
      ctx.acceptedSnapshots.collision = { snapshot: read, tuple: tupleFromCollisionSnapshot(read) };
      return observation;
    } catch (error) {
      const diagnostic = createDiagnostic(
        SPATIAL_MANIPULATION_ERROR_CODE.DEPENDENCY_CHANGED_AFTER_APPLY,
        'Spatial observation evaluation failed after apply',
        tupleFromCollisionSnapshot(read),
        { code: error?.code ?? 'OBSERVATION_EVALUATION_FAILED', message: error?.message ?? 'Observation evaluation failed' }
      );
      return staleCollisionObservation(read, ctx.state, applied, diagnostic);
    }
  };

  const cancelGesture = (request, meta) => {
    try {
      const normalized = normalizeCancelGestureRequest(request);
      return ctx.enqueueLifecycle(meta, async (commandSequence, normalizedMeta) => {
        const gesture = activeGestureOrThrow(normalized.gestureId);
        // Ruling R1: only the captured binding/frame/policy stamps gate the restore.
        const drift = describeGestureSnapshotDrift(gesture, ctx.state);
        let previous = ctx.state.applied;
        let applied = ctx.state.applied;
        let plan = null;
        let snap = ctx.state.snap;
        let collision = ctx.state.collision;
        if (!drift) {
          try {
            previous = await ctx.readCurrentPose();
            applied = previous;
            if (!offsetsEqual(previous.offsetM, gesture.startApplied.offsetM)) {
              plan = createMotionPlanV1({
                schemaVersion: 1,
                instanceId: ctx.state.instanceId,
                commandId: normalizedMeta.commandId,
                dependencyScopeId: ctx.state.binding.dependencyScopeId,
                bindingGeneration: ctx.state.binding.bindingGeneration,
                frame: ctx.state.config.frame,
                policyRevision: ctx.state.policyRevision,
                currentApplied: previous,
                expectedPoseRevision: previous.poseRevision,
                requestedOffsetM: gesture.startApplied.offsetM,
                commandKind: 'reset',
                constraintMode: 'bypass',
                gridMode: 'skip',
                motion: ctx.state.config.motion,
                snapResolution: null,
                drag: null
              });
              applied = await ctx.applyPlan(plan, previous);
              collision = await evaluateCollisionAtPose(applied);
              snap = createDefaultSnapObservation({ ...ctx.state, applied });
            }
          } catch (error) {
            // §5.3/§8: a failing read/restore still emits the gesture's one terminal gesturecancel.
            terminalGestureFailure({
              gestureId: normalized.gestureId,
              commandSequence,
              meta: normalizedMeta,
              previous,
              error,
              expected: {
                startU: gesture.startApplied.offsetM.u,
                startV: gesture.startApplied.offsetM.v,
                startPoseRevision: gesture.startApplied.poseRevision
              }
            });
            throw error;
          }
        }
        endCoordinatorGesture(normalized.gestureId);
        const sequence = ctx.state.sequence + 1;
        ctx.state = {
          ...ctx.state,
          lifecycle: 'ready',
          sequence,
          commandSequence,
          applied,
          activeGesture: null,
          snap,
          collision
        };
        ctx.gestureRuntime = null;
        const restored = plan !== null;
        const report = gestureFeedback({
          sequence,
          commandSequence,
          meta: normalizedMeta,
          gestureId: normalized.gestureId,
          reason: 'cancel',
          outcome: drift ? 'rejected' : (restored ? 'applied' : 'unchanged'),
          previousApplied: previous,
          applied,
          requested: plan?.requested ?? null,
          planned: plan?.planned ?? null,
          corrections: plan?.corrections ?? [],
          snap,
          collision,
          diagnostics: drift ? [createDiagnostic(drift.code, 'Gesture stamps are stale: cancel performed no restore', drift.expected, drift.actual)] : []
        });
        publishLifecycleEvent({
          event: SPATIAL_MANIPULATION_EVENT.GESTURE_CANCEL,
          sequence,
          commandSequence,
          meta: normalizedMeta,
          gestureId: normalized.gestureId,
          reason: normalized.reason,
          report
        });
        if (drift) {
          throw createSpatialError(drift.code, 'Gesture stamps are stale: cancel performed no restore', {
            expected: drift.expected,
            actual: drift.actual
          });
        }
        return report;
      });
    } catch (error) {
      return Promise.reject(error);
    }
  };

  Object.assign(ctx, {
    activeGestureOrThrow,
    assertGestureCurrent,
    publishLifecycleEvent,
    gestureFeedback,
    endCoordinatorGesture,
    terminalGestureFailure,
    beginGesture,
    updateGesture,
    endGesture,
    evaluateCollisionAtPose,
    cancelGesture
  });
};
