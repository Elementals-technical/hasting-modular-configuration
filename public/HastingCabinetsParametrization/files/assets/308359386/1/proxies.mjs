/**
 * Collision proxy strategies: local-space boxes derived from normalized mesh primitives.
 *
 * A *profile* names one strategy plus its parameters; the host owns the profile table (which
 * product uses which strategy) and this module owns the geometry. Primitives are plain data:
 * `{ entityName, active, ancestorsActive, box?: { min, max }, topology?: { positions, indices } }`
 * in the body root's local space. World transforms stay with the engine adapter.
 *
 * Strategies:
 *   single-box              one exact named primitive -> one box (`semanticRole`)
 *   opposed-boundary-slabs  one named shell whose verified topology has two opposed slabs
 *                           along `boundaryAxis` -> two boxes (`semanticOrder`)
 *   component-boxes         one named primitive with `componentCount` connected components
 *                           -> one box per component ordered along `boundaryAxis`
 *   active-member-union     the union of active members selected by name suffix, with
 *                           per-suffix cardinality checks -> one box (`semanticRole`)
 */
export const COLLISION_PROXY_DIAGNOSTIC = Object.freeze({
  PROFILE_UNSUPPORTED: 'SPATIAL_COLLISION_PROXY_PROFILE_UNSUPPORTED',
  PRIMITIVE_MISSING: 'SPATIAL_COLLISION_PROXY_PRIMITIVE_MISSING',
  PRIMITIVE_AMBIGUOUS: 'SPATIAL_COLLISION_PROXY_PRIMITIVE_AMBIGUOUS',
  BOX_INVALID: 'SPATIAL_COLLISION_PROXY_BOX_INVALID',
  TOPOLOGY_INVALID: 'SPATIAL_COLLISION_PROXY_TOPOLOGY_INVALID',
  TOPOLOGY_MISMATCH: 'SPATIAL_COLLISION_PROXY_TOPOLOGY_MISMATCH'
});

const AXIS_INDEX = Object.freeze({ x: 0, y: 1, z: 2 });
const WELD_EPSILON_M = 1e-6;

const freezeDeep = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const key of Object.keys(value)) freezeDeep(value[key]);
  return Object.freeze(value);
};

const finitePoint = (point) => point && ['x', 'y', 'z'].every(axis => Number.isFinite(point[axis]));

const normalizeBox = (value) => {
  if (!value || !finitePoint(value.min) || !finitePoint(value.max)) return null;
  if (['x', 'y', 'z'].some(axis => value.min[axis] >= value.max[axis])) return null;
  return {
    min: { x: value.min.x, y: value.min.y, z: value.min.z },
    max: { x: value.max.x, y: value.max.y, z: value.max.z }
  };
};

const primitiveName = (primitive) => primitive?.entityName ?? primitive?.name ?? '';
const isActive = (primitive) => primitive?.active === true && primitive?.ancestorsActive === true;

const diagnostic = (code, reason, details = {}) => freezeDeep({ code, reason, ...details });

const result = (profile, proxies, diagnostics = []) => freezeDeep({
  status: diagnostics.length === 0 ? 'ready' : 'unsupported',
  profileId: profile?.id ?? null,
  profileVersion: profile?.version ?? null,
  proxies,
  diagnostics
});

const unsupported = (profile, code, reason, details) =>
  result(profile, [], [diagnostic(code, reason, details)]);

const pointFrom = (value) => {
  if (Array.isArray(value) && value.length >= 3 && value.slice(0, 3).every(Number.isFinite)) {
    return [value[0], value[1], value[2]];
  }
  if (finitePoint(value)) return [value.x, value.y, value.z];
  return null;
};

const normalizeTopology = (topology) => {
  if (!topology || !Array.isArray(topology.positions) || !Array.isArray(topology.indices)) return null;
  const positions = topology.positions.map(pointFrom);
  if (positions.some(point => point === null)) return null;
  if (topology.indices.length === 0 || topology.indices.length % 3 !== 0) return null;
  const indices = topology.indices.map(Number);
  if (indices.some(index => !Number.isInteger(index) || index < 0 || index >= positions.length)) return null;
  return { positions, indices };
};

