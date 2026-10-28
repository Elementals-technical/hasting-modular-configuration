const freezeSnapshot = reservation => Object.freeze({
    owner: reservation?.owner || null,
    phase: reservation?.phase || 'idle',
    pointerType: reservation?.pointerType || null,
    pointerId: reservation?.pointerId ?? null
});

/**
 * App-scoped gate shared by the spatial-manipulation input router, camera and selection.
 * It intentionally owns no listeners and models only one reserved gesture.
 */
export class GestureOwnership {
    constructor(app = null) {
        this._app = app;
        this._reservation = null;
        this._destroyed = false;
    }

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
        if (!this._reservation || (owner && this._reservation.owner !== owner)) return false;
        this._reservation = null;
        this._notify();
        return true;
    }

    isOwnedBy(owner) {
        return Boolean(this._reservation && this._reservation.owner === owner);
    }

    /** Match repeated callbacks for the same physical pointer only. */
    matches(owner, details = {}) {
        if (!this._reservation || this._reservation.owner !== owner) return false;
        if (details.pointerType != null &&
            this._reservation.pointerType !== details.pointerType) return false;
        if (details.pointerId != null &&
            this._reservation.pointerId !== details.pointerId) return false;
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
        this._app?.fire?.('spatial:gesture-ownership-change', this.getSnapshot());
    }
}

export function createGestureOwnership(app) {
    return new GestureOwnership(app);
}

/**
 * Owner id prefix of a spatial-manipulation instance drag. The generic PlayCanvas
 * input router reserves the same app-scoped gate with `spatial-manipulation:<instanceId>`,
 * so the camera and selection gates block while any manipulation owner holds it (spec AC-23).
 */
export const SPATIAL_MANIPULATION_GESTURE_OWNER_PREFIX = 'spatial-manipulation:';

export function createSpatialManipulationGestureOwner(instanceId) {
    if (typeof instanceId !== 'string' || instanceId.length === 0) {
        throw new TypeError('createSpatialManipulationGestureOwner requires a non-empty instanceId');
    }
    return `${SPATIAL_MANIPULATION_GESTURE_OWNER_PREFIX}${instanceId}`;
}

export function isSpatialManipulationGestureOwner(owner) {
    return typeof owner === 'string' &&
        owner.length > SPATIAL_MANIPULATION_GESTURE_OWNER_PREFIX.length &&
        owner.startsWith(SPATIAL_MANIPULATION_GESTURE_OWNER_PREFIX);
}

/**
 * Owner-keyed acquire over a `GestureOwnership`-compatible gate: reserves the candidate
 * phase for `owner` (idempotent for the same physical pointer) and activates it when
 * `details.active` is true. Returns false when another owner holds the gate.
 */
export function acquireGestureOwnership(ownership, owner, details = {}) {
    if (!ownership || !owner) return false;
    const { active = false, ...pointer } = details || {};
    if (!ownership.reserve(owner, pointer)) return false;
    return active ? ownership.activate(owner) !== false : true;
}

/** Owner-keyed release: only the reservation held by `owner` is cleared. */
export function releaseGestureOwnership(ownership, owner) {
    if (!ownership || !owner) return false;
    return Boolean(ownership.release(owner));
}
