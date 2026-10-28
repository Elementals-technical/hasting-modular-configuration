import { throwSpatialInvalidInput } from '../contracts/errors.mjs';
import {
  assertExactKeys,
  assertPlainData,
  deepFreeze,
  pathOf
} from '../contracts/immutable.mjs';
import { MOTION_AXES, normalizeUvM } from './grid.mjs';

const BOUNDS_KEYS = ['u', 'v'];
const BOUND_KEYS = ['min', 'max'];

const requireNumber = (value, path) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throwSpatialInvalidInput(path);
  }
  return value;
};

const normalizeAxisBoundsM = (value, path) => {
  assertExactKeys(value, BOUND_KEYS, path);
  const min = requireNumber(value.min, pathOf(path, 'min'));
  const max = requireNumber(value.max, pathOf(path, 'max'));
  if (min > max) {
    throwSpatialInvalidInput(path);
  }
  return { min, max };
};

export const normalizeMotionBoundsM = (value, path = 'boundsM') => {
  if (value === null || value === undefined) return deepFreeze({});
  assertPlainData(value, path);
  assertExactKeys(value, BOUNDS_KEYS, path);

  const boundsM = {};
  for (const axis of MOTION_AXES) {
    if (!Object.hasOwn(value, axis)) continue;
    boundsM[axis] = normalizeAxisBoundsM(value[axis], pathOf(path, axis));
  }
  return deepFreeze(boundsM);
};

export const clampOffsetToBoundsM = (offsetM, boundsM) => {
  const offset = normalizeUvM(offsetM, 'offsetM');
  const bounds = normalizeMotionBoundsM(boundsM);
  const result = { ...offset };
  const clampedAxes = [];

  for (const axis of MOTION_AXES) {
    const axisBounds = bounds[axis];
    if (!axisBounds) continue;

    if (result[axis] < axisBounds.min) {
      result[axis] = axisBounds.min;
      clampedAxes.push(axis);
    } else if (result[axis] > axisBounds.max) {
      result[axis] = axisBounds.max;
      clampedAxes.push(axis);
    }
  }

  return deepFreeze({
    offsetM: result,
    clampedAxes
  });
};
