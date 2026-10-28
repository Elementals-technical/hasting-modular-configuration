/**
 * Countertop — drives `ConfiguratorAPI.countertop` (+ `countertopOverlay` for the Drag & Drop
 * visuals). Metres, world XY; the offset is measured from the composition (standard) position.
 *
 * Mode buttons:   Standard = resetOffset() · Offset = x only (y = 0) · Remote = x + y (y > 0).
 * Drag & Drop:    Start = setDragEnabled(true) + overlay on (select the top in the scene to drag it);
 *                 Apply = keep the pose, visuals off · Cancel = back to the pose at Start.
 * Width:          length ± 1″ via setSize; resizeFrom(left|right) — also on a standard (attached) top; `null` follows the composition.
 * Lock Y:         setVerticalLocked(bool) — offset-only mode (4″ tops): no lift by API or drag.
 * Guard:          off (default) = moves pass { validation: 'skip' } and may reach invalid poses (state.validation
 *                 shows why); on = the API rejects an invalid pose with COUNTERTOP_POSE_INVALID like the drag does.
 * Thickness:      setConfigBatch({}, { Thickness }) — inches, applied to every product (top + sink cabinets,
 *                 the sink mount follows the thickness).
 * Material:       setConfigBatch({}, { CountertopColor }) — a material asset name (shared parameter).
 * Sink:           setConfig(<sink cabinet>, { sinkType }) — integrated (Top_*) or vessel (Vessel_*).
 * Sink landing:   reads getState().sink.landing / .pending; Move sink here = cabinets.moveSink(pending) (UI commit);
 *                 'sink-landing' actions from countertop.on('action') go to the log.
 * Methods:        every function of the namespaces, with JSON args — for anything not covered above.
 */
const INCH_M = 0.0254;
const STEP_X_M = 0.02;

/** Test values (project data — edit freely). Thickness in inches: ULH thick tops 4, 5-1/8, 5-1/2; thin 3/8, 1/2. */
export const COUNTERTOP_TEST_VALUES = Object.freeze({
    thicknessIn: [0.375, 0.5, 4, 5.125, 5.5],
    materials: ['Cacao Orinoco FF MT', 'Noce Sinfonia TKM', 'Pulpis Chiaro TKH'],
    sinks: [
        { value: 'Top_HPLPrisma', label: 'Integrated · HPL Prisma' },
        { value: 'Top_HPLQuadra', label: 'Integrated · HPL Quadra' },
        { value: 'Vessel_Aquarius', label: 'Vessel · Aquarius' },
        { value: 'Vessel_UrbanModo', label: 'Vessel · Urban Modo' }
    ]
});

