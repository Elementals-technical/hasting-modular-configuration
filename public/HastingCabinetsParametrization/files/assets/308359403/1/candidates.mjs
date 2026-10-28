import { SPATIAL_MANIPULATION_SCHEMA_VERSION } from '../contracts/constants.mjs';
import { throwSpatialInvalidInput } from '../contracts/errors.mjs';
import {
  assertExactKeys,
  assertPlainData,
  deepFreeze,
  pathOf
} from '../contracts/immutable.mjs';
import { MOTION_AXES, normalizeUvM } from '../motion/grid.mjs';

const SNAPSHOT_KEYS = [
  'schemaVersion',
  'readiness',
  'coverage',
  'instanceId',
  'objectId',
  'dependencyScopeId',
  'bindingGeneration',
  'frameId',
  'frameRevision',
  'policyRevision',
  'sourceGeometryRevision',
  'targetSceneRevision',
  'membershipRevision',
  'queryId',
  'queryRevision',
  'referenceOffsetM',
  'movingBoundsM',
  'sourceFeatures',
  'targetFeatures',
  'pairRules',
  'missing',
  'diagnostics'
];
const FEATURE_KEYS = [
  'featureId',
  'ownerObjectId',
  'partId',
  'role',
  'enabled',
  'geometry',
  'supportIntervalUM'
];
const AXIS_GEOMETRY_KEYS = ['kind', 'axis', 'valueM', 'spanM'];
const POINT_GEOMETRY_KEYS = ['kind', 'pointM'];
const INTERVAL_KEYS = ['min', 'max'];
const RULE_KEYS = [
  'ruleId',
  'sourceRoles',
  'targetRoles',
  'operation',
  'priority',
  'eligibility',
  'bundle'
];
const ELIGIBILITY_KEYS = ['kind', 'epsilonM'];
const BUNDLE_KEYS = ['family', 'compatibleScalarRuleIds', 'retainOverProjection'];
const REQUEST_KEYS = ['snapshot', 'requestedOffsetM'];
const OPERATIONS = Object.freeze(new Set(['align-u', 'align-v', 'coincide-uv']));
const ELIGIBILITY_KINDS = Object.freeze(new Set(['none', 'positive-u-overlap', 'u-abut-without-overlap']));
const READINESS_VALUES = Object.freeze(new Set(['ready', 'pending', 'unsupported', 'disabled']));
const COVERAGE_VALUES = Object.freeze(new Set(['complete', 'partial', 'none']));
const MOVING_BOUNDS_KEYS = ['min', 'max'];

