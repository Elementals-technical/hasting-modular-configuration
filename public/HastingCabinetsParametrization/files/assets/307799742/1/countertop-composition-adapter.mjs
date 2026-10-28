import { LoggerService } from '../../../services/logger/logger-service.mjs';
import { describeTandemCountertops } from '../tandem/tandem-countertops.mjs';
import {
    COUNTERTOP_ATTACHED_EPSILON_M,
    COUNTERTOP_INTRINSIC_LENGTH_M,
    isCountertopAttached,
    resolveCountertopLengthM
} from '../countertop-layout-policy.mjs';
import { resolveCountertopAssembly } from '../spatial/countertop-assembly-resolver.mjs';
import { selectCountertopSupportGroup } from '../countertop-support-resolver.mjs';
import {
    COUNTERTOP_GEOMETRY_RESULT_STATUS,
    createCountertopGeometryAdapter
} from './countertop-geometry-adapter.mjs';
import { createCountertopEditOverlay } from './countertop-edit-overlay.mjs';
import {
    createCountertopDimensionAdapter,
    measureCountertopMeshBoundsM
} from './countertop-dimension-adapter.mjs';
import { CountertopSpatial } from '../spatial/countertop-spatial.mjs';
import {
    clampCountertopLengthM,
    COUNTERTOP_OVERLAY_REASON,
    measureCutoutExtentXM,
    normalizeCountertopLengthLimits,
    resolveBasinMinLengthM,
    resolveCountertopLengthLimitsM
} from '../countertop-length-limits.mjs';
import { basinEdgeMarginM, resolveResizeBoundsM } from '../countertop-resize-bounds.mjs';
import { measureEntityBoundsM } from '../../spatial-manipulation/playcanvas/scene-measure.mjs';
import { boxInfo, isSinkLogEnabled, logSinkSnapshot, positionOf } from '../debug/countertop-sink-log.mjs';
import { CollisionOutline } from '../../composition/spatial/collision-outline.mjs';
import { readSpatialOffsetM, SPATIAL_OFFSET_KEY } from '../../composition/spatial/composition-spatial.mjs';
import { ProductRegistry_V2 } from '../../product/registry/product-registry-v2.mjs';
import { roleOfType } from '../../cabinet-placement/modular-collections.mjs';
import {
    COUNTERTOP_CHANGE_REASON,
    COUNTERTOP_ERROR_CODE,
    COUNTERTOP_INTERACTION_STATE,
    COUNTERTOP_MOTION_STATE,
    COUNTERTOP_PLACEMENT_STATE,
    COUNTERTOP_READINESS
} from '../countertop-contract.mjs';

export const COUNTERTOP_LENGTH_KEY = 'CountertopLengthM';
/** A top within 1 cm of its standard height rests on the cabinets (the sink stays there): pointer jitter is not a lift. */
export const COUNTERTOP_REST_TOLERANCE_M = 0.01;
/** Sink X (m) relative to its sink point + offset.x while a lifted top carries it (null otherwise). */
export const COUNTERTOP_SINK_SHIFT_KEY = 'CountertopSinkShiftM';
const SINK_LANDING_NONE = Object.freeze({ status: 'none', cabinetId: null, fromCabinetId: null, reason: null, snapDxM: 0 });
/** A side cabinet takes a landing sink when its top is at most 5 mm above / 2 cm below where the sink's top rests (HR-CT-01). */
const SINK_LANDING_LEVEL_ABOVE_M = 0.005;
const SINK_LANDING_LEVEL_BELOW_M = 0.02;
const isSinkLandingLevel = levelDy => !(levelDy > SINK_LANDING_LEVEL_ABOVE_M || levelDy < -SINK_LANDING_LEVEL_BELOW_M);
const countertopError = (code, message) => Object.assign(new Error(message), { code });
const finitePositiveOrNull = value => {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : null;
};

const readSnapshotValue = (snapshot, key) => (
    typeof snapshot?.get === 'function' ? snapshot.get(key) : snapshot?.[key]
);

const hasSnapshotKey = (snapshot, key) => (
    typeof snapshot?.has === 'function'
        ? snapshot.has(key)
        : Boolean(snapshot && Object.prototype.hasOwnProperty.call(snapshot, key))
);

const sameNumber = (left, right) => Object.is(Number(left), Number(right));

/**
 * World point → the entity's local frame as a world-position difference: the ULH countertop root carries no rotation
 * or scale (and the node stubs have no Mat4 inverse), so the translation-only frame is exact for it.
 */
const toLocalPointM = (entity, world) => {
    const origin = entity?.getPosition?.() ?? { x: 0, y: 0, z: 0 };
    return { x: world.x - Number(origin.x), y: world.y - Number(origin.y), z: world.z - Number(origin.z) };
};

/** World − local translation of an entity (its parent's world position; 0 when unknown). */
const parentShiftOf = entity => {
    const world = entity?.getPosition?.(), local = entity?.getLocalPosition?.();
    const shift = axis => {
        const value = Number(world?.[axis]) - Number(local?.[axis]);
        return Number.isFinite(value) ? value : 0;
    };
    return { x: shift('x'), y: shift('y') };
};

const roundedTransformValue = value => (
    Number.isFinite(Number(value)) ? Number(Number(value).toFixed(7)) : null
);

const readVector = value => value ? [
    roundedTransformValue(value.x),
    roundedTransformValue(value.y),
    roundedTransformValue(value.z)
] : [null, null, null];

const createRelativeCutterSignature = (assembly, cutters) => {
    const targetPosition = assembly?.countertop?.mesh?.getPosition?.() ||
        assembly?.countertop?.root?.getPosition?.() || null;

    return JSON.stringify((assembly?.cutters || [])
        .filter(binding => cutters.includes(binding.mesh))
        .map(binding => {
            const entity = binding.mesh;
            const position = entity?.getPosition?.();
            const rotation = entity?.getRotation?.();
            const scale = entity?.getScale?.();
            return {
                cabinetId: binding.cabinetId ?? null,
                sinkId: binding.sinkId ?? null,
                source: binding.source,
                name: entity?.name || null,
                relativePosition: [
                    roundedTransformValue(Number(position?.x) - Number(targetPosition?.x)),
                    roundedTransformValue(Number(position?.y) - Number(targetPosition?.y)),
                    roundedTransformValue(Number(position?.z) - Number(targetPosition?.z))
                ],
                rotation: rotation ? [
                    roundedTransformValue(rotation.x),
                    roundedTransformValue(rotation.y),
                    roundedTransformValue(rotation.z),
                    roundedTransformValue(rotation.w)
                ] : [null, null, null, null],
                scale: readVector(scale)
            };
        }));
};

/**
 * The countertop of the active composition — on the same model as the composition modules.
 *
 * - Product data lives on the countertop's snapshot: `SpatialOffsetM` (offset from the standard
 *   layout position, m) and `CountertopLengthM` (custom length, m). The composition saves and
 *   restores them; there is no separate countertop state.
 * - Sink owner: resting = on the cabinets (|offset.y| <= 1 cm and over a cabinet, `_isResting`): the sink
 *   stays at its cabinet's sink point; a lifted top picks it up (`CountertopSinkShiftM`, see `_placeSinks`). The sink
 *   never leaves the top; it goes home only when exactly at home; 'home'/'fits' pending snap the whole top on release.
 * - Length rule: attached to the composition (no offset) → the composition's length
 *   (`RuleCountertopLayout`); moved off it → a custom length may be set (`setLengthM`).
 *   Moving back onto the composition drops the custom length.
 * - Modular (free-layout, `compositionManager.preserveCabinetPositions`) compositions: a moved
 *   countertop is "remote" — detaching freezes its current length into `CountertopLengthM`, and
 *   when the standard base moves (cabinets resized/removed/moved) its offset is re-expressed
 *   against the new base so its WORLD pose stays fixed. The snapshot's `positionX/positionY`
 *   keep the standard world position that offset is measured from (the export format), so the
 *   pose also survives a full re-import. Legacy compositions are unchanged.
 * - Movement: `countertop/spatial/` (World registration, drag, snapping, collision observe).
 * - Presentation: collision outline (shared with the modules), edit-size overlay (only when a
 *   resize is allowed), dimension lines.
 *
 * Events (`on`): 'change' (public state), 'action' ({ type: 'edit-size', state } | { type: 'sink-landing', landing }
 * | { type: 'sink-lift', fromCabinetId, sinkLocalM }).
 * Sinks come only from the resolver's `assembly.sinks` (one entry per sink anchor, `host.kind` 'cabinet' | 'countertop').
 * Hosted sink (rule HR-CT-02, countertop-hosted-sink.mjs): a top with a `host.kind === 'countertop'` entry owns it at
 * any height; a lifted top that carries an SB's sink announces 'sink-lift' once. Only `_placeSinks` and `_sinkLanding`
 * switch on `host.kind`; everything else is host-agnostic (`cabinetHost`, `_sinkShiftToWrite`).
 */
export class CountertopCompositionAdapter {
    constructor(app, compositionManager) {
        this._app = app || null;
        this._compositionManager = compositionManager || null;
        this._geometry = null;
        this._assemblyBinding = null;
        this._spatial = new CountertopSpatial({
            spatial: this._compositionManager?.spatial ?? null,
            whenGeometrySettled: () => this._whenAllGeometrySettled(),
            onChange: reason => {
                // A resting top's hole stays with the sink on the cabinet: drag the top whole, re-cut on release.
                // ('drag' too: a lifted top lowered onto the cabinets mid-gesture leaves its sink at home).
                if ((reason === 'drag-start' || reason === 'drag') && !this._uncutForDrag && this._sinkOwner === 'cabinet'
                    && this._assemblyBinding?.cutters?.length && this._cutoutEntities) {
                    this._uncutForDrag = this._countertopMesh?.script?.meshBoolean?.restoreSourceMesh?.('countertop-drag') === true;
                } else if (reason === 'drag-end' && this._uncutForDrag) {
                    this._uncutForDrag = false;
                    this._refreshSinkCutouts('countertop-drag-end', { anyOwner: true, forceRebuild: true });
                }
                if (reason === 'drag-start') this._standardLanding = false; // a drag is not Standard (see resetOffset)
                if (reason === 'drag-end') { this._snapLanding(); this._announceSinkLift(); }
                this._emitChange(reason);
            },
            onError: error => this._reportOperationError(error)
        });
        this._listeners = new Map([['change', new Set()], ['action', new Set()]]);
        this._collisionOutline = new CollisionOutline({ app: this._app, owner: 'spatial-countertop' });
        this._binding = null;
        this._composition = null;
        this._compositionId = null;
        this._productId = null;
        this._countertopRoot = null;
        this._countertopMesh = null;
        this._basePositionM = null;
        this._appliedLengthM = null;
        this._lengthLimitsM = normalizeCountertopLengthLimits(null);
        this._editOverlay = null;
        this._dimensionAdapter = createCountertopDimensionAdapter(this._app);
        this._selectionListenerBound = false;
        this._onSelectionChanged = () => this._emitChange(COUNTERTOP_CHANGE_REASON.SELECTION);
        this._sinkLogKey = null;
        // Debug (countertop-sink-log.mjs, on with ?debug=true / ?sinkLog=1): `countertopSinkDump()` prints the snapshot.
        if (isSinkLogEnabled()) {
            this._sinkDump = () => logSinkSnapshot('dump', this._sinkLogSnapshot(this._sinkOwner), { force: true });
            globalThis.countertopSinkDump = this._sinkDump;
        }
        this._onSelectToolReady = () => this._editOverlay?.sync();
        this._lengthOperation = null;
        this._booleanOperation = null;
        this._refreshOperation = null;
        this._coverOperation = null;
        this._poseOperation = null;
        this._relativeCutterSignature = null;
        this._cutoutEntities = null;
        this._sinkOwner = null;
        this._uncutForDrag = false;
        this._sinkShiftM = 0;
        this._sinkLandingAt = SINK_LANDING_NONE;
        this._landingPending = null;
        this._standardLanding = false;
        this._verticalLocked = false;
        this._generation = 0;
        this._destroyed = false;
    }

    get binding() {
        return this._binding;
    }

    get editOverlay() {
        return this._editOverlay;
    }

    get dimensionAdapter() {
        return this._dimensionAdapter;
    }