export const countertopSection = Object.freeze({
    id: 'countertop',
    title: 'Countertop',
    mount({ api, ui, log, root }) {
        const ct = () => api()?.countertop ?? null;
        const overlay = () => api()?.countertopOverlay ?? null;
        const need = () => { const c = ct(); if (!c) throw new Error('ConfiguratorAPI.countertop is not available'); return c; };
        const state = () => { try { return ct()?.getState?.() ?? null; } catch { return null; } };
        const offset = () => state()?.offset ?? { x: 0, y: 0 };
        const length = () => state()?.size?.length ?? null;
        let startPose = null;

        const summary = ui.readout();
        const dragOn = ui.toggle('Pointer drag', { get: () => ct()?.isDragEnabled?.() ?? false, set: value => need().setDragEnabled(value) });
        const visuals = ui.toggle('D&D visuals (tint / outline)', { get: () => overlay()?.isActive?.() ?? false, set: value => overlay()?.setActive?.(value) });
        const start = ui.button('Start D&D', () => { startPose = { ...offset() }; need().setDragEnabled(true); overlay()?.setActive?.(true); return startPose; },
            { title: 'Remember the pose, enable pointer drag and the visuals' });
        const apply = ui.button('Apply', async () => { overlay()?.setActive?.(false); need().setDragEnabled(false); return need().whenSettled?.(); });
        const cancel = ui.button('Cancel', async () => {
            const c = need(); overlay()?.setActive?.(false); c.setDragEnabled(false);
            if (startPose) await c.setOffset({ x: startPose.x, y: startPose.y });
            return c.whenSettled?.();
        });

        let guard = false; // off: test moves may reach invalid poses on purpose (state.validation shows why)
        const SKIP = { get validation() { return guard ? 'guard' : 'skip'; } };
        const guardToggle = ui.toggle('Guard', { get: () => guard, set: value => { guard = value === true; } });
        const standard = ui.button('Standard', () => need().resetOffset(), { title: 'Back onto the composition (drops a custom length)' });
        const toOffset = ui.button('Offset (y = 0)', () => need().setOffset({ x: offset().x, y: 0 }, SKIP));
        const toRemote = ui.button('Remote (+1″ up)', () => need().setOffset({ x: offset().x, y: Math.max(offset().y, 0) + INCH_M }, SKIP));
        const lockY = ui.toggle('Lock Y', { get: () => state()?.verticalLocked ?? false, set: value => need().setVerticalLocked(value) });
        const x = ui.stepper('Offset X, m', { get: () => offset().x, step: STEP_X_M, apply: value => need().setOffset({ x: value, y: offset().y }, SKIP) });
        const y = ui.stepper('Offset Y, m', { get: () => offset().y, step: INCH_M, min: 0, apply: value => need().setOffset({ x: offset().x, y: value }, SKIP) });

        const len = ui.stepper('Length, m', { get: length, step: INCH_M, min: 0.01, apply: value => need().setSize({ length: value }) });
        const fromLeft = ui.button('−1″ left', () => need().resizeFrom('left', (length() ?? 0) - INCH_M, SKIP), { title: 'resizeFrom(left, length − 1″)' });
        const fromRight = ui.button('+1″ right', () => need().resizeFrom('right', (length() ?? 0) + INCH_M, SKIP), { title: 'resizeFrom(right, length + 1″)' });
        const follow = ui.button('Follow', () => need().setSize({ length: null }), { title: 'Follow the composition: setSize({ length: null })' });
        const limits = ui.row(ui.button('Limits 0.6–2 m', () => need().setLengthLimits({ minM: 0.6, maxM: 2 })),
            ui.button('Default limits', () => need().setLengthLimits(null)));

        // Top product config (Thickness / CountertopColor) and the sink cabinets, read through the public API.
        const topConfig = () => { try { const id = state()?.productId; return id ? api()?.getConfig?.(id) ?? null : null; } catch { return null; } };
        const read = (config, key) => typeof config?.get === 'function' ? config.get(key) : config?.[key];
        const batch = changes => {
            const target = api();
            if (typeof target?.setConfigBatch !== 'function') throw new Error('ConfiguratorAPI.setConfigBatch is not available');
            return target.setConfigBatch({}, changes);
        };
        let sinkCabinets = [];
        async function readSinkCabinets() {
            const target = api(), caps = await target?.cabinets?.getCapabilities?.();
            if (!caps?.ok || caps.data?.readiness !== 'ready') return [];
            const result = await target.cabinets.getState({ apiInstanceId: caps.data.apiInstanceId, compositionId: caps.data.activeCompositionId });
            return (result?.ok ? result.data?.cabinets ?? [] : []).filter(c => /sink/i.test(c.definitionId ?? c.id)).map(c => c.id);
        }
        const thickness = ui.select('Thickness, in', COUNTERTOP_TEST_VALUES.thicknessIn.map(v => ({ value: String(v), label: `${v}″` })), {
            get: () => read(topConfig(), 'Thickness'),
            set: value => batch({ Thickness: Number(value) })
        });
        const material = ui.textInput('Material', { suggestions: COUNTERTOP_TEST_VALUES.materials,
            placeholder: 'material asset name', apply: value => { if (!value) throw new Error('Enter a material name'); return batch({ CountertopColor: value }); } });
        const sinkTarget = ui.select('Sink cabinet', [{ value: '', label: '— none in scene —' }], { get: () => sinkTarget.input.value, set: () => {} });
        const sink = ui.select('Sink type', COUNTERTOP_TEST_VALUES.sinks, {
            get: () => { const id = sinkTarget.input.value; return id ? read(api()?.getConfig?.(id), 'sinkType') : null; },
            set: async value => {
                const id = sinkTarget.input.value || sinkCabinets[0];
                if (!id) throw new Error('No sink cabinet in the composition');
                return api().setConfig(id, { sinkType: value });
            }
        });
        // Sink landing (lifted top) → pending 'fits' → the UI commits with cabinets.moveSink.
        const sinkState = () => state()?.sink ?? null;
        const landingLine = ui.readout();
        const moveSink = ui.button('Move sink here', async () => {
            const target = api(), pending = sinkState()?.pending;
            if (pending?.status === 'home' || !pending?.cabinetId) throw new Error('No pending sink landing on another cabinet');
            if (typeof target?.cabinets?.moveSink !== 'function') throw Object.assign(new Error('cabinets.moveSink'), { code: 'UNSUPPORTED' });
            const caps = await target.cabinets.getCapabilities();
            if (!caps?.ok) throw Object.assign(new Error(caps?.error?.code), caps?.error ?? { code: 'NOT_READY' });
            const scope = { apiInstanceId: caps.data.apiInstanceId, compositionId: caps.data.activeCompositionId };
            const composition = await target.composition?.getState?.(scope);
            const result = await target.cabinets.moveSink({ ...scope, requestId: globalThis.crypto?.randomUUID?.() ?? `move-sink-${Date.now()}`,
                expectedCompositionRevision: composition?.data?.dependencies?.compositionRevision ?? composition?.data?.compositionRevision ?? caps.context?.dependencies?.compositionRevision,
                fromCabinetId: pending.fromCabinetId, toCabinetId: pending.cabinetId });
            if (!result?.ok) throw Object.assign(new Error(result?.error?.code), result?.error ?? { code: 'INTERNAL_ERROR' });
            return result.data;
        }, { title: 'cabinets.moveSink(sink.pending): swap sink base ↔ side cabinet and lower the top' });
        // The countertop namespace may appear after mount: subscribe (once per namespace) from refresh().
        let actionSource = null, offAction = null;
        const watchActions = () => {
            const c = ct();
            if (!c || c === actionSource || typeof c.on !== 'function') return;
            try { offAction?.(); } catch { /* old namespace gone */ }
            actionSource = c;
            try { offAction = c.on('action', action => { if (action?.type === 'sink-landing') log('sink-landing', action.landing); }); }
            catch { offAction = null; }
        };
        let readingSinks = false;
        const refreshSinks = () => {
            if (readingSinks) return;
            readingSinks = true;
            Promise.resolve().then(readSinkCabinets).then(ids => {
                if (ids.join() === sinkCabinets.join()) return;
                sinkCabinets = ids;
                const selected = sinkTarget.input.value;
                sinkTarget.input.replaceChildren();
                if (!ids.length) { const o = ui.element('option', '— none in scene —'); o.value = ''; sinkTarget.input.append(o); }
                for (const id of ids) { const o = ui.element('option', id); o.value = id; sinkTarget.input.append(o); }
                sinkTarget.input.value = ids.includes(selected) ? selected : ids[0] ?? '';
            }, () => {}).finally(() => { readingSinks = false; });
        };

        const ctMethods = ui.methods('countertop.*', ct, { log });
        const overlayMethods = ui.methods('countertopOverlay.*', overlay, { log });

        material.title = 'CountertopColor — a material asset name'; sink.title = 'sinkType of the selected sink cabinet';
        root.append(
            ui.group('State', [summary]),
            ui.group('Drag & Drop', [dragOn, visuals, ui.row(start, apply, cancel)]),
            ui.group('Position (mode / offset)', [ui.row(standard, toOffset, toRemote), ui.row(lockY, guardToggle), x, y]),
            ui.group('Width', [len, ui.row(fromLeft, fromRight, follow), limits]),
            ui.group('Top & sink', [thickness, material, sinkTarget, sink, landingLine, moveSink]),
            ui.group('API methods', [ctMethods, overlayMethods], { open: false }));

        return {
            refresh() {
                const s = state();
                summary.set(s ? {
                    readiness: s.readiness, attached: s.attached, dragging: s.dragging, canResize: s.canResize,
                    verticalLocked: s.verticalLocked, verticalLockViolated: s.verticalLockViolated,
                    offset: s.offset, size: s.size, customLength: s.customLength, thickness: s.thickness,
                    limits: s.lengthLimitsM, collision: s.collision, traps: s.traps,
                    validation: s.validation ? [s.validation.status, ...s.validation.reasons, ...s.validation.warnings.map(w => `warn:${w}`)].join(' ') : null,
                    overlay: overlay()?.getState?.()?.status ?? null
                } : 'countertop: not ready');
                const top = topConfig();
                material.input.placeholder = read(top, 'CountertopColor') ?? 'material asset name';
                dragOn.refresh(); lockY.refresh(); guardToggle.refresh(); visuals.refresh(); x.refresh(); y.refresh(); len.refresh();
                thickness.refresh(); refreshSinks(); sink.refresh();
                const sk = sinkState(), l = sk?.landing, pending = sk?.pending ?? null;
                landingLine.set(`landing: ${l?.status ?? 'none'} → ${l?.cabinetId ?? '—'} (dx ${l?.snapDxM ?? 0})\npending: ${pending ? `${pending.status ?? 'fits'} → ${pending.cabinetId ?? '—'}` : '—'}`);
                moveSink.disabled = !pending || pending.status === 'home' || !pending.cabinetId;
                watchActions();
                ctMethods.refresh(); overlayMethods.refresh();
            },
            dispose() { try { offAction?.(); } catch { /* best effort */ } offAction = null; actionSource = null; }
        };
    }
});
