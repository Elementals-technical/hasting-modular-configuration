/**
 * Composition modules on spatial manipulation: one `moduleManipulable` handle per cabinet of
 * the active composition, registered in the app's spatial World.
 *
 * - The offset from the module's packed slot is persisted on the product snapshot
 *   (`SpatialOffsetM: { x, y }`) and re-applied after every layout and on restore.
 * - Layout runs on standard positions: `withStandardPositions(fn)` takes every module off its
 *   offset, lets the layout pack the slots, then re-captures the slots and re-applies offsets.
 * - A finished move notifies the composition (`updateProductInComposition`) so the aggregation
 *   rules (countertop width, side panels, collision refresh …) follow the moved module.
 * - Dragging is opt-in (`setDragEnabled(true)`) and limited to the selected module.
 * - Collision is observed only; `CollisionOutline` shows it (the same for the countertop).
 */
import { CollisionOutline, collidingObjectIds } from './collision-outline.mjs';
import { readSpatialOffsetM, SPATIAL_OFFSET_KEY } from './composition-spatial.mjs';
import { moduleManipulable } from './module.manipulable.mjs';
import {
  MODULES_CHANGE_REASON,
  MODULES_ERROR_CODE,
  MODULES_INTERACTION_STATE,
  MODULES_MOTION_STATE,
  MODULES_PLACEMENT_STATE,
  MODULES_READINESS,
  MODULES_RELATION_KIND,
  MODULES_RELATION_MODE,
  MODULES_RELATION_STATE
} from './modules-contract.mjs';

const read = (snapshot, key) => (typeof snapshot?.get === 'function' ? snapshot.get(key) : snapshot?.[key]);
const offsetOf = readSpatialOffsetM;
const same = (a, b) => Math.abs(a.x - b.x) <= 1e-9 && Math.abs(a.y - b.y) <= 1e-9;
const moved = offset => Math.abs(offset.x) > 1e-9 || Math.abs(offset.y) > 1e-9;
const CONTACT_RULES = new Set(['u-abut', 'v-stack']);
const RELATION_MODES = Object.freeze({
  'u-abut': MODULES_RELATION_MODE.SIDE_BY_SIDE,
  'u-row-edge': MODULES_RELATION_MODE.ROW_EDGE,
  'u-flush': MODULES_RELATION_MODE.FLUSH,
  'u-center': MODULES_RELATION_MODE.CENTERED,
  'v-floor': MODULES_RELATION_MODE.FLOOR,
  'v-stack': MODULES_RELATION_MODE.STACKED,
  'v-level': MODULES_RELATION_MODE.LEVEL
});

const publicSnapRelations = state => (state?.snapping?.active ?? [])
  .filter(pair => pair?.satisfiedAtAppliedPose !== false && pair?.target?.objectId && pair.target.objectId !== 'row')
  .map(pair => Object.freeze({
    targetId: pair.target.objectId,
    kind: CONTACT_RULES.has(pair.ruleId) ? MODULES_RELATION_KIND.TOUCHING : MODULES_RELATION_KIND.ALIGNED,
    mode: RELATION_MODES[pair.ruleId] ?? MODULES_RELATION_MODE.ALIGNED,
    ruleId: pair.ruleId,
    axes: Object.freeze((pair.controlledAxes ?? []).map(axis => axis === 'u' ? 'x' : 'y')),
    sourceFeatureId: pair.source?.featureId ?? null,
    targetFeatureId: pair.target?.featureId ?? null
  }));

export class CompositionModules {
  /**
   * @param {object} options
   * @param {object} options.app
   * @param {object} options.compositionManager
   * @param {() => object} options.getWorld the app's spatial world (shared with the countertop)
   */
  constructor({ app, compositionManager, getWorld }) {
    this._app = app;
    this._manager = compositionManager;
    this._getWorld = getWorld;
    this._handles = new Map(); // productId -> { handle, registration, entity }
    this._generation = 0;
    this._activeCompositionId = null;
    this._activationGeneration = 0;
    this._activationOperation = null;
    this._dragEnabled = false;
    this._destroyed = false;
    this._legacySuspended = false;
    this._listeners = new Set();
    this._onSelectionChanged = () => this._emitChange(MODULES_CHANGE_REASON.SELECTION);
    this._app?.on?.('selection:change', this._onSelectionChanged, this);
  }

