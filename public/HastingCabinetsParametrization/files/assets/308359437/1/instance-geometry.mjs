// Geometry lifecycle: channel re-evaluation, rebind, configure, invalidate/refresh jobs.
// Split out of instance.mjs (spatial-manipulation V2, P2). Shared instance state and the other
// sections are reached through `ctx`; this section registers its functions on it.
import { SPATIAL_MANIPULATION_ERROR_CODE } from '../core/contracts/errors.mjs';
import { SPATIAL_MANIPULATION_EVENT } from '../core/contracts/constants.mjs';
import {
  STALE_DIAGNOSTIC_CODES,
  compareRevisionPair,
  expectedGeometryRequest,
  observationFromCollisionSnapshot,
  observationTransition,
  tupleFromCollisionSnapshot,
  tupleFromObservation,
  tupleFromSnapSnapshot,
  tuplesEqual
} from './instance-support.mjs';
import {
  copyPlainData,
  createDefaultCollisionObservation,
  createDefaultSnapObservation,
  createDiagnostic,
  createObservationSet,
  createSpatialError
} from './reports.mjs';
import { createCollisionObservationSetV1 } from '../core/collision/observation.mjs';
import { deepFreeze } from '../core/contracts/immutable.mjs';
import {
  normalizeConfigPatchV1,
  normalizeGeometryInvalidationV1,
  normalizeGeometryRefreshV1,
  normalizeRebindRequestV1
} from './lifecycle.mjs';