const weldKey = (point) => point.map(value => Math.round(value / WELD_EPSILON_M)).join(':');

const connectedComponents = (topology) => {
  const weldedPositions = [];
  const weldedByKey = new Map();
  const weldedIndexBySource = topology.positions.map(point => {
    const key = weldKey(point);
    if (!weldedByKey.has(key)) {
      weldedByKey.set(key, weldedPositions.length);
      weldedPositions.push(point);
    }
    return weldedByKey.get(key);
  });

  const parent = weldedPositions.map((_, index) => index);
  const find = (index) => {
    while (parent[index] !== index) {
      parent[index] = parent[parent[index]];
      index = parent[index];
    }
    return index;
  };
  const union = (left, right) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parent[rightRoot] = leftRoot;
  };

  const triangleRoots = [];
  for (let index = 0; index < topology.indices.length; index += 3) {
    const a = weldedIndexBySource[topology.indices[index]];
    const b = weldedIndexBySource[topology.indices[index + 1]];
    const c = weldedIndexBySource[topology.indices[index + 2]];
    union(a, b);
    union(a, c);
    triangleRoots.push(a);
  }

  const byRoot = new Map();
  weldedPositions.forEach((point, index) => {
    const root = find(index);
    if (!byRoot.has(root)) byRoot.set(root, { positions: [], triangleCount: 0 });
    byRoot.get(root).positions.push(point);
  });
  triangleRoots.forEach(root => {
    byRoot.get(find(root)).triangleCount += 1;
  });

  return [...byRoot.values()].map(component => ({
    ...component,
    uniqueVertexCount: component.positions.length,
    box: boxFromPositions(component.positions)
  }));
};

const boxFromPositions = (positions) => {
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const point of positions) {
    min.x = Math.min(min.x, point[0]);
    min.y = Math.min(min.y, point[1]);
    min.z = Math.min(min.z, point[2]);
    max.x = Math.max(max.x, point[0]);
    max.y = Math.max(max.y, point[1]);
    max.z = Math.max(max.z, point[2]);
  }
  return { min, max };
};

const proxy = (semanticRole, sourceNames, box) => freezeDeep({
  semanticRole,
  sourceNames: [...sourceNames].sort(),
  box
});

const exactActivePrimitive = (profile, primitives, exactEntityName) => {
  const matches = primitives.filter(item => isActive(item) && primitiveName(item) === exactEntityName);
  if (matches.length !== 1) {
    return {
      error: matches.length === 0
        ? unsupported(profile, COLLISION_PROXY_DIAGNOSTIC.PRIMITIVE_MISSING,
          `Expected one active ${exactEntityName} primitive with active ancestors.`)
        : unsupported(profile, COLLISION_PROXY_DIAGNOSTIC.PRIMITIVE_AMBIGUOUS,
          `Expected one active ${exactEntityName} primitive, received ${matches.length}.`)
    };
  }
  return { primitive: matches[0] };
};

const buildSingleBox = (profile, primitives, strategy) => {
  const selected = exactActivePrimitive(profile, primitives, strategy.exactEntityName);
  if (selected.error) return selected.error;
  const box = normalizeBox(selected.primitive.box);
  if (!box) {
    return unsupported(profile, COLLISION_PROXY_DIAGNOSTIC.BOX_INVALID,
      `${strategy.exactEntityName} has no finite box.`);
  }
  return result(profile, [proxy(
    strategy.semanticRole ?? 'moving-volume',
    [primitiveName(selected.primitive)],
    box
  )]);
};

const topologyComponentsFor = (profile, primitive) => {
  const topology = normalizeTopology(primitive.topology);
  if (!topology) {
    return {
      error: unsupported(profile, COLLISION_PROXY_DIAGNOSTIC.TOPOLOGY_INVALID,
        `${primitiveName(primitive)} has no valid indexed triangle topology.`)
    };
  }
  return { topology, components: connectedComponents(topology) };
};

