import { tupleFromSnapSnapshot, expectedGeometryRequest, SNAP_TUPLE_FIELDS } from './instance-support.mjs';
import { SPATIAL_MANIPULATION_ERROR_CODE } from '../core/contracts/errors.mjs';
import { createDiagnostic, createObservationSet } from './reports.mjs';
import { finalizeSnapPairs } from './gesture.mjs';
import { resolveSnapV1 } from '../core/snapping/resolver.mjs';

// Snap channel: metric port, per-sample resolution during a gesture, snap observations.
// Split out of instance.mjs (spatial-manipulation V2, P2). Shared instance state and the other
// sections are reached through `ctx`; this section registers its functions on it.
const installSnapChannel = (ctx)=>{
    const createSnapMetric = (request)=>({
            metricId: `${ctx.state.instanceId}:screen-axis-basis`,
            unit: 'css-px',
            projectionRevision: request.projectionRevision,
            measure: ({ correctionM })=>{
                const dx = correctionM.u * request.screenAxisBasis.u.x + correctionM.v * request.screenAxisBasis.v.x;
                const dy = correctionM.u * request.screenAxisBasis.u.y + correctionM.v * request.screenAxisBasis.v.y;
                return Math.hypot(dx, dy);
            }
        });
    const snapStamp = (snapshot, applied, projectionRevision)=>({
            instanceId: ctx.state.instanceId,
            objectId: ctx.state.objectId,
            dependencyScopeId: ctx.state.binding.dependencyScopeId,
            bindingGeneration: ctx.state.binding.bindingGeneration,
            worldSpaceId: ctx.state.config.frame.worldSpaceId,
            frameId: ctx.state.config.frame.frameId,
            frameRevision: ctx.state.config.frame.frameRevision,
            ...projectionRevision === undefined ? {} : {
                projectionRevision
            },
            policyRevision: ctx.state.policyRevision,
            sourceGeometryRevision: snapshot?.sourceGeometryRevision ?? ctx.state.snap.stamp.sourceGeometryRevision,
            targetSceneRevision: snapshot?.targetSceneRevision ?? ctx.state.snap.stamp.targetSceneRevision,
            poseRevision: applied?.poseRevision ?? 0,
            queryRevision: snapshot?.queryRevision ?? ctx.state.snap.stamp.queryRevision
        });
    // public-api.md §2.4/§6: the resolver output is pre-apply; the runtime finalizes the pairs
    // against the actual applied pose and stamps metric identity, projection and pose revision.
    const observationFromSnapResolution = ({ snapshot, resolution, applied, projectionRevision, requestedOffsetM, metric, diagnostics = [] })=>createObservationSet({
            status: snapshot.readiness,
            coverage: snapshot.coverage,
            stamp: snapStamp(snapshot, applied, projectionRevision),
            queryId: snapshot.queryId,
            membershipRevision: snapshot.membershipRevision,
            results: finalizeSnapPairs({
                resolution,
                requestedOffsetM,
                applied,
                frame: ctx.state.config.frame,
                metric
            }),
            diagnostics: [
                ...snapshot.diagnostics ?? [],
                ...resolution.diagnostics ?? [],
                ...diagnostics
            ]
        });
    // Unknown snap observation for a sample whose snapshot could not be used; stamped with the
    // captured gesture tuple when one exists (never with a drifted snapshot).
    const pendingSnapObservation = (applied, projectionRevision, diagnostics, tuple = null)=>createObservationSet({
            status: ctx.state.config.snapping.enabled ? 'pending' : 'disabled',
            coverage: 'none',
            stamp: snapStamp(tuple, applied, projectionRevision),
            queryId: tuple?.queryId ?? ctx.state.snap.queryId,
            membershipRevision: tuple?.membershipRevision ?? ctx.state.snap.membershipRevision,
            diagnostics
        });
    const snapTuplesEqual = (left, right)=>SNAP_TUPLE_FIELDS.every((field)=>Object.is(left?.[field], right?.[field]));
    const latchReleasedDiagnostic = (latch)=>createDiagnostic('SPATIAL_SNAP_LATCH_RELEASED', 'Active snap latch cleared: snap geometry unavailable for this sample', {
            snapshotQueryRevision: latch.snapshotQueryRevision,
            activePairIds: latch.activePairIds.join(','),
            activeBundleId: latch.activeBundleId
        }, {
            snapshotQueryRevision: null,
            activePairIds: '',
            activeBundleId: null
        });
    /**
   * Gesture-sample snap resolution (§2.4, §5.3, §9). Returns `{ snapshot, resolution, observation,
   * finalize }`; `finalize(applied)` re-evaluates the pairs at an actual pose. A snapshot read
   * failure disables semantic correction for this sample only: the latch is cleared with
   * diagnostics and the update is not rejected.
   */ const resolveGestureSnap = async ({ request, sample, gesture, previous })=>{
        if (!ctx.state.config.snapping.enabled || sample.rebase) {
            return {
                snapshot: null,
                resolution: null,
                observation: ctx.state.snap,
                finalize: null
            };
        }
        let snapshot;
        try {
            snapshot = await ctx.readSnapSnapshot();
        } catch (error) {
            const cause = error?.cause ?? error;
            const diagnostics = [
                createDiagnostic(error?.code ?? SPATIAL_MANIPULATION_ERROR_CODE.STALE_GEOMETRY, 'Snap geometry unavailable: semantic correction disabled for this sample', expectedGeometryRequest(ctx.state, 'snap', ctx.state.snap.queryId).expected, {
                    code: cause?.code ?? 'SNAP_GEOMETRY_READ_FAILED',
                    message: cause?.message ?? error?.message ?? 'GeometryPort.readSnapSnapshot failed'
                }),
                ...gesture.snapLatch ? [
                    latchReleasedDiagnostic(gesture.snapLatch)
                ] : []
            ];
            gesture.snapLatch = null;
            const finalize = (applied)=>pendingSnapObservation(applied, request.projectionRevision, diagnostics, gesture.snapTuple);
            return {
                snapshot: null,
                resolution: null,
                observation: finalize(previous),
                finalize,
                diagnostics
            };
        }
        const returnedTuple = tupleFromSnapSnapshot(snapshot);
        if (!gesture.snapTuple) {
            // The begin-time read failed: the gesture's snap scope is fixed by the first accepted snapshot.
            gesture.snapTuple = returnedTuple;
        }
        if (!snapTuplesEqual(gesture.snapTuple, returnedTuple)) {
            // §7 step 5 / DM §7.1: the gesture scope is fixed at beginGesture. A provider returning a
            // different tuple mid-gesture is a protocol violation: resolved diagnostic, drifted snapshot
            // unused, semantic correction disabled for this sample, latch cleared.
            const diagnostics = [
                createDiagnostic(SPATIAL_MANIPULATION_ERROR_CODE.DEPENDENCY_CHANGED_AFTER_APPLY, 'Snap dependency tuple changed during gesture: drifted snapshot not applied', gesture.snapTuple, returnedTuple),
                ...gesture.snapLatch ? [
                    latchReleasedDiagnostic(gesture.snapLatch)
                ] : []
            ];
            gesture.snapLatch = null;
            const finalize = (applied)=>pendingSnapObservation(applied, request.projectionRevision, diagnostics, gesture.snapTuple);
            return {
                snapshot: null,
                resolution: null,
                observation: finalize(previous),
                finalize,
                diagnostics
            };
        }
        ctx.acceptedSnapshots.snap = {
            snapshot,
            tuple: returnedTuple
        };
        const metric = createSnapMetric(request);
        const resolution = resolveSnapV1({
            schemaVersion: 1,
            frame: ctx.state.config.frame,
            requestedOffsetM: sample.requestedOffsetM,
            currentAppliedOffsetM: previous.offsetM,
            allowedAxes: sample.allowedAxes,
            snapshot,
            activeLatch: gesture.snapLatch,
            thresholds: ctx.state.config.snapping.pointerProfiles[gesture.pointerType],
            motionPreview: {
                boundsM: ctx.state.config.motion.boundsM,
                grid: ctx.state.config.motion.grid,
                rawOffsetM: sample.requestedOffsetM
            },
            metric
        });
        const finalize = (applied)=>observationFromSnapResolution({
                snapshot,
                resolution,
                applied,
                projectionRevision: request.projectionRevision,
                requestedOffsetM: sample.requestedOffsetM,
                metric
            });
        return {
            snapshot,
            resolution,
            observation: finalize(previous),
            finalize
        };
    };
    const readSnapTupleAtBegin = async ()=>{
        if (!ctx.state.config.snapping.enabled) {
            return {
                tuple: null,
                diagnostics: []
            };
        }
        try {
            const snapshot = await ctx.readSnapSnapshot();
            const tuple = tupleFromSnapSnapshot(snapshot);
            ctx.acceptedSnapshots.snap = {
                snapshot,
                tuple
            };
            return {
                tuple,
                diagnostics: []
            };
        } catch (error) {
            const cause = error?.cause ?? error;
            return {
                tuple: null,
                diagnostics: [
                    createDiagnostic(error?.code ?? SPATIAL_MANIPULATION_ERROR_CODE.STALE_GEOMETRY, 'Snap geometry unavailable at gesture begin', expectedGeometryRequest(ctx.state, 'snap', ctx.state.snap.queryId).expected, {
                        code: cause?.code ?? 'SNAP_GEOMETRY_READ_FAILED',
                        message: cause?.message ?? error?.message ?? 'GeometryPort.readSnapSnapshot failed'
                    })
                ]
            };
        }
    };
    Object.assign(ctx, {
        createSnapMetric,
        snapStamp,
        observationFromSnapResolution,
        pendingSnapObservation,
        snapTuplesEqual,
        latchReleasedDiagnostic,
        resolveGestureSnap,
        readSnapTupleAtBegin
    });
};

export { installSnapChannel };
