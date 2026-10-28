# tagging-modules-tool — agent rules

A Vite + React 18 + TypeScript configurator. Product data comes from collection folders in `public/collections/`; the 3D scene is a PlayCanvas export in `public/HastingCabinetsParametrization/`, embedded as an iframe. One npm package: run everything from the repository root.

## Where to read more

Read the file before you work in its area. Cursor attaches the scoped ones by their globs; other tools don't, so open them yourself.

| When | Read |
| --- | --- |
| Adding files, importing across slices; touching the store, listeners, backend API, collection data or anything that reaches the scene; writing tests | `ai/project_conventions.mdc` |
| Writing or changing `src/**/*.ts` or `src/**/*.tsx` | `ai/typescript_typing_contracts.mdc` |
| Editing `*.scss`, class names or inline styles | `ai/styling_layout_conventions.mdc` |
| Editing `src/pages/prebuilt/**` or `src/pages/custom/**` | `ai/paired_pages.mdc` |

Markers in those files: **[enforced]** — a test, `tsc` or ESLint fails when run (there is no CI or git hook); **[observed]** — consistent, not enforced; **[needs decision]** — a target current code does not follow: add no new violations silently, fix no old ones as a side task.

## Source of truth (highest first)

1. The task's explicit requirements.
2. Runtime code and types in `src/`.
3. Data contracts: collection validators in `src/entities/collection/` with the JSON in `public/collections/`; hand-written backend types in `src/entities/*/api/types.ts`. There is no OpenAPI and no generated DTO.
4. Passing tests, including the source-scanning boundary tests.
5. Tracked docs in `docs/`; status and handoff docs describe the state on their date. `docs/*` is gitignored apart from an allowlist, so a new file there is not committed unless force-added.
6. This file and the `ai/*.mdc` files it routes to.
7. Existing code. A file that is in a `PENDING_*` list, has ESLint errors or imports a higher layer is legacy: context, not a template. A common pattern is not a rule.

When code and these rules disagree, say so and follow the code; don't silently pick one.

## Evidence

- Never claim you ran, tested or checked something you didn't; write "not run" / "not verified".
- Don't invent paths, names, scripts or commands; find them in the repo first.
- Say a file was read in full only if it was, not after a grep or a line range.
- Mark assumptions as assumptions.

## Scope

- Change only what the task needs: no drive-by refactors, renames, reformatting of untouched lines, or "normalising" legacy code.
- Before adding something, search for an existing equivalent (name, domain term, UI text, behaviour). Reuse it only if it fits without flags or adapters that mix different entities.
- Add a new abstraction only for at least two real uses or a clear drop in overall complexity.
- If a change would break an invariant below, stop and ask.
- Fix causes: no TODO stubs, silent fallbacks, or lint/type suppressions in place of a fix.
- For work that spans several files, touches an invariant or has unclear requirements, give a plan before code: steps with how each is verified, files, affected invariants and tests, unknowns.
- PRDs and issues, only when asked: `plans/<name>.prd.md` and `plans/<name>/NN-<slug>.issue.md` with the sections of `plans/collection-driven-data-consumers.prd.md` and its issues; one reviewable commit per issue.

## Invariants

Checked by `src/entities/collection/__tests__/collectionConsumerBoundary.test.ts` unless noted; the code names below are its constants — read the lists there, not a copy.

- Collection data is loaded and validated only by the loader; components read it with `useActiveCollection(selector)` or a derived hook. No collection RTK Query hooks (`prohibitedHookCalls`) or remote source ids (`hardcodedSourceIds`) elsewhere.
- The scene changes only through `useChangeAttribute` / `useChangeDimension` (`@/features/configurationCommands`) → `ConfigurationRuntimePort` → the PlayCanvas adapter. `directSceneCalls` are allowed only under `SCENE_INFRASTRUCTURE`.
- A value the command owns (`COMMITTED_SETTERS`) is dispatched only by `src/features/configurationCommands/lib/commitChange.ts`.
- `PENDING_*` lists only shrink: never add a file or raise a count; after a migration, lower or remove the entry in the same change. The test checks exact equality, so a raised count passes — this rule is not enforced.
- Every reason code in the code has a text in the USH profile's `messages` (`src/entities/collection/__tests__/reasonCodesHaveMessages.test.ts`).
- Every scene key bound in the USH `runtime-bindings.json` appears in the scene bundle or in `NOT_READ_BY_SCENE` (`src/features/playCanvasAdapter/__tests__/sceneKeysInExport.test.ts`).

## Do not edit by hand

- `public/HastingCabinetsParametrization/**` — the PlayCanvas export, replaced as a whole; afterwards run `sceneKeysInExport.test.ts`.
- `src/shared/lib/pricing/__tests__/fixtures/prices/*.json`, `src/entities/collection/__tests__/fixtures/remote/*.json` — recorded API answers; see the README in each folder.
- `package-lock.json` (npm only), `dist/` (build output).

## Safety

- No destructive commands (`rm -rf`, `git reset --hard`, `git clean -fd`, force push) unless asked.
- `.env` is tracked in git: never print its values and don't add secrets to it.

## Commands

- Install: `npm ci`. Use Node 22 — vitest 4 and jsdom declare `^20 || ^22 || >=24`; the repo pins no version.
- Typecheck: `npm run tsc`
- Tests: `npm test`; one file: `npx vitest run <path>`
- Lint: `npx eslint <changed files>` with no new problems. Whole-repo `npm run lint` fails on a pre-existing baseline, mostly in PlayCanvas code.
- Format: `npx prettier --check <changed files>` (`.prettierrc`). Many files are not Prettier-formatted; in those, format only your lines.
- Build: `npm run build` (`tsc -b`, then Vite).
- Only on explicit request: `RECORD_PRICES=1 npx vitest run src/shared/lib/pricing/__tests__/recordPriceFixtures.test.ts` (calls the live price API and rewrites fixtures); `--fix` / `--write` beyond the changed files.

## Definition of done

- Requirements met; nothing outside the scope changed.
- Ran, as applicable: `npm run tsc`; `npm test` or the affected tests; `npx eslint <changed files>`; `npm run build` when config, dependencies or `public/` change.
- Scene behaviour is not proven by node tests: check it in the browser or say it was not checked.
- Report: files changed; why; commands run and their results; what was not verified.
