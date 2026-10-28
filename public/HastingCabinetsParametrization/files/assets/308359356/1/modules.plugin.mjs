/**
 * window.ConfiguratorAPI.modules — state and free positioning of composition modules (cabinets).
 * Offsets are metres, world XY, measured from each module's slot in the packed row.
 *
 *   modules.getState(productId?)             one module or the complete state map
 *   modules.on('change', callback, options)  state changes; options.emitCurrent sends a snapshot
 *   modules.setDragEnabled(true)             let the selected module be dragged
 *   modules.setOffset(productId, { x, y })   move a module
 *   modules.resetOffset(productId)           return a module to its slot
 */
import {
  MODULES_CHANGE_REASON,
  MODULES_ERROR_CODE,
  MODULES_PUBLIC_CONTRACT_V1
} from '../../domain/composition/spatial/modules-contract.mjs';

const finite = value => typeof value === 'number' && Number.isFinite(value);
const error = (code, message) => Object.assign(new Error(message), { code });
const invalid = message => error(MODULES_ERROR_CODE.INVALID_INPUT, message);

export class ModulesPlugin {
  static create(ctx) {
    return new ModulesPlugin(ctx);
  }

  constructor({ app } = {}) {
    this._app = app || null;
    this._subscriptions = new Set();
    this._bound = null;
    this._destroyed = false;
    this._onUpdate = () => this._bindSubscriptions();
    this._app?.on?.('update', this._onUpdate);

    this.api = Object.freeze({
      contract: MODULES_PUBLIC_CONTRACT_V1,
      getState: productId => this.getState(productId),
      isDragEnabled: () => Boolean(this._controller()?.dragEnabled),
      setDragEnabled: enabled => {
        if (typeof enabled !== 'boolean') throw invalid('enabled must be a boolean');
        return this._require().setDragEnabled(enabled);
      },
      setOffset: async (productId, offset) => {
        this._assertProductId(productId);
        if (!offset || !finite(offset.x) || !finite(offset.y) || Object.keys(offset).some(key => key !== 'x' && key !== 'y')) {
          throw invalid('offset must be { x, y } in metres');
        }
        return this._require().setOffset(productId, { x: offset.x, y: offset.y });
      },
      resetOffset: async productId => {
        this._assertProductId(productId);
        return this._require().resetOffset(productId);
      },
      whenSettled: async () => this._require().whenSettled(),
      on: (event, callback, options) => this.on(event, callback, options),
      off: (event, callback) => this.off(event, callback)
    });
  }

  getState(productId = undefined) {
    if (productId !== undefined) this._assertProductId(productId);
    const allState = this._controller()?.getState() ?? {};
    return productId === undefined ? allState : allState[productId] ?? null;
  }

  on(event, callback, { emitCurrent = false } = {}) {
    this._assertAlive();
    if (event !== 'change') throw invalid('event must be "change"');
    if (typeof callback !== 'function') throw invalid('callback must be a function');
    const record = { event, callback, unsubscribe: null };
    this._subscriptions.add(record);
    this._bindSubscriptions();
    if (this._bound && !record.unsubscribe) record.unsubscribe = this._bound.on(event, payload => this._deliver(record, payload));
    if (emitCurrent) {
      this._deliver(record, Object.freeze({
        reason: MODULES_CHANGE_REASON.CURRENT,
        productId: null,
        state: null,
        allState: Object.freeze(this.getState())
      }));
    }
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
    this._app?.off?.('update', this._onUpdate);
    for (const record of [...this._subscriptions]) this._unsubscribe(record);
    this._app = null;
  }

  _controller() {
    return this._app?.compositionManager?.modules ?? null;
  }

  _require() {
    this._assertAlive();
    const controller = this._controller();
    if (!controller) throw error(MODULES_ERROR_CODE.NOT_READY, 'Composition modules are not available');
    return controller;
  }

  _bindSubscriptions() {
    const controller = this._controller();
    if (controller === this._bound) return;
    this._bound = controller;
    for (const record of this._subscriptions) {
      record.unsubscribe?.();
      record.unsubscribe = controller ? controller.on(record.event, payload => this._deliver(record, payload)) : null;
    }
  }

  _deliver(record, payload) {
    if (!this._subscriptions.has(record)) return;
    try {
      record.callback(payload);
    } catch (listenerError) {
      console.error(`Modules ${record.event} listener failed`, listenerError);
    }
  }

  _unsubscribe(record) {
    record.unsubscribe?.();
    record.unsubscribe = null;
    this._subscriptions.delete(record);
  }

  _assertProductId(productId) {
    if (typeof productId !== 'string' || !productId) throw invalid('productId must be a non-empty string');
  }

  _assertAlive() {
    if (this._destroyed) throw error(MODULES_ERROR_CODE.DESTROYED, 'Modules API facade is destroyed');
  }
}
