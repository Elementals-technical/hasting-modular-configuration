import { SPATIAL_MANIPULATION_SCHEMA_VERSION } from '../contracts/constants.mjs';
import { throwSpatialInvalidInput } from '../contracts/errors.mjs';
import {
  assertExactKeys,
  assertPlainData,
  deepFreeze,
  pathOf
} from '../contracts/immutable.mjs';
import {
  FRAME_ORTHONORMAL_TOLERANCE,
  dotVec3,
  lengthVec3,
  requireVec3M
} from './frame.mjs';

const REQUEST_KEYS = ['schemaVersion', 'ray', 'plane', 'parallelEpsilon'];
const RAY_KEYS = ['originM', 'direction'];
const PLANE_KEYS = ['pointM', 'normal'];
const DEFAULT_PARALLEL_EPSILON = 1e-8;

const requireSchemaVersion = (value, path) => {
  if (value !== SPATIAL_MANIPULATION_SCHEMA_VERSION) {
    throwSpatialInvalidInput(path);
  }
};

const assertUnitVector = (value, path) => {
  if (Math.abs(lengthVec3(value) - 1) > FRAME_ORTHONORMAL_TOLERANCE) {
    throwSpatialInvalidInput(path);
  }
};

const normalizeRayPlaneRequest = value => {
  assertPlainData(value, '');
  assertExactKeys(value, REQUEST_KEYS, '');
  requireSchemaVersion(value.schemaVersion, 'schemaVersion');

  assertExactKeys(value.ray, RAY_KEYS, 'ray');
  assertExactKeys(value.plane, PLANE_KEYS, 'plane');

  const originM = requireVec3M(value.ray.originM, 'ray.originM');
  const direction = requireVec3M(value.ray.direction, 'ray.direction');
  const pointM = requireVec3M(value.plane.pointM, 'plane.pointM');
  const normal = requireVec3M(value.plane.normal, 'plane.normal');
  assertUnitVector(direction, 'ray.direction');
  assertUnitVector(normal, 'plane.normal');

  let parallelEpsilon = DEFAULT_PARALLEL_EPSILON;
  if (Object.hasOwn(value, 'parallelEpsilon')) {
    parallelEpsilon = value.parallelEpsilon;
    if (typeof parallelEpsilon !== 'number' || !Number.isFinite(parallelEpsilon) || parallelEpsilon < 0 || parallelEpsilon >= 1) {
      throwSpatialInvalidInput(pathOf('', 'parallelEpsilon'));
    }
  }

  return { ray: { originM, direction }, plane: { pointM, normal }, parallelEpsilon };
};

export const intersectRayPlaneV1 = request => {
  const normalized = normalizeRayPlaneRequest(request);
  const denominator = dotVec3(normalized.ray.direction, normalized.plane.normal);
  if (Math.abs(denominator) <= normalized.parallelEpsilon) {
    return null;
  }

  const delta = {
    x: normalized.plane.pointM.x - normalized.ray.originM.x,
    y: normalized.plane.pointM.y - normalized.ray.originM.y,
    z: normalized.plane.pointM.z - normalized.ray.originM.z
  };
  const tM = dotVec3(delta, normalized.plane.normal) / denominator;

  return deepFreeze({
    pointWorldM: {
      x: normalized.ray.originM.x + normalized.ray.direction.x * tM,
      y: normalized.ray.originM.y + normalized.ray.direction.y * tM,
      z: normalized.ray.originM.z + normalized.ray.direction.z * tM
    },
    tM
  });
};
