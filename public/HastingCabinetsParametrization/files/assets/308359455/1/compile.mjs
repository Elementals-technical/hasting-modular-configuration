/**
 * Spec compiler (engine-free): measured scene -> the core's geometry snapshot bodies.
 *
 * The World calls these with a `measure` capability supplied by the engine adapter:
 *   measure.bounds(body)            -> world AABB `{ minM, maxM }` | null
 *   measure.proxies(body, profile)  -> `{ status: 'ready'|'pending'|'unsupported', volumes: [{ role, index, box }] }`
 * and gets back the variable part of a `SnapGeometrySnapshotV1` / `CollisionGeometrySnapshotV1`.
 * Revision tuples are the World's business, never the compiler's.
 */
import { selectBodies } from './selectors.mjs';

const AXES3 = ['x', 'y', 'z'];
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });

/** World AABB -> frame-space bounds `{ min: { u, v, w }, max: { u, v, w } }`. */
export const projectBoundsToFrame = (box, frame) => {
  const min = { u: Infinity, v: Infinity, w: Infinity };
  const max = { u: -Infinity, v: -Infinity, w: -Infinity };
  for (const x of [box.minM.x, box.maxM.x]) {
    for (const y of [box.minM.y, box.maxM.y]) {
      for (const z of [box.minM.z, box.maxM.z]) {
        const local = sub({ x, y, z }, frame.originM);
        const u = dot(local, frame.uAxis);
        const v = dot(local, frame.vAxis);
        const w = dot(local, frame.normal);
        min.u = Math.min(min.u, u); max.u = Math.max(max.u, u);
        min.v = Math.min(min.v, v); max.v = Math.max(max.v, v);
        min.w = Math.min(min.w, w); max.w = Math.max(max.w, w);
      }
    }
  }
  return { min, max };
};

const unionFrameBounds = list => ({
  min: { u: Math.min(...list.map(b => b.min.u)), v: Math.min(...list.map(b => b.min.v)), w: Math.min(...list.map(b => b.min.w)) },
  max: { u: Math.max(...list.map(b => b.max.u)), v: Math.max(...list.map(b => b.max.v)), w: Math.max(...list.map(b => b.max.w)) }
});

const validBox = box => Boolean(box && AXES3.every(axis => Number.isFinite(box.minM?.[axis]) && Number.isFinite(box.maxM?.[axis]) && box.minM[axis] <= box.maxM[axis]));

/**
 * Measure a selection in frame space. Envelopes become one body whose bounds are the union of
 * their members. Returns `{ bodies, missing }`; a body that cannot be measured is reported in
 * `missing` and left out.
 */
const measureSelection = (selector, scene, ctx, measure, frame) => {
  const bodies = [];
  const missing = [];
  const boundsOf = body => {
    const box = measure.bounds(body);
    if (!validBox(box)) {
      missing.push({ objectId: body.id, partId: 'bounds', reason: 'geometry-pending' });
      return null;
    }
    return projectBoundsToFrame(box, frame);
  };
  for (const body of selectBodies(selector, scene.bodies, ctx)) {
    if (body.members) {
      const parts = body.members.map(boundsOf);
      if (parts.some(part => part === null)) continue;
      bodies.push({ ...body, boundsUV: unionFrameBounds(parts) });
    } else {
      const boundsUV = boundsOf(body);
      if (boundsUV) bodies.push({ ...body, boundsUV });
    }
  }
  return { bodies, missing };
};

const featureFromDescriptor = (descriptor, group, body) => ({
  featureId: descriptor.featureId ?? `${group}:${body.id}:${descriptor.key}`,
  ownerObjectId: descriptor.ownerObjectId ?? body.id,
  ...(descriptor.partId === undefined ? {} : { partId: descriptor.partId }),
  role: descriptor.role ?? `${group}.${descriptor.key}`,
  enabled: descriptor.enabled ?? true,
  geometry: descriptor.geometry,
  ...(descriptor.supportIntervalUM === undefined ? {} : { supportIntervalUM: { ...descriptor.supportIntervalUM } })
});

