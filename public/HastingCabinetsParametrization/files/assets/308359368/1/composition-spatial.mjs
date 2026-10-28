/**
 * The composition's spatial world: one `spatial-manipulation` World per app whose scene is the
 * active composition, shared by every manipulable in it (countertop, modules …).
 *
 * Products carry their offset from the standard layout position as `SpatialOffsetM: { x, y }` (m)
 * on their snapshot (modules and the countertop alike).
 *
 * Also owns the composition-wide re-measure policy: while an aggregation reshapes the
 * composition (`beginSettle` … `endSettle`) invalidations are held and replayed once, after the
 * participants' geometry barriers (e.g. countertop booleans/length) have settled.
 */
import { getSpatialWorld } from '../../spatial-manipulation/playcanvas/index.mjs';
import { createCompositionScene } from './composition-scene.mjs';

export const SPATIAL_OFFSET_KEY = 'SpatialOffsetM';
export const COMPOSITION_SPATIAL_ERROR_CODE = Object.freeze({
  DESTROYED: 'COMPOSITION_SPATIAL_DESTROYED'
});

const finite = value => typeof value === 'number' && Number.isFinite(value);

/** `SpatialOffsetM` of a product snapshot ({ x: 0, y: 0 } when unset). */
export const readSpatialOffsetM = snapshot => {
  const value = typeof snapshot?.get === 'function' ? snapshot.get(SPATIAL_OFFSET_KEY) : snapshot?.[SPATIAL_OFFSET_KEY];
  return value && finite(value.x) && finite(value.y) ? { x: value.x, y: value.y } : { x: 0, y: 0 };
};

export class CompositionSpatial {
  /**
   * @param {object} options
   * @param {object} options.app
   * @param {() => object|null} options.getComposition the active composition
   * @param {object} [options.registry] ProductRegistry_V2 instance (types, AABB ignore nodes)
   * @param {(error: Error) => void} [options.onError]
   */
  constructor({ app, getComposition, registry = null, onError = null }) {
    this._app = app || null;
    this._getComposition = getComposition;
    this._registry = registry;
    this._onError = onError ?? (error => console.error('[CompositionSpatial]', error));
    this._participants = new Set();
    this._settling = false;
    this._dirty = false;
    this._destroyed = false;
    this._destroyPromise = null;
    this._world = null;
    this._ownsWorld = false;
  }

  /** The app's spatial world (created on first use). */
  get world() {
    if (this._destroyed || this._destroyPromise) {
      throw Object.assign(new Error('Composition spatial world has been destroyed'), { code: COMPOSITION_SPATIAL_ERROR_CODE.DESTROYED });
    }
    if (this._world) return this._world;
    const existingWorld = this._app?.spatialWorld ?? null;
    const world = getSpatialWorld(this._app, {
      scene: createCompositionScene({
        app: this._app,
        getComposition: () => this._getComposition?.() ?? null,
        registry: this._registry
      }),
      onError: (stage, error) => this._onError(Object.assign(error ?? {}, { stage }))
    });
    this._world = world;
    this._ownsWorld = !existingWorld && this._app?.spatialWorld === world;
    return world;
  }

  // --- participants: geometry barriers around a settled re-measure ---------------------------

  /**
   * @param {object} participant
   * @param {() => Promise} [participant.beforeRemeasure] awaited before a settled re-measure
   * @param {() => Promise} [participant.afterRemeasure]  awaited after every re-measure
   * @returns {() => void} remove
   */
  addParticipant(participant) {
    this._participants.add(participant);
    return () => this._participants.delete(participant);
  }

  // --- re-measure policy ---------------------------------------------------------------------

  get settling() {
    return this._settling;
  }

  /** The composition changed geometry: re-measure (held while an aggregation settles). */
  invalidate(reason = 'composition-geometry-changing') {
    if (this._destroyed) return null;
    if (this._settling) {
      this._dirty = true;
      return null;
    }
    return this._remeasure(reason);
  }

  beginSettle() {
    if (this._destroyed) return null;
    this._settling = true;
    this._dirty = true;
    return null;
  }

  endSettle() {
    if (!this._settling) return Promise.resolve(null);
    this._settling = false;
    if (!this._dirty) return Promise.resolve(null);
    return this._each('beforeRemeasure').then(() => this._remeasure('composition-settled'));
  }

  abortSettle() {
    this._settling = false;
  }

  requestRefresh(reason = 'composition-refresh') {
    if (this._settling) {
      this._dirty = true;
      return Promise.resolve(null);
    }
    return this._remeasure(reason);
  }

  _each(hook) {
    return Promise.all([...this._participants].map(participant => participant[hook]?.())).catch(() => null);
  }

  _remeasure(reason) {
    this._dirty = false;
    if (this._destroyed || !this._app?.spatialWorld) return Promise.resolve(null);
    return this.world.invalidate(reason).then(() => this._each('afterRemeasure')).catch(error => {
      this._onError(error);
      return null;
    });
  }

  destroy() {
    if (this._destroyPromise) return this._destroyPromise;
    this._destroyed = true;
    this._settling = false;
    this._dirty = false;
    this._participants.clear();
    const world = this._world;
    const ownsWorld = this._ownsWorld;
    this._world = null;
    this._ownsWorld = false;
    this._destroyPromise = (async () => {
      if (ownsWorld) await world?.destroy?.();
    })();
    return this._destroyPromise;
  }
}
