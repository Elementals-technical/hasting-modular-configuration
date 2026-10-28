import {
  COUNTERTOP_INTERACTION_STATE,
  COUNTERTOP_LAYOUT_MODE,
  COUNTERTOP_READINESS,
  COUNTERTOP_VALIDATION_STATE,
  createCountertopStateM,
  setCountertopLayoutModeM,
  setCountertopLengthM,
  setCountertopOffsetM,
  updateCountertopStateM
} from './countertop-state.mjs';
import {
  COUNTERTOP_MOVEMENT_APPLY_STATUS,
  calculateCountertopMovementOffsetM,
  normalizeCountertopMovementBoundsM,
  normalizeCountertopMovementGridM
} from './countertop-movement-policy.mjs';
import {
  COUNTERTOP_CHANGE_PHASE,
  createCountertopEvents
} from './countertop-events.mjs';
import { requireCountertopRestoreIntentM } from './countertop-restore.mjs';

export const COUNTERTOP_SERVICE_ERROR_CODE = Object.freeze({
  DESTROYED: 'COUNTERTOP_DESTROYED',
  INVALID_INPUT: 'COUNTERTOP_INVALID_INPUT',
  NOT_READY: 'COUNTERTOP_NOT_READY',
  OPERATION_SUPERSEDED: 'COUNTERTOP_OPERATION_SUPERSEDED',
  SETTLE_FAILED: 'COUNTERTOP_SETTLE_FAILED'
});

export const COUNTERTOP_VALIDATION_DIAGNOSTIC_CODE = Object.freeze({
  PROFILE_MISSING: 'VALIDATION_PROFILE_MISSING'
});

const CHANGE_SOURCE = Object.freeze({
  API: 'api',
  DRAG: 'drag',
  LAYOUT: 'layout',
  RESTORE: 'restore',
  RESIZE: 'resize',
  SELECTION: 'selection',
  STEP: 'step',
  VALIDATION: 'validation'
});

const UNKNOWN_VALIDATION = Object.freeze({
  state: COUNTERTOP_VALIDATION_STATE.UNKNOWN,
  issues: Object.freeze([Object.freeze({
    code: COUNTERTOP_VALIDATION_DIAGNOSTIC_CODE.PROFILE_MISSING
  })])
});

const ZERO_OFFSET_M = Object.freeze({ x: 0, y: 0 });

const isFunction = value => typeof value === 'function';

const isFiniteNumber = value => (
  typeof value === 'number' && Number.isFinite(value)
);

const isObjectRecord = value => Boolean(
  value && typeof value === 'object' && !Array.isArray(value)
);

const cloneOffsetM = offsetM => ({
  x: offsetM.x,
  y: offsetM.y
});

const samePoint3M = (left, right) => (
  left === right || Boolean(
    left && right &&
    Object.is(left.x, right.x) &&
    Object.is(left.y, right.y) &&
    Object.is(left.z, right.z)
  )
);

const hasGeometryChange = (previous, next) => (
  previous.readiness !== next.readiness ||
  previous.compositionId !== next.compositionId ||
  previous.productId !== next.productId ||
  !samePoint3M(previous.positionM, next.positionM) ||
  !Object.is(previous.sizeM.length, next.sizeM.length)
);

const resolveCompositionId = context => (
  context?.compositionId ?? context?.composition?.compositionId ?? null
);

const createServiceError = (code, message, details = {}) => {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
};

const requireBoolean = (value, name) => {
  if (typeof value !== 'boolean') {
    throw createServiceError(
      COUNTERTOP_SERVICE_ERROR_CODE.INVALID_INPUT,
      `${name} must be a boolean`
    );
  }
  return value;
};

const requireOffsetM = (offsetM, name = 'offsetM') => {
  if (!offsetM || !isFiniteNumber(offsetM.x) || !isFiniteNumber(offsetM.y)) {
    throw createServiceError(
      COUNTERTOP_SERVICE_ERROR_CODE.INVALID_INPUT,
      `${name} must contain finite numeric x and y values`
    );
  }
  return { x: offsetM.x, y: offsetM.y };
};