/** Core pair rules active for the current axes (drops `onlyWhenFrozen` rules on free axes). */
export const compilePairRules = (rules, allowedAxes) => rules
  .filter(rule => rule.onlyWhenFrozen.every(axis => !allowedAxes.includes(axis)))
  .map(({ onlyWhenFrozen, ...rule }) => ({
    ...rule,
    sourceRoles: [...rule.sourceRoles],
    targetRoles: [...rule.targetRoles],
    eligibility: { ...rule.eligibility },
    ...(rule.bundle ? { bundle: { ...rule.bundle, compatibleScalarRuleIds: [...rule.bundle.compatibleScalarRuleIds] } } : {})
  }));

/**
 * Snap geometry of one manipulable at the current pose.
 *
 * @returns {{ readiness, coverage, missing, diagnostics, referenceOffsetM, movingBoundsM,
 *             sourceFeatures, targetFeatures, pairRules }}
 */
export function compileSnapGeometry({ spec, frame, scene, ctx, measure, offsetM, allowedAxes }) {
  const snapping = spec.snapping;
  const empty = (readiness, missing, reason) => ({
    readiness,
    coverage: 'none',
    missing,
    diagnostics: reason ? [{ code: 'SPATIAL_SNAP_GEOMETRY_UNAVAILABLE', message: reason, expected: { readiness: 'ready' }, actual: { readiness } }] : [],
    referenceOffsetM: { u: 0, v: 0 },
    movingBoundsM: { min: { u: 0, v: 0 }, max: { u: 0, v: 0 } },
    sourceFeatures: [],
    targetFeatures: [],
    pairRules: []
  });
  if (!snapping) return empty('disabled', [], null);
  const self = measureSelection('self', scene, ctx, measure, frame);
  if (self.bodies.length !== 1) return empty('pending', self.missing, 'the moving body cannot be measured');
  const selfBody = self.bodies[0];

  const sourceFeatures = [];
  const targetFeatures = [];
  const missing = [];
  const seen = new Set();
  for (const [group, definition] of Object.entries(snapping.features)) {
    const selection = definition.select.kind === 'self'
      ? { bodies: [selfBody], missing: [] }
      : measureSelection(definition.select, scene, ctx, measure, frame);
    missing.push(...selection.missing);
    const bodies = definition.when ? selection.bodies.filter(body => definition.when(body, ctx)) : selection.bodies;
    const isSource = definition.select.kind === 'self';
    const push = (descriptor, body) => {
      const feature = featureFromDescriptor(descriptor, group, body);
      if (isSource) feature.ownerObjectId = descriptor.ownerObjectId ?? ctx.objectId;
      if (seen.has(`${isSource}:${feature.featureId}`)) return;
      seen.add(`${isSource}:${feature.featureId}`);
      (isSource ? sourceFeatures : targetFeatures).push(feature);
    };
    if (definition.extract.perBody === false) {
      for (const descriptor of definition.extract(bodies, { ...ctx, frame }) ?? []) {
        push(descriptor, { id: descriptor.ownerObjectId ?? group });
      }
    } else {
      for (const body of bodies) {
        for (const descriptor of definition.extract(body, { ...ctx, frame }) ?? []) push(descriptor, body);
      }
    }
  }
  // Fail closed: a structural body that could not be measured must not expose an interior edge.
  if (missing.length) return empty('pending', missing, 'a selected body cannot be measured');

  return {
    readiness: 'ready',
    coverage: 'complete',
    missing: [],
    diagnostics: [],
    referenceOffsetM: { u: offsetM.u, v: offsetM.v },
    movingBoundsM: {
      min: { u: selfBody.boundsUV.min.u, v: selfBody.boundsUV.min.v },
      max: { u: selfBody.boundsUV.max.u, v: selfBody.boundsUV.max.v }
    },
    sourceFeatures,
    targetFeatures,
    pairRules: compilePairRules(snapping.rules, allowedAxes)
  };
}

const volume = (ownerObjectId, role, index, box, profileId) => ({
  volumeId: `${ownerObjectId}/${role}/${index}`,
  ownerObjectId,
  partId: `${role}/${index}`,
  role,
  rigidGroupId: ownerObjectId,
  profile: { id: profileId, version: 1 },
  shape: { kind: 'aabb', box: { minM: { ...box.minM }, maxM: { ...box.maxM } } }
});