  get dragEnabled() {
    return this._dragEnabled;
  }

  setDragEnabled(enabled) {
    if (enabled) this._manager?.assertCompositionMutable?.();
    this._dragEnabled = Boolean(enabled);
    this._emitChange(MODULES_CHANGE_REASON.DRAG_ENABLED);
    return this._dragEnabled;
  }

  on(event, callback) {
    if (event !== 'change') throw Object.assign(new Error('event must be "change"'), { code: MODULES_ERROR_CODE.INVALID_INPUT });
    if (typeof callback !== 'function') throw Object.assign(new Error('callback must be a function'), { code: MODULES_ERROR_CODE.INVALID_INPUT });
    this._listeners.add(callback);
    return () => this._listeners.delete(callback);
  }

  off(event, callback) {
    if (event !== 'change') return;
    if (callback === undefined) this._listeners.clear();
    else this._listeners.delete(callback);
  }

  getHandle(productId) {
    return this._handles.get(productId)?.handle ?? null;
  }

  activateComposition(compositionId = null) {
    if (this._legacySuspended) return Promise.resolve(this.getState());
    if (this._destroyed) return Promise.resolve(this.getState());
    const activeCompositionId = compositionId ?? this._currentCompositionId();
    const activationGeneration = ++this._activationGeneration;
    this._activeCompositionId = activeCompositionId;
    const oldRecords = this._detachAllRecords();
    void this._destroyRecords(oldRecords);
    const operation = (async () => {
      if (!this._isCurrentActivation(activeCompositionId, activationGeneration)) return this.getState();
      await this.sync({ compositionId: activeCompositionId, activationGeneration });
      if (this._isCurrentActivation(activeCompositionId, activationGeneration)) {
        this._emitChange(MODULES_CHANGE_REASON.COMPOSITION_ACTIVATED);
      }
      return this.getState();
    })();
    const tracked = operation.finally(() => {
      if (this._activationOperation === tracked) this._activationOperation = null;
    });
    this._activationOperation = tracked;
    return tracked;
  }

  /**
   * Public cabinet state. `contacts` contains satisfied contact snaps only; `order` describes
   * row neighbours and must not be interpreted as a persistent mechanical attachment.
   */
  getState() {
    const composition = this._manager?.getActiveComposition?.();
    const order = composition?.getOrderProductIds?.() ?? {};
    const orderedIds = [...this._handles.keys()].sort((left, right) => {
      const leftIndex = Number(order[left]);
      const rightIndex = Number(order[right]);
      if (Number.isFinite(leftIndex) && Number.isFinite(rightIndex)) return leftIndex - rightIndex;
      if (Number.isFinite(leftIndex)) return -1;
      if (Number.isFinite(rightIndex)) return 1;
      return left.localeCompare(right);
    });
    const neighbours = new Map(orderedIds.map((productId, index) => [productId, {
      previousId: orderedIds[index - 1] ?? null,
      nextId: orderedIds[index + 1] ?? null
    }]));
    return Object.fromEntries([...this._handles.entries()].map(([productId, record]) => {
      const state = record.handle?.getState();
      const offset = state?.offsetM ? { x: state.offsetM.u, y: state.offsetM.v } : null;
      const isMoved = offset ? moved(offset) : false;
      const dragging = Boolean(state?.dragging);
      const selected = Boolean((this._app?.selectTool?.getSelected?.() || []).includes(record.entity));
      const relations = publicSnapRelations(state);
      const contacts = relations.filter(relation => relation.kind === MODULES_RELATION_KIND.TOUCHING);
      const layout = neighbours.get(productId) ?? { previousId: null, nextId: null };
      const collision = state?.collision?.status ?? 'unknown';
      const relationState = collision === 'colliding'
        ? MODULES_RELATION_STATE.COLLIDING
        : collision === 'unknown'
          ? MODULES_RELATION_STATE.UNKNOWN
        : contacts.length
          ? MODULES_RELATION_STATE.TOUCHING
          : relations.length
            ? MODULES_RELATION_STATE.SNAPPED
            : !isMoved && (layout.previousId || layout.nextId)
              ? MODULES_RELATION_STATE.LAYOUT_ADJACENT
              : state
                ? MODULES_RELATION_STATE.FREE
                : MODULES_RELATION_STATE.UNKNOWN;
      return [productId, Object.freeze({
        unit: 'm',
        productId,
        readiness: state ? MODULES_READINESS.READY : MODULES_READINESS.WAITING,
        selected,
        moved: isMoved,
        moving: dragging,
        dragging,
        dragEnabled: this._dragEnabled,
        placementState: state ? (isMoved ? MODULES_PLACEMENT_STATE.MOVED : MODULES_PLACEMENT_STATE.STANDARD) : MODULES_PLACEMENT_STATE.WAITING,
        motionState: dragging ? MODULES_MOTION_STATE.MOVING : MODULES_MOTION_STATE.IDLE,
        interactionState: dragging ? MODULES_INTERACTION_STATE.DRAGGING : selected ? MODULES_INTERACTION_STATE.SELECTED : MODULES_INTERACTION_STATE.IDLE,
        offset: offset ? Object.freeze(offset) : null,
        collision: state?.collision?.status ?? 'unknown',
        collidesWith: Object.freeze(collidingObjectIds(state?.collision)),
        order: Object.freeze({
          index: Number.isFinite(Number(order[productId])) ? Number(order[productId]) : null,
          previousId: layout.previousId,
          nextId: layout.nextId
        }),
        relationState,
        relations: Object.freeze(relations),
        contacts: Object.freeze(contacts)
      })];
    }));
  }

