# Frontend verification (narrow first)

The command list is owned by `ai/AGENTS.md` › Commands; this file adds only what was verified locally. Log of runs: `docs/ai/verified-commands.md`.

## Node version

Run repository commands with a Node inside the declared engines (vite and jsdom need `^20.19 || ^22.13 || >=24`). On this Mac the default `node` is 23.1.0 (out of range; `/opt/homebrew/opt/node@22` is a symlink to 23), so prefix the PATH with the nvm 20.19.2 install. Windows: use nvm-windows/fnm with 20.19+ or 22.13+ (not locally executed).

## Order

1. One test file: `npx vitest run <path>`; one test: add `-t "<name>"`.
2. Neighbour tests from the dependency graph (same feature folder, pricing regressions for SKU/price changes, boundary tests for scene/collection changes).
3. Lint and format only changed files: `npx eslint <files>`, `npx prettier --check <files>`.
4. Types when signatures/types changed: `npm run tsc` (≈10 s; writes only `node_modules/.tmp/*.tsbuildinfo`).
5. Full `npm test`, `npm run build` and whole-repo lint only when `ai/AGENTS.md` › Definition of done requires them or the user asks.

## E2E (Playwright, ULH project only)

`npx playwright test <spec>`; default `E2E_MODE=dev` starts `npm run dev` on port 5173 (`E2E_PORT`); `E2E_BASE_URL=<url>` runs against a deployed UI without a server. Browsers are not installed here (`~/Library/Caches/ms-playwright` absent): `npx playwright install` downloads them — ask the user first.

## Never as verification

`--fix`, `--write`, the explicit-request-only commands in `ai/AGENTS.md` › Commands, anything that calls Save/Share/Quote on a live backend.
