import { stringify, createComponents } from './components.mjs';
import { presetsSection } from './sections/presets.mjs';
import { countertopSection } from './sections/countertop.mjs';
import { cabinetsSection } from './sections/cabinets.mjs';
import { urbanDuplexSection } from './sections/urban-duplex.mjs';
import { sidePanelsSection } from './sections/side-panels.mjs';

const DEFAULT_SECTIONS = Object.freeze([
    presetsSection,
    cabinetsSection,
    sidePanelsSection,
    urbanDuplexSection,
    countertopSection
]);
const REFRESH_MS = 500;
function isTestUIEnabled(win, flag = 'testUI') {
    try {
        return new URLSearchParams(win?.location?.search ?? '').get(flag) === '1';
    } catch  {
        return false;
    }
}
function mountTestUI({ window: win = globalThis.window, getAPI = ()=>win?.ConfiguratorAPI, sections = DEFAULT_SECTIONS, flag = 'testUI', force = false, refreshMs = REFRESH_MS } = {}) {
    if (!win?.document?.body || !force && !isTestUIEnabled(win, flag)) return null;
    const doc = win.document;
    let closed = false, timer = null;
    const entries = [];
    const log = (label, value)=>{
        if (closed) return;
        const line = `${new Date().toISOString().slice(11, 19)} ${label}${value === undefined ? '' : ` → ${stringify(value)}`}`;
        entries.unshift(line);
        if (entries.length > 40) entries.length = 40;
        logView.set(entries.join('\n'));
        logView.hidden = false;
    };
    const run = async (action, label = 'action')=>{
        try {
            const result = await action();
            if (result !== undefined && label !== 'Call') log(label, result);
            refresh();
            return result;
        } catch (error) {
            log(`✖ ${label}`, error);
            refresh();
            return undefined;
        }
    };
    const ui = createComponents(doc, {
        run
    });
    const host = ui.element('div');
    host.setAttribute('data-test-ui', '1');
    const shadow = host.attachShadow({
        mode: 'open'
    });
    shadow.append(ui.element('style', STYLE));
    const panel = ui.element('aside');
    panel.setAttribute('aria-label', 'Configurator test UI');
    const header = ui.element('header'), title = ui.element('h2', 'Test UI'), main = ui.element('main');
    const collapse = ui.button('Згорнути', ()=>{
        const hidden = main.hidden = !main.hidden;
        collapse.textContent = hidden ? 'Розгорнути' : 'Згорнути';
    });
    header.append(title, collapse);
    const apiStatus = ui.element('p', '', 'note');
    const logView = ui.readout('Log');
    logView.hidden = true; // shown with the first entry
    main.append(apiStatus);
    panel.append(header, main);
    shadow.append(panel);
    doc.body.append(host);
    const releaseInput = isolateInput(host, win);
    const mounted = [];
    for (const section of sections){
        const block = ui.element('section');
        block.dataset.section = section.id;
        const heading = ui.element('h3', section.title);
        const body = ui.element('div');
        block.dataset.open = 'true';
        ui.listen(heading, 'click', ()=>{
            body.hidden = !body.hidden;
            block.dataset.open = String(!body.hidden);
        });
        block.append(heading, body);
        main.append(block);
        try {
            const handle = section.mount({
                api: getAPI,
                ui,
                log,
                refresh: ()=>refresh(),
                root: body
            }) ?? {};
            mounted.push(handle);
        } catch (error) {
            body.append(ui.element('p', `Section failed: ${stringify(error)}`, 'error'));
        }
    }
    main.append(logView);
    function refresh() {
        if (closed) return;
        const api = getAPI();
        apiStatus.textContent = api ? `ConfiguratorAPI: ${Object.keys(api).length} keys` : 'ConfiguratorAPI: not available yet';
        for (const handle of mounted){
            try {
                handle.refresh?.();
            } catch (error) {
                log('✖ refresh', error);
            }
        }
    }
    refresh();
    if (refreshMs > 0 && typeof win.setInterval === 'function') timer = win.setInterval(refresh, refreshMs);
    return Object.freeze({
        host,
        log,
        refresh,
        destroy () {
            if (closed) return;
            closed = true;
            if (timer) win.clearInterval?.(timer);
            for (const handle of mounted){
                try {
                    handle.dispose?.();
                } catch  {}
            }
            releaseInput();
            ui.dispose();
            host.remove?.();
        }
    });
}
/**
 * Keeps panel input away from the 3D scene. The engine's mouse / keyboard listen on `window`
 * (bubble phase), so stopping propagation at the host means the camera does not zoom on a panel
 * scroll, a click in the panel does not select / deselect in the scene, and typing does not fire
 * scene hotkeys. Native behaviour stays (the panel still scrolls; no preventDefault).
 * A gesture that started on the canvas keeps its moves / release even over the panel, so an orbit
 * or a drag never gets stuck; moves / releases are swallowed only for presses that began in the panel.
 */ const ALWAYS = [
    'wheel',
    'mousedown',
    'pointerdown',
    'touchstart',
    'click',
    'dblclick',
    'contextmenu',
    'keydown',
    'keyup',
    'keypress'
];
const PRESSES = [
    'mousedown',
    'pointerdown',
    'touchstart'
];
const MOVES = [
    'mousemove',
    'pointermove',
    'touchmove'
];
const RELEASES = [
    'mouseup',
    'pointerup',
    'touchend',
    'pointercancel',
    'touchcancel'
];
function isolateInput(host, win = globalThis.window) {
    let pressedInside = false;
    const stop = (event)=>event.stopPropagation?.();
    const press = (event)=>{
        pressedInside = true;
        stop(event);
    };
    // Moves with no button held (hover) are swallowed too; moves of a canvas-started gesture pass through.
    const follow = (event)=>{
        if (pressedInside || !(event.buttons > 0)) stop(event);
    };
    const reset = ()=>{
        if (pressedInside) win?.setTimeout?.(()=>{
            pressedInside = false;
        }, 0);
    };
    const release = (event)=>{
        if (pressedInside) stop(event);
    };
    const bindings = [
        ...ALWAYS.map((type)=>[
                host,
                type,
                PRESSES.includes(type) ? press : stop
            ]),
        ...MOVES.map((type)=>[
                host,
                type,
                follow
            ]),
        ...RELEASES.map((type)=>[
                host,
                type,
                release
            ]),
        // A press that began in the panel may end anywhere: forget it after that release is dispatched.
        ...RELEASES.map((type)=>[
                win,
                type,
                reset,
                true
            ])
    ];
    for (const [target, type, fn, capture] of bindings)target?.addEventListener?.(type, fn, capture ? {
        capture: true
    } : {
        passive: true
    });
    return ()=>{
        for (const [target, type, fn, capture] of bindings)target?.removeEventListener?.(type, fn, capture ? {
            capture: true
        } : {
            passive: true
        });
    };
}
const STYLE = `
  :host { position: fixed; top: 12px; left: 12px; z-index: 10000; width: min(340px, calc(100vw - 24px));
    color: #e8edf5; font: 12px/1.35 system-ui, sans-serif; color-scheme: dark; }
  * { box-sizing: border-box; }
  aside { background: #16202bf0; border: 1px solid #45556a; border-radius: 8px; padding: 8px 10px; box-shadow: 0 6px 24px #0006; }
  header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  h2 { font-size: 13px; margin: 0; letter-spacing: .02em; }
  main { max-height: calc(100vh - 80px); overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain; padding-right: 4px; scrollbar-gutter: stable; }
  [hidden] { display: none !important; }
  section { margin-top: 6px; }
  h3 { font-size: 12px; margin: 6px 0 4px; padding: 3px 0; cursor: pointer; user-select: none; border-bottom: 1px solid #38475a; }
  h3::before { content: '▾ '; color: #8dd5ff; }
  section[data-open="false"] h3::before { content: '▸ '; }
  .row { display: flex; gap: 4px; align-items: center; flex-wrap: wrap; margin: 2px 0; }
  .row > input, .row > select { flex: 1 1 50px; min-width: 50px; }
  label { display: block; margin: 3px 0; }
  .field { display: grid; grid-template-columns: 92px minmax(0, 1fr); align-items: center; gap: 6px; }
  .field > span { color: #b7c7d9; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .field > .row { margin: 0; flex-wrap: nowrap; min-width: 0; }
  .field > .row > input, .field > .row > select, .field > select { min-width: 0; }
  details.group { margin: 4px 0 6px; padding: 2px 0 4px 8px; border-left: 2px solid #2f4054; }
  details.group > summary { cursor: pointer; user-select: none; list-style: none; font-size: 10px; text-transform: uppercase;
    letter-spacing: .06em; color: #8fa3ba; padding: 2px 0; }
  details.group > summary::-webkit-details-marker { display: none; }
  details.group > summary::before { content: '▸ '; }
  details.group[open] > summary::before { content: '▾ '; }
  details.group[open] > summary { margin-bottom: 2px; }
  .toggle { display: flex; align-items: center; gap: 6px; }
  .toggle input { width: auto; margin: 0; }
  input, select, textarea, button { font: inherit; border: 1px solid #55667b; border-radius: 4px; background: #202e3d; color: inherit; padding: 3px 6px; max-width: 100%; }
  input:not([type=checkbox]), select, textarea { display: block; width: 100%; }
  input[type=number] { text-align: right; }
  textarea { font: 11px/1.4 monospace; margin-top: 2px; }
  button { cursor: pointer; white-space: nowrap; }
  button:hover { background: #2a3b4e; }
  button:disabled { opacity: .45; cursor: default; }
  button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid #8dd5ff; outline-offset: 0; }
  pre { white-space: pre-wrap; word-break: break-word; font-size: 11px; max-height: 120px; overflow: auto; background: #0d151e; padding: 6px; margin: 2px 0; border-radius: 4px; }
  .caption { font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: #8fa3ba; margin: 8px 0 2px; }
  .note { font-size: 11px; color: #b7c7d9; margin: 2px 0; }
  .error { color: #ffb5ac; }
`;

export { DEFAULT_SECTIONS, isTestUIEnabled, isolateInput, mountTestUI };