    /** Countertop root / mesh entities (null while unbound): the drag overlay draws on them. */
    get countertopRoot() {
        return this._binding ? this._countertopRoot : null;
    }

    get countertopMesh() {
        return this._binding ? this._countertopMesh : null;
    }

    /** The countertop's spatial-manipulation handle (null until registered). */
    get manipulable() {
        return this._spatial.handle;
    }

    suspendLegacy({ adoptTopId = null } = {}) {
        const adopting = typeof adoptTopId === 'string' && adoptTopId.length > 0;
        if (this._destroyed || this._legacySuspended || this._legacyRetired ||
            (adopting ? (!this._binding || this._productId !== adoptTopId ||
                this._countertopRoot?.name !== adoptTopId || this._spatial.dragging || !this._spatial.handle)
                : (this._binding || this._spatial.handle || this._selectionListenerBound)) ||
            this._lengthOperation || this._booleanOperation || this._refreshOperation || this._coverOperation ||
            this._poseOperation) {
            throw Object.assign(new Error('Countertop writer is active'), {code:'LEGACY_WRITERS_BUSY'});
        }
        this._legacySuspended = true;
        try { if (adopting) this._teardownCountertopPresentation(); }
        catch (error) {
            this._legacySuspended = false;
            if (adopting) this._bindCountertopPresentation(this._assemblyBinding);
            throw error;
        }
        let resumeSpatial;
        try { resumeSpatial = this._spatial.suspendLegacy(adopting ? {adoptTopId} : undefined); }
        catch (error) {
            this._legacySuspended = false;
            if (adopting) this._bindCountertopPresentation(this._assemblyBinding);
            throw error;
        }
        let resumeDimension;
        try { resumeDimension = this._dimensionAdapter.suspendLegacy(); }
        catch (error) {
            try { resumeSpatial(); }
            catch (restoreError) {
                this._legacyRecoveryResume = resumeSpatial;
                throw Object.assign(new AggregateError([error, restoreError], 'Countertop handoff rollback failed'),
                    {code:'LEGACY_HANDOFF_RECOVERY_REQUIRED'});
            }
            this._legacySuspended = false;
            if (adopting) this._bindCountertopPresentation(this._assemblyBinding);
            throw error;
        }
        let resumed = false;
        let dimensionResumed = false;
        let spatialResumed = false;
        return () => {
            if (resumed) return;
            if (!dimensionResumed) { resumeDimension(); dimensionResumed = true; }
            if (!spatialResumed) { resumeSpatial(); spatialResumed = true; }
            this._legacySuspended = false;
            if (adopting) this._bindCountertopPresentation(this._assemblyBinding);
            resumed = true;
        };
    }

    /** Retire dormant legacy subscriptions after the modular transaction owns the top. */
    async retireLegacyAdoption(adoptTopId) {
        if (!this._legacySuspended || !this._binding || this._productId !== adoptTopId ||
            this._countertopRoot?.name !== adoptTopId) {
            throw Object.assign(new Error('Countertop adoption is not suspended'), {code:'LEGACY_HANDOFF_UNSUPPORTED'});
        }
        this._generation++;
        await this._spatial.release({propagateError:true});
        this._geometry?.retireWithoutMutation();
        this._geometry = null;
        this._assemblyBinding = null;
        this._basePositionM = null;
        this._binding = null;
        this._composition = null;
        this._compositionId = null;
        this._productId = null;
        this._countertopRoot = null;
        this._countertopMesh = null;
        this._appliedLengthM = null;
        this._relativeCutterSignature = null;
        this._cutoutEntities = null;
        this._sinkOwner = null;
        this._sinkShiftM = 0;
        this._dimensionAdapter?.destroy();
        this._dimensionAdapter = null;
        this._spatial.destroy();
        this._legacySuspended = false;
        this._legacyRetired = true;
    }

    // ---------------------------------------------------------------------------------------------
    // Public state and commands (ConfiguratorAPI.countertop)
    // ---------------------------------------------------------------------------------------------

    /** Public countertop state, metres. */
    getState() {
        const ready = Boolean(this._binding && this._productId && !this._legacySuspended && !this._legacyRetired);
        const snapshot = this._snapshot();
        const offset = ready ? this._spatial.getOffsetM() : { x: 0, y: 0 };
        const attached = isCountertopAttached(offset);
        const moved = ready && !attached;
        const selected = this._isSelected();
        const dragging = this._spatial.dragging;
        const customLength = attached ? null : finitePositiveOrNull(readSnapshotValue(snapshot, COUNTERTOP_LENGTH_KEY));
        return Object.freeze({
            unit: 'm',
            readiness: ready ? COUNTERTOP_READINESS.READY : COUNTERTOP_READINESS.WAITING,
            compositionId: this._compositionId ?? this._activeCompositionId(),
            productId: this._productId,
            selected,
            moved,
            moving: dragging,
            dragging,
            dragEnabled: this._spatial.dragEnabled,
            placementState: !ready ? COUNTERTOP_PLACEMENT_STATE.WAITING : attached ? COUNTERTOP_PLACEMENT_STATE.ATTACHED : COUNTERTOP_PLACEMENT_STATE.MOVED,
            motionState: dragging ? COUNTERTOP_MOTION_STATE.MOVING : COUNTERTOP_MOTION_STATE.IDLE,
            interactionState: dragging ? COUNTERTOP_INTERACTION_STATE.DRAGGING : selected ? COUNTERTOP_INTERACTION_STATE.SELECTED : COUNTERTOP_INTERACTION_STATE.IDLE,
            attached,
            canResize: ready && !attached,
            offset: Object.freeze({ ...offset }),
            size: Object.freeze({
                length: ready ? this._appliedLengthM : null,
                depth: this._binding?.sizeM?.depth ?? null
            }),
            autoLength: this._binding?.baseLengthM ?? null,
            customLength,
            thickness: this._binding?.thicknessM ?? null,
            lengthLimitsM: this.getLengthLimitsM(),
            resizeBoundsM: ready ? this._resizeBoundsM() : null,
            collision: Object.freeze(ready ? this._spatial.getCollision() : { status: 'unknown', collidesWith: [] }),
            traps: Object.freeze(ready ? readSinkTraps(this._assemblyBinding, this._landingPending?.cabinetId) : []),
            sink: Object.freeze({ owner: this._sinkOwner, shiftM: this._sinkShiftM, landing: this._sinkLandingAt,
                pending: this._landingPending ? Object.freeze({ ...this._landingPending }) : null,
                hosted: Boolean(this._binding) && this._isHostedSink() }),
            verticalLocked: this._verticalLocked,
            // A saved (restored) lifted pose is kept, never rejected; the lock only reports it.
            verticalLockViolated: this._verticalLocked && offset.y > COUNTERTOP_REST_TOLERANCE_M,
            validation: Object.freeze(this._poseValidation(ready, attached)),
            // Clones of a thin top on sink bases set apart (tandem vanities): priced as countertops of their length.
            tandemTops: Object.freeze(this._tandemTops())
        });
    }

    /** countertop/tandem/tandem-countertops.mjs describeTandemCountertops on the bound composition. */
    _tandemTops() {
        try {
            const writer = this._compositionManager?.tandemCountertopWriter;
            return describeTandemCountertops(this._composition?.getAllProducts?.() ?? {}, id => writer?.lengthOf?.(id) ?? null);
        } catch { return []; }
    }

    /** `() => { valid: boolean|null, reasons, warnings }` (the drag overlay's `dragGuard.evaluate`): API moves honour it. */
    setPoseValidator(validator) {
        this._poseValidator = typeof validator === 'function' ? validator : null;
    }

    /** `{ status: 'valid'|'invalid'|'unknown', reasons, warnings }` of the current pose (attached = valid). */
    _poseValidation(ready, attached) {
        const none = { status: 'unknown', reasons: [], warnings: [] };
        if (!ready || typeof this._poseValidator !== 'function' || this._validatingPose) return none;
        if (attached) return { ...none, status: 'valid' };
        // One evaluation per pose (the overlay measures the scene): getState is asked many times per step.
        const offset = this._spatial.getOffsetM();
        const key = `${this._generation}|${offset.x}|${offset.y}|${this._appliedLengthM}|${this._sinkOwner}|${this._landingPending?.cabinetId ?? ''}`;
        if (this._validationMemo?.key === key && this._validationMemo.validator === this._poseValidator) return this._validationMemo.value;
        let result = null;
        this._validatingPose = true; // the validator reads getState()
        try { result = this._poseValidator(); } catch { result = null; } finally { this._validatingPose = false; }
        const status = result?.valid === true ? 'valid' : result?.valid === false ? 'invalid' : 'unknown';
        const value = { status, reasons: [...(result?.reasons ?? [])], warnings: [...(result?.warnings ?? [])] };
        this._validationMemo = { key, validator: this._poseValidator, value };
        return value;
    }

    /** API move guard: an invalid pose throws POSE_INVALID after `revert` put the previous pose back. */
    async _rejectInvalidPose(rejected, revert) {
        const validation = this._poseValidation(true, isCountertopAttached(this._spatial.getOffsetM()));
        if (validation.status !== 'invalid') return;
        await revert();
        throw Object.assign(countertopError(COUNTERTOP_ERROR_CODE.POSE_INVALID,
            `The countertop pose is invalid: ${validation.reasons.join(', ')}`), { reasons: validation.reasons, rejected });
    }

    /** Drag-end guard (the drag overlay's trap predicate): `false` at release snaps the top back to its last valid pose. */
    setDragGuard(guard) {
        this._spatial.setDragGuard(guard);
    }

    on(event, callback) {
        const listeners = this._listeners.get(event);
        if (!listeners) throw countertopError(COUNTERTOP_ERROR_CODE.INVALID_INPUT, 'event must be "change" or "action"');
        if (typeof callback !== 'function') throw countertopError(COUNTERTOP_ERROR_CODE.INVALID_INPUT, 'callback must be a function');
        listeners.add(callback);
        return () => listeners.delete(callback);
    }

    off(event, callback) {
        const listeners = this._listeners.get(event);
        if (!listeners) return;
        if (callback === undefined) listeners.clear();
        else listeners.delete(callback);
    }

    get dragEnabled() {
        return this._spatial.dragEnabled;
    }

    /** Let the selected countertop be dragged with the pointer. */
    setDragEnabled(enabled) {
        if (this._legacySuspended || this._legacyRetired) throw Object.assign(new Error('Countertop writer is suspended'), {code:'LEGACY_WRITERS_BUSY'});
        if (enabled) this._composition?.assertMutable?.();
        return this._spatial.setDragEnabled(enabled);
    }

    /**
     * Offset-only mode (e.g. 4″ tops): no lift — `setOffsetM` with y above the rest tolerance throws
     * VERTICAL_LOCKED and the drag keeps v. A UI mode: kept across rebinds of this adapter.
     */
    setVerticalLocked(locked) {
        this._verticalLocked = locked === true;
        this._spatial.setVerticalLocked(this._verticalLocked);
        this._emitChange(COUNTERTOP_CHANGE_REASON.VERTICAL_LOCK);
        return this.getState();
    }

    /** Move to an offset (m) from the standard position; `{ x: 0, y: 0 }` re-attaches it. */
    setOffsetM(offsetM, options) {
        return this._writeOffsetM(offsetM, options);
    }

    /**
     * Standard (UI Position ▸ Standard, the client's Reposition ▸ Standard): the standard pose, the custom length dropped,
     * and the sink back in a sink base:
     * - a carried SB sink goes home with the top (owner 'cabinet'), so the top really ends on its standard pose
     *   (it used to stop at x = −shift: `_snapHome` moved the whole top to bring the sink home);
     * - a hosted sink pends 'fits' over the side cabinet under the standard top that holds its cut-out, else the one
     *   nearest to it (`_standardSinkBase`); the UI commits it (`cabinets.landSink`) as after any API lowering.
     */
    resetOffset() {
        return this._writeOffsetM({ x: 0, y: 0 }, { constraint: 'bypass' }, { standard: true });
    }