const requireLengthM = lengthM => {
  if (lengthM === null) return null;
  if (!isFiniteNumber(lengthM) || lengthM <= 0) {
    throw createServiceError(
      COUNTERTOP_SERVICE_ERROR_CODE.INVALID_INPUT,
      'lengthM must be null or a finite number greater than zero'
    );
  }
  return lengthM;
};

const requireMovementBoundsM = movementBoundsM => {
  if (!isObjectRecord(movementBoundsM)) {
    throw createServiceError(
      COUNTERTOP_SERVICE_ERROR_CODE.INVALID_INPUT,
      'movementBoundsM must be an object'
    );
  }

  const boundsM = normalizeCountertopMovementBoundsM(movementBoundsM);
  if (boundsM === null) {
    throw createServiceError(
      COUNTERTOP_SERVICE_ERROR_CODE.INVALID_INPUT,
      'movementBoundsM must contain valid min/max bounds when an axis is provided'
    );
  }
  return boundsM;
};

const normalizeInternalMovementBoundsM = movementBoundsM => (
  normalizeCountertopMovementBoundsM(movementBoundsM) || Object.freeze({})
);

const requireMovementGridM = movementGridM => {
  if (!isObjectRecord(movementGridM)) {
    throw createServiceError(
      COUNTERTOP_SERVICE_ERROR_CODE.INVALID_INPUT,
      'movementGridM must be an object'
    );
  }

  const gridM = normalizeCountertopMovementGridM(movementGridM);
  if (gridM === null) {
    throw createServiceError(
      COUNTERTOP_SERVICE_ERROR_CODE.INVALID_INPUT,
      'movementGridM must contain positive finite values when an axis is provided'
    );
  }
  return gridM;
};

const normalizeInternalMovementGridM = movementGridM => (
  normalizeCountertopMovementGridM(movementGridM) || Object.freeze({})
);

const isReadyLayoutBinding = (binding, compositionId, productId) => {
  const explicitlyReady = binding?.readiness === COUNTERTOP_READINESS.READY ||
    binding?.ready === true;
  const base = binding?.basePositionM;

  return Boolean(
    explicitlyReady &&
    compositionId !== null && compositionId !== undefined && compositionId !== '' &&
    productId !== null && productId !== undefined && productId !== '' &&
    base &&
    isFiniteNumber(base.x) &&
    isFiniteNumber(base.y) &&
    isFiniteNumber(base.z) &&
    isFiniteNumber(binding.baseLengthM) &&
    binding.baseLengthM > 0
  );
};

const resolveLayoutValidation = binding => (
  binding?.validation || UNKNOWN_VALIDATION
);

const resolveInteractionState = (selected, editing) => {
  if (editing) return COUNTERTOP_INTERACTION_STATE.EDITING;
  if (selected) return COUNTERTOP_INTERACTION_STATE.SELECTED;
  return COUNTERTOP_INTERACTION_STATE.IDLE;
};

const hasOwn = (object, key) => Boolean(object) &&
  Object.prototype.hasOwnProperty.call(object, key);

/**
 * Owns the metric countertop state for one active composition.
 *
 * The injected composition context is the narrow runtime seam used by the
 * composition adapter. It may implement applyCountertopStateM(state, metadata),
 * whenCountertopSettled(), validateCountertopStateM(state, metadata), and
 * cancelCountertopWork(metadata).
 * This service does not resolve or mutate PlayCanvas entities itself.
 */
export class CountertopService {
  constructor(app, compositionContext = {}) {
    this._app = app || null;
    this._compositionContext = compositionContext || {};
    this._layoutBinding = null;
    this._destroyed = false;
    this._selected = false;
    this._editing = false;
    this._gestureStartOffsetM = null;
    this._bindingRevision = 0;
    this._pendingWork = null;
    this._restoreOperations = new Set();
    this._lastReadyIdentity = null;
    this._resetPositionIntent = false;

    this._stateM = createCountertopStateM({
      compositionId: resolveCompositionId(this._compositionContext),
      readiness: COUNTERTOP_READINESS.WAITING,
      validation: UNKNOWN_VALIDATION
    });
    this._events = createCountertopEvents(this._app, {
      initialStateM: this._stateM,
      getStateM: () => this._stateM
    });
  }

