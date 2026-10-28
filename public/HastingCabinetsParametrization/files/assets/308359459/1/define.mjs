/**
 * defineManipulable — validate and normalize a manipulable spec (engine-free).
 *
 * The spec is the only thing a consumer writes: which frame the object moves in, which axes,
 * bounds and grid, which features snap to which, and what it may not intersect. Everything that
 * needs the live scene is a function of `ctx = { host, body, self }` evaluated by the World.
 * See README.md for the full reference.
 */
import { toSelector } from './selectors.mjs';

const MOTION_AXES = Object.freeze(['u', 'v']);
const OPERATIONS = Object.freeze(['align-u', 'align-v', 'coincide-uv']);
const WHEN_SHORTHAND = Object.freeze({
  none: 'none',
  'overlap-u': 'positive-u-overlap',
  'abut-u': 'u-abut-without-overlap'
});
const DEFAULT_RULE_EPSILON_M = 1e-9;

export const DEFAULT_SNAP_THRESHOLDS = Object.freeze({
  mouse: Object.freeze({ engagePx: 8, releasePx: 14, switchMarginPx: 2, tieEpsilonPx: 0.5 }),
  touch: Object.freeze({ engagePx: 12, releasePx: 22, switchMarginPx: 2, tieEpsilonPx: 0.5 })
});
export const DEFAULT_COLLISION_EPSILON_M = 1e-6;
export const DEFAULT_DRAG_HYSTERESIS_RATIO = 0.1;

const PLANES = Object.freeze({
  xy: { uAxis: { x: 1, y: 0, z: 0 }, vAxis: { x: 0, y: 1, z: 0 } },
  xz: { uAxis: { x: 1, y: 0, z: 0 }, vAxis: { x: 0, y: 0, z: 1 } },
  zy: { uAxis: { x: 0, y: 0, z: 1 }, vAxis: { x: 0, y: 1, z: 0 } }
});

const SPEC = Symbol.for('spatial-manipulation.spec');

const fail = (path, message) => {
  const error = new TypeError(`defineManipulable: ${path}: ${message}`);
  error.code = 'SPATIAL_INVALID_SPEC';
  error.path = path;
  throw error;
};
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isFn = value => typeof value === 'function';
const finite = value => typeof value === 'number' && Number.isFinite(value);
const nonEmpty = value => typeof value === 'string' && value.length > 0;
const list = value => (Array.isArray(value) ? value : [value]);
const constant = value => () => value;
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });

const checkKeys = (value, allowed, path) => {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(`${path}.${key}`, 'unknown key');
};

const normalizeFrame = (value = 'xy', path = 'frame') => {
  if (isFn(value)) return value;
  if (typeof value === 'string') value = { plane: value };
  if (!isRecord(value)) fail(path, 'expected a plane name, an object or a function');
  if (value.plane !== undefined) {
    checkKeys(value, ['plane', 'origin'], path);
    const plane = PLANES[value.plane];
    if (!plane) fail(`${path}.plane`, `expected one of ${Object.keys(PLANES).join(', ')}`);
    const origin = value.origin === undefined ? constant({ x: 0, y: 0, z: 0 }) : (isFn(value.origin) ? value.origin : constant(value.origin));
    return ctx => ({ originM: origin(ctx), uAxis: plane.uAxis, vAxis: plane.vAxis, normal: cross(plane.uAxis, plane.vAxis) });
  }
  checkKeys(value, ['originM', 'uAxis', 'vAxis', 'normal'], path);
  return constant({ ...value, normal: value.normal ?? cross(value.uAxis, value.vAxis) });
};

const normalizeAxisRecord = (value, path, check) => {
  if (value === undefined || value === null) return {};
  if (!isRecord(value)) fail(path, 'expected an object keyed by u/v');
  const out = {};
  for (const [axis, entry] of Object.entries(value)) {
    if (!MOTION_AXES.includes(axis)) fail(`${path}.${axis}`, 'unknown axis');
    out[axis] = check(entry, `${path}.${axis}`);
  }
  return out;
};

const normalizeBounds = (value, path) => normalizeAxisRecord(value, path, (range, at) => {
  if (!isRecord(range) || !finite(range.min) || !finite(range.max) || range.min > range.max) fail(at, 'expected { min, max } with min <= max');
  return { min: range.min, max: range.max };
});

const normalizeGrid = (value, path) => normalizeAxisRecord(value, path, (step, at) => {
  if (!finite(step) || step <= 0) fail(at, 'expected a positive step in metres');
  return step;
});