    async _writeOffsetM(offsetM, { constraint = 'respect', validation = 'guard' } = {}, { standard = false } = {}) {
        if (this._legacySuspended || this._legacyRetired) throw Object.assign(new Error('Countertop writer is suspended'), {code:'LEGACY_WRITERS_BUSY'});
        this._composition?.assertMutable?.();
        this._requireReady();
        // Only a lift is refused: a restored lifted top (verticalLockViolated) may still move along X / come down.
        if (this._verticalLocked && Number(offsetM?.y) > Math.max(COUNTERTOP_REST_TOLERANCE_M, this._spatial.getOffsetM().y + 1e-6)) {
            throw countertopError(COUNTERTOP_ERROR_CODE.VERTICAL_LOCKED, 'The countertop is locked to the cabinets (offset only, no lift)');
        }
        if (validation !== 'guard' && validation !== 'skip') throw countertopError(COUNTERTOP_ERROR_CODE.INVALID_INPUT, 'validation must be "guard" or "skip"');
        const back = this._spatial.getOffsetM(), backSink = { owner: this._sinkOwner, shiftM: this._sinkShiftM };
        const backStandard = this._standardLanding;
        this._standardLanding = standard;
        if (standard && this._sinkOwner === 'countertop' && !this._isHostedSink()) { this._sinkOwner = 'cabinet'; this._sinkShiftM = 0; }
        let applied;
        try {
            applied = await this._spatial.setOffsetM(offsetM, { constraint });
        } catch (error) {
            // Refused before the top moved (not registered, busy): the sink state stays as it was.
            this._sinkOwner = backSink.owner; this._sinkShiftM = backSink.shiftM; this._standardLanding = backStandard;
            throw error;
        }
        // Like the drag snap back: nothing was persisted yet, so the sink state then the offset go back.
        if (validation === 'guard') await this._rejectInvalidPose({ offset: { ...applied }, length: this._appliedLengthM }, async () => {
            this._sinkOwner = backSink.owner; this._sinkShiftM = backSink.shiftM; this._standardLanding = backStandard;
            await this._spatial.setOffsetM(back, { constraint: 'bypass' });
        });
        this._commitOffset(applied);
        await this.whenSettled();
        // An API write never leaves a resting top with its carried sink pending 'home' (the snap re-enters guarded).
        if (!this._landingSnapping) await this._snapHome();
        this._announceSinkLift();
        return this.getState();
    }

    /**
     * Custom length (m) of a moved countertop; `null` goes back to the composition's length.
     * An attached countertop always has the composition's length.
     */
    async setLengthM(lengthM) {
        if (this._legacySuspended || this._legacyRetired) throw Object.assign(new Error('Countertop writer is suspended'), {code:'LEGACY_WRITERS_BUSY'});
        this._composition?.assertMutable?.();
        this._requireReady();
        if (lengthM !== null && !(typeof lengthM === 'number' && Number.isFinite(lengthM) && lengthM > 0)) {
            throw countertopError(COUNTERTOP_ERROR_CODE.INVALID_INPUT, 'length must be null or a positive number of metres');
        }
        if (lengthM !== null && isCountertopAttached(this._spatial.getOffsetM())) {
            throw countertopError(COUNTERTOP_ERROR_CODE.ATTACHED,
                'The countertop is attached to the composition and follows its length; move it off the composition to resize it');
        }
        // Clamp to the effective limits. SmartStretch resizes symmetrically about the mesh centre
        // and the offset is untouched, so the top's centre stays fixed (both ends move equally).
        if (lengthM !== null) lengthM = clampCountertopLengthM(lengthM, this.getLengthLimitsM());
        this._writeSnapshot({ [COUNTERTOP_LENGTH_KEY]: lengthM });
        this._syncLength('countertop-length-changing');
        this._notifyCoverSourceChanged({ [COUNTERTOP_LENGTH_KEY]: lengthM });
        await this.whenSettled();
        this._emitChange(COUNTERTOP_CHANGE_REASON.LENGTH);
        return this.getState();
    }

    /**
     * Resize a moved countertop from one end (`'left'` = −X, `'right'` = +X) while the opposite
     * end stays fixed in world X: the length is clamped to that side's bounds (`_resizeBoundsM`:
     * material limits, basin edge ≥ 10 cm from the moving end, the resting sink base covered) and the centre
     * (offset) shifts by half the change, so SmartStretch's symmetric stretch leaves that end put.
     * Collision does not block it (the overlay shows red). One snapshot write (offset + length).
     * The mesh is re-cut at once (`_syncLength` `immediate`), so the shifted centre and the new
     * length render in the same frame.
     */
    async resizeFromM(side, lengthM, { validation = 'guard' } = {}) {
        if (this._legacySuspended || this._legacyRetired) throw Object.assign(new Error('Countertop writer is suspended'), {code:'LEGACY_WRITERS_BUSY'});
        this._composition?.assertMutable?.();
        this._requireReady();
        if (side !== 'left' && side !== 'right') {
            throw countertopError(COUNTERTOP_ERROR_CODE.INVALID_INPUT, 'side must be "left" or "right"');
        }
        if (!(typeof lengthM === 'number' && Number.isFinite(lengthM) && lengthM > 0)) {
            throw countertopError(COUNTERTOP_ERROR_CODE.INVALID_INPUT, 'length must be a positive number of metres');
        }
        // HR-CT-04: an attached (standard) top may be resized from its ends too; it then holds its own
        // length (moved a hair off the standard pose below) until `setLengthM(null)` / reset.
        const offset = this._spatial.getOffsetM();
        if (validation !== 'guard' && validation !== 'skip') throw countertopError(COUNTERTOP_ERROR_CODE.INVALID_INPUT, 'validation must be "guard" or "skip"');
        const nextLengthM = clampCountertopLengthM(lengthM, this._resizeBoundsM()?.[side] ?? this.getLengthLimitsM());
        const backSink = { owner: this._sinkOwner, shiftM: this._sinkShiftM }, backSnapshot = this._snapshot();
        this._standardLanding = false;
        const backLengthM = readSnapshotValue(backSnapshot, COUNTERTOP_LENGTH_KEY) ?? null;
        const currentLengthM = finitePositiveOrNull(this._appliedLengthM)
            ?? finitePositiveOrNull(this.getState().size.length)
            ?? nextLengthM;
        if (isCountertopAttached(offset) && sameNumber(nextLengthM, currentLengthM)) return this.getState();
        const halfDeltaM = (nextLengthM - currentLengthM) / 2;
        const target = { x: offset.x + (side === 'right' ? halfDeltaM : -halfDeltaM), y: offset.y };
        // Landing exactly on the standard position would re-attach it (and drop the length):
        // stay a hair (sub-micron) off it instead.
        if (isCountertopAttached(target)) target.x = (side === 'right' ? 2 : -2) * COUNTERTOP_ATTACHED_EPSILON_M;
        // A lifted top carries its sink, but a one-end resize leaves the sink where it is in the world.
        const sinkShiftM = this._sinkShiftM;
        if (this._sinkOwner === 'countertop') this._sinkShiftM -= target.x - offset.x;
        let applied;
        try {
            applied = await this._spatial.setOffsetM(target, { constraint: 'bypass' });
        } catch (error) {
            this._sinkShiftM = sinkShiftM;
            throw error;
        }
        this._placeSinks('resize');
        const patch = {
            ...this._offsetPatch(applied, { root: this._countertopRoot, baseM: this._basePositionM }),
            [COUNTERTOP_LENGTH_KEY]: nextLengthM,
            [COUNTERTOP_SINK_SHIFT_KEY]: this._sinkShiftToWrite()
        };
        this._writeSnapshot(patch);
        // Re-cut now: the centre already moved by half the change, the old-length mesh must not render there.
        const operation = this._syncLength('countertop-length-changing', { immediate: true });
        if (operation?.status !== COUNTERTOP_GEOMETRY_RESULT_STATUS.NO_OP) {
            this._scheduleCollisionRefreshAfter(operation, this._generation);
        } else {
            this._refreshSinkCutouts('countertop-resized');
        }
        this._notifyCoverSourceChanged(patch);
        await this.whenSettled();
        // The length is judged once applied: the revert rewrites the previous offset, length and sink shift.
        if (validation === 'guard') await this._rejectInvalidPose({ offset: { ...applied }, length: nextLengthM }, async () => {
            this._sinkOwner = backSink.owner; this._sinkShiftM = backSink.shiftM;
            const back = await this._spatial.setOffsetM(offset, { constraint: 'bypass' });
            this._placeSinks('resize-revert');
            const backPatch = {
                ...this._offsetPatch(back, { root: this._countertopRoot, baseM: this._basePositionM }),
                [COUNTERTOP_LENGTH_KEY]: backLengthM,
                [COUNTERTOP_SINK_SHIFT_KEY]: this._sinkShiftToWrite(backSink.owner, backSink.shiftM)
            };
            this._writeSnapshot(backPatch);
            const revertOperation = this._syncLength('countertop-length-changing', { immediate: true });
            if (revertOperation?.status !== COUNTERTOP_GEOMETRY_RESULT_STATUS.NO_OP) this._scheduleCollisionRefreshAfter(revertOperation, this._generation);
            else this._refreshSinkCutouts('countertop-resized');
            this._notifyCoverSourceChanged(backPatch);
            await this.whenSettled();
            this._emitChange(COUNTERTOP_CHANGE_REASON.LENGTH);
        });
        this._emitChange(COUNTERTOP_CHANGE_REASON.LENGTH);
        return this.getState();
    }

    /**
     * Length limits supplied by the UI per collection (`{ minM, maxM }`, null = 0.6 m (one 60 cm cabinet) … 120 in).
     * The effective minimum also keeps every basin cut-out inside the top (see getLengthLimitsM).
     */
    setLengthLimitsM(limits) {
        let next;
        try { next = normalizeCountertopLengthLimits(limits); }
        catch (error) { throw countertopError(COUNTERTOP_ERROR_CODE.INVALID_INPUT, error.message); }
        this._lengthLimitsM = next;
        this._emitChange(COUNTERTOP_CHANGE_REASON.LENGTH_LIMITS);
        return this.getState();
    }

    /** Effective limits: `{ minLengthM, maxLengthM, requestedMinM, requestedMaxM, basinMinLengthM }`. */
    getLengthLimitsM() {
        return resolveCountertopLengthLimitsM({ requestedM: this._lengthLimitsM, basinMinLengthM: this._measureBasinMinLengthM() });
    }

    /** Length needed to keep every cut-out inside the top, symmetric about the top's centre (0 = none). */
    _measureBasinMinLengthM() {
        const mesh = this._binding ? this._countertopMesh : null;
        const cutters = this._assemblyBinding?.cutters ?? [];
        if (!mesh || !cutters.length) return 0;
        try {
            const box = measureEntityBoundsM(mesh);
            if (!box) return 0;
            const cutoutsM = cutters.filter(binding => binding.mesh?.parent).map(binding => measureCutoutExtentXM(binding.mesh)).filter(Boolean);
            return resolveBasinMinLengthM({ centerXM: (box.minM.x + box.maxM.x) / 2, cutoutsM });
        } catch {
            return 0;
        }
    }