  async whenSettled() {
    await this._activationOperation;
    await this.sync();
    const handles = await Promise.all([...this._handles.values()].map(record => record.registration));
    await Promise.all(handles.filter(Boolean).map(handle => handle.whenSettled()));
    return this.getState();
  }

  /** Register handles for new cabinets, drop handles of removed ones. */
  sync({ compositionId = this._currentCompositionId(), activationGeneration = this._activationGeneration } = {}) {
    if (this._destroyed || this._legacySuspended) return Promise.resolve();
    if (this._activeCompositionId === null) this._activeCompositionId = compositionId;
    if (!this._isCurrentActivation(compositionId, activationGeneration)) return Promise.resolve();
    const composition = this._manager?.getActiveComposition?.();
    if ((composition?.compositionId ?? null) !== compositionId) return Promise.resolve();
    const products = composition?.getAllProducts?.() ?? {};
    const entries = products instanceof Map ? [...products.entries()] : Object.entries(products);
    const cabinets = new Map(entries.filter(([, snapshot]) => read(snapshot, 'category') === 'cabinets'));
    const work = [];
    for (const [productId, record] of this._handles) {
      const entity = this._app?.root?.findByName?.(productId) ?? null;
      if (record.compositionId !== compositionId || !cabinets.has(productId) || entity !== record.entity) {
        this._handles.delete(productId);
        this._detachRecord(record);
        this._emitChange(MODULES_CHANGE_REASON.REMOVED, productId);
        work.push(this._destroyRecord(record));
      }
    }
    for (const [productId, snapshot] of cabinets) {
      if (this._handles.has(productId)) continue;
      const entity = this._app?.root?.findByName?.(productId) ?? null;
      if (!entity) continue;
      work.push(this._register(productId, entity, offsetOf(snapshot), { compositionId, activationGeneration }));
    }
    return Promise.all(work).then(() => undefined);
  }

