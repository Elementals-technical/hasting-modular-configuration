import { SPATIAL_MANIPULATION_ERROR_CODE, throwSpatialInvalidInput } from '../core/contracts/errors.mjs';
import { SPATIAL_MANIPULATION_EVENT } from '../core/contracts/constants.mjs';
import {
  assertCreateRequest,
  assertOptions,
  assertPorts,
  assertResetRequest,
  assertUv,
  createScopedIdFactory,
  isStringId,
  markPoseFailurePendingState
} from './instance-support.mjs';
import {
  copyPlainData,
  createDefaultCollisionObservation,
  createDefaultSnapObservation,
  createSpatialError,
  createSpatialEvent,
  publicAppliedPose
} from './reports.mjs';
import { createAsyncCommandQueueV1 } from './queue.mjs';
import { createSpatialCoordinatorV1 } from './coordination/registry.mjs';
import { createSpatialEventBusV1 } from './events.mjs';
import { createSpatialJobTrackerV1 } from './jobs.mjs';
import { deepFreeze } from '../core/contracts/immutable.mjs';
import { validateManipulationConfigV1, validateRuntimeBindingV1 } from '../core/contracts/validators.mjs';
import { installMotionCommands } from './instance-motion.mjs';
import { installSnapChannel } from './instance-snap.mjs';
import { installGestureCommands } from './instance-gesture.mjs';
import { installGeometryLifecycle } from './instance-geometry.mjs';

