/**
 * PlayCanvas local bridge for the UI (loaded by the PlayCanvas export's index.html BEFORE js/index.mjs).
 *
 * `?local=true` on the UI page (or on the iframe itself) takes the PlayCanvas scripts from the developer's local
 * server — `node tools/server.js` in the PlayCanvas repo, https://localhost:3000 — instead of this export, like
 * `launch.playcanvas.com/…?local=true` does. Without the parameter nothing changes.
 *
 * - The engine's `Asset.prototype.getFileUrl` is patched before the app starts, so every ESM script asset
 *   (`js/esm-scripts/Scripts/…`) that exists locally is loaded from `<root>/src/Scripts/…`; its relative imports then
 *   resolve on the local server too. Files the local server does not have stay on the export.
 * - The local files are read from `/file-list` (full paths); an older server.js has only `/file-map` (keyed by file
 *   name: files sharing a name then stay on the export).
 * - `?localRoot=https://localhost:3001` points to another local server.
 */
import { Asset } from 'playcanvas';

const query = new URLSearchParams(location.search);
try {
    // The UI page around the iframe (same origin): its parameters count too.
    if (window.parent !== window) {
        new URLSearchParams(window.parent.location.search).forEach((value, key) => {
            if (!query.has(key)) query.set(key, value);
        });
    }
} catch {
    /* a cross-origin parent: only the iframe's own parameters */
}

if (query.get('local') === 'true') {
    const root = (query.get('localRoot') || 'https://localhost:3000').replace(/\/+$/, '');
    const paths = readLocalPaths(root);
    if (!paths) {
        console.error(`[local-bridge] ${root} is not reachable (is "node tools/server.js" running?) — scripts come from this export`);
    } else {
        // One stamp per page load: the same asset always gets the same URL (no second module instance).
        const stamp = Date.now();
        const getFileUrl = Asset.prototype.getFileUrl;
        const overridden = new Set();
        Asset.prototype.getFileUrl = function (...args) {
            const url = getFileUrl.apply(this, args);
            const path = this.type === 'script' ? /esm-scripts\/(Scripts\/[^?#]+\.mjs)/.exec(url || '')?.[1] : null;
            if (!path || !paths.has(path)) return url;
            overridden.add(path);
            return `${root}/src/${path}?t=${stamp}`;
        };
        window.__localBridge = { root, localFiles: paths.size, overridden };
        console.log(`%c[local-bridge] scripts from ${root} (${paths.size} local files)`, 'background:#222;color:#bada55');
    }
}

/** Set of paths relative to the server's src (`Scripts/…`), or null when the server does not answer. */
function readLocalPaths(root) {
    for (const endpoint of ['/file-list', '/file-map']) {
        try {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', root + endpoint, false); // synchronous: the app must not start before the patch
            xhr.send(null);
            if (xhr.status !== 200) continue;
            const body = JSON.parse(xhr.responseText);
            return new Set(Array.isArray(body) ? body : Object.values(body));
        } catch {
            /* try the next endpoint */
        }
    }
    return null;
}
