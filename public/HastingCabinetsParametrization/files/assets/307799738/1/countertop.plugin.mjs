/**
 * window.ConfiguratorAPI.countertop — the countertop on the same model as `ConfiguratorAPI.modules`.
 * All values are metres, world XY; the offset is measured from the countertop's standard
 * (composition) position.
 *
 *   countertop.setDragEnabled(true)     let the selected countertop be dragged with the pointer
 *   countertop.setOffset({ x, y })      move it (snapping does not apply to API moves)
 *   countertop.setVerticalLocked(bool)  offset-only mode (e.g. 4″ tops): no lift — setOffset with y > 1 cm
 *                                       throws COUNTERTOP_VERTICAL_LOCKED, the pointer drag moves x only;
 *                                       a restored lifted pose is kept (getState().verticalLockViolated)
 *   countertop.resetOffset()            back onto the composition (drops a custom length; the sink back in a sink base)
 *   countertop.setSize({ length })      custom length — only while moved off the composition;
 *                                       `{ length: null }` follows the composition again
 *   countertop.resizeFrom('left'|'right', lengthM)  resize the top (standard or moved) from one end; the other end
 *                                       stays fixed (clamped to the length limits)
 *   countertop.setLengthLimits({ minM, maxM } | null)  per-collection length limits (null = 0.6 m … 120 in);
 *                                       the effective min also keeps every basin cut-out inside
 *   countertop.getState()               { readiness, attached, canResize, offset, size, lengthLimitsM, collision, … }
 *                                       sink: { owner: 'cabinet'|'countertop', shiftM, landing, pending } while lifted —
 *                                       landing = { status: 'none'|'home'|'fits'|'gap'|'unfit', cabinetId, fromCabinetId,
 *                                       reason, snapDxM }; lowering on 'gap'/'unfit' is invalid (validation reasons
 *                                       SINK_LANDING_GAP / SINK_LANDING_UNFIT, snaps back); on 'fits' the sink stays
 *                                       carried and sink.pending ({ cabinetId, fromCabinetId, status }) is set until cabinets.moveSink
 *                                       commits it; a 'home' pending (cabinetId null with several SB sinks) is settled by
 *                                       the adapter itself (the whole top snaps by snapDxM), the UI commits nothing.
 *                                       landing { status: 'none', reason: 'DETACHED' }: the sink is beside the row — valid.
 *                                       sink.hosted: true while the top hosts the sink (HR-CT-02, after cabinets.liftSink):
 *                                       owner 'countertop' at any height, landing.fromCabinetId null, no 'home'
 *
 * window.ConfiguratorAPI.countertopOverlay (this.overlayApi) — the Drag & Drop visuals of the
 * countertop (tint, outline, screen anchors): see domain/countertop/adapters/countertop-drag-overlay.mjs.
 *   countertop.on('change' | 'action', callback, { emitCurrent }) → unsubscribe
 *     'action' forwards the adapter's actions as-is, e.g. { type: 'sink-landing', landing } on a 'fits' release
 *     (hosted: fromCabinetId null → cabinets.landSink({ toCabinetId })), and { type: 'sink-lift', fromCabinetId,
 *     sinkLocalM: { x, y, z } } once per lift of a top carrying one SB's sink (drag-end / setOffset) → cabinets.liftSink
 *
 * Length rule: attached (no offset) → the composition's length; moved → a custom length may be set.
 */
import {
  COUNTERTOP_CHANGE_REASON,
  COUNTERTOP_ERROR_CODE,
  COUNTERTOP_PUBLIC_CONTRACT_V1
} from '../../domain/countertop/countertop-contract.mjs';
import { normalizeCountertopLengthLimits } from '../../domain/countertop/countertop-length-limits.mjs';
import { createCountertopDragOverlay } from '../../domain/countertop/adapters/countertop-drag-overlay.mjs';

const EVENTS = Object.freeze(new Set(['change', 'action']));
const finite = value => typeof value === 'number' && Number.isFinite(value);
const error = (code, message) => Object.assign(new Error(message), { code });
const invalid = message => error(COUNTERTOP_ERROR_CODE.INVALID_INPUT, message);

const onlyKeys = (value, keys, name) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid(`${name} must be an object`);
  const unknown = Object.keys(value).filter(key => !keys.includes(key));
  if (unknown.length) throw invalid(`${name}: unknown key "${unknown[0]}"`);
};
/** `{ validation: 'guard' | 'skip' }` (default guard: an invalid pose is rejected with COUNTERTOP_POSE_INVALID). */
const validationOptions = options => {
  if (options === undefined) return {};
  onlyKeys(options, ['validation'], 'options');
  if (options.validation !== undefined && options.validation !== 'guard' && options.validation !== 'skip') throw invalid('options.validation must be "guard" or "skip"');
  return options.validation === undefined ? {} : { validation: options.validation };
};

const WAITING_STATE = Object.freeze({ unit: 'm', readiness: COUNTERTOP_PUBLIC_CONTRACT_V1.readiness.WAITING, productId: null });

export class CountertopPlugin {
  static create(ctx) {
    return new CountertopPlugin(ctx);
  }

