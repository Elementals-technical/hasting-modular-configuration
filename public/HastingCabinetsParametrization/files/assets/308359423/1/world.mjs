/**
 * The PlayCanvas World: `getSpatialWorld(app, options)` — one per app.
 *
 * Wires the engine-free World (runtime/world.mjs) to PlayCanvas:
 *   - measurement: world AABBs and proxy boxes of entity subtrees (scene-measure.mjs)
 *   - pose: an entity group moved in the frame (entity-group-pose.mjs)
 *   - binding facts: transform/pick/presentation ids + hierarchy (hierarchy.mjs)
 *   - input: registration with the shared pointer router (input.mjs) and camera projection
 *   - presentation: snap guides (snap-guides.mjs)
 *
 * Options:
 *   scene                  { scopeId?(), bodies() }  required on first call
 *   hitTest(handle, point) pointer-down hit test; default: the select tool's target at the point
 *                          is one of the handle's pick entities (or a descendant of one)
 *   getCamera()            camera component (default: select tool camera or first camera)
 *   onError(stage, error)
 */
import { createSpatialWorld } from '../runtime/world.mjs';
import { measureBodyProxiesM, measureEntityBoundsM } from './scene-measure.mjs';
import { createEntityGroupPose } from './entity-group-pose.mjs';
import { describePlayCanvasBindingTransforms } from './hierarchy.mjs';
import { resolvePlayCanvasInputRouter } from './input.mjs';
import { createPlayCanvasProjectionAdapterForApp } from './projection.mjs';
import { SnapGuideRenderer } from './snap-guides.mjs';

export const SPATIAL_WORLD_APP_KEY = 'spatialWorld';

const isDescendantOrSelf = (node, ancestor) => {
  for (let current = node; current; current = current.parent) if (current === ancestor) return true;
  return false;
};

const defaultCamera = app => () => (
  app?.selectTool?.cameraEntity?.camera ||
  app?.root?.findComponent?.('camera')?.entity?.camera ||
  null
);

export function createPlayCanvasSpatialWorld(app, { scene, hitTest = null, getCamera = null, onError = null, window: win = undefined } = {}) {
  const cameraOf = getCamera ?? defaultCamera(app);
  const pickEntitiesOf = new Map();
  let guideRenderer = null;
  const guidesByHandle = new Map();

  const renderAllGuides = () => {
    const guides = [...guidesByHandle.values()].flat();
    if (!guides.length && !guideRenderer) return;
    guideRenderer ??= new SnapGuideRenderer(app, { getCamera: cameraOf });
    guideRenderer.update(guides);
  };

  const defaultHitTest = (handle, point) => {
    const target = app?.selectTool?.getSelectionTargetAt?.(point.x, point.y) ?? null;
    if (!target) return false;
    return (pickEntitiesOf.get(handle.id) ?? []).some(entity => isDescendantOrSelf(target, entity));
  };

  const world = createSpatialWorld({
    scene,
    onError,
    measure: {
      // A body may name a narrower `measureEntity` for its bounds (e.g. one mesh of an assembly)
      // and supply pre-normalized `primitives` for its proxies.
      bounds: body => {
        const entity = body.measureEntity ?? body.entity;
        return entity ? measureEntityBoundsM(entity, body.meta?.measure ?? {}) : body.box ?? null;
      },
      proxies: (body, profile) => measureBodyProxiesM(body.entity, profile, { primitives: body.primitives ?? null })
    },
    engine: {
      createPoseDriver: ({ frame, resolveEntities }) => createEntityGroupPose({ frame, resolveTargets: resolveEntities }),
      describeBinding: ({ ctx, instanceId, entities, pickEntities }) => {
        pickEntitiesOf.set(instanceId, pickEntities);
        return describePlayCanvasBindingTransforms({
          transformTargets: entities,
          spatialDependencyTransforms: [],
          pickTargets: pickEntities,
          presentationTargets: entities,
          root: app?.root ?? null
        });
      },
      attach(handle) {
        const router = resolvePlayCanvasInputRouter(app, win === undefined ? {} : { window: win });
        const registration = router.register({
          instanceId: handle.id,
          instance: handle.instance,
          projection: createPlayCanvasProjectionAdapterForApp(app, { getCamera: cameraOf }),
          hitTest: point => Boolean((hitTest ?? defaultHitTest)(handle, point)),
          isEligible: ({ phase }) => (handle.canDrag ? Boolean(handle.canDrag({ phase, handle })) : true),
          onError: (stage, error) => handle._emit('error', { stage: `input:${stage}`, error })
        });
        return () => {
          registration.unregister();
          pickEntitiesOf.delete(handle.id);
          guidesByHandle.delete(handle.id);
        };
      },
      renderGuides(handle, guides) {
        if (guides.length) guidesByHandle.set(handle.id, guides);
        else guidesByHandle.delete(handle.id);
        renderAllGuides();
      }
    }
  });

  const destroy = world.destroy;
  return Object.assign(world, {
    app,
    async destroy() {
      await destroy();
      guideRenderer?.destroy();
      guideRenderer = null;
      if (app && app[SPATIAL_WORLD_APP_KEY] === world) delete app[SPATIAL_WORLD_APP_KEY];
    }
  });
}

/** The app's world (created on first call with `options.scene`). */
export function getSpatialWorld(app, options = {}) {
  const existing = app?.[SPATIAL_WORLD_APP_KEY];
  if (existing) return existing;
  if (!options.scene) throw new TypeError('getSpatialWorld(app, { scene }) requires a scene on first call');
  const world = createPlayCanvasSpatialWorld(app, options);
  if (app) app[SPATIAL_WORLD_APP_KEY] = world;
  return world;
}
