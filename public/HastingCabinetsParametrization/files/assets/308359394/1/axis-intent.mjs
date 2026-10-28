export const AXIS_PENDING = 'pending';

const HISTORY_PATH_PX = 12;
const MIN_DISPLACEMENT_PX = 6;
const INITIAL_DOMINANCE = 1.25;
const SWITCH_DOMINANCE = 1.5;
const SAMPLE_SPACING_PX = 1;
const MAX_HISTORY_POINTS = 20;
const BASIS_VECTOR_EPSILON_PX = 1e-6;
const BASIS_DETERMINANT_EPSILON = 0.05;
const POINT_EPSILON_PX = 1e-6;

const finitePoint2 = value => Boolean(
  value && Number.isFinite(value.x) && Number.isFinite(value.y)
);

const clonePoint2 = value => ({ x: Number(value.x), y: Number(value.y) });

const distanceBetween = (left, right) => {
  const dx = Number(right.x) - Number(left.x);
  const dy = Number(right.y) - Number(left.y);
  return Math.hypot(dx, dy);
};

const normalizeVector = value => {
  if (!finitePoint2(value)) return null;

  const length = Math.hypot(Number(value.x), Number(value.y));
  if (!Number.isFinite(length) || length <= BASIS_VECTOR_EPSILON_PX) return null;

  return {
    x: Number(value.x) / length,
    y: Number(value.y) / length
  };
};

const normalizeBasis = (basis, axisLabels) => {
  const u = normalizeVector(basis?.[axisLabels.u]);
  const v = normalizeVector(basis?.[axisLabels.v]);
  if (!u || !v) return null;

  const determinant = (u.x * v.y) - (u.y * v.x);
  if (!Number.isFinite(determinant) ||
      Math.abs(determinant) <= BASIS_DETERMINANT_EPSILON) {
    return null;
  }

  return { u, v, determinant };
};

const solveBasisComponents = (displacement, basis) => ({
  u: ((displacement.x * basis.v.y) - (displacement.y * basis.v.x)) / basis.determinant,
  v: ((basis.u.x * displacement.y) - (basis.u.y * displacement.x)) / basis.determinant
});

const chooseInitialAxis = components => {
  const u = Math.abs(components.u);
  const v = Math.abs(components.v);

  if (u >= MIN_DISPLACEMENT_PX && u > INITIAL_DOMINANCE * v) return 'u';
  if (v >= MIN_DISPLACEMENT_PX && v > INITIAL_DOMINANCE * u) return 'v';
  return AXIS_PENDING;
};

const chooseStickyAxis = (axis, components) => {
  const u = Math.abs(components.u);
  const v = Math.abs(components.v);

  if (axis === 'u' && v >= MIN_DISPLACEMENT_PX && v > SWITCH_DOMINANCE * u) {
    return 'v';
  }
  if (axis === 'v' && u >= MIN_DISPLACEMENT_PX && u > SWITCH_DOMINANCE * v) {
    return 'u';
  }
  return axis;
};

const createLabels = options => ({
  pending: options?.labels?.pending ?? AXIS_PENDING,
  u: options?.labels?.u ?? 'u',
  v: options?.labels?.v ?? 'v'
});

const createBasisKeys = options => ({
  u: options?.basisKeys?.u ?? 'u',
  v: options?.basisKeys?.v ?? 'v'
});

const toInternalAxis = (axis, labels) => {
  if (axis === labels.u || axis === 'u') return 'u';
  if (axis === labels.v || axis === 'v') return 'v';
  return AXIS_PENDING;
};

const fromInternalAxis = (axis, labels) => {
  if (axis === 'u') return labels.u;
  if (axis === 'v') return labels.v;
  return labels.pending;
};

