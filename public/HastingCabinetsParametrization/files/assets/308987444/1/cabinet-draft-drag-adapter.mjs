import { defineManipulable } from '../../spatial-manipulation/index.mjs';
import { createPlayCanvasSpatialWorld } from '../../spatial-manipulation/playcanvas/index.mjs';
import { measureEntityBoundsM } from '../../spatial-manipulation/playcanvas/scene-measure.mjs';
import { boxCorners } from '../draft-overlay-geometry.mjs';

const finite = value => typeof value === 'number' && Number.isFinite(value);
const vec = value => value && ['x', 'y', 'z'].every(axis => finite(value[axis]));
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x });
const addScaled = (origin, axis, amount) => ({ x: origin.x + axis.x * amount,
  y: origin.y + axis.y * amount, z: origin.z + axis.z * amount });
const sameScope = (a, b) => a?.apiInstanceId === b?.apiInstanceId && a?.compositionId === b?.compositionId;
const PLANE = Object.freeze({ xy: ['x', 'y', 'z'], xz: ['x', 'z', 'y'], zy: ['z', 'y', 'x'] });

/**
 * Pure: how far (along the motion V axis) a cabinet's pivot (body bottom = its level) sits above
 * its mesh bottom — ~0.06 m for a sink bowl hanging below the body, 0 for a plain cabinet.
 * The SC spatial profile's edge extractors lift V edges by it so snapping works on the body level
 * while collisions keep the mesh bounds. Null when unmeasurable.
 */
export function levelLiftM(pivot, meshBox, vAxis) {
  if (!vec(pivot) || !vec(meshBox?.minM) || !vec(meshBox?.maxM) || !vec(vAxis)) return null;
  let meshMinV = 0;
  for (const c of ['x', 'y', 'z']) meshMinV += vAxis[c] * (vAxis[c] >= 0 ? meshBox.minM[c] : meshBox.maxM[c]);
  const lift = dot(pivot, vAxis) - meshMinV;
  return finite(lift) ? lift : null;
}

const levelled = (body, vAxis) => {
  const entity = body?.entity;
  if (!entity || typeof entity.getPosition !== 'function' || body.tags?.includes('floor')) return body;
  let lift = null;
  try { lift = levelLiftM(entity.getPosition(), measureEntityBoundsM(entity), vAxis); } catch { lift = null; }
  return finite(lift) && Math.abs(lift) > 1e-6 ? { ...body, meta: { ...(body.meta ?? {}), levelLiftM: lift } } : body;
};

/** Pure: is a canvas-CSS-px point inside `{ minX, minY, maxX, maxY }` (edges inclusive)? */
export function pointInScreenRect(point, rect) {
  if (!point || !rect || !finite(point.x) || !finite(point.y)) return false;
  if (![rect.minX, rect.minY, rect.maxX, rect.maxY].every(finite)) return false;
  return point.x >= rect.minX && point.x <= rect.maxX && point.y >= rect.minY && point.y <= rect.maxY;
}

