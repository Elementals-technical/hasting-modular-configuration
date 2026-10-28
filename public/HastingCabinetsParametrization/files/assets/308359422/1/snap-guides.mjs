/**
 * Snap guide renderer: a transient, non-interactive SVG layer over the PlayCanvas canvas.
 * Guides are world-space segments/points (runtime/guides.mjs); the renderer re-projects them
 * with the camera every frame while they are shown.
 */
const SVG_NS = 'http://www.w3.org/2000/svg';
const finiteXY = point => Number.isFinite(point?.x) && Number.isFinite(point?.y);

/** CameraComponent projection is in CSS pixels. Null when the point is behind the camera. */
export const projectWorldToScreen = (camera, point, scratch) => {
  if (typeof camera?.worldToScreen !== 'function') return null;
  const world = scratch?.world ?? { x: 0, y: 0, z: 0 };
  if (typeof world.set === 'function') world.set(point.x, point.y, point.z);
  else Object.assign(world, point);
  try {
    if (camera.viewMatrix?.transformPoint && scratch?.view) {
      camera.viewMatrix.transformPoint(world, scratch.view);
      if (!Number.isFinite(scratch.view.z) || scratch.view.z >= 0) return null;
    }
    const screen = camera.worldToScreen(world, scratch?.screen);
    const value = scratch?.screen ?? screen;
    return finiteXY(value) ? { x: value.x, y: value.y } : null;
  } catch {
    return null;
  }
};

export class SnapGuideRenderer {
  /**
   * @param {object} app PlayCanvas app (listens to 'update').
   * @param {object} options
   * @param {() => object} options.getCamera current CameraComponent
   * @param {object} [options.scratch] reusable pc.Vec3 { world, view, screen }
   * @param {string} [options.color]
   */
  constructor(app, { getCamera, scratch = null, color = '#3f9dcc' } = {}) {
    this._app = app || null;
    this._getCamera = getCamera || (() => null);
    this._scratch = scratch;
    this._color = color;
    this._guides = [];
    this._layer = null;
    this._destroyed = false;
    this._app?.on?.('update', this._render, this);
  }

  update(guides = []) {
    if (this._destroyed) return;
    this._guides = guides;
    if (!guides.length) this.clear();
    else this._render();
  }

  clear() {
    this._guides = [];
    if (this._layer) {
      this._layer.style.display = 'none';
      this._layer.replaceChildren();
    }
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    this.clear();
    this._app?.off?.('update', this._render, this);
    this._layer?.remove();
    this._layer = null;
    this._app = null;
  }

  _render() {
    if (this._destroyed || !this._guides.length) return;
    const rect = this._app?.graphicsDevice?.canvas?.getBoundingClientRect?.();
    if (!rect || !(rect.width > 0) || !(rect.height > 0) || typeof document === 'undefined' || !document.body) {
      if (this._layer) this._layer.style.display = 'none';
      return;
    }
    if (!this._layer) {
      this._layer = document.createElementNS(SVG_NS, 'svg');
      this._layer.setAttribute('aria-hidden', 'true');
      Object.assign(this._layer.style, { position: 'fixed', pointerEvents: 'none', overflow: 'hidden', zIndex: '1000' });
      document.body.appendChild(this._layer);
    }
    Object.assign(this._layer.style, {
      display: 'block', left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`
    });
    this._layer.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
    const camera = this._getCamera();
    const children = [];
    for (const guide of this._guides) {
      const start = projectWorldToScreen(camera, guide.startM, this._scratch);
      const end = projectWorldToScreen(camera, guide.endM, this._scratch);
      if (!start || !end) continue;
      const isPoint = guide.kind === 'point' || Math.hypot(end.x - start.x, end.y - start.y) < 1;
      const node = document.createElementNS(SVG_NS, isPoint ? 'circle' : 'line');
      const attrs = isPoint
        ? { cx: start.x, cy: start.y, r: 3, fill: this._color }
        : { x1: start.x, y1: start.y, x2: end.x, y2: end.y, 'stroke-dasharray': '4 3' };
      for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
      node.setAttribute('stroke', this._color);
      node.setAttribute('stroke-width', '1.5');
      children.push(node);
    }
    this._layer.replaceChildren(...children);
    if (!children.length) this._layer.style.display = 'none';
  }
}