const normalizeMotion = (value = {}, path = 'motion') => {
  if (!isRecord(value)) fail(path, 'expected an object');
  checkKeys(value, ['axes', 'boundsM', 'gridM', 'gridOriginM', 'dragHysteresisRatio'], path);
  const axes = value.axes === undefined ? [...MOTION_AXES] : list(value.axes);
  for (const axis of axes) if (!MOTION_AXES.includes(axis)) fail(`${path}.axes`, `unknown axis "${axis}"`);
  const origin = value.gridOriginM ?? { u: 0, v: 0 };
  if (!finite(origin.u) || !finite(origin.v)) fail(`${path}.gridOriginM`, 'expected { u, v }');
  const hysteresis = value.dragHysteresisRatio ?? DEFAULT_DRAG_HYSTERESIS_RATIO;
  if (!finite(hysteresis) || hysteresis < 0) fail(`${path}.dragHysteresisRatio`, 'expected a non-negative number');
  return Object.freeze({
    axes: Object.freeze([...new Set(axes)]),
    boundsM: normalizeBounds(value.boundsM, `${path}.boundsM`),
    gridM: normalizeGrid(value.gridM, `${path}.gridM`),
    gridOriginM: { u: origin.u, v: origin.v },
    dragHysteresisRatio: hysteresis
  });
};

const normalizeThresholds = (value, path) => {
  const merged = { ...DEFAULT_SNAP_THRESHOLDS, ...(value ?? {}) };
  for (const pointer of ['mouse', 'touch']) {
    const entry = merged[pointer];
    if (!isRecord(entry) || !['engagePx', 'releasePx', 'switchMarginPx', 'tieEpsilonPx'].every(key => finite(entry[key]))) {
      fail(`${path}.${pointer}`, 'expected { engagePx, releasePx, switchMarginPx, tieEpsilonPx }');
    }
  }
  return Object.freeze({ mouse: { ...merged.mouse }, touch: { ...merged.touch } });
};

const normalizeFeatureGroup = (value, path) => {
  if (!isRecord(value)) fail(path, 'expected { select, extract, when? }');
  checkKeys(value, ['select', 'extract', 'when'], path);
  if (!isFn(value.extract)) fail(`${path}.extract`, 'expected an extractor function');
  if (value.when !== undefined && !isFn(value.when)) fail(`${path}.when`, 'expected a predicate');
  let select;
  try {
    select = toSelector(value.select ?? 'self');
  } catch (error) {
    fail(`${path}.select`, error.message);
  }
  return Object.freeze({ select, extract: value.extract, when: value.when ?? null });
};

const normalizeWhen = (value, epsilonM, path) => {
  if (value === undefined) return { kind: 'none' };
  if (typeof value === 'string') {
    const kind = WHEN_SHORTHAND[value] ?? value;
    if (!Object.values(WHEN_SHORTHAND).includes(kind)) fail(path, `unknown condition "${value}"`);
    return kind === 'none' ? { kind } : { kind, epsilonM };
  }
  if (isRecord(value) && Object.values(WHEN_SHORTHAND).includes(value.kind)) {
    return value.kind === 'none' ? { kind: 'none' } : { kind: value.kind, epsilonM: value.epsilonM ?? epsilonM };
  }
  return fail(path, 'expected a condition name or { kind, epsilonM }');
};

const normalizeRule = (value, index, path) => {
  const at = `${path}[${index}]`;
  if (!isRecord(value)) fail(at, 'expected a rule object');
  checkKeys(value, ['id', 'from', 'to', 'op', 'priority', 'when', 'epsilonM', 'bundle', 'onlyWhenFrozen'], at);
  if (!nonEmpty(value.id)) fail(`${at}.id`, 'expected a rule id');
  const from = list(value.from);
  const to = list(value.to);
  if (!from.length || !from.every(nonEmpty)) fail(`${at}.from`, 'expected one or more source roles');
  if (!to.length || !to.every(nonEmpty)) fail(`${at}.to`, 'expected one or more target roles');
  if (!OPERATIONS.includes(value.op)) fail(`${at}.op`, `expected one of ${OPERATIONS.join(', ')}`);
  const epsilonM = value.epsilonM ?? DEFAULT_RULE_EPSILON_M;
  if (!finite(epsilonM) || epsilonM < 0) fail(`${at}.epsilonM`, 'expected a non-negative number');
  const priority = value.priority ?? 0;
  if (!finite(priority)) fail(`${at}.priority`, 'expected a number');
  const frozen = value.onlyWhenFrozen === undefined ? [] : list(value.onlyWhenFrozen);
  for (const axis of frozen) if (!MOTION_AXES.includes(axis)) fail(`${at}.onlyWhenFrozen`, `unknown axis "${axis}"`);
  let bundle;
  if (value.bundle !== undefined) {
    const b = value.bundle;
    if (!isRecord(b) || !nonEmpty(b.family)) fail(`${at}.bundle`, 'expected { family, compatible?, retainOverProjection? }');
    bundle = {
      family: b.family,
      compatibleScalarRuleIds: [...(b.compatible ?? [])],
      retainOverProjection: b.retainOverProjection ?? true
    };
  }
  return Object.freeze({
    ruleId: value.id,
    sourceRoles: from,
    targetRoles: to,
    operation: value.op,
    priority,
    eligibility: normalizeWhen(value.when, epsilonM, `${at}.when`),
    ...(bundle ? { bundle } : {}),
    onlyWhenFrozen: Object.freeze(frozen)
  });
};