export const createManipulationInstanceV1 = ({ config, binding, ports, idFactory, coordinator = null, onDestroyed = null }) => {
  // Shared instance context: mutable state and cross-section functions (V2 P2 split).
  const ctx = { config, binding, ports, idFactory, coordinator, onDestroyed };
  const normalizedConfig = validateManipulationConfigV1(ctx.config);
  const normalizedBinding = validateRuntimeBindingV1(ctx.binding);
  assertPorts(ctx.ports);
  if (normalizedConfig.instanceId !== normalizedBinding.instanceId) {
    throwSpatialInvalidInput('binding.instanceId');
  }
  if (normalizedConfig.objectId !== normalizedBinding.objectId) {
    throwSpatialInvalidInput('binding.objectId');
  }

  const effectiveIdFactory = ctx.idFactory ?? createScopedIdFactory();
  const queue = createAsyncCommandQueueV1();
  const jobs = createSpatialJobTrackerV1();
  const events = createSpatialEventBusV1();
  const usedCommandIds = new Set();
  ctx.destroyed = false;
  // Runtime-private facts of the active gesture (latch, axis intent, rebase, prior request,
  // captured geometry tuples). Never copied into public DTOs; `state.activeGesture` holds the
  // data-model.md §8 record only.
  ctx.gestureRuntime = null;
  // Last accepted reference snapshot per channel (runtime-private). Re-evaluation after an
  // observation-policy toggle (ruling R3) uses it when its tuple still matches the accepted stamp.
  const acceptedSnapshots = { snap: null, collision: null };
  // Single-flight refresh jobs keyed by channel + expected dependency tuple (public-api.md §6).
  const inFlightRefresh = new Map();
  // Deferred `lifecyclechange(pose-port-failure)` while a gesture's terminal cancel is pending.
  ctx.pendingFailureNotice = false;
  ctx.state = {
    schemaVersion: 1,
    instanceId: normalizedConfig.instanceId,
    objectId: normalizedConfig.objectId,
    scopeId: normalizedConfig.scopeId,
    lifecycle: normalizedBinding.readiness === 'ready' ? 'ready' : 'pending',
    sequence: 0,
    commandSequence: 0,
    policyRevision: 0,
    config: normalizedConfig,
    binding: normalizedBinding,
    applied: null,
    activeGesture: null,
    lastMotion: null,
    snap: null,
    collision: null
  };
  ctx.state.snap = createDefaultSnapObservation(ctx.state);
  ctx.state.collision = createDefaultCollisionObservation(ctx.state);

  const assertLive = () => {
    if (ctx.destroyed) {
      throw createSpatialError(SPATIAL_MANIPULATION_ERROR_CODE.DESTROYED, 'Spatial manipulation instance destroyed');
    }
  };

  const stateDto = () => deepFreeze({
    schemaVersion: 1,
    instanceId: ctx.state.instanceId,
    objectId: ctx.state.objectId,
    scopeId: ctx.state.scopeId,
    lifecycle: ctx.state.lifecycle,
    sequence: ctx.state.sequence,
    commandSequence: ctx.state.commandSequence,
    policyRevision: ctx.state.policyRevision,
    config: copyPlainData(ctx.state.config),
    binding: copyPlainData(ctx.state.binding),
    applied: publicAppliedPose(ctx.state.applied),
    activeGesture: copyPlainData(ctx.state.activeGesture)
  });

  const spatialStateDto = () => deepFreeze({
    schemaVersion: 1,
    instanceId: ctx.state.instanceId,
    sequence: ctx.state.sequence,
    applied: publicAppliedPose(ctx.state.applied),
    lastMotion: copyPlainData(ctx.state.lastMotion),
    snap: copyPlainData(ctx.state.snap),
    collision: copyPlainData(ctx.state.collision)
  });

  const publishLifecycleChange = ({ reason, commandSequence, meta = {}, report }) => {
    const sequence = ctx.state.sequence + 1;
    ctx.state = { ...ctx.state, sequence };
    events.publish(createSpatialEvent({
      event: SPATIAL_MANIPULATION_EVENT.LIFECYCLE_CHANGE,
      instanceId: ctx.state.instanceId,
      sequence,
      commandSequence,
      commandId: meta.commandId,
      correlationId: meta.correlationId,
      reason,
      state: stateDto(),
      report
    }));
  };

  /**
   * public-api.md §7/§8: a pose-port failure moves the instance ready → pending exactly once.
   * Called by `applyPlan` (T7) and the gesture terminal path; when a gesture is active the
   * `lifecyclechange(pose-port-failure)` publication is deferred until after the gesture's one
   * terminal `gesturecancel` (flushed by `terminalGestureFailure`).
   */
  const markPoseFailurePending = currentState => {
    const transitions = currentState.binding.readiness === 'ready' || currentState.lifecycle !== 'pending';
    const next = markPoseFailurePendingState(currentState);
    if (!transitions) {
      return next;
    }
    if (currentState.activeGesture) {
      ctx.pendingFailureNotice = true;
      return next;
    }
    // Ruling F3 (2026-09-16): the programmatic path applies the transition without an event; the
    // frozen T7 contract pins `state.sequence` across a failed apply, and a non-advancing event
    // sequence would violate §5.1. Follow-up recorded by the coordinator.
    ctx.state = next;
    return ctx.state;
  };

  const flushPoseFailureNotice = ({ commandSequence, meta }) => {
    if (!ctx.pendingFailureNotice) {
      return;
    }
    ctx.pendingFailureNotice = false;
    publishLifecycleChange({ reason: 'pose-port-failure', commandSequence, meta });
  };
  Object.assign(ctx, { normalizedConfig, normalizedBinding, effectiveIdFactory, queue, jobs, events, usedCommandIds, acceptedSnapshots, inFlightRefresh, assertLive, stateDto, spatialStateDto, publishLifecycleChange, markPoseFailurePending, flushPoseFailureNotice });
  installMotionCommands(ctx);
  installSnapChannel(ctx);
  installGestureCommands(ctx);
  installGeometryLifecycle(ctx);

  const destroy = () => {
    if (ctx.destroyed) {
      return Promise.resolve(undefined);
    }
    const destroyMeta = ctx.acceptMeta(undefined);
    const commandSequence = queue.acceptedWatermark + 1;
    return queue.enqueue(commandSequence, () => {
      if (ctx.destroyed) {
        return undefined;
      }
      const canceledGesture = ctx.state.activeGesture?.gestureId ?? null;
      ctx.endCoordinatorGesture(canceledGesture);
      ctx.gestureRuntime = null;
      acceptedSnapshots.snap = null;
      acceptedSnapshots.collision = null;
      ctx.pendingFailureNotice = false;
      jobs.supersede();
      const sequence = ctx.state.sequence + 1;
      const previousApplied = ctx.state.applied;
      ctx.state = {
        ...ctx.state,
        lifecycle: 'destroyed',
        sequence,
        commandSequence,
        activeGesture: null
      };
      ctx.destroyed = true;
      if (canceledGesture) {
        // §5.3: destroy during a gesture publishes the terminal gesturecancel(destroy), no pose write.
        const cancelReport = ctx.gestureFeedback({
          sequence,
          commandSequence,
          meta: destroyMeta,
          gestureId: canceledGesture,
          reason: 'cancel',
          outcome: 'unchanged',
          previousApplied,
          applied: previousApplied
        });
        ctx.publishLifecycleEvent({
          event: SPATIAL_MANIPULATION_EVENT.GESTURE_CANCEL,
          sequence,
          commandSequence,
          meta: destroyMeta,
          gestureId: canceledGesture,
          reason: 'destroy',
          report: cancelReport
        });
        publishLifecycleChange({ reason: 'destroy', commandSequence, meta: destroyMeta });
      } else {
        ctx.publishLifecycleEvent({
          event: SPATIAL_MANIPULATION_EVENT.LIFECYCLE_CHANGE,
          sequence,
          commandSequence,
          meta: destroyMeta,
          reason: 'destroy'
        });
      }
      // NFR-05: release only instance-owned resources (coordinator record + leases, listeners,
      // the runtime's instance registration) after the terminal events.
      if (ctx.coordinator) {
        ctx.coordinator.unregisterInstance(ctx.state.instanceId);
      }
      events.clear();
      if (typeof ctx.onDestroyed === 'function') {
        ctx.onDestroyed(ctx.state.instanceId);
      }
      return undefined;
    });
  };

  const setOffsetM = (offsetM, options, meta) => {
    try {
      const target = assertUv(offsetM, 'offsetM');
      const normalizedOptions = assertOptions(options);
      return ctx.enqueueMotion({
        commandKind: 'set',
        reason: 'move',
        ...normalizedOptions,
        resolveRequestedOffset: () => target
      }, meta);
    } catch (error) {
      return Promise.reject(error);
    }
  };

  const moveByM = (deltaM, options, meta) => {
    try {
      const delta = assertUv(deltaM, 'deltaM');
      const normalizedOptions = assertOptions(options);
      return ctx.enqueueMotion({
        commandKind: 'move',
        reason: 'move',
        ...normalizedOptions,
        resolveRequestedOffset: previous => ({
          u: previous.offsetM.u + delta.u,
          v: previous.offsetM.v + delta.v
        })
      }, meta);
    } catch (error) {
      return Promise.reject(error);
    }
  };

  const reset = (request, meta) => {
    try {
      const normalized = assertResetRequest(request);
      return ctx.enqueueMotion({
        commandKind: 'reset',
        reason: 'reset',
        constraintMode: normalized.constraintMode,
        gridMode: normalized.gridMode,
        resolveRequestedOffset: () => normalized.offsetM
      }, meta);
    } catch (error) {
      return Promise.reject(error);
    }
  };

  // public-api.md §10 / ADR-0005: barrier over the accepted command watermark, the accepted job
  // watermark and every child job of a covered command, even when accepted after the barrier.
  const whenSettled = () => {
    if (ctx.destroyed) {
      return Promise.reject(createSpatialError(SPATIAL_MANIPULATION_ERROR_CODE.DESTROYED, 'Spatial manipulation instance destroyed'));
    }
    const commandWatermark = queue.acceptedWatermark;
    const jobWatermark = jobs.acceptedWatermark;
    return queue.whenSettled(commandWatermark)
      .then(() => jobs.whenSettled(jobWatermark, commandWatermark))
      .then(() => spatialStateDto());
  };
  Object.assign(ctx, { destroy, setOffsetM, moveByM, reset, whenSettled });

  return Object.freeze({
    instanceId: ctx.state.instanceId,
    objectId: ctx.state.objectId,
    getState: stateDto,
    getSpatialState: spatialStateDto,
    setOffsetM,
    moveByM,
    reset,
    beginGesture: ctx.beginGesture,
    updateGesture: ctx.updateGesture,
    endGesture: ctx.endGesture,
    cancelGesture: ctx.cancelGesture,
    rebind: ctx.rebind,
    configure: ctx.configure,
    invalidateGeometry: ctx.invalidateGeometry,
    refreshGeometry: ctx.refreshGeometry,
    destroy,
    whenSettled,
    // F8: subscribing after destroy is rejected like every other command (NFR-05: no new callbacks).
    on: (event, callback) => {
      assertLive();
      return events.on(event, callback);
    },
    off: events.off
  });
};

