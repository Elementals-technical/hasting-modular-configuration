/**
 * Presets — where a test starts. Pick a collection, then one of its presets, edit the JSON if needed, Load.
 * Load replaces the scene. The way it loads depends on the preset's loader (data/collection-presets.mjs):
 *   - 'products' → removeAllProduct + presetProducts(products): one row, left → right;
 *   - 'compact'  → removeAllProduct + composition.importCompactPreset(preset): several rows / columns with positions
 *                  (modular collections only: ULH, UD). Goes through the API-only cabinet client.
 * Project-specific data lives in the data file only; the section itself is generic.
 */
import { createCabinetAPIClient } from '../../app-configuration/bridge/clients/cabinet-api-client.mjs';
import { cabinetSectionHelpers, failure, slug } from '../components.mjs';
import { PRESET_COLLECTIONS, PRESETS, LOADER_COMPACT } from '../data/collection-presets.mjs';

export { PRESETS };

const toJsonText = value => JSON.stringify(value, null, 2);

/**
 * Replace the scene with a preset payload through its loader. Shared with the Side panels test cases.
 * `context` = { need, connectReady, client, log } from cabinetSectionHelpers + a cabinet client.
 */
export async function loadPresetPayload(context, loader, payload) {
    if (loader === LOADER_COMPACT) return loadCompact(context, payload);
    return loadProducts(context, payload);
}

async function loadProducts({ need, log }, products) {
    if (!Array.isArray(products) || !products.length) throw new Error('presetProducts must be a non-empty array');
    const target = need('presetProducts');
    await need('removeAllProduct').removeAllProduct();
    const ids = await target.presetProducts(products);
    log('presetProducts', ids);
    return ids;
}

async function loadCompact({ need, connectReady, client, log }, preset) {
    try {
        await need('removeAllProduct').removeAllProduct();
        await connectReady();
        const result = await client.importCompactPreset(preset);
        log('importCompactPreset', result);
        return result;
    } catch (error) { throw slug(error); }
}

export const presetsSection = Object.freeze({
    id: 'presets',
    title: 'Presets',
    mount({ api, ui, log, root }) {
        const client = createCabinetAPIClient({ getAPI: api });
        const { need, connectReady, keepConnected } = cabinetSectionHelpers(api, client);
        let chosenPreset = PRESETS[0];

        // 1. Choice: collection → preset → editable JSON.
        const collectionSelect = ui.select('Collection', PRESET_COLLECTIONS.map(collection => ({ value: collection.id, label: collection.title })), {
            get: () => collectionSelect.input.value,
            set: collectionId => showPresetsOf(collectionId)
        });
        const presetSelect = ui.select('Preset', [], {
            get: () => presetSelect.input.value,
            set: presetId => showPreset(PRESETS.find(preset => preset.id === presetId))
        });
        const loaderNote = ui.note('');
        const editor = ui.textarea('Preset JSON (editable)', { rows: 8 });

        function showPresetsOf(collectionId) {
            const presets = PRESETS.filter(preset => preset.collection === collectionId);
            presetSelect.input.replaceChildren();
            for (const preset of presets) {
                const option = ui.element('option', preset.title);
                option.value = preset.id;
                presetSelect.input.append(option);
            }
            showPreset(presets[0]);
        }

        function showPreset(preset) {
            if (!preset) return;
            chosenPreset = preset;
            presetSelect.input.value = preset.id;
            editor.input.value = toJsonText(preset.payload);
            loaderNote.textContent = preset.loader === LOADER_COMPACT
                ? 'Loader: composition.importCompactPreset (rows with positions).'
                : 'Loader: presetProducts (one row, left → right, no positions).';
        }

        // 2. Load: replace the scene with the JSON in the editor, through the preset's loader.
        const loaderContext = { need, connectReady, client, log };
        const load = ui.button('Load preset', async () => {
            if (!chosenPreset) throw failure('NO_PRESET');
            const payload = JSON.parse(editor.input.value);
            return loadPresetPayload(loaderContext, chosenPreset.loader, payload);
        });
        const clear = ui.button('Remove all', async () => { await api()?.removeAllProduct?.(); log('removeAllProduct'); });
        const products = ui.readout();
        root.append(
            ui.group('Preset', [collectionSelect, presetSelect, loaderNote, editor, ui.row(load, clear)]),
            ui.group('Composition', [products]));
        showPresetsOf(PRESET_COLLECTIONS[0].id);

        // 3. Composition readout through the public cabinets API (scope from getCapabilities); legacy fallback: edge cabinets.
        let reading = false;
        async function readComposition() {
            const target = api();
            if (!target) return '—';
            if (typeof target.cabinets?.getCapabilities === 'function') {
                const caps = await target.cabinets.getCapabilities();
                if (!caps?.ok || caps.data?.readiness !== 'ready') return `cabinets: ${caps?.data?.readiness ?? 'unavailable'}`;
                const scope = { apiInstanceId: caps.data.apiInstanceId, compositionId: caps.data.activeCompositionId };
                const result = await target.cabinets.getState(scope);
                if (!result?.ok) return `cabinets.getState: ${result?.error?.code ?? 'error'}`;
                const rows = (result.data?.cabinets ?? []).map(c => `${c.id}  ${c.definitionId ?? ''}  x${(c.positionM?.x ?? 0).toFixed(3)} y${(c.positionM?.y ?? 0).toFixed(3)}`);
                const layouts = (result.data?.localLayouts ?? []).map(l => `row ${l.id ?? l.rowId ?? ''}: ${(l.orderedCabinetIds ?? []).join(' → ')}`);
                return [...rows, ...layouts].join('\n') || '(empty)';
            }
            return typeof target.getEdgeCabinets === 'function' ? JSON.stringify(target.getEdgeCabinets()) : '—';
        }
        return {
            refresh() {
                keepConnected();
                if (reading) return;
                reading = true;
                Promise.resolve().then(readComposition).then(text => products.set(text), error => products.set(String(error?.message ?? error)))
                    .finally(() => { reading = false; });
            },
            dispose() { client.destroy(); }
        };
    }
});
