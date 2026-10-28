import { createCabinetAPIClient } from '../clients/cabinet-api-client.mjs';
import { createCabinetPresetLibrary } from '../clients/cabinet-preset-library.mjs';

const owners = new WeakMap();
const json = (value)=>JSON.stringify(value, null, 2);
/** Optional DOM consumer of window.ConfiguratorAPI. Never reads API.config or app.
 * The flag enables inspection only; it cannot configure a runtime or approve a product.
 */ function mountCabinetDebugPanel({ window: win = globalThis.window } = {}) {
    if (!win || new URLSearchParams(win.location?.search ?? '').get('cabinetDebug') !== '1') return null;
    if (owners.has(win)) return owners.get(win);
    const doc = win.document;
    if (!doc?.body) return null;
    let closed = false, timer = null, attempts = 0, client, choice = {
        definitionId: '',
        selection: {}
    }, configuration = null, options = [], catalogKey = '', cabinetKey = '', identity = '', optionsRevision = null, formGeneration = 0, lastPoseKey = '', lastState = null;
    const listeners = [];
    const element = (tag, text = '')=>{
        const node = doc.createElement(tag);
        node.textContent = text;
        return node;
    };
    const listen = (node, type, callback)=>{
        node.addEventListener(type, callback);
        listeners.push(()=>node.removeEventListener(type, callback));
    };
    const host = element('div');
    host.setAttribute('data-cabinet-debug', '1');
    const shadow = host.attachShadow({
        mode: 'open'
    });
    const style = element('style', `
      :host { position:fixed; top:12px; right:12px; z-index:10000; width:min(380px,calc(100vw - 24px));
        color:#e8edf5; font:13px/1.45 system-ui,sans-serif; color-scheme:dark; }
      * { box-sizing:border-box; } aside { background:#16202bed; border:1px solid #506074; border-radius:10px;
        padding:12px; box-shadow:0 6px 24px #0006; } header { display:flex; align-items:center; justify-content:space-between; }
      h2 { font-size:15px; margin:0; } h3 { font-size:13px; margin:16px 0 6px; }
      main { max-height:78vh; overflow:auto; overscroll-behavior:contain; touch-action:auto; }
      label { display:block; margin:7px 0; } input,select,textarea,button { font:inherit; border:1px solid #607186;
        border-radius:4px; background:#202e3d; color:inherit; padding:6px; max-width:100%; }
      input,select,textarea { display:block; width:100%; margin-top:3px; } button { margin:3px 5px 3px 0; cursor:pointer; }
      button:disabled { opacity:.45; cursor:default; } button:focus-visible,input:focus-visible,select:focus-visible { outline:2px solid #8dd5ff; }
      pre { white-space:pre-wrap; word-break:break-word; font-size:11px; max-height:170px; overflow:auto; background:#0d151e; padding:7px; }
      textarea { min-height:100px; font:11px/1.4 monospace; } .note { font-size:11px; color:#b7c7d9; }
      .error { color:#ffb5ac; } .coordinates { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; }
    `);
    const panel = element('aside');
    panel.setAttribute('aria-label', 'Cabinet API test panel');
    const header = element('header'), title = element('h2', 'Cabinet API · test'), collapse = element('button', 'Згорнути'), main = element('main');
    collapse.type = 'button';
    header.append(title, collapse);
    panel.append(header, main);
    shadow.append(style, panel);
    doc.body.append(host);
    const status = element('pre'), error = element('p');
    error.className = 'error';
    error.setAttribute('role', 'status');
    const note = element('p', 'Панель працює лише через ConfiguratorAPI. Відсутні правила не обходяться.');
    note.className = 'note';
    main.append(status, error, note);
    const button = (text, action, parent = main)=>{
        const node = element('button', text);
        node.type = 'button';
        parent.append(node);
        listen(node, 'click', ()=>run(action));
        return node;
    };
    const field = (text, node, parent = main)=>{
        const label = element('label', text);
        label.append(node);
        parent.append(label);
        return node;
    };
    const selectOptions = (node, rows, placeholder)=>{
        const selected = node.value;
        node.replaceChildren();
        const empty = element('option', placeholder);
        empty.value = '';
        node.append(empty);
        rows.forEach((row)=>{
            const option = element('option', row.label);
            option.value = row.value;
            node.append(option);
        });
        node.value = rows.some((row)=>row.value === selected) ? selected : '';
    };
    const refresh = button('Оновити API', ()=>connect());
    main.append(element('h3', 'Каталог і параметри'));
    const definition = field('Тумба', element('select')), parameters = element('div');
    main.append(parameters);
    const reset = button('Скинути параметри', async ()=>{
        choice.selection = {};
        await loadConfiguration();
    });
    const configReasons = element('pre');
    main.append(configReasons);
    const anchor = field('Anchor cabinet ID (необов’язково)', element('input'));
    const loadPositions = async ()=>{
        const generation = formGeneration;
        const result = await client.getPlacementOptions(choice, anchor.value.trim() || undefined);
        if (closed || generation !== formGeneration) return;
        options = result;
        optionsRevision = client.getState().context?.dependencies.compositionRevision;
        selectOptions(position, options.map((o)=>({
                value: o.id,
                label: `${o.kind} · ${o.mode} · ${o.availability}`
            })), 'Обери позицію');
        render(client.getState());
    };
    const positions = button('Отримати позиції', loadPositions);
    const position = field('Позиція', element('select')), positionInfo = element('pre');
    main.append(positionInfo);
    const standard = button('Додати Standard', async ()=>{
        await client.addStandard(choice, position.value);
        clearOptions();
    });
    const begin = button('Почати preview', async ()=>{
        if (optionsRevision !== client.getState().context?.dependencies.compositionRevision || !options.length) await loadPositions();
        const selected = options.find((option)=>option.id === position.value && option.availability === 'available');
        const initial = selected ?? options.find((option)=>option.availability === 'available');
        if (!initial) throw new Error(`No available initial placement: ${json(options.map((option)=>({
                id: option.id,
                reasons: option.reasons
            })))}`);
        return client.beginAdd(choice, {
            kind: 'option',
            optionId: initial.id
        });
    });
    main.append(element('h3', 'Draft / Apply / Cancel'));
    const draftNote = element('p', 'Preview: натисни й перетягни видиму нову тумбу на canvas. Відпускання лише оновлює preview; Apply зберігає позицію, Cancel прибирає draft. Координати нижче — ручне уточнення в метрах у frame.');
    draftNote.className = 'note';
    main.append(draftNote);
    const frame = field('Frame ID', element('input')), coords = element('div');
    coords.className = 'coordinates';
    main.append(coords);
    const axes = Object.fromEntries([
        'x',
        'y',
        'z'
    ].map((axis)=>{
        const input = element('input');
        input.type = 'number';
        input.step = '0.01';
        return [
            axis,
            field(axis, input, coords)
        ];
    }));
    const move = button('Оновити позицію draft', ()=>{
        const positionM = Object.fromEntries(Object.entries(axes).map(([axis, input])=>[
                axis,
                input.value.trim() === '' ? NaN : Number(input.value)
            ]));
        if (!frame.value.trim() || !Object.values(positionM).every(Number.isFinite)) throw new Error('Вкажи Frame ID і скінченні x/y/z.');
        return client.updateDraft({
            placement: {
                kind: 'free',
                frameId: frame.value.trim(),
                positionM
            }
        });
    });
    const apply = button('Apply', ()=>client.apply()), cancel = button('Cancel', ()=>client.cancel()), sessionInfo = element('pre'), draftStatus = element('p');
    draftStatus.setAttribute('role', 'status');
    main.append(draftStatus, sessionInfo);
    main.append(element('h3', 'Застосована композиція'));
    const cabinet = field('Cabinet ID', element('select'));
    const select = button('Вибрати тумбу', ()=>client.select(cabinet.value || null));
    const beginMove = button('Перемістити тумбу', ()=>client.beginMove(cabinet.value));
    const compositionInfo = element('pre');
    main.append(compositionInfo);
    main.append(element('h3', 'Snapshot'));
    const snapshot = element('textarea');
    snapshot.setAttribute('aria-label', 'Composition snapshot JSON');
    main.append(snapshot);
    const exportSnapshot = button('Експортувати snapshot', async ()=>{
        const result = await client.exportSnapshot();
        if (!closed) snapshot.value = json(result);
    });
    const restore = button('Відновити / замінити', async ()=>{
        const parsed = JSON.parse(snapshot.value);
        await client.restoreSnapshot(parsed.document ?? parsed);
        clearOptions();
    });
    let presetLibrary = null;
    try {
        if (win.localStorage) presetLibrary = createCabinetPresetLibrary({
            storage: win.localStorage
        });
    } catch  {}
    main.append(element('h3', 'Portable preset · exact layout'));
    const presetName = field('Назва пресета', element('input'));
    const presetJson = element('textarea');
    presetJson.setAttribute('aria-label', 'Portable preset JSON');
    main.append(presetJson);
    const presetSaved = field('Збережені пресети', element('select'));
    const portableConsent = element('input');
    portableConsent.type = 'checkbox';
    field('Підтверджую заміну всієї поточної композиції', portableConsent);
    const refreshSaved = ()=>selectOptions(presetSaved, presetLibrary?.list().map((name)=>({
                value: name,
                label: name
            })) ?? [], 'Обери збережений пресет');
    refreshSaved();
    const exportPreset = button('Зібрати portable preset', async ()=>{
        const result = await client.exportPreset(cabinet.value);
        if (!closed) presetJson.value = json(result);
    });
    const savePreset = button('Зберегти після перезапуску', ()=>{
        if (!presetLibrary) throw new Error('Browser storage unavailable');
        presetLibrary.save(presetName.value, JSON.parse(presetJson.value));
        refreshSaved();
    });
    const loadPreset = button('Завантажити пресет', ()=>{
        if (!presetLibrary) throw new Error('Browser storage unavailable');
        const stored = presetLibrary.get(presetSaved.value);
        if (!stored) throw new Error('Preset not found');
        presetJson.value = json(stored);
    });
    const importPreset = button('Відновити в цій композиції', async ()=>{
        if (!portableConsent.checked) throw new Error('Confirm composition replacement');
        portableConsent.checked = false;
        await client.importPreset(JSON.parse(presetJson.value));
        clearOptions();
    });
    listen(portableConsent, 'change', ()=>render(lastState));
    listen(presetJson, 'input', ()=>render(lastState));
    listen(presetName, 'input', ()=>render(lastState));
    main.append(element('h3', 'Діагностика'));
    const requestId = field('Request ID (невідомий результат команди)', element('input'));
    const lookup = button('Перевірити результат', async ()=>{
        reportOutput.value = json(await client.getCommandResult(requestId.value.trim()));
    });
    button('Експортувати звіт', ()=>exportReport());
    const reportOutput = element('textarea');
    reportOutput.readOnly = true;
    reportOutput.setAttribute('aria-label', 'Diagnostic JSON report');
    main.append(reportOutput);
    function clearOptions() {
        options = [];
        optionsRevision = null;
        selectOptions(position, [], 'Отримай актуальні позиції');
        positionInfo.textContent = '';
    }
    function render(state) {
        if (closed) return;
        lastState = state;
        const caps = state.capabilities, ready = state.status === 'ready' && caps?.readiness === 'ready', busy = state.pending.length > 0;
        const nextIdentity = `${caps?.apiInstanceId ?? ''}/${caps?.activeCompositionId ?? ''}`;
        if (identity !== nextIdentity) {
            identity = nextIdentity;
            formGeneration++;
            choice = {
                definitionId: '',
                selection: {}
            };
            configuration = null;
            parameters.replaceChildren();
            clearOptions();
            catalogKey = '';
            lastPoseKey = '';
            snapshot.value = '';
        }
        const revision = state.context?.dependencies.compositionRevision;
        if (optionsRevision !== null && optionsRevision !== revision) clearOptions();
        status.textContent = json({
            status: state.status,
            mode: caps?.mode ?? null,
            collection: caps?.collectionId ?? null,
            revision: revision ?? null,
            build: caps?.buildId ?? null,
            apiInstanceId: caps?.apiInstanceId ?? null,
            activation: caps?.activation ?? null,
            lastError: caps?.lastError ?? null,
            actions: caps?.actions ?? []
        });
        if (state.error) error.textContent = `${state.error.code}: ${state.error.message}\n${json(state.error.reasons)}`;
        const nextCatalog = json(state.catalog);
        if (nextCatalog !== catalogKey) {
            catalogKey = nextCatalog;
            selectOptions(definition, state.catalog.map((c)=>({
                    value: c.definitionId,
                    label: `${c.label ?? c.definitionId} · ${c.availability}`
                })), 'Обери тумбу');
        }
        const nextCabinets = json(state.cabinets?.cabinets ?? []);
        if (nextCabinets !== cabinetKey) {
            cabinetKey = nextCabinets;
            selectOptions(cabinet, (state.cabinets?.cabinets ?? []).map((c)=>({
                    value: c.id,
                    label: `${c.id} · ${c.definitionId}`
                })), 'Без вибору');
        }
        const can = (method)=>ready && client?.supports(method);
        const draft = state.session, active = !!state.composition?.activeSessionId || [
            'loading-draft',
            'preview',
            'applying'
        ].includes(draft?.lifecycle);
        const idle = state.composition?.status === 'ready' && !active;
        const selected = options.find((o)=>o.id === position.value);
        definition.disabled = !ready || busy || active;
        reset.disabled = !ready || busy || active || !choice.definitionId;
        for (const input of parameters.children)if (input.children?.[0]) input.children[0].disabled = !ready || busy || active;
        positions.disabled = !can('cabinets.getPlacementOptions') || busy || active || configuration?.completeness !== 'complete';
        standard.disabled = !can('cabinets.addStandard') || busy || !idle || selected?.availability !== 'available' || selected?.mode !== 'standard';
        begin.disabled = !can('cabinetPlacement.beginAdd') || busy || !idle || configuration?.completeness !== 'complete';
        move.disabled = !can('cabinetPlacement.updateDraft') || busy || draft?.lifecycle !== 'preview';
        apply.disabled = !can('cabinetPlacement.apply') || busy || !draft?.canApply;
        // Do not use the general busy flag here: Cancel may interrupt reversible Apply.
        cancel.disabled = !can('cabinetPlacement.cancel') || state.pending.includes('cancel') || !draft?.canCancel;
        select.disabled = !can('cabinets.select') || busy || !idle;
        beginMove.disabled = !can('cabinetPlacement.beginMove') || busy || !idle || !cabinet.value;
        exportSnapshot.disabled = !can('composition.exportSnapshot') || busy || state.composition?.status !== 'ready';
        restore.disabled = !can('composition.restoreSnapshot') || busy || !idle;
        exportPreset.disabled = !can('composition.exportPreset') || busy || !idle || !cabinet.value;
        importPreset.disabled = !can('composition.importPreset') || busy || !idle || !portableConsent.checked || !presetJson.value.trim();
        savePreset.disabled = !presetLibrary || busy || !presetJson.value.trim() || !presetName.value.trim();
        loadPreset.disabled = !presetLibrary || busy || !presetSaved.value;
        lookup.disabled = !can('composition.getCommandResult') || state.pending.includes('getCommandResult');
        refresh.disabled = busy;
        sessionInfo.textContent = json(draft ?? {
            draft: null
        });
        compositionInfo.textContent = json(state.cabinets ?? {
            cabinets: []
        });
        const draftIdentity = draft?.kind === 'move' ? `Move ${draft.productId ?? draft.candidate?.productId ?? 'unknown'}` : 'Add';
        draftStatus.textContent = draft ? `${draftIdentity} · Draft ${draft.lifecycle}; ${draft.canApply ? 'ready for Apply' : 'Apply unavailable'}; ${(draft.validation?.reasons ?? []).map((reason)=>reason.code ?? reason.message ?? String(reason)).join(', ') || 'no validation issues'}` : 'No active draft';
        positionInfo.textContent = selected ? json(selected) : '';
        const pose = draft?.candidate?.effectivePlacement, poseKey = json([
            draft?.sessionId,
            draft?.candidateRevision,
            pose
        ]);
        if (pose && poseKey !== lastPoseKey) {
            lastPoseKey = poseKey;
            frame.value = pose.frameId;
            for (const axis of [
                'x',
                'y',
                'z'
            ])axes[axis].value = String(pose.positionM[axis]);
        }
    }
    async function loadConfiguration() {
        clearOptions();
        const generation = ++formGeneration;
        const result = await client.getConfigurationOptions(choice);
        if (closed || generation !== formGeneration) return;
        configuration = result;
        configReasons.textContent = json({
            completeness: result.completeness,
            reasons: result.reasons
        });
        parameters.replaceChildren();
        for (const item of result.fields){
            const input = element('select');
            selectOptions(input, item.values.map((v, i)=>({
                    value: String(i),
                    label: `${v.value} · ${v.availability}`
                })), `Обери ${item.label}`);
            const index = item.values.findIndex((v)=>Object.hasOwn(choice.selection, item.key) && v.value === choice.selection[item.key]);
            input.value = index < 0 ? '' : String(index);
            field(`${item.label}${item.unit ? ' (' + item.unit + ')' : ''}`, input, parameters);
            // Removed controls own their listeners through the DOM, not the global disposer list.
            input.addEventListener('change', ()=>run(async ()=>{
                    if (input.value === '') delete choice.selection[item.key];
                    else choice.selection[item.key] = item.values[Number(input.value)].value;
                    await loadConfiguration();
                }));
        }
        render(client.getState());
    }
    async function run(action) {
        if (closed) return;
        error.textContent = '';
        try {
            return await action();
        } catch (cause) {
            if (!closed) {
                error.textContent = `${cause.code ?? 'UI_ERROR'}: ${cause.message}`;
            }
        } finally{
            if (!closed && client) render(client.getState());
        }
    }
    async function connect() {
        if (timer !== null) {
            win.clearTimeout(timer);
            timer = null;
        }
        await client.connect();
        if (closed) return;
        const status = client.getState().status;
        // Bounded startup-only retry. Stop permanently at ready/unsupported/error.
        if ([
            'missing',
            'initializing'
        ].includes(status) && ++attempts < 30) timer = win.setTimeout(()=>{
            timer = null;
            void run(connect);
        }, 500);
    }
    function exportReport() {
        const report = client.getReport();
        win.cabinetDebugReport = report;
        reportOutput.value = json(report);
        win.console?.info('[CabinetDebugReport]', report);
        return report;
    }
    listen(definition, 'change', ()=>run(async ()=>{
            choice = {
                definitionId: definition.value,
                selection: {}
            };
            configuration = null;
            if (choice.definitionId) await loadConfiguration();
            else {
                parameters.replaceChildren();
                clearOptions();
            }
        }));
    listen(position, 'change', ()=>render(lastState));
    listen(cabinet, 'change', ()=>render(lastState));
    listen(collapse, 'click', ()=>{
        main.hidden = !main.hidden;
        collapse.textContent = main.hidden ? 'Розгорнути' : 'Згорнути';
    });
    for (const event of [
        'pointerdown',
        'pointerup',
        'pointermove',
        'mousedown',
        'mouseup',
        'click',
        'touchstart',
        'touchmove',
        'touchend',
        'wheel',
        'keydown',
        'keyup'
    ]){
        listen(panel, event, (e)=>e.stopPropagation());
    }
    client = createCabinetAPIClient({
        getAPI: ()=>win.ConfiguratorAPI,
        onChange: render
    });
    const handle = {
        client,
        ready: null,
        exportReport,
        destroy () {
            if (closed) return;
            closed = true;
            formGeneration++;
            if (timer !== null) win.clearTimeout(timer);
            timer = null;
            client.destroy();
            for (const dispose of listeners.splice(0))dispose();
            parameters.replaceChildren();
            host.remove();
            owners.delete(win);
        }
    };
    listen(win, 'pagehide', ()=>handle.destroy());
    owners.set(win, handle);
    handle.ready = run(connect);
    return handle;
}

export { mountCabinetDebugPanel };
