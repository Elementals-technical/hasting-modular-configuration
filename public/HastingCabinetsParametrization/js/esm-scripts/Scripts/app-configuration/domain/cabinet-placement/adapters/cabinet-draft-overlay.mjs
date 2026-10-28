import { Vec3 } from '../../../../../../playcanvas-stable.min.mjs';
import { relativeBox, boxAt } from '../draft-collision.mjs';
import { projectDraftOverlay } from '../draft-overlay-geometry.mjs';
import { measureEntityBoundsM } from '../../spatial-manipulation/playcanvas/scene-measure.mjs';
import { createCabinetDraftTint, createPlayCanvasTintGraphics, parseTintColor } from './cabinet-draft-tint.mjs';
import { createDraftOverlayPlaceholders } from './cabinet-draft-overlay-placeholders.mjs';
import { normalizeDraftOverlayStyle, patchDraftOverlayStyle, assertOverlaySubscription, createSemanticOutline, overlayViewportRectOf, overlayCameraOf } from './draft-overlay-presentation.mjs';
export { DEFAULT_DRAFT_OVERLAY_STYLE } from './draft-overlay-presentation.mjs';

/**
 * Draft overlay — the presentation of an open placement draft (Add or Move):
 * 1. 3D tint of the draft: green while it is clear, red while it overlaps another cabinet
 *    (the runtime's `collision` / `canApply`; see domain/cabinet-placement/draft-collision.mjs);
 * 2. outline through the SelectTool semantic seam: the draft `editing` (green) or `invalid` (red),
 *    and every cabinet it overlaps `invalid`;
 * 3. screen anchors for the UI's own icons, published as `placementOverlay` frames each time
 *    they change (camera, drag, status); temporary DOM placeholders until the UI takes over.
 *
 * Public API (window.ConfiguratorAPI.placementOverlay):
 *   getState() -> frame | null
 *   on('change', callback(frame | null), { emitCurrent? }) -> unsubscribe
 *   setPlaceholdersEnabled(boolean)
 *   getStyle() / setStyle({ colors: { clear, colliding, unknown }, opacity, outline })
 * Frame: { sessionId, kind, lifecycle, status: 'clear'|'colliding'|'unknown', collidesWith,
 *   canApply, canCancel, dragging, visible, viewport:{width,height}, hull, bounds, points }
 *   points: center, frontCenter, topLeft, topRight, bottomLeft, bottomRight, topCenter, bottomCenter
 *   (CSS px of the configurator viewport — the iframe's own coordinates).
 */ const DRAFT_OVERLAY_OWNER = 'cabinet-draft-overlay';
