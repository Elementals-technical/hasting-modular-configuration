import { createCabinetAPIClient } from '../../app-configuration/bridge/clients/cabinet-api-client.mjs';
import { cabinetSectionHelpers, failure } from '../components.mjs';
import { PRESETS } from '../data/collection-presets.mjs';
import { GUIDE_TEST_CASES, collectionOfProductType, HANDLE_CONTROLS, expectedPanelType } from '../data/side-panel-guide.mjs';
import { loadPresetPayload } from './presets.mjs';

const SIDE_PANEL_TYPES = Object.freeze([
    'NoG',
    'UpperG',
    'CenterG',
    'DoubleG'
]);
const NO_PANEL = 'None';
const SIDE_PANEL_PRODUCT_TYPE = /SidePanel_(Left|Right)$/;
const HANDLE_TARGETS = Object.freeze([
    {
        value: 'all',
        label: 'All cabinets'
    },
    {
        value: 'left-edges',
        label: 'Left edge cabinets'
    },
    {
        value: 'right-edges',
        label: 'Right edge cabinets'
    },
    {
        value: 'selected',
        label: 'Selected cabinet'
    }
]);
// --- Reading through the debug escape hatch -----------------------------------------------------------------
function compositionManagerOf(api) {
    return api()?.config?.compositionManager ?? null;
}
function activeCompositionOf(api) {
    return compositionManagerOf(api)?.getActiveComposition?.() ?? null;
}
function isSidePanelProduct(config) {
    return config?.category === 'addons' && SIDE_PANEL_PRODUCT_TYPE.test(config.productType ?? '');
}
function sideOfPanel(config) {
    if (config.side) return config.side;
    return String(config.productType).endsWith('_Left') ? 'left' : 'right';
}
/** Side-panel products of the active composition: [{ id, side, config }], left side first. */ function readPanels(api) {
    const composition = activeCompositionOf(api);
    if (!composition) return [];
    return Object.entries(composition.getAllProducts()).filter(([, config])=>isSidePanelProduct(config)).map(([id, config])=>({
            id,
            side: sideOfPanel(config),
            config
        })).sort((a, b)=>a.side.localeCompare(b.side) || a.id.localeCompare(b.id));
}
/** Cabinet products of the active composition: Map id → config. */ function readCabinets(api) {
    const composition = activeCompositionOf(api);
    if (!composition) return new Map();
    const cabinets = Object.entries(composition.getAllProducts()).filter(([, config])=>config?.category === 'cabinets');
    return new Map(cabinets);
}
/** The composition's collection, from its first cabinet ('ULH', 'UD', …), or null for an empty scene. */ function collectionOfScene(cabinets) {
    const first = cabinets.values().next().value;
    return first ? collectionOfProductType(first.productType) : null;
}
/** The cabinet a panel stands next to: its anchor (ULH), else the composition's end cabinet of that side. */ function cabinetIdOfPanel(api, panel) {
    if (panel.config.SidePanelAnchorCabinetId) return panel.config.SidePanelAnchorCabinetId;
    const ends = api()?.getEdgeCabinets?.() ?? {};
    return panel.side === 'left' ? ends.leftCabinetId : ends.rightCabinetId;
}
/** "expected NoG ✓", "expected DoubleG ✗ (guide only)" or '' when the guide has no rule for this cabinet. */ function describeExpectedType(collectionId, cabinetConfig, actualType) {
    const expected = expectedPanelType(collectionId, cabinetConfig ?? {});
    if (!expected) return '';
    const mark = expected.type === actualType ? '✓' : '✗';
    const notImplemented = expected.implemented ? '' : ' (guide only, not in code)';
    return `  expected ${expected.type} ${mark}${notImplemented}`;
}
/** The handle fields of a cabinet as one short text: "Handle=handle_pto" or "HandleSide=Right HandleStyle=Duplex …". */ function describeHandleOf(collectionId, cabinetConfig = {}) {
    const keys = (HANDLE_CONTROLS[collectionId] ?? []).map((control)=>control.key);
    return keys.map((key)=>`${key}=${cabinetConfig[key] ?? '?'}`).join(' ');
}
/** World X of a product's entity, or null when it has no entity. */ function worldXOf(api, productId) {
    const entity = api()?.config?.root?.findByName?.(productId);
    const x = entity?.getPosition?.().x;
    return Number.isFinite(x) ? x : null;
}
function describePanel(api, panel, cabinets) {
    const { id, side, config } = panel;
    const x = worldXOf(api, id);
    const anchor = config.SidePanelAnchorCabinetId ? ` at ${config.SidePanelAnchorCabinetId}` : '';
    const group = config.SupportGroupId ? ` (${config.SupportGroupId})` : '';
    const position = x === null ? '' : ` x=${x.toFixed(3)}`;
    const firstLine = `${side.padEnd(5)} ${config.SidePanelType ?? '?'}  H${config.Height ?? '?'} D${config.Depth ?? '?'}${anchor}${group}${position}  ${id}`;
    // Second line: the cabinet the panel follows, its handle fields and the guide's expected type.
    const cabinetId = cabinetIdOfPanel(api, panel);
    const cabinetConfig = cabinets.get(cabinetId);
    if (!cabinetConfig) return firstLine;
    const collectionId = collectionOfProductType(cabinetConfig.productType);
    const handle = describeHandleOf(collectionId, cabinetConfig);
    const expected = describeExpectedType(collectionId, cabinetConfig, config.SidePanelType);
    return `${firstLine}\n      ↳ ${cabinetId} ${handle}${expected}`;
}
/** Edge cabinets: one entry per row (ULH rows), or the composition's two ends (other collections). */ function readEdges(api) {
    const composition = activeCompositionOf(api);
    const rows = composition?.getCabinetRows?.() ?? [];
    const rowsWithCabinets = rows.filter((row)=>row.orderedCabinetIds?.length);
    if (rowsWithCabinets.length) {
        return rowsWithCabinets.map((row)=>({
                label: `row ${row.id} (y ${Number(row.bottomM ?? 0).toFixed(2)})`,
                left: row.orderedCabinetIds[0],
                right: row.orderedCabinetIds[row.orderedCabinetIds.length - 1]
            }));
    }
    const ends = api()?.getEdgeCabinets?.();
    if (!ends?.leftCabinetId) return [];
    return [
        {
            label: 'composition',
            left: ends.leftCabinetId,
            right: ends.rightCabinetId
        }
    ];
}
/**
 * The panel belongs to this edge cabinet. ULH panels name their anchor cabinet; a legacy panel has no anchor
 * and is the only panel of its side, so it belongs to the composition's end cabinet of that side.
 */ function isPanelOfCabinet(panel, cabinetId) {
    const anchorCabinetId = panel.config.SidePanelAnchorCabinetId;
    if (!anchorCabinetId) return true;
    return anchorCabinetId === cabinetId;
}
function hasPanelAtEdge(panels, cabinetId, side) {
    return panels.some((panel)=>panel.side === side && isPanelOfCabinet(panel, cabinetId));
}
function describeEdgeSide(panels, cabinetId, side) {
    const mark = hasPanelAtEdge(panels, cabinetId, side) ? '▌panel' : '·none ';
    return `${mark} ${cabinetId}`;
}
function describeEdge(panels, edge) {
    return [
        edge.label,
        `  left:  ${describeEdgeSide(panels, edge.left, 'left')}`,
        `  right: ${describeEdgeSide(panels, edge.right, 'right')}`
    ].join('\n');
}
function describeSelection(api) {
    const manager = compositionManagerOf(api);
    // Grouped panels (ULH, UF) save the choice in the composition; other collections keep it in the addon (global types).
    const saved = activeCompositionOf(api)?.getSidePanelSelection?.();
    const selection = saved ?? manager?.sidePanelAddon?.getGlobalTypes?.() ?? null;
    if (!selection) return 'selection: —';
    const source = saved ? 'saved' : 'addon';
    const grouped = manager?.sidePanelAddon?.usesGroupPanels?.() === true;
    const lifecycle = grouped ? 'grouped (panel per exposed edge, UF joints)' : 'one left / one right';
    return `selection (${source}): left ${selection.left ?? NO_PANEL} · right ${selection.right ?? NO_PANEL}\nlifecycle: ${lifecycle}`;
}
function describeState(api) {
    if (!compositionManagerOf(api)) return 'ConfiguratorAPI.config.compositionManager is not available';
    const panels = readPanels(api);
    const cabinets = readCabinets(api);
    const panelLines = panels.map((panel)=>describePanel(api, panel, cabinets));
    const edgeLines = readEdges(api).map((edge)=>describeEdge(panels, edge));
    return [
        describeSelection(api),
        `panels (${panels.length}):`,
        ...panelLines.length ? panelLines : [
            '  (none)'
        ],
        'edges:',
        ...edgeLines.length ? edgeLines : [
            '  (no cabinets)'
        ]
    ].join('\n');
}
function describePlan(plan) {
    const faceLines = (plan.faces ?? []).map((face)=>`${face.side.padEnd(5)} ${(face.face ?? 'end').padEnd(5)} ${String(face.exposure ?? '').padEnd(8)} ${face.cabinetId}${face.reason ? `  → ${face.reason}` : ''}`);
    return [
        `plan: ${plan.status}${plan.reason ? ` (${plan.reason})` : ''} · ${plan.panels?.length ?? 0} panels`,
        ...faceLines
    ].join('\n');
}
/** Cabinet ids a handle change goes to: 'all' | 'left-edges' | 'right-edges' | 'selected'. */ function cabinetIdsForTarget(api, target) {
    if (target === 'all') return [
        ...readCabinets(api).keys()
    ];
    if (target === 'left-edges') return readEdges(api).map((edge)=>edge.left);
    if (target === 'right-edges') return readEdges(api).map((edge)=>edge.right);
    const selectedId = api()?.getSelectionInfo?.()?.[0]?.productId;
    return selectedId ? [
        selectedId
    ] : [];
}
/** Select values are strings; Height values go to the configurator as numbers. */ function configValueOf(text) {
    const number = Number(text);
    return text !== '' && Number.isFinite(number) ? number : text;
}
function describeTestCase(testCase) {
    const steps = testCase.steps.map((step, index)=>`  ${index + 1}. ${step}`);
    return [
        `preset: ${testCase.presetId ?? '—'}`,
        'steps:',
        ...steps,
        `expected: ${testCase.expected}`
    ].join('\n');
}
// --- Section ---------------------------------------------------------------------------------------------------
const sidePanelsSection = Object.freeze({
    id: 'side-panels',
    title: 'Side panels',
    mount ({ api, ui, log, root }) {
        const client = createCabinetAPIClient({
            getAPI: api
        });
        const { need, connectReady, keepConnected } = cabinetSectionHelpers(api, client);
        /** Replace a select's options with plain values; the first one becomes the current value. */ function fillOptions(select, values) {
            select.input.replaceChildren();
            for (const value of values){
                const option = ui.element('option', value);
                option.value = value;
                select.input.append(option);
            }
            select.input.value = values[0] ?? '';
        }
        // 1. Set: the type is read on click; every button sends one global choice (or two for "only").
        const typeSelect = ui.select('Type', SIDE_PANEL_TYPES.map((type)=>({
                value: type
            })), {
            get: ()=>typeSelect.input.value,
            set: ()=>{}
        });
        typeSelect.input.value = SIDE_PANEL_TYPES[0];
        const chosenType = ()=>typeSelect.input.value;
        /** One setter call: type ('None' removes) on 'left' | 'right' | 'both'. */ async function setPanels(type, side) {
            const target = api();
            if (typeof target?.setConfigBatch !== 'function') throw failure('UNSUPPORTED_METHOD');
            await target.setConfigBatch({}, {
                SidePanel: type,
                SidePanelSide: side
            });
            log(`SidePanel ${type} · ${side}`);
        }
        const turnOnLeft = ui.button('On left', ()=>setPanels(chosenType(), 'left'));
        const turnOnRight = ui.button('On right', ()=>setPanels(chosenType(), 'right'));
        const turnOnBoth = ui.button('On both', ()=>setPanels(chosenType(), 'both'));
        const turnOffLeft = ui.button('Off left', ()=>setPanels(NO_PANEL, 'left'));
        const turnOffRight = ui.button('Off right', ()=>setPanels(NO_PANEL, 'right'));
        const turnOffAll = ui.button('Off all', ()=>setPanels(NO_PANEL, 'both'));
        // Two setter calls in a row: each one re-runs the rules and clears the scene selection.
        const onlyTitle = 'Two calls: the chosen type on one side, None on the other';
        const leftOnly = ui.button('Left only', async ()=>{
            await setPanels(chosenType(), 'left');
            await setPanels(NO_PANEL, 'right');
        }, {
            title: onlyTitle
        });
        const rightOnly = ui.button('Right only', async ()=>{
            await setPanels(NO_PANEL, 'left');
            await setPanels(chosenType(), 'right');
        }, {
            title: onlyTitle
        });
        // 2. Handle: the scene collection's handle fields, applied to the chosen cabinets (never with SidePanel).
        let handleCollectionId = null;
        const handleControls = ()=>HANDLE_CONTROLS[handleCollectionId] ?? [];
        const currentHandleControl = ()=>handleControls().find((control)=>control.key === handleFieldSelect.input.value);
        const handleFieldSelect = ui.select('Field', [], {
            get: ()=>handleFieldSelect.input.value,
            set: ()=>showHandleValues()
        });
        const handleValueSelect = ui.select('Value', [], {
            get: ()=>handleValueSelect.input.value,
            set: ()=>{}
        });
        const handleTargetSelect = ui.select('Cabinets', HANDLE_TARGETS, {
            get: ()=>handleTargetSelect.input.value,
            set: ()=>{}
        });
        handleTargetSelect.input.value = HANDLE_TARGETS[0].value;
        const handleNote = ui.note('');
        function showHandleControls(collectionId) {
            handleCollectionId = collectionId;
            fillOptions(handleFieldSelect, handleControls().map((control)=>control.key));
            showHandleValues();
        }
        function showHandleValues() {
            const control = currentHandleControl();
            fillOptions(handleValueSelect, control?.values ?? []);
            if (control) handleNote.textContent = `${handleCollectionId}: ${control.note}`;
            else handleNote.textContent = handleCollectionId ? `${handleCollectionId}: no handle field in the guide.` : 'Load a preset first.';
        }
        const applyHandle = ui.button('Apply', async ()=>{
            const control = currentHandleControl();
            if (!control) throw failure('NO_HANDLE_FIELD');
            const productIds = cabinetIdsForTarget(api, handleTargetSelect.input.value);
            if (!productIds.length) throw failure('NO_TARGET_CABINETS');
            const change = {
                [control.key]: configValueOf(handleValueSelect.input.value)
            };
            await need('setConfigBatch').setConfigBatch({
                productIds
            }, change);
            log(`${control.key} ${change[control.key]} → ${productIds.length} cabinet(s)`, productIds);
        }, {
            title: 'setConfigBatch({ productIds }, { field: value }) on cabinets only'
        });
        showHandleControls(null);
        // 3. Guide test cases: pick a case, Load preset, follow the steps, compare with the State readout.
        const caseSelect = ui.select('Case', GUIDE_TEST_CASES.map((testCase)=>({
                value: testCase.id,
                label: `${testCase.collection} · ${testCase.title}`
            })), {
            get: ()=>caseSelect.input.value,
            set: (caseId)=>showTestCase(caseId)
        });
        const caseView = ui.readout();
        const chosenTestCase = ()=>GUIDE_TEST_CASES.find((testCase)=>testCase.id === caseSelect.input.value) ?? GUIDE_TEST_CASES[0];
        function showTestCase(caseId) {
            const testCase = GUIDE_TEST_CASES.find((candidate)=>candidate.id === caseId) ?? GUIDE_TEST_CASES[0];
            caseSelect.input.value = testCase.id;
            caseView.set(describeTestCase(testCase));
        }
        const loadCasePreset = ui.button('Load preset', async ()=>{
            const preset = PRESETS.find((candidate)=>candidate.id === chosenTestCase().presetId);
            if (!preset) throw failure('NO_PRESET');
            return loadPresetPayload({
                need,
                connectReady,
                client,
                log
            }, preset.loader, preset.payload);
        });
        showTestCase(GUIDE_TEST_CASES[0].id);
        // 4. State and 5. the edges plan (read-only).
        const state = ui.readout('State');
        const planView = ui.readout('Edges plan');
        const measure = ui.button('Measure edges', async ()=>{
            const addon = compositionManagerOf(api)?.sidePanelAddon;
            if (typeof addon?.prepareGroupPlan !== 'function' || !addon.usesGroupPanels?.()) throw failure('GROUP_PLAN_UNAVAILABLE');
            // A fresh `shared` object: the plan is measured now, not taken from a rule cycle's cache.
            const plan = await addon.prepareGroupPlan({});
            planView.set(describePlan(plan));
            return {
                status: plan.status,
                panels: plan.panels.length
            };
        }, {
            title: 'Grouped panels (ULH, UF): exposed / covered / partial per edge and joint, and why a selected face has no panel'
        });
        root.append(ui.group('Set', [
            ui.note('Global choice: one type per side for the whole composition. ULH / UF draw NoG / UpperG; the handle (UF: height) decides.'),
            typeSelect,
            ui.row(turnOnLeft, turnOnRight, turnOnBoth),
            ui.row(turnOffLeft, turnOffRight, turnOffAll),
            ui.row(leftOnly, rightOnly)
        ]), ui.group('Handle', [
            handleNote,
            handleFieldSelect,
            handleValueSelect,
            handleTargetSelect,
            applyHandle
        ]), ui.group('State', [
            state
        ]), ui.group('Guide test cases', [
            caseSelect,
            caseView,
            loadCasePreset
        ], {
            open: false
        }), ui.group('Edges plan (ULH, UF)', [
            measure,
            planView
        ], {
            open: false
        }));
        return {
            refresh () {
                keepConnected();
                try {
                    // A new collection in the scene brings its own handle fields.
                    const sceneCollectionId = collectionOfScene(readCabinets(api));
                    if (sceneCollectionId !== handleCollectionId) showHandleControls(sceneCollectionId);
                    state.set(describeState(api));
                } catch (error) {
                    state.set(String(error?.message ?? error));
                }
            },
            dispose () {
                client.destroy();
            }
        };
    }
});

export { SIDE_PANEL_TYPES, sidePanelsSection };