    /**
     * Coverage inputs (world X, m): basin cut-outs `[{ minX, maxX, vessel, id }]` and — only while the sink stays on
     * its cabinet (owner 'cabinet', top resting) — the boxes of the cabinets owning a sink `[{ minX, maxX, id }]`.
     */
    getCoverageInputs() {
        const assembly = this._binding ? this._assemblyBinding : null;
        const cutouts = [], supportBoxes = [];
        if (!assembly) return { cutouts, supportBoxes };
        // One measurement per pose: getState / the overlay / the drag guard ask several times per drag step.
        const offset = this._spatial.getOffsetM();
        const key = `${this._generation}|${offset.x}|${offset.y}|${this._appliedLengthM}|${this._sinkOwner}|${this._landingPending?.cabinetId ?? ''}`;
        if (this._coverageMemo?.assembly === assembly && this._coverageMemo.key === key) return this._coverageMemo.value;
        try {
            const sinks = assembly.sinks ?? [];
            const sinkOf = new Map(); // cutter -> its sink (an unowned clone has none: no host)
            for (const sink of sinks) for (const cutter of sink.cutters) sinkOf.set(cutter, sink);
            const hostWidths = new Map(); // host root -> X width (m), measured once per call
            for (const binding of assembly.cutters) {
                if (!binding.mesh?.parent) continue;
                const extent = measureCutoutExtentXM(binding.mesh);
                const vessel = binding.source === 'vessel-clone' || /^Vessel(_|$)/.test(binding.sinkId ?? '');
                if (!extent) continue;
                const host = cabinetHost(sinkOf.get(binding));
                const cutout = { ...extent, vessel, id: host?.id ?? null };
                // Integrated cut-out: margin = min(10 cm, standard margin on its host cabinet), regardless of sink owner.
                if (!vessel && host?.root) {
                    if (!hostWidths.has(host.root)) {
                        const hostBox = measureEntityBoundsM(host.root);
                        hostWidths.set(host.root, hostBox ? hostBox.maxM.x - hostBox.minM.x : NaN);
                    }
                    cutout.marginM = basinEdgeMarginM({ cutoutWidthM: extent.maxX - extent.minX, hostWidthM: hostWidths.get(host.root) });
                }
                cutouts.push(cutout);
            }
            const owner = this._sinkOwner ??
                (this._isHostedSink() || this._spatial.getOffsetM().y > COUNTERTOP_REST_TOLERANCE_M ? 'countertop' : 'cabinet');
            if (owner === 'cabinet') {
                // Hosts of a live sink first, then of a live cut-out piece (a 'Vessel' placeholder): today's box order.
                const roots = new Map();
                const supported = [...sinks.filter(sink => sink.entity), ...sinks.filter(sink => sink.cutters.some(cutter => cutter.mesh?.parent))];
                for (const host of supported.map(cabinetHost)) if (host?.root) roots.set(host.root, host.id);
                for (const [root, id] of roots) {
                    const box = measureEntityBoundsM(root);
                    if (box) supportBoxes.push({ minX: box.minM.x, maxX: box.maxM.x, id: id ?? null });
                }
            }
            // Pending landing (P3, top resting, sink carried): the candidate under the sink must stay covered; the old host is not.
            const pending = this._landingPending;
            if (owner === 'countertop' && pending?.cabinetId && this._isResting(offset)) {
                const box = measureEntityBoundsM(this._app?.root?.findByName?.(pending.cabinetId));
                if (box) supportBoxes.push({ minX: box.minM.x, maxX: box.maxM.x, id: pending.cabinetId });
            }
        } catch (error) {
            this._reportOperationError(error);
        }
        const value = { cutouts, supportBoxes };
        this._coverageMemo = { assembly, key, value };
        return value;
    }

    /**
     * Where a carried sink would land (P3): the one cut-out's X range against the row cabinets under the top (box top
     * within 2 cm of the host's, overlapping the top). `{ status: 'none'|'home'|'fits'|'gap'|'unfit', cabinetId,
     * fromCabinetId, reason, snapDxM }`; memoized with the coverage inputs. A countertop-hosted sink (HR-CT-02, cut-out
     * `id: null`) has no host and no 'home': `snapDxM` = candidate centre − cut-out centre, HEIGHT is measured against
     * the countertop's bottom at rest, `fromCabinetId: null`.
     */
    _sinkLanding() {
        const assembly = this._binding ? this._assemblyBinding : null;
        if (!assembly || this._sinkOwner !== 'countertop') return SINK_LANDING_NONE;
        const coverage = this.getCoverageInputs();
        if (this._landingMemo?.coverage === coverage) return this._landingMemo.value;
        let value = SINK_LANDING_NONE;
        try {
            const cutout = coverage.cutouts.length === 1 ? coverage.cutouts[0] : null;
            // The cut-out's sink: the cabinet one with its id, or (id null) the top's own.
            const sink = cutout ? (assembly.sinks ?? []).find(entry => (cabinetHost(entry)?.id ?? null) === cutout.id) : null;
            let hosted = false, hostBox = null;
            switch (sink?.host.kind) {
                case 'cabinet': hostBox = measureEntityBoundsM(sink.host.root); break; // 'home' and snapDx from the host
                case 'countertop': hosted = true; break; // no host: snapDx from the cut-out, HEIGHT from the top
            }
            const topBox = this._countertopMesh ? measureEntityBoundsM(this._countertopMesh) : null;
            const products = this._composition?.getAllProducts?.() ?? null;
            if (cutout && (hosted || hostBox) && topBox && products) {
                const entries = products instanceof Map ? [...products.entries()] : Object.entries(products);
                const row = [];
                for (const [key, product] of entries) {
                    if (product?.category !== 'cabinets') continue;
                    const id = product.productId ?? key;
                    const box = id === cutout.id ? hostBox : measureEntityBoundsM(this._app?.root?.findByName?.(id));
                    if (box && box.maxM.x > topBox.minM.x && box.minM.x < topBox.maxM.x) {
                        row.push({ id, box, productType: product.productType });
                    }
                }
                const holds = body => body.box.minM.x - 0.01 <= cutout.minX && cutout.maxX <= body.box.maxM.x + 0.01;
                const candidate = this._standardSinkBase(row, { cutout, topBox, hosted, holds })
                    ?? row.find(body => body.id === cutout.id && holds(body)) ?? row.find(holds) ?? null;
                const base = { cabinetId: candidate?.id ?? null, fromCabinetId: cutout.id, reason: null, snapDxM: 0 };
                // No cabinet holds the cut-out: 'gap' when it touches a cabinet (straddle / edge), else the sink is
                // beside the row (a remote sink: the top may rest on a cabinet with its other end) → 'none' DETACHED, valid.
                const touches = row.some(body => body.box.maxM.x > cutout.minX + 0.001 && body.box.minM.x < cutout.maxX - 0.001);
                if (!candidate) value = touches ? { ...base, status: 'gap' } : { ...base, status: 'none', reason: 'DETACHED' };
                // 'home' (cabinet sink only): how far the top must move so the carried sink sits exactly at its sink point.
                else if (candidate.id === cutout.id) value = { ...base, status: 'home', snapDxM: hosted ? 0 : -(this._spatial.getOffsetM().x + this._sinkShiftM) };
                else {
                    // After moveSink the sink sits at the candidate's sink point: home moves by the cabinets' centre delta.
                    const candidateCentreX2 = candidate.box.minM.x + candidate.box.maxM.x;
                    const snapDxM = hosted
                        ? (candidateCentreX2 - cutout.minX - cutout.maxX) / 2
                        : (candidateCentreX2 - hostBox.minM.x - hostBox.maxM.x) / 2 - (this._spatial.getOffsetM().x + this._sinkShiftM);
                    const levelDy = candidate.box.maxM.y - (hosted ? topBox.minM.y - this._spatial.getOffsetM().y : hostBox.maxM.y);
                    // The sink lands only on a side cabinet (role SC in the collection's pack).
                    if (roleOfType(candidate.productType) !== 'SC') value = { ...base, status: 'unfit', reason: 'TYPE', snapDxM };
                    else if (!isSinkLandingLevel(levelDy)) value = { ...base, status: 'unfit', reason: 'HEIGHT', snapDxM };
                    else value = { ...base, status: 'fits', snapDxM };
                }
                value = Object.freeze(value);
            }
        } catch (error) {
            this._reportOperationError(error);
        }
        this._landingMemo = { coverage, value };
        return value;
    }

    /**
     * Standard (`resetOffset`) with a hosted sink: the top stays on its standard pose and the sink goes back into a sink base
     * under it — the side cabinet at the top's level (overlapped by the top) that holds the cut-out, else the one whose
     * centre is nearest to the cut-out (leftmost on a tie). The standard top may leave the cut-out beside its cabinets: it
     * hangs where the top carried it. null: not a Standard request at the standard pose, not hosted, or no such cabinet.
     * row: `_sinkLanding`'s `[{ id, box, productType }]`; holds: its cut-out-in-cabinet test.
     */
    _standardSinkBase(row, { cutout, topBox, hosted, holds }) {
        const offset = this._spatial.getOffsetM();
        if (!hosted || !this._standardLanding || !isCountertopAttached(offset)) return null;
        const restBottomY = topBox.minM.y - offset.y;
        const bases = row.filter(body => roleOfType(body.productType) === 'SC'
            && Math.min(body.box.maxM.x, topBox.maxM.x) - Math.max(body.box.minM.x, topBox.minM.x) > 1e-3
            && isSinkLandingLevel(body.box.maxM.y - restBottomY));
        const held = bases.find(holds);
        if (held) return held;
        const cutoutCentreX = (cutout.minX + cutout.maxX) / 2;
        const distance = body => Math.abs((body.box.minM.x + body.box.maxM.x) / 2 - cutoutCentreX);
        const nearer = (a, b) => distance(a) < distance(b) - 1e-9
            || (Math.abs(distance(a) - distance(b)) <= 1e-9 && a.box.minM.x < b.box.minM.x);
        return bases.reduce((best, body) => (best === null || nearer(body, best) ? body : best), null);
    }

    /**
     * Resting = on the cabinets: |offset.y| <= 1 cm AND the top's X range overlaps a cabinet box (height-only
     * when unmeasurable). Otherwise detached: lifted, lowered, or beside the row (Remote) at any height.
     */
    _isResting(offset = this._spatial.getOffsetM()) {
        if (!(Math.abs(Number(offset?.y)) <= COUNTERTOP_REST_TOLERANCE_M)) return false;
        const topBox = this._countertopMesh ? measureEntityBoundsM(this._countertopMesh) : null;
        const boxes = topBox ? this._cabinetBoxesM() : null;
        if (!boxes) return this._sinkOwner !== 'countertop'; // unmeasurable: never drop a carried sink on a guess
        return boxes.some(({ box }) => box.maxM.x > topBox.minM.x + 1e-3 && box.minM.x < topBox.maxM.x - 1e-3);
    }

    /** `[{ id, box }]` of the composition's cabinets (measured world boxes); null when unmeasurable. */
    _cabinetBoxesM() {
        const products = this._composition?.getAllProducts?.() ?? null;
        if (!products) return null;
        const entries = products instanceof Map ? [...products.entries()] : Object.entries(products);
        const boxes = [];
        for (const [key, product] of entries) {
            if (product?.category !== 'cabinets') continue;
            const id = product.productId ?? key;
            const box = measureEntityBoundsM(this._app?.root?.findByName?.(id));
            if (box) boxes.push({ id, box });
        }
        return boxes.length ? boxes : null;
    }

    /** Whether the bound top hosts the sink (HR-CT-02): the resolver has a `host.kind === 'countertop'` entry (a 'Vessel' placeholder too). */
    _isHostedSink() {
        return Boolean(this._assemblyBinding?.sinks?.some(sink => sink.host.kind === 'countertop'));
    }

    /** The `CountertopSinkShiftM` to write: the shift of a cabinet sink the top carries, else null (a hosted sink has none). */
    _sinkShiftToWrite(owner = this._sinkOwner, shiftM = this._sinkShiftM) {
        return owner === 'countertop' && !this._isHostedSink() ? shiftM : null;
    }

    /**
     * After a drag-end (snap back and commit done) or an API setOffset: a lifted top that carries the one SB-hosted sink
     * announces `{ type: 'sink-lift', fromCabinetId, sinkLocalM }` once (re-armed when the sink goes home or on rebind);
     * the UI commits `cabinets.liftSink`. `sinkLocalM` = the sink entity's position in the countertop root's local frame.
     */
    _announceSinkLift() {
        if (this._destroyed || !this._binding || this._sinkLiftAnnounced || this._sinkOwner !== 'countertop') return null;
        const assembly = this._assemblyBinding;
        // A top resting on a cabinet with its sink beside the row (landing DETACHED) has lifted the sink off its SB too.
        if (!assembly || this._isHostedSink() || (this._isResting() && this._sinkLandingAt?.reason !== 'DETACHED')) return null;
        const sinks = new Map(); // SB id -> sink entity (the live sink, else its vessel clone root)
        for (const sink of (assembly.sinks ?? []).filter(entry => entry.host.kind === 'cabinet' && entry.host.id)) {
            const entity = sink.entity?.parent ? sink.entity : vesselCloneRoots(sink)[0];
            if (entity) sinks.set(sink.host.id, entity);
        }
        if (sinks.size !== 1 || !this._countertopRoot) return null;
        const [[fromCabinetId, entity]] = sinks;
        const world = entity.getPosition?.();
        if (!world) return null;
        const local = toLocalPointM(this._countertopRoot, { x: Number(world.x), y: Number(world.y), z: Number(world.z) });
        if (![local.x, local.y, local.z].every(Number.isFinite)) return null;
        this._sinkLiftAnnounced = true;
        const action = Object.freeze({ type: 'sink-lift', fromCabinetId, sinkLocalM: Object.freeze(local) });
        this._emit('action', action);
        return action;
    }

