import * as playcanvas from 'playcanvas';

import { createCountertopPublicSnapshot } from './countertop-state.mjs';

export const COUNTERTOP_EVENT = Object.freeze({
  CHANGE: 'change',
  ACTION: 'action'
});

export const COUNTERTOP_CHANGE_PHASE = Object.freeze({
  CURRENT: 'current',
  START: 'start',
  UPDATE: 'update',
  END: 'end'
});

const VALID_EVENTS = Object.freeze(new Set(Object.values(COUNTERTOP_EVENT)));
const VALID_CHANGE_PHASES = Object.freeze(new Set(Object.values(COUNTERTOP_CHANGE_PHASE)));
const DEFAULT_ACTION_TYPE = 'edit-size';
const DEFAULT_CHANGE_SOURCE = 'state';
const UPDATE_EVENT = 'update';

const noop = () => {};

const isFunction = (value) => typeof value === 'function';

class LocalEventHandler {
  constructor() {
    this._listeners = new Map();
  }

  on(event, callback) {
    if (!isFunction(callback)) return;
    const listeners = this._listeners.get(event) || new Set();
    listeners.add(callback);
    this._listeners.set(event, listeners);
  }

  off(event, callback) {
    if (event === undefined) {
      this._listeners.clear();
      return;
    }

    if (callback === undefined) {
      this._listeners.delete(event);
      return;
    }

    const listeners = this._listeners.get(event);
    if (!listeners) return;
    listeners.delete(callback);
    if (listeners.size === 0) this._listeners.delete(event);
  }

  fire(event, payload) {
    const listeners = this._listeners.get(event);
    if (!listeners) return;
    for (const callback of Array.from(listeners)) {
      callback(payload);
    }
  }
}

const EventHandler = playcanvas?.EventHandler ||
  playcanvas?.default?.EventHandler ||
  globalThis?.pc?.EventHandler ||
  LocalEventHandler;

const resolveChangePhase = (phase) => (
  VALID_CHANGE_PHASES.has(phase)
    ? phase
    : COUNTERTOP_CHANGE_PHASE.CURRENT
);

const resolveChangeSource = (source) => (
  source === null || source === undefined || source === ''
    ? DEFAULT_CHANGE_SOURCE
    : String(source)
);

const defaultListenerErrorHandler = ({ event, error }) => {
  if (typeof console !== 'undefined' && isFunction(console.error)) {
    console.error(`Countertop ${event} listener failed`, error);
  }
};

export class CountertopEvents {
  constructor(app, options = {}) {
    this._app = app || null;
    this._events = new EventHandler();
    this._subscriptions = new Set();
    this._pendingUpdateSnapshot = null;
    this._isAppUpdateBound = false;
    this._destroyed = false;
    this._lastEndKey = null;
    this._lastStateM = options.initialStateM;
    this._getStateM = isFunction(options.getStateM) ? options.getStateM : null;
    this._onAppUpdate = this._flushPendingUpdate.bind(this);
    this._onListenerError = isFunction(options.onListenerError)
      ? options.onListenerError
      : defaultListenerErrorHandler;
  }

  on(event, callback, options = {}) {
    if (!VALID_EVENTS.has(event) || !isFunction(callback) || this._destroyed) {
      return noop;
    }

    const subscription = {
      event,
      callback,
      active: true,
      wrapped: null
    };

    subscription.wrapped = (payload) => {
      this._deliver(subscription, payload);
    };

    this._subscriptions.add(subscription);
    this._events.on(event, subscription.wrapped);

    if (event === COUNTERTOP_EVENT.CHANGE && options?.emitCurrent) {
      this._deliver(subscription, this.emitCurrent(options.stateM, {
        source: options.source
      }, { fire: false }));
    }

    return () => {
      this._unsubscribe(subscription);
    };
  }

  off(event, callback) {
    if (!VALID_EVENTS.has(event)) return;

    for (const subscription of Array.from(this._subscriptions)) {
      if (subscription.event !== event) continue;
      if (callback !== undefined && subscription.callback !== callback) continue;
      this._unsubscribe(subscription);
    }
  }

  emitCurrent(stateM, metadata = {}, options = {}) {
    return this.emitChange(stateM, {
      ...metadata,
      phase: COUNTERTOP_CHANGE_PHASE.CURRENT,
      source: metadata.source || DEFAULT_CHANGE_SOURCE
    }, options);
  }

