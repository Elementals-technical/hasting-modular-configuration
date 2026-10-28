/**
 * Test UI — building blocks. Plain DOM, no framework, no project imports. Every control is built
 * from `doc` (the host document) so the module runs in a browser and in a Node fake alike.
 *
 * `createComponents(doc, { run })` → helpers bound to one document. `run(fn)` executes an action
 * (sync or async), reports errors/results to the panel log and never throws into the DOM.
 * The cabinet sections share their error slugs and client helpers from the bottom of this file.
 */
export function createComponents(doc, { run }) {
    const element = (tag, text = '', className = '') => {
        const node = doc.createElement(tag);
        if (text) node.textContent = text;
        if (className) node.className = className;
        return node;
    };
    const listeners = [];
    const listen = (node, type, callback) => {
        node.addEventListener(type, callback);
        listeners.push(() => node.removeEventListener?.(type, callback));
    };
    const row = (...children) => { const node = element('div', '', 'row'); node.append(...children); return node; };
    const button = (label, action, { title = '' } = {}) => {
        const node = element('button', label);
        node.type = 'button';
        if (title) node.title = title;
        listen(node, 'click', () => run(action, label));
        return node;
    };
    const toggle = (label, { get, set }) => {
        const node = element('label', '', 'toggle'), input = element('input');
        input.type = 'checkbox';
        node.append(input, doc.createTextNode(label));
        listen(input, 'change', () => run(() => set(input.checked), label));
        return Object.assign(node, { refresh() { try { input.checked = Boolean(get()); } catch { /* unreadable */ } } });
    };
    /** Numeric input + −/+ buttons; `apply(value)` runs on every change. */
    const stepper = (label, { get, apply, step, min = -Infinity, max = Infinity, digits = 3 }) => {
        const input = element('input'), wrap = element('label', '', 'stepper');
        input.type = 'number'; input.step = String(step);
        const clamp = v => Math.min(max, Math.max(min, v));
        const commit = value => run(() => apply(clamp(value)), label);
        const current = () => { const v = Number(input.value); return Number.isFinite(v) ? v : (Number(get()) || 0); };
        const minus = button('−', () => commit(current() - step)), plus = button('+', () => commit(current() + step));
        listen(input, 'change', () => commit(Number(input.value)));
        input.placeholder = '—';
        wrap.className = 'field';
        wrap.append(element('span', label), row(minus, input, plus));
        return Object.assign(wrap, { refresh() { try { const v = get(); if (Number.isFinite(v)) input.value = Number(v).toFixed(digits); } catch { /* unreadable */ } } });
    };
    const select = (label, options, { get, set }) => {
        const node = element('label', '', 'field'), input = element('select');
        for (const option of options) { const o = element('option', option.label ?? option.value); o.value = option.value; input.append(o); }
        node.append(element('span', label), input);
        listen(input, 'change', () => run(() => set(input.value), label));
        return Object.assign(node, { input, refresh() { try { const v = get(); if (v != null) input.value = String(v); } catch { /* unreadable */ } } });
    };
    /** Free-text value with suggestions (datalist) + Apply; `apply(value)` runs on Apply / Enter. */
    let listSeq = 0;
    const textInput = (label, { suggestions = [], apply, placeholder = '' }) => {
        const wrap = element('label', '', 'field'), input = element('input'), list = element('datalist');
        list.id = `test-ui-list-${++listSeq}`;
        for (const value of suggestions) { const o = element('option'); o.value = value; list.append(o); }
        input.setAttribute('list', list.id);
        input.placeholder = placeholder;
        const commit = () => run(() => apply(input.value.trim()), label);
        listen(input, 'keydown', event => { if (event?.key === 'Enter') commit(); });
        wrap.append(element('span', label), row(input, button('Apply', commit)), list);
        return Object.assign(wrap, { input });
    };
    const textarea = (label, { value = '', rows = 6 } = {}) => {
        const node = element('label'), input = element('textarea');
        input.rows = rows; input.value = value;
        node.append(doc.createTextNode(label), input);
        return Object.assign(node, { input });
    };
    const readout = (label = '') => {
        const node = element('div', '', 'readout'), pre = element('pre');
        if (label) node.append(element('div', label, 'caption'));
        node.append(pre);
        return Object.assign(node, { set(value) { pre.textContent = typeof value === 'string' ? value : stringify(value); } });
    };
    const note = text => element('p', text, 'note');
    /** Collapsible sub-section (native <details>): `group('Width', [controls…], { open })`. */
    const group = (title, children = [], { open = true } = {}) => {
        const node = element('details', '', 'group'), summary = element('summary', title);
        node.open = open;
        node.append(summary, ...children.filter(Boolean));
        return node;
    };
    /**
     * Generic method caller for an API namespace: a select of its functions, a JSON args field,
     * a Call button. Lets every API method be exercised without a dedicated control.
     */
    const methods = (label, getNamespace, { log }) => {
        const wrap = element('div', '', 'methods'), pick = element('select'), args = element('input');
        args.placeholder = '[args] JSON';
        args.title = 'Arguments as a JSON array, e.g. [{"x":0.1,"y":0}]';
        const refresh = () => {
            const ns = getNamespace();
            const names = ns ? Object.keys(ns).filter(key => typeof ns[key] === 'function').sort() : [];
            const selected = pick.value;
            pick.replaceChildren();
            for (const name of names) { const o = element('option', name); o.value = name; pick.append(o); }
            if (names.includes(selected)) pick.value = selected;
        };
        const call = button('Call', async () => {
            const ns = getNamespace(), name = pick.value;
            if (!ns || typeof ns[name] !== 'function') throw new Error(`${label}.${name} is not a function`);
            const parsed = args.value.trim() ? JSON.parse(args.value) : [];
            if (!Array.isArray(parsed)) throw new Error('args must be a JSON array');
            const result = await ns[name](...parsed);
            log(`${label}.${name}(${args.value.trim()})`, result);
            return result;
        });
        wrap.append(element('div', label, 'caption'), row(pick, args, call));
        refresh();
        return Object.assign(wrap, { refresh });
    };
    return Object.freeze({ element, listen, row, button, toggle, stepper, select, textInput, textarea, readout, note, group, methods,
        dispose() { for (const off of listeners.splice(0)) { try { off(); } catch { /* best effort */ } } } });
}

