/**
 * PlayCanvas hierarchy adapter — spatial-manipulation V1 (optional adapter, ADR-0001/0004).
 *
 * Produces the plain, immutable parent facts (`TransformHierarchySnapshotV1`) that the T6
 * coordinator consumes for protected-transform/ancestor leases, from live entity graphs.
 * The core never traverses a PlayCanvas Entity (spec AC-23): this module walks `entity.parent`
 * / `entity.children` here and emits string ids only. Entities are duck-typed
 * (`name`, `parent`, `children`, optional `getGuid`), so Node tests use fakes.
 *
 * Every snapshot is complete (each listed entity plus its whole ancestor chain to `null`, or
 * to the optional `root` boundary), has unique ids, and is sorted by `transformId` so the same
 * graph always yields byte-equivalent facts (NFR-01). Facts for the same id must agree across
 * live bindings of one runtime, so callers must use one `transformIdOf`/`root` policy per app.
 */
import { SPATIAL_MANIPULATION_SCHEMA_VERSION } from '../index.mjs';
import { throwSpatialInvalidInput } from '../core/contracts/errors.mjs';
import { deepFreeze } from '../core/contracts/immutable.mjs';
import { validateTransformHierarchySnapshotV1 } from '../runtime/coordination/hierarchy.mjs';

const isStringId = value => typeof value === 'string' && value.length > 0;

/** Default id policy: the engine GUID when available, otherwise the entity name. */
export const defaultPlayCanvasTransformId = entity => {
  if (!entity) return null;
  const guid = typeof entity.getGuid === 'function' ? entity.getGuid() : null;
  if (isStringId(guid)) return guid;
  return isStringId(entity.name) ? entity.name : null;
};

const requireRevision = value => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throwSpatialInvalidInput('hierarchyRevision');
  }
  return value;
};

const requireEntityList = (value, field) => {
  if (value == null) return [];
  if (!Array.isArray(value)) throwSpatialInvalidInput(field);
  return value;
};

const resolveIdOf = transformIdOf => {
  if (transformIdOf == null) return defaultPlayCanvasTransformId;
  if (typeof transformIdOf !== 'function') throwSpatialInvalidInput('transformIdOf');
  return transformIdOf;
};

/**
 * Id book: maps entities to ids once per snapshot and rejects two distinct entities that
 * resolve to the same id, or an entity without a usable id.
 */
const createIdBook = (transformIdOf, field = 'entities') => {
  const idByEntity = new Map();
  const entityById = new Map();
  return entity => {
    if (idByEntity.has(entity)) return idByEntity.get(entity);
    if (!entity || typeof entity !== 'object') throwSpatialInvalidInput(field);
    const id = transformIdOf(entity);
    if (!isStringId(id)) throwSpatialInvalidInput(field);
    const previous = entityById.get(id);
    if (previous !== undefined && previous !== entity) throwSpatialInvalidInput(field);
    idByEntity.set(entity, id);
    entityById.set(id, entity);
    return id;
  };
};

const parentOf = (entity, root) => {
  const parent = entity?.parent ?? null;
  if (!parent || parent === root) return null;
  return parent;
};

/** Ancestor ids nearest-first, excluding `entity`, stopping before the optional `root`. */
export const collectPlayCanvasAncestorIds = (entity, options = {}) => {
  const idOf = createIdBook(resolveIdOf(options.transformIdOf), 'entity');
  const root = options.root ?? null;
  const ids = [];
  const visited = new Set([entity]);
  let current = parentOf(entity, root);
  while (current) {
    if (visited.has(current)) throwSpatialInvalidInput('entity');
    visited.add(current);
    ids.push(idOf(current));
    current = parentOf(current, root);
  }
  return deepFreeze(ids);
};

/** Descendant ids depth-first (children order), excluding `entity`. */
export const collectPlayCanvasDescendantIds = (entity, options = {}) => {
  const idOf = createIdBook(resolveIdOf(options.transformIdOf), 'entity');
  return deepFreeze(collectDescendants(entity).map(idOf));
};

/**
 * Build `TransformHierarchySnapshotV1` from entities. Every entity in `entities` and every
 * ancestor up to `null` (or up to, excluding, `root`) becomes a node; nodes are sorted by id.
 *
 * @param {object} request
 * @param {readonly object[]} request.entities Entities that must appear in the snapshot.
 * @param {number} [request.hierarchyRevision] Revision stamp (default 0).
 * @param {(entity: object) => string} [request.transformIdOf] Stable id policy.
 * @param {object|null} [request.root] Boundary entity; its children get `parentTransformId: null`.
 */