const topologyMismatch = (profile, reason, details = {}) =>
  unsupported(profile, COLLISION_PROXY_DIAGNOSTIC.TOPOLOGY_MISMATCH, reason, details);

const buildOpposedBoundarySlabs = (profile, primitives, strategy) => {
  const selected = exactActivePrimitive(profile, primitives, strategy.exactEntityName);
  if (selected.error) return selected.error;
  const topologyResult = topologyComponentsFor(profile, selected.primitive);
  if (topologyResult.error) return topologyResult.error;

  const { components } = topologyResult;
  const signature = strategy.topology;
  if (components.length !== signature.componentCount) {
    return topologyMismatch(profile, `${strategy.exactEntityName} component count does not match the verified topology.`, {
      expected: signature.componentCount,
      actual: components.length
    });
  }

  const ordered = [...components].sort((left, right) => right.triangleCount - left.triangleCount);
  const [shell, secondary] = ordered;
  if (shell.triangleCount !== signature.shellTriangleCount ||
      secondary.triangleCount !== signature.secondaryTriangleCount ||
      shell.uniqueVertexCount !== signature.shellUniqueVertexCount ||
      secondary.uniqueVertexCount !== signature.secondaryUniqueVertexCount) {
    return topologyMismatch(profile, `${strategy.exactEntityName} topology signature changed; refusing a whole-body fallback.`, {
      actual: ordered.map(item => ({
        triangleCount: item.triangleCount,
        uniqueVertexCount: item.uniqueVertexCount
      }))
    });
  }

  const axis = AXIS_INDEX[strategy.boundaryAxis];
  const levels = [...new Set(shell.positions.map(point => weldKey([point[axis]])).map(key => Number(key) * WELD_EPSILON_M))]
    .sort((left, right) => left - right);
  let split = null;
  for (let index = 0; index < levels.length - 1; index += 1) {
    const gap = levels[index + 1] - levels[index];
    if (!split || gap > split.gap) split = { lower: levels[index], upper: levels[index + 1], gap };
  }

  const fullMin = shell.box.min[strategy.boundaryAxis];
  const fullMax = shell.box.max[strategy.boundaryAxis];
  const fullSpan = fullMax - fullMin;
  const lowerThickness = split?.lower - fullMin;
  const upperThickness = fullMax - split?.upper;
  if (!split || fullSpan <= 0 || split.gap / fullSpan < signature.minimumInteriorGapRatio ||
      lowerThickness <= 0 || upperThickness <= 0 ||
      lowerThickness / fullSpan > signature.maximumBoundaryThicknessRatio ||
      upperThickness / fullSpan > signature.maximumBoundaryThicknessRatio) {
    return topologyMismatch(profile, `${strategy.exactEntityName} does not expose the verified opposed boundary-slab shape.`);
  }

  const lowerPositions = shell.positions.filter(point => point[axis] <= split.lower + WELD_EPSILON_M);
  const upperPositions = shell.positions.filter(point => point[axis] >= split.upper - WELD_EPSILON_M);
  if (lowerPositions.length === 0 || upperPositions.length === 0) {
    return topologyMismatch(profile, `${strategy.exactEntityName} boundary slab selection produced an empty side.`);
  }

  const sourceName = primitiveName(selected.primitive);
  return result(profile, [
    proxy(strategy.semanticOrder[0], [sourceName], boxFromPositions(lowerPositions)),
    proxy(strategy.semanticOrder[1], [sourceName], boxFromPositions(upperPositions))
  ]);
};