export function stringify(value) {
    if (value === undefined) return 'undefined';
    // Errors as slugs only: the code + reason codes; the message only when there is no code at all.
    if (value instanceof Error || (value && typeof value === 'object' && 'code' in value && 'message' in value)) {
        const reasons = (value.reasons ?? []).map(r => r?.code).filter(Boolean).filter(code => code !== value.code);
        return value.code ? [value.code, ...reasons].join(' · ') : String(value.message);
    }
    try { return JSON.stringify(value, (key, v) => typeof v === 'number' ? Number(v.toFixed(4)) : v, 2); }
    catch { return String(value); }
}

// --- Cabinet sections (sections/cabinets.mjs, sections/urban-duplex.mjs) ----------------------------
// Still no project import: each section passes in `api` and its own cabinet client (cabinet-api-client.mjs).

/** An error that carries a slug code, e.g. `failure('NOTHING_SELECTED')`; `reasons` = `[{ code }]` as the API returns them. */
export function failure(code, reasons = []) {
    return Object.assign(new Error(code), { code, reasons });
}

/**
 * Any thrown error → an Error whose message is its slug `CODE · REASON_CODE…` (code and reasons kept).
 * Example: `{ code: 'CATALOG_UNSUPPORTED', reasons: [{ code: 'FOREIGN_COLLECTION' }] }` → 'CATALOG_UNSUPPORTED · FOREIGN_COLLECTION'.
 */
export function slug(error) {
    const reasons = error?.reasons ?? [];
    const codes = [error?.code ?? 'ERROR', ...reasons.map(reason => reason?.code).filter(Boolean)];
    return Object.assign(new Error(codes.join(' · ')), { code: codes[0], reasons });
}

/** How often a section retries connecting its cabinet client while the modular runtime is not ready. */
const CABINETS_RECONNECT_MS = 3000;

/**
 * Helpers bound to the live API (`api()`) and one cabinet client:
 *   need(name)          → the API when it has the method `name`; throws UNSUPPORTED_METHOD otherwise;
 *   connectReady()      → connects the client; throws CABINETS_<STATUS> (e.g. CABINETS_UNAVAILABLE) unless it is ready;
 *   selectedCabinetId() → the cabinet selected in the scene (SelectTool), or null;
 *   keepConnected()     → call it from the section's refresh: the modular runtime appears with a modular
 *                         composition, so the client (re)connects while not ready, at most every 3 s.
 */
export function cabinetSectionHelpers(api, client) {
    const need = name => {
        const target = api();
        if (typeof target?.[name] !== 'function') throw failure('UNSUPPORTED_METHOD');
        return target;
    };
    const connectReady = async () => {
        await client.connect();
        const status = client.getState().status;
        if (status !== 'ready') throw failure(`CABINETS_${String(status).toUpperCase()}`);
    };
    const selectedCabinetId = () => {
        try { return api()?.getSelectionInfo?.()?.[0]?.productId ?? null; } catch { return null; }
    };
    let connecting = false;
    let lastConnectMs = 0;
    const keepConnected = () => {
        const now = Date.now();
        // A connect is in flight, the runtime is ready, or the last try was less than 3 s ago: nothing to do.
        if (connecting || client.getState().status === 'ready' || now - lastConnectMs <= CABINETS_RECONNECT_MS) return;
        connecting = true;
        lastConnectMs = now;
        client.connect().catch(() => {}).finally(() => { connecting = false; });
    };
    return Object.freeze({ need, connectReady, selectedCabinetId, keepConnected });
}
