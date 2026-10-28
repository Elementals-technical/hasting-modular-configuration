/**
 * Collision outline — the same for every manipulable in the composition (modules, countertop):
 * while an object's observation is `colliding`, the object and every body it overlaps get the red
 * (`invalid`) outline; the contribution is released as soon as the verdict is anything else, when
 * the object goes away and on destroy. Plain selection keeps the SelectTool's own style.
 *
 * One owner per object (`owner`), through the SelectTool's semantic-state seam, so several
 * objects can mark the same body and release only what they marked. Re-applied after the
 * outline controller is cleared or the SelectTool (re)initialises.
 */
const INVALID = 'invalid';

/** Object ids a collision observation overlaps (empty unless `colliding`). */
export const collidingObjectIds = collision => (collision?.status === 'colliding'
  ? [...new Set((collision.hits ?? []).map(hit => hit?.target?.objectId).filter(Boolean))]
  : []);

export class CollisionOutline {
  /**
   * @param {object} options
   * @param {object} options.app
   * @param {string} options.owner                       semantic-state owner key
   * @param {(id: string) => object|null} [options.resolveEntity] body id → entity
   */
  constructor({ app, owner, resolveEntity = null }) {
    this._app = app || null;
    this._owner = owner;
    this._resolveEntity = resolveEntity ?? (id => this._app?.root?.findByName?.(id) ?? null);
    this._entity = null;
    this._collidesWith = [];
    this._marked = new Set();
    this._onReset = () => {
      this._marked = new Set(); // the controller dropped every contribution
      this._apply();
    };
    this._app?.on?.('selection:outline-cleared', this._onReset, this);
    this._app?.on?.('select-tool:ready', this._onReset, this);
  }

  /**
   * @param {object|null} entity   the object's entity
   * @param {{ status: string, collidesWith?: string[] }|null} collision
   */
  update(entity, collision) {
    this._entity = entity || null;
    this._collidesWith = collision?.status === 'colliding' ? [...(collision.collidesWith ?? [])] : null;
    this._apply();
  }

  clear() {
    this.update(null, null);
  }

  destroy() {
    this.clear();
    this._app?.off?.('selection:outline-cleared', this._onReset, this);
    this._app?.off?.('select-tool:ready', this._onReset, this);
    this._app = null;
  }

  _apply() {
    const selectTool = this._app?.selectTool;
    if (!selectTool?.setEntitySemanticState) return;
    const next = new Set(this._entity && this._collidesWith
      ? [this._entity, ...this._collidesWith.map(id => this._resolveEntity(id)).filter(Boolean)]
      : []);
    for (const entity of this._marked) {
      if (!next.has(entity)) selectTool.setEntitySemanticState(entity, { owner: this._owner, state: null });
    }
    for (const entity of next) selectTool.setEntitySemanticState(entity, { owner: this._owner, state: INVALID });
    this._marked = next;
  }
}