const normalizeSnapping = (value, path = 'snapping') => {
  if (value === undefined || value === null || value === false) return null;
  if (!isRecord(value)) fail(path, 'expected an object');
  checkKeys(value, ['enabled', 'thresholds', 'features', 'rules'], path);
  if (!isRecord(value.features) || Object.keys(value.features).length === 0) fail(`${path}.features`, 'expected named feature groups');
  const features = {};
  for (const [name, group] of Object.entries(value.features)) {
    if (!/^[A-Za-z][\w-]*$/.test(name)) fail(`${path}.features.${name}`, 'group names are identifiers');
    features[name] = normalizeFeatureGroup(group, `${path}.features.${name}`);
  }
  if (!Array.isArray(value.rules) || value.rules.length === 0) fail(`${path}.rules`, 'expected at least one rule');
  const rules = value.rules.map((rule, index) => normalizeRule(rule, index, `${path}.rules`));
  const ids = new Set();
  for (const rule of rules) {
    if (ids.has(rule.ruleId)) fail(`${path}.rules`, `duplicate rule id "${rule.ruleId}"`);
    ids.add(rule.ruleId);
  }
  return Object.freeze({
    enabled: value.enabled ?? true,
    thresholds: normalizeThresholds(value.thresholds, `${path}.thresholds`),
    features: Object.freeze(features),
    rules: Object.freeze(rules)
  });
};

const normalizeVolumes = (value, path) => {
  if (value === undefined || value === 'bounds') return 'bounds';
  if (isFn(value)) return value;
  return fail(path, "expected 'bounds' or a resolver (body, ctx) => profile | null");
};

const normalizeCollision = (value, path = 'collision') => {
  if (value === undefined || value === null || value === false) return null;
  if (!isRecord(value)) fail(path, 'expected an object');
  checkKeys(value, ['enabled', 'epsilonM', 'source', 'against', 'volumes', 'roles'], path);
  const epsilonM = value.epsilonM ?? DEFAULT_COLLISION_EPSILON_M;
  if (!finite(epsilonM) || epsilonM < 0) fail(`${path}.epsilonM`, 'expected a non-negative number');
  if (value.against === undefined) fail(`${path}.against`, 'expected a selector');
  let against;
  try {
    against = toSelector(value.against);
  } catch (error) {
    fail(`${path}.against`, error.message);
  }
  if (value.roles !== undefined && !isFn(value.roles) && (!Array.isArray(value.roles) || !value.roles.every(nonEmpty))) {
    fail(`${path}.roles`, 'expected a list of volume roles or a function of ctx');
  }
  return Object.freeze({
    enabled: value.enabled ?? true,
    epsilonM,
    source: normalizeVolumes(value.source, `${path}.source`),
    against,
    volumes: normalizeVolumes(value.volumes, `${path}.volumes`),
    roles: value.roles === undefined ? null : (isFn(value.roles) ? value.roles : Object.freeze([...value.roles]))
  });
};

const normalizeTarget = (value = {}, path = 'target') => {
  if (!isRecord(value)) fail(path, 'expected an object');
  checkKeys(value, ['entities', 'pick', 'pose'], path);
  for (const key of ['entities', 'pick', 'pose']) {
    if (value[key] !== undefined && !isFn(value[key])) fail(`${path}.${key}`, 'expected a function of ctx');
  }
  return Object.freeze({ entities: value.entities ?? null, pick: value.pick ?? null, pose: value.pose ?? null });
};

/** Validate and normalize a spec. Throws `SPATIAL_INVALID_SPEC` with a precise path. */
export function defineManipulable(spec) {
  if (isManipulableSpec(spec)) return spec;
  if (!isRecord(spec)) fail('spec', 'expected an object');
  checkKeys(spec, ['id', 'frame', 'motion', 'target', 'snapping', 'collision'], 'spec');
  if (!nonEmpty(spec.id)) fail('id', 'expected a non-empty id');
  return Object.freeze({
    [SPEC]: true,
    id: spec.id,
    frame: normalizeFrame(spec.frame),
    motion: normalizeMotion(spec.motion),
    target: normalizeTarget(spec.target),
    snapping: normalizeSnapping(spec.snapping),
    collision: normalizeCollision(spec.collision)
  });
}

export const isManipulableSpec = value => Boolean(value && value[SPEC] === true);
