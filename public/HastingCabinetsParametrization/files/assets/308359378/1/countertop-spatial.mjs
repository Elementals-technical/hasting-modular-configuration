/**
 * The countertop on spatial manipulation — the countertop's counterpart of `CompositionModules`.
 *
 * Registers `countertopManipulable` in the composition's spatial world for one countertop binding:
 * - the offset from the standard (layout) position lives on the countertop's product snapshot
 *   (`SpatialOffsetM`, see composition-spatial.mjs); it is re-applied on registration and
 *   committed by the host when a drag ends (`onCommit`);
 * - dragging is opt-in (`setDragEnabled(true)`) and limited to the selected countertop;
 * - collision is observed only (the outline shows it).
 *
 * The composition adapter owns the countertop binding and supplies it through getters.
 */
import { collidingObjectIds } from '../../composition/spatial/collision-outline.mjs';
import { countertopManipulable } from './countertop.manipulable.mjs';

export class CountertopSpatial {
  /**
   * @param {object} options
   * @param {object} options.spatial                    CompositionSpatial of the composition
   * @param {() => Promise} [options.whenGeometrySettled] countertop geometry (booleans, length)
   * @param {(reason: string) => void} [options.onChange] offset, collision or drag phase changed
   * @param {(error: Error) => void} [options.onError]
   */
  constructor({ spatial, whenGeometrySettled = null, onChange = null, onError = null }) {
    this._spatial = spatial;
    this._onChange = onChange;
    this._onError = onError;
    this._handle = null;
    this._registration = null;
    this._off = [];
    this._dragEnabled = false;
    this._dragging = false;
    this._dragGuard = null;
    this._verticalLocked = false;
    this._lastValidOffsetM = null;
    this._lastValidSinkM = null;
    this._poseSinkM = null;
    this._afterPose = null;
    this._restoreSink = null;
    this._participant = { beforeRemeasure: () => whenGeometrySettled?.() };
    this._removeParticipant = spatial?.addParticipant(this._participant) ?? null;
  }

  get spatial() {
    return this._spatial;
  }

  /** The countertop's handle (null until registered). */
  get handle() {
    return this._handle;
  }

  get dragEnabled() {
    return this._dragEnabled && !this._legacySuspended;
  }

  get dragging() {
    return this._dragging;
  }

  suspendLegacy({ adoptTopId = null } = {}) {
    const adopting = typeof adoptTopId === 'string' && adoptTopId.length > 0;
    if ((!adopting && (this._handle || this._registration)) ||
        (adopting && !this._handle) || this._dragging || this._legacySuspended) {
      throw Object.assign(new Error('Countertop spatial writer is active'), {code:'LEGACY_WRITERS_BUSY'});
    }
    this._legacySuspended = true;
    this._removeParticipant?.();
    this._removeParticipant = null;
    let resumed = false;
    return () => {
      if (resumed) return;
      this._removeParticipant = this._spatial?.addParticipant(this._participant) ?? null;
      this._legacySuspended = false;
      resumed = true;
    };
  }

  /** `() => boolean|null` judged at every drag pose: `false` = invalid (a release there snaps back), null = undecidable. */
  setDragGuard(guard) {
    this._dragGuard = typeof guard === 'function' ? guard : null;
  }

  /** The guard's verdict at the current pose; a throwing guard counts as undecidable. */
  _poseValid() {
    try { return this._dragGuard?.() ?? null; } catch (error) { this._onError?.(error); return null; }
  }

  /**
   * Offset-only mode: the drag moves u only (the handle's motion axes; the planner freezes v at its
   * current value). Explicit writes (`setOffsetM`, restore) widen the axes for their own write.
   */
  setVerticalLocked(locked) {
    this._verticalLocked = Boolean(locked);
    return this._applyAxes();
  }

  get verticalLocked() {
    return this._verticalLocked;
  }

  _applyAxes(locked = this._verticalLocked) {
    // Motion changes are BUSY mid-gesture: a toggle while dragging applies at the next write/registration.
    this._axesStale = this._dragging;
    if (!this._handle || this._dragging) return Promise.resolve();
    return Promise.resolve(this._handle.setMotion({ axes: locked ? ['u'] : ['u', 'v'] })).catch(error => this._onError?.(error));
  }