  _register(productId, entity, savedOffset, { compositionId, activationGeneration }) {
    const generation = ++this._generation;
    const host = { entity, fixedZ: Number(entity.getPosition?.()?.z) || 0 };
    const record = {
      handle: null,
      registration: null,
      entity,
      productId,
      compositionId,
      activationGeneration,
      unsubscribes: [],
      outline: new CollisionOutline({ app: this._app, owner: `spatial-module:${productId}` })
    };
    this._handles.set(productId, record);
    record.registration = this._getWorld().register(moduleManipulable, {
      body: productId,
      host,
      id: `module:${productId}:${generation}`,
      canDrag: () => !this._manager?.getActiveComposition?.()?.hasMutationGuard?.() &&
        this._dragEnabled && (this._app?.selectTool?.getSelected?.() || []).includes(entity)
    }).then(async handle => {
      if (this._handles.get(productId) !== record || !this._isCurrentActivation(compositionId, activationGeneration)) {
        await handle.destroy({ restoreStandard: false });
        return null;
      }
      record.handle = handle;
      if (savedOffset.x !== 0 || savedOffset.y !== 0) {
        await handle.setOffset({ u: savedOffset.x, v: savedOffset.y }, { constraint: 'bypass' });
      }
      record.unsubscribes.push(handle.on('change', () => {
        this._present(record);
        this._emitChange(handle.getState().dragging ? MODULES_CHANGE_REASON.DRAG : MODULES_CHANGE_REASON.MOVE, productId);
      }));
      record.unsubscribes.push(handle.on('collision', () => {
        this._present(record);
        this._emitChange(MODULES_CHANGE_REASON.COLLISION, productId);
      }));
      this._present(record);
      record.unsubscribes.push(handle.on('gesturestart', () => this._emitChange(MODULES_CHANGE_REASON.DRAG_START, productId)));
      record.unsubscribes.push(handle.on('gestureend', () => {
        this._persist(productId, { notify: true });
        this._emitChange(MODULES_CHANGE_REASON.DRAG_END, productId);
      }));
      record.unsubscribes.push(handle.on('gesturecancel', () => {
        this._persist(productId, { notify: true });
        this._emitChange(MODULES_CHANGE_REASON.DRAG_CANCEL, productId);
      }));
      this._emitChange(MODULES_CHANGE_REASON.REGISTERED, productId);
      return handle;
    });
    record.registration.catch(error => console.error('[CompositionModules] register failed', productId, error));
    return record.registration;
  }

  /** Red outline on the module and on everything it overlaps (CollisionOutline). */
  _present(record) {
    if (this._handles.get(record.productId) !== record) return;
    const collision = record.handle?.getState().collision;
    record.outline.update(record.entity, { status: collision?.status ?? 'unknown', collidesWith: collidingObjectIds(collision) });
  }

  /** Save the module's offset on its snapshot; `notify` runs the composition aggregation. */
  _persist(productId, { notify = false } = {}) {
    this._manager?.assertCompositionMutable?.();
    const handle = this.getHandle(productId);
    const composition = this._manager?.getActiveComposition?.();
    const snapshot = composition?.getProduct?.(productId);
    if (!handle || !snapshot) return;
    const applied = handle.getState().offsetM ?? { u: 0, v: 0 };
    const offset = { x: applied.u, y: applied.v };
    if (same(offset, offsetOf(snapshot))) return;
    if (notify) {
      this._manager.updateProductInComposition(composition.compositionId, productId, { [SPATIAL_OFFSET_KEY]: offset });
    } else {
      const next = snapshot.createNext ? snapshot.createNext({ [SPATIAL_OFFSET_KEY]: offset }) : { ...snapshot, [SPATIAL_OFFSET_KEY]: offset };
      composition.addProduct(productId, next);
    }
  }

  /** Move a module to an offset (m) from its slot and let the composition follow. */
  async setOffset(productId, offset, { constraint = 'respect' } = {}) {
    this._manager?.assertCompositionMutable?.();
    await this._activationOperation;
    await this.sync();
    const handle = await this._handles.get(productId)?.registration;
    this._manager?.assertCompositionMutable?.();
    if (!handle) throw Object.assign(new Error(`module "${productId}" is not in the active composition`), { code: MODULES_ERROR_CODE.MODULE_NOT_FOUND });
    await handle.setOffset({ u: offset.x, v: offset.y }, { constraint });
    await handle.whenSettled();
    this._persist(productId, { notify: true });
    this._emitChange(MODULES_CHANGE_REASON.OFFSET, productId);
    return this.getState()[productId];
  }

  resetOffset(productId) {
    return this.setOffset(productId, { x: 0, y: 0 }, { constraint: 'bypass' });
  }

