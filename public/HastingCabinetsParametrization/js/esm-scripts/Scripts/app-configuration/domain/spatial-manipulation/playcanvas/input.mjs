import '../spec/selectors.mjs';
import '../runtime/world.mjs';
import { SPATIAL_MANIPULATION_EVENT } from '../core/contracts/constants.mjs';
import { throwSpatialInvalidInput, SPATIAL_MANIPULATION_ERROR_CODE } from '../core/contracts/errors.mjs';
import '../core/contracts/validators.mjs';
import '../core/motion/planner.mjs';
import '../core/snapping/candidates.mjs';
import '../core/snapping/latch.mjs';
import '../runtime/instance-support.mjs';
import '../core/collision/observation.mjs';
import '../runtime/events.mjs';
import { createGestureOwnership, acquireGestureOwnership, createSpatialManipulationGestureOwner, releaseGestureOwnership } from './gesture-ownership.mjs';

const DEFAULT_SPATIAL_DRAG_THRESHOLD_PX = 6;
const SPATIAL_SYNTHETIC_MOUSE_OWNER = 'spatial-manipulation:synthetic-mouse';
const SPATIAL_MANIPULATION_INPUT_APP_KEY = 'spatialManipulationInput';
const SPATIAL_POINTER_META = Object.freeze({
    source: 'pointer'
});
const LEFT_MOUSE_BUTTON = 0;
const MOUSE_POINTER_ID = 'primary';
const SYNTHETIC_MOUSE_WINDOW_MS = 1000;
const SYNTHETIC_MOUSE_RADIUS_PX = 25;
const MOTION_AXES = [
    'u',
    'v'
];
const isFiniteNumber = (value)=>typeof value === 'number' && Number.isFinite(value);
// Strict: only finite numeric x/y is a point (no coercion; `{x:null,y:null}` is not a point).
const finitePoint2 = (value)=>Boolean(value && isFiniteNumber(value.x) && isFiniteNumber(value.y));
const clonePoint2 = (value)=>({
        x: value.x,
        y: value.y
    });
const cloneUv = (value)=>({
        u: Number(value.u),
        v: Number(value.v)
    });