    /** Drag-guard reasons of the current pose: a resting top whose carried sink would land over a gap / unfit cabinet. */
    getLandingReasons() {
        if (!this._binding || !this._isResting()) return [];
        const status = this._sinkLandingAt?.status;
        return status === 'gap' ? [COUNTERTOP_OVERLAY_REASON.SINK_LANDING_GAP]
            : status === 'unfit' ? [COUNTERTOP_OVERLAY_REASON.SINK_LANDING_UNFIT] : [];
    }

    /**
     * Height reasons of the current pose: a lowered top (offset.y < -1 cm) over a cabinet, or beside the row with its
     * surface more than 1 mm below the adjacent row-end cabinet's cover top (carcass top + cover thickness; 0 = unknown).
     */
    getHeightReasons() {
        if (!this._binding || !(Number(this._spatial.getOffsetM()?.y) < -COUNTERTOP_REST_TOLERANCE_M)) return [];
        const topBox = this._countertopMesh ? measureEntityBoundsM(this._countertopMesh) : null;
        const boxes = topBox ? this._cabinetBoxesM() : null;
        if (!boxes) return [];
        const below = [COUNTERTOP_OVERLAY_REASON.COUNTERTOP_BELOW_COVER];
        if (boxes.some(({ box }) => box.maxM.x > topBox.minM.x + 1e-3 && box.minM.x < topBox.maxM.x - 1e-3)) return below;
        const rowMinX = Math.min(...boxes.map(({ box }) => box.minM.x)), rowMaxX = Math.max(...boxes.map(({ box }) => box.maxM.x));
        const right = topBox.minM.x + topBox.maxM.x >= rowMinX + rowMaxX;
        const end = boxes.find(({ box }) => (right ? box.maxM.x === rowMaxX : box.minM.x === rowMinX));
        return topBox.maxM.y < end.box.maxM.y + this._coverThicknessM() - 1e-3 ? below : [];
    }

    /** Configured cabinet-cover thickness (the composition's cover settings), 0 = covers off / unknown. */
    _coverThicknessM() {
        const settings = this._composition?.getCabinetCoverSettings?.() ?? null;
        const thicknessM = Number(settings?.thicknessM);
        return settings?.enabled && Number.isFinite(thicknessM) && thicknessM > 0 ? thicknessM : 0;
    }

    /** Gesture end with a pending landing: snap the top so the sink centres on the candidate, then report it (once). */
    _snapLanding() {
        const landing = this._sinkLandingAt, pending = this._landingPending;
        if (!pending || this._landingSnapping) return;
        // 'home': the whole top moves so the carried sink sits on its SB point; nothing for the UI to commit.
        if (landing?.status === 'home') { this._trackOperation(this._snapHome().then(() => this._emitChange(COUNTERTOP_CHANGE_REASON.OFFSET))); return; }
        if (landing?.status !== 'fits') return;
        if (this._landingAnnounced === pending.cabinetId && Math.abs(landing.snapDxM) <= 1e-4) return; // reported already
        this._landingSnapping = true;
        const offset = this._spatial.getOffsetM();
        const snapped = Math.abs(landing.snapDxM) > 1e-4 || offset.y !== 0
            ? this.setOffsetM({ x: offset.x + landing.snapDxM, y: 0 }, { constraint: 'bypass', validation: 'skip' }) : Promise.resolve();
        this._trackOperation(snapped.then(() => {
            this._landingAnnounced = pending.cabinetId;
            this._emit('action', Object.freeze({ type: 'sink-landing', landing: this._sinkLandingAt }));
            this._emitChange(COUNTERTOP_CHANGE_REASON.SINK_LANDING);
        }, error => this._reportOperationError(error)).finally(() => { this._landingSnapping = false; }));
    }

    /**
     * A resting top whose carried sink is pending 'home': move the WHOLE top by `snapDxM` (y → 0) so the sink sits exactly
     * on its SB point; the snap's own commit (`_placeSinks`, |snapDxM| ≤ 1e-4) then hands the sink to the cabinet with no jump.
     * Re-entry (the snap's own setOffsetM) is guarded by `_landingSnapping`. Rejects with the snap's error.
     */
    _snapHome() {
        const landing = this._sinkLandingAt, pending = this._landingPending;
        if (!pending || this._landingSnapping || landing?.status !== 'home' || !Number.isFinite(landing.snapDxM)) return Promise.resolve(false);
        const offset = this._spatial.getOffsetM();
        if (Math.abs(landing.snapDxM) <= 1e-4 && offset.y === 0) return Promise.resolve(false);
        this._landingSnapping = true;
        return this.setOffsetM({ x: offset.x + landing.snapDxM, y: 0 }, { constraint: 'bypass', validation: 'skip' })
            .then(() => true)
            .finally(() => { this._landingSnapping = false; });
    }

    /** One-end resize bounds `{ left, right }` (resolveResizeBoundsM per side) of the top's mesh box; null = unmeasurable. */
    _resizeBoundsM() {
        const mesh = this._binding ? this._countertopMesh : null;
        if (!mesh) return null;
        try {
            const box = measureEntityBoundsM(mesh);
            if (!box) return null;
            const input = { ctBox: { minX: box.minM.x, maxX: box.maxM.x }, ...this.getCoverageInputs(),
                materialMinM: this._lengthLimitsM.minM, materialMaxM: this._lengthLimitsM.maxM };
            return Object.freeze({
                left: Object.freeze(resolveResizeBoundsM({ ...input, side: 'left' })),
                right: Object.freeze(resolveResizeBoundsM({ ...input, side: 'right' }))
            });
        } catch {
            return null;
        }
    }

    /** Dispatch the edit-size action (overlay button) to 'action' listeners. */
    emitEditSizeAction() {
        const state = this.getState();
        if (this._destroyed || !state.canResize || !state.selected) return null;
        const action = Object.freeze({ type: 'edit-size', state });
        this._emit('action', action);
        return action;
    }

    // ---------------------------------------------------------------------------------------------
    // Composition hooks
    // ---------------------------------------------------------------------------------------------

    /** Countertop geometry changed: re-measure the composition (held while it settles). */
    invalidateCollisionGeometry(reason = 'countertop-geometry-changing') {
        if (this._destroyed || this._legacySuspended || this._legacyRetired) return null;
        return this._spatial.invalidate(reason);
    }

    activateComposition(compositionId) {
        if (this._compositionId && this._compositionId !== compositionId) {
            this.reset('active-composition-changed');
        }
    }

    /** RuleCountertopLayout: the complete standard X/Y/length plan changed. */
    updateStandardLayout(input = {}) {
        if (this._destroyed || this._legacySuspended || this._legacyRetired) return null;

        const composition = input.composition || null;
        const compositionId = input.compositionId ?? composition?.compositionId ?? null;
        const assembly = resolveCountertopAssembly({
            composition,
            compositionId,
            entities: input.entities || {},
            getSinkAnchorName: (productType, entityName) =>
                ProductRegistry_V2.instance.getSinkAnchorName(productType) ||
                ProductRegistry_V2.instance.getSinkAnchorName(entityName)
        });
        const productId = assembly.productId;
        const root = assembly.countertop?.root || null;
        const mesh = assembly.countertop?.mesh || null;
        const layout = input.layout || {};
        const basePositionM = input.basePositionM || null;
        const layoutReady = Boolean(
            composition && compositionId && productId && root && mesh &&
            Number.isFinite(basePositionM?.x) &&
            Number.isFinite(basePositionM?.y) &&
            Number.isFinite(basePositionM?.z) &&
            Number.isFinite(layout.autoLengthM) &&
            layout.autoLengthM > 0
        );

        if (!layoutReady) {
            this.resetForComposition(compositionId, 'countertop-layout-not-ready');
            return null;
        }

        const identityChanged = !this._binding ||
            this._compositionId !== compositionId ||
            this._productId !== productId ||
            this._countertopRoot !== root ||
            this._countertopMesh !== mesh;
        const sameProduct = this._compositionId === compositionId && this._productId === productId;
        // Before `_bind` (it resets): a remote top's saved offset is re-based here, and the
        // registration below restores the re-based one.
        let rebasedOffsetM = null;
        try {
            rebasedOffsetM = this._anchorRemoteOffset({
                composition, productId, root, basePositionM,
                previousBaseM: sameProduct ? this._basePositionM : null,
                // A remote top without a saved length keeps the length it has now (not re-fitted).
                frozenLengthM: sameProduct
                    ? (finitePositiveOrNull(this._appliedLengthM) ?? finitePositiveOrNull(this._binding?.baseLengthM))
                    : null
            });
        } catch (error) {
            this._reportOperationError(error); // never fail the standard layout over the remote anchor
        }

        if (identityChanged) {
            this._bind({ composition, compositionId, productId, root, mesh, assembly, basePositionM });
            this._cutoutEntities = input.entities || {}; // after _bind: its reset clears them
        } else {
            this._cutoutEntities = input.entities || {};
            this._assemblyBinding = assembly;
            this._basePositionM = basePositionM;
            this._spatial.rebase();
            if (rebasedOffsetM) this._moveToRebasedOffset(rebasedOffsetM);
            this.invalidateCollisionGeometry('countertop-layout-rebound');
        }

        const measuredBoundsM = measureCountertopMeshBoundsM(mesh);
        this._binding = Object.freeze({
            kind: 'CountertopLayoutBinding',
            compositionId,
            productId,
            basePositionM: Object.freeze({ ...basePositionM }),
            baseLengthM: layout.autoLengthM,
            sizeM: Object.freeze({ depth: measuredBoundsM?.depthM ?? null }),
            thicknessM: measuredBoundsM?.thicknessM ?? null,
            assembly
        });

        this._rebindCountertopPresentation(assembly);
        const operation = this._syncLength('countertop-layout', { skipDebounce: true });
        this._scheduleCollisionRefreshAfter(operation, this._generation);
        this._emitChange(COUNTERTOP_CHANGE_REASON.LAYOUT);
        return this.getState();
    }

    /** Geometry work, the collision re-measure it scheduled and the countertop's handle. */
    async whenGeometrySettled() {
        return this._whenAllGeometrySettled();
    }

    /** Geometry work, the collision re-measure it scheduled and the countertop's handle. */
    async whenSettled() {
        const result = await this._whenAllGeometrySettled();
        await this._poseOperation;
        await this._coverOperation;
        await this._refreshOperation;
        await this._spatial.handle?.whenSettled();
        return result;
    }

