import { createCabinetAPIClient } from '../../app-configuration/bridge/clients/cabinet-api-client.mjs';
import { cabinetSectionHelpers, failure, slug } from '../components.mjs';
import { handleStyleFor } from './urban-duplex.mjs';

const ULH = {
    Height: 38,
    Depth: 46,
    Handle: 'handle_urban_topcut',
    CabinetColor: 'Pulpis Chiaro TKH'
};
/** An Urban Duplex 28 column cabinet: Drawers '1D'; the handle follows the width (config guide, handleStyleFor). */ const udColumnCabinet = (Width, extra = {})=>({
        Width,
        Height: 28,
        Depth: 46,
        Drawers: '1D',
        HandleStyle: handleStyleFor(Width),
        CabinetColor: 'Rox Black TKQ',
        ...extra
    });
const CATALOG = Object.freeze([
    {
        id: 'ULH',
        title: 'Urban Low Height',
        modular: true,
        types: [
            {
                type: 'ULH-sink-cabinet',
                config: {
                    Width: 60,
                    ...ULH,
                    sinkType: 'Top_HPLPrisma'
                }
            },
            {
                type: 'ULH-side-cabinet',
                config: {
                    Width: 35,
                    ...ULH
                }
            },
            {
                type: 'ULH-Open-Shelf',
                config: {
                    Width: 60,
                    Height: 38,
                    Depth: 46
                }
            }
        ]
    },
    // Urban Duplex columns (28 over 28 beside a 56).
    {
        id: 'UD',
        title: 'Urban Duplex',
        modular: true,
        types: [
            {
                type: 'UD-side-cabinet',
                config: udColumnCabinet(40)
            },
            {
                type: 'UD-sink-cabinet',
                config: udColumnCabinet(60, {
                    sinkType: 'Top_HPLPrisma'
                })
            }
        ]
    },
    {
        id: 'URBAN',
        title: 'Urban Standard Height',
        types: [
            {
                type: 'Sink-Base',
                config: {
                    Width: 60,
                    Height: 56,
                    Depth: 46,
                    Drawers: '2D',
                    sinkType: 'Top_HPLPrisma'
                }
            },
            {
                type: 'Sink-Cabinet',
                config: {
                    Width: 60,
                    Height: 56,
                    Depth: 46,
                    Drawers: '2D'
                }
            },
            {
                type: 'Open-Shelf',
                config: {
                    Width: 60,
                    Height: 56,
                    Depth: 46
                }
            },
            {
                type: 'Side-Shelf',
                config: {
                    Height: 56,
                    Depth: 46
                }
            }
        ]
    },
    {
        id: 'CLASS',
        title: 'Class',
        types: [
            {
                type: 'Class-sink-cabinet',
                config: {
                    Width: 60,
                    Height: 52,
                    Depth: 52,
                    sinkType: 'Top_HPLPrisma'
                }
            },
            {
                type: 'Class-side-cabinet',
                config: {
                    Width: 60,
                    Height: 52,
                    Depth: 52
                }
            }
        ]
    },
    {
        id: 'LAME',
        title: 'Lame',
        types: [
            {
                type: 'Lame-sink-cabinet',
                config: {
                    Width: 60,
                    Height: 52,
                    Depth: 52,
                    sinkType: 'Top_HPLPrisma'
                }
            },
            {
                type: 'Lame-side-cabinet',
                config: {
                    Width: 60,
                    Height: 52,
                    Depth: 52
                }
            }
        ]
    },
    {
        id: 'MAKO',
        title: 'Mako',
        types: [
            {
                type: 'Mako-sink-cabinet',
                config: {
                    Width: 60,
                    Height: 52,
                    Depth: 52,
                    sinkType: 'Top_HPLPrisma'
                }
            },
            {
                type: 'Mako-side-cabinet',
                config: {
                    Width: 60,
                    Height: 52,
                    Depth: 52
                }
            }
        ]
    },
    {
        id: 'UF',
        title: 'Urban Freestanding',
        types: [
            {
                type: 'UF-sink-cabinet',
                config: {
                    Width: 60,
                    Height: 91,
                    Depth: 50
                }
            },
            {
                type: 'UF-side-cabinet',
                config: {
                    Width: 60,
                    Height: 91,
                    Depth: 50
                }
            }
        ]
    },
    {
        id: 'TRICOT',
        title: 'Tricot',
        types: [
            {
                type: 'Tricot-sink-cabinet',
                config: {
                    Width: 60,
                    Height: 40,
                    Depth: 52,
                    Drawers: '2D',
                    sinkType: 'Top_HPLPrisma'
                }
            },
            {
                type: 'Tricot-side-cabinet',
                config: {
                    Width: 60,
                    Height: 40,
                    Depth: 52,
                    Drawers: '2D'
                }
            }
        ]
    }
]);
const collectionOfType = (type)=>CATALOG.find((c)=>c.types.some((t)=>t.type === type)) ?? null;
/** Product id → type: the snapshot's productType, else the longest catalog type the id starts with. */ const typeOfId = (api, id)=>{
    let type = null;
    try {
        const c = api?.getConfig?.(id);
        type = typeof c?.get === 'function' ? c.get('productType') : c?.productType;
    } catch  {
        type = null;
    }
    if (type) return type;
    const all = CATALOG.flatMap((c)=>c.types.map((t)=>t.type)).sort((a, b)=>b.length - a.length);
    return all.find((t)=>id?.startsWith(`${t}-`) || id === t) ?? null;
};
const cabinetsSection = Object.freeze({
    id: 'cabinets',
    title: 'Cabinets',
    mount ({ api, ui, log, root }) {
        let plusOn = false, lockedId = null, draft = null;
        const client = createCabinetAPIClient({
            getAPI: api,
            onChange: (state)=>{
                draft = state.session ?? null;
            }
        });
        const { need, connectReady, selectedCabinetId, keepConnected } = cabinetSectionHelpers(api, client);
        // --- choice: collection → type → config
        const collection = ui.select('Collection', CATALOG.map((c)=>({
                value: c.id,
                label: c.title
            })), {
            get: ()=>lockedId ?? collection.input.value,
            set: ()=>fillTypes()
        });
        const type = ui.select('Type', [], {
            get: ()=>type.input.value,
            set: ()=>fillConfig()
        });
        const config = ui.textarea('Config JSON (Width / Height / Depth …)', {
            rows: 5
        });
        const lockNote = ui.note('');
        const current = ()=>CATALOG.find((c)=>c.id === collection.input.value) ?? CATALOG[0];
        function fillTypes() {
            const c = current(), selected = type.input.value;
            type.input.replaceChildren();
            for (const t of c.types){
                const o = ui.element('option', t.type);
                o.value = t.type;
                type.input.append(o);
            }
            type.input.value = c.types.some((t)=>t.type === selected) ? selected : c.types[0].type;
            fillConfig();
        }
        function fillConfig() {
            const entry = current().types.find((t)=>t.type === type.input.value);
            config.input.value = JSON.stringify(entry?.config ?? {}, null, 1);
        }
        const choice = ()=>{
            let selection;
            try {
                selection = config.input.value.trim() ? JSON.parse(config.input.value) : {};
            } catch  {
                throw failure('CONFIG_JSON_INVALID');
            }
            if (!type.input.value) throw failure('NO_TYPE');
            return {
                type: type.input.value,
                config: selection
            };
        };
        fillTypes();
        // --- add: buttons, "+" and D&D
        const added = (label, id)=>{
            log(label, id);
            return undefined;
        };
        const add = ui.button('Add', async ()=>{
            const c = choice();
            return added('addProduct', await need('addProduct').addProduct(c.type, c.config));
        });
        const left = ui.button('Add ←', async ()=>{
            const c = choice();
            return added('addProductByLeft', await need('addProductByLeft').addProductByLeft(c.type, c.config));
        });
        const right = ui.button('Add →', async ()=>{
            const c = choice();
            return added('addProductByRight', await need('addProductByRight').addProductByRight(c.type, c.config));
        });
        const onPlus = async (entityName, side)=>{
            try {
                const c = choice(), target = api();
                const id = entityName ? await target.setProductByParams(c.type, entityName, side, c.config) : await target.addProduct(c.type, c.config);
                log(`+ ${side ?? ''} ${c.type}`, id);
            } catch (error) {
                log('✖ +', slug(error));
            }
        };
        const plus = ui.toggle('"+" buttons add the configured cabinet', {
            get: ()=>plusOn,
            set: (on)=>{
                const target = need('setVisibleButtons');
                if (on) target.setHandleButtonClick?.(onPlus);
                target.setVisibleButtons(on);
                if (on && !scene().ids.length) target.showEmptyButton?.();
                else if (!on) target.hideEmptyButton?.();
                plusOn = on;
            }
        });
        const dndStart = ui.button('Start D&D', async ()=>{
            try {
                const c = choice();
                if (!collectionOfType(c.type)?.modular) throw failure('DND_MODULAR_ONLY');
                await connectReady();
                const options = await client.getPlacementOptions({
                    definitionId: c.type,
                    selection: c.config
                });
                const first = options.find((o)=>o.availability === 'available');
                if (!first) throw failure('NO_AVAILABLE_PLACEMENT', options.flatMap((o)=>o.reasons ?? []));
                return await client.beginAdd({
                    definitionId: c.type,
                    selection: c.config
                }, {
                    kind: 'option',
                    optionId: first.id
                });
            } catch (error) {
                throw slug(error);
            }
        }, {
            title: 'Preview at the first available placement; drag it with the pointer, then Apply'
        });
        const dndApply = ui.button('Apply', async ()=>{
            try {
                return await client.apply();
            } catch (error) {
                throw slug(error);
            }
        });
        const dndCancel = ui.button('Cancel', async ()=>{
            try {
                return await client.cancel();
            } catch (error) {
                throw slug(error);
            }
        });
        const draftView = ui.readout();
        // --- scene: list, select, remove
        function scene() {
            const target = api(), ids = new Set();
            const modular = client.getState().cabinets?.cabinets ?? [];
            for (const c of modular)ids.add(c.id);
            try {
                const e = target?.getEdgeCabinets?.();
                if (e?.leftCabinetId) ids.add(e.leftCabinetId);
                if (e?.rightCabinetId) ids.add(e.rightCabinetId);
            } catch  {}
            const selected = selectedCabinetId();
            if (selected) ids.add(selected);
            return {
                ids: [
                    ...ids
                ],
                selected
            };
        }
        const cabinet = ui.select('In scene', [
            {
                value: '',
                label: '— none —'
            }
        ], {
            get: ()=>cabinet.input.value,
            set: ()=>{}
        });
        const select = ui.button('Select', async ()=>{
            const id = cabinet.input.value || null, target = api();
            if (client.getState().status === 'ready' && client.supports('cabinets.select')) return client.select(id).catch((error)=>{
                throw slug(error);
            });
            target?.getSelectTool?.()?.setSelectedByName?.(id ? [
                id
            ] : [], {
                mode: 'replace'
            });
            return {
                selected: id
            };
        });
        const remove = ui.button('Remove', ()=>{
            const id = cabinet.input.value;
            if (!id) throw failure('NO_CABINET');
            return need('removeProduct').removeProduct(id) ?? {
                removed: id
            };
        });
        const removeSelected = ui.button('Remove selected', ()=>{
            const id = selectedCabinetId();
            if (!id) throw failure('NOTHING_SELECTED');
            return need('removeProduct').removeProduct(id) ?? {
                removed: id
            };
        });
        const removeAll = ui.button('Remove all', async ()=>{
            await need('removeAllProduct').removeAllProduct();
            return {
                removed: 'all'
            };
        });
        root.append(ui.group('Choose', [
            collection,
            lockNote,
            type,
            config
        ]), ui.group('Add', [
            ui.row(add, left, right),
            plus
        ]), ui.group('Drag & Drop (modular)', [
            ui.row(dndStart, dndApply, dndCancel),
            draftView
        ]), ui.group('Scene', [
            cabinet,
            ui.row(select, remove),
            ui.row(removeSelected, removeAll)
        ]));
        return {
            refresh () {
                keepConnected();
                const { ids, selected } = scene();
                // Collection lock from the cabinets in the scene.
                const owner = ids.map((id)=>collectionOfType(typeOfId(api(), id))).find(Boolean) ?? null;
                lockedId = owner?.id ?? null;
                if (owner && collection.input.value !== owner.id) {
                    collection.input.value = owner.id;
                    fillTypes();
                }
                collection.input.disabled = Boolean(owner);
                lockNote.textContent = owner ? `Locked to ${owner.title} by the scene (Remove all to switch).` : 'Empty scene: any collection.';
                const keep = cabinet.input.value;
                const key = ids.join('|');
                if (cabinet.input.dataset.key !== key) {
                    cabinet.input.dataset.key = key;
                    cabinet.input.replaceChildren();
                    if (!ids.length) {
                        const o = ui.element('option', '— none —');
                        o.value = '';
                        cabinet.input.append(o);
                    }
                    for (const id of ids){
                        const o = ui.element('option', id === selected ? `${id} ●` : id);
                        o.value = id;
                        cabinet.input.append(o);
                    }
                    cabinet.input.value = ids.includes(keep) ? keep : selected ?? ids[0] ?? '';
                }
                plus.refresh();
                const d = draft;
                draftView.set(d ? {
                    lifecycle: d.lifecycle,
                    canApply: d.canApply,
                    status: d.validation?.status ?? null,
                    reasons: (d.validation?.reasons ?? []).map((r)=>r.code)
                } : 'no draft');
            },
            dispose () {
                client.destroy();
            }
        };
    }
});

export { CATALOG, cabinetsSection, collectionOfType };
