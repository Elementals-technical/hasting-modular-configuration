import { Vec3 } from '../../../../../../playcanvas-stable.min.mjs';
import { COUNTERTOP_DRAG_GESTURE_OWNER, createGestureOwnership } from '../../../services/input/gesture-ownership.mjs';

const DEFAULT_COUNTERTOP_DRAG_THRESHOLD_PX = 6;
const LEFT_MOUSE_BUTTON = 0;
const PARALLEL_EPSILON = 1e-8;
const SYNTHETIC_MOUSE_WINDOW_MS = 1000;
const SYNTHETIC_MOUSE_RADIUS_PX = 25;
const finitePoint2 = (value)=>Boolean(value && Number.isFinite(value.x) && Number.isFinite(value.y));
const clonePoint2 = (value)=>({
        x: Number(value.x),
        y: Number(value.y)
    });
const samePoint2 = (left, right)=>Boolean(left && right && Object.is(left.x, right.x) && Object.is(left.y, right.y));
const touchId = (touch)=>touch?.id ?? touch?.identifier ?? null;
const findTouch = (touches, id)=>{
    if (!touches) return null;
    for(let index = 0; index < touches.length; index++){
        if (touchId(touches[index]) === id) return touches[index];
    }
    return null;
};
/** Project a screen point onto the world XY plane whose Z remains fixed. */ function projectScreenToWorldXY(camera, x, y, fixedZ, output = null, scratch = null) {
    if (!camera || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(fixedZ)) {
        return null;
    }
    const nearPoint = scratch?.near || new Vec3();
    const farPoint = scratch?.far || new Vec3();
    camera.screenToWorld(x, y, camera.nearClip, nearPoint);
    camera.screenToWorld(x, y, camera.farClip, farPoint);
    const rayZ = farPoint.z - nearPoint.z;
    if (!Number.isFinite(rayZ) || Math.abs(rayZ) <= PARALLEL_EPSILON) return null;
    const distance = (fixedZ - nearPoint.z) / rayZ;
    if (!Number.isFinite(distance)) return null;
    const point = output || new Vec3();
    point.set(nearPoint.x + (farPoint.x - nearPoint.x) * distance, nearPoint.y + (farPoint.y - nearPoint.y) * distance, fixedZ);
    return point;
}
/**
 * Mouse/touch countertop drag recognizer. Candidate ownership is reserved on
 * contact, while service move events begin only after the screen threshold.
 */ class CountertopInputAdapter {
    get ownership() {
        return this._ownership;
    }
    get thresholdPx() {
        return this._thresholdPx;
    }
    get phase() {
        return this._candidate?.active ? 'active' : this._candidate ? 'candidate' : 'idle';
    }
    bind({ service = this._service, binding = this._binding } = {}) {
        if (this._destroyed) return;
        if (service !== this._service) {
            this._finishAtCurrentOffset('service-rebind');
            this._unsubscribeService?.();
            this._unsubscribeService = null;
            this._service = service || null;
            if (this._service?.on) {
                this._unsubscribeService = this._service.on('change', (state)=>{
                    this._handleServiceChange(state);
                });
            }
        }
        this._binding = binding || null;
        if (this._candidate && !this._isEligible()) {
            this._finishAtCurrentOffset('binding-or-mode-changed');
        }
    }
    /**
     * Public so camera/selection handlers can reserve before their own mutation;
     * repeated calls for the same mousedown are idempotent.
     */ handleMouseDown(event) {
        if (this._destroyed || event?.button !== LEFT_MOUSE_BUTTON) return false;
        if (this._candidate) return this._ownership.isOwnedBy(COUNTERTOP_DRAG_GESTURE_OWNER);
        if (this._shouldSuppressSyntheticMouse(event)) {
            if (!this._ownership.reserve(COUNTERTOP_DRAG_GESTURE_OWNER, {
                pointerType: 'synthetic-mouse',
                pointerId: 'primary'
            })) return false;
            this._candidate = {
                active: false,
                suppressed: true,
                pointerType: 'synthetic-mouse',
                pointerId: 'primary'
            };
            this._lastHandledTouch = null;
            event?.event?.preventDefault?.();
            return true;
        }
        if (!this._isEligible() || !finitePoint2(event)) return false;
        const root = this._getCountertopRoot();
        const selectTool = this._app?.selectTool;
        const pickedTarget = selectTool?.getSelectionTargetAt?.(event.x, event.y) || null;
        if (!root || pickedTarget !== root) return false;
        const camera = this._getCamera();
        const fixedZ = Number(root.getPosition?.()?.z);
        const startWorld = projectScreenToWorldXY(camera, event.x, event.y, fixedZ, this._projectedPoint, this._projectionScratch);
        const state = this._service?.getStateM?.();
        if (!startWorld || !finitePoint2(state?.offsetM)) return false;
        if (!this._ownership.reserve(COUNTERTOP_DRAG_GESTURE_OWNER, {
            pointerType: 'mouse',
            pointerId: 'primary'
        })) return false;
        this._candidate = {
            active: false,
            suppressed: false,
            pointerType: 'mouse',
            pointerId: 'primary',
            startScreen: {
                x: Number(event.x),
                y: Number(event.y)
            },
            anchorWorld: startWorld.clone(),
            anchorOffsetM: clonePoint2(state.offsetM),
            currentOffsetM: clonePoint2(state.offsetM),
            fixedZ,
            axisLocked: Boolean(event.altKey),
            lockYM: Number(state.offsetM.y)
        };
        return true;
    }
    handleMouseMove(event) {
        const candidate = this._candidate;
        if (this._destroyed || !candidate || candidate.pointerType === 'touch' || !finitePoint2(event)) return false;
        if (candidate.suppressed) return true;
        if (!this._isEligible({
            allowDragging: true
        })) {
            this._finishAtCurrentOffset('mode-or-selection-changed');
            return false;
        }
        if (!candidate.active) {
            const dx = Number(event.x) - candidate.startScreen.x;
            const dy = Number(event.y) - candidate.startScreen.y;
            if (dx * dx + dy * dy < this._thresholdPx * this._thresholdPx) return true;
            try {
                this._service.beginMove();
                candidate.active = true;
                this._ownership.activate(COUNTERTOP_DRAG_GESTURE_OWNER);
            } catch (error) {
                this._reportError('begin', error);
                this._clearGesture();
                return false;
            }
        }
        const worldPoint = projectScreenToWorldXY(this._getCamera(), Number(event.x), Number(event.y), candidate.fixedZ, this._projectedPoint, this._projectionScratch);
        if (!worldPoint) return true;
        const nextLocked = Boolean(event.altKey);
        if (nextLocked !== candidate.axisLocked) {
            // Rebase both lock transitions at the already-applied offset. The
            // modifier event itself therefore cannot introduce an axis jump.
            candidate.axisLocked = nextLocked;
            candidate.anchorWorld.copy(worldPoint);
            candidate.anchorOffsetM = clonePoint2(candidate.currentOffsetM);
            candidate.lockYM = candidate.currentOffsetM.y;
            return true;
        }
        const nextOffsetM = {
            x: candidate.anchorOffsetM.x + (worldPoint.x - candidate.anchorWorld.x),
            y: candidate.axisLocked ? candidate.lockYM : candidate.anchorOffsetM.y + (worldPoint.y - candidate.anchorWorld.y)
        };
        try {
            const appliedState = this._service.updateMoveM(nextOffsetM);
            this._syncCandidateToAppliedOffset(candidate, worldPoint, nextOffsetM, appliedState?.offsetM);
        } catch (error) {
            this._reportError('update', error);
            this._finishAtCurrentOffset('move-error');
        }
        return true;
    }
    handleMouseUp(event) {
        if (!this._candidate || this._candidate.pointerType === 'touch') return false;
        if (event?.button !== undefined && event.button !== LEFT_MOUSE_BUTTON) return false;
        this._finishAtCurrentOffset('mouse-up');
        return true;
    }
    /** Reserve a selected editing countertop before the camera handles touchstart. */ handleTouchStart(event) {
        const touches = event?.touches;
        if (this._destroyed || !touches) return false;
        const current = this._candidate;
        if (current) {
            if (current.pointerType !== 'touch') return false;
            this._preventTouchDefault(event);
            if (touches.length >= 2) {
                // D-05: commit the applied offset, release ownership, then let
                // MouseInput rebase its two-finger anchors in this same event.
                this._finishAtCurrentOffset('second-touch');
                return true;
            }
            return touches.length === 1 && touchId(touches[0]) === current.pointerId;
        }
        if (touches.length !== 1 || !this._isEligible()) return false;
        const touch = touches[0];
        if (!finitePoint2(touch)) return false;
        const root = this._getCountertopRoot();
        const pickedTarget = this._app?.selectTool?.getSelectionTargetAt?.(touch.x, touch.y) || null;
        if (!root || pickedTarget !== root) return false;
        const camera = this._getCamera();
        const fixedZ = Number(root.getPosition?.()?.z);
        const startWorld = projectScreenToWorldXY(camera, touch.x, touch.y, fixedZ, this._projectedPoint, this._projectionScratch);
        const state = this._service?.getStateM?.();
        const pointerId = touchId(touch);
        if (!startWorld || !finitePoint2(state?.offsetM) || pointerId == null) return false;
        if (!this._ownership.reserve(COUNTERTOP_DRAG_GESTURE_OWNER, {
            pointerType: 'touch',
            pointerId
        })) return false;
        this._candidate = {
            active: false,
            suppressed: false,
            pointerType: 'touch',
            pointerId,
            startScreen: {
                x: Number(touch.x),
                y: Number(touch.y)
            },
            currentScreen: {
                x: Number(touch.x),
                y: Number(touch.y)
            },
            anchorWorld: startWorld.clone(),
            anchorOffsetM: clonePoint2(state.offsetM),
            currentOffsetM: clonePoint2(state.offsetM),
            fixedZ,
            axisLocked: false,
            lockYM: Number(state.offsetM.y)
        };
        this._preventTouchDefault(event);
        return true;
    }
    handleTouchMove(event) {
        const candidate = this._candidate;
        if (this._destroyed || candidate?.pointerType !== 'touch') return false;
        this._preventTouchDefault(event);
        const touch = findTouch(event?.touches, candidate.pointerId);
        if (!touch || event.touches.length !== 1) {
            // A missing/replaced id must never reuse another finger's anchor.
            this._finishAtCurrentOffset('touch-contact-changed');
            return true;
        }
        if (!finitePoint2(touch)) return true;
        if (!this._isEligible({
            allowDragging: true
        })) {
            this._finishAtCurrentOffset('mode-or-selection-changed');
            return true;
        }
        candidate.currentScreen = {
            x: Number(touch.x),
            y: Number(touch.y)
        };
        if (!candidate.active) {
            const dx = Number(touch.x) - candidate.startScreen.x;
            const dy = Number(touch.y) - candidate.startScreen.y;
            if (dx * dx + dy * dy < this._thresholdPx * this._thresholdPx) return true;
            try {
                this._service.beginMove();
                candidate.active = true;
                this._ownership.activate(COUNTERTOP_DRAG_GESTURE_OWNER);
            } catch (error) {
                this._reportError('touch-begin', error);
                this._clearGesture({
                    rememberTouch: true
                });
                return false;
            }
        }
        const worldPoint = projectScreenToWorldXY(this._getCamera(), Number(touch.x), Number(touch.y), candidate.fixedZ, this._projectedPoint, this._projectionScratch);
        if (!worldPoint) return true;
        const nextOffsetM = {
            x: candidate.anchorOffsetM.x + (worldPoint.x - candidate.anchorWorld.x),
            y: candidate.anchorOffsetM.y + (worldPoint.y - candidate.anchorWorld.y)
        };
        try {
            const appliedState = this._service.updateMoveM(nextOffsetM);
            this._syncCandidateToAppliedOffset(candidate, worldPoint, nextOffsetM, appliedState?.offsetM);
        } catch (error) {
            this._reportError('touch-update', error);
            this._finishAtCurrentOffset('touch-move-error');
        }
        return true;
    }
    handleTouchEnd(event) {
        const candidate = this._candidate;
        if (candidate?.pointerType !== 'touch') return false;
        this._preventTouchDefault(event);
        if (findTouch(event?.touches, candidate.pointerId)) return true;
        this._finishAtCurrentOffset('touch-end');
        return true;
    }
    handleTouchCancel(event) {
        const candidate = this._candidate;
        if (candidate?.pointerType !== 'touch') return false;
        this._preventTouchDefault(event);
        this.cancel('touch-cancel');
        return true;
    }
    cancel(reason = 'cancelled') {
        if (!this._candidate) return false;
        const wasActive = this._candidate.active;
        const wasTouch = this._candidate.pointerType === 'touch';
        if (wasActive) {
            try {
                this._service?.cancelMove?.();
            } catch (error) {
                this._reportError(reason, error);
            }
        }
        this._clearGesture({
            rememberTouch: wasTouch
        });
        return true;
    }
    destroy() {
        if (this._destroyed) return;
        this._finishAtCurrentOffset('destroy');
        this._destroyed = true;
        this._unsubscribeService?.();
        this._unsubscribeService = null;
        this._app?.mouse?.off?.('mousedown', this.handleMouseDown, this);
        this._app?.mouse?.off?.('mousemove', this.handleMouseMove, this);
        this._app?.mouse?.off?.('mouseup', this.handleMouseUp, this);
        this._app?.touch?.off?.('touchstart', this.handleTouchStart, this);
        this._app?.touch?.off?.('touchmove', this.handleTouchMove, this);
        this._app?.touch?.off?.('touchend', this.handleTouchEnd, this);
        this._app?.touch?.off?.('touchcancel', this.handleTouchCancel, this);
        if (typeof window !== 'undefined') {
            window.removeEventListener('mouseup', this._onWindowMouseUp, true);
            window.removeEventListener('blur', this._onWindowBlur, false);
            window.removeEventListener('keydown', this._onWindowKeyDown, true);
        }
        if (this._app?.countertopInputAdapter === this) this._app.countertopInputAdapter = null;
        if (this._app?.countertopGestureOwnership === this._ownership) {
            this._app.countertopGestureOwnership = null;
        }
        if (this._ownsOwnership) this._ownership?.destroy?.();
        this._binding = null;
        this._service = null;
        this._projectionScratch = null;
        this._projectedPoint = null;
        this._lastHandledTouch = null;
        this._ownership = null;
        this._app = null;
    }
    _isEligible(options = {}) {
        const state = this._service?.getStateM?.();
        const root = this._getCountertopRoot();
        const selection = this._app?.selectTool?.getSelected?.() || [];
        const validInteraction = state?.interactionState === 'editing' || options.allowDragging && state?.interactionState === 'dragging';
        return Boolean(state?.readiness === 'ready' && state.layoutMode === 'drag' && validInteraction && root?.parent && selection.includes(root));
    }
    _getCountertopRoot() {
        return this._binding?.countertop?.root || this._binding?.assembly?.countertop?.root || null;
    }
    _getCamera() {
        return this._app?.selectTool?.cameraEntity?.camera || this._app?.root?.findComponent?.('camera')?.entity?.camera || null;
    }
    _handleServiceChange(state) {
        if (!this._candidate) return;
        if (state?.readiness !== 'ready' || state?.layoutMode !== 'drag' || state?.interactionState !== 'editing' && state?.interactionState !== 'dragging') {
            // Public mode/edit/selection commands finish the service gesture
            // synchronously before emitting their new snapshot.
            this._clearGesture({
                rememberTouch: this._candidate.pointerType === 'touch'
            });
        }
    }
    _syncCandidateToAppliedOffset(candidate, worldPoint, requestedOffsetM, appliedOffsetM) {
        if (!candidate || !finitePoint2(appliedOffsetM)) return;
        const appliedOffset = clonePoint2(appliedOffsetM);
        const requestedOffset = finitePoint2(requestedOffsetM) ? clonePoint2(requestedOffsetM) : appliedOffset;
        if (!samePoint2(appliedOffset, candidate.currentOffsetM) || !samePoint2(appliedOffset, requestedOffset)) {
            candidate.anchorWorld.copy(worldPoint);
            candidate.anchorOffsetM = clonePoint2(appliedOffset);
            candidate.lockYM = appliedOffset.y;
        }
        candidate.currentOffsetM = appliedOffset;
    }
    _finishAtCurrentOffset(reason) {
        if (!this._candidate) return false;
        const wasActive = this._candidate.active;
        const wasTouch = this._candidate.pointerType === 'touch';
        if (wasActive) {
            try {
                this._service?.endMove?.();
            } catch (error) {
                this._reportError(reason, error);
            }
        }
        this._clearGesture({
            rememberTouch: wasTouch
        });
        return true;
    }
    _clearGesture(options = {}) {
        if (options.rememberTouch && this._candidate?.pointerType === 'touch') {
            this._rememberHandledTouch(this._candidate.currentScreen || this._candidate.startScreen);
        }
        this._candidate = null;
        this._ownership?.release?.(COUNTERTOP_DRAG_GESTURE_OWNER);
    }
    _preventTouchDefault(event) {
        const nativeEvent = event?.event;
        if (nativeEvent?.cancelable !== false) nativeEvent?.preventDefault?.();
    }
    _rememberHandledTouch(point) {
        this._lastHandledTouch = finitePoint2(point) ? {
            x: Number(point.x),
            y: Number(point.y),
            at: Date.now()
        } : {
            x: null,
            y: null,
            at: Date.now()
        };
    }
    _shouldSuppressSyntheticMouse(event) {
        const recentTouch = this._lastHandledTouch;
        if (!recentTouch || Date.now() - recentTouch.at > SYNTHETIC_MOUSE_WINDOW_MS) {
            this._lastHandledTouch = null;
            return false;
        }
        const nativeEvent = event?.event || event;
        const knownTouchSource = nativeEvent?.sourceCapabilities?.firesTouchEvents === true || nativeEvent?.pointerType === 'touch';
        if (!knownTouchSource) return false;
        if (!finitePoint2(event) || !finitePoint2(recentTouch)) return true;
        const dx = Number(event.x) - recentTouch.x;
        const dy = Number(event.y) - recentTouch.y;
        return dx * dx + dy * dy <= SYNTHETIC_MOUSE_RADIUS_PX * SYNTHETIC_MOUSE_RADIUS_PX;
    }
    _reportError(stage, error) {
        if (typeof console !== 'undefined' && typeof console.error === 'function') {
            console.error(`[CountertopInputAdapter] ${stage} failed`, error);
        }
    }
    constructor(app, options = {}){
        this._app = app || null;
        this._service = null;
        this._binding = null;
        this._thresholdPx = Number.isFinite(options.thresholdPx) ? Math.max(0, Number(options.thresholdPx)) : DEFAULT_COUNTERTOP_DRAG_THRESHOLD_PX;
        this._ownership = options.ownership || createGestureOwnership(this._app);
        this._ownsOwnership = !options.ownership;
        this._projectionScratch = {
            near: new Vec3(),
            far: new Vec3()
        };
        this._projectedPoint = new Vec3();
        this._candidate = null;
        this._lastHandledTouch = null;
        this._unsubscribeService = null;
        this._destroyed = false;
        this._onWindowMouseUp = (event)=>this.handleMouseUp(event);
        this._onWindowBlur = ()=>this.cancel('window-blur');
        this._onWindowKeyDown = (event)=>{
            if (event?.key === 'Escape') this.cancel('escape');
        };
        this._app?.mouse?.on?.('mousedown', this.handleMouseDown, this);
        this._app?.mouse?.on?.('mousemove', this.handleMouseMove, this);
        this._app?.mouse?.on?.('mouseup', this.handleMouseUp, this);
        this._app?.touch?.on?.('touchstart', this.handleTouchStart, this);
        this._app?.touch?.on?.('touchmove', this.handleTouchMove, this);
        this._app?.touch?.on?.('touchend', this.handleTouchEnd, this);
        this._app?.touch?.on?.('touchcancel', this.handleTouchCancel, this);
        if (typeof window !== 'undefined') {
            window.addEventListener('mouseup', this._onWindowMouseUp, true);
            window.addEventListener('blur', this._onWindowBlur, false);
            window.addEventListener('keydown', this._onWindowKeyDown, true);
        }
        if (this._app) {
            this._app.countertopGestureOwnership = this._ownership;
            this._app.countertopInputAdapter = this;
        }
        this.bind(options);
    }
}
function createCountertopInputAdapter(app, options) {
    return new CountertopInputAdapter(app, options);
}

export { CountertopInputAdapter, DEFAULT_COUNTERTOP_DRAG_THRESHOLD_PX, createCountertopInputAdapter, projectScreenToWorldXY };