    /**
     * Re-resolve assembly members after sink/cutter lifecycle changes, assign
     * the resolved cutters, and rebuild only when their relative transform set
     * changed. A pending resize already owns that rebuild and consumes the
     * newly assigned cutters.
     */
    updateBooleanCutouts(input = {}) {
        if (this._destroyed || this._legacySuspended || this._legacyRetired || !this._binding || !this._assemblyBinding || !this._countertopMesh) {
            return Promise.resolve({
                status: COUNTERTOP_GEOMETRY_RESULT_STATUS.CANCELLED,
                reason: 'countertop-assembly-unbound'
            });
        }

        const generation = this._generation;
        this.invalidateCollisionGeometry(input.reason || 'countertop-boolean-changing');

        const assembly = resolveCountertopAssembly({
            composition: input.composition || this._composition,
            compositionId: input.compositionId || this._compositionId,
            entities: this._compositionManager?.preserveCabinetPositions ? {
                ...input.entities,
                cabinets: selectCountertopSupportGroup(input.entities?.cabinets || [],
                    (input.composition || this._composition).getAllProducts(), this._productId)
            } : input.entities || {},
            getSinkAnchorName: (productType, entityName) =>
                ProductRegistry_V2.instance.getSinkAnchorName(productType) ||
                ProductRegistry_V2.instance.getSinkAnchorName(entityName)
        });
        this._assemblyBinding = assembly;
        this._cutoutEntities = input.entities || {};
        this._spatial.rebase();
        this._rebindCountertopPresentation(assembly);

        if (this._binding) {
            this._binding = Object.freeze({ ...this._binding, assembly });
        }

        const allowed = Array.isArray(input.validCutters)
            ? new Set(input.validCutters)
            : null;
        const cutters = assembly.cutters
            .map(binding => binding.mesh)
            .filter(entity => entity?.parent && (!allowed || allowed.has(entity)));
        const meshBoolean = this._countertopMesh?.script?.meshBoolean;
        if (!meshBoolean || typeof meshBoolean.requestBoolean !== 'function') {
            return Promise.resolve({
                status: COUNTERTOP_GEOMETRY_RESULT_STATUS.ERROR,
                code: 'COUNTERTOP_MESH_BOOLEAN_MISSING',
                reason: 'target MeshBoolean requestBoolean() is unavailable'
            });
        }

        meshBoolean.cutters = cutters;
        const signature = createRelativeCutterSignature(assembly, cutters);
        const relativeChanged = input.forceRebuild === true ||
            signature !== this._relativeCutterSignature;
        this._relativeCutterSignature = signature;

        if (relativeChanged || this._lengthOperation) {
            cutters.forEach(cutter => { cutter.enabled = true; });
            this._countertopRoot?.syncHierarchy?.();
        }

        if (!relativeChanged || this._lengthOperation) {
            const settled = this._whenAllGeometrySettled();
            this._scheduleCollisionRefreshAfter(settled, generation);
            return settled;
        }

        let operation;
        try {
            operation = meshBoolean.requestBoolean({
                reason: input.reason || 'countertop-cutters-changed',
                skipWhenNoActiveCutters: false
            });
        } catch (error) {
            return Promise.resolve({
                status: COUNTERTOP_GEOMETRY_RESULT_STATUS.ERROR,
                code: error?.code || 'COUNTERTOP_BOOLEAN_REQUEST_FAILED',
                reason: error?.message || String(error)
            });
        }

        const tracked = Promise.resolve(operation).finally(() => {
            if (this._booleanOperation === tracked) this._booleanOperation = null;
        });
        this._booleanOperation = tracked;
        this._scheduleCollisionRefreshAfter(tracked, generation);
        return tracked;
    }

    resetForComposition(compositionId, reason = 'composition-reset') {
        if (!this._binding) return;
        if (compositionId && this._compositionId !== compositionId) return;
        this.reset(reason);
    }

    reset(reason = 'countertop-composition-reset') {
        this._generation++;
        this._teardownCountertopPresentation();
        this._spatial.release();
        this._geometry?.destroy();

        this._geometry = null;
        this._assemblyBinding = null;
        this._basePositionM = null;
        this._binding = null;
        this._composition = null;
        this._compositionId = null;
        this._productId = null;
        this._countertopRoot = null;
        this._countertopMesh = null;
        this._appliedLengthM = null;
        this._lengthOperation = null;
        this._booleanOperation = null;
        this._refreshOperation = null;
        this._coverOperation = null;
        this._poseOperation = null;
        this._relativeCutterSignature = null;
        this._cutoutEntities = null;
        this._sinkOwner = null;
        this._uncutForDrag = false;
        this._sinkShiftM = 0;
        this._sinkLandingAt = SINK_LANDING_NONE;
        this._landingPending = null;
        this._standardLanding = false;
        this._sinkLiftAnnounced = false;

        LoggerService.log(this, `[CountertopCompositionAdapter] Reset: ${reason}`);
        this._emitChange(COUNTERTOP_CHANGE_REASON.RESET);
    }

    destroy() {
        if (this._destroyed) return;
        this.reset('countertop-composition-adapter-destroyed');
        this._destroyed = true;
        if (this._sinkDump && globalThis.countertopSinkDump === this._sinkDump) delete globalThis.countertopSinkDump;
        this._legacyRecoveryResume = null;
        this._spatial.destroy();
        this._collisionOutline.destroy();
        this._dimensionAdapter?.destroy();
        this._dimensionAdapter = null;
        for (const listeners of this._listeners.values()) listeners.clear();
        this._compositionManager = null;
        this._app = null;
    }

    // ---------------------------------------------------------------------------------------------
    // Binding
    // ---------------------------------------------------------------------------------------------

    _bind({ composition, compositionId, productId, root, mesh, assembly, basePositionM }) {
        this.reset('countertop-binding-replaced');
        const generation = this._generation;

        this._composition = composition;
        this._compositionId = compositionId;
        this._productId = productId;
        this._countertopRoot = root;
        this._countertopMesh = mesh;
        this._assemblyBinding = assembly;
        this._basePositionM = basePositionM;
        this._geometry = createCountertopGeometryAdapter({
            entity: mesh,
            intrinsicBaseLengthM: COUNTERTOP_INTRINSIC_LENGTH_M,
            onMeshReplaced: () => {
                if (generation !== this._generation || this._legacySuspended || this._legacyRetired) return;
                this._refreshCountertopPresentation({ geometryReplaced: true });
                this.invalidateCollisionGeometry('countertop-mesh-replaced');
                this._scheduleCollisionRefreshAfter(this._whenAllGeometrySettled(), generation);
            }
        });

        this._bindCountertopPresentation(assembly);
        this._spatial.register({
            generation,
            productId,
            root,
            savedOffsetM: readSpatialOffsetM(this._snapshot()),
            isCurrent: () => generation === this._generation,
            isSelected: () => !this._composition?.hasMutationGuard?.() && this._isSelected(),
            getAssembly: () => this._assemblyBinding,
            getRoot: () => this._countertopRoot,
            getBasePositionM: () => this._basePositionM,
            getCoverThicknessM: () => this._coverThicknessM(),
            onCommit: offsetM => {
                if (generation !== this._generation) return;
                this._commitOffset(offsetM);
            },
            afterPose: () => {
                if (generation !== this._generation) return null;
                this._placeSinks('drag');
                return { owner: this._sinkOwner, shiftM: this._sinkShiftM, landing: this._sinkLandingAt, pending: this._landingPending };
            },
            restoreSink: sink => {
                if (generation !== this._generation || !sink) return;
                this._sinkOwner = sink.owner ?? null;
                this._sinkShiftM = Number.isFinite(sink.shiftM) ? sink.shiftM : 0;
                this._sinkLandingAt = sink.landing ?? SINK_LANDING_NONE;
                this._landingPending = sink.pending ?? null;
            }
        }).then(handle => {
            // A restored offset may detach the countertop: its custom length applies now.
            if (handle && generation === this._generation) {
                // A shift is saved only for a carried sink (`_sinkShiftToWrite`): restore it carried (Number(null) is 0).
                const rawShift = readSnapshotValue(this._snapshot(), COUNTERTOP_SINK_SHIFT_KEY);
                const shiftM = rawShift === null || rawShift === undefined || rawShift === '' ? NaN : Number(rawShift);
                this._sinkOwner = Number.isFinite(shiftM) ? 'countertop' : null;
                this._sinkShiftM = Number.isFinite(shiftM) ? shiftM : 0;
                this._placeSinks('restore');
                const operation = this._syncLength('countertop-restored');
                if (operation?.status !== COUNTERTOP_GEOMETRY_RESULT_STATUS.NO_OP) {
                    this._scheduleCollisionRefreshAfter(operation, generation);
                } else if (!isCountertopAttached(this._spatial.getOffsetM())) {
                    // The layout cut ran before the offset was restored: re-cut whichever owner (a no-op cut is skipped).
                    this._refreshSinkCutouts('countertop-restored', { anyOwner: true });
                }
                this._emitChange(COUNTERTOP_CHANGE_REASON.RESTORED);
                // A restored resting top with its carried sink pending 'home' settles as one whole-top move.
                this._trackOperation(this._snapHome());
            }
        });
    }

    /** Persist a committed offset; re-attaching drops the custom length. */
    _commitOffset(offsetM) {
        if (this._legacySuspended || this._legacyRetired) return;
        this._placeSinks('commit');
        const patch = {
            ...this._offsetPatch(offsetM, { root: this._countertopRoot, baseM: this._basePositionM }),
            // A hosted sink is a child of the top (its place is `CountertopSinkLocalM`): no shift while hosted.
            [COUNTERTOP_SINK_SHIFT_KEY]: this._sinkShiftToWrite()
        };
        if (patch[COUNTERTOP_LENGTH_KEY] === undefined && this._remoteTopsFixed() &&
            finitePositiveOrNull(readSnapshotValue(this._snapshot(), COUNTERTOP_LENGTH_KEY)) === null) {
            // Detached without a custom length: a remote top keeps the length it has now.
            const frozenM = finitePositiveOrNull(this._appliedLengthM) ?? finitePositiveOrNull(this._binding?.baseLengthM);
            if (frozenM !== null) patch[COUNTERTOP_LENGTH_KEY] = frozenM;
        }
        this._writeSnapshot(patch);
        // The guards ran before the commit: a resting top whose sink went home has nothing left to land.
        if (this._sinkOwner === 'cabinet') { this._sinkLandingAt = SINK_LANDING_NONE; this._landingAnnounced = null; }
        // Moving does not change the countertop's geometry; only a length change re-measures.
        const operation = this._syncLength('countertop-moved');
        if (operation?.status !== COUNTERTOP_GEOMETRY_RESULT_STATUS.NO_OP) {
            this._scheduleCollisionRefreshAfter(operation, this._generation);
        } else {
            // The length re-cut did not run: a top moved over a sink it does not carry needs a re-cut.
            if (!this._uncutForDrag) this._refreshSinkCutouts('countertop-moved'); // a whole-top drag re-cuts on 'drag-end'
        }
        this._notifyCoverSourceChanged(patch);
        this._emitChange(COUNTERTOP_CHANGE_REASON.OFFSET);
    }