  getStateM() {
    return this._stateM;
  }

  on(event, callback, options) {
    return this._events.on(event, callback, options);
  }

  off(event, callback) {
    this._events.off(event, callback);
  }

  updateLayoutM(layoutBinding = {}) {
    this._assertAlive();
    this._finishGestureAtCurrentOffset();

    const previousBinding = this._layoutBinding;
    const previousIdentity = `${this._stateM.compositionId ?? ''}:${this._stateM.productId ?? ''}`;
    const nextCompositionId = layoutBinding.compositionId ??
      resolveCompositionId(this._compositionContext);
    const nextProductId = layoutBinding.productId ?? null;
    const ready = isReadyLayoutBinding(layoutBinding, nextCompositionId, nextProductId);
    const nextIdentity = `${nextCompositionId ?? ''}:${nextProductId ?? ''}`;
    const identityChanged = previousIdentity !== nextIdentity;
    const hasExplicitBounds = hasOwn(layoutBinding, 'movementBoundsM') &&
      layoutBinding.movementBoundsM !== undefined;
    const hasExplicitGrid = hasOwn(layoutBinding, 'movementGridM') &&
      layoutBinding.movementGridM !== undefined;
    const isKnownReadyIdentity = this._lastReadyIdentity === nextIdentity;
    const nextMovementBoundsM = ready
      ? hasExplicitBounds
        ? requireMovementBoundsM(layoutBinding.movementBoundsM)
        : isKnownReadyIdentity
          ? this._stateM.movementBoundsM
          : normalizeInternalMovementBoundsM()
      : this._stateM.movementBoundsM;
    const nextMovementGridM = ready
      ? hasExplicitGrid
        ? requireMovementGridM(layoutBinding.movementGridM)
        : isKnownReadyIdentity
          ? this._stateM.movementGridM
          : normalizeInternalMovementGridM()
      : this._stateM.movementGridM;

    const bindingChanged = previousBinding !== layoutBinding || identityChanged;
    if (bindingChanged) {
      this._cancelPendingWork('countertop-layout-binding-changed');
      this._bindingRevision++;
    }
    this._layoutBinding = layoutBinding;
    if (!ready || identityChanged) {
      this._selected = false;
      this._editing = false;
    }

    const nextStateM = updateCountertopStateM(this._stateM, {
      compositionId: nextCompositionId,
      productId: nextProductId,
      readiness: ready ? COUNTERTOP_READINESS.READY : COUNTERTOP_READINESS.WAITING,
      basePositionM: ready ? layoutBinding.basePositionM : null,
      baseLengthM: ready ? layoutBinding.baseLengthM : null,
      movementBoundsM: nextMovementBoundsM,
      movementGridM: nextMovementGridM,
      offsetM: ready
        ? this._resetPositionIntent && !identityChanged
          ? ZERO_OFFSET_M
          : this._applyOffsetConstraintsM(
            this._stateM.offsetM,
            nextMovementBoundsM,
            nextMovementGridM
          )
        : this._stateM.offsetM,
      sizeM: {
        length: ready ? layoutBinding.baseLengthM : null,
        depth: ready ? layoutBinding.sizeM?.depth ?? null : null
      },
      thicknessM: ready ? layoutBinding.thicknessM ?? null : null,
      validation: ready ? resolveLayoutValidation(layoutBinding) : UNKNOWN_VALIDATION,
      interactionState: !ready || identityChanged
        ? COUNTERTOP_INTERACTION_STATE.IDLE
        : this._stateM.interactionState
    });

    const operation = this._commitProgrammatic(nextStateM, CHANGE_SOURCE.LAYOUT);
    if (ready) this._lastReadyIdentity = nextIdentity;
    if (!ready || identityChanged) this._resetPositionIntent = false;
    this._flushRestoreOperations();
    return operation;
  }