const ACTIVE = new Set([
    'preview',
    'applying'
]);
const clone = (value)=>value == null ? value : JSON.parse(JSON.stringify(value));
const normalizeStyle = normalizeDraftOverlayStyle;
function createCabinetDraftOverlay({ app, api, preview, uuid = ()=>crypto.randomUUID(), graphics = null, measure = measureEntityBoundsM, getCamera = null, document: doc = globalThis.document ?? null, placeholders = true, style: initialStyle = {}, onError = ()=>{} } = {}) {
    if (!app || typeof api?.cabinetPlacement?.on !== 'function' || ![
        'getActiveHandles',
        'getPickTarget'
    ].every((name)=>typeof preview?.[name] === 'function')) {
        throw new TypeError('Draft overlay requires app, base cabinetPlacement API and preview ports');
    }
    let style = normalizeStyle(initialStyle), placeholdersEnabled = placeholders !== false;
    let started = false, closed = false, unsubscribe = null, identity = null, draft = null;
    let entity = null, relative = null, frame = null, frameKey = 'null', view = null, tint = null;
    let tintKey = null;
    const released = new WeakSet(), listeners = new Set();
    const scratch = new Vec3(), projected = new Vec3();
    const report = (stage, error)=>{
        try {
            onError(stage, error);
        } catch  {}
    };
    // Red = the placement rules say so (validation), not only the AABB collision; the frame keeps the
    // documented 'clear' | 'colliding' | 'unknown' vocabulary for the UI.
    const statusOf = ()=>[
            'invalid',
            'unsupported'
        ].includes(draft?.validation?.status) ? 'colliding' : draft?.collision?.status ?? 'unknown';
    const highlightIds = ()=>{
        const own = draft?.candidate?.productId ?? null, ids = new Set(draft?.collision?.collidesWith ?? []);
        for (const r of draft?.validation?.reasons ?? [])for (const id of r.affectedProductIds ?? [])if (id !== own) ids.add(id);
        return [
            ...ids
        ];
    };
    const colorOf = (status)=>style.colors[status] ?? style.colors.clear;
    const cameraOf = ()=>overlayCameraOf(app, getCamera);
    const outline = createSemanticOutline({
        app,
        owner: DRAFT_OVERLAY_OWNER,
        report
    });
    function applyOutline() {
        const next = new Map();
        if (entity && draft && style.outline) {
            const colliding = statusOf() === 'colliding';
            next.set(entity, colliding ? 'invalid' : 'editing');
            if (colliding) for (const id of highlightIds()){
                const neighbour = app.root?.findByName?.(id);
                if (neighbour && neighbour !== entity) next.set(neighbour, 'invalid');
            }
        }
        outline.apply(next);
    }
    // Draft events arrive per drag sample: touch the material only when the colour really changes.
    const applyTint = ()=>{
        const color = colorOf(statusOf()), key = `${color}|${style.opacity}`;
        if (!tint?.entity || key === tintKey) return;
        try {
            tint.set({
                rgb: parseTintColor(color),
                opacity: style.opacity
            });
            tintKey = key;
        } catch (error) {
            report('tint', error);
        }
    };
    function unbind() {
        tintKey = null;
        try {
            tint?.detach();
        } catch (error) {
            report('tint', error);
        }
        entity = null;
        relative = null;
        applyOutline();
    }
    function bind(target) {
        if (target === entity) return;
        unbind();
        if (!target || released.has(target)) return;
        try {
            const p = target.getPosition();
            const box = measure(target);
            relative = box ? relativeBox(box, {
                x: p.x,
                y: p.y,
                z: p.z
            }) : null;
        } catch (error) {
            relative = null;
            report('measure', error);
        }
        entity = target;
        try {
            const color = colorOf(statusOf());
            tint?.attach(target, {
                rgb: parseTintColor(color),
                opacity: style.opacity
            });
            tintKey = `${color}|${style.opacity}`;
        } catch (error) {
            report('tint', error);
        }
    }
    function computeFrame() {
        if (!draft || !entity) return null;
        const base = {
            sessionId: draft.sessionId,
            kind: draft.kind ?? null,
            lifecycle: draft.lifecycle,
            status: statusOf(),
            collidesWith: highlightIds(),
            canApply: draft.canApply === true,
            canCancel: draft.canCancel === true,
            dragging: false,
            visible: false,
            viewport: null,
            hull: [],
            bounds: null,
            points: null
        };
        const snapshot = app.spatialManipulationInput?.getSnapshot?.();
        base.dragging = snapshot?.phase === 'active' && String(snapshot.instanceId ?? '').startsWith('cabinet-draft:');
        const camera = cameraOf();
        if (!relative || typeof camera?.worldToScreen !== 'function') return base;
        const p = entity.getPosition();
        const box = boxAt(relative, {
            x: p.x,
            y: p.y,
            z: p.z
        });
        const rect = overlayViewportRectOf(app);
        const project = (pointM)=>{
            scratch.set(pointM.x, pointM.y, pointM.z);
            camera.worldToScreen(scratch, projected);
            return {
                x: projected.x,
                y: projected.y,
                z: projected.z
            };
        };
        const cameraPosition = camera.entity?.getPosition?.();
        const geometry = projectDraftOverlay({
            box,
            project,
            offset: {
                x: rect.left ?? 0,
                y: rect.top ?? 0
            },
            cameraPositionM: cameraPosition ? {
                x: cameraPosition.x,
                y: cameraPosition.y,
                z: cameraPosition.z
            } : null
        });
        return {
            ...base,
            ...clone(geometry),
            viewport: {
                width: rect.width ?? 0,
                height: rect.height ?? 0
            }
        };
    }
    function publish(next) {
        const key = JSON.stringify(next);
        if (key === frameKey) return;
        frameKey = key;
        frame = next;
        if (placeholdersEnabled) {
            try {
                view ?? (view = doc ? createDraftOverlayPlaceholders({
                    document: doc,
                    onApply: applyDraft,
                    onCancel: cancelDraft
                }) : null);
                view?.render(frame, {
                    color: colorOf(frame?.status)
                });
            } catch (error) {
                report('placeholders', error);
            }
        }
        for (const callback of [
            ...listeners
        ]){
            try {
                callback(clone(frame));
            } catch  {}
        }
    }
    const refresh = ()=>{
        if (closed || !draft && !frame) return;
        try {
            publish(computeFrame());
        } catch (error) {
            report('frame', error);
        }
    };
    function accept(envelope) {
        if (closed || !envelope) return;
        identity = {
            apiInstanceId: envelope.apiInstanceId,
            compositionId: envelope.compositionId
        };
        const next = envelope.data;
        if (!next || !ACTIVE.has(next.lifecycle)) {
            draft = null;
            unbind();
            refresh();
            return;
        }
        draft = next;
        const handles = preview.getActiveHandles();
        bind(handles.length === 1 ? preview.getPickTarget(handles[0]) : null);
        applyTint();
        applyOutline();
        refresh();
    }
    async function applyDraft() {
        const current = draft, scope = identity;
        if (!current || !scope) return;
        try {
            const settled = await api.cabinetPlacement.settleInput(scope, current.sessionId);
            if (!settled?.ok) throw Object.assign(new Error(settled?.error?.code ?? 'SETTLE_FAILED'), {
                result: settled
            });
            if (!settled.data.canApply) return;
            const result = await api.cabinetPlacement.apply({
                ...scope,
                sessionId: settled.data.sessionId,
                requestId: uuid(),
                expectedCompositionRevision: settled.data.baseCompositionRevision,
                expectedCandidateRevision: settled.data.candidateRevision
            });
            if (!result?.ok) throw Object.assign(new Error(result?.error?.code ?? 'APPLY_FAILED'), {
                result
            });
        } catch (error) {
            report('apply', error);
        }
    }
    async function cancelDraft() {
        const current = draft, scope = identity;
        if (!current || !scope) return;
        try {
            const result = await api.cabinetPlacement.cancel(scope, current.sessionId);
            if (!result?.ok) throw Object.assign(new Error(result?.error?.code ?? 'CANCEL_FAILED'), {
                result
            });
        } catch (error) {
            report('cancel', error);
        }
    }
    const onOutlineReset = ()=>{
        outline.reset();
        applyOutline();
    };
    /** Release everything drawn on the current draft entity; it is never drawn on again. */ function release() {
        if (entity) released.add(entity);
        draft = null;
        unbind();
        refresh();
    }
    const publicApi = Object.freeze({
        getState: ()=>clone(frame),
        on (event, callback, options = {}) {
            assertOverlaySubscription(event, callback, options);
            listeners.add(callback);
            if (options?.emitCurrent) {
                try {
                    callback(clone(frame));
                } catch  {}
            }
            return ()=>{
                listeners.delete(callback);
            };
        },
        setPlaceholdersEnabled (enabled) {
            if (typeof enabled !== 'boolean') throw new TypeError('setPlaceholdersEnabled expects a boolean');
            placeholdersEnabled = enabled;
            try {
                if (!enabled) view?.render(null);
                else if (frame) {
                    view ?? (view = doc ? createDraftOverlayPlaceholders({
                        document: doc,
                        onApply: applyDraft,
                        onCancel: cancelDraft
                    }) : null);
                    view?.render(frame, {
                        color: colorOf(frame.status)
                    });
                }
            } catch (error) {
                report('placeholders', error);
            }
        },
        getStyle: ()=>clone(style),
        setStyle (patch = {}) {
            style = patchDraftOverlayStyle(style, patch);
            applyTint();
            applyOutline();
            if (placeholdersEnabled && frame) view?.render(frame, {
                color: colorOf(frame.status)
            });
        }
    });
    return Object.freeze({
        api: publicApi,
        start () {
            if (closed) throw new Error('Draft overlay destroyed');
            if (started) return;
            tint ?? (tint = createCabinetDraftTint({
                graphics: graphics ?? createPlayCanvasTintGraphics(app)
            }));
            // May throw while the facade is not ready: the runtime retries on its next activation.
            unsubscribe = api.cabinetPlacement.on('change', accept, {
                emitCurrent: true
            });
            started = true;
            app.on?.('update', refresh);
            app.on?.('selection:outline-cleared', onOutlineReset);
            app.on?.('select-tool:ready', onOutlineReset);
        },
        release,
        refresh,
        getSnapshot: ()=>Object.freeze({
                started,
                closed,
                bound: !!entity,
                sessionId: draft?.sessionId ?? null,
                tintInstances: tint?.instanceCount ?? 0,
                outlined: outline.size
            }),
        async destroy () {
            if (closed) return;
            release();
            closed = true;
            unsubscribe?.();
            unsubscribe = null;
            app.off?.('update', refresh);
            app.off?.('selection:outline-cleared', onOutlineReset);
            app.off?.('select-tool:ready', onOutlineReset);
            view?.destroy();
            view = null;
            listeners.clear();
        }
    });
}

export { DRAFT_OVERLAY_OWNER, createCabinetDraftOverlay };
