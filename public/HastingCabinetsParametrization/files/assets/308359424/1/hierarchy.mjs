import { SPATIAL_MANIPULATION_SCHEMA_VERSION } from '../../core/contracts/constants.mjs';
import { throwSpatialInvalidInput } from '../../core/contracts/errors.mjs';
import {
  assertExactKeys,
  assertPlainData,
  deepFreeze,
  pathOf
} from '../../core/contracts/immutable.mjs';

const HIERARCHY_KEYS = ['schemaVersion', 'hierarchyRevision', 'nodes'];
const HIERARCHY_NODE_KEYS = ['transformId', 'parentTransformId'];

const requireSchemaVersion = (value, path) => {
  if (value !== SPATIAL_MANIPULATION_SCHEMA_VERSION) {
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

const requireStringId = (value, path) => {
  if (typeof value !== 'string' || value.length === 0) {
    throwSpatialInvalidInput(path);
  }
  return value;
};

const requireArray = (value, path) => {
  if (!Array.isArray(value)) {
    throwSpatialInvalidInput(path);
  }
  return value;
};

const normalizeRequiredIds = requiredTransformIds => {
  if (requiredTransformIds == null) {
    return [];
  }
  if (requiredTransformIds instanceof Set) {
    return [...requiredTransformIds];
  }
  if (Array.isArray(requiredTransformIds)) {
    return requiredTransformIds;
  }
  throwSpatialInvalidInput('requiredTransformIds');
};

const buildParentMap = (nodes, path) => {
  const parentById = new Map();
  const normalizedNodes = nodes.map((node, index) => {
    const nodePath = pathOf(pathOf(path, 'nodes'), index);
    assertExactKeys(node, HIERARCHY_NODE_KEYS, nodePath);

    const transformId = requireStringId(node.transformId, pathOf(nodePath, 'transformId'));
    if (parentById.has(transformId)) {
      throwSpatialInvalidInput(pathOf(nodePath, 'transformId'));
    }

    const parentTransformId = node.parentTransformId;
    if (parentTransformId !== null) {
      requireStringId(parentTransformId, pathOf(nodePath, 'parentTransformId'));
      if (parentTransformId === transformId) {
        throwSpatialInvalidInput(pathOf(nodePath, 'parentTransformId'));
      }
    }

    parentById.set(transformId, parentTransformId);
    return { transformId, parentTransformId };
  });

  return { normalizedNodes, parentById };
};

const assertCompleteAcyclicParents = (parentById, path) => {
  for (const [transformId, parentTransformId] of parentById.entries()) {
    if (parentTransformId !== null && !parentById.has(parentTransformId)) {
      throwSpatialInvalidInput(pathOf(path, 'nodes'));
    }

    const visiting = new Set();
    let current = transformId;
    while (current !== null) {
      if (visiting.has(current)) {
        throwSpatialInvalidInput(pathOf(path, 'nodes'));
      }
      visiting.add(current);
      current = parentById.get(current);
      if (current !== null && current !== undefined && !parentById.has(current)) {
        throwSpatialInvalidInput(pathOf(path, 'nodes'));
      }
    }
  }
};

export const validateTransformHierarchySnapshotV1 = (
  value,
  requiredTransformIds = [],
  path = 'hierarchy'
) => {
  assertPlainData(value, path);
  assertExactKeys(value, HIERARCHY_KEYS, path);

  const nodes = requireArray(value.nodes, pathOf(path, 'nodes'));
  const { normalizedNodes, parentById } = buildParentMap(nodes, path);
  assertCompleteAcyclicParents(parentById, path);

  for (const requiredId of normalizeRequiredIds(requiredTransformIds)) {
    const id = requireStringId(requiredId, 'requiredTransformIds');
    if (!parentById.has(id)) {
      throwSpatialInvalidInput(pathOf(path, 'nodes'));
    }
  }

  return deepFreeze({
    schemaVersion: requireSchemaVersion(value.schemaVersion, pathOf(path, 'schemaVersion')),
    hierarchyRevision: requireRevision(value.hierarchyRevision, pathOf(path, 'hierarchyRevision')),
    nodes: normalizedNodes
  });
};

export const createHierarchyIndexV1 = snapshot => {
  const normalized = validateTransformHierarchySnapshotV1(snapshot);
  const parentById = new Map(normalized.nodes.map(node => [node.transformId, node.parentTransformId]));

  const hasTransform = transformId => parentById.has(transformId);
  const parentOf = transformId => parentById.get(transformId) ?? null;
  const pathToRoot = transformId => {
    requireStringId(transformId, 'transformId');
    if (!parentById.has(transformId)) {
      throwSpatialInvalidInput('transformId');
    }

    const path = [];
    let current = transformId;
    while (current !== null) {
      path.push(current);
      current = parentById.get(current);
    }
    return deepFreeze(path);
  };

  const isAncestorOf = (possibleAncestorId, transformId) => {
    requireStringId(possibleAncestorId, 'possibleAncestorId');
    requireStringId(transformId, 'transformId');
    if (!parentById.has(possibleAncestorId) || !parentById.has(transformId)) {
      return false;
    }

    let current = parentById.get(transformId);
    while (current !== null && current !== undefined) {
      if (current === possibleAncestorId) {
        return true;
      }
      current = parentById.get(current);
    }
    return false;
  };

  return Object.freeze({
    snapshot: normalized,
    hasTransform,
    parentOf,
    pathToRoot,
    isAncestorOf
  });
};
