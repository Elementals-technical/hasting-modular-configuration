# Browser MCP runbook — macOS and Windows

Scope: Claude Code, MCP servers registered at **local scope** for this repository path (`~/.claude.json` → `projects["<repo>"]`), so they load only when Claude runs with the repository root as its working directory/workspace. Pinned versions below passed the smoke test on the date shown; update only after re-running the smoke test.

## Verified state

| OS | Host | Browser | MCP | Session reuse | Tools verified | Result |
|---|---|---|---|---|---|---|
| macOS 26.2 arm64 | Claude Code 2.1.312 (VS Code) | Chrome 156.0.8078.73 | `chrome-devtools-mcp@1.12.0` | yes — user's running Chrome via `--autoConnect`, user enabled remote debugging and allowed the connection (2026-10-28) | list_pages, new_page, navigate_page (url/back), take_snapshot, take_screenshot, list_console_messages, list_network_requests, evaluate_script, close_page | PASS 2026-10-28 |
| macOS 26.2 arm64 | same | Firefox 147.0.3 | `@mozilla/firefox-devtools-mcp@0.10.7` | dedicated persistent profile (no personal profile) | list_pages, new_page, navigate_page, navigate_history, take_snapshot, screenshot_page, list_console_messages, list_network_requests | PASS 2026-10-28 |
| Windows | — | — | same pins | — | — | **not locally executed** |

Firefox 147 limits: the MCP's `script`/`debugging` modules need Firefox ≥ 153 and `profiler` ≥ 154, so they are not enabled (no `evaluate_script` in Firefox). Updating Firefox is the user's decision.

Smoke evidence: `docs/ai/qa/evidence/2026-10-28/smoke-chrome/`, `…/smoke-firefox/`. Smoke scenarios: `docs/ai/qa/scenarios/smoke-*.json`.

## macOS setup (as executed)

```sh
cd <repo>
claude mcp add -s local chrome-devtools -e CHROME_DEVTOOLS_MCP_NO_UPDATE_CHECKS=1 -- \
  npx -y chrome-devtools-mcp@1.12.0 --autoConnect --no-usage-statistics --redactNetworkHeaders
claude mcp add -s local firefox-devtools -- \
  npx -y @mozilla/firefox-devtools-mcp@0.10.7 \
  --profile-path ~/.local/share/ai-env/hastings-modular-configuration/firefox-profile \
  --tools pages snapshot input screenshot console network downloads utilities
```

Note: `-e` is variadic — put the server name before `-e`. Then in Chrome open `chrome://inspect/#remote-debugging`, enable it, and allow the connection prompt. Restart the Claude session in the repository root to load the tools.

## Windows setup (not locally executed)

Prerequisites: Node ≥ 20.19 on PATH (`node -v`), Chrome ≥ 144, Firefox (≥ 153 to also enable `script`).

```powershell
cd <repo>
claude mcp add -s local chrome-devtools -e CHROME_DEVTOOLS_MCP_NO_UPDATE_CHECKS=1 -- cmd /c npx -y chrome-devtools-mcp@1.12.0 --autoConnect --no-usage-statistics --redactNetworkHeaders
claude mcp add -s local firefox-devtools -- cmd /c npx -y @mozilla/firefox-devtools-mcp@0.10.7 --profile-path "%LOCALAPPDATA%\ai-env\hastings-modular-configuration\firefox-profile" --tools pages snapshot input screenshot console network downloads utilities
```

`cmd /c` avoids the "npx is not a Win32 application" spawn failure. `--autoConnect` reads `DevToolsActivePort` from the stable channel user-data dir (`%LOCALAPPDATA%\Google\Chrome\User Data`). The tooling scripts (`ai-env.mjs`, `mcp-smoke.mjs`, validators) are plain Node and use `%LOCALAPPDATA%\ai-env\…` as the store on Windows; `mcp-smoke.mjs` wraps `npx` in `cmd /c` automatically. The Python extractors need a Python 3 with `xml.etree` (python.org build).

## Smoke test (both OS)

```sh
node .agents/skills/local-maintain-agent-guidance/scripts/mcp-smoke.mjs --server chrome-devtools --list-tools
node .agents/skills/local-maintain-agent-guidance/scripts/mcp-smoke.mjs --server chrome-devtools  --scenario docs/ai/qa/scenarios/smoke-chrome.json  --out docs/ai/qa/evidence/<date>/smoke-chrome
node .agents/skills/local-maintain-agent-guidance/scripts/mcp-smoke.mjs --server firefox-devtools --scenario docs/ai/qa/scenarios/smoke-firefox.json --out docs/ai/qa/evidence/<date>/smoke-firefox
```

Pass = every step `ok`, a rendered configurator screenshot, console without application errors, network without 4xx/5xx from the app. Record OS, host, browser and MCP versions, consent, session reuse, tools, blocker in the table above.

## Failure handling

- Chrome: "Could not connect to Chrome" → remote debugging not enabled or the prompt was not allowed; one retry after the user enables it. Managed policy `RemoteDebuggingAllowed=0` → blocker, do not work around it. Fallback (with consent only): a separate work profile started with `--user-data-dir=<dedicated dir> --remote-debugging-port=9222` and `--browser-url=http://127.0.0.1:9222`.
- Firefox: profile lock → another Firefox uses the profile; close only the agent's Firefox window. `--connect-existing` works only if Firefox was started with `--marionette --remote-debugging-port`.
