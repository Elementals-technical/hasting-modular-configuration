# Browser validation runbook

Used by the UI gate (`.agents/skills/local-implement-change/references/ui-regression.md`) and by debugging. Configuration and per-OS setup: `../env/windows-mac-mcp-runbook.md`.

## Controller and session

- One controller per session: Chrome DevTools MCP (`chrome-devtools`) first; Firefox DevTools MCP (`firefox-devtools`) for cross-browser checks. Do not drive one browser from two agents.
- Chrome attaches with `--autoConnect` to the user's running Chrome (remote debugging enabled by the user in `chrome://inspect/#remote-debugging`; Chrome asks the user to allow each connection). Never use the default profile with `--remote-debugging-port`, never copy cookies/profiles/tokens.
- Work only in agent-owned tabs: open a new tab (`new_page`), or reuse a tab whose URL is on the staging host (agent-owned by convention). Never close, reload or navigate the user's other tabs.
- Firefox runs its own persistent profile (`--profile-path` in the store, see runbook); the user signs in there if a test needs it.
- If native MCP tools are not loaded in the session, run the same calls through `node .agents/skills/local-maintain-agent-guidance/scripts/mcp-smoke.mjs --server <name> --scenario <json> --out <dir>` (real tool calls through the registered server; scenarios in `scenarios/`). Chrome asks the user to allow every new DevTools connection, so for a series start one session (`--serve <state.json>`, background), run scenarios with `--via <state.json>`, and finish with `--via <state.json> --stop`.

## Targets

| URL class | Use |
|---|---|
| Phase 2 staging `https://hasting-modular-phase-2-staging-ar3wz.ondigitalocean.app` | default for baseline and reproduction |
| Phase 2 `https://hasting-modular-phase-2-p98qb.ondigitalocean.app` | read-only comparison only |
| Local `http://localhost:5173` (`npm run dev`, Node 20.19+) | any code change before it is deployed |
| Old modular production (`…v3aur…`, `hastings-modular.vivid3d.tech`) | read-only baseline of the old line; never mixed with Phase 2 results |

Entry: `/prebuilt/model?collectionId=<id>` or the custom builder route; ids: `urban-standard-height` (default), `urban-low-height`, `urban-duplex`, `urban-freestanding`, `class`, `tricot`, `mako`, `lame`. `collectionId` is read once per load: switching family needs a full navigation. Build identity: the `index-*.js` hash in the page source (see `../env/environment-branch-map.md`).

## Read-only rules

- The Summary page saves the configuration by itself (POST `/modular/configurations/store`, HO-002), so in Chrome every staging navigation carries `scenarios/lib/write-guard.js` as `initScript` (blocks non-GET in the agent tab; check `window.__blockedWrites`). Firefox has no init-script tool: do not open Summary there.
- Collection JSON may be served stale from the browser cache (HO-001); add `scenarios/lib/collections-nocache.js` to simulate a fresh user and record the harness in `environment_build_viewport`.
- Allowed: navigation, selections, drag/resize in the scene, undo/redo, summary (guarded), PDF download.
- Stop and ask before: Save configuration, Share (creates a stored configuration), Quote / How-to-Buy submit (HubSpot form), anything that POSTs to the backend. Show what would be sent.
- Price lookups the app performs itself (GET `pricing-v2/resolve`) are fine; an independent check may repeat the same GET.

## What to capture per TC

1. Start from a fresh load of the target URL; dismiss the walkthrough only via its Skip/close button.
2. After each significant step: `take_snapshot` (UI state), `take_screenshot` (same viewport; for 3D keep the default camera unless the TC defines another), and for scene state a read-only `evaluate_script` (e.g. reading the configurator API state exposed on the iframe window) — never call setters from the script.
3. `list_console_messages` (errors/warnings; known noise: `ConfiguratorAPI.* not ready` during load, Firefox `__cf_bm` cookie domain) and `list_network_requests` (status ≥ 400, `pricing-v2/resolve` SKUs). Headers are redacted by the server (`--redactNetworkHeaders`); never paste tokens.
4. 3D checks: mesh presence and position, materials/textures, z-fighting, clipping, wrong model per selection, failed asset loads in network. Pixel diff is never the only oracle.
5. Save evidence under `evidence/<date>/<TC_ID>/` and index it in `test-evidence-index.csv`; record the row in `ui-test-matrix.csv`.

## Report

Browser and version, URL class, build hash, viewport, TC ids, observed vs expected, evidence paths, not-run items with reason. A failed or blocked step is reported as such; "could not reproduce" is never "fixed".