  async restoreStateM(intentM, options = {}) {
    const intent = requireCountertopRestoreIntentM(intentM);
    this._assertAlive();

    const operation = this._createRestoreOperation({
      compositionId: options.expectedCompositionId ?? this._stateM.compositionId,
      productId: options.expectedProductId ?? this._stateM.productId
    });

    try {
      await this._waitForRestoreReady(operation);
      await this._awaitRestoreOperation(operation, this.whenSettled());
      this._assertRestoreTarget(operation);
      this._finishGestureAtCurrentOffset();
      this._resetPositionIntent = false;

      const nextStateM = updateCountertopStateM(this._stateM, {
        layoutMode: intent.layoutMode,
        offsetM: this._applyOffsetConstraintsM(intent.offsetM),
        customLengthM: intent.customLengthM
      });
      await this._awaitRestoreOperation(
        operation,
        this._commitProgrammatic(nextStateM, CHANGE_SOURCE.RESTORE)
      );

      const validatedStateM = await this._awaitRestoreOperation(
        operation,
        this.validate()
      );
      const validationRevision = validatedStateM.revision;
      const validationBindingRevision = this._bindingRevision;
      await this._awaitRestoreOperation(operation, this.whenSettled());
      this._assertOperationCurrent(validationRevision, validationBindingRevision);
      this._assertRestoreTarget(operation);
      return this._stateM;
    } finally {
      this._restoreOperations.delete(operation);
      operation.resolveReady = null;
    }
  }

  setLayoutMode(mode) {
    this._assertReady();
    if (mode !== COUNTERTOP_LAYOUT_MODE.STANDARD && mode !== COUNTERTOP_LAYOUT_MODE.DRAG) {
      throw createServiceError(
        COUNTERTOP_SERVICE_ERROR_CODE.INVALID_INPUT,
        'mode must be "standard" or "drag"'
      );
    }

    this._finishGestureAtCurrentOffset();
    return this._commitProgrammatic(
      setCountertopLayoutModeM(this._stateM, mode),
      CHANGE_SOURCE.API
    );
  }

  setOffsetM(offsetM) {
    this._assertReady();
    this._finishGestureAtCurrentOffset();
    this._resetPositionIntent = false;
    return this._commitProgrammatic(
      setCountertopOffsetM(this._stateM, this._applyOffsetConstraintsM(requireOffsetM(offsetM))),
      CHANGE_SOURCE.API
    );
  }

  setMovementBoundsM(movementBoundsM) {
    this._assertReady();
    this._finishGestureAtCurrentOffset();
    const boundsM = requireMovementBoundsM(movementBoundsM);
    const nextOffsetM = this._resetPositionIntent
      ? ZERO_OFFSET_M
      : this._applyOffsetConstraintsM(this._stateM.offsetM, boundsM);
    return this._commitProgrammatic(updateCountertopStateM(this._stateM, {
      movementBoundsM: boundsM,
      offsetM: nextOffsetM
    }), CHANGE_SOURCE.API);
  }

  setMovementGridM(movementGridM) {
    this._assertReady();
    this._finishGestureAtCurrentOffset();
    const gridM = requireMovementGridM(movementGridM);
    const nextOffsetM = this._resetPositionIntent
      ? ZERO_OFFSET_M
      : this._applyOffsetConstraintsM(
        this._stateM.offsetM,
        this._stateM.movementBoundsM,
        gridM
      );
    return this._commitProgrammatic(updateCountertopStateM(this._stateM, {
      movementGridM: gridM,
      offsetM: nextOffsetM
    }), CHANGE_SOURCE.API);
  }

  resetPosition() {
    this._assertReady();
    this._finishGestureAtCurrentOffset();
    this._resetPositionIntent = true;
    return this._commitProgrammatic(
      setCountertopOffsetM(this._stateM, ZERO_OFFSET_M),
      CHANGE_SOURCE.API
    );
  }

  async moveByM(relativeDeltaOffsetM) {
    this._assertReady();
    if (this._stateM.layoutMode !== COUNTERTOP_LAYOUT_MODE.DRAG) {
      throw createServiceError(
        COUNTERTOP_SERVICE_ERROR_CODE.INVALID_INPUT,
        'moveByM() is only available in drag layout mode'
      );
    }

    this._finishGestureAtCurrentOffset();
    this._resetPositionIntent = false;
    return this._commitProgrammatic(
      setCountertopOffsetM(this._stateM, this._resolveRelativeOffsetM(
        requireOffsetM(relativeDeltaOffsetM, 'relativeDeltaOffsetM')
      )),
      CHANGE_SOURCE.STEP
    );
  }

