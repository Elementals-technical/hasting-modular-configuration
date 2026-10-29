# Verified commands

Each command was run in this checkout (macOS 26.2, arm64) on the date shown. Command ownership: `ai/AGENTS.md` › Commands; this file only records runs. Windows: not locally executed.

## Repository (run from the repo root)

Node: prefix `PATH` with the nvm install `~/.nvm/versions/node/v20.19.2/bin` (in range for vite/jsdom/vitest). Default `node` 23.1.0 is outside vitest/jsdom engines (the single test below also passed on it, but do not rely on that). `/opt/homebrew/opt/node@22` is a symlink to 23.1.0, not Node 22.

| Date | Command | Result | Side effects |
|---|---|---|---|
| 2026-10-28 | `npx vitest run src/entities/collection/__tests__/reasonCodesHaveMessages.test.ts` | exit 0, 19/19 passed, ~3 s | none observed |
| 2026-10-28 | same + `-t "USH"` | exit 0, 2 passed / 17 skipped | none |
| 2026-10-28 | `npx eslint src/entities/product/lib/cabinetTypeLimits.ts` | exit 0 (stderr note: `baseline-browser-mapping` data is old) | none |
| 2026-10-28 | `npx prettier --check src/entities/product/lib/cabinetTypeLimits.ts` | exit 0 | none |
| 2026-10-28 | `npm run tsc` (`tsc -b`) | exit 0, ~10 s | rewrites `node_modules/.tmp/tsconfig.{app,node}.tsbuildinfo` (ignored) |
| 2026-10-28 | `npx playwright test …` | NOT RUN: `~/Library/Caches/ms-playwright` absent; `npx playwright install` downloads browsers → needs user approval | — |

`git status` was identical before and after these runs.

## Personal tooling (`S=.agents/skills/local-maintain-agent-guidance/scripts`)

| Date | Command | Result |
|---|---|---|
| 2026-10-28 | `node $S/ai-env.mjs sync` / `check-sync` | 10 wrappers written / ok |
| 2026-10-28 | `node $S/ai-env.mjs collisions` · `--all-remotes` | none (3 refs) · none (93 refs) |
| 2026-10-28 | `node $S/mcp-smoke.mjs --server firefox-devtools --scenario docs/ai/qa/scenarios/smoke-firefox.json --out …` | all 10 tool steps ok |
| 2026-10-28 | `node $S/mcp-smoke.mjs --server chrome-devtools --scenario docs/ai/qa/scenarios/smoke-chrome.json --out …` | all 11 tool steps ok |
| 2026-10-28 | `/usr/bin/python3 -I $S/extract-docx.py <id> <docx> <out> [media]` | 13 DOCX normalized; 103/103 handoff comment anchors match |
| 2026-10-28 | `/usr/bin/python3 -I $S/extract-xlsx.py <id> <xlsx> <out>` | 14 XLSX normalized |

Python: use `/usr/bin/python3` on this Mac — Homebrew `python3` lacks `pyexpat` (XML parsing fails).

## Later runs (2026-10-28)

| Command | Result |
|---|---|
| `node $S/mcp-smoke.mjs --server chrome-devtools --serve <state.json>` + `--via <state.json> --scenario … --out …` + `--via <state.json> --stop` | one Chrome approval for ~40 scenarios; loopback-only, token file mode 0600 |
| `node $S/validate-guidance.mjs` / `test-routing.mjs` / `test-tooling.mjs` / `qa-coverage.mjs` | see final report |
| `gh api repos/Elementals-technical/hasting-data-modular-review/branches` | branch is `analysis/products-data` (not `analysis`); `contents/…?ref=<sha>` with `Accept: application/vnd.github.raw` fetches files read-only |
| `curl -sI https://<staging>/collections/urban-low-height/sku-profile.json` | `cache-control: no-cache`, `last-modified: 1980` (HO-001) |

zsh pitfalls met: `path` is tied to `PATH` (never use it as a variable); a bare `===` word is `=`-expanded (quote it); use `pipestatus`, not `PIPESTATUS`.
