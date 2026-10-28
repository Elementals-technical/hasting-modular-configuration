import { SPATIAL_MANIPULATION_SCHEMA_VERSION } from '../contracts/constants.mjs';
import { throwSpatialInvalidInput } from '../contracts/errors.mjs';
import {
  assertExactKeys,
  assertPlainData,
  deepFreeze,
  pathOf
} from '../contracts/immutable.mjs';

export const FRAME_ORTHONORMAL_TOLERANCE = 1e-6;

const FRAME_KEYS = [
  'schemaVersion',
  'frameId',
  'worldSpaceId',
  'frameRevision',
  'originM',
  'uAxis',
  'vAxis',
  'normal'
];
const VEC3_KEYS = ['x', 'y', 'z'];
const UV_KEYS = ['u', 'v'];

const requireStringId = (value, path) => {
  if (typeof value !== 'string' || value.length === 0) {
    throwSpatialInvalidInput(path);
  }
  return value;
};

const requireRevision = (value, path) => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throwSpatialInvalidInput(path);
  }
  return value;
};

const requireVersion = (value, path) => {
  if (value !== SPATIAL_MANIPULATION_SCHEMA_VERSION) {
    throwSpatialInvalidInput(path);
  }
  return value;
};

const requireNumber = (value, path) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throwSpatialInvalidInput(path);
  }
  return value;
};

export const requireVec3M = (value, path) => {
  assertExactKeys(value, VEC3_KEYS, path);
  return {
    x: requireNumber(value.x, pathOf(path, 'x')),
    y: requireNumber(value.y, pathOf(path, 'y')),
    z: requireNumber(value.z, pathOf(path, 'z'))
  };
};

const requireUv = (value, path) => {
  assertExactKeys(value, UV_KEYS, path);
  return {
    u: requireNumber(value.u, pathOf(path, 'u')),
    v: requireNumber(value.v, pathOf(path, 'v'))
  };
};

export const dotVec3 = (left, right) => left.x * right.x + left.y * right.y + left.z * right.z;

export const lengthVec3 = value => Math.sqrt(dotVec3(value, value));

export const crossVec3 = (left, right) => ({
  x: left.y * right.z - left.z * right.y,
  y: left.z * right.x - left.x * right.z,
  z: left.x * right.y - left.y * right.x
});

const distanceVec3 = (left, right) => lengthVec3({
  x: left.x - right.x,
  y: left.y - right.y,
  z: left.z - right.z
});

const assertUnit = (value, path) => {
  if (Math.abs(lengthVec3(value) - 1) > FRAME_ORTHONORMAL_TOLERANCE) {
    throwSpatialInvalidInput(path);
  }
};

export const normalizeMotionFrameV1 = (value, path = '') => {
  assertPlainData(value, path);
  assertExactKeys(value, FRAME_KEYS, path);

  const normalized = {
    schemaVersion: requireVersion(value.schemaVersion, pathOf(path, 'schemaVersion')),
    frameId: requireStringId(value.frameId, pathOf(path, 'frameId')),
    worldSpaceId: requireStringId(value.worldSpaceId, pathOf(path, 'worldSpaceId')),
    frameRevision: requireRevision(value.frameRevision, pathOf(path, 'frameRevision')),
    originM: requireVec3M(value.originM, pathOf(path, 'originM')),
    uAxis: requireVec3M(value.uAxis, pathOf(path, 'uAxis')),
    vAxis: requireVec3M(value.vAxis, pathOf(path, 'vAxis')),
    normal: requireVec3M(value.normal, pathOf(path, 'normal'))
  };

  assertUnit(normalized.uAxis, pathOf(path, 'uAxis'));
  assertUnit(normalized.vAxis, pathOf(path, 'vAxis'));
  assertUnit(normalized.normal, pathOf(path, 'normal'));

  if (Math.abs(dotVec3(normalized.uAxis, normalized.vAxis)) > FRAME_ORTHONORMAL_TOLERANCE) {
    throwSpatialInvalidInput(pathOf(path, 'vAxis'));
  }
  if (Math.abs(dotVec3(normalized.uAxis, normalized.normal)) > FRAME_ORTHONORMAL_TOLERANCE) {
    throwSpatialInvalidInput(pathOf(path, 'normal'));
  }
  if (Math.abs(dotVec3(normalized.vAxis, normalized.normal)) > FRAME_ORTHONORMAL_TOLERANCE) {
    throwSpatialInvalidInput(pathOf(path, 'normal'));
  }

  const cross = crossVec3(normalized.uAxis, normalized.vAxis);
  const crossLength = lengthVec3(cross);
  const normalizedCross = {
    x: cross.x / crossLength,
    y: cross.y / crossLength,
    z: cross.z / crossLength
  };
  if (distanceVec3(normalizedCross, normalized.normal) > FRAME_ORTHONORMAL_TOLERANCE) {
    throwSpatialInvalidInput(pathOf(path, 'normal'));
  }

  return deepFreeze(normalized);
};

export const createMotionFrameV1 = value => normalizeMotionFrameV1(value);

export const buildFramePointM = (frame, offsetM) => {
  const normalizedFrame = normalizeMotionFrameV1(frame);
  assertPlainData(offsetM, 'offsetM');
  const offset = requireUv(offsetM, 'offsetM');
  return deepFreeze({
    x: normalizedFrame.originM.x + normalizedFrame.uAxis.x * offset.u + normalizedFrame.vAxis.x * offset.v,
    y: normalizedFrame.originM.y + normalizedFrame.uAxis.y * offset.u + normalizedFrame.vAxis.y * offset.v,
    z: normalizedFrame.originM.z + normalizedFrame.uAxis.z * offset.u + normalizedFrame.vAxis.z * offset.v
  });
};