  setLengthM(lengthM) {
    this._assertReady();
    this._finishGestureAtCurrentOffset();
    return this._commitProgrammatic(
      setCountertopLengthM(this._stateM, requireLengthM(lengthM)),
      CHANGE_SOURCE.RESIZE
    );
  }

  setSelected(selected) {
    this._assertReady();
    const nextSelected = requireBoolean(selected, 'selected');
    this._finishGestureAtCurrentOffset();
    this._selected = nextSelected;
    if (!nextSelected) this._editing = false;

    return this._commitProgrammatic(updateCountertopStateM(this._stateM, {
      interactionState: resolveInteractionState(this._selected, this._editing)
    }), CHANGE_SOURCE.SELECTION, { applyGeometry: false });
  }

  setEditing(editing) {
    this._assertReady();
    const nextEditing = requireBoolean(editing, 'editing');
    this._finishGestureAtCurrentOffset();
    this._editing = nextEditing;
    if (nextEditing) this._selected = true;

    return this._commitProgrammatic(updateCountertopStateM(this._stateM, {
      interactionState: resolveInteractionState(this._selected, this._editing)
    }), CHANGE_SOURCE.SELECTION, { applyGeometry: false });
  }

  beginMove() {
    this._assertReady();
    if (this._gestureStartOffsetM) return this._stateM;

    this._gestureStartOffsetM = cloneOffsetM(this._stateM.offsetM);
    this._selected = true;
    this._editing = true;
    this._stateM = updateCountertopStateM(this._stateM, {
      interactionState: COUNTERTOP_INTERACTION_STATE.DRAGGING
    });
    this._events.emitChange(this._stateM, {
      phase: COUNTERTOP_CHANGE_PHASE.START,
      source: CHANGE_SOURCE.DRAG
    });
    return this._stateM;
  }

  updateMoveM(offsetM) {
    this._assertReady();
    if (!this._gestureStartOffsetM) {
      throw createServiceError(
        COUNTERTOP_SERVICE_ERROR_CODE.INVALID_INPUT,
        'beginMove() must be called before updateMoveM()'
      );
    }

    const previousStateM = this._stateM;
    this._resetPositionIntent = false;
    const nextStateM = setCountertopOffsetM(
      this._stateM,
      this._applyOffsetConstraintsM(requireOffsetM(offsetM))
    );
    if (nextStateM.revision === previousStateM.revision) return this._stateM;

    this._stateM = nextStateM;
    if (hasGeometryChange(previousStateM, this._stateM)) {
      this._applyGeometry(previousStateM, CHANGE_SOURCE.DRAG, COUNTERTOP_CHANGE_PHASE.UPDATE);
    }
    this._events.emitChange(this._stateM, {
      phase: COUNTERTOP_CHANGE_PHASE.UPDATE,
      source: CHANGE_SOURCE.DRAG
    });
    return this._stateM;
  }

  endMove() {
    this._assertAlive();
    if (!this._gestureStartOffsetM) return this._stateM;

    this._gestureStartOffsetM = null;
    this._stateM = updateCountertopStateM(this._stateM, {
      interactionState: resolveInteractionState(this._selected, this._editing)
    });
    this._events.emitChange(this._stateM, {
      phase: COUNTERTOP_CHANGE_PHASE.END,
      source: CHANGE_SOURCE.DRAG
    });
    this._trackSettle(this._stateM.revision, this._bindingRevision);
    return this._stateM;
  }

  cancelMove() {
    this._assertAlive();
    if (!this._gestureStartOffsetM) return this._stateM;

    const previousStateM = this._stateM;
    const startOffsetM = this._gestureStartOffsetM;
    this._gestureStartOffsetM = null;
    this._stateM = updateCountertopStateM(this._stateM, {
      offsetM: startOffsetM,
      interactionState: resolveInteractionState(this._selected, this._editing)
    });
    if (hasGeometryChange(previousStateM, this._stateM)) {
      this._applyGeometry(previousStateM, CHANGE_SOURCE.DRAG, COUNTERTOP_CHANGE_PHASE.END);
    }
    this._events.emitChange(this._stateM, {
      phase: COUNTERTOP_CHANGE_PHASE.END,
      source: CHANGE_SOURCE.DRAG
    });
    this._trackSettle(this._stateM.revision, this._bindingRevision);
    return this._stateM;
  }

