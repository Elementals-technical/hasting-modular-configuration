import { parseTintColor } from './cabinet-draft-tint.mjs';

/**
 * Pieces shared by the drag overlays (cabinet drafts: `placementOverlay`; countertop:
 * `countertopOverlay`): style validation, the SelectTool semantic outline of one owner, the
 * viewport rectangle / camera lookup and the `on('change')` subscription contract.
 */
export const DEFAULT_DRAFT_OVERLAY_STYLE = Object.freeze({
    colors: Object.freeze({ clear: '#39D080', colliding: '#E5484D', unknown: '#39D080' }),
    opacity: 0.35,
    outline: true
});

export function normalizeDraftOverlayStyle(value) {
    const colors = { ...DEFAULT_DRAFT_OVERLAY_STYLE.colors, ...(value?.colors ?? {}) };
    for (const color of Object.values(colors)) parseTintColor(color);
    const opacity = value?.opacity ?? DEFAULT_DRAFT_OVERLAY_STYLE.opacity;
    if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) throw new TypeError('Overlay opacity must be within 0..1');
    const outline = value?.outline ?? DEFAULT_DRAFT_OVERLAY_STYLE.outline;
    if (typeof outline !== 'boolean') throw new TypeError('Overlay outline must be a boolean');
    return Object.freeze({ colors: Object.freeze(colors), opacity, outline });
}

/** Merge a setStyle() patch onto the current style (colours merge key by key). */
export const patchDraftOverlayStyle = (style, patch = {}) =>
    normalizeDraftOverlayStyle({ ...style, ...patch, colors: { ...style.colors, ...(patch?.colors ?? {}) } });

/**
 * Semantic outline contributions of one owner: `apply(Map<entity, state>)` releases what left
 * the map first, then sets new / changed states; `reset()` forgets what was marked (the
 * SelectTool cleared its outline) so the next apply re-sends everything.
 */
export function createSemanticOutline({ app, owner, report = () => {} }) {
    let marked = new Map();
    return Object.freeze({
        get size() { return marked.size; },
        apply(next) {
            const tool = app.selectTool;
            if (typeof tool?.setEntitySemanticState !== 'function') return;
            for (const target of marked.keys()) {
                if (next.has(target)) continue; // a changed state replaces this owner's contribution below
                try { tool.setEntitySemanticState(target, { owner, state: null }); }
                catch (error) { report('outline', error); }
            }
            for (const [target, state] of next) {
                if (marked.get(target) === state) continue;
                try { tool.setEntitySemanticState(target, { owner, state }); }
                catch (error) { report('outline', error); }
            }
            marked = next;
        },
        reset() { marked = new Map(); }
    });
}

export const overlayCameraOf = (app, getCamera = null) => getCamera?.() ?? app.selectTool?.cameraEntity?.camera ??
    app.root?.findComponent?.('camera')?.entity?.camera ?? null;

export function overlayViewportRectOf(app) {
    const canvas = app.graphicsDevice?.canvas;
    return canvas?.getBoundingClientRect?.() ?? { left: 0, top: 0,
        width: app.graphicsDevice?.width ?? 0, height: app.graphicsDevice?.height ?? 0 };
}

export function assertOverlaySubscription(event, callback, options) {
    if (event !== 'change' || typeof callback !== 'function' ||
        (options != null && (typeof options !== 'object' || Object.keys(options).some(key => key !== 'emitCurrent')))) {
        throw Object.assign(new Error('INVALID_SUBSCRIPTION'), { code: 'INVALID_SUBSCRIPTION' });
    }
}