  setDragEnabled(enabled) {
    if (this._legacySuspended) throw Object.assign(new Error('Countertop spatial writer is suspended'), {code:'LEGACY_WRITERS_BUSY'});
    this._dragEnabled = Boolean(enabled);
    this._onChange?.('drag-enabled');
    return this._dragEnabled;
  }

  /** Applied offset (m) from the standard position. */
  getOffsetM() {
    const offset = this._handle?.getState().offsetM;
    return offset ? { x: offset.u, y: offset.v } : { x: 0, y: 0 };
  }

  /** { status, collidesWith } of the last observation. */
  getCollision() {
    const collision = this._handle?.getState().collision;
    return { status: collision?.status ?? 'unknown', collidesWith: collidingObjectIds(collision) };
  }

  /** Composition geometry changed: re-measure (held while the composition settles). */
  invalidate(reason) {
    if (this._legacySuspended) return null;
    return this._spatial?.invalidate(reason) ?? null;
  }

  /**
   * Register the countertop spec for one binding generation.
   *
   * @param {object} binding
   * @param {number} binding.generation
   * @param {string} binding.productId
   * @param {object} binding.root                 countertop root entity
   * @param {{ x: number, y: number }} binding.savedOffsetM offset to restore (m)
   * @param {() => boolean} binding.isCurrent     the binding is still the adapter's current one
   * @param {() => boolean} binding.isSelected
   * @param {() => object|null} binding.getAssembly     assembly (transform targets)
   * @param {() => object|null} binding.getRoot
   * @param {() => object|null} binding.getBasePositionM layout-owned standard position
   * @param {(offsetM: { x: number, y: number }) => void} binding.onCommit a drag ended
   * @param {() => number} [binding.getCoverThicknessM] cabinet-cover thickness (0 = unknown: no cover snap targets)
   * @param {() => any} [binding.afterPose]       the targets were just written (pose change, rebase); returns the sink state
   * @param {(sink: any) => void} [binding.restoreSink] put back the sink state `afterPose` returned (before a snap back)
   */
  register({ generation, productId, root, savedOffsetM, isCurrent, isSelected, getAssembly, getRoot, getBasePositionM, getCoverThicknessM = null, onCommit, afterPose = null, restoreSink = null }) {
    if (this._legacySuspended) throw Object.assign(new Error('Countertop spatial writer is suspended'), {code:'LEGACY_WRITERS_BUSY'});
    this.release();
    this._afterPose = afterPose;
    this._restoreSink = restoreSink;
    const host = {
      fixedZ: Number(root?.getPosition?.()?.z) || 0,
      transformTargets: () => (getAssembly()?.transformTargets || []).map(target => target?.entity).filter(Boolean),
      pickEntities: () => (getRoot() ? [getRoot()] : []),
      coverThicknessM: () => Math.max(0, Number(getCoverThicknessM?.()) || 0),
      // The layout owns the countertop's standard X/Y; the drag owns only the offset from it.
      beforeCapture: () => {
        const base = getBasePositionM();
        const countertopRoot = getRoot();
        const local = countertopRoot?.getLocalPosition?.();
        if (
          countertopRoot?.parent && local &&
          Number.isFinite(base?.x) && Number.isFinite(base?.y)
        ) {
          countertopRoot.setLocalPosition(Number(base.x), Number(base.y), Number(local.z));
          countertopRoot.syncHierarchy?.();
        }
      }
    };
    const registration = this._spatial.world.register(countertopManipulable, {
      body: productId,
      host,
      // One instance per binding generation: a rebind never collides with a handle still being torn down.
      id: `countertop:${productId}:${generation}`,
      canDrag: () => !this._legacySuspended && this._dragEnabled && Boolean(isSelected())
    });
    this._registration = registration;
    return registration.then(async handle => {
      if (!isCurrent() || this._registration !== registration) {
        await handle.destroy({ restoreStandard: false });
        return null;
      }
      this._handle = handle;
      if (savedOffsetM && (savedOffsetM.x !== 0 || savedOffsetM.y !== 0)) {
        await handle.setOffset({ u: savedOffsetM.x, v: savedOffsetM.y }, { constraint: 'bypass' });
        await handle.whenSettled();
      }
      if (this._verticalLocked) await this._applyAxes();
      // Snap back: a release at an invalid pose (the guard says false) returns the top to the last pose the
      // guard allowed during the gesture, else to where the gesture started; then the pose is committed.
      const finish = async () => {
        if (this._legacySuspended) return;
        this._dragging = false;
        const back = this._lastValidOffsetM;
        const backSink = this._lastValidSinkM;
        this._lastValidOffsetM = null;
        this._lastValidSinkM = null;
        if (back && this._poseValid() === false && this._handle === handle) {
          try {
            // The rejected pose may have re-owned the sink: the snap back must not read as a fresh lift.
            if (backSink) this._restoreSink?.(backSink);
            await handle.setOffset({ u: back.x, v: back.y }, { constraint: 'bypass' });
            await handle.whenSettled();
          } catch (error) { this._onError?.(error); }
          if (this._legacySuspended || this._handle !== handle) return;
        }
        // A lock toggled mid-gesture applies now (after the snap back: the axis freeze would hold v).
        if (this._axesStale) await this._applyAxes();
        onCommit?.(this.getOffsetM());
        this._onChange?.('drag-end');
      };
      this._off = [
        handle.on('change', () => {
          if (this._legacySuspended) return;
          this._poseSinkM = this._afterPose?.() ?? null;
          this._onChange?.(this._dragging ? 'drag' : 'move');
          if (this._dragging && this._poseValid() !== false) {
            this._lastValidOffsetM = this.getOffsetM();
            this._lastValidSinkM = this._poseSinkM;
          }
        }),
        handle.on('collision', () => { if (!this._legacySuspended) this._onChange?.('collision'); }),
        handle.on('gesturestart', () => {
          if (this._legacySuspended) return;
          this._dragging = true; this._lastValidOffsetM = this.getOffsetM();
          this._lastValidSinkM = this._poseSinkM ?? (this._poseSinkM = this._afterPose?.() ?? null); // first gesture after a restore
          this._onChange?.('drag-start');
        }),
        handle.on('gestureend', finish),
        handle.on('gesturecancel', finish)
      ];
      this._onChange?.('registered');
      return handle;
    }).catch(error => {
      this._onError?.(error);
      return null;
    });
  }

