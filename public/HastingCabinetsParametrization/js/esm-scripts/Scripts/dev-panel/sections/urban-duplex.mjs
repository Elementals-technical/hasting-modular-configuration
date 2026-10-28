import { createCabinetAPIClient } from '../../app-configuration/bridge/clients/cabinet-api-client.mjs';
import { cabinetSectionHelpers, failure, slug } from '../components.mjs';
import { UD_TEST_PRESETS, EXAMPLE_COMPACT_PRESET } from '../data/urban-duplex-presets.mjs';

// --- Project data (Urban Duplex SKU) ---------------------------------------------------------
const SIDE_CABINET = 'UD-side-cabinet';
const SINK_CABINET = 'UD-sink-cabinet';
const CABINET_TYPES = Object.freeze([
    SIDE_CABINET,
    SINK_CABINET
]);
const MODE_FULL = 'full';
const MODE_LOW = 'low';
const MODES = Object.freeze([
    {
        value: MODE_FULL,
        label: '56 on the floor'
    },
    {
        value: MODE_LOW,
        label: '28 column cabinet'
    }
]);
const FULL_HEIGHT = 56;
const LOW_HEIGHT = 28;
const DEPTH = 46;
const FULL_DRAWERS = '2D';
const LOW_DRAWERS = '1D';
const HANDLE_DUPLEX = 'Duplex';
const HANDLE_DEFAULT = 'Default';
/** Narrow cabinets (Width ≤ 40) take the Default handle instead of Duplex. */ const MAX_WIDTH_WITH_DEFAULT_HANDLE = 40;
const CABINET_COLOR = 'Rox Black TKQ';
const COUNTERTOP_COLOR = 'Pietra Di Savoia Antracite TQ6';
const SINK_TYPE = 'Top_HPLPrisma';
const FULL_WIDTHS = Object.freeze([
    25,
    35,
    40,
    50,
    60,
    70,
    80,
    90,
    100,
    105,
    120
]);
const LOW_SIDE_WIDTHS = Object.freeze([
    25,
    35,
    50,
    60,
    70,
    80,
    90,
    105,
    120
]);
const LOW_SINK_WIDTHS = Object.freeze([
    60,
    70,
    80,
    90,
    105,
    120
]);
const EXAMPLE_PRESET_TEXT = JSON.stringify(EXAMPLE_COMPACT_PRESET, null, 2);
// --- "+" filters ------------------------------------------------------------------------------
const COLUMN_PLUS_KINDS = Object.freeze([
    'top',
    'bottom'
]);
const ROW_END_PLUS_KINDS = Object.freeze([
    'left',
    'right',
    'left-top',
    'right-top'
]);
const PLUS_FILTERS = Object.freeze([
    {
        value: 'all',
        label: 'all',
        filter: null
    },
    {
        value: 'column',
        label: 'column only (top / bottom)',
        filter: (plus)=>COLUMN_PLUS_KINDS.includes(plus?.kind)
    },
    {
        value: 'row-ends',
        label: 'row ends only',
        filter: (plus)=>ROW_END_PLUS_KINDS.includes(plus?.kind)
    }
]);
const AVAILABLE = 'available';
// --- Pure helpers (exported for tests) ------------------------------------------------------
/** Widths offered for a mode and a cabinet type (the SKU lists above). */ function widthsFor(mode, definitionId) {
    if (mode === MODE_FULL) return FULL_WIDTHS;
    if (definitionId === SINK_CABINET) return LOW_SINK_WIDTHS;
    return LOW_SIDE_WIDTHS;
}
/**
 * Config guide: a narrow cabinet (Width ≤ 40) takes the Default handle, a wider one Duplex.
 * handleStyleFor(40) → 'Default'; handleStyleFor(50) → 'Duplex'.
 * Read by buildChoice below and by the UD entries of CATALOG in sections/cabinets.mjs.
 */ function handleStyleFor(width) {
    if (width <= MAX_WIDTH_WITH_DEFAULT_HANDLE) return HANDLE_DEFAULT;
    return HANDLE_DUPLEX;
}
/** The cabinet choice `{ definitionId, selection }` for a mode, a type and a width. */ function buildChoice(mode, definitionId, width) {
    const isFull = mode === MODE_FULL;
    const selection = {
        Width: width,
        Height: isFull ? FULL_HEIGHT : LOW_HEIGHT,
        Depth: DEPTH,
        Drawers: isFull ? FULL_DRAWERS : LOW_DRAWERS,
        HandleStyle: handleStyleFor(width),
        CabinetColor: CABINET_COLOR,
        CountertopColor: COUNTERTOP_COLOR
    };
    if (definitionId === SINK_CABINET) selection.sinkType = SINK_TYPE;
    return {
        definitionId,
        selection
    };
}
/** "+" kinds whose placement option carries the same slot id (`${kind}:${anchorCabinetId}`). */ const SLOT_NAMED_PLUS_KINDS = Object.freeze([
    'top',
    'bottom'
]);
/** Why: a low cabinet added at a row end hangs from the plane anyway (R1), so the slots have one option per end for both "+". */ const ROW_END_KIND_OF_HANGING_PLUS = Object.freeze({
    'left-top': 'left',
    'right-top': 'right'
});
/**
 * The placement option behind a scene "+": same kind, anchored on the same cabinet, available.
 * `plus` is `{ kind, cabinetId }`. Returns null when there is no such option.
 */ function optionForPlus(options, plus) {
    const sameAnchor = (option)=>option.anchorCabinetId === plus?.cabinetId;
    const rowEndKind = ROW_END_KIND_OF_HANGING_PLUS[plus?.kind];
    const available = (options ?? []).filter((option)=>option.kind === (rowEndKind ?? plus?.kind) && option.availability === AVAILABLE);
    // 0. A hanging row-end "+" ('left-top' / 'right-top') takes the 'left' / 'right' option of the same anchor.
    if (rowEndKind) return available.find(sameAnchor) ?? null;
    // 1. A column "+" names its slot: slotId = `${kind}:${anchorCabinetId}` (= plus.id); the anchor alone also identifies it.
    if (SLOT_NAMED_PLUS_KINDS.includes(plus?.kind)) {
        const slotId = plus.id ?? `${plus.kind}:${plus.cabinetId}`;
        return available.find((option)=>option.slotId === slotId || sameAnchor(option)) ?? null;
    }
    // 2. A row-end "+" (left / right): column rows give one option per row end, at the R1 level of the cabinet
    //    to add (a low one hangs, a tier-tall one stands). Several rows -> several options: the one anchored on
    //    this cabinet wins; otherwise the lowest.
    if (!available.length) return null;
    const lower = (a, b)=>(a.positionM?.y ?? 0) - (b.positionM?.y ?? 0);
    return [
        ...available
    ].sort((a, b)=>lower(a, b) || (sameAnchor(b) ? 1 : 0) - (sameAnchor(a) ? 1 : 0))[0];
}
/** One line per "+" button: kind · cabinetId · availability · visible. */ function describePlusButtons(list) {
    if (!list.length) return '(no "+" buttons)';
    return list.map((plus)=>[
            plus.kind,
            plus.cabinetId,
            plus.availability ?? '—',
            plus.visible ? 'visible' : 'hidden'
        ].join(' · ')).join('\n');
}
/** A position below this (m) is rounding, not a snap: the readout marks bigger raw → effective moves. */ const SNAP_EPSILON_M = 0.00005;
/**
 * Raw (requested) vs effective (after snap) position of a drag preview, one line per axis.
 * describeSnap({ x: 0.9, y: 0.9 }, { x: 0.9, y: 0.899 }) → 'x raw 0.9000 → 0.9000\ny raw 0.9000 → 0.8990 (snapped)'.
 */ function describeSnap(raw, effective) {
    if (!raw && !effective) return 'raw → effective: —';
    const format = (value)=>Number.isFinite(value) ? value.toFixed(4) : '—';
    return [
        'x',
        'y'
    ].map((axis)=>{
        const from = raw?.[axis], to = effective?.[axis];
        const snapped = Number.isFinite(from) && Number.isFinite(to) && Math.abs(from - to) > SNAP_EPSILON_M;
        return `${axis} raw ${format(from)} → ${format(to)}${snapped ? ' (snapped)' : ''}`;
    }).join('\n');
}
/** One line per cabinet: id · definitionId · W×H · x/y · SupportGroupId. */ function describeComposition(cabinets) {
    if (!cabinets.length) return '(empty)';
    return cabinets.map((cabinet)=>{
        const selection = cabinet.selection ?? {};
        const position = cabinet.positionM ?? {};
        const size = `${selection.Width ?? '?'}×${selection.Height ?? '?'}`;
        const place = `x${(position.x ?? 0).toFixed(3)}/y${(position.y ?? 0).toFixed(3)}`;
        return [
            cabinet.id,
            cabinet.definitionId ?? '',
            size,
            place,
            selection.SupportGroupId ?? '—'
        ].join(' · ');
    }).join('\n');
}
// --- Section ------------------------------------------------------------------------------------
const urbanDuplexSection = Object.freeze({
    id: 'urban-duplex',
    title: 'Urban Duplex',
    mount ({ api, ui, log, root }) {
        let draft = null; // the open drag session (cabinetPlacement state), null when none
        const client = createCabinetAPIClient({
            getAPI: api,
            onChange: (state)=>{
                draft = state.session ?? null;
            }
        });
        const { need, connectReady, selectedCabinetId, keepConnected } = cabinetSectionHelpers(api, client);
        let plusOn = false;
        let plusFilterSet = false;
        // 1. Cabinet to add: Mode → Type → Width, shown as the exact choice.
        const mode = ui.select('Mode', MODES, {
            get: ()=>mode.input.value,
            set: ()=>fillWidths()
        });
        const type = ui.select('Type', CABINET_TYPES.map((value)=>({
                value
            })), {
            get: ()=>type.input.value,
            set: ()=>fillWidths()
        });
        const width = ui.select('Width', [], {
            get: ()=>width.input.value,
            set: ()=>showChoice()
        });
        const configView = ui.readout('Config');
        const choice = ()=>buildChoice(mode.input.value, type.input.value, Number(width.input.value));
        function showChoice() {
            configView.set(JSON.stringify(choice(), null, 1));
        }
        function fillWidths() {
            const widths = widthsFor(mode.input.value, type.input.value);
            const previous = Number(width.input.value);
            width.input.replaceChildren();
            for (const value of widths){
                const option = ui.element('option', String(value));
                option.value = String(value);
                width.input.append(option);
            }
            const keep = widths.includes(previous) ? previous : widths[0];
            width.input.value = String(keep);
            showChoice();
        }
        fillWidths();
        const start = ui.button('Start', async ()=>{
            const { definitionId, selection } = choice();
            await need('removeAllProduct').removeAllProduct();
            const id = await need('addProduct').addProduct(definitionId, selection);
            log('Start', id);
        }, {
            title: 'Empty the scene, then add this cabinet'
        });
        const addLeft = ui.button('Add ←', async ()=>{
            const { definitionId, selection } = choice();
            log('addProductByLeft', await need('addProductByLeft').addProductByLeft(definitionId, selection));
        });
        const addRight = ui.button('Add →', async ()=>{
            const { definitionId, selection } = choice();
            log('addProductByRight', await need('addProductByRight').addProductByRight(definitionId, selection));
        });
        const removeSelected = ui.button('Remove selected', ()=>{
            const id = selectedCabinetId();
            if (!id) throw failure('NOTHING_SELECTED');
            return need('removeProduct').removeProduct(id) ?? {
                removed: id
            };
        });
        const clearScene = ui.button('Clear scene', async ()=>{
            await need('removeAllProduct').removeAllProduct();
            log('Clear scene', 'removeAllProduct');
        }, {
            title: 'Remove every cabinet (removeAllProduct)'
        });
        // 2. "+" buttons: a click adds the chosen cabinet at the placement option of that "+".
        // A "+" fires on mousedown AND touchstart: the second call must not start a second add.
        let plusInFlight = false;
        const onPlus = async (entityName, kind, plus)=>{
            // Legacy left / right "+" pass no third argument: the entity is the anchor cabinet.
            const target = plus ?? {
                kind,
                cabinetId: entityName
            };
            if (plusInFlight) return;
            plusInFlight = true;
            try {
                const cabinet = choice();
                await connectReady();
                // Step 1: the placement options of the chosen cabinet.
                const options = await client.getPlacementOptions(cabinet);
                // Step 2: the option behind this "+".
                const option = optionForPlus(options, target);
                if (!option) {
                    log('plus', {
                        kind: target.kind,
                        error: 'NO_AVAILABLE_PLACEMENT'
                    });
                    return;
                }
                // Step 3: add there and commit.
                await client.beginAdd(cabinet, {
                    kind: 'option',
                    optionId: option.id
                });
                const result = await client.apply();
                log(`plus ${target.kind} @ ${target.cabinetId}`, result);
            } catch (error) {
                log('✖ plus', slug(error));
            } finally{
                plusInFlight = false;
            }
        };
        const plusToggle = ui.toggle('"+" add the cabinet above', {
            get: ()=>plusOn,
            set: (on)=>{
                const target = need('setVisibleButtons');
                if (on) {
                    target.setHandleButtonClick?.(onPlus);
                    target.setVisibleButtons(true);
                } else {
                    target.setVisibleButtons(false);
                    target.setHandleButtonClick?.(null);
                    target.setPlusFilter?.(null);
                }
                plusOn = on;
            }
        });
        const plusFilter = ui.select('Show', PLUS_FILTERS.map(({ value, label })=>({
                value,
                label
            })), {
            get: ()=>plusFilter.input.value,
            set: (value)=>{
                const entry = PLUS_FILTERS.find((item)=>item.value === value) ?? PLUS_FILTERS[0];
                need('setPlusFilter').setPlusFilter(entry.filter);
                plusFilterSet = entry.filter !== null;
                return {
                    plusFilter: entry.value
                };
            }
        });
        // Per-column "+" control: the column is the cabinet selected in the scene (top or bottom of it).
        const plusButtonsAPI = ()=>{
            const target = api()?.plusButtons;
            if (!target) throw failure('UNSUPPORTED_METHOD');
            return target;
        };
        const selectedColumn = ()=>{
            const id = selectedCabinetId();
            if (!id) throw failure('NOTHING_SELECTED');
            return id;
        };
        const plusHideColumn = ui.button('Hide "+" of selected column', ()=>{
            const id = selectedColumn();
            return plusButtonsAPI().hideForColumn(id) ?? {
                hidden: id
            };
        });
        const plusShowColumn = ui.button('Show them', ()=>{
            const id = selectedColumn();
            return plusButtonsAPI().showForColumn(id) ?? {
                shown: id
            };
        }, {
            title: 'The top and bottom "+" of the selected column again'
        });
        const plusReset = ui.button('Reset', ()=>plusButtonsAPI().reset() ?? {
                reset: true
            }, {
            title: 'No filter, nothing hidden'
        });
        const plusView = ui.readout('Plus buttons');
        // 3. Preset: compact preset (urban-compact-v2) in and out.
        const presetText = ui.textarea('Compact preset JSON', {
            value: EXAMPLE_PRESET_TEXT,
            rows: 10
        });
        // 0. Test presets: one click replaces the scene with a known case (removeAllProduct → importCompactPreset).
        const testPreset = ui.select('Test preset', UD_TEST_PRESETS.map(({ id, label, inches })=>({
                value: id,
                label: inches ? `${label} · ${inches}` : label
            })), {
            get: ()=>testPreset.input.value,
            set: ()=>{}
        });
        const loadPreset = ui.button('Load', async ()=>{
            const entry = UD_TEST_PRESETS.find((item)=>item.id === testPreset.input.value) ?? UD_TEST_PRESETS[0];
            if (!entry) throw failure('NO_TEST_PRESET');
            presetText.input.value = JSON.stringify(entry.preset, null, 2);
            try {
                await need('removeAllProduct').removeAllProduct();
                await connectReady();
                const result = await client.importCompactPreset(entry.preset);
                log(`Load ${entry.id}`, result);
            } catch (error) {
                throw slug(error);
            }
        }, {
            title: 'Replace the scene with this preset; its JSON goes into the Preset text area'
        });
        const save = ui.button('Save', async ()=>{
            try {
                await connectReady();
                const preset = await client.exportCompactPreset();
                presetText.input.value = JSON.stringify(preset, null, 2);
                log('exportCompactPreset', preset);
            } catch (error) {
                throw slug(error);
            }
        });
        const restore = ui.button('Restore', async ()=>{
            let preset;
            try {
                preset = JSON.parse(presetText.input.value);
            } catch  {
                throw failure('PRESET_JSON_INVALID');
            }
            try {
                // Step 1: without a ready modular runtime, start from an empty scene (as the demo does).
                await client.connect().catch(()=>{});
                if (client.getState().status !== 'ready') await need('removeAllProduct').removeAllProduct();
                // Step 2: import.
                await connectReady();
                const result = await client.importCompactPreset(preset);
                log('importCompactPreset', result);
            } catch (error) {
                throw slug(error);
            }
        });
        const example = ui.button('Example', ()=>{
            presetText.input.value = EXAMPLE_PRESET_TEXT;
        });
        const copy = ui.button('Copy', async ()=>{
            // Why guarded: the clipboard needs a secure context and focus; a refusal must not look like a crash.
            try {
                await globalThis.navigator.clipboard.writeText(presetText.input.value);
                log('Copy', 'preset JSON on the clipboard');
            } catch (error) {
                log('✖ Copy', error?.name ?? 'CLIPBOARD_UNAVAILABLE');
            }
        });
        // 4. Drag & drop: a preview of the chosen cabinet at a placement kind (then drag it with the pointer),
        //    or a move of the cabinet selected in the scene; Apply commits, Cancel discards. The status readout
        //    shows the open session: lifecycle, validation, where the preview snapped, whether it can be applied.
        const DRAG_STARTS = Object.freeze([
            {
                value: 'auto',
                label: 'first available'
            },
            {
                value: 'right',
                label: 'right end: a 28 hangs, a 56 stands on the floor'
            },
            {
                value: 'top',
                label: 'over a lone bottom'
            },
            {
                value: 'bottom',
                label: 'under a hanging top'
            }
        ]);
        const dragStartKind = ui.select('Start at', DRAG_STARTS, {
            get: ()=>dragStartKind.input.value,
            set: ()=>{}
        });
        const dragStart = ui.button('Start D&D', async ()=>{
            try {
                const cabinet = choice();
                await connectReady();
                const options = await client.getPlacementOptions(cabinet);
                const kind = dragStartKind.input.value;
                const option = kind === 'auto' ? options.find((candidate)=>candidate.availability === AVAILABLE && candidate.kind !== 'park') : options.find((candidate)=>candidate.availability === AVAILABLE && candidate.kind === kind);
                if (!option) throw failure('NO_AVAILABLE_PLACEMENT');
                return await client.beginAdd(cabinet, {
                    kind: 'option',
                    optionId: option.id
                });
            } catch (error) {
                throw slug(error);
            }
        }, {
            title: 'Preview of the cabinet above at the chosen placement; drag it with the pointer, then Apply'
        });
        const dragMove = ui.button('Move selected', async ()=>{
            try {
                const id = selectedCabinetId();
                if (!id) throw failure('NOTHING_SELECTED');
                await connectReady();
                return await client.beginMove(id);
            } catch (error) {
                throw slug(error);
            }
        }, {
            title: 'Drag the cabinet selected in the scene with the pointer, then Apply'
        });
        const dragApply = ui.button('Apply', async ()=>{
            try {
                return await client.apply();
            } catch (error) {
                throw slug(error);
            }
        });
        const dragCancel = ui.button('Cancel', async ()=>{
            try {
                return await client.cancel();
            } catch (error) {
                throw slug(error);
            }
        });
        // Exact placement for snap tests: X / Y in metres on the wall frame, z kept from the preview.
        const numberField = (label)=>{
            const node = ui.element('label', '', 'field'), input = ui.element('input');
            input.type = 'number';
            input.step = '0.001';
            input.placeholder = 'm';
            node.append(ui.element('span', label), input);
            return Object.assign(node, {
                input
            });
        };
        const placeX = numberField('X, m');
        const placeY = numberField('Y, m');
        const dragPlace = ui.button('Place', async ()=>{
            try {
                if (!draft) throw failure('NO_DRAFT');
                const current = draft.candidate?.placement?.positionM ?? draft.candidate?.effectivePlacement?.positionM ?? {};
                const read = (field, fallback)=>{
                    const text = String(field.input.value ?? '').trim();
                    const value = text === '' ? fallback : Number(text);
                    if (!Number.isFinite(value)) throw failure('INVALID_POSITION');
                    return value;
                };
                const positionM = {
                    x: read(placeX, current.x),
                    y: read(placeY, current.y),
                    z: current.z ?? 0
                };
                return await client.updateDraft({
                    placement: {
                        kind: 'free',
                        frameId: 'wall',
                        positionM
                    }
                });
            } catch (error) {
                throw slug(error);
            }
        }, {
            title: 'Move the open preview to X / Y (m) on the wall; an empty field keeps the current value'
        });
        const dragView = ui.readout();
        const describeDraft = ()=>{
            if (!draft) return 'drag & drop: idle';
            const placement = draft.candidate?.effectivePlacement?.positionM;
            const at = placement ? `x ${placement.x.toFixed(4)} y ${placement.y.toFixed(3)}` : '—';
            const reasons = (draft.validation?.reasons ?? []).map((reason)=>reason.code).join(', ');
            return [
                `drag & drop: ACTIVE (${draft.kind ?? 'add'}) · ${draft.lifecycle}`,
                `validation: ${draft.validation?.status ?? '—'}${reasons ? ` (${reasons})` : ''}`,
                `preview at: ${at}`,
                describeSnap(draft.candidate?.placement?.positionM, placement),
                `canApply: ${draft.canApply ? 'yes' : 'no'}`
            ].join('\n');
        };
        // 5. Composition readout.
        const compositionView = ui.readout();
        root.append(ui.group('Test presets', [
            testPreset,
            ui.row(loadPreset)
        ]), ui.group('Cabinet to add', [
            mode,
            type,
            width,
            configView,
            ui.row(start, addLeft, addRight),
            ui.row(removeSelected, clearScene)
        ]), ui.group('"+" buttons', [
            plusToggle,
            plusFilter,
            ui.row(plusHideColumn, plusShowColumn, plusReset),
            plusView
        ]), ui.group('Drag & drop', [
            dragStartKind,
            ui.row(dragStart, dragMove, dragApply, dragCancel),
            ui.row(placeX, placeY, dragPlace),
            dragView
        ]), ui.group('Preset', [
            presetText,
            ui.row(save, restore, example, copy)
        ]), ui.group('Composition', [
            compositionView
        ]));
        return {
            refresh () {
                keepConnected();
                plusToggle.refresh();
                let plusList = null;
                try {
                    plusList = api()?.plusButtons?.list?.() ?? null;
                } catch  {
                    plusList = null;
                }
                plusView.set(Array.isArray(plusList) ? describePlusButtons(plusList) : 'plusButtons: unavailable');
                dragView.set(describeDraft());
                const state = client.getState();
                const cabinets = state.cabinets?.cabinets;
                compositionView.set(Array.isArray(cabinets) ? describeComposition(cabinets) : `cabinets: ${state.status}`);
            },
            dispose () {
                const target = api();
                if (plusOn) {
                    try {
                        target?.setVisibleButtons?.(false);
                        target?.setHandleButtonClick?.(()=>{});
                    } catch  {}
                }
                if (plusFilterSet) {
                    try {
                        target?.setPlusFilter?.(null);
                    } catch  {}
                }
                client.destroy();
            }
        };
    }
});

export { EXAMPLE_COMPACT_PRESET, buildChoice, describeSnap, handleStyleFor, optionForPlus, urbanDuplexSection, widthsFor };
