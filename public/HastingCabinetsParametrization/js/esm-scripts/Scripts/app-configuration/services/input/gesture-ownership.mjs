const COUNTERTOP_DRAG_GESTURE_OWNER = 'countertop-drag';
const freezeSnapshot = (reservation)=>Object.freeze({
        owner: reservation?.owner || null,
        phase: reservation?.phase || 'idle',
        pointerType: reservation?.pointerType || null,
        pointerId: reservation?.pointerId ?? null
    });
/**
 * App-scoped gate shared by the countertop recognizer, camera and selection.
 * It intentionally owns no listeners and models only one reserved gesture.
 */ class GestureOwnership {
    getSnapshot() {
        return freezeSnapshot(this._reservation);
    }
    reserve(owner, details = {}) {
        if (this._destroyed || !owner) return false;
        if (this._reservation) return this.matches(owner, details);
        this._reservation = {
            owner,
            phase: 'candidate',
            pointerType: details.pointerType || null,
            pointerId: details.pointerId ?? null
        };
        this._notify();
        return true;
    }
    activate(owner) {
        if (this._destroyed || this._reservation?.owner !== owner) return false;
        if (this._reservation.phase === 'active') return true;
        this._reservation.phase = 'active';
        this._notify();
        return true;
    }
    release(owner) {
        if (!this._reservation || owner && this._reservation.owner !== owner) return false;
        this._reservation = null;
        this._notify();
        return true;
    }
    isOwnedBy(owner) {
        return Boolean(this._reservation && this._reservation.owner === owner);
    }
    /** Match repeated callbacks for the same physical pointer only. */ matches(owner, details = {}) {
        if (!this._reservation || this._reservation.owner !== owner) return false;
        if (details.pointerType != null && this._reservation.pointerType !== details.pointerType) return false;
        if (details.pointerId != null && this._reservation.pointerId !== details.pointerId) return false;
        return true;
    }
    blocksCamera() {
        return Boolean(this._reservation);
    }
    blocksSelection() {
        return Boolean(this._reservation);
    }
    destroy() {
        if (this._destroyed) return;
        this.release();
        this._destroyed = true;
        this._app = null;
    }
    _notify() {
        this._app?.fire?.('countertop:gesture-ownership-change', this.getSnapshot());
    }
    constructor(app = null){
        this._app = app;
        this._reservation = null;
        this._destroyed = false;
    }
}
function createGestureOwnership(app) {
    return new GestureOwnership(app);
}

export { COUNTERTOP_DRAG_GESTURE_OWNER, GestureOwnership, createGestureOwnership };