const finiteUv = (value)=>Boolean(value && isFiniteNumber(value.u) && isFiniteNumber(value.v));
const touchId = (touch)=>touch?.id ?? touch?.identifier ?? null;
const findTouch = (touches, id)=>{
    if (!touches) return null;
    for(let index = 0; index < touches.length; index += 1){
        if (String(touchId(touches[index])) === id) return touches[index];
    }
    return null;
};
const preventTouchDefault = (event)=>{
    const nativeEvent = event?.event;
    if (nativeEvent?.cancelable !== false) nativeEvent?.preventDefault?.();
};
const resolveWindow = (candidate)=>{
    if (candidate !== undefined) return candidate ?? null;
    return typeof window !== 'undefined' ? window : null;
};
const defaultReportError = (stage, error)=>{
    if (typeof console !== 'undefined' && typeof console.error === 'function') {
        console.error(`[SpatialManipulationInput] ${stage} failed`, error);
    }
};
const readInstanceState = (instance)=>{
    try {
        return instance.getState() ?? null;
    } catch  {
        return null;
    }
};
const resolveProjection = (registration)=>{
    const { projection } = registration;
    return typeof projection === 'function' ? projection() : projection;
};
const OBSERVED_INSTANCE_EVENTS = [
    SPATIAL_MANIPULATION_EVENT.GESTURE_CANCEL,
    SPATIAL_MANIPULATION_EVENT.GESTURE_END,
    SPATIAL_MANIPULATION_EVENT.LIFECYCLE_CHANGE
];
const isDestroyedError = (error)=>error?.code === SPATIAL_MANIPULATION_ERROR_CODE.DESTROYED;
const createDestroyedError = (instanceId)=>{
    const error = new Error(`Spatial manipulation instance ${instanceId} is destroyed`);
    error.code = SPATIAL_MANIPULATION_ERROR_CODE.DESTROYED;
    error.field = 'instance';
    return error;
};
const safeCall = (callback)=>{
    try {
        callback();
    } catch  {
    // cleanup is best effort (the instance may already be destroyed)
    }
};
/**
 * @param {object} app PlayCanvas application (duck-typed: `mouse`, `touch`, `fire`).
 * @param {object} [options]
 * @param {number} [options.thresholdPx] Drag threshold in CSS px (default 6, legacy parity).
 * @param {object} [options.ownership] Shared `GestureOwnership`; created (and owned) when omitted.
 * @param {object|null} [options.window] Window-like listener target (default: global `window`).
 * @param {() => number} [options.now] Clock for the synthetic-mouse window (default `Date.now`).
 * @param {(kind: string) => string} [options.gestureIdFactory] Gesture id factory.
 * @param {boolean} [options.publish] Publish as `app.spatialManipulationInput` (default true).
 */ const createPlayCanvasInputRouter = (app, options = {})=>{
    const thresholdPx = isFiniteNumber(options.thresholdPx) ? Math.max(0, Number(options.thresholdPx)) : DEFAULT_SPATIAL_DRAG_THRESHOLD_PX;
    const ownership = options.ownership || createGestureOwnership(app ?? null);
    const ownsOwnership = !options.ownership;
    const windowTarget = resolveWindow(options.window);
    const now = typeof options.now === 'function' ? options.now : ()=>Date.now();
    const publish = options.publish !== false;
    let gestureCounter = 0;
    const gestureIdFactory = typeof options.gestureIdFactory === 'function' ? options.gestureIdFactory : ()=>{
        gestureCounter += 1;
        return `spatial-gesture-${gestureCounter}`;
    };
    const registrations = new Map();
    // Gestures whose begin/end/cancel steps have not finished, keyed by gesture id, so a
    // core-side terminal (rebind, pose-port failure, destroy, host end) can mark them inert.
    const openGestures = new Map();
    let candidate = null;
    let altDown = false;
    // Sentinel semantics: `point` is null when the last touch had no usable screen point; a
    // touch-sourced mouse event is then suppressed regardless of distance (legacy parity).
    let lastHandledTouch = null;
    let terminal = Promise.resolve();
    let destroyed = false;
    let published = false;
    const router = {};
    // ---------------------------------------------------------------------------------------
    // Ownership / arbitration
    // ---------------------------------------------------------------------------------------
    const blocksCamera = ()=>Boolean(!destroyed && (candidate || ownership.blocksCamera?.()));
    const blocksSelection = ()=>Boolean(!destroyed && (candidate || ownership.blocksSelection?.()));
    const rememberHandledTouch = (point)=>{
        lastHandledTouch = {
            point: finitePoint2(point) ? clonePoint2(point) : null,
            at: now()
        };
    };
    const shouldSuppressSyntheticMouse = (event)=>{
        const recentTouch = lastHandledTouch;
        if (!recentTouch || now() - recentTouch.at > SYNTHETIC_MOUSE_WINDOW_MS) {
            lastHandledTouch = null;
            return false;
        }
        const nativeEvent = event?.event || event;
        const knownTouchSource = nativeEvent?.sourceCapabilities?.firesTouchEvents === true || nativeEvent?.pointerType === 'touch';
        if (!knownTouchSource) return false;
        // Unknown mouse point or unknown last touch point: suppress (legacy parity).
        if (!finitePoint2(event) || recentTouch.point === null) return true;
        const dx = event.x - recentTouch.point.x;
        const dy = event.y - recentTouch.point.y;
        return dx * dx + dy * dy <= SYNTHETIC_MOUSE_RADIUS_PX * SYNTHETIC_MOUSE_RADIUS_PX;
    };
    // ---------------------------------------------------------------------------------------
    // Candidate lifecycle
    // ---------------------------------------------------------------------------------------
    const clearGesture = (current, { rememberTouch = false, dropPending = true } = {})=>{
        if (!current || candidate !== current) return;
        if (rememberTouch && current.pointerType === 'touch') {
            rememberHandledTouch(current.currentScreen || current.startScreen);
        }
        if (dropPending) current.pendingSample = null;
        candidate = null;
        releaseGestureOwnership(ownership, current.owner);
    };
    const reportError = (current, stage, error)=>{
        const handler = current?.registration?.onError;
        if (typeof handler === 'function') {
            try {
                handler(stage, error);
                return;
            } catch  {
            // fall through to the default reporter
            }
        }
        defaultReportError(stage, error);
    };
    const step = (current, task)=>{
        current.chain = current.chain.then(task, task);
        return current.chain;
    };
    /**
   * F1: a core-side terminal (`gesturecancel` reason rebind/pose-port-failure/destroy, a
   * host-initiated `gestureend`, or the instance entering `pending`/`destroyed`) is observed
   * through the instance events. The affected gesture record becomes inert (queued begin,
   * update, end or cancel steps send nothing) and, if it is the current candidate, the
   * viewport ownership is released synchronously with its pending sample dropped.
   */ const dropCoreTerminated = (record)=>{
        if (!record || record.coreTerminated) return;
        record.coreTerminated = true;
        record.pendingSample = null;
        openGestures.delete(record.gestureId);
        if (candidate === record) {
            clearGesture(record, {
                rememberTouch: record.pointerType === 'touch'
            });
        }
    };
    const onInstanceEvent = (registration, event)=>{
        if (!event || typeof event !== 'object') return;
        if (event.event === SPATIAL_MANIPULATION_EVENT.LIFECYCLE_CHANGE) {
            const lifecycle = event.state?.lifecycle;
            if (lifecycle !== 'destroyed' && lifecycle !== 'pending') return;
            for (const record of [
                ...openGestures.values()
            ]){
                if (record.registration === registration) dropCoreTerminated(record);
            }
            if (candidate && candidate.registration === registration) dropCoreTerminated(candidate);
            return;
        }
        const gestureId = event.gestureId;
        if (typeof gestureId !== 'string') return;
        const record = openGestures.get(gestureId);
        if (record && record.registration === registration) dropCoreTerminated(record);
    };
    const subscribeInstance = (registration)=>{
        const { instance } = registration;
        if (typeof instance.on !== 'function') return [];
        const handler = (event)=>onInstanceEvent(registration, event);
        const unsubscribes = [];
        try {
            for (const name of OBSERVED_INSTANCE_EVENTS){
                const off = instance.on(name, handler);
                unsubscribes.push(typeof off === 'function' ? off : ()=>instance.off?.(name, handler));
            }
        } catch (error) {
            for (const off of unsubscribes)safeCall(off);
            throw error;
        }
        return unsubscribes;
    };
    const unsubscribeInstance = (registration)=>{
        const list = registration.unsubscribes ?? [];
        registration.unsubscribes = [];
        for (const off of list)safeCall(off);
    };
    const trackTerminal = (promise)=>{
        const settled = promise.then(()=>undefined, ()=>undefined);
        terminal = terminal.then(()=>settled);
        return settled;
    };
    /** Adapter-side anchor rebase on the current applied offset, compensating the core's own rebase. */ const rebaseAnchor = (current, uv, axes = MOTION_AXES)=>{
        const state = readInstanceState(current.instance);
        const applied = state?.applied?.offsetM;
        if (!finiteUv(applied)) return false;
        for (const axis of axes){
            current.anchorOffsetM[axis] = applied[axis] - current.coreRebaseM[axis];
            if (uv) current.anchorUv[axis] = uv[axis];
        }
        return true;
    };
    const sendUpdate = async (current, sample)=>{
        const raw = {
            u: current.anchorOffsetM.u + (sample.uv.u - current.anchorUv.u),
            v: current.anchorOffsetM.v + (sample.uv.v - current.anchorUv.v)
        };
        const request = {
            gestureId: current.gestureId,
            requestedOffsetM: raw,
            screenPointPx: clonePoint2(sample.screenPointPx),
            screenAxisBasis: {
                u: clonePoint2(sample.screenAxisBasis.u),
                v: clonePoint2(sample.screenAxisBasis.v)
            },
            projectionRevision: sample.projectionRevision,
            altActive: sample.altActive
        };
        const report = await current.instance.updateGesture(request, {
            ...SPATIAL_POINTER_META
        });
        const requested = report?.requested?.offsetM;
        if (finiteUv(requested)) {
            current.coreRebaseM = {
                u: requested.u - raw.u,
                v: requested.v - raw.v
            };
        }
        const applied = report?.applied?.offsetM;
        const boundsAxes = new Set();
        for (const correction of report?.corrections ?? []){
            if (correction?.kind !== 'bounds') continue;
            for (const axis of correction.axes ?? [])boundsAxes.add(axis);
        }
        if (finiteUv(applied)) {
            for (const axis of MOTION_AXES){
                if (!boundsAxes.has(axis)) continue;
                // Clamp rebases only its own axis: the other axis keeps its raw residue and the raw
                // cursor intent stays independent (legacy `_syncCandidateToAppliedOffset`).
                current.anchorUv[axis] = sample.uv[axis];
                current.anchorOffsetM[axis] = applied[axis] - current.coreRebaseM[axis];
            }
        }
    };
    const processSample = async (current, sample)=>{
        // A sample queued before `endGesture` still applies (legacy: every move lands before the
        // release); samples after a cancel/begin failure or a core-side terminal are moot.
        if (current.failed || !current.begun || current.coreTerminated || current.terminal === 'cancel') return;
        if (!sample.valid) {
            // Invalid/parallel projection: rebase on the applied offset, no pose write (§5.3).
            current.needsRebase = true;
            rebaseAnchor(current, null);
            return;
        }
        if (current.needsRebase || sample.projectionRevision !== current.projectionRevision) {
            // Camera/projection change: rebase the anchor at this sample, no pose write (AC-07).
            current.projectionRevision = sample.projectionRevision;
            current.needsRebase = !rebaseAnchor(current, sample.uv);
            return;
        }
        try {
            await sendUpdate(current, sample);
        } catch (error) {
            reportError(current, 'update', error);
            if (candidate === current) finishAtCurrentOffset('move-error');
        }
    };
    const pushSample = (current, sample)=>{
        current.pendingSample = sample;
        if (current.drainQueued) return;
        current.drainQueued = true;
        step(current, async ()=>{
            current.drainQueued = false;
            const next = current.pendingSample;
            current.pendingSample = null;
            if (next) await processSample(current, next);
        });
    };
    const beginCandidate = (current)=>{
        current.active = true;
        acquireGestureOwnership(ownership, current.owner, {
            pointerType: current.pointerType,
            pointerId: current.pointerId,
            active: true
        });
        const request = {
            gestureId: current.gestureId,
            pointerType: current.pointerType,
            pointerId: current.pointerId,
            startScreenPx: clonePoint2(current.startScreen),
            projectionRevision: current.projectionRevision,
            altActive: current.altActive
        };
        openGestures.set(current.gestureId, current);
        const previousTerminal = terminal;
        step(current, async ()=>{
            await previousTerminal;
            // F2: an end that arrived before this step still runs begin → pending sample → end;
            // only a cancel or a core-side terminal skips the begin.
            if (current.terminal === 'cancel' || current.coreTerminated) {
                openGestures.delete(current.gestureId);
                return;
            }
            try {
                const report = await current.instance.beginGesture(request, {
                    ...SPATIAL_POINTER_META
                });
                const startApplied = report?.applied?.offsetM;
                if (finiteUv(startApplied)) {
                    current.anchorOffsetM = cloneUv(startApplied);
                }
                current.begun = true;
            } catch (error) {
                current.failed = true;
                openGestures.delete(current.gestureId);
                reportError(current, 'begin', error);
                clearGesture(current, {
                    rememberTouch: current.pointerType === 'touch'
                });
            }
        });
        return true;
    };
    const finishAtCurrentOffset = (reason)=>{
        const current = candidate;
        if (!current) return false;
        if (current.active) {
            current.terminal = 'end';
            const gestureId = current.gestureId;
            const instance = current.instance;
            // The end step is queued behind any pending sample drain: the last move lands first.
            const terminalPromise = step(current, async ()=>{
                if (current.failed || !current.begun || current.coreTerminated) return;
                try {
                    await instance.endGesture({
                        gestureId
                    }, {
                        ...SPATIAL_POINTER_META
                    });
                } catch (error) {
                    reportError(current, reason, error);
                } finally{
                    openGestures.delete(gestureId);
                }
            });
            trackTerminal(terminalPromise);
        }
        clearGesture(current, {
            rememberTouch: current.pointerType === 'touch',
            dropPending: false
        });
        return true;
    };
    const cancel = (reason = 'cancelled')=>{
        const current = candidate;
        if (!current) return false;
        if (current.active) {
            current.terminal = 'cancel';
            const gestureId = current.gestureId;
            const instance = current.instance;
            const cancelReason = typeof reason === 'string' && reason.length > 0 ? reason : 'cancelled';
            const terminalPromise = step(current, async ()=>{
                if (current.failed || !current.begun || current.coreTerminated) return;
                try {
                    await instance.cancelGesture({
                        gestureId,
                        reason: cancelReason
                    }, {
                        ...SPATIAL_POINTER_META
                    });
                } catch (error) {
                    reportError(current, cancelReason, error);
                } finally{
                    openGestures.delete(gestureId);
                }
            });
            trackTerminal(terminalPromise);
        }
        clearGesture(current, {
            rememberTouch: current.pointerType === 'touch'
        });
        return true;
    };
    const isRegistrationEligible = (registration, phase)=>{
        const state = readInstanceState(registration.instance);
        if (!state || state.binding?.readiness !== 'ready') return false;
        if (phase === 'contact' && state.lifecycle !== 'ready') return false;
        if (phase === 'drag' && state.lifecycle !== 'ready' && state.lifecycle !== 'gesturing') return false;
        if (typeof registration.isEligible === 'function') {
            try {
                if (!registration.isEligible({
                    phase,
                    instanceId: registration.instanceId
                })) return false;
            } catch  {
                return false;
            }
        }
        return true;
    };
    const findRegistrationAt = (point, event)=>{
        for (const registration of registrations.values()){
            let hit = false;
            try {
                hit = Boolean(registration.hitTest(clonePoint2(point), event));
            } catch (error) {
                reportError({
                    registration
                }, 'hit-test', error);
                hit = false;
            }
            if (hit) return registration;
        }
        return null;
    };
    const createCandidate = ({ registration, pointerType, pointerId, point, altActive })=>{
        const state = readInstanceState(registration.instance);
        const frame = state?.config?.frame;
        if (!frame) return null;
        // `state.applied` is null until the runtime's first command; the begin report is the
        // authoritative gesture-start pose and re-anchors the candidate (public-api.md §5.3).
        const applied = finiteUv(state?.applied?.offsetM) ? state.applied.offsetM : {
            u: 0,
            v: 0
        };
        const projection = resolveProjection(registration);
        if (!projection || typeof projection.sample !== 'function') return null;
        const sample = projection.sample(clonePoint2(point), frame);
        if (!sample?.valid) return null;
        return {
            registration,
            instanceId: registration.instanceId,
            instance: registration.instance,
            owner: registration.owner,
            projection,
            frame,
            pointerType,
            pointerId,
            suppressed: false,
            active: false,
            begun: false,
            failed: false,
            gestureId: gestureIdFactory('gesture'),
            terminal: null,
            coreTerminated: false,
            startScreen: clonePoint2(point),
            currentScreen: clonePoint2(point),
            anchorUv: cloneUv(sample.uv),
            anchorOffsetM: cloneUv(applied),
            coreRebaseM: {
                u: 0,
                v: 0
            },
            projectionRevision: sample.projectionRevision,
            needsRebase: false,
            altActive,
            chain: Promise.resolve(),
            pendingSample: null,
            drainQueued: false
        };
    };
    const sampleAt = (current, point, altActive)=>{
        const projected = current.projection.sample(clonePoint2(point), current.frame);
        return {
            ...projected,
            altActive
        };
    };
    const eventAlt = (event)=>Boolean(event?.altKey ?? event?.event?.altKey ?? altDown);
    // ---------------------------------------------------------------------------------------
    // Mouse
    // ---------------------------------------------------------------------------------------
    const handleMouseDown = (event)=>{
        if (destroyed || event?.button !== LEFT_MOUSE_BUTTON) return false;
        // Repeated forwarding for the same mousedown is idempotent (legacy parity).
        if (candidate) return ownership.isOwnedBy(candidate.owner);
        if (shouldSuppressSyntheticMouse(event)) {
            if (!acquireGestureOwnership(ownership, SPATIAL_SYNTHETIC_MOUSE_OWNER, {
                pointerType: 'synthetic-mouse',
                pointerId: MOUSE_POINTER_ID
            })) return false;
            candidate = {
                owner: SPATIAL_SYNTHETIC_MOUSE_OWNER,
                pointerType: 'synthetic-mouse',
                pointerId: MOUSE_POINTER_ID,
                suppressed: true,
                active: false,
                begun: false,
                failed: false,
                terminal: null,
                coreTerminated: false,
                chain: Promise.resolve(),
                pendingSample: null
            };
            lastHandledTouch = null;
            event?.event?.preventDefault?.();
            return true;
        }
        if (!finitePoint2(event)) return false;
        const registration = findRegistrationAt(event, event);
        if (!registration || !isRegistrationEligible(registration, 'contact')) return false;
        const next = createCandidate({
            registration,
            pointerType: 'mouse',
            pointerId: MOUSE_POINTER_ID,
            point: event,
            altActive: eventAlt(event)
        });
        if (!next) return false;
        if (!acquireGestureOwnership(ownership, registration.owner, {
            pointerType: 'mouse',
            pointerId: MOUSE_POINTER_ID
        })) return false;
        candidate = next;
        return true;
    };
    const handleMouseMove = (event)=>{
        const current = candidate;
        if (destroyed || !current || current.pointerType === 'touch' || !finitePoint2(event)) return false;
        if (current.suppressed) return true;
        if (!isRegistrationEligible(current.registration, 'drag')) {
            finishAtCurrentOffset('mode-or-selection-changed');
            return false;
        }
        current.currentScreen = clonePoint2(event);
        const altActive = eventAlt(event);
        if (!current.active) {
            const dx = Number(event.x) - current.startScreen.x;
            const dy = Number(event.y) - current.startScreen.y;
            if (dx * dx + dy * dy < thresholdPx * thresholdPx) {
                current.altActive = altActive;
                return true;
            }
            beginCandidate(current);
        }
        current.altActive = altActive;
        pushSample(current, sampleAt(current, event, altActive));
        return true;
    };
    const handleMouseUp = (event)=>{
        const current = candidate;
        if (!current || current.pointerType === 'touch') return false;
        if (event?.button !== undefined && event.button !== LEFT_MOUSE_BUTTON) return false;
        finishAtCurrentOffset('mouse-up');
        return true;
    };
    const setAltMode = (altActive)=>{
        altDown = altActive;
        const current = candidate;
        if (!current || current.pointerType !== 'mouse' || current.suppressed) return;
        if (current.altActive === altActive) return;
        current.altActive = altActive;
        if (!current.active) return;
        // Legacy parity: an Alt change without pointer motion re-samples at the current point so
        // the core rebases immediately (the core owns the axis decision, ruling R2).
        pushSample(current, sampleAt(current, current.currentScreen, altActive));
    };
    // ---------------------------------------------------------------------------------------
    // Touch
    // ---------------------------------------------------------------------------------------
    const handleTouchStart = (event)=>{
        const touches = event?.touches;
        if (destroyed || !touches) return false;
        const current = candidate;
        if (current) {
            if (current.pointerType !== 'touch') return false;
            preventTouchDefault(event);
            if (touches.length >= 2) {
                // Commit the applied offset and release ownership so the camera can rebase its
                // two-finger anchors in this same event (spec AC-07 second-touch yield).
                finishAtCurrentOffset('second-touch');
                return true;
            }
            return touches.length === 1 && String(touchId(touches[0])) === current.pointerId;
        }
        if (touches.length !== 1) return false;
        const touch = touches[0];
        if (!finitePoint2(touch)) return false;
        const id = touchId(touch);
        if (id == null) return false;
        const pointerId = String(id);
        const registration = findRegistrationAt(touch, event);
        if (!registration || !isRegistrationEligible(registration, 'contact')) return false;
        const next = createCandidate({
            registration,
            pointerType: 'touch',
            pointerId,
            point: touch,
            altActive: false
        });
        if (!next) return false;
        if (!acquireGestureOwnership(ownership, registration.owner, {
            pointerType: 'touch',
            pointerId
        })) return false;
        candidate = next;
        preventTouchDefault(event);
        return true;
    };
    const handleTouchMove = (event)=>{
        const current = candidate;
        if (destroyed || current?.pointerType !== 'touch') return false;
        preventTouchDefault(event);
        const touch = findTouch(event?.touches, current.pointerId);
        if (!touch || event.touches.length !== 1) {
            // A missing/replaced id must never reuse another finger's anchor.
            finishAtCurrentOffset('touch-contact-changed');
            return true;
        }
        if (!finitePoint2(touch)) return true;
        if (!isRegistrationEligible(current.registration, 'drag')) {
            finishAtCurrentOffset('mode-or-selection-changed');
            return true;
        }
        current.currentScreen = clonePoint2(touch);
        if (!current.active) {
            const dx = Number(touch.x) - current.startScreen.x;
            const dy = Number(touch.y) - current.startScreen.y;
            if (dx * dx + dy * dy < thresholdPx * thresholdPx) return true;
            beginCandidate(current);
        }
        // Touch is free-axis: Alt is never reported (public-api.md §5.3, spec AC-07).
        pushSample(current, sampleAt(current, touch, false));
        return true;
    };
    const handleTouchEnd = (event)=>{
        const current = candidate;
        if (current?.pointerType !== 'touch') return false;
        preventTouchDefault(event);
        if (findTouch(event?.touches, current.pointerId)) return true;
        finishAtCurrentOffset('touch-end');
        return true;
    };
    const handleTouchCancel = (event)=>{
        const current = candidate;
        if (current?.pointerType !== 'touch') return false;
        preventTouchDefault(event);
        cancel('touch-cancel');
        return true;
    };
    // ---------------------------------------------------------------------------------------
    // Window
    // ---------------------------------------------------------------------------------------
    const onWindowMouseUp = (event)=>{
        handleMouseUp(event);
    };
    const onWindowBlur = ()=>{
        altDown = false;
        cancel('window-blur');
    };
    const onWindowKeyDown = (event)=>{
        if (event?.key === 'Escape') cancel('escape');
        if (event?.key === 'Alt') setAltMode(true);
    };
    const onWindowKeyUp = (event)=>{
        if (event?.key === 'Alt') setAltMode(Boolean(event.altKey));
    };
    // ---------------------------------------------------------------------------------------
    // Registration
    // ---------------------------------------------------------------------------------------
    const unregister = (instanceId)=>{
        const registration = registrations.get(instanceId);
        if (!registration) return false;
        if (candidate && candidate.registration === registration) {
            // Owner-keyed cleanup: end this owner's gesture at the applied offset before it leaves
            // (public-api.md §5.3: the adapter ends its current gesture before destroy).
            finishAtCurrentOffset('unregister');
        }
        unsubscribeInstance(registration);
        registrations.delete(instanceId);
        registration.active = false;
        return true;
    };
    /**
   * @param {object} request
   * @param {string} request.instanceId Runtime instance id (owner key).
   * @param {object} request.instance `ManipulationInstanceV1` handle.
   * @param {object|(() => object)} request.projection Projection adapter (or resolver).
   * @param {(point: {x:number,y:number}, event: object) => boolean} request.hitTest Pointer-down hit test.
   * @param {(context: {phase:string,instanceId:string}) => boolean} [request.isEligible] Host veto.
   * @param {(stage: string, error: Error) => void} [request.onError] Error sink.
   */ const register = (request = {})=>{
        if (destroyed) throwSpatialInvalidInput('router');
        const instanceId = request.instanceId;
        if (typeof instanceId !== 'string' || instanceId.length === 0) throwSpatialInvalidInput('instanceId');
        const instance = request.instance;
        if (!instance || typeof instance.beginGesture !== 'function' || typeof instance.updateGesture !== 'function' || typeof instance.endGesture !== 'function' || typeof instance.cancelGesture !== 'function' || typeof instance.getState !== 'function') {
            throwSpatialInvalidInput('instance');
        }
        if (typeof instance.instanceId === 'string' && instance.instanceId !== instanceId) throwSpatialInvalidInput('instanceId');
        if (registrations.has(instanceId)) throwSpatialInvalidInput('instanceId');
        const projection = request.projection;
        if (!projection || typeof projection !== 'function' && typeof projection.sample !== 'function') {
            throwSpatialInvalidInput('projection');
        }
        if (typeof request.hitTest !== 'function') throwSpatialInvalidInput('hitTest');
        if (request.isEligible !== undefined && typeof request.isEligible !== 'function') throwSpatialInvalidInput('isEligible');
        if (request.onError !== undefined && typeof request.onError !== 'function') throwSpatialInvalidInput('onError');
        // F1: a destroyed instance cannot be observed (`on()` throws SPATIAL_DESTROYED) nor dragged.
        const state = readInstanceState(instance);
        if (!state || state.lifecycle === 'destroyed') throw createDestroyedError(instanceId);
        const registration = {
            instanceId,
            owner: createSpatialManipulationGestureOwner(instanceId),
            instance,
            projection,
            hitTest: request.hitTest,
            isEligible: request.isEligible ?? null,
            onError: request.onError ?? null,
            unsubscribes: [],
            active: true
        };
        try {
            registration.unsubscribes = subscribeInstance(registration);
        } catch (error) {
            if (isDestroyedError(error)) throw createDestroyedError(instanceId);
            throw error;
        }
        registrations.set(instanceId, registration);
        return Object.freeze({
            instanceId,
            owner: registration.owner,
            isActive: ()=>registration.active && registrations.get(instanceId) === registration,
            unregister: ()=>registrations.get(instanceId) === registration ? unregister(instanceId) : false
        });
    };
    // ---------------------------------------------------------------------------------------
    // Introspection / settlement / cleanup
    // ---------------------------------------------------------------------------------------
    const getSnapshot = ()=>Object.freeze({
            phase: candidate ? candidate.suppressed ? 'suppressed' : candidate.active ? 'active' : 'candidate' : 'idle',
            instanceId: candidate?.instanceId ?? null,
            pointerType: candidate?.pointerType ?? null,
            pointerId: candidate?.pointerId ?? null,
            gestureId: candidate?.gestureId ?? null,
            registrations: Object.freeze([
                ...registrations.keys()
            ]),
            openGestures: Object.freeze([
                ...openGestures.keys()
            ]),
            destroyed
        });
    /** Resolves once the current candidate's pipeline and every terminal command have settled. */ const settle = async ()=>{
        for(let iteration = 0; iteration < 10000; iteration += 1){
            const chain = candidate?.chain ?? null;
            const pending = terminal;
            await pending;
            if (chain) await chain;
            if (terminal === pending && (candidate?.chain ?? null) === chain) return;
        }
    };
    const destroy = ()=>{
        if (destroyed) return;
        finishAtCurrentOffset('destroy');
        destroyed = true;
        for (const registration of registrations.values()){
            unsubscribeInstance(registration);
            registration.active = false;
        }
        registrations.clear();
        app?.mouse?.off?.('mousedown', handleMouseDown, router);
        app?.mouse?.off?.('mousemove', handleMouseMove, router);
        app?.mouse?.off?.('mouseup', handleMouseUp, router);
        app?.touch?.off?.('touchstart', handleTouchStart, router);
        app?.touch?.off?.('touchmove', handleTouchMove, router);
        app?.touch?.off?.('touchend', handleTouchEnd, router);
        app?.touch?.off?.('touchcancel', handleTouchCancel, router);
        if (windowTarget) {
            windowTarget.removeEventListener('mouseup', onWindowMouseUp, true);
            windowTarget.removeEventListener('blur', onWindowBlur, false);
            windowTarget.removeEventListener('keydown', onWindowKeyDown, true);
            windowTarget.removeEventListener('keyup', onWindowKeyUp, true);
        }
        if (published && app && app[SPATIAL_MANIPULATION_INPUT_APP_KEY] === router) {
            app[SPATIAL_MANIPULATION_INPUT_APP_KEY] = null;
        }
        published = false;
        lastHandledTouch = null;
        if (ownsOwnership) ownership.destroy?.();
    };
    Object.assign(router, {
        register,
        unregister,
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        handleTouchStart,
        handleTouchMove,
        handleTouchEnd,
        handleTouchCancel,
        cancel,
        blocksCamera,
        blocksSelection,
        getSnapshot,
        settle,
        destroy
    });
    Object.defineProperties(router, {
        app: {
            get: ()=>app,
            enumerable: true
        },
        ownership: {
            get: ()=>ownership,
            enumerable: true
        },
        thresholdPx: {
            get: ()=>thresholdPx,
            enumerable: true
        },
        destroyed: {
            get: ()=>destroyed,
            enumerable: true
        },
        phase: {
            get: ()=>getSnapshot().phase,
            enumerable: true
        }
    });
    app?.mouse?.on?.('mousedown', handleMouseDown, router);
    app?.mouse?.on?.('mousemove', handleMouseMove, router);
    app?.mouse?.on?.('mouseup', handleMouseUp, router);
    app?.touch?.on?.('touchstart', handleTouchStart, router);
    app?.touch?.on?.('touchmove', handleTouchMove, router);
    app?.touch?.on?.('touchend', handleTouchEnd, router);
    app?.touch?.on?.('touchcancel', handleTouchCancel, router);
    if (windowTarget) {
        windowTarget.addEventListener('mouseup', onWindowMouseUp, true);
        windowTarget.addEventListener('blur', onWindowBlur, false);
        windowTarget.addEventListener('keydown', onWindowKeyDown, true);
        windowTarget.addEventListener('keyup', onWindowKeyUp, true);
    }
    if (publish && app) {
        // Never overwrite a live router (source-map §5: prevent second adapter overwrite).
        const existing = app[SPATIAL_MANIPULATION_INPUT_APP_KEY];
        if (!existing || existing.destroyed === true) {
            app[SPATIAL_MANIPULATION_INPUT_APP_KEY] = router;
            published = true;
        }
    }
    return Object.freeze(router);
};
/** Get the live shared router published on `app`, or create and publish one. */ const resolvePlayCanvasInputRouter = (app, options = {})=>{
    const existing = app?.[SPATIAL_MANIPULATION_INPUT_APP_KEY];
    if (existing && existing.destroyed === false) return existing;
    return createPlayCanvasInputRouter(app, options);
};

export { DEFAULT_SPATIAL_DRAG_THRESHOLD_PX, SPATIAL_MANIPULATION_INPUT_APP_KEY, SPATIAL_POINTER_META, SPATIAL_SYNTHETIC_MOUSE_OWNER, createPlayCanvasInputRouter, resolvePlayCanvasInputRouter };