const requireSchemaVersion = (value, path) => {
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

const requireBool = (value, path) => {
  if (typeof value !== 'boolean') {
    throwSpatialInvalidInput(path);
  }
  return value;
};

const requireAxis = (value, path) => {
  if (!MOTION_AXES.includes(value)) {
    throwSpatialInvalidInput(path);
  }
  return value;
};

const requireStringList = (value, path, { requireNonEmpty = false } = {}) => {
  if (!Array.isArray(value)) {
    throwSpatialInvalidInput(path);
  }
  if (requireNonEmpty && value.length === 0) {
    throwSpatialInvalidInput(path);
  }
  const seen = new Set();
  return value.map((item, index) => {
    const field = pathOf(path, index);
    const normalized = requireStringId(item, field);
    if (seen.has(normalized)) {
      throwSpatialInvalidInput(field);
    }
    seen.add(normalized);
    return normalized;
  });
};

const copyPlainData = value => {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(copyPlainData);
  const copied = {};
  for (const key of Object.keys(value)) {
    copied[key] = copyPlainData(value[key]);
  }
  return copied;
};

const normalizeInterval = (value, path) => {
  assertExactKeys(value, INTERVAL_KEYS, path);
  const min = requireNumber(value.min, pathOf(path, 'min'));
  const max = requireNumber(value.max, pathOf(path, 'max'));
  if (min > max) {
    throwSpatialInvalidInput(path);
  }
  return { min, max };
};

const normalizeGeometry = (value, path) => {
  if (value?.kind === 'axis') {
    assertExactKeys(value, AXIS_GEOMETRY_KEYS, path);
    return {
      kind: 'axis',
      axis: requireAxis(value.axis, pathOf(path, 'axis')),
      valueM: requireNumber(value.valueM, pathOf(path, 'valueM')),
      ...(value.spanM === undefined ? {} : { spanM: normalizeInterval(value.spanM, pathOf(path, 'spanM')) })
    };
  }
  if (value?.kind === 'point') {
    assertExactKeys(value, POINT_GEOMETRY_KEYS, path);
    return {
      kind: 'point',
      pointM: normalizeUvM(value.pointM, pathOf(path, 'pointM'))
    };
  }
  throwSpatialInvalidInput(pathOf(path, 'kind'));
};

const normalizeFeature = (value, path) => {
  assertExactKeys(value, FEATURE_KEYS, path);
  return {
    featureId: requireStringId(value.featureId, pathOf(path, 'featureId')),
    ownerObjectId: requireStringId(value.ownerObjectId, pathOf(path, 'ownerObjectId')),
    ...(value.partId === undefined ? {} : { partId: requireStringId(value.partId, pathOf(path, 'partId')) }),
    role: requireStringId(value.role, pathOf(path, 'role')),
    enabled: requireBool(value.enabled, pathOf(path, 'enabled')),
    geometry: normalizeGeometry(value.geometry, pathOf(path, 'geometry')),
    ...(value.supportIntervalUM === undefined ? {} : {
      supportIntervalUM: normalizeInterval(value.supportIntervalUM, pathOf(path, 'supportIntervalUM'))
    })
  };
};

const normalizeEligibility = (value, path) => {
  assertExactKeys(value, ELIGIBILITY_KEYS, path);
  if (!ELIGIBILITY_KINDS.has(value.kind)) {
    throwSpatialInvalidInput(pathOf(path, 'kind'));
  }
  const eligibility = { kind: value.kind };
  if (value.kind !== 'none') {
    const epsilonM = requireNumber(value.epsilonM, pathOf(path, 'epsilonM'));
    if (epsilonM < 0) {
      throwSpatialInvalidInput(pathOf(path, 'epsilonM'));
    }
    eligibility.epsilonM = epsilonM;
  } else if (value.epsilonM !== undefined) {
    throwSpatialInvalidInput(pathOf(path, 'epsilonM'));
  }
  return eligibility;
};

const normalizeBundle = (value, path) => {
  if (value === undefined) return undefined;
  assertExactKeys(value, BUNDLE_KEYS, path);
  return {
    family: requireStringId(value.family, pathOf(path, 'family')),
    compatibleScalarRuleIds: requireStringList(value.compatibleScalarRuleIds, pathOf(path, 'compatibleScalarRuleIds')),
    retainOverProjection: requireBool(value.retainOverProjection, pathOf(path, 'retainOverProjection'))
  };
};

const normalizeRule = (value, path) => {
  assertExactKeys(value, RULE_KEYS, path);
  if (!OPERATIONS.has(value.operation)) {
    throwSpatialInvalidInput(pathOf(path, 'operation'));
  }
  return {
    ruleId: requireStringId(value.ruleId, pathOf(path, 'ruleId')),
    sourceRoles: requireStringList(value.sourceRoles, pathOf(path, 'sourceRoles'), { requireNonEmpty: true }),
    targetRoles: requireStringList(value.targetRoles, pathOf(path, 'targetRoles'), { requireNonEmpty: true }),
    operation: value.operation,
    priority: requireNumber(value.priority, pathOf(path, 'priority')),
    eligibility: normalizeEligibility(value.eligibility, pathOf(path, 'eligibility')),
    ...(value.bundle === undefined ? {} : { bundle: normalizeBundle(value.bundle, pathOf(path, 'bundle')) })
  };
};

const normalizeArray = (value, path, normalizer) => {
  if (!Array.isArray(value)) {
    throwSpatialInvalidInput(path);
  }
  return value.map((item, index) => normalizer(item, pathOf(path, index)));
};

const normalizeEnum = (value, allowed, path) => {
  const normalized = requireStringId(value, path);
  if (!allowed.has(normalized)) {
    throwSpatialInvalidInput(path);
  }
  return normalized;
};

const assertUniqueBy = (items, selector, path, fieldName) => {
  const seen = new Set();
  for (let index = 0; index < items.length; index += 1) {
    const id = selector(items[index]);
    if (seen.has(id)) {
      throwSpatialInvalidInput(pathOf(pathOf(path, index), fieldName));
    }
    seen.add(id);
  }
};

export const normalizeSnapGeometrySnapshotV1 = (value, path = 'snapshot') => {
  assertPlainData(value, path);
  assertExactKeys(value, SNAPSHOT_KEYS, path);
  assertExactKeys(value.movingBoundsM, MOVING_BOUNDS_KEYS, pathOf(path, 'movingBoundsM'));
  const sourceFeatures = normalizeArray(value.sourceFeatures, pathOf(path, 'sourceFeatures'), normalizeFeature);
  const targetFeatures = normalizeArray(value.targetFeatures, pathOf(path, 'targetFeatures'), normalizeFeature);
  const pairRules = normalizeArray(value.pairRules, pathOf(path, 'pairRules'), normalizeRule);
  assertUniqueBy(sourceFeatures, feature => feature.featureId, pathOf(path, 'sourceFeatures'), 'featureId');
  assertUniqueBy(targetFeatures, feature => feature.featureId, pathOf(path, 'targetFeatures'), 'featureId');
  assertUniqueBy(pairRules, rule => rule.ruleId, pathOf(path, 'pairRules'), 'ruleId');

  const snapshot = {
    schemaVersion: requireSchemaVersion(value.schemaVersion, pathOf(path, 'schemaVersion')),
    readiness: normalizeEnum(value.readiness, READINESS_VALUES, pathOf(path, 'readiness')),
    coverage: normalizeEnum(value.coverage, COVERAGE_VALUES, pathOf(path, 'coverage')),
    instanceId: requireStringId(value.instanceId, pathOf(path, 'instanceId')),
    objectId: requireStringId(value.objectId, pathOf(path, 'objectId')),
    dependencyScopeId: requireStringId(value.dependencyScopeId, pathOf(path, 'dependencyScopeId')),
    bindingGeneration: requireRevision(value.bindingGeneration, pathOf(path, 'bindingGeneration')),
    frameId: requireStringId(value.frameId, pathOf(path, 'frameId')),
    frameRevision: requireRevision(value.frameRevision, pathOf(path, 'frameRevision')),
    policyRevision: requireRevision(value.policyRevision, pathOf(path, 'policyRevision')),
    sourceGeometryRevision: requireRevision(value.sourceGeometryRevision, pathOf(path, 'sourceGeometryRevision')),
    targetSceneRevision: requireRevision(value.targetSceneRevision, pathOf(path, 'targetSceneRevision')),
    membershipRevision: requireRevision(value.membershipRevision, pathOf(path, 'membershipRevision')),
    queryId: requireStringId(value.queryId, pathOf(path, 'queryId')),
    queryRevision: requireRevision(value.queryRevision, pathOf(path, 'queryRevision')),
    referenceOffsetM: normalizeUvM(value.referenceOffsetM, pathOf(path, 'referenceOffsetM')),
    movingBoundsM: {
      min: normalizeUvM(value.movingBoundsM?.min, pathOf(path, 'movingBoundsM.min')),
      max: normalizeUvM(value.movingBoundsM?.max, pathOf(path, 'movingBoundsM.max'))
    },
    sourceFeatures,
    targetFeatures,
    pairRules,
    missing: normalizeArray(value.missing, pathOf(path, 'missing'), (item, itemPath) => {
      assertPlainData(item, itemPath);
      return copyPlainData(item);
    }),
    diagnostics: normalizeArray(value.diagnostics, pathOf(path, 'diagnostics'), (item, itemPath) => {
      assertPlainData(item, itemPath);
      return copyPlainData(item);
    })
  };
  for (const axis of MOTION_AXES) {
    if (snapshot.movingBoundsM.min[axis] > snapshot.movingBoundsM.max[axis]) {
      throwSpatialInvalidInput(pathOf(path, `movingBoundsM.${axis}`));
    }
  }
  return deepFreeze(snapshot);
};

const spatialRefForFeature = feature => {
  const ref = {
    objectId: feature.ownerObjectId,
    featureId: feature.featureId
  };
  if (feature.partId !== undefined) {
    ref.partId = feature.partId;
  }
  return ref;
};

const hasRole = (feature, roles) => roles.includes(feature.role);

const shiftedOffset = (offsetM, deltaM) => ({
  u: offsetM.u + deltaM.u,
  v: offsetM.v + deltaM.v
});

const pointForFeature = (feature, sourceDeltaM) => {
  if (feature.geometry.kind !== 'point') return null;
  return feature.ownerKind === 'source'
    ? shiftedOffset(feature.geometry.pointM, sourceDeltaM)
    : { ...feature.geometry.pointM };
};

const axisValueForFeature = (feature, axis, sourceDeltaM) => {
  if (feature.geometry.kind === 'axis') {
    if (feature.geometry.axis !== axis) return null;
    return feature.geometry.valueM + (feature.ownerKind === 'source' ? sourceDeltaM[axis] : 0);
  }
  if (feature.geometry.kind === 'point') {
    return feature.geometry.pointM[axis] + (feature.ownerKind === 'source' ? sourceDeltaM[axis] : 0);
  }
  return null;
};

const spanForFeatureU = feature => {
  if (feature.supportIntervalUM) return feature.supportIntervalUM;
  if (feature.geometry.kind === 'axis' && feature.geometry.spanM) return feature.geometry.spanM;
  if (feature.geometry.kind === 'point') return {
    min: feature.geometry.pointM.u,
    max: feature.geometry.pointM.u
  };
  return null;
};

// Witness coordinate on the axis a scalar rule does not control: the midpoint of the source
// feature's own span when it declares one, otherwise the moving box mid-extent on that axis,
// both carried to the requested offset. (The controlled axis witnesses the feature value itself.)
const uncontrolledWitnessValue = (feature, axis, snapshot, sourceDeltaM) => {
  const span = feature.geometry.kind === 'axis' && feature.geometry.spanM
    ? feature.geometry.spanM
    : { min: snapshot.movingBoundsM.min[axis], max: snapshot.movingBoundsM.max[axis] };
  return (span.min + span.max) / 2 + sourceDeltaM[axis];
};

const createCandidateForRule = ({ rule, source, target, snapshot, sourceDeltaM }) => {
  const makeBase = (controlledAxes, correctionM, sourceWitnessOffsetM, targetWitnessOffsetM) => {
    const bundleId = rule.bundle
      ? `${rule.bundle.family}:${source.featureId}->${target.featureId}`
      : undefined;
    return {
      pairId: `${rule.ruleId}:${source.featureId}->${target.featureId}`,
      ruleId: rule.ruleId,
      priority: rule.priority,
      source: spatialRefForFeature(source),
      target: spatialRefForFeature(target),
      controlledAxes,
      correctionM,
      sourceWitnessOffsetM,
      targetWitnessOffsetM,
      eligibility: { ...rule.eligibility },
      ...(spanForFeatureU(target) === null ? {} : { targetSpanUM: { ...spanForFeatureU(target) } }),
      ...(bundleId === undefined ? {} : { bundleId }),
      ...(rule.bundle === undefined ? {} : { bundle: { ...rule.bundle } })
    };
  };

  if (rule.operation === 'align-u' || rule.operation === 'align-v') {
    const axis = rule.operation === 'align-u' ? 'u' : 'v';
    const sourceValue = axisValueForFeature(source, axis, sourceDeltaM);
    const targetValue = axisValueForFeature(target, axis, sourceDeltaM);
    if (sourceValue === null || targetValue === null) return null;
    const correctionM = {
      u: axis === 'u' ? targetValue - sourceValue : 0,
      v: axis === 'v' ? targetValue - sourceValue : 0
    };
    const sourceWitnessOffsetM = axis === 'u'
      ? { u: sourceValue, v: uncontrolledWitnessValue(source, 'v', snapshot, sourceDeltaM) }
      : { u: uncontrolledWitnessValue(source, 'u', snapshot, sourceDeltaM), v: sourceValue };
    const targetWitnessOffsetM = axis === 'u'
      ? { u: targetValue, v: sourceWitnessOffsetM.v }
      : { u: sourceWitnessOffsetM.u, v: targetValue };
    return makeBase([axis], correctionM, sourceWitnessOffsetM, targetWitnessOffsetM);
  }

  const sourcePoint = pointForFeature(source, sourceDeltaM);
  const targetPoint = pointForFeature(target, sourceDeltaM);
  if (!sourcePoint || !targetPoint) return null;
  return makeBase(
    ['u', 'v'],
    {
      u: targetPoint.u - sourcePoint.u,
      v: targetPoint.v - sourcePoint.v
    },
    sourcePoint,
    targetPoint
  );
};

const compareCandidates = (left, right) => {
  if (left.priority !== right.priority) return left.priority - right.priority;
  return left.pairId.localeCompare(right.pairId);
};

export function createSnapCandidatesV1(input) {
  assertPlainData(input, '');
  assertExactKeys(input, REQUEST_KEYS, '');
  const requestedOffsetM = normalizeUvM(input.requestedOffsetM, 'requestedOffsetM');
  const snapshot = normalizeSnapGeometrySnapshotV1(input.snapshot, 'snapshot');
  const sourceDeltaM = {
    u: requestedOffsetM.u - snapshot.referenceOffsetM.u,
    v: requestedOffsetM.v - snapshot.referenceOffsetM.v
  };
  const sources = snapshot.sourceFeatures
    .filter(feature => feature.enabled)
    .map(feature => ({ ...feature, ownerKind: 'source' }));
  const targets = snapshot.targetFeatures
    .filter(feature => feature.enabled)
    .map(feature => ({ ...feature, ownerKind: 'target' }));
  const candidates = [];

  for (const rule of snapshot.pairRules) {
    for (const source of sources) {
      if (!hasRole(source, rule.sourceRoles)) continue;
      for (const target of targets) {
        if (!hasRole(target, rule.targetRoles)) continue;
        const candidate = createCandidateForRule({
          rule,
          source,
          target,
          snapshot,
          sourceDeltaM
        });
        if (candidate) {
          candidates.push(candidate);
        }
      }
    }
  }

  return deepFreeze(candidates.sort(compareCandidates));
}
