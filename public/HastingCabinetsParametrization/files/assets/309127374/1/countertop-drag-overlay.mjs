import * as pc from 'playcanvas';
import { boxAt, detectDraftCollision, relativeBox } from '../../cabinet-placement/draft-collision.mjs';
import { createScreenProjector, frontFaceZ, projectDraftOverlay } from '../../cabinet-placement/draft-overlay-geometry.mjs';
import { measureEntityBoundsM } from '../../spatial-manipulation/playcanvas/scene-measure.mjs';
import { collectTintSources, createCabinetDraftTint, createPlayCanvasTintGraphics, parseTintColor } from
    '../../cabinet-placement/adapters/cabinet-draft-tint.mjs';
import { createDraftOverlayPlaceholders } from '../../cabinet-placement/adapters/cabinet-draft-overlay-placeholders.mjs';
import { assertOverlaySubscription, createSemanticOutline, normalizeDraftOverlayStyle, overlayCameraOf,
    overlayViewportRectOf, patchDraftOverlayStyle } from '../../cabinet-placement/adapters/draft-overlay-presentation.mjs';
import { COUNTERTOP_OVERLAY_REASON, evaluateCountertopOverlay } from '../countertop-length-limits.mjs';
import { countertopTrapViolations } from '../trap/trap-keepout.mjs';
import { countertopCoverageViolations } from '../countertop-resize-bounds.mjs';
import { classifyCompositionProducts } from '../../cabinet-placement/modular-collections.mjs';
import { anchoredLengthM, collectCountertopEdgeTargets, lineXAtRay, snapCountertopLengthM } from '../countertop-resize-snap.mjs';

/**
 * Countertop drag overlay (window.ConfiguratorAPI.countertopOverlay) — the cabinet draft overlay
 * applied to the countertop while the UI is in Drag & Drop mode:
 * - setActive(true|false): the UI switches the visuals on (Drag & Drop) / off (Apply / Cancel);
 *   while active the countertop dimension lines are suppressed (the chips show length / depth);
 * - 3D tint of the countertop mesh (green / red) + SelectTool outline (`editing` / `invalid`, and
 *   every object it collides with `invalid`);
 * - screen anchors published as frames (null while inactive or without a countertop).
 * Red = collision observation colliding, a basin cut-out would leave the top, the length is
 * outside the limits (countertop-length-limits.mjs), or a cabinet is in a sink trap keep-out zone
 * (trap/trap-keepout.mjs; the same predicate is the adapter's drag guard — `dragGuard` below, bound
 * by the countertop plugin so a release there snaps back whether or not the visuals are on). The
 * keep-out is read from the active modular collection's pack (`geometry.trap`): no pack = no rule.
 * A moved (not attached) top is also red when a basin cut-out is < 10 cm from an end or the sink base it
 * rests on is not covered (countertop-resize-bounds.mjs, inputs from `adapter.getCoverageInputs()`; also in `dragGuard`).
 * - previewLength({ side, lengthM } | null): ghost frame of a one-end resize (scene untouched);
 * - lengthAtPointer(side, point, { snap }): pointer (frame px) -> anchored, snapped length.
 */
export const COUNTERTOP_OVERLAY_OWNER = 'countertop-drag-overlay';
/** Overlap (m, every axis) that counts as a box collision: a top resting on a cabinet only touches it. */
export const COUNTERTOP_BOX_COLLISION_TOLERANCE_M = 1e-3;
const isSidePanelType = type => /SidePanel_(Left|Right)$/.test(String(type || ''));
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
const finite = value => typeof value === 'number' && Number.isFinite(value);