export const createManipulationRuntimeV1 = (options = {}) => {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throwSpatialInvalidInput('options');
  }
  const unknown = Object.keys(options).filter(key => key !== 'runtimeId' && key !== 'idFactory').sort();
  if (unknown.length > 0) {
    throwSpatialInvalidInput(unknown.map(key => `options.${key}`));
  }
  const defaultIdFactory = createScopedIdFactory();
  const runtimeId = options.runtimeId ?? defaultIdFactory('runtime');
  if (!isStringId(runtimeId)) {
    throwSpatialInvalidInput('options.runtimeId');
  }
  const idFactory = options.idFactory ?? defaultIdFactory;
  if (typeof idFactory !== 'function') {
    throwSpatialInvalidInput('options.idFactory');
  }

  const coordinator = createSpatialCoordinatorV1({ runtimeId });
  const instances = new Map();
  let destroyed = false;

  const assertLive = () => {
    if (destroyed) {
      throw createSpatialError(SPATIAL_MANIPULATION_ERROR_CODE.DESTROYED, 'Spatial manipulation runtime destroyed');
    }
  };

  const create = request => {
    assertLive();
    assertCreateRequest(request);
    if (instances.has(request.config?.instanceId)) {
      throwSpatialInvalidInput('config.instanceId');
    }
    coordinator.registerInstance(request.binding);
    try {
      const instance = createManipulationInstanceV1({
        config: request.config,
        binding: request.binding,
        ports: request.ports,
        idFactory,
        coordinator,
        onDestroyed: instanceId => {
          instances.delete(instanceId);
        }
      });
      instances.set(instance.instanceId, instance);
      return instance;
    } catch (error) {
      coordinator.unregisterInstance(request.binding.instanceId);
      throw error;
    }
  };

  const get = instanceId => {
    assertLive();
    if (!isStringId(instanceId)) {
      throwSpatialInvalidInput('instanceId');
    }
    return instances.get(instanceId) ?? null;
  };

  const getCoordinatorState = () => coordinator.snapshot();

  // public-api.md §3: `destroy(): Promise<void>`, idempotent, destroys only registered instances.
  const destroyRuntime = async () => {
    if (destroyed) {
      return undefined;
    }
    destroyed = true;
    await Promise.all([...instances.values()].map(instance => instance.destroy().catch(() => null)));
    instances.clear();
    coordinator.destroy();
    return undefined;
  };

  return Object.freeze({
    create,
    get,
    getCoordinatorState,
    destroy: destroyRuntime
  });
};