  /** Move to an offset (m) from the standard position. */
  async setOffsetM(offsetM, { constraint = 'respect' } = {}) {
    if (this._legacySuspended) throw Object.assign(new Error('Countertop spatial writer is suspended'), {code:'LEGACY_WRITERS_BUSY'});
    const handle = this._handle ?? await this._registration;
    if (!handle) throw Object.assign(new Error('The countertop is not registered yet'), { code: 'COUNTERTOP_NOT_READY' });
    if (this._verticalLocked) await this._applyAxes(false);
    try {
      await handle.setOffset({ u: offsetM.x, v: offsetM.y }, { constraint });
      await handle.whenSettled();
    } finally {
      if (this._verticalLocked) await this._applyAxes();
    }
    return this.getOffsetM();
  }

  /** The layout re-laid the countertop out: recapture the pose base (offset re-applied). */
  rebase() {
    if (this._legacySuspended) return;
    this._handle?.rebasePose();
    this._poseSinkM = this._afterPose?.() ?? null;
  }

  /** Drop the current handle (binding reset). */
  release({ propagateError = false } = {}) {
    for (const off of this._off) off?.();
    this._off = [];
    const handle = this._handle;
    this._handle = null;
    this._registration = null;
    this._dragging = false;
    const operation = handle?.destroy({ restoreStandard: false }) ?? Promise.resolve();
    return operation.catch(error => {
      this._onError?.(error);
      if (propagateError) throw error;
    });
  }

  destroy() {
    this.release();
    this._removeParticipant?.();
    this._removeParticipant = null;
  }
}