    /**
     * Sink owner after every pose write. Resting on the cabinets (offset.y ≤ 1 cm, COUNTERTOP_REST_TOLERANCE_M) the sink (and its
     * cut-out pieces) stays at its cabinet's sink point; lifted, the top carries it at
     * `sink point + offset.x + shift`. Lifting keeps the sink's world X. The sink never leaves the top: it goes home
     * only when exactly at home; 'home'/'fits' pending snap the whole top on release.
     * World X is pinned; an integrated sink's Y too (sink point Y, + offset.y when carried: a resting top may sit up
     * to 1 cm high); Z is the pose's. Home: integrated sink = its sink point (the sub-product sits at local 0);
     * vessel cut-out clone = its cabinet root (as the rule places it; it keeps its Y under the top).
     */
    _placeSinks(logTag = 'pose') {
        const ownerBefore = this._sinkOwner;
        const assembly = this._assemblyBinding;
        if (!assembly || !this._spatial.handle) {
            if (isSinkLogEnabled()) this._logSinksSkipped(logTag, !assembly ? 'no-assembly' : 'no-drag-handle');
            return;
        }
        // A hosted sink (HR-CT-02) is a child of the top: never pinned; any SB sink left stays home.
        const hosted = this._isHostedSink();
        // Integrated sinks first, then vessel clone roots (today's placing order).
        const sinkHomes = new Map(), cloneHomes = new Map();
        for (const sink of assembly.sinks ?? []) {
            switch (sink.host.kind) {
                case 'cabinet': // carried by the top: pinned in world, home = its sink point / the cabinet root (vessel clone)
                    if (sink.entity) sinkHomes.set(sink.entity, { home: sink.entity.parent, pinY: true });
                    for (const root of vesselCloneRoots(sink, false)) cloneHomes.set(root, { home: sink.host.root, pinY: false });
                    break;
                case 'countertop': // a child of the top: never pinned
                    break;
            }
        }
        const homes = new Map([...sinkHomes, ...cloneHomes]);
        if (!homes.size && !hosted) {
            if (isSinkLogEnabled()) this._logSinksSkipped(logTag, 'no-sinks-resolved');
            return;
        }
        const offset = this._spatial.getOffsetM();
        const lifted = offset.y > COUNTERTOP_REST_TOLERANCE_M;
        const resting = this._isResting(offset); // owner hysteresis: picked up on a lift, dropped only exactly at home
        // The sink never leaves the top: once carried it stays carried at rest ('gap'/'unfit' keep their reasons);
        // it goes home only when already exactly at home. 'home'/'fits' pending snap the whole top on release.
        // Lowered does not pick it up (it would sink the SB's sink into the cabinet). A hosted sink is always the top's.
        let owner = hosted || lifted || this._sinkOwner === 'countertop' ? 'countertop' : 'cabinet';
        if (owner === 'cabinet' || hosted) this._sinkShiftM = 0;
        else if (this._sinkOwner === 'cabinet') this._sinkShiftM = -offset.x;
        this._sinkOwner = owner;
        const place = () => {
            const carried = this._sinkOwner === 'countertop' && !hosted;
            const dx = carried ? offset.x + this._sinkShiftM : 0;
            const dy = carried ? offset.y : 0;
            for (const [entity, { home, pinY }] of homes) {
                const homeAt = home?.getPosition?.();
                const homeX = Number(homeAt?.x), homeY = Number(homeAt?.y);
                const current = entity?.parent ? entity.getPosition?.() : null;
                if (!Number.isFinite(homeX) || !current) continue;
                entity.setPosition(homeX + dx, pinY && Number.isFinite(homeY) ? homeY + dy : current.y, current.z);
            }
        };
        // A pose re-placed (afterPose then the commit) keeps the landing judged when it was lowered.
        const poseKey = `${this._generation}|${offset.x}|${offset.y}`;
        let landing = this._landingPoseKey === poseKey ? this._sinkLandingAt : SINK_LANDING_NONE;
        try {
            place();
            if (owner === 'countertop') {
                this._coverageMemo = null; // the cut-outs just moved with the sink
                landing = resting || lifted ? this._sinkLanding() : SINK_LANDING_NONE; // beside the row: no landing
                // Several SB sinks (no single landing): at rest they go home together — the whole top snaps by one shift.
                if (!hosted && resting && landing.status === 'none' && landing.reason !== 'DETACHED') {
                    landing = Object.freeze({ ...SINK_LANDING_NONE, status: 'home', cabinetId: null, fromCabinetId: null,
                        snapDxM: -(offset.x + this._sinkShiftM) });
                }
                if (!hosted && resting && landing.status === 'home' && Math.abs(landing.snapDxM) <= 1e-4) {
                    this._sinkOwner = owner = 'cabinet';
                    this._sinkShiftM = 0;
                    place();
                }
            }
        } catch (error) {
            this._reportOperationError(error);
        }
        this._sinkLandingAt = landing;
        this._landingPoseKey = poseKey;
        if (owner === 'cabinet') this._sinkLiftAnnounced = false; // the sink went home: the next lift is announced again
        this._landingPending = resting && owner === 'countertop' && (landing.status === 'fits' || landing.status === 'home')
            ? Object.freeze({ cabinetId: landing.cabinetId, fromCabinetId: landing.fromCabinetId, status: landing.status }) : null;
        if (isSinkLogEnabled()) this._logSinks(logTag, ownerBefore);
    }

    /** Debug log (countertop-sink-log.mjs): drag / pose only when zone, owner or landing changed; commit, restore, resize always. */
    _logSinks(tag, ownerBefore) {
        try {
            const snapshot = this._sinkLogSnapshot(ownerBefore);
            const key = `${snapshot.zone}|${snapshot.owner}|${snapshot.landing?.status}|${snapshot.hosted}`;
            if ((tag === 'drag' || tag === 'pose') && key === this._sinkLogKey) return;
            this._sinkLogKey = key;
            logSinkSnapshot(tag, snapshot);
        } catch (error) {
            LoggerService.error(this, '[CountertopCompositionAdapter] sink log failed', error);
        }
    }

    /** Debug log: `_placeSinks` returned before placing anything (logged once per reason until it changes). */
    _logSinksSkipped(tag, reason) {
        if (this._sinkLogKey === `skip|${reason}`) return;
        this._sinkLogKey = `skip|${reason}`;
        try {
            logSinkSnapshot(`${tag} SKIPPED (${reason})`, this._spatial.handle ? this._sinkLogSnapshot(this._sinkOwner) : { zone: '—', reasons: [], offset: {} });
        } catch (error) {
            LoggerService.error(this, '[CountertopCompositionAdapter] sink log failed', error);
        }
    }

    /** Countertop / sinks / cabinets: world positions, AABBs (m), links (owner, host, parent, anchor, landing). */
    _sinkLogSnapshot(ownerBefore = null) {
        const offset = this._spatial.getOffsetM();
        const zone = offset.y > COUNTERTOP_REST_TOLERANCE_M ? 'lifted' : offset.y < -COUNTERTOP_REST_TOLERANCE_M ? 'lowered'
            : this._isResting(offset) ? 'resting' : 'beside';
        const topBox = this._countertopMesh ? measureEntityBoundsM(this._countertopMesh) : null;
        const landing = this._sinkLandingAt ?? SINK_LANDING_NONE;
        const types = new Map();
        const products = this._composition?.getAllProducts?.() ?? null;
        if (products) {
            for (const [key, product] of (products instanceof Map ? [...products.entries()] : Object.entries(products))) {
                if (product?.category === 'cabinets') types.set(product.productId ?? key, product.productType ?? null);
            }
        }
        // The drag guard's verdict (coverage / trap / landing codes): the same reasons the overlay turns red for.
        const reasons = [...this.getLandingReasons(), ...this.getHeightReasons()];
        let guardValid = null;
        if (typeof this._poseValidator === 'function' && !this._validatingPose) {
            this._validatingPose = true; // the validator reads getState()
            try {
                const verdict = this._poseValidator();
                guardValid = verdict?.valid ?? null;
                for (const reason of verdict?.reasons ?? []) {
                    const code = typeof reason === 'string' ? reason : reason?.code;
                    if (code && !reasons.includes(code)) reasons.push(code);
                }
            } catch { guardValid = null; } finally { this._validatingPose = false; }
        }
        return {
            zone, ownerBefore, owner: this._sinkOwner, shiftM: this._sinkShiftM, hosted: this._isHostedSink(),
            offset: { x: offset.x, y: offset.y }, verticalLocked: this._verticalLocked, coverThicknessM: this._coverThicknessM(),
            landing: { status: landing.status, cabinetId: landing.cabinetId ?? null, fromCabinetId: landing.fromCabinetId ?? null,
                snapDxM: landing.snapDxM ?? null, reason: landing.reason ?? null },
            pending: this._landingPending,
            reasons, guardValid,
            countertop: { id: this._productId, root: this._countertopRoot?.name ?? null, pos: positionOf(this._countertopRoot), box: boxInfo(topBox) },
            sinks: (this._assemblyBinding?.sinks ?? []).map(sink => ({
                sinkId: sink.sinkId, host: `${sink.host.kind}:${sink.host.id}`, entity: sink.entity?.name ?? null,
                parent: sink.entity?.parent?.name ?? null, anchor: sink.anchor?.name ?? null, anchorPos: positionOf(sink.anchor),
                pos: positionOf(sink.entity), box: boxInfo(sink.entity ? measureEntityBoundsM(sink.entity) : null), cutters: sink.cutters?.length ?? 0
            })),
            cabinets: [...types.entries()].map(([id, type]) => {
                const entity = this._app?.root?.findByName?.(id);
                const box = measureEntityBoundsM(entity);
                return { id, type, pos: positionOf(entity), box: boxInfo(box),
                    overlapsTopX: Boolean(box && topBox && box.maxM.x > topBox.minM.x + 1e-3 && box.minM.x < topBox.maxM.x - 1e-3) };
            })
        };
    }

    /** Re-cut the top against the live cutters (no-op without cutters); never throws into the caller. */
    _refreshSinkCutouts(reason, { anyOwner = false, forceRebuild = false } = {}) {
        // A carried sink keeps its place relative to the top: only a resting top (sink on the cabinet) needs it
        // (a restore re-cuts whichever owner: the layout cut ran before the pose; a drag-end re-cuts the top shown whole).
        if ((!anyOwner && this._sinkOwner !== 'cabinet') || !this._assemblyBinding?.cutters?.length || !this._cutoutEntities) return;
        try {
            this._trackOperation(this.updateBooleanCutouts({ entities: this._cutoutEntities, reason, forceRebuild }));
        } catch (error) {
            this._reportOperationError(error);
        }
    }

    /** Modular (free-layout) composition: a moved countertop is remote (fixed length and world pose). */
    _remoteTopsFixed() {
        return this._compositionManager?.preserveCabinetPositions === true;
    }

    /**
     * Snapshot patch for an offset. Attached: the custom length is dropped. Remote (modular
     * compositions only): `positionX/positionY` record the standard world position the offset
     * is measured from — the export format (`exportAllCompositions`), so re-imports keep it.
     */
    _offsetPatch(offsetM, { root, baseM }) {
        const offset = { x: offsetM.x, y: offsetM.y };
        const patch = { [SPATIAL_OFFSET_KEY]: offset };
        if (isCountertopAttached(offset)) patch[COUNTERTOP_LENGTH_KEY] = null;
        else if (this._remoteTopsFixed() && Number.isFinite(baseM?.x) && Number.isFinite(baseM?.y)) {
            const shift = parentShiftOf(root);
            patch.positionX = baseM.x + shift.x;
            patch.positionY = baseM.y + shift.y;
        }
        return patch;
    }

    /**
     * A remote countertop keeps its WORLD pose when the standard base moves: its saved offset is
     * re-expressed against `basePositionM` and written back. The reference base is the previous
     * layout base of this product, else the recorded standard world position (`positionX/Y`,
     * set by the export/import round trip). Returns the re-based offset, or null when unchanged.
     * Attached tops, legacy compositions and a top being dragged are left alone.
     */
    _anchorRemoteOffset({ composition, productId, root, basePositionM, previousBaseM = null, frozenLengthM = null }) {
        if (!this._remoteTopsFixed() || this._spatial.dragging || composition?.hasMutationGuard?.()) return null;
        const snapshot = composition?.getProduct?.(productId);
        const offset = readSpatialOffsetM(snapshot);
        if (!snapshot || isCountertopAttached(offset)) return null;
        let fromM = Number.isFinite(previousBaseM?.x) && Number.isFinite(previousBaseM?.y) ? previousBaseM : null;
        if (!fromM) {
            const x = Number(readSnapshotValue(snapshot, 'positionX'));
            const y = Number(readSnapshotValue(snapshot, 'positionY'));
            const shift = parentShiftOf(root);
            if (Number.isFinite(x) && Number.isFinite(y)) fromM = { x: x - shift.x, y: y - shift.y };
        }
        const dx = fromM ? basePositionM.x - fromM.x : 0;
        const dy = fromM ? basePositionM.y - fromM.y : 0;
        const moved = Math.abs(dx) > COUNTERTOP_ATTACHED_EPSILON_M || Math.abs(dy) > COUNTERTOP_ATTACHED_EPSILON_M;
        const next = moved ? { x: offset.x - dx, y: offset.y - dy } : offset;
        const patch = this._offsetPatch(next, { root, baseM: basePositionM });
        // A carried sink sits at `sink point + offset.x + shift`: the shift absorbs the re-base so it stays put.
        if (moved && this._sinkShiftToWrite() !== null) {
            this._sinkShiftM += dx;
            patch[COUNTERTOP_SINK_SHIFT_KEY] = this._sinkShiftToWrite();
        }
        // Remote = not re-calculated: freeze the current length when none is saved yet.
        if (finitePositiveOrNull(readSnapshotValue(snapshot, COUNTERTOP_LENGTH_KEY)) === null &&
            finitePositiveOrNull(frozenLengthM) !== null) {
            patch[COUNTERTOP_LENGTH_KEY] = finitePositiveOrNull(frozenLengthM);
        }
        this._writeProductSnapshot(composition, productId, patch);
        return moved ? next : null;
    }

    /** Put the live countertop on its re-based offset (world pose unchanged), then refresh the covers. */
    _moveToRebasedOffset(offsetM) {
        const generation = this._generation;
        const operation = this._spatial.setOffsetM(offsetM, { constraint: 'bypass' }).then(() => {
            if (generation !== this._generation || this._destroyed || this._legacySuspended || this._legacyRetired) return;
            this._notifyCoverSourceChanged({ [SPATIAL_OFFSET_KEY]: { x: offsetM.x, y: offsetM.y } });
            this._emitChange(COUNTERTOP_CHANGE_REASON.OFFSET);
        });
        const tracked = operation.catch(error => this._reportOperationError(error)).finally(() => {
            if (this._poseOperation === tracked) this._poseOperation = null;
        });
        this._poseOperation = tracked;
        return tracked;
    }