export const installGeometryLifecycle = ctx => {

  // ---- Observation helpers shared by refresh / invalidation / configure (T8.2) ----

  const channelEnabled = channel => (channel === 'snap' ? ctx.state.config.snapping.enabled : ctx.state.config.collision.enabled);

  const wrapChannel = (channel, observation) => (channel === 'collision' ? createCollisionObservationSetV1(observation) : observation);

  // Copy of an observation with a new readiness and no results; the accepted stamp is preserved so a
  // later re-enable can still recognise the retained snapshot (ruling R3).
  const observationWithStatus = (channel, observation, status, applied, diagnostics = []) => wrapChannel(channel, createObservationSet({
    status,
    coverage: 'none',
    stamp: {
      ...copyPlainData(observation.stamp),
      poseRevision: applied?.poseRevision ?? observation.stamp.poseRevision
    },
    queryId: observation.queryId,
    membershipRevision: observation.membershipRevision,
    diagnostics
  }));

  const retainedSnapshotFor = (channel, observation) => {
    const retained = ctx.acceptedSnapshots[channel];
    if (!retained) {
      return null;
    }
    const accepted = tupleFromObservation(observation);
    const matches = channel === 'collision'
      ? tuplesEqual(retained.tuple, accepted)
      : ctx.snapTuplesEqual(retained.tuple, accepted);
    return matches ? retained.snapshot : null;
  };

  const snapObservationFromSnapshot = (snapshot, applied) => createObservationSet({
    status: snapshot.readiness,
    coverage: snapshot.coverage,
    stamp: ctx.snapStamp(snapshot, applied, undefined),
    queryId: snapshot.queryId,
    membershipRevision: snapshot.membershipRevision,
    missing: snapshot.missing ?? [],
    diagnostics: snapshot.diagnostics ?? []
  });

  // Ruling R3: observation-policy toggles re-evaluate from the already accepted snapshot at the
  // current applied pose without any provider read; otherwise the channel becomes pending.
  const reevaluateChannel = (channel, next) => {
    const observation = next[channel];
    if (!(channel === 'snap' ? next.config.snapping.enabled : next.config.collision.enabled)) {
      // Diagnostics travel with the disabled copy so a later re-enable does not forget a stale result.
      return observationWithStatus(channel, observation, 'disabled', next.applied, observation.diagnostics);
    }
    // F5: only a ready result (or a disabled copy of one, i.e. without stale/drift diagnostics) may
    // be re-evaluated; a pending/unsupported observation keeps its status and diagnostics.
    const reevaluable = observation.status === 'ready'
      || (observation.status === 'disabled' && !observation.diagnostics.some(diagnostic => STALE_DIAGNOSTIC_CODES.has(diagnostic.code)));
    const snapshot = reevaluable ? retainedSnapshotFor(channel, observation) : null;
    if (!snapshot) {
      if (observation.status === 'pending' || observation.status === 'unsupported') {
        return observation;
      }
      return observationWithStatus(channel, observation, 'pending', next.applied, observation.diagnostics);
    }
    if (channel === 'collision') {
      try {
        return observationFromCollisionSnapshot(snapshot, next, next.applied);
      } catch (error) {
        return observationWithStatus(channel, observation, 'pending', next.applied, [createDiagnostic(
          SPATIAL_MANIPULATION_ERROR_CODE.DEPENDENCY_CHANGED_AFTER_APPLY,
          'Observation re-evaluation failed',
          tupleFromObservation(observation),
          { code: error?.code ?? 'OBSERVATION_EVALUATION_FAILED', message: error?.message ?? 'Observation evaluation failed' }
        )]);
      }
    }
    return snapObservationFromSnapshot(snapshot, next.applied);
  };

  const publishChannelTransition = ({ channel, previous, next, reason, commandSequence, meta }) => {
    if (!observationTransition(previous, next)) {
      return;
    }
    const sequence = ctx.state.sequence + 1;
    ctx.state = { ...ctx.state, sequence };
    ctx.publishLifecycleEvent({
      event: channel === 'snap' ? SPATIAL_MANIPULATION_EVENT.SNAP_CHANGE : SPATIAL_MANIPULATION_EVENT.COLLISION_CHANGE,
      sequence,
      commandSequence,
      meta,
      reason
    });
  };

  const rebindFeedback = ({ sequence, commandSequence, meta, gestureId, outcome, previousApplied, diagnostics = [] }) => ctx.gestureFeedback({
    sequence,
    commandSequence,
    meta,
    gestureId,
    reason: 'rebind',
    outcome,
    previousApplied,
    applied: null,
    diagnostics
  });

  /**
   * public-api.md §5.3 / AC-21 / ruling R6. Order at the FIFO head: generation re-check →
   * coordinator transaction (unregister old owner, register new binding; rollback re-registers
   * the old binding and re-acquires the old gesture ownership, publishing nothing) → one
   * `gesturecancel(rebind)` with the pre-commit state → old-owner cleanup → new-binding commit →
   * one PosePort.readPose when ready → `lifecyclechange(rebind)`. Distinct sequence per event.
   */
  const rebind = (bindingRequest, meta) => {
    try {
      const nextBinding = normalizeRebindRequestV1(bindingRequest, ctx.state);
      return ctx.enqueueLifecycle(meta, async (commandSequence, normalizedMeta) => {
        if (nextBinding.bindingGeneration <= ctx.state.binding.bindingGeneration) {
          throw createSpatialError(SPATIAL_MANIPULATION_ERROR_CODE.STALE_BINDING, 'Rebind requires a newer binding generation', {
            expected: { bindingGeneration: ctx.state.binding.bindingGeneration + 1 },
            actual: { bindingGeneration: nextBinding.bindingGeneration }
          });
        }
        const previousBinding = ctx.state.binding;
        const previousApplied = ctx.state.applied;
        const canceledGesture = ctx.state.activeGesture;
        if (ctx.coordinator) {
          ctx.coordinator.unregisterInstance(ctx.state.instanceId);
          try {
            ctx.coordinator.registerInstance(nextBinding);
          } catch (error) {
            ctx.coordinator.registerInstance(previousBinding);
            if (canceledGesture) {
              ctx.coordinator.beginGesture({
                instanceId: ctx.state.instanceId,
                gestureId: canceledGesture.gestureId,
                pointerType: canceledGesture.pointerType,
                pointerId: canceledGesture.pointerId
              });
            }
            throw error;
          }
        }
        if (canceledGesture) {
          const cancelSequence = ctx.state.sequence + 1;
          ctx.state = {
            ...ctx.state,
            lifecycle: 'ready',
            sequence: cancelSequence,
            commandSequence,
            activeGesture: null
          };
          ctx.publishLifecycleEvent({
            event: SPATIAL_MANIPULATION_EVENT.GESTURE_CANCEL,
            sequence: cancelSequence,
            commandSequence,
            meta: normalizedMeta,
            gestureId: canceledGesture.gestureId,
            reason: 'rebind',
            report: rebindFeedback({
              sequence: cancelSequence,
              commandSequence,
              meta: normalizedMeta,
              gestureId: canceledGesture.gestureId,
              outcome: 'superseded',
              previousApplied
            })
          });
        }
        // Old-owner cleanup: latch/results/jobs/retained snapshots belong to the old binding.
        ctx.gestureRuntime = null;
        ctx.acceptedSnapshots.snap = null;
        ctx.acceptedSnapshots.collision = null;
        ctx.pendingFailureNotice = false;
        ctx.jobs.supersede();
        const sequence = ctx.state.sequence + 1;
        const installed = {
          ...ctx.state,
          lifecycle: nextBinding.readiness === 'ready' ? 'ready' : 'pending',
          sequence,
          commandSequence,
          binding: nextBinding,
          applied: null,
          activeGesture: null
        };
        installed.snap = createDefaultSnapObservation(installed);
        installed.collision = createDefaultCollisionObservation(installed);
        ctx.state = installed;
        let diagnostics = [];
        if (nextBinding.readiness === 'ready') {
          try {
            const applied = await ctx.readCurrentPose();
            ctx.state = {
              ...ctx.state,
              applied,
              snap: createDefaultSnapObservation({ ...ctx.state, applied }),
              collision: createDefaultCollisionObservation({ ...ctx.state, applied })
            };
          } catch (error) {
            // R6: the binding stays installed; the instance is pending until a newer rebind.
            diagnostics = [createDiagnostic(
              SPATIAL_MANIPULATION_ERROR_CODE.POSE_APPLY_FAILED,
              'PosePort.readPose failed after rebind',
              { bindingGeneration: nextBinding.bindingGeneration, readiness: 'ready' },
              { code: error?.cause?.code ?? error?.code ?? 'POSE_READ_FAILED', message: error?.cause?.message ?? error?.message ?? 'readPose failed' }
            )];
            ctx.state = {
              ...ctx.state,
              lifecycle: 'pending',
              binding: deepFreeze({ ...nextBinding, readiness: 'pending' })
            };
          }
        }
        const changeSequence = ctx.state.sequence + 1;
        ctx.publishLifecycleChange({
          reason: 'rebind',
          commandSequence,
          meta: normalizedMeta,
          report: rebindFeedback({
            sequence: changeSequence,
            commandSequence,
            meta: normalizedMeta,
            outcome: 'unchanged',
            previousApplied,
            diagnostics
          })
        });
        return ctx.stateDto();
      });
    } catch (error) {
      return Promise.reject(error);
    }
  };

  const configure = (patch, meta) => {
    try {
      // Shape validation and a frozen copy at acceptance; the merge happens at the FIFO head.
      const normalizedPatch = normalizeConfigPatchV1(patch);
      return ctx.enqueueLifecycle(meta, (commandSequence, normalizedMeta) => {
        // Rulings R3/R4: merge per sub-key against the head-time config and validate atomically;
        // only frame/motion/profile patches bump policyRevision and are BUSY during a gesture.
        const merged = normalizeConfigPatchV1(normalizedPatch, ctx.state.config);
        if (ctx.state.activeGesture && merged.bumpsPolicy) {
          throw createSpatialError(SPATIAL_MANIPULATION_ERROR_CODE.BUSY, 'Cannot change frame/motion/profiles during active gesture', {
            expected: { activeGesture: null },
            actual: { gestureId: ctx.state.activeGesture.gestureId }
          });
        }
        const policyRevision = merged.bumpsPolicy ? ctx.state.policyRevision + 1 : ctx.state.policyRevision;
        const sequence = ctx.state.sequence + 1;
        const previousSnap = ctx.state.snap;
        const previousCollision = ctx.state.collision;
        const next = {
          ...ctx.state,
          sequence,
          commandSequence,
          policyRevision,
          config: merged.config
        };
        if (merged.bumpsPolicy) {
          // F7: a policy bump supersedes every in-flight job (they end SUPERSEDED, not STALE_GEOMETRY).
          ctx.jobs.supersede();
          next.snap = createDefaultSnapObservation(next);
          next.collision = createDefaultCollisionObservation(next);
          ctx.acceptedSnapshots.snap = null;
          ctx.acceptedSnapshots.collision = null;
        } else {
          // F1: a channel toggled off supersedes its in-flight refresh jobs.
          if (merged.patch.snapping?.enabled === false && ctx.state.config.snapping.enabled) {
            ctx.jobs.supersede('snap');
          }
          if (merged.patch.collision?.enabled === false && ctx.state.config.collision.enabled) {
            ctx.jobs.supersede('collision');
          }
          if (merged.patch.snapping !== undefined) {
            next.snap = reevaluateChannel('snap', next);
            if (ctx.gestureRuntime && !next.config.snapping.enabled) {
              ctx.gestureRuntime.snapLatch = null;
              ctx.gestureRuntime.lastSnap = null;
            }
          }
          if (merged.patch.collision !== undefined) {
            next.collision = reevaluateChannel('collision', next);
          }
        }
        ctx.state = next;
        ctx.publishLifecycleEvent({
          event: SPATIAL_MANIPULATION_EVENT.LIFECYCLE_CHANGE,
          sequence,
          commandSequence,
          meta: normalizedMeta,
          reason: 'config'
        });
        publishChannelTransition({ channel: 'snap', previous: previousSnap, next: ctx.state.snap, reason: 'config', commandSequence, meta: normalizedMeta });
        publishChannelTransition({ channel: 'collision', previous: previousCollision, next: ctx.state.collision, reason: 'config', commandSequence, meta: normalizedMeta });
        return ctx.stateDto();
      });
    } catch (error) {
      return Promise.reject(error);
    }
  };

  // public-api.md §6: pending observation carrying the invalidation revisions; the last known
  // result is retained only as an explicitly stale diagnostic.
  const invalidatedObservation = (channel, previous, request, next) => {
    const diagnostics = previous.status === 'ready'
      ? [createDiagnostic(
        SPATIAL_MANIPULATION_ERROR_CODE.STALE_GEOMETRY,
        `Geometry invalidated (${request.reason}): last known result is stale`,
        { sourceGeometryRevision: request.sourceGeometryRevision, targetSceneRevision: request.targetSceneRevision },
        { sourceGeometryRevision: previous.stamp.sourceGeometryRevision, targetSceneRevision: previous.stamp.targetSceneRevision }
      )]
      : [];
    const stamp = copyPlainData(previous.stamp);
    delete stamp.projectionRevision;
    return wrapChannel(channel, createObservationSet({
      status: (channel === 'snap' ? next.config.snapping.enabled : next.config.collision.enabled) ? 'pending' : 'disabled',
      coverage: 'none',
      stamp: {
        ...stamp,
        bindingGeneration: request.bindingGeneration,
        sourceGeometryRevision: request.sourceGeometryRevision,
        targetSceneRevision: request.targetSceneRevision,
        poseRevision: next.applied?.poseRevision ?? 0
      },
      queryId: previous.queryId,
      membershipRevision: previous.membershipRevision,
      diagnostics
    }));
  };

  const invalidateGeometry = (request, meta) => {
    try {
      const normalized = normalizeGeometryInvalidationV1(request);
      return ctx.enqueueLifecycle(meta, (commandSequence, normalizedMeta) => {
        if (ctx.state.activeGesture && ctx.state.activeGesture.dependencyScopeId === normalized.dependencyScopeId) {
          throw createSpatialError(SPATIAL_MANIPULATION_ERROR_CODE.BUSY, 'Cannot invalidate captured geometry during active gesture', {
            expected: { activeGesture: null },
            actual: { gestureId: ctx.state.activeGesture.gestureId, dependencyScopeId: normalized.dependencyScopeId }
          });
        }
        if (
          normalized.dependencyScopeId !== ctx.state.binding.dependencyScopeId
          || normalized.bindingGeneration !== ctx.state.binding.bindingGeneration
        ) {
          throw createSpatialError(SPATIAL_MANIPULATION_ERROR_CODE.STALE_GEOMETRY, 'Invalid geometry invalidation scope', {
            expected: { dependencyScopeId: ctx.state.binding.dependencyScopeId, bindingGeneration: ctx.state.binding.bindingGeneration },
            actual: { dependencyScopeId: normalized.dependencyScopeId, bindingGeneration: normalized.bindingGeneration }
          });
        }
        const verdicts = normalized.channels.map(channel => ({
          channel,
          verdict: compareRevisionPair(normalized, ctx.state[channel].stamp)
        }));
        const lower = verdicts.find(entry => entry.verdict === 'lower');
        if (lower) {
          const accepted = ctx.state[lower.channel].stamp;
          throw createSpatialError(SPATIAL_MANIPULATION_ERROR_CODE.STALE_GEOMETRY, 'Invalidation revisions cannot decrease accepted revisions', {
            expected: { channel: lower.channel, sourceGeometryRevision: accepted.sourceGeometryRevision, targetSceneRevision: accepted.targetSceneRevision },
            actual: { channel: lower.channel, sourceGeometryRevision: normalized.sourceGeometryRevision, targetSceneRevision: normalized.targetSceneRevision }
          });
        }
        const superseding = verdicts.filter(entry => entry.verdict === 'higher').map(entry => entry.channel);
        if (superseding.length === 0) {
          // Identical tuple: idempotent, no event, no supersede.
          return ctx.spatialStateDto();
        }
        const sequence = ctx.state.sequence + 1;
        const next = { ...ctx.state, sequence, commandSequence };
        const previous = { snap: ctx.state.snap, collision: ctx.state.collision };
        for (const channel of superseding) {
          ctx.jobs.supersede(channel);
          next[channel] = invalidatedObservation(channel, ctx.state[channel], normalized, next);
        }
        ctx.state = next;
        ctx.publishLifecycleEvent({
          event: SPATIAL_MANIPULATION_EVENT.SPATIAL_CHANGE,
          sequence,
          commandSequence,
          meta: normalizedMeta,
          reason: 'invalidate'
        });
        for (const channel of superseding) {
          publishChannelTransition({ channel, previous: previous[channel], next: ctx.state[channel], reason: 'invalidate', commandSequence, meta: normalizedMeta });
        }
        return ctx.spatialStateDto();
      });
    } catch (error) {
      return Promise.reject(error);
    }
  };

  const supersededError = (channel, token) => createSpatialError(SPATIAL_MANIPULATION_ERROR_CODE.SUPERSEDED, 'Geometry refresh superseded', {
    expected: { channel, generation: token.generation },
    actual: { channel, generation: token.currentGeneration() }
  });

  /**
   * One geometry job per channel (public-api.md §6): accepted immediately before the provider
   * invocation with the refresh command as parent, single-flight per channel/dependency tuple,
   * inert when superseded, evaluated at the current applied pose without any PosePort.apply.
   */
  const acceptRefreshJob = (channel, commandSequence, meta) => {
    const expected = expectedGeometryRequest(ctx.state, channel, ctx.state[channel].queryId).expected;
    const key = `${channel}:${JSON.stringify(expected)}`;
    const existing = ctx.inFlightRefresh.get(key);
    if (existing && (existing.token === null || existing.token.isCurrent())) {
      return existing.promise;
    }
    const entry = { token: null, promise: null };
    entry.promise = ctx.jobs.accept(async token => {
      entry.token = token;
      let snapshot;
      try {
        snapshot = channel === 'collision' ? await ctx.readCollisionSnapshot() : await ctx.readSnapSnapshot();
      } catch (error) {
        throw token.isCurrent() ? error : supersededError(channel, token);
      }
      if (!token.isCurrent()) {
        throw supersededError(channel, token);
      }
      if (ctx.destroyed) {
        throw createSpatialError(SPATIAL_MANIPULATION_ERROR_CODE.DESTROYED, 'Spatial manipulation instance destroyed');
      }
      if (!snapshot) {
        return;
      }
      const returnedTuple = channel === 'collision' ? tupleFromCollisionSnapshot(snapshot) : tupleFromSnapSnapshot(snapshot);
      // Ruling R7 (2026-09-16): the static tuple matched exactly on read; dynamic revisions equal or
      // higher than the accepted/pending tuple are accepted, lower ones are stale.
      if (
        returnedTuple.sourceGeometryRevision < expected.sourceGeometryRevision
        || returnedTuple.targetSceneRevision < expected.targetSceneRevision
      ) {
        throw createSpatialError(SPATIAL_MANIPULATION_ERROR_CODE.STALE_GEOMETRY, 'Provider returned an older geometry tuple than accepted', {
          expected,
          actual: returnedTuple
        });
      }
      if (!ctx.state.applied) {
        let read;
        try {
          read = await ctx.readCurrentPose();
        } catch (error) {
          if (!token.isCurrent()) {
            throw supersededError(channel, token);
          }
          // F4 / mini round 2 ruling: an out-of-FIFO job marks the binding pending (§8) only when
          // nothing else is in flight and no gesture is active; otherwise the in-flight command's
          // own port interaction decides the binding state and the job just rejects.
          const quiet = !ctx.state.activeGesture && ctx.queue.settledWatermark === ctx.queue.acceptedWatermark;
          if (!ctx.destroyed && quiet) {
            ctx.state = ctx.markPoseFailurePending(ctx.state);
          }
          const cause = error?.cause ?? error;
          throw createSpatialError(SPATIAL_MANIPULATION_ERROR_CODE.POSE_APPLY_FAILED, 'PosePort.readPose failed during geometry refresh', {
            expected: { readiness: 'ready', bindingGeneration: ctx.state.binding.bindingGeneration },
            actual: { code: cause?.code ?? 'POSE_READ_FAILED', message: cause?.message ?? error?.message ?? 'readPose failed' },
            cause: error
          });
        }
        if (!token.isCurrent()) {
          throw supersededError(channel, token);
        }
        if (ctx.destroyed) {
          throw createSpatialError(SPATIAL_MANIPULATION_ERROR_CODE.DESTROYED, 'Spatial manipulation instance destroyed');
        }
        if (!ctx.state.applied) {
          ctx.state = { ...ctx.state, applied: read };
        }
      }
      if (!channelEnabled(channel)) {
        // F1: the channel was disabled while the provider was reading; the result is superseded.
        throw supersededError(channel, token);
      }
      const applied = ctx.state.applied;
      const previous = ctx.state[channel];
      const observation = channel === 'collision'
        ? observationFromCollisionSnapshot(snapshot, ctx.state, applied)
        : snapObservationFromSnapshot(snapshot, applied);
      ctx.acceptedSnapshots[channel] = { snapshot, tuple: returnedTuple };
      const sequence = ctx.state.sequence + 1;
      ctx.state = { ...ctx.state, sequence, [channel]: observation };
      // F10: the command resolves with the state of this commit, sampled before listeners run.
      const committed = ctx.spatialStateDto();
      ctx.publishLifecycleEvent({
        event: SPATIAL_MANIPULATION_EVENT.SPATIAL_CHANGE,
        sequence,
        commandSequence,
        meta,
        reason: 'refresh'
      });
      publishChannelTransition({ channel, previous, next: observation, reason: 'refresh', commandSequence, meta });
      return committed;
    }, { parentCommandSequence: commandSequence, channel });
    ctx.inFlightRefresh.set(key, entry);
    entry.promise.finally(() => {
      if (ctx.inFlightRefresh.get(key) === entry) {
        ctx.inFlightRefresh.delete(key);
      }
    }).catch(() => {});
    return entry.promise;
  };

  const refreshGeometry = (request = undefined, meta = undefined) => {
    try {
      const normalized = normalizeGeometryRefreshV1(request);
      return ctx.enqueueLifecycle(meta, (commandSequence, normalizedMeta) => {
        if (normalized.dependencyScopeId && normalized.dependencyScopeId !== ctx.state.binding.dependencyScopeId) {
          throw createSpatialError(SPATIAL_MANIPULATION_ERROR_CODE.STALE_GEOMETRY, 'Invalid geometry refresh scope', {
            expected: { dependencyScopeId: ctx.state.binding.dependencyScopeId },
            actual: { dependencyScopeId: normalized.dependencyScopeId }
          });
        }
        if (ctx.state.activeGesture) {
          throw createSpatialError(SPATIAL_MANIPULATION_ERROR_CODE.BUSY, 'Cannot refresh captured geometry during active gesture', {
            expected: { activeGesture: null },
            actual: { gestureId: ctx.state.activeGesture.gestureId }
          });
        }
        if (ctx.state.binding.readiness !== 'ready') {
          // F4 / §8: after a pose-port failure the last applied pose is untrustworthy until a newer rebind.
          throw createSpatialError(SPATIAL_MANIPULATION_ERROR_CODE.NOT_READY, 'Binding is not ready', {
            expected: { readiness: 'ready' },
            actual: { readiness: ctx.state.binding.readiness, bindingGeneration: ctx.state.binding.bindingGeneration }
          });
        }
        const jobPromises = normalized.channels
          .filter(channel => channelEnabled(channel))
          .map(channel => acceptRefreshJob(channel, commandSequence, normalizedMeta));
        // F10: resolve with the latest commit made by this command's jobs (a skipped channel yields none).
        const result = jobPromises.length === 0
          ? Promise.resolve(ctx.spatialStateDto())
          : Promise.all(jobPromises).then(states => states
            .filter(committed => committed !== undefined)
            .reduce((latest, committed) => (latest === null || committed.sequence > latest.sequence ? committed : latest), null)
            ?? ctx.spatialStateDto());
        // The caller's chain below observes the outcome; keep the job rejection from being unhandled.
        result.catch(() => {});
        return { result };
      }).then(outcome => outcome.result);
    } catch (error) {
      return Promise.reject(error);
    }
  };

  Object.assign(ctx, {
    channelEnabled,
    wrapChannel,
    observationWithStatus,
    retainedSnapshotFor,
    snapObservationFromSnapshot,
    reevaluateChannel,
    publishChannelTransition,
    rebindFeedback,
    rebind,
    configure,
    invalidatedObservation,
    invalidateGeometry,
    supersededError,
    acceptRefreshJob,
    refreshGeometry
  });
};