/** Countertop-specific anchors on top of the draft overlay geometry (all CSS px, null when hidden). */
export function projectCountertopOverlay({ box, project, cameraPositionM = null, offset = { x: 0, y: 0 } } = {}) {
    const base = projectDraftOverlay({ box, project, cameraPositionM, offset });
    if (!base.visible) return { ...base, lengthAxisPx: null };
    const toScreen = createScreenProjector({ project, offset });
    const { minM, maxM } = box;
    const c = { x: (minM.x + maxM.x) / 2, y: (minM.y + maxM.y) / 2, z: (minM.z + maxM.z) / 2 };
    const frontZ = frontFaceZ(box, cameraPositionM), backZ = frontZ === maxM.z ? minM.z : maxM.z;
    const extra = {
        leftEnd: toScreen({ x: minM.x, y: c.y, z: frontZ }),
        rightEnd: toScreen({ x: maxM.x, y: c.y, z: frontZ }),
        lengthLabel: toScreen({ x: c.x, y: maxM.y, z: backZ }),
        depthLabel: toScreen({ x: maxM.x, y: maxM.y, z: c.z })
    };
    if (Object.values(extra).some(point => !point)) return { visible: false, hull: [], bounds: null, points: null, lengthAxisPx: null };
    const center = toScreen(c), unit = toScreen({ ...c, x: c.x + 1 });
    const round = value => Math.round(value * 100) / 100;
    const lengthAxisPx = center && unit ? { x: round(unit.x - center.x), y: round(unit.y - center.y) } : null;
    return { ...base, points: { ...base.points, ...extra }, lengthAxisPx };
}