    _notifyCoverSourceChanged(changes) {
        if (this._legacySuspended || this._legacyRetired) return null;
        const operation = this._compositionManager?.notifyCabinetCoverSourceChanged?.(
            this._compositionId,
            this._productId,
            changes
        );
        if (!operation || typeof operation.then !== 'function') return operation;
        const tracked = Promise.resolve(operation).finally(() => {
            if (this._coverOperation === tracked) this._coverOperation = null;
        });
        this._coverOperation = tracked;
        this._trackOperation(tracked);
        return tracked;
    }

    /**
     * Apply the length rule; returns the geometry operation (or a no-op result).
     * `skipDebounce`: start the CSG rebuild without MeshBoolean's quiet period (its frame delay stays).
     * `immediate`: re-cut in this task, before the next render. For a commit that moves the top together
     * with its length (`resizeFromM`): the new pose is written at once, and with the default schedule
     * (120 ms quiet period + 2 frames) the old-length mesh would render at the new centre for that time,
     * so the end that must stay put jumps by half the change and back.
     */
    _syncLength(reason, { skipDebounce = false, immediate = false } = {}) {
        if (this._legacySuspended || this._legacyRetired) {
            return { status: COUNTERTOP_GEOMETRY_RESULT_STATUS.CANCELLED, reason: 'countertop-legacy-suspended' };
        }
        if (!this._binding || !this._geometry) {
            return { status: COUNTERTOP_GEOMETRY_RESULT_STATUS.CANCELLED, reason: 'countertop-unbound' };
        }
        const offsetM = this._spatial.handle ? this._spatial.getOffsetM() : readSpatialOffsetM(this._snapshot());
        const lengthM = resolveCountertopLengthM({
            autoLengthM: this._binding.baseLengthM,
            customLengthM: finitePositiveOrNull(readSnapshotValue(this._snapshot(), COUNTERTOP_LENGTH_KEY)),
            offsetM
        });
        if (sameNumber(lengthM, this._appliedLengthM)) {
            return { status: COUNTERTOP_GEOMETRY_RESULT_STATUS.NO_OP, reason: 'countertop-length-unchanged' };
        }
        const generation = this._generation;
        this._appliedLengthM = lengthM;
        this.invalidateCollisionGeometry(reason);
        // 1. immediate: a resize commit re-cuts now (see above).
        // 2. skipDebounce: a composition layout is one event, nothing to coalesce; the frame delay stays.
        // 3. default: the quiet period coalesces a stream of length changes into one CSG rebuild.
        let booleanOptions = { reason };
        if (immediate) booleanOptions = { reason, immediate: true };
        else if (skipDebounce) booleanOptions = { reason, debounceMs: 0 };
        const operation = this._geometry.setLengthM(lengthM, { booleanOptions });
        const tracked = Promise.resolve(operation).finally(() => {
            if (this._lengthOperation === tracked) this._lengthOperation = null;
            if (generation === this._generation) this._emitChange(COUNTERTOP_CHANGE_REASON.LENGTH_SETTLED);
        });
        this._lengthOperation = tracked;
        this._trackOperation(tracked);
        return tracked;
    }

    _snapshot() {
        return this._composition?.getProduct?.(this._productId) ?? null;
    }

    /** Write product data silently (no aggregation): the countertop applies it itself. */
    _writeSnapshot(patch) {
        this._writeProductSnapshot(this._composition, this._productId, patch);
    }

    _writeProductSnapshot(composition, productId, patch) {
        composition?.assertMutable?.();
        const snapshot = composition?.getProduct?.(productId) ?? null;
        if (!composition || !snapshot) return;
        const changed = Object.entries(patch).filter(([key, value]) => {
            const current = readSnapshotValue(snapshot, key);
            if (!hasSnapshotKey(snapshot, key)) return value !== null;
            return JSON.stringify(current) !== JSON.stringify(value);
        });
        if (!changed.length) return;
        const next = typeof snapshot.createNext === 'function'
            ? snapshot.createNext(Object.fromEntries(changed))
            : { ...snapshot, ...Object.fromEntries(changed) };
        composition.addProduct(productId, next);
    }

    _isSelected() {
        const root = this._countertopRoot;
        return Boolean(root?.parent && (this._app?.selectTool?.getSelected?.() || []).includes(root));
    }

    _activeCompositionId() {
        return this._compositionManager?.getActiveComposition?.()?.compositionId ?? null;
    }

    _requireReady() {
        if (this._destroyed || !this._binding) {
            throw countertopError(COUNTERTOP_ERROR_CODE.NOT_READY, 'The countertop is not bound to the active composition');
        }
    }

    _emit(event, payload) {
        for (const callback of [...(this._listeners.get(event) ?? [])]) {
            try {
                callback(payload);
            } catch (error) {
                console.error(`[Countertop] ${event} listener failed`, error);
            }
        }
    }

    _emitChange(reason) {
        if (this._destroyed) return;
        if (reason !== COUNTERTOP_CHANGE_REASON.VALIDATION) this._validationMemo = null; // the scene may have changed
        const state = this.getState();
        this._collisionOutline.update(state.readiness === COUNTERTOP_READINESS.READY ? this._countertopRoot : null, state.collision);
        this._emit('change', Object.freeze({ reason, state }));
        const flipped = this._validationStatus !== undefined && this._validationStatus !== state.validation.status;
        this._validationStatus = state.validation.status;
        if (flipped && reason !== COUNTERTOP_CHANGE_REASON.VALIDATION) this._emit('change', Object.freeze({ reason: COUNTERTOP_CHANGE_REASON.VALIDATION, state }));
    }

    // ---------------------------------------------------------------------------------------------
    // Presentation
    // ---------------------------------------------------------------------------------------------

    _bindCountertopPresentation(assembly) {
        if (!this._app) return;

        if (!this._selectionListenerBound) {
            this._app.on?.('selection:change', this._onSelectionChanged, this);
            this._app.on?.('select-tool:ready', this._onSelectToolReady, this);
            this._selectionListenerBound = true;
        }

        const cameraEntity = this._app.selectTool?.cameraEntity ||
            this._app.root?.findComponent?.('camera')?.entity || null;
        this._editOverlay = createCountertopEditOverlay(this._app, cameraEntity, {
            onAction: () => this.emitEditSizeAction()
        });
        this._editOverlay.bind({
            source: this,
            binding: assembly,
            onAction: () => this.emitEditSizeAction()
        });
        this._dimensionAdapter?.bind({ source: this, binding: assembly });
    }

    _rebindCountertopPresentation(assembly) {
        this._editOverlay?.bind({
            source: this,
            binding: assembly,
            onAction: () => this.emitEditSizeAction()
        });
        this._dimensionAdapter?.bind({ source: this, binding: assembly });
    }

    _refreshCountertopPresentation({ geometryReplaced = false } = {}) {
        if (geometryReplaced) {
            this._dimensionAdapter?.refreshAfterGeometry();
        }
        this._editOverlay?.refreshAnchor();
    }

    _teardownCountertopPresentation() {
        this._dimensionAdapter?.bind();

        if (this._selectionListenerBound) {
            this._app?.off?.('selection:change', this._onSelectionChanged, this);
            this._app?.off?.('select-tool:ready', this._onSelectToolReady, this);
            this._selectionListenerBound = false;
        }

        this._collisionOutline.clear();
        this._editOverlay?.destroy();
        this._editOverlay = null;
    }

    // ---------------------------------------------------------------------------------------------
    // Geometry work
    // ---------------------------------------------------------------------------------------------

    async _whenAllGeometrySettled() {
        let booleanResult = null;
        let lengthResult = null;

        while (this._lengthOperation || this._booleanOperation) {
            const lengthOperation = this._lengthOperation;
            const booleanOperation = this._booleanOperation;
            if (lengthOperation) lengthResult = await lengthOperation;
            if (booleanOperation) booleanResult = await booleanOperation;
            if (lengthOperation === this._lengthOperation &&
                booleanOperation === this._booleanOperation) {
                break;
            }
        }

        const geometryResult = await (this._geometry?.whenSettled?.() || Promise.resolve({
            status: COUNTERTOP_GEOMETRY_RESULT_STATUS.NO_OP,
            reason: 'countertop-geometry-unbound'
        }));
        if (geometryResult?.status === COUNTERTOP_GEOMETRY_RESULT_STATUS.ERROR ||
            geometryResult?.status === COUNTERTOP_GEOMETRY_RESULT_STATUS.CANCELLED) {
            return geometryResult;
        }
        if (booleanResult?.status === COUNTERTOP_GEOMETRY_RESULT_STATUS.ERROR ||
            booleanResult?.status === COUNTERTOP_GEOMETRY_RESULT_STATUS.CANCELLED) {
            return booleanResult;
        }
        return booleanResult || lengthResult || geometryResult;
    }

    _scheduleCollisionRefreshAfter(operation, generation) {
        const scheduled = Promise.resolve(operation).then(result => {
            if (generation !== this._generation || this._destroyed || this._legacySuspended || this._legacyRetired ||
                result?.status === COUNTERTOP_GEOMETRY_RESULT_STATUS.ERROR ||
                result?.status === COUNTERTOP_GEOMETRY_RESULT_STATUS.CANCELLED) {
                return null;
            }
            return this._spatial.spatial?.requestRefresh('countertop-geometry-settled') ?? null;
        });
        this._trackOperation(scheduled);
        const tracked = scheduled.catch(() => null).finally(() => {
            if (this._refreshOperation === tracked) this._refreshOperation = null;
        });
        this._refreshOperation = tracked;
        return scheduled;
    }

    _trackOperation(operation) {
        Promise.resolve(operation).catch(error => this._reportOperationError(error));
    }

    _reportOperationError(error) {
        if (error?.code === 'COUNTERTOP_OPERATION_SUPERSEDED' ||
            error?.code === COUNTERTOP_ERROR_CODE.DESTROYED) {
            return;
        }
        LoggerService.error(this, '[CountertopCompositionAdapter] Operation failed', error);
    }
}

/** The hosting cabinet `{ kind, id, root }` of a resolver sink entry, or null (the top's own sink / no sink). */
function cabinetHost(sink) {
    return sink?.host?.kind === 'cabinet' ? sink.host : null;
}

/** The distinct `Vessel_BoolCut_Clone_<i>` roots of a sink's cutters (only attached ones unless `live` is false). */
function vesselCloneRoots(sink, live = true) {
    const roots = (sink?.cutters ?? []).filter(cutter => cutter.source === 'vessel-clone' && (!live || cutter.transformRoot?.parent))
        .map(cutter => cutter.transformRoot);
    return [...new Set(roots)];
}

/**
 * Sink traps of the bound assembly — `[{ id, xM, hostCabinetId }]`, world X of each trap (it moves with the top), one pass
 * over `assembly.sinks`: the live sink entity and/or its `Vessel_BoolCut_Clone_<i>` cutter roots under the top (one trap
 * per entity); `hostCabinetId` = the cabinet host's id, null for a countertop-hosted sink (HR-CT-02: none is exempt from its
 * keep-out — a pending candidate still is).
 */
function readSinkTraps(assembly, pendingHostId = null) {
    const traps = [], seen = new Set();
    const add = (entity, hostCabinetId) => {
        if (!entity?.parent || seen.has(entity)) return;
        seen.add(entity);
        const xM = Number(entity.getPosition?.()?.x);
        // A pending sink landing (P3): the candidate is the new host, exempt like the current one.
        if (pendingHostId) hostCabinetId = pendingHostId;
        if (Number.isFinite(xM)) traps.push(Object.freeze({ id: `trap:${hostCabinetId ?? entity.name}`, xM, hostCabinetId: hostCabinetId ?? null }));
    };
    for (const sink of assembly?.sinks ?? []) {
        const hostCabinetId = cabinetHost(sink)?.id ?? null;
        for (const entity of [sink.entity, ...vesselCloneRoots(sink, false)]) add(entity, hostCabinetId);
    }
    return traps;
}

export function createCountertopCompositionAdapter(app, compositionManager) {
    return new CountertopCompositionAdapter(app, compositionManager);
}