const buildComponentBoxes = (profile, primitives, strategy) => {
  const selected = exactActivePrimitive(profile, primitives, strategy.exactEntityName);
  if (selected.error) return selected.error;
  const topologyResult = topologyComponentsFor(profile, selected.primitive);
  if (topologyResult.error) return topologyResult.error;
  if (topologyResult.components.length !== strategy.componentCount) {
    return topologyMismatch(profile, `${strategy.exactEntityName} must contain exactly ${strategy.componentCount} verified components.`, {
      expected: strategy.componentCount,
      actual: topologyResult.components.length
    });
  }

  const axis = strategy.boundaryAxis;
  const ordered = [...topologyResult.components].sort((left, right) => {
    const leftCenter = (left.box.min[axis] + left.box.max[axis]) / 2;
    const rightCenter = (right.box.min[axis] + right.box.max[axis]) / 2;
    return leftCenter - rightCenter;
  });
  const sourceName = primitiveName(selected.primitive);
  return result(profile, ordered.map((component, index) =>
    proxy(strategy.semanticOrder[index], [sourceName], component.box)));
};

const buildActiveMemberUnion = (profile, primitives, strategy) => {
  const candidates = primitives.filter(item => {
    if (!isActive(item)) return false;
    const name = primitiveName(item);
    if (strategy.excludeNameFragments.some(fragment => name.includes(fragment))) return false;
    return strategy.includeNameSuffixes.some(suffix => name.endsWith(suffix));
  });
  // Per-suffix cardinality, e.g. { _Panel: [1, 1], _Inlay: [0, 1] } (inclusive min/max).
  const counts = {};
  for (const [suffix, [min, max]] of Object.entries(strategy.cardinality ?? {})) {
    const count = candidates.filter(item => primitiveName(item).endsWith(suffix)).length;
    counts[suffix] = count;
    if (count < min || count > max) {
      return topologyMismatch(profile, `Active members violate the ${suffix} cardinality [${min}, ${max}].`, { counts });
    }
  }
  if (candidates.length === 0) {
    return unsupported(profile, COLLISION_PROXY_DIAGNOSTIC.PRIMITIVE_MISSING, 'No active member matches the union selection.');
  }
  const boxes = candidates.map(item => normalizeBox(item.box));
  if (boxes.some(box => box === null)) {
    return unsupported(profile, COLLISION_PROXY_DIAGNOSTIC.BOX_INVALID,
      'An active union member has no finite box.');
  }
  const union = {
    min: {
      x: Math.min(...boxes.map(box => box.min.x)),
      y: Math.min(...boxes.map(box => box.min.y)),
      z: Math.min(...boxes.map(box => box.min.z))
    },
    max: {
      x: Math.max(...boxes.map(box => box.max.x)),
      y: Math.max(...boxes.map(box => box.max.y)),
      z: Math.max(...boxes.map(box => box.max.z))
    }
  };
  return result(profile, [proxy(strategy.semanticRole, candidates.map(primitiveName), union)]);
};

/**
 * Build local-space proxy boxes from normalized, already-current geometry.
 * World transforms deliberately remain the engine adapter's responsibility.
 */
export function buildCollisionProxies({ profile, primitives = [] } = {}) {
  if (!profile?.supported || !profile?.proxyStrategy) {
    return unsupported(profile, COLLISION_PROXY_DIAGNOSTIC.PROFILE_UNSUPPORTED,
      profile?.diagnostic?.reason || 'No supported collision profile was supplied.');
  }
  if (!Array.isArray(primitives)) {
    return unsupported(profile, COLLISION_PROXY_DIAGNOSTIC.TOPOLOGY_INVALID,
      'Primitive input must be an array.');
  }

  const strategy = profile.proxyStrategy;
  if (strategy.type === 'single-box') return buildSingleBox(profile, primitives, strategy);
  if (strategy.type === 'opposed-boundary-slabs') return buildOpposedBoundarySlabs(profile, primitives, strategy);
  if (strategy.type === 'component-boxes') return buildComponentBoxes(profile, primitives, strategy);
  if (strategy.type === 'active-member-union') return buildActiveMemberUnion(profile, primitives, strategy);
  return unsupported(profile, COLLISION_PROXY_DIAGNOSTIC.PROFILE_UNSUPPORTED,
    `Unknown proxy strategy "${strategy.type}".`);
}