  constructor({ app, overlay = {} } = {}) {
    this._app = app || null;
    this._lengthLimits = null;
    this._subscriptions = new Set();
    this._bound = null;
    this._destroyed = false;
    // The adapter is created by the composition manager; bind listeners once it exists.
    this._onUpdate = () => this._bindSubscriptions();
    this._app?.on?.('update', this._onUpdate);

    this.api = Object.freeze({
      contract: COUNTERTOP_PUBLIC_CONTRACT_V1,
      getState: () => this.getState(),
      isDragEnabled: () => Boolean(this._adapter()?.dragEnabled),
      setDragEnabled: enabled => {
        if (typeof enabled !== 'boolean') throw invalid('enabled must be a boolean');
        return this._require().setDragEnabled(enabled);
      },
      setOffset: async (offset, options) => {
        onlyKeys(offset, ['x', 'y'], 'offset');
        if (!finite(offset.x) || !finite(offset.y)) throw invalid('offset must be { x, y } in metres');
        return this._require().setOffsetM({ x: offset.x, y: offset.y }, validationOptions(options));
      },
      resetOffset: async () => this._require().resetOffset(),
      setVerticalLocked: locked => {
        if (typeof locked !== 'boolean') throw invalid('locked must be a boolean');
        return this._require().setVerticalLocked(locked);
      },
      setSize: async size => {
        onlyKeys(size, ['length'], 'size');
        if (size.length !== null && !(finite(size.length) && size.length > 0)) {
          throw invalid('size.length must be a positive number of metres or null');
        }
        return this._require().setLengthM(size.length);
      },
      resizeFrom: async (side, lengthM, options) => this._require().resizeFromM(side, lengthM, validationOptions(options)),
      setLengthLimits: limits => {
        let normalized;
        try { normalized = limits === null ? null : normalizeCountertopLengthLimits(limits); }
        catch (cause) { throw invalid(cause.message); }
        this._lengthLimits = normalized;
        this._adapter()?.setLengthLimitsM?.(normalized);
        return this.getState();
      },
      whenSettled: async () => {
        await this._adapter()?.whenSettled();
        return this.getState();
      },
      on: (event, callback, options) => this.on(event, callback, options),
      off: (event, callback) => this.off(event, callback)
    });
    this._overlay = this._app ? createCountertopDragOverlay({ app: this._app, getAdapter: () => this._adapter(),
      onError: (stage, cause) => console.error(`Countertop overlay ${stage} failed`, cause), ...overlay }) : null;
    this.overlayApi = this._overlay?.api ?? null;
  }

  getState() {
    return this._adapter()?.getState() ?? WAITING_STATE;
  }

  on(event, callback, { emitCurrent = false } = {}) {
    this._assertAlive();
    if (!EVENTS.has(event)) throw invalid('event must be "change" or "action"');
    if (typeof callback !== 'function') throw invalid('callback must be a function');
    const record = { event, callback, unsubscribe: null };
    this._subscriptions.add(record);
    this._bindSubscriptions();
    if (this._bound && !record.unsubscribe) record.unsubscribe = this._bound.on(event, payload => this._deliver(record, payload));
    if (event === 'change' && emitCurrent) this._deliver(record, Object.freeze({ reason: COUNTERTOP_CHANGE_REASON.CURRENT, state: this.getState() }));
    return () => this._unsubscribe(record);
  }

  off(event, callback) {
    for (const record of [...this._subscriptions]) {
      if (record.event === event && (callback === undefined || record.callback === callback)) this._unsubscribe(record);
    }
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    try { this._bound?.setDragGuard?.(null); this._bound?.setPoseValidator?.(null); } catch { /* best effort */ }
    this._overlay?.destroy();
    this._app?.off?.('update', this._onUpdate);
    for (const record of [...this._subscriptions]) this._unsubscribe(record);
    this._app = null;
  }

  _adapter() {
    return this._app?.compositionManager?.countertopCompositionAdapter ?? null;
  }

  _require() {
    this._assertAlive();
    const adapter = this._adapter();
    if (!adapter) throw error(COUNTERTOP_ERROR_CODE.NOT_READY, 'The composition manager is not ready');
    return adapter;
  }

  /** (Re)bind every subscription to the current adapter (it lives as long as the composition manager). */
  _bindSubscriptions() {
    const adapter = this._adapter();
    if (adapter === this._bound) return;
    // The trap keep-out guard (snap back on release) binds with the adapter, not with the visuals.
    try {
      this._bound?.setDragGuard?.(null); this._bound?.setPoseValidator?.(null);
      adapter?.setDragGuard?.(this._overlay?.dragGuard ?? null); adapter?.setPoseValidator?.(this._overlay?.dragGuard?.evaluate ?? null);
    }
    catch (cause) { console.error('Countertop drag guard failed', cause); }
    this._bound = adapter;
    // Limits set before the composition manager existed apply to the new adapter.
    if (adapter && this._lengthLimits) {
      try { adapter.setLengthLimitsM?.(this._lengthLimits); } catch (cause) { console.error('Countertop length limits failed', cause); }
    }
    for (const record of this._subscriptions) {
      record.unsubscribe?.();
      record.unsubscribe = adapter ? adapter.on(record.event, payload => this._deliver(record, payload)) : null;
    }
  }

  _deliver(record, payload) {
    if (!this._subscriptions.has(record)) return;
    try {
      record.callback(payload);
    } catch (listenerError) {
      console.error(`Countertop ${record.event} listener failed`, listenerError);
    }
  }

  _unsubscribe(record) {
    record.unsubscribe?.();
    record.unsubscribe = null;
    this._subscriptions.delete(record);
  }

  _assertAlive() {
    if (this._destroyed) throw error(COUNTERTOP_ERROR_CODE.DESTROYED, 'Countertop API facade is destroyed');
  }
}