/** Pure: screen rect of projected points; null if any is not projectable (behind camera). */
export function screenRectOf(points) {
  if (!Array.isArray(points) || !points.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (!p || !finite(p.x) || !finite(p.y)) return null;
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}

// Draft pick priority: `point` is the router's pc.MouseEvent/Touch x,y = canvas-relative CSS px,
// the same space as SelectTool.getSelectionTargetAt (screenToWorld) and camera.worldToScreen.
const draftScreenRectAt = (app, entity) => {
  const camera = app?.selectTool?.cameraEntity?.camera || app?.root?.findComponent?.('camera')?.entity?.camera;
  if (typeof camera?.worldToScreen !== 'function' || typeof entity?.getPosition !== 'function') return null;
  const box = measureEntityBoundsM(entity);
  if (!box) return null;
  const Vec3 = entity.getPosition().constructor;
  const scratch = new Vec3(), out = new Vec3();
  return screenRectOf(boxCorners(box).map(c => {
    scratch.set(c.x, c.y, c.z);
    camera.worldToScreen(scratch, out);
    return out.z > 0 ? { x: out.x, y: out.y } : null;
  }));
};

/**
 * Optional PlayCanvas input adapter for one active Add draft. The preview supplies pick and
 * moving-body geometry; committed neighbours come from readBodies. The authoritative pose and
 * validation are written solely through the injected base cabinetPlacement.updateDraft method.
 * The spatial world owns motion, snapping, collision observation and guides. Its shared router
 * owns pointer arbitration, touch transitions, projection rebases and latest-sample delivery.
 */
export function createCabinetDraftDragAdapter({ app, api, preview, readFrame,
  readBodies = () => [], readSpatialProfile = () => ({ plane: 'xz' }), onError = () => {} } = {}) {
  if (!app || typeof api?.cabinetPlacement?.on !== 'function' ||
    typeof api.cabinetPlacement.updateDraft !== 'function' ||
    !['getActiveHandles', 'getPickTarget', 'containsPickTarget'].every(name => typeof preview?.[name] === 'function') ||
    typeof readFrame !== 'function' || typeof readBodies !== 'function' ||
    typeof readSpatialProfile !== 'function' || typeof onError !== 'function') {
    throw new TypeError('Cabinet draft input requires app, base API, preview pick ports and frame resolver');
  }

  let unsubscribe = null, world = null, active = null, started = false, closed = false;
  let generation = 0, sequence = -1;
  const disposals = new Set(), registrations = new Set();
  const report = (stage, error) => { try { onError(stage, error); } catch { /* observation only */ } };
  const currentPosition = binding => {
    const candidate = binding.draft.candidate;
    const requested = candidate?.placement?.kind === 'free' ? candidate.placement.positionM : null;
    const effective = candidate?.effectivePlacement?.positionM;
    if (vec(requested)) return requested;
    if (vec(effective)) return effective;
    const world = preview.getPickTarget(binding.handle)?.getPosition?.();
    if (!vec(world)) return null;
    const delta = sub(world, binding.documentFrame.originM);
    return { x: dot(delta, binding.documentFrame.xAxis), y: dot(delta, binding.documentFrame.yAxis),
      z: dot(delta, binding.documentFrame.zAxis) };
  };
  const offsetOf = binding => {
    const position = currentPosition(binding);
    return position ? { u: position[binding.axes[0]], v: position[binding.axes[1]] } : null;
  };
  const detach = () => {
    generation++;
    const previous = active;
    active = null;
    if (previous && app.spatialManipulationInput?.getSnapshot().instanceId === previous.instanceId)
      app.spatialManipulationInput.unregister(previous.instanceId);
    if (previous?.spatialHandle) {
      const disposal = previous.spatialHandle.destroy().catch(error => report('dispose', error));
      disposals.add(disposal);
      disposal.finally(() => disposals.delete(disposal));
    }
  };
  const bind = (draft, identity) => {
    const handles = preview.getActiveHandles();
    const handle = handles.length === 1 ? handles[0] : null;
    const target = handle && preview.getPickTarget(handle);
    const frameId = draft.candidate?.placement?.frameId ?? draft.candidate?.effectivePlacement?.frameId ?? null;
    const documentFrame = readFrame(frameId, draft);
    if (!handle || !target || !documentFrame ||
      typeof documentFrame.id !== 'string' || !documentFrame.id ||
      !vec(documentFrame.originM) || !vec(documentFrame.xAxis) ||
      !vec(documentFrame.yAxis) || !vec(documentFrame.zAxis)) return null;
    const profile = readSpatialProfile(draft, documentFrame) ?? {};
    const axes = PLANE[profile.plane ?? 'xz'];
    if (!axes) throw new TypeError('Unknown draft spatial plane');
    const seed = { draft, identity, handle, target, documentFrame, profile, axes,
      instanceId: `cabinet-draft:${identity.apiInstanceId}:${draft.sessionId}:${generation}`, ownWrite: false };
    const position = currentPosition(seed);
    if (!position) return null;
    const axis = { x: documentFrame.xAxis, y: documentFrame.yAxis, z: documentFrame.zAxis };
    const uAxis = axis[axes[0]], vAxis = axis[axes[1]];
    const normal = cross(uAxis, vAxis);
    if (!vec(normal) || Math.abs(dot(normal, normal) - 1) > 1e-6) return null;
    const motionFrame = Object.freeze({
      originM: addScaled(documentFrame.originM, axis[axes[2]], position[axes[2]]),
      uAxis: { ...uAxis }, vAxis: { ...vAxis }, normal });
    return { ...seed, motionFrame, fixed: position[axes[2]] };
  };
  const install = binding => {
    world ??= createPlayCanvasSpatialWorld(app, {
      scene: {
        scopeId: () => active?.identity.compositionId ?? 'cabinet-draft',
        bodies: () => {
          if (!active) return [];
          const neighbours = readBodies(active.draft) ?? [];
          if (!Array.isArray(neighbours)) throw new TypeError('readBodies must return an array');
          const vAxis = active.motionFrame.vAxis;
          const self = { id: active.instanceId, entity: active.target, tags: ['draft-preview'] };
          return [levelled(self, vAxis), ...neighbours.map(body => levelled(body, vAxis))];
        }
      },
      hitTest: (handle, point) => {
        if (!active || handle.id !== active.instanceId || !preview.getPickTarget(active.handle)) return false;
        try {
          if (pointInScreenRect(point, draftScreenRectAt(app, preview.getPickTarget(active.handle)))) return true;
        } catch { /* fall back to nearest-target pick */ }
        const picked = app.selectTool?.getSelectionTargetAt?.(point.x, point.y) ?? null;
        return preview.containsPickTarget(active.handle, picked);
      },
      onError: (stage, error) => report(`spatial:${stage}`, error)
    });
    const myGeneration = generation;
    // The spatial pose port has a lease identity but does not move scene transforms.
    const target = binding.target.getGuid?.() || binding.target.name
      ? binding.target : { name: binding.instanceId, children: [] };
    const driver = {
      read: () => offsetOf(binding),
      async write(offset) {
        if (closed || generation !== myGeneration || active !== binding) throw new Error('Draft input expired');
        if (!finite(offset?.u) || !finite(offset?.v)) throw new TypeError('Invalid draft pointer offset');
        const before = binding.draft.candidateRevision;
        const position = currentPosition(binding);
        const positionM = { ...position, [binding.axes[0]]: offset.u,
          [binding.axes[1]]: offset.v, [binding.axes[2]]: binding.fixed };
        binding.ownWrite = true;
        try {
          const result = await api.cabinetPlacement.updateDraft({ ...binding.identity,
            sessionId: binding.draft.sessionId, expectedCandidateRevision: before,
            placement: { kind: 'free', frameId: binding.documentFrame.id, positionM } });
          if (!result?.ok) throw Object.assign(new Error(result?.error?.code ?? 'DRAFT_UPDATE_FAILED'),
            { code: result?.error?.code ?? 'DRAFT_UPDATE_FAILED' });
          if (closed || generation !== myGeneration || active !== binding ||
            result.data?.sessionId !== binding.draft.sessionId || result.data.candidateRevision <= before)
            throw new Error('Draft input response expired');
          binding.draft = result.data;
        } finally { binding.ownWrite = false; }
      }
    };
    const spec = defineManipulable({
      id: 'cabinet-draft', frame: binding.motionFrame, motion: binding.profile.motion ?? {},
      target: { entities: () => [target], pick: () => [target], pose: () => driver },
      ...(binding.profile.snapping ? { snapping: binding.profile.snapping } : {}),
      ...(binding.profile.collision ? { collision: binding.profile.collision } : {})
    });
    active = binding;
    world.invalidate('draft-rebind');
    const registration = world.register(spec, { body: binding.instanceId, id: binding.instanceId,
      canDrag: () => active === binding && binding.draft.lifecycle === 'preview' })
      .then(async handle => {
        if (closed || generation !== myGeneration || active !== binding) {
          await handle.destroy();
          return;
        }
        binding.spatialHandle = handle;
      }).catch(error => {
        if (active === binding) active = null;
        report('register', error);
      });
    registrations.add(registration);
    registration.finally(() => registrations.delete(registration));
  };
  const accept = envelope => {
    if (closed || !envelope || !Number.isSafeInteger(envelope.eventSequence) || envelope.eventSequence <= sequence) return;
    sequence = envelope.eventSequence;
    const draft = envelope.data, identity = { apiInstanceId: envelope.apiInstanceId,
      compositionId: envelope.compositionId };
    if (!draft || draft.lifecycle !== 'preview' || !draft.sessionId) { detach(); return; }
    if (active && active.draft.sessionId === draft.sessionId && sameScope(active.identity, identity) &&
      preview.getActiveHandles().length === 1 && preview.getActiveHandles()[0] === active.handle) {
      // The API emits an event during our own CAS write, before the promise resolves. A
      // manual update, even in the same plane, must rebind the spatial pose revision.
      if (active.ownWrite || (active.draft.candidateRevision === draft.candidateRevision &&
        active.draft.candidate === draft.candidate)) {
        active.draft = draft;
        return;
      }
    }
    detach();
    try { const binding = bind(draft, identity); if (binding) install(binding); }
    catch (error) { report('bind', error); }
  };
  let destruction = null;
  const settle = async () => {
    await Promise.all([...registrations]);
    if (app.spatialManipulationInput) await app.spatialManipulationInput.settle();
    await active?.spatialHandle?.whenSettled();
    await Promise.all([...disposals]);
    return active?.draft ?? null;
  };
  return Object.freeze({
    start() {
      if (closed) throw new Error('Draft input destroyed');
      if (started) return;
      started = true;
      unsubscribe = api.cabinetPlacement.on('change', accept, { emitCurrent: true });
    },
    settle,
    async stop() {
      const router = app.spatialManipulationInput;
      const state = router?.getSnapshot();
      if (state?.instanceId === active?.instanceId) {
        if (state.pointerType === 'touch') router.handleTouchEnd({ touches: [] });
        else router.handleMouseUp({ button: 0 });
      }
      return settle();
    },
    getSnapshot() { return Object.freeze({ started, closed, sessionId: active?.draft.sessionId ?? null,
      candidateRevision: active?.draft.candidateRevision ?? null,
      phase: app.spatialManipulationInput?.getSnapshot().phase ?? 'idle',
      spatial: active?.spatialHandle?.getState() ?? null }); },
    destroy() {
      if (destruction) return destruction;
      destruction = (async () => {
        closed = true;
        detach();
        unsubscribe?.(); unsubscribe = null;
        await settle();
        await world?.destroy();
      })();
      return destruction;
    }
  });
}