export const createPlayCanvasHierarchySnapshotV1 = (request = {}) => {
  const entities = requireEntityList(request.entities, 'entities');
  const hierarchyRevision = requireRevision(request.hierarchyRevision ?? 0);
  const idOf = createIdBook(resolveIdOf(request.transformIdOf), 'entities');
  const root = request.root ?? null;

  const parentIdById = new Map();
  for (const entity of entities) {
    const chain = new Set();
    let current = entity;
    while (current && current !== root) {
      if (chain.has(current)) throwSpatialInvalidInput('entities');
      chain.add(current);
      const id = idOf(current);
      const parent = parentOf(current, root);
      const parentId = parent ? idOf(parent) : null;
      if (parentIdById.has(id)) {
        if (parentIdById.get(id) !== parentId) throwSpatialInvalidInput('entities');
        break;
      }
      parentIdById.set(id, parentId);
      current = parent;
    }
  }

  const nodes = [...parentIdById.entries()]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([transformId, parentTransformId]) => ({ transformId, parentTransformId }));

  return validateTransformHierarchySnapshotV1({
    schemaVersion: SPATIAL_MANIPULATION_SCHEMA_VERSION,
    hierarchyRevision,
    nodes
  });
};

const uniqueIds = (entities, idOf, field) => {
  const ids = [];
  const seen = new Set();
  for (const entity of requireEntityList(entities, field)) {
    const id = idOf(entity);
    if (seen.has(id)) throwSpatialInvalidInput(field);
    seen.add(id);
    ids.push(id);
  }
  return ids;
};

/**
 * Transform facts for a `RuntimeBindingV1` (data-model.md §4) from entity sets:
 * `pickTargetIds`, `transformTargetIds`, `affectedTransformIds` (targets plus every
 * descendant, without making descendants protected), `spatialDependencyTransformIds`,
 * `presentationTargetIds` and the complete `hierarchy` snapshot covering all of them.
 */
export const describePlayCanvasBindingTransforms = (request = {}) => {
  const idOf = createIdBook(resolveIdOf(request.transformIdOf), 'entities');
  const transformTargets = requireEntityList(request.transformTargets, 'transformTargets');
  const spatialDependencyTransforms = requireEntityList(request.spatialDependencyTransforms, 'spatialDependencyTransforms');
  const pickTargets = requireEntityList(request.pickTargets, 'pickTargets');
  const presentationTargets = requireEntityList(request.presentationTargets, 'presentationTargets');

  const transformTargetIds = uniqueIds(transformTargets, idOf, 'transformTargets');
  const spatialDependencyTransformIds = uniqueIds(spatialDependencyTransforms, idOf, 'spatialDependencyTransforms');
  const pickTargetIds = uniqueIds(pickTargets, idOf, 'pickTargets');
  const presentationTargetIds = uniqueIds(presentationTargets, idOf, 'presentationTargets');

  // Affected = direct targets plus every descendant (data-model.md §4: affected transforms
  // are not protected by themselves; they are listed so unregistered-descendant writes can be
  // checked against the hierarchy without making them lease members).
  const affected = [];
  const affectedSeen = new Set();
  const descendants = [];
  for (const target of transformTargets) {
    const targetId = idOf(target);
    if (!affectedSeen.has(targetId)) {
      affectedSeen.add(targetId);
      affected.push(targetId);
    }
    for (const descendant of collectDescendants(target)) {
      const id = idOf(descendant);
      if (affectedSeen.has(id)) continue;
      affectedSeen.add(id);
      affected.push(id);
      descendants.push(descendant);
    }
  }

  const hierarchy = createPlayCanvasHierarchySnapshotV1({
    entities: [
      ...transformTargets,
      ...spatialDependencyTransforms,
      ...pickTargets,
      ...presentationTargets,
      ...descendants
    ],
    hierarchyRevision: request.hierarchyRevision ?? 0,
    transformIdOf: idOf,
    root: request.root ?? null
  });

  return deepFreeze({
    pickTargetIds,
    transformTargetIds,
    affectedTransformIds: affected,
    spatialDependencyTransformIds,
    presentationTargetIds,
    hierarchy
  });
};

const collectDescendants = entity => {
  const result = [];
  const visited = new Set([entity]);
  const visit = node => {
    for (const child of node?.children ?? []) {
      if (!child || visited.has(child)) continue;
      visited.add(child);
      result.push(child);
      visit(child);
    }
  };
  visit(entity);
  return result;
};

/** Bound helper set sharing one id/root policy (one per app is the intended use). */
export const createPlayCanvasHierarchyAdapter = (options = {}) => {
  const transformIdOf = resolveIdOf(options.transformIdOf);
  const root = options.root ?? null;
  return Object.freeze({
    transformIdOf: entity => {
      const id = transformIdOf(entity);
      return isStringId(id) ? id : null;
    },
    snapshot: (entities, hierarchyRevision = 0) => createPlayCanvasHierarchySnapshotV1({
      entities,
      hierarchyRevision,
      transformIdOf,
      root
    }),
    ancestorIds: entity => collectPlayCanvasAncestorIds(entity, { transformIdOf, root }),
    descendantIds: entity => collectPlayCanvasDescendantIds(entity, { transformIdOf }),
    bindingTransforms: request => describePlayCanvasBindingTransforms({ ...request, transformIdOf, root })
  });
};