  /**
   * Run a layout on the modules' standard (slot) positions, then put every module back on its
   * offset from the new slot. Synchronous: `fn` is the packing pass.
   */
  withStandardPositions(fn) {
    this._manager?.assertCompositionMutable?.();
    const handles = [...this._handles.values()].map(record => record.handle).filter(Boolean);
    for (const handle of handles) handle.suspendPose();
    try {
      return fn();
    } finally {
      for (const handle of handles) handle.rebasePose({ mode: 'standard' });
    }
  }

  async destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    this._app?.off?.('selection:change', this._onSelectionChanged, this);
    const records = this._detachAllRecords();
    await this._destroyRecords(records);
    this._listeners.clear();
  }

  /** Release pointer/gesture registrations while retaining the source and cabinet entities. */
  async suspendLegacy() {
    if (this._destroyed || this._legacySuspended) {
      throw Object.assign(new Error('Legacy modules unavailable for handoff'), { code: 'LEGACY_HANDOFF_UNSUPPORTED' });
    }
    await this.whenSettled();
    const records = [...this._handles.values()];
    if (records.some(record => record.handle?.getState?.().dragging)) {
      throw Object.assign(new Error('A legacy cabinet gesture is active'), { code: 'LEGACY_WRITERS_BUSY' });
    }
    const dragEnabled = this._dragEnabled;
    this._legacySuspended = true;
    this._dragEnabled = false;
    this._app?.off?.('selection:change', this._onSelectionChanged, this);
    this._detachAllRecords();
    try {
      await Promise.all(records.map(record => Promise.resolve(record.registration)
        .then(handle => handle?.destroy({ restoreStandard: false }))));
    } catch (error) {
      this._legacySuspended = false;
      this._dragEnabled = dragEnabled;
      this._app?.on?.('selection:change', this._onSelectionChanged, this);
      try {
        await this.sync();
        await this.whenSettled();
      } catch (restoreError) {
        throw Object.assign(new AggregateError([error, restoreError], 'Legacy module handoff and restore failed'),
          { code: 'LEGACY_HANDOFF_RECOVERY_REQUIRED' });
      }
      throw error;
    }
    let resumed = false;
    let selectionAttached = false;
    return async () => {
      if (resumed) return;
      this._legacySuspended = false;
      this._dragEnabled = dragEnabled;
      if (!selectionAttached) {
        this._app?.on?.('selection:change', this._onSelectionChanged, this);
        selectionAttached = true;
      }
      await this.sync();
      await this.whenSettled();
      resumed = true;
    };
  }

  _currentCompositionId() {
    return this._manager?.getActiveComposition?.()?.compositionId ?? null;
  }

  _isCurrentActivation(compositionId, activationGeneration) {
    return !this._destroyed &&
      this._activeCompositionId === compositionId &&
      this._activationGeneration === activationGeneration;
  }

  _detachRecord(record) {
    for (const unsubscribe of record.unsubscribes ?? []) {
      try {
        unsubscribe();
      } catch {
        // Listener cleanup is best-effort; handle destruction remains the safety net.
      }
    }
    record.unsubscribes = [];
    record.outline?.destroy();
  }

  _detachAllRecords() {
    const records = [...this._handles.values()];
    this._handles.clear();
    for (const record of records) this._detachRecord(record);
    return records;
  }

  _destroyRecord(record) {
    return Promise.resolve(record.registration)
      .then(handle => handle?.destroy({ restoreStandard: false }))
      .catch(() => null);
  }

  _destroyRecords(records) {
    return Promise.all(records.map(record => this._destroyRecord(record))).then(() => undefined);
  }

  _emitChange(reason, productId = null) {
    if (this._destroyed || this._listeners.size === 0) return;
    const allState = this.getState();
    const payload = Object.freeze({
      reason,
      productId,
      state: productId ? allState[productId] ?? null : null,
      allState: Object.freeze(allState)
    });
    for (const callback of [...this._listeners]) {
      try {
        callback(payload);
      } catch (error) {
        console.error('[CompositionModules] change listener failed', error);
      }
    }
  }
}