  async validate() {
    this._assertReady();
    const startRevision = this._stateM.revision;
    const bindingRevision = this._bindingRevision;
    const validator = this._compositionContext?.validateCountertopStateM;
    const validation = isFunction(validator)
      ? await validator(this._stateM, { layoutBinding: this._layoutBinding })
      : UNKNOWN_VALIDATION;

    this._assertOperationCurrent(startRevision, bindingRevision);
    const nextStateM = updateCountertopStateM(this._stateM, {
      validation: validation || UNKNOWN_VALIDATION
    });
    return this._commitProgrammatic(nextStateM, CHANGE_SOURCE.VALIDATION, {
      applyGeometry: false
    });
  }

  async whenSettled() {
    this._assertAlive();

    while (this._pendingWork) {
      const pending = this._pendingWork;
      await pending.promise;
      if (pending === this._pendingWork) break;
    }

    const settle = this._compositionContext?.whenCountertopSettled;
    if (isFunction(settle)) {
      this._assertSettleResult(await settle({
        stateM: this._stateM,
        layoutBinding: this._layoutBinding
      }));
    }

    this._assertAlive();
    return this._stateM;
  }

  destroy() {
    if (this._destroyed) return;

    for (const operation of Array.from(this._restoreOperations)) {
      this._cancelRestoreOperation(
        operation,
        createServiceError(
          COUNTERTOP_SERVICE_ERROR_CODE.DESTROYED,
          'Countertop service was destroyed while restore was waiting'
        )
      );
    }
    this._cancelPendingWork('countertop-service-destroyed');
    this._destroyed = true;
    this._bindingRevision++;
    this._gestureStartOffsetM = null;
    this._pendingWork = null;
    this._resetPositionIntent = false;
    this._stateM = updateCountertopStateM(this._stateM, {
      readiness: COUNTERTOP_READINESS.DESTROYED,
      interactionState: COUNTERTOP_INTERACTION_STATE.IDLE,
      basePositionM: null,
      baseLengthM: null,
      sizeM: { length: null, depth: null },
      thicknessM: null,
      validation: UNKNOWN_VALIDATION
    });
    this._events.destroy();
    this._layoutBinding = null;
    this._lastReadyIdentity = null;
    this._restoreOperations.clear();
    this._compositionContext = null;
    this._app = null;
  }

  _commitProgrammatic(nextStateM, source, options = {}) {
    const previousStateM = this._stateM;
    if (nextStateM.revision === previousStateM.revision) {
      return this.whenSettled();
    }

    this._stateM = nextStateM;
    const shouldApplyGeometry = options.applyGeometry !== false &&
      hasGeometryChange(previousStateM, nextStateM);
    const applyPromise = shouldApplyGeometry
      ? this._applyGeometry(previousStateM, source, COUNTERTOP_CHANGE_PHASE.END)
      : null;

    this._events.emitChange(this._stateM, {
      phase: COUNTERTOP_CHANGE_PHASE.END,
      source
    });

    const operationRevision = this._stateM.revision;
    const bindingRevision = this._bindingRevision;
    const pending = this._trackSettle(operationRevision, bindingRevision, applyPromise);

    return pending.then(
      () => {
        this._assertOperationCurrent(operationRevision, bindingRevision);
        return this._stateM;
      },
      error => {
        this._assertOperationCurrent(operationRevision, bindingRevision);
        throw error;
      }
    );
  }

  _applyOffsetConstraintsM(
    offsetM,
    movementBoundsM = this._stateM.movementBoundsM,
    movementGridM = this._stateM.movementGridM
  ) {
    const boundsM = requireMovementBoundsM(movementBoundsM);
    const gridM = requireMovementGridM(movementGridM);
    const result = calculateCountertopMovementOffsetM({
      currentOffsetM: { x: 0, y: 0 },
      relativeDeltaOffsetM: offsetM,
      movementBoundsM: boundsM,
      movementGridM: gridM
    });

    if (result.status !== COUNTERTOP_MOVEMENT_APPLY_STATUS.ACCEPTED) {
      throw createServiceError(
        COUNTERTOP_SERVICE_ERROR_CODE.INVALID_INPUT,
        `Unable to apply countertop movement bounds: ${result.reason || 'unknown'}`
      );
    }

    return result.effectiveOffsetM;
  }

