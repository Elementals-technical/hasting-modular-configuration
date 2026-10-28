import { SPATIAL_MANIPULATION_SCHEMA_VERSION } from '../contracts/constants.mjs';
import { throwSpatialInvalidInput } from '../contracts/errors.mjs';
import {
  assertExactKeys,
  assertPlainData,
  deepFreeze,
  pathOf
} from '../contracts/immutable.mjs';

const LATCH_KEYS = ['snapshotQueryRevision', 'activePairIds', 'activeBundleId'];
const CLEARED_LATCH_KEYS = [...LATCH_KEYS, 'reason'];
const CLEAR_REASONS = Object.freeze(new Set(['threshold', 'invalid-dependency', 'cancel', 'destroy']));

const requireRevision = (value, path) => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throwSpatialInvalidInput(path);
  }
  return value;
};

const requireStringId = (value, path) => {
  if (typeof value !== 'string' || value.length === 0) {
    throwSpatialInvalidInput(path);
  }
  return value;
};

const normalizePairIds = (value, path) => {
  if (!Array.isArray(value)) {
    throwSpatialInvalidInput(path);
  }
  const seen = new Set();
  return value.map((pairId, index) => {
    const field = pathOf(path, index);
    const normalized = requireStringId(pairId, field);
    if (seen.has(normalized)) {
      throwSpatialInvalidInput(field);
    }
    seen.add(normalized);
    return normalized;
  });
};

export const normalizeSnapLatchV1 = (value, path = 'activeLatch') => {
  if (value === null || value === undefined) return null;
  assertPlainData(value, path);
  assertExactKeys(value, LATCH_KEYS, path);
  const activeBundleId = value.activeBundleId === null
    ? null
    : requireStringId(value.activeBundleId, pathOf(path, 'activeBundleId'));
  return deepFreeze({
    snapshotQueryRevision: requireRevision(value.snapshotQueryRevision, pathOf(path, 'snapshotQueryRevision')),
    activePairIds: normalizePairIds(value.activePairIds, pathOf(path, 'activePairIds')),
    activeBundleId
  });
};

export function createSnapLatchV1(value) {
  return normalizeSnapLatchV1(value, 'latch');
}

export function createNextSnapLatchV1({ snapshotQueryRevision, activePairIds, activeBundleId = null }) {
  const pairIds = normalizePairIds(activePairIds, 'activePairIds');
  if (pairIds.length === 0) return null;
  return createSnapLatchV1({
    snapshotQueryRevision,
    activePairIds: pairIds,
    activeBundleId
  });
}

export function clearSnapLatchV1(latch, reason) {
  const normalized = normalizeSnapLatchV1(latch, 'latch');
  if (!CLEAR_REASONS.has(reason)) {
    throwSpatialInvalidInput('reason');
  }
  return deepFreeze({
    snapshotQueryRevision: normalized?.snapshotQueryRevision ?? SPATIAL_MANIPULATION_SCHEMA_VERSION,
    activePairIds: [],
    activeBundleId: null,
    reason
  });
}

export const normalizeClearedSnapLatchV1 = (value, path = 'clearedLatch') => {
  assertPlainData(value, path);
  assertExactKeys(value, CLEARED_LATCH_KEYS, path);
  const normalized = {
    snapshotQueryRevision: requireRevision(value.snapshotQueryRevision, pathOf(path, 'snapshotQueryRevision')),
    activePairIds: normalizePairIds(value.activePairIds, pathOf(path, 'activePairIds')),
    activeBundleId: value.activeBundleId === null
      ? null
      : requireStringId(value.activeBundleId, pathOf(path, 'activeBundleId')),
    reason: value.reason
  };
  if (normalized.activePairIds.length !== 0 || normalized.activeBundleId !== null || !CLEAR_REASONS.has(normalized.reason)) {
    throwSpatialInvalidInput(path);
  }
  return deepFreeze(normalized);
};
