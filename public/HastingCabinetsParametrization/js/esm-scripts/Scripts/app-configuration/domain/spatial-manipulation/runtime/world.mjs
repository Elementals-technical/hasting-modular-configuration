import { SPATIAL_MANIPULATION_SCHEMA_VERSION, SPATIAL_MANIPULATION_EVENT } from '../core/contracts/constants.mjs';
import { SPATIAL_MANIPULATION_ERROR_CODE } from '../core/contracts/errors.mjs';
import { validateManipulationConfigV1, validateRuntimeBindingV1 } from '../core/contracts/validators.mjs';
import { createManipulationRuntimeV1 } from './instance.mjs';
import { createDriverPosePort } from './pose-driver.mjs';
import { computeSnapGuides } from './guides.mjs';
import { defineManipulable } from '../spec/define.mjs';
import { compileCollisionGeometry, compileSnapGeometry } from '../spec/compile.mjs';

const QUIET_CODES = new Set([
    SPATIAL_MANIPULATION_ERROR_CODE.SUPERSEDED,
    SPATIAL_MANIPULATION_ERROR_CODE.DESTROYED,
    SPATIAL_MANIPULATION_ERROR_CODE.BUSY
]);
const HANDLE_EVENTS = new Set([
    'change',
    'collision',
    'snap',
    'gesturestart',
    'gestureend',
    'gesturecancel',
    'error'
]);
const cloneUv = (value)=>({
        u: value.u,
        v: value.v
    });