export function createCountertopDragOverlay({ app, getAdapter, graphics = null, measure = measureEntityBoundsM,
    getCamera = null, document: doc = globalThis.document ?? null, placeholders = true, style: initialStyle = {},
    onError = () => {} } = {}) {
    if (!app || typeof getAdapter !== 'function') throw new TypeError('Countertop overlay requires app and getAdapter');
    let style = normalizeDraftOverlayStyle(initialStyle), placeholdersEnabled = placeholders !== false;
    let active = false, closed = false, adapter = null, unsubscribe = null, listening = false;
    let root = null, meshEntity = null, relative = null, meshKey = null, tint = null, tintKey = null;
    let frame = null, frameKey = 'null', view = null, evaluation = null, state = null, preview = null;
    const listeners = new Set();
    const scratch = new pc.Vec3(), projected = new pc.Vec3(), rayNear = new pc.Vec3(), rayFar = new pc.Vec3();
    const report = (stage, error) => { try { onError(stage, error); } catch { /* observation only */ } };
    const outline = createSemanticOutline({ app, owner: COUNTERTOP_OVERLAY_OWNER, report });
    const colorOf = status => style.colors[status] ?? style.colors.clear;
    const statusOf = () => evaluation?.status ?? 'unknown';

    function applyOutline() {
        const next = new Map();
        if (active && root && style.outline) {
            const colliding = statusOf() === 'colliding';
            next.set(root, colliding ? 'invalid' : 'editing');
            if (colliding) for (const id of evaluation?.collidesWith ?? []) {
                const neighbour = app.root?.findByName?.(id);
                if (neighbour && neighbour !== root) next.set(neighbour, 'invalid');
            }
        }
        outline.apply(next);
    }
    const sourcesKey = entity => collectTintSources(entity).map(source => source.mesh);
    function applyTint() {
        if (!active || !meshEntity) { tintKey = null; try { tint?.detach(); } catch (error) { report('tint', error); } return; }
        tint ??= createCabinetDraftTint({ graphics: graphics ?? createPlayCanvasTintGraphics(app) });
        const color = colorOf(statusOf()), key = `${color}|${style.opacity}`;
        const meshes = sourcesKey(meshEntity);
        // The CSG rebuild replaces the mesh: re-attach when the drawn meshes changed.
        const same = tint.entity === meshEntity && meshKey && meshes.length === meshKey.length && meshes.every((m, i) => m === meshKey[i]);
        try {
            if (!same) { tint.detach(); tint.attach(meshEntity, { rgb: parseTintColor(color), opacity: style.opacity }); tintKey = key; meshKey = meshes; relative = null; }
            else if (key !== tintKey) { tint.set({ rgb: parseTintColor(color), opacity: style.opacity }); tintKey = key; }
        } catch (error) { report('tint', error); }
    }
    function readAdapter() {
        const next = getAdapter() ?? null;
        if (next !== adapter) {
            if (active) { suppressDimensions(false, adapter); suppressDimensions(true, next); }
            unsubscribe?.(); unsubscribe = null;
            adapter = next;
            if (adapter && active) { try { unsubscribe = adapter.on('change', sync); } catch (error) { report('subscribe', error); } }
        } else if (adapter && active && !unsubscribe) {
            try { unsubscribe = adapter.on('change', sync); } catch (error) { report('subscribe', error); }
        }
        return adapter;
    }
    function sync() {
        if (closed) return;
        const current = readAdapter();
        state = active && current ? current.getState() : null;
        const ready = state?.readiness === 'ready';
        const nextRoot = ready ? current.countertopRoot ?? null : null;
        const nextMesh = ready ? current.countertopMesh ?? nextRoot : null;
        if (nextRoot !== root || nextMesh !== meshEntity) { relative = null; meshKey = null; }
        root = nextRoot; meshEntity = nextMesh;
        if (!root) state = null;
        if (!state?.dragging) relative = null; // re-measure after a length / geometry change
        const box = state && ensureRelative() ? currentBox() : null;
        evaluation = state ? evaluateCountertopOverlay(withLanding(withCoverage(withTrapKeepOut(withBoxCollision(state, box), box), box))) : null;
        applyTint();
        applyOutline();
        refresh();
    }
    function ensureRelative() {
        if (!relative) {
            try {
                const p = root.getPosition(), box = measure(meshEntity);
                relative = box ? relativeBox(box, { x: p.x, y: p.y, z: p.z }) : null;
            } catch (error) { relative = null; report('measure', error); }
        }
        return relative;
    }
    const currentBox = () => { const p = root.getPosition(); return boxAt(relative, { x: p.x, y: p.y, z: p.z }); };
    /** The measured box with the `side` end moved so its X length is `lengthM` (opposite end fixed). */
    function previewBox(box, { side, lengthM }) {
        const minM = { ...box.minM }, maxM = { ...box.maxM };
        if (side === 'right') maxM.x = minM.x + lengthM; else minM.x = maxM.x - lengthM;
        return { minM, maxM };
    }
    const cameraPositionOf = camera => {
        const position = camera?.entity?.getPosition?.();
        return position && finite(position.z) ? { x: position.x, y: position.y, z: position.z } : null;
    };
    function computeFrame() {
        if (!active || !state || !root) return null;
        const limits = state.lengthLimitsM ?? null;
        const previewed = preview && ensureRelative() ? previewBox(currentBox(), preview) : null;
        const shown = previewed
            ? evaluateCountertopOverlay(withLanding(withCoverage(withTrapKeepOut(withBoxCollision({ ...state, size: { ...(state.size ?? {}), length: preview.lengthM } },
                previewed), previewed), previewed)))
            : evaluation;
        const base = {
            active: true, status: shown.status, reasons: clone(shown.reasons), collidesWith: [...shown.collidesWith],
            attached: state.attached === true, lengthM: preview ? preview.lengthM : state.size?.length ?? null, depthM: state.size?.depth ?? null,
            limits: limits ? { minLengthM: limits.minLengthM, maxLengthM: limits.maxLengthM } : null,
            canApply: shown.status !== 'colliding', dragging: state.dragging === true,
            preview: preview ? { side: preview.side, lengthM: preview.lengthM } : null,
            visible: false, viewport: null, hull: [], bounds: null, points: null, lengthAxisPx: null
        };
        const camera = overlayCameraOf(app, getCamera);
        if (!ensureRelative() || typeof camera?.worldToScreen !== 'function') return base;
        const measured = currentBox();
        const box = preview ? previewBox(measured, preview) : measured;
        const rect = overlayViewportRectOf(app);
        const project = pointM => {
            scratch.set(pointM.x, pointM.y, pointM.z);
            camera.worldToScreen(scratch, projected);
            return { x: projected.x, y: projected.y, z: projected.z };
        };
        const geometry = projectCountertopOverlay({ box, project, offset: { x: rect.left ?? 0, y: rect.top ?? 0 },
            cameraPositionM: cameraPositionOf(camera) });
        return { ...base, ...clone(geometry), viewport: { width: rect.width ?? 0, height: rect.height ?? 0 } };
    }
    const renderPlaceholders = () => {
        if (!placeholdersEnabled) return;
        try {
            if (frame) view ??= doc ? createDraftOverlayPlaceholders({ document: doc, onApply() {}, onCancel() {},
                layerId: 'countertop-drag-overlay-layer' }) : null;
            view?.render(frame, { color: colorOf(frame?.status) });
        } catch (error) { report('placeholders', error); }
    };
    /** Cabinets and side panels of the active composition as `{ id, box, cabinet }` (null = products unreadable). */
    function activeProducts() {
        let products = null;
        try { products = app.compositionManager?.getActiveComposition?.()?.getAllProducts?.() ?? null; } catch (error) { report('structure', error); }
        return products && typeof products === 'object' ? products : null;
    }
    function structureBodies() {
        const products = activeProducts();
        if (!products) return null;
        const entries = products instanceof Map ? [...products.entries()] : Object.entries(products);
        const bodies = [];
        for (const [key, product] of entries) {
            const cabinet = product?.category === 'cabinets';
            if (!cabinet && !isSidePanelType(product?.productType)) continue;
            const id = product.productId ?? key;
            const entity = app.root?.findByName?.(id);
            if (!entity || entity === root) continue;
            let box = null;
            try { box = measure(entity); } catch (error) { report('structure', error); }
            bodies.push({ id, box, cabinet });
        }
        return bodies;
    }
    function cabinetBoxes() {
        return (structureBodies() ?? []).filter(body => body.cabinet && body.box).map(body => body.box);
    }
    /**
     * The spatial collision observation cannot judge every product (ULH cabinets have no verified
     * collision profile: status 'unknown'). Then the top's box is checked against the cabinet /
     * side-panel boxes (sinks excluded by the measure): any overlap beyond 1 mm is a collision.
     */
    function withBoxCollision(input, box) {
        const status = input?.collision?.status;
        if (!input || !box || status === 'colliding' || status === 'clear') return input;
        const bodies = structureBodies();
        if (!bodies) return input;
        const result = detectDraftCollision({ box, neighbours: bodies.map(({ id, box: other }) => ({ id, box: other })),
            toleranceM: COUNTERTOP_BOX_COLLISION_TOLERANCE_M });
        return result.status === 'unknown' ? input : { ...input, collision: { status: result.status, collidesWith: [...result.collidesWith] } };
    }
    /** Placement pack of the collection owning the active composition (null = legacy / mixed / no cabinets). */
    function activePack() {
        try { return classifyCompositionProducts(activeProducts()).collection?.pack ?? null; } catch (error) { report('structure', error); return null; }
    }
    /** Trap keep-out violations of the top at `box` against the cabinets (side panels are not checked). */
    function trapViolationsAt(box, traps) {
        const pack = box && traps?.length ? activePack() : null;
        if (!pack?.geometry?.trap) return [];
        const bodies = (structureBodies() ?? []).filter(body => body.cabinet && body.box);
        return countertopTrapViolations({ traps, ctBox: box, bodies, ...pack.geometry.trap,
            contactM: pack.tolerances?.contactM ?? 0, tolM: COUNTERTOP_BOX_COLLISION_TOLERANCE_M });
    }
    /** Sink landing reasons of the adapter's resting pose (a carried sink lowered over a gap / unfit cabinet). */
    function landingReasonsOf(target) {
        try { return [...(target?.getLandingReasons?.() ?? [])]; } catch (error) { report('landing', error); return []; }
    }
    /** Height reasons of a lowered top (COUNTERTOP_BELOW_COVER: over a cabinet, or below the adjacent cover top). */
    function heightReasonsOf(target) {
        try { return [...(target?.getHeightReasons?.() ?? [])]; } catch (error) { report('height', error); return []; }
    }
    const withLanding = input => input
        ? { ...input, landingReasons: landingReasonsOf(getAdapter()), heightReasons: heightReasonsOf(getAdapter()) } : input;
    const withTrapKeepOut = (input, box) => input && box ? { ...input, trapViolations: trapViolationsAt(box, input.traps) } : input;
    /** Coverage inputs of a moved (not attached) top (null = attached / nothing to cover / unreadable). */
    function coverageInputsOf(target, input) {
        if (input?.attached !== false || typeof target?.getCoverageInputs !== 'function') return null;
        try {
            const inputs = target.getCoverageInputs();
            return inputs?.cutouts?.length || inputs?.supportBoxes?.length ? inputs : null;
        } catch (error) { report('coverage', error); return null; }
    }
    const coverageViolationsAt = (box, inputs) => inputs
        // 1 mm: the clamp lands exactly on the bound, while this box is the measured (stretched) mesh.
        ? countertopCoverageViolations({ ctBox: { minX: box.minM.x, maxX: box.maxM.x }, ...inputs, tolM: 1e-3 }) : [];
    const withCoverage = (input, box) => input && box
        ? { ...input, coverageViolations: coverageViolationsAt(box, coverageInputsOf(adapter, input)) } : input;
    /** The adapter's drag guard (bound by the plugin, visuals on or off): false while the top's current pose puts
     * a cabinet in a trap zone or breaks the coverage of a moved top, null = undecidable. Without the visuals the
     * top is measured directly. */
    function dragGuard() {
        return dragGuard.evaluate().valid;
    }
    /** The same verdict with its reasons (overlay slugs): `{ valid: boolean|null, reasons, warnings }`; collision only warns. */
    dragGuard.evaluate = function evaluatePose() {
        if (closed) return { valid: null, reasons: [], warnings: [] };
        const current = getAdapter() ?? null, s = current?.getState?.();
        const ready = s?.readiness === 'ready';
        const warnings = ready && s.collision?.status === 'colliding' ? [COUNTERTOP_OVERLAY_REASON.COLLISION] : [];
        const traps = ready ? s.traps ?? [] : [];
        const trapRule = traps.length > 0 && !!activePack()?.geometry?.trap;
        const coverage = ready ? coverageInputsOf(current, s) : null;
        const landing = ready ? landingReasonsOf(current) : [];
        const height = ready ? heightReasonsOf(current) : [];
        const early = () => landing.length || height.length
            ? { valid: false, reasons: [...landing, ...height], warnings } : { valid: null, reasons: [], warnings };
        if (!trapRule && !coverage) return early();
        let box = null;
        if (active && root && current.countertopRoot === root && ensureRelative()) box = currentBox();
        else { try { box = measure(current.countertopMesh ?? current.countertopRoot); } catch (error) { report('measure', error); } }
        if (!box) return early();
        const reasons = evaluateCountertopOverlay({ trapViolations: trapRule ? trapViolationsAt(box, traps) : [],
            coverageViolations: coverageViolationsAt(box, coverage), landingReasons: landing, heightReasons: height }).reasons.map(reason => reason.code);
        return { valid: reasons.length === 0, reasons, warnings };
    };
    function lengthAtPointer(side, point, { snap = true } = {}) {
        if (side !== 'left' && side !== 'right') throw new TypeError("lengthAtPointer: side must be 'left' or 'right'");
        if (!finite(point?.x) || !finite(point?.y)) throw new TypeError('lengthAtPointer: point must be { x, y } in frame px');
        if (typeof snap !== 'boolean') throw new TypeError('lengthAtPointer: snap must be a boolean');
        if (closed || !active || !state || !root || !ensureRelative()) return null;
        const camera = overlayCameraOf(app, getCamera);
        if (typeof camera?.screenToWorld !== 'function') return null;
        const box = currentBox(), rect = overlayViewportRectOf(app);
        const sx = point.x - (rect.left ?? 0), sy = point.y - (rect.top ?? 0);
        camera.screenToWorld(sx, sy, camera.nearClip ?? 0.1, rayNear);
        camera.screenToWorld(sx, sy, camera.farClip ?? 1000, rayFar);
        const xM = lineXAtRay({ rayOrigin: { x: rayNear.x, y: rayNear.y, z: rayNear.z },
            rayDirection: { x: rayFar.x - rayNear.x, y: rayFar.y - rayNear.y, z: rayFar.z - rayNear.z },
            yM: (box.minM.y + box.maxM.y) / 2, zM: frontFaceZ(box, cameraPositionOf(camera)) });
        if (!finite(xM)) return null;
        const anchorXM = side === 'right' ? box.minM.x : box.maxM.x;
        const lengthLimits = state.resizeBoundsM?.[side] ?? state.lengthLimitsM ?? null;
        const result = snapCountertopLengthM({ side, rawLengthM: anchoredLengthM(side, xM, anchorXM), anchorXM, snap,
            edgeTargets: snap ? collectCountertopEdgeTargets(cabinetBoxes()) : [], limits: lengthLimits });
        return { ...result, limits: lengthLimits ? { minLengthM: lengthLimits.minLengthM, maxLengthM: lengthLimits.maxLengthM } : null };
    }
    function publish(next) {
        const key = JSON.stringify(next);
        if (key === frameKey) return;
        frameKey = key; frame = next;
        renderPlaceholders();
        for (const callback of [...listeners]) { try { callback(clone(frame)); } catch { /* one UI listener */ } }
    }
    function refresh() {
        if (closed) return;
        try { publish(computeFrame()); } catch (error) { report('frame', error); }
    }
    const onUpdate = () => {
        const before = adapter;
        if (readAdapter() !== before || !state) sync(); else refresh();
    };
    const onOutlineReset = () => { outline.reset(); applyOutline(); };
    function setListening(on) {
        if (on === listening) return;
        listening = on;
        const method = on ? 'on' : 'off';
        app[method]?.('update', onUpdate);
        app[method]?.('selection:outline-cleared', onOutlineReset);
        app[method]?.('select-tool:ready', onOutlineReset);
    }
    // The overlay chips show length / depth during Drag & Drop: the countertop dimension lines
    // would duplicate them (and collide with the chips), so they are suppressed while active.
    function suppressDimensions(value, target = getAdapter()) {
        try { target?.dimensionAdapter?.setSuppressed?.(value); } catch (error) { report('dimensions', error); }
    }
    const api = Object.freeze({
        setActive(value) {
            if (typeof value !== 'boolean') throw new TypeError('setActive expects a boolean');
            if (closed) return;
            active = value;
            setListening(active);
            if (!active) { unsubscribe?.(); unsubscribe = null; preview = null; }
            suppressDimensions(active);
            sync();
        },
        isActive: () => active,
        /** Ghost frame of a one-end resize: `{ side: 'left'|'right', lengthM }` or null (clears). Scene untouched. */
        previewLength(next) {
            if (next !== null && (typeof next !== 'object' || Array.isArray(next) || (next.side !== 'left' && next.side !== 'right') ||
                !finite(next.lengthM) || next.lengthM <= 0)) {
                throw new TypeError("previewLength expects { side: 'left'|'right', lengthM > 0 } or null");
            }
            if (closed) return;
            preview = next && active ? Object.freeze({ side: next.side, lengthM: next.lengthM }) : null;
            refresh();
        },
        lengthAtPointer,
        getState: () => clone(frame),
        on(event, callback, options = {}) {
            assertOverlaySubscription(event, callback, options);
            listeners.add(callback);
            if (options?.emitCurrent) { try { callback(clone(frame)); } catch { /* UI listener */ } }
            return () => { listeners.delete(callback); };
        },
        setPlaceholdersEnabled(enabled) {
            if (typeof enabled !== 'boolean') throw new TypeError('setPlaceholdersEnabled expects a boolean');
            placeholdersEnabled = enabled;
            if (!enabled) { try { view?.render(null); } catch (error) { report('placeholders', error); } }
            else renderPlaceholders();
        },
        getStyle: () => clone(style),
        setStyle(patch = {}) {
            style = patchDraftOverlayStyle(style, patch);
            applyTint(); applyOutline();
            if (placeholdersEnabled && frame) renderPlaceholders();
        }
    });
    return Object.freeze({
        api,
        dragGuard,
        sync,
        refresh,
        getSnapshot: () => Object.freeze({ active, closed, bound: !!root, tintInstances: tint?.instanceCount ?? 0, outlined: outline.size }),
        destroy() {
            if (closed) return;
            active = false; preview = null;
            suppressDimensions(false);
            sync();
            closed = true;
            setListening(false);
            unsubscribe?.(); unsubscribe = null;
            view?.destroy(); view = null;
            listeners.clear();
        }
    });
}