  _resolveRelativeOffsetM(relativeDeltaOffsetM) {
    const result = calculateCountertopMovementOffsetM({
      currentOffsetM: this._stateM.offsetM,
      relativeDeltaOffsetM,
      movementBoundsM: this._stateM.movementBoundsM,
      movementGridM: this._stateM.movementGridM
    });

    if (result.status !== COUNTERTOP_MOVEMENT_APPLY_STATUS.ACCEPTED) {
      throw createServiceError(
        COUNTERTOP_SERVICE_ERROR_CODE.INVALID_INPUT,
        `Unable to apply countertop movement delta: ${result.reason || 'unknown'}`
      );
    }

    return result.effectiveOffsetM;
  }

  _applyGeometry(previousStateM, source, phase) {
    if (this._stateM.readiness !== COUNTERTOP_READINESS.READY) return null;

    const apply = this._compositionContext?.applyCountertopStateM;
    if (!isFunction(apply)) return null;

    let result;
    try {
      result = apply(this._stateM, {
        previousStateM,
        source,
        phase,
        layoutBinding: this._layoutBinding,
        bindingRevision: this._bindingRevision
      });
    } catch (error) {
      result = Promise.reject(error);
    }

    const promise = Promise.resolve(result).then(value => {
      this._assertSettleResult(value);
      return value;
    });
    promise.catch(() => {});
    const tracked = {
      revision: this._stateM.revision,
      bindingRevision: this._bindingRevision,
      promise
    };
    this._pendingWork = tracked;
    promise.then(() => {
      if (this._pendingWork === tracked) this._pendingWork = null;
    }, () => {});
    return promise;
  }

  _trackSettle(revision, bindingRevision, applyPromise = null) {
    const workAtStart = this._pendingWork;
    const settle = this._compositionContext?.whenCountertopSettled;
    const stateAtStart = this._stateM;
    const bindingAtStart = this._layoutBinding;
    const promise = (async () => {
      if (applyPromise) await applyPromise;
      else if (workAtStart) await workAtStart.promise;

      if (isFunction(settle)) {
        this._assertSettleResult(await settle({
          stateM: stateAtStart,
          layoutBinding: bindingAtStart,
          revision,
          bindingRevision
        }));
      }
      return this._stateM;
    })();

    const tracked = { revision, bindingRevision, promise };
    this._pendingWork = tracked;
    promise.then(() => {
      if (this._pendingWork === tracked) this._pendingWork = null;
    }, () => {});
    return promise;
  }

  _assertSettleResult(result) {
    if (!result || (result.status !== 'cancelled' && result.status !== 'error')) return;
    throw createServiceError(
      result.code || COUNTERTOP_SERVICE_ERROR_CODE.SETTLE_FAILED,
      result.reason || `Countertop settle ${result.status}`,
      { result }
    );
  }

  _cancelPendingWork(reason) {
    const hadPendingWork = Boolean(this._pendingWork);
    this._pendingWork = null;
    if (!hadPendingWork) return;

    const cancel = this._compositionContext?.cancelCountertopWork;
    if (isFunction(cancel)) {
      try {
        cancel({
          reason,
          stateM: this._stateM,
          layoutBinding: this._layoutBinding,
          bindingRevision: this._bindingRevision
        });
      } catch (error) {
        if (typeof console !== 'undefined' && isFunction(console.error)) {
          console.error('Countertop work cancellation failed', error);
        }
      }
    }
  }

  _finishGestureAtCurrentOffset() {
    if (this._gestureStartOffsetM) this.endMove();
  }