const volumesOf = (body, resolver, ctx, measure) => {
  if (resolver === 'bounds') {
    const box = measure.bounds(body);
    return validBox(box)
      ? { status: 'ready', volumes: [volume(body.id, 'body', 0, box, 'bounds')] }
      : { status: 'pending', volumes: [], missing: [{ objectId: body.id, partId: 'bounds', reason: 'geometry-pending' }] };
  }
  const profile = resolver(body, ctx);
  if (profile === null || profile === undefined) return { status: 'skip', volumes: [] };
  if (profile.supported === false) {
    return { status: 'unsupported', volumes: [], missing: [{ objectId: body.id, partId: 'collision-profile', reason: 'unsupported-profile-geometry' }] };
  }
  const measured = measure.proxies(body, profile);
  if (measured.status === 'inactive') return { status: 'skip', volumes: [] };
  if (measured.status !== 'ready') {
    return {
      status: measured.status === 'pending' ? 'pending' : 'unsupported',
      volumes: [],
      missing: [{ objectId: body.id, partId: profile.id ?? 'collision-profile', reason: measured.status === 'pending' ? 'missing-required-part' : 'unsupported-profile-geometry' }]
    };
  }
  const bad = measured.volumes.find(item => !validBox(item.box));
  if (bad) return { status: 'pending', volumes: [], missing: [{ objectId: body.id, partId: `${bad.role}/${bad.index}`, reason: 'missing-required-part' }] };
  return { status: 'ready', volumes: measured.volumes.map(item => volume(body.id, item.role, item.index, item.box, profile.id ?? 'profile')) };
};

const worse = (left, right) => {
  const rank = { ready: 0, pending: 1, unsupported: 2 };
  return rank[right] > rank[left] ? right : left;
};

/**
 * Collision geometry of one manipulable at the current pose (observe mode).
 *
 * @returns {{ readiness, coverage, missing, diagnostics, referenceSourcePivotM, sourceVolumes, targetVolumes }}
 */
export function compileCollisionGeometry({ spec, frame, scene, ctx, measure, offsetM }) {
  const collision = spec.collision;
  const pivot = {
    x: frame.originM.x + frame.uAxis.x * offsetM.u + frame.vAxis.x * offsetM.v,
    y: frame.originM.y + frame.uAxis.y * offsetM.u + frame.vAxis.y * offsetM.v,
    z: frame.originM.z + frame.uAxis.z * offsetM.u + frame.vAxis.z * offsetM.v
  };
  const result = (readiness, sourceVolumes, targetVolumes, missing) => ({
    readiness,
    coverage: readiness === 'ready' ? 'complete' : 'none',
    missing,
    diagnostics: [],
    referenceSourcePivotM: pivot,
    sourceVolumes: readiness === 'ready' ? sourceVolumes : [],
    targetVolumes: readiness === 'ready' ? targetVolumes : []
  });
  if (!collision) return result('disabled', [], [], []);

  const source = volumesOf(ctx.self, collision.source, ctx, measure);
  if (source.status !== 'ready' || source.volumes.length === 0) {
    return result(source.status === 'unsupported' ? 'unsupported' : 'pending', [], [], source.missing ?? []);
  }
  const sourceVolumes = source.volumes.map(item => ({ ...item, ownerObjectId: ctx.objectId, rigidGroupId: ctx.objectId }));

  const roles = typeof collision.roles === 'function' ? collision.roles(ctx) : collision.roles;
  let readiness = 'ready';
  const targetVolumes = [];
  const missing = [];
  for (const body of selectBodies(collision.against, scene.bodies, ctx)) {
    const bodies = body.members ?? [body];
    for (const member of bodies) {
      const measured = volumesOf(member, collision.volumes, ctx, measure);
      if (measured.status === 'skip') continue;
      if (measured.status !== 'ready') {
        readiness = worse(readiness, measured.status);
        missing.push(...(measured.missing ?? []));
        continue;
      }
      for (const item of measured.volumes) {
        if (roles && !roles.includes(item.role)) continue;
        targetVolumes.push(item);
      }
    }
  }
  targetVolumes.sort((a, b) => a.volumeId.localeCompare(b.volumeId));
  return result(readiness, sourceVolumes, targetVolumes, missing);
}