const fallbackBinding = (instanceId)=>{
    const transformId = `${instanceId}/xf`;
    const pickId = `${instanceId}/pick`;
    return {
        pickTargetIds: [
            pickId
        ],
        transformTargetIds: [
            transformId
        ],
        affectedTransformIds: [
            transformId,
            pickId
        ],
        spatialDependencyTransformIds: [],
        presentationTargetIds: [
            transformId
        ],
        hierarchy: {
            schemaVersion: SPATIAL_MANIPULATION_SCHEMA_VERSION,
            hierarchyRevision: 0,
            nodes: [
                {
                    transformId: `${instanceId}/root`,
                    parentTransformId: null
                },
                {
                    transformId,
                    parentTransformId: `${instanceId}/root`
                },
                {
                    transformId: pickId,
                    parentTransformId: transformId
                }
            ]
        }
    };
};
const createEmitter = ()=>{
    const listeners = new Map();
    return {
        on (name, callback) {
            if (!HANDLE_EVENTS.has(name)) throw new TypeError(`Unknown manipulable event "${name}"`);
            if (!listeners.has(name)) listeners.set(name, new Set());
            listeners.get(name).add(callback);
            return ()=>listeners.get(name)?.delete(callback);
        },
        off (name, callback) {
            listeners.get(name)?.delete(callback);
        },
        emit (name, payload) {
            for (const callback of [
                ...listeners.get(name) ?? []
            ]){
                try {
                    callback(payload);
                } catch (error) {
                    if (name !== 'error') this.emit('error', {
                        stage: `listener:${name}`,
                        error
                    });
                }
            }
        },
        clear () {
            listeners.clear();
        }
    };
};
function createSpatialWorld({ scene, measure, engine = {}, worldSpaceId = 'world', onError = null } = {}) {
    if (!scene || typeof scene.bodies !== 'function') throw new TypeError('createSpatialWorld requires scene.bodies()');
    if (!measure || typeof measure.bounds !== 'function') throw new TypeError('createSpatialWorld requires measure.bounds()');
    const runtime = createManipulationRuntimeV1();
    const handles = new Map();
    let sceneRevision = 1;
    let destroyed = false;
    const reportError = (stage, error, handle = null)=>{
        if (QUIET_CODES.has(error?.code)) return;
        if (handle) handle._emit('error', {
            stage,
            error
        });
        if (onError) onError(stage, error);
        else if (!handle) console.error(`[spatial-world] ${stage}`, error);
    };
    const readScene = ()=>{
        const bodies = scene.bodies() ?? [];
        return {
            scopeId: scene.scopeId?.() ?? 'scene',
            bodies
        };
    };
    // Measurement cache per scene revision: pointer samples never re-measure the scene.
    let cacheRevision = 0;
    const boundsCache = new Map();
    const proxyCache = new Map();
    const cachedMeasure = {
        bounds (body) {
            if (cacheRevision !== sceneRevision) {
                boundsCache.clear();
                proxyCache.clear();
                cacheRevision = sceneRevision;
            }
            if (!boundsCache.has(body.id)) boundsCache.set(body.id, measure.bounds(body));
            return boundsCache.get(body.id);
        },
        proxies (body, profile) {
            if (cacheRevision !== sceneRevision) {
                boundsCache.clear();
                proxyCache.clear();
                cacheRevision = sceneRevision;
            }
            const key = `${body.id}|${profile?.id ?? 'profile'}`;
            if (!proxyCache.has(key)) proxyCache.set(key, measure.proxies(body, profile));
            return proxyCache.get(key);
        }
    };
    // The moving body is measured live (its pose changes without a scene revision).
    const liveMeasure = (selfId)=>({
            bounds: (body)=>body.id === selfId ? measure.bounds(body) : cachedMeasure.bounds(body),
            proxies: (body, profile)=>body.id === selfId ? measure.proxies(body, profile) : cachedMeasure.proxies(body, profile)
        });
    const register = async (specInput, { body: bodyId, host = {}, id = null, canDrag = null } = {})=>{
        if (destroyed) throw new Error('spatial world destroyed');
        const spec = defineManipulable(specInput);
        const instanceId = id ?? `${spec.id}:${bodyId}`;
        if (handles.has(instanceId)) throw new Error(`manipulable "${instanceId}" is already registered`);
        const emitter = createEmitter();
        const findSelf = (bodies)=>bodies.find((body)=>body.id === bodyId) ?? null;
        const initialScene = readScene();
        const self = findSelf(initialScene.bodies);
        if (!self) throw new Error(`body "${bodyId}" is not in the scene`);
        const baseCtx = ()=>{
            const current = readScene();
            return {
                host,
                objectId: bodyId,
                instanceId,
                self: findSelf(current.bodies) ?? self,
                scene: current,
                world: api
            };
        };
        const ctx0 = baseCtx();
        const frame = {
            schemaVersion: SPATIAL_MANIPULATION_SCHEMA_VERSION,
            frameId: `${instanceId}:frame`,
            worldSpaceId,
            frameRevision: 0,
            ...spec.frame(ctx0)
        };
        const motion = {
            axes: [
                ...spec.motion.axes
            ],
            boundsM: structuredClone(spec.motion.boundsM),
            gridM: {
                ...spec.motion.gridM
            }
        };
        const allowedAxes = ()=>motion.axes.filter((axis)=>{
                const range = motion.boundsM[axis];
                return !range || range.min !== range.max;
            });
        const motionConfig = ()=>({
                allowedAxes: allowedAxes(),
                boundsM: structuredClone(motion.boundsM),
                grid: {
                    originM: cloneUv(spec.motion.gridOriginM),
                    stepM: {
                        ...motion.gridM
                    },
                    dragHysteresisRatio: spec.motion.dragHysteresisRatio
                }
            });
        let snapEnabled = Boolean(spec.snapping?.enabled);
        let collisionEnabled = Boolean(spec.collision?.enabled);
        const config = validateManipulationConfigV1({
            schemaVersion: SPATIAL_MANIPULATION_SCHEMA_VERSION,
            instanceId,
            objectId: bodyId,
            scopeId: ctx0.scene.scopeId,
            frame,
            motion: motionConfig(),
            snapping: {
                enabled: snapEnabled,
                profile: {
                    id: spec.id,
                    version: 1
                },
                pointerProfiles: structuredClone(spec.snapping?.thresholds ?? {
                    mouse: {
                        engagePx: 8,
                        releasePx: 14,
                        switchMarginPx: 2,
                        tieEpsilonPx: 0.5
                    },
                    touch: {
                        engagePx: 12,
                        releasePx: 22,
                        switchMarginPx: 2,
                        tieEpsilonPx: 0.5
                    }
                })
            },
            collision: {
                enabled: collisionEnabled,
                mode: 'observe',
                epsilonM: spec.collision?.epsilonM ?? 1e-6,
                profile: {
                    id: `${spec.id}:collision`,
                    version: 1
                }
            }
        });
        const resolveEntities = (ctx)=>spec.target.entities?.(ctx) ?? engine.resolveEntities?.(ctx) ?? (ctx.self?.entity ? [
                ctx.self.entity
            ] : []);
        const entities = resolveEntities(ctx0);
        spec.target.pick?.(ctx0) ?? entities;
        let bindingGeneration = 1;
        const describe = (ctx)=>engine.describeBinding?.({
                ctx,
                instanceId,
                entities: resolveEntities(ctx),
                pickEntities: spec.target.pick?.(ctx) ?? resolveEntities(ctx)
            }) ?? fallbackBinding(instanceId);
        const binding = validateRuntimeBindingV1({
            schemaVersion: SPATIAL_MANIPULATION_SCHEMA_VERSION,
            instanceId,
            objectId: bodyId,
            bindingGeneration,
            readiness: 'ready',
            dependencyScopeId: ctx0.scene.scopeId,
            transformGroupId: bodyId,
            ...describe(ctx0)
        });
        const driver = spec.target.pose?.(ctx0) ?? engine.createPoseDriver?.({
            ctx: ctx0,
            frame,
            entities,
            resolveEntities: ()=>resolveEntities(baseCtx())
        });
        if (!driver) throw new Error(`manipulable "${instanceId}" has no pose driver (spec.target.pose or engine.createPoseDriver)`);
        const posePort = createDriverPosePort({
            instanceId,
            getBindingGeneration: ()=>bindingGeneration,
            driver
        });
        // Dynamic revisions of this manipulable's geometry (static fields echo the request).
        const stamps = {
            sourceGeometryRevision: 1,
            targetSceneRevision: 1,
            membershipRevision: 1,
            queryRevision: 1
        };
        let snapGeometry = null;
        let snapKey = null;
        let collisionGeometry = null;
        let collisionKey = null;
        let lastGuideGeometry = null;
        const stampFrom = (expected, channel)=>({
                schemaVersion: SPATIAL_MANIPULATION_SCHEMA_VERSION,
                instanceId,
                objectId: bodyId,
                dependencyScopeId: expected.dependencyScopeId,
                bindingGeneration: expected.bindingGeneration,
                ...channel === 'collision' ? {
                    worldSpaceId: expected.worldSpaceId
                } : {},
                frameId: expected.frameId,
                frameRevision: expected.frameRevision,
                policyRevision: expected.policyRevision,
                sourceGeometryRevision: stamps.sourceGeometryRevision,
                targetSceneRevision: stamps.targetSceneRevision,
                membershipRevision: stamps.membershipRevision,
                queryId: `${instanceId}:${channel}`,
                queryRevision: stamps.queryRevision
            });
        const currentOffset = ()=>{
            try {
                return driver.read();
            } catch  {
                return {
                    u: 0,
                    v: 0
                };
            }
        };
        const geometryPort = {
            async readSnapSnapshot (request) {
                const key = JSON.stringify([
                    stamps,
                    request.expected.policyRevision,
                    allowedAxes(),
                    snapEnabled
                ]);
                if (key !== snapKey || !snapGeometry) {
                    snapGeometry = compileSnapGeometry({
                        spec,
                        frame,
                        scene: readScene(),
                        ctx: baseCtx(),
                        measure: liveMeasure(bodyId),
                        offsetM: currentOffset(),
                        allowedAxes: allowedAxes()
                    });
                    snapKey = key;
                }
                lastGuideGeometry = snapGeometry;
                const { readiness, coverage, missing, diagnostics, referenceOffsetM, movingBoundsM, sourceFeatures, targetFeatures, pairRules } = snapGeometry;
                return {
                    ...stampFrom(request.expected, 'snap'),
                    readiness: readiness === 'disabled' ? 'disabled' : readiness,
                    coverage,
                    referenceOffsetM,
                    movingBoundsM,
                    sourceFeatures,
                    targetFeatures,
                    pairRules,
                    missing,
                    diagnostics
                };
            },
            async readCollisionSnapshot (request) {
                const key = JSON.stringify([
                    stamps,
                    request.expected.policyRevision,
                    collisionEnabled
                ]);
                if (key !== collisionKey || !collisionGeometry) {
                    collisionGeometry = compileCollisionGeometry({
                        spec,
                        frame,
                        scene: readScene(),
                        ctx: baseCtx(),
                        measure: liveMeasure(bodyId),
                        offsetM: currentOffset()
                    });
                    collisionKey = key;
                }
                const { readiness, coverage, missing, diagnostics, referenceSourcePivotM, sourceVolumes, targetVolumes } = collisionGeometry;
                return {
                    ...stampFrom(request.expected, 'collision'),
                    readiness,
                    coverage,
                    referenceSourcePivotM,
                    sourceVolumes,
                    targetVolumes,
                    missing,
                    diagnostics
                };
            }
        };
        const instance = runtime.create({
            config,
            binding,
            ports: {
                pose: posePort,
                geometry: geometryPort
            }
        });
        // Work that must not happen mid-gesture (scene/membership changes) is deferred to its end.
        let deferred = null;
        const gestureActive = ()=>Boolean(instance.getState().activeGesture);
        const quiet = (promise, stage)=>promise.catch((error)=>{
                reportError(stage, error, handle);
                return null;
            });
        const applyInvalidation = (reason)=>{
            stamps.sourceGeometryRevision += 1;
            stamps.targetSceneRevision += 1;
            snapGeometry = null;
            collisionGeometry = null;
            try {
                driver.rebase?.();
            } catch (error) {
                reportError('rebase', error, handle);
            }
            const channels = [];
            if (snapEnabled) channels.push('snap');
            if (collisionEnabled) channels.push('collision');
            if (!channels.length) return Promise.resolve(null);
            quiet(instance.invalidateGeometry({
                dependencyScopeId: instance.getState().binding.dependencyScopeId,
                channels,
                bindingGeneration,
                sourceGeometryRevision: stamps.sourceGeometryRevision,
                targetSceneRevision: stamps.targetSceneRevision,
                reason
            }), 'invalidate');
            return quiet(instance.refreshGeometry(), 'refresh');
        };
        const applyMembership = ()=>{
            stamps.membershipRevision += 1;
            stamps.queryRevision += 1;
            snapGeometry = null;
            collisionGeometry = null;
            return quiet(instance.refreshGeometry(), 'refresh');
        };
        const runOrDefer = (kind, work)=>{
            if (!gestureActive()) return work();
            deferred = {
                ...deferred ?? {},
                [kind]: work
            };
            return Promise.resolve(null);
        };
        const flushDeferred = ()=>{
            if (!deferred || gestureActive()) return;
            const pending = deferred;
            deferred = null;
            if (pending.invalidate) pending.invalidate();
            else {
                pending.rebase?.();
                pending.membership?.();
            }
        };
        // Core events -> handle events + guides.
        let lastCollision = instance.getSpatialState().collision?.verdict?.status ?? 'unknown';
        const publishChange = (source)=>{
            const spatial = instance.getSpatialState();
            const payload = {
                source,
                offsetM: spatial.applied?.offsetM ? cloneUv(spatial.applied.offsetM) : null,
                snap: spatial.snap,
                collision: spatial.collision,
                state: spatial
            };
            emitter.emit('change', payload);
            const status = spatial.collision?.verdict?.status ?? 'unknown';
            if (status !== lastCollision) {
                lastCollision = status;
                emitter.emit('collision', {
                    status,
                    collision: spatial.collision
                });
            }
        };
        const unsubscribes = [
            instance.on(SPATIAL_MANIPULATION_EVENT.MOTION_APPLIED, (event)=>{
                if (event.gestureId && engine.renderGuides) {
                    try {
                        engine.renderGuides(handle, computeSnapGuides({
                            report: event.report,
                            geometry: lastGuideGeometry,
                            frame
                        }));
                    } catch (error) {
                        reportError('guides', error, handle);
                    }
                }
                publishChange(event.report?.source ?? 'motion');
            }),
            instance.on(SPATIAL_MANIPULATION_EVENT.SPATIAL_CHANGE, ()=>publishChange('geometry')),
            instance.on(SPATIAL_MANIPULATION_EVENT.COLLISION_CHANGE, ()=>publishChange('collision')),
            instance.on(SPATIAL_MANIPULATION_EVENT.SNAP_CHANGE, (event)=>emitter.emit('snap', event)),
            instance.on(SPATIAL_MANIPULATION_EVENT.GESTURE_START, (event)=>emitter.emit('gesturestart', event)),
            instance.on(SPATIAL_MANIPULATION_EVENT.GESTURE_END, (event)=>{
                engine.renderGuides?.(handle, []);
                emitter.emit('gestureend', event);
                flushDeferred();
            }),
            instance.on(SPATIAL_MANIPULATION_EVENT.GESTURE_CANCEL, (event)=>{
                engine.renderGuides?.(handle, []);
                emitter.emit('gesturecancel', event);
                flushDeferred();
            })
        ];
        let detach = null;
        let handleDestroyed = false;
        const configure = (patch)=>quiet(instance.configure(patch).then(()=>instance.refreshGeometry()), 'configure');
        const handle = {
            id: instanceId,
            body: bodyId,
            spec,
            frame,
            instance,
            host,
            canDrag,
            _emit: (name, payload)=>emitter.emit(name, payload),
            getState () {
                const spatial = instance.getSpatialState();
                return {
                    offsetM: spatial.applied?.offsetM ? cloneUv(spatial.applied.offsetM) : null,
                    motion: {
                        axes: [
                            ...motion.axes
                        ],
                        allowedAxes: allowedAxes(),
                        boundsM: structuredClone(motion.boundsM),
                        gridM: {
                            ...motion.gridM
                        }
                    },
                    snapping: {
                        enabled: snapEnabled,
                        status: spatial.snap?.status ?? null,
                        active: (spatial.snap?.results ?? []).filter((pair)=>pair.selection === 'active')
                    },
                    collision: {
                        enabled: collisionEnabled,
                        status: spatial.collision?.verdict?.status ?? 'unknown',
                        hits: (spatial.collision?.results ?? []).map((hit)=>({
                                ...hit
                            }))
                    },
                    dragging: gestureActive()
                };
            },
            /** Set the absolute offset (metres, frame axes). `constraint: 'bypass'` ignores bounds/grid. */ setOffset (offsetM, { constraint = 'respect' } = {}) {
                const current = instance.getState().applied?.offsetM ?? {
                    u: 0,
                    v: 0
                };
                return instance.setOffsetM({
                    u: offsetM.u ?? current.u,
                    v: offsetM.v ?? current.v
                }, {
                    constraintMode: constraint
                });
            },
            moveBy (deltaM, { constraint = 'respect' } = {}) {
                return instance.moveByM({
                    u: deltaM.u ?? 0,
                    v: deltaM.v ?? 0
                }, {
                    constraintMode: constraint
                });
            },
            reset (offsetM = {
                u: 0,
                v: 0
            }) {
                return instance.reset({
                    offsetM: cloneUv(offsetM),
                    constraintMode: 'bypass'
                });
            },
            /** Change axes / bounds / grid. Omitted keys keep their value; `null` clears bounds/grid. */ setMotion ({ axes, boundsM, gridM } = {}) {
                if (axes !== undefined) motion.axes = [
                    ...axes
                ];
                if (boundsM !== undefined) motion.boundsM = boundsM === null ? {} : structuredClone(boundsM);
                if (gridM !== undefined) motion.gridM = gridM === null ? {} : {
                    ...gridM
                };
                return configure({
                    motion: motionConfig()
                });
            },
            setSnapping (enabled) {
                snapEnabled = Boolean(enabled) && Boolean(spec.snapping);
                return configure({
                    snapping: {
                        enabled: snapEnabled
                    }
                });
            },
            setCollision (enabled) {
                collisionEnabled = Boolean(enabled) && Boolean(spec.collision);
                return configure({
                    collision: {
                        enabled: collisionEnabled
                    }
                });
            },
            /** Which bodies participate changed (e.g. a `when` predicate's input). Deferred mid-drag. */ refreshMembership () {
                return runOrDefer('membership', applyMembership);
            },
            /**
       * The host re-laid the object's entities out: recapture the pose base now (the offset is
       * re-applied). Deferred mid-drag. Geometry follows with `invalidate()`.
       */ rebasePose (options = undefined) {
                return runOrDefer('rebase', ()=>{
                    try {
                        driver.rebase?.(options);
                    } catch (error) {
                        reportError('rebase', error, handle);
                    }
                    return Promise.resolve(null);
                });
            },
            /**
       * Take the entities off their offset while the host re-lays them out; follow with
       * `rebasePose({ mode: 'standard' })`. Synchronous; a no-op mid-drag.
       */ suspendPose () {
                if (gestureActive()) return false;
                driver.suspend?.();
                return true;
            },
            /** This object's own geometry or its scene changed. Deferred mid-drag. */ invalidate (reason = 'host-update') {
                return runOrDefer('invalidate', ()=>applyInvalidation(reason));
            },
            on: (name, callback)=>emitter.on(name, callback),
            off: (name, callback)=>emitter.off(name, callback),
            whenSettled: ()=>instance.whenSettled(),
            async destroy ({ restoreStandard = false } = {}) {
                if (handleDestroyed) return;
                handleDestroyed = true;
                handles.delete(instanceId);
                try {
                    detach?.();
                } catch (error) {
                    reportError('detach', error, handle);
                }
                engine.renderGuides?.(handle, []);
                for (const off of unsubscribes)off();
                await instance.destroy().catch(()=>null);
                posePort.release();
                driver.destroy?.({
                    restoreStandard
                });
                emitter.clear();
            }
        };
        handles.set(instanceId, handle);
        try {
            detach = engine.attach?.(handle) ?? null;
        } catch (error) {
            reportError('attach', error, handle);
        }
        await quiet(instance.refreshGeometry(), 'refresh');
        return handle;
    };
    const api = {
        register,
        get: (id)=>handles.get(id) ?? null,
        list: ()=>[
                ...handles.values()
            ],
        get sceneRevision () {
            return sceneRevision;
        },
        /** The scene changed: every manipulable re-measures (deferred for the one being dragged). */ invalidate (reason = 'scene-changed') {
            if (destroyed) return Promise.resolve();
            sceneRevision += 1;
            return Promise.all([
                ...handles.values()
            ].map((handle)=>handle.invalidate(reason))).then(()=>undefined);
        },
        whenSettled: ()=>Promise.all([
                ...handles.values()
            ].map((handle)=>handle.whenSettled().catch(()=>null))).then(()=>undefined),
        runtime,
        async destroy () {
            if (destroyed) return;
            destroyed = true;
            await Promise.all([
                ...handles.values()
            ].map((handle)=>handle.destroy()));
            await runtime.destroy();
        }
    };
    return api;
}

export { createSpatialWorld };