  _createRestoreOperation(target) {
    if (target.compositionId === null || target.compositionId === undefined ||
        target.compositionId === '') {
      throw createServiceError(
        COUNTERTOP_SERVICE_ERROR_CODE.NOT_READY,
        'Countertop restore requires an active composition identity'
      );
    }

    let cancel;
    const operation = {
      target: {
        compositionId: String(target.compositionId),
        productId: target.productId === null || target.productId === undefined ||
          target.productId === ''
          ? null
          : String(target.productId)
      },
      cancelledError: null,
      cancellation: new Promise(resolve => { cancel = resolve; }),
      cancel,
      readyPromise: null,
      resolveReady: null
    };
    operation.readyPromise = new Promise(resolve => {
      operation.resolveReady = resolve;
    });
    this._restoreOperations.add(operation);
    this._flushRestoreOperations();
    return operation;
  }

  _waitForRestoreReady(operation) {
    if (operation.cancelledError) return Promise.reject(operation.cancelledError);
    if (this._isRestoreTargetReady(operation)) return Promise.resolve(this._stateM);
    return this._awaitRestoreOperation(operation, operation.readyPromise);
  }

  _awaitRestoreOperation(operation, promise) {
    return Promise.race([
      Promise.resolve(promise),
      operation.cancellation.then(error => { throw error; })
    ]);
  }

  _flushRestoreOperations() {
    for (const operation of Array.from(this._restoreOperations)) {
      const mismatch = this._getRestoreTargetMismatch(operation);
      if (mismatch) {
        this._cancelRestoreOperation(operation, mismatch);
        continue;
      }
      if (this._isRestoreTargetReady(operation) && operation.resolveReady) {
        operation.resolveReady(this._stateM);
        operation.resolveReady = null;
      }
    }
  }

  _getRestoreTargetMismatch(operation) {
    const target = operation.target;
    const compositionId = this._stateM.compositionId;
    const productId = this._stateM.productId;
    if (compositionId !== target.compositionId) {
      return createServiceError(
        COUNTERTOP_SERVICE_ERROR_CODE.OPERATION_SUPERSEDED,
        'Countertop restore target composition changed while waiting',
        { expectedCompositionId: target.compositionId, currentCompositionId: compositionId }
      );
    }
    if (target.productId !== null && productId !== null && productId !== target.productId) {
      return createServiceError(
        COUNTERTOP_SERVICE_ERROR_CODE.OPERATION_SUPERSEDED,
        'Countertop restore target product changed while waiting',
        { expectedProductId: target.productId, currentProductId: productId }
      );
    }
    return null;
  }

  _isRestoreTargetReady(operation) {
    return !this._getRestoreTargetMismatch(operation) &&
      this._stateM.readiness === COUNTERTOP_READINESS.READY;
  }

  _cancelRestoreOperation(operation, error) {
    if (!operation || operation.cancelledError) return;
    operation.cancelledError = error;
    this._restoreOperations.delete(operation);
    operation.resolveReady = null;
    operation.cancel(error);
  }

  _assertRestoreTarget(operation) {
    this._assertAlive();
    const mismatch = this._getRestoreTargetMismatch(operation);
    if (mismatch) throw mismatch;
    if (operation.cancelledError) throw operation.cancelledError;
  }

  _assertReady() {
    this._assertAlive();
    if (this._stateM.readiness !== COUNTERTOP_READINESS.READY) {
      throw createServiceError(
        COUNTERTOP_SERVICE_ERROR_CODE.NOT_READY,
        'Countertop layout binding is not ready'
      );
    }
  }

  _assertAlive() {
    if (this._destroyed) {
      throw createServiceError(
        COUNTERTOP_SERVICE_ERROR_CODE.DESTROYED,
        'Countertop service is destroyed'
      );
    }
  }

  _assertOperationCurrent(revision, bindingRevision) {
    this._assertAlive();
    if (revision !== this._stateM.revision || bindingRevision !== this._bindingRevision) {
      throw createServiceError(
        COUNTERTOP_SERVICE_ERROR_CODE.OPERATION_SUPERSEDED,
        'Countertop operation was superseded by a newer revision',
        {
          operationRevision: revision,
          currentRevision: this._stateM.revision
        }
      );
    }
  }
}

export function createCountertopService(app, compositionContext) {
  return new CountertopService(app, compositionContext);
}