export function createAxisIntentV1(options = {}) {
  const labels = createLabels(options);
  const basisKeys = createBasisKeys(options);
  const state = {
    axis: AXIS_PENDING,
    history: [],
    pathLength: 0,
    hasUnsealedTail: false
  };

  const result = (axis, changed, valid) => ({
    axis: fromInternalAxis(axis, labels),
    changed,
    valid
  });

  const clearHistory = () => {
    state.history = [];
    state.pathLength = 0;
    state.hasUnsealedTail = false;
  };

  const seedHistory = point => {
    clearHistory();
    if (finitePoint2(point)) state.history.push(clonePoint2(point));
  };

  const trimHistory = () => {
    while (state.history.length > 1 && state.pathLength > HISTORY_PATH_PX) {
      const excess = state.pathLength - HISTORY_PATH_PX;
      const first = state.history[0];
      const second = state.history[1];
      const segmentLength = distanceBetween(first, second);

      if (segmentLength <= POINT_EPSILON_PX || excess >= segmentLength) {
        state.history.shift();
        state.pathLength -= segmentLength;
        continue;
      }

      const ratio = excess / segmentLength;
      state.history[0] = {
        x: first.x + (second.x - first.x) * ratio,
        y: first.y + (second.y - first.y) * ratio
      };
      state.pathLength = HISTORY_PATH_PX;
    }

    if (state.history.length <= 1) state.pathLength = 0;
    if (state.history.length <= 1) state.hasUnsealedTail = false;
  };

  const compactHistory = () => {
    while (state.history.length > MAX_HISTORY_POINTS && state.history.length > 2) {
      const previous = state.history[0];
      const removed = state.history[1];
      const next = state.history[2];
      state.pathLength += distanceBetween(previous, next) -
        distanceBetween(previous, removed) -
        distanceBetween(removed, next);
      state.history.splice(1, 1);
    }
  };

  const appendHistoryPoint = point => {
    if (!finitePoint2(point)) {
      clearHistory();
      return false;
    }

    const nextPoint = clonePoint2(point);
    if (state.history.length === 0) {
      state.history.push(nextPoint);
      return true;
    }

    if (state.history.length === 1) {
      const firstDistance = distanceBetween(state.history[0], nextPoint);
      if (firstDistance <= POINT_EPSILON_PX) return true;
      state.history.push(nextPoint);
      state.pathLength = firstDistance;
      state.hasUnsealedTail = firstDistance < SAMPLE_SPACING_PX;
      trimHistory();
      return true;
    }

    if (state.hasUnsealedTail) {
      const previous = state.history[state.history.length - 2];
      const last = state.history[state.history.length - 1];
      const oldTailDistance = distanceBetween(previous, last);
      const newTailDistance = distanceBetween(previous, nextPoint);
      if (newTailDistance <= POINT_EPSILON_PX) {
        state.history.pop();
        state.pathLength -= oldTailDistance;
        state.hasUnsealedTail = false;
      } else {
        state.history[state.history.length - 1] = nextPoint;
        state.pathLength += newTailDistance - oldTailDistance;
        state.hasUnsealedTail = newTailDistance < SAMPLE_SPACING_PX;
      }
    } else {
      const last = state.history[state.history.length - 1];
      const lastDistance = distanceBetween(last, nextPoint);
      if (lastDistance <= POINT_EPSILON_PX) return true;
      state.history.push(nextPoint);
      state.pathLength += lastDistance;
      state.hasUnsealedTail = lastDistance < SAMPLE_SPACING_PX;
    }

    trimHistory();
    compactHistory();
    return true;
  };

  const getHistoryDisplacement = () => {
    if (state.history.length < 2) return null;

    const first = state.history[0];
    const last = state.history[state.history.length - 1];
    return {
      x: last.x - first.x,
      y: last.y - first.y
    };
  };

  return {
    reset(point, axis = AXIS_PENDING) {
      state.axis = toInternalAxis(axis, labels);
      seedHistory(point);
      return result(state.axis, false, finitePoint2(point));
    },

    update(point, basis) {
      const normalizedBasis = normalizeBasis(basis, basisKeys);
      if (!normalizedBasis || !finitePoint2(point)) {
        clearHistory();
        return result(state.axis, false, false);
      }

      appendHistoryPoint(point);

      const displacement = getHistoryDisplacement();
      if (!displacement || Math.hypot(displacement.x, displacement.y) < MIN_DISPLACEMENT_PX) {
        return result(state.axis, false, true);
      }

      const components = solveBasisComponents(displacement, normalizedBasis);
      if (!Number.isFinite(components.u) || !Number.isFinite(components.v)) {
        clearHistory();
        return result(state.axis, false, false);
      }

      const nextAxis = state.axis === AXIS_PENDING
        ? chooseInitialAxis(components)
        : chooseStickyAxis(state.axis, components);
      const changed = nextAxis !== state.axis;
      state.axis = nextAxis;
      return result(state.axis, changed, true);
    }
  };
}