  emitChange(stateM, metadata = {}, options = {}) {
    const snapshot = this._createChangeSnapshot(stateM, metadata);
    if (this._destroyed) return snapshot;

    if (snapshot.phase === COUNTERTOP_CHANGE_PHASE.UPDATE) {
      this._queueUpdate(snapshot);
      return snapshot;
    }

    if (snapshot.phase === COUNTERTOP_CHANGE_PHASE.END) {
      this._clearPendingUpdate();
      if (this._isDuplicateEnd(snapshot)) return snapshot;
      this._lastEndKey = this._createEndKey(snapshot);
    } else if (snapshot.phase === COUNTERTOP_CHANGE_PHASE.START) {
      this._lastEndKey = null;
    }

    if (options.fire !== false) {
      this._events.fire(COUNTERTOP_EVENT.CHANGE, snapshot);
    }

    return snapshot;
  }

  emitAction(type = DEFAULT_ACTION_TYPE, stateM, metadata = {}) {
    const actionType = type === null || type === undefined || type === ''
      ? DEFAULT_ACTION_TYPE
      : String(type);
    const payload = Object.freeze({
      type: actionType,
      state: this._createChangeSnapshot(stateM, {
        ...metadata,
        phase: metadata.phase || COUNTERTOP_CHANGE_PHASE.CURRENT,
        source: metadata.source || DEFAULT_CHANGE_SOURCE
      })
    });

    if (!this._destroyed) {
      this._events.fire(COUNTERTOP_EVENT.ACTION, payload);
    }

    return payload;
  }

  destroy() {
    if (this._destroyed) return;

    this._destroyed = true;
    this._clearPendingUpdate();

    for (const subscription of Array.from(this._subscriptions)) {
      this._unsubscribe(subscription);
    }

    this._events.off();
  }

  _createChangeSnapshot(stateM, metadata = {}) {
    const resolvedStateM = this._resolveStateM(stateM);
    this._lastStateM = resolvedStateM;

    return createCountertopPublicSnapshot(resolvedStateM, {
      ...metadata,
      phase: resolveChangePhase(metadata.phase),
      source: resolveChangeSource(metadata.source)
    });
  }

  _resolveStateM(stateM) {
    if (stateM !== undefined) return stateM;
    if (this._getStateM) return this._getStateM();
    return this._lastStateM;
  }

  _queueUpdate(snapshot) {
    this._pendingUpdateSnapshot = snapshot;
    if (this._isAppUpdateBound || !this._app || !isFunction(this._app.on)) return;

    this._app.on(UPDATE_EVENT, this._onAppUpdate);
    this._isAppUpdateBound = true;
  }

  _flushPendingUpdate() {
    const snapshot = this._pendingUpdateSnapshot;
    this._clearPendingUpdate();

    if (!snapshot || this._destroyed) return;
    this._events.fire(COUNTERTOP_EVENT.CHANGE, snapshot);
  }

  _clearPendingUpdate() {
    this._pendingUpdateSnapshot = null;

    if (!this._isAppUpdateBound || !this._app || !isFunction(this._app.off)) {
      this._isAppUpdateBound = false;
      return;
    }

    this._app.off(UPDATE_EVENT, this._onAppUpdate);
    this._isAppUpdateBound = false;
  }

  _unsubscribe(subscription) {
    if (!subscription || !subscription.active) return;

    subscription.active = false;
    this._subscriptions.delete(subscription);
    this._events.off(subscription.event, subscription.wrapped);
  }

  _deliver(subscription, payload) {
    if (!subscription.active || this._destroyed) return;

    try {
      subscription.callback(payload);
    } catch (error) {
      this._reportListenerError(subscription.event, error, payload);
    }
  }

  _reportListenerError(event, error, payload) {
    try {
      this._onListenerError({ event, error, payload });
    } catch (handlerError) {
      defaultListenerErrorHandler({ event, error: handlerError, payload });
    }
  }

  _isDuplicateEnd(snapshot) {
    return this._lastEndKey === this._createEndKey(snapshot);
  }

  _createEndKey(snapshot) {
    return `${snapshot.source}:${snapshot.revision}`;
  }
}

export function createCountertopEvents(app, options) {
  return new CountertopEvents(app, options);
}
