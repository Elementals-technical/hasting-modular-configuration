# Hastings Modular — React UI (agent rules)

A Vite + React 18 + TypeScript configurator for Hastings Modular vanities. Product data comes from collection folders in `public/collections/`; the 3D scene is a PlayCanvas export in `public/HastingCabinetsParametrization/`, embedded as an iframe. One npm package: run everything from the repository root. Shared by Codex, Claude Code (via `CLAUDE.md`) and Cursor.

## Scope of this repository

- Owned here: UI, collection packages, state, commands to the 3D scene and the commercial result (SKU, price, summary, save/share, PDF).
- The 3D source is a separate checkout, `../hasting-modular-playcanvas-flow-git/src/` (synced from the PlayCanvas Editor, not under git): read-only from here — diagnose, then hand off. The export in `public/` has its own identity; changing the source does not prove the loaded export was updated.
- Product facts: verify in `../../data-modular-configuration/AGENTS.md`; a PlayCanvas mapping or limitation is not carried to other configurators automatically.
- Entry points: `README.md`, `docs/INDEX.md`; collections — `docs/products/README.md`; parent iframe — `docs/parent-configurator-integration.md`; cross-repository flow — `docs/ecosystem-map.md` (dated snapshot). Portfolio maps (`../../PROJECT-MAP.md`, `../PROJECT-MAP.md`) exist only in a full workspace checkout; without them continue locally and name the missing context.
- Implementation details live in `docs/`; keep `docs/INDEX.md` current, separating Maintained from Records.

## Personal profile

If `AGENTS.local.md` exists in the root, read it before starting: the checkout owner's personal profile (not in git). It may narrow the permissions in this file, never widen them; on conflict this file wins. No tool loads it on its own (Claude Code: via `CLAUDE.local.md`).

## Where to read more

Read the file before you work in its area. Claude Code attaches `ai/rules/*` by `paths:` (via `.claude/rules`); other tools don't, so open them yourself.

| When | Read |
| --- | --- |
| Adding files; imports across slices; store, listeners, backend API, collection data, anything that reaches the scene; tests | `ai/rules/project-conventions.md` |
| Writing or changing `src/**/*.ts` or `src/**/*.tsx` | `ai/rules/typescript.md` |
| Editing `*.scss`, class names or inline styles | `ai/rules/scss.md` |
| Editing `src/pages/prebuilt/**` or `src/pages/custom/**` | `ai/rules/paired-pages.md` |
| Collection work (any `collectionId`: class, mako, tricot, lame, urban-low-height, urban-duplex, urban-freestanding, urban-standard-height) | skill `.agents/skills/hastings-<id>/`, then `docs/products/<id>/README.md` (USH: `urban-standard-height.md`) |
| Countertop or side panels (UI↔3D contract) | skills `.agents/skills/hasting-countertop/`, `.agents/skills/hasting-side-panels/` |
| Client rules, conflicts, dependency graph, SKU/price oracle, QA, handoffs, environments | `docs/ai/README.md` |

Markers in those files: **[enforced]** — a test, `tsc` or ESLint fails when run (the check must actually be run; agent permission rules do not replace CI or Git gates); **[observed]** — consistent, not enforced; **[needs decision]** — a target current code does not follow: add no new violations silently, fix no old ones as a side task.

## Source of truth (highest first)

1. The task's explicit requirements.
2. Runtime code and types in `src/`.
3. Data contracts: collection validators in `src/entities/collection/` with the JSON in `public/collections/`; hand-written backend types in `src/entities/*/api/types.ts`. There is no OpenAPI and no generated DTO.
4. Passing tests, including the source-scanning boundary tests.
5. Tracked docs in `docs/`; status and handoff docs describe the state on their date. Share a new document through `docs/INDEX.md`, never by force-adding an ignored path.
6. This file and the `ai/rules/*.md` files it routes to.
7. Existing code. A file that is in a `PENDING_*` list, has ESLint errors or imports a higher layer is legacy: context, not a template. A common pattern is not a rule.

This order establishes observed technical behavior, not permission to change requirements. Approved task requirements and source-backed product rules define the expected result; code, tests and the loaded runtime establish the current result. Record a discrepancy explicitly. Never turn an observed legacy exception into a new invariant, weaken an oracle to match implementation, or bypass ownership restrictions because existing code does so.

## Workflow and adapters

Use [`ai/workflow.md`](ai/workflow.md) for intake, route selection, evidence, independent review and handoff. One canonical procedure skill per task lives in `.agents/skills/local-*` (Claude Code reads them through the `.claude/skills` symlink); domain skills own product contracts, `ai/rules/*.md` own code conventions. Adapters reference these owners rather than carrying alternative rules. Permissions come from the user instruction and `AGENTS.local.md`; roles grant no rights.

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
- PRDs and issues, only when asked: `plans/<name>.prd.md` and `plans/<name>/NN-<slug>.issue.md` with the sections of `plans/collection-driven-data-consumers.prd.md` and its issues; one reviewable commit per issue; every PRD and issue carries a `Status:` line.
- Team guidance (`AGENTS.md`, `ai/`, `.agents/skills`, `.claude/settings.json`, `.codex/`) changes only when the task explicitly includes it, through the `local-maintain-agent-guidance` skill; never change your own permissions during ordinary implementation.

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
- Backend data/API and the PlayCanvas scene/export are read-only from here: a defect there becomes a handoff (`docs/ai/qa/handoffs/ownership-handoff-template.md`), not a frontend workaround. A permission for the UI is not a permission for a neighbouring Git root or the generated export.
- Preserve existing staged and unstaged changes and the index; never stage, stash or reset what the task did not touch.
- Private values, cookies and credentials never go into guidance, evidence or reports. `.env*` files are local: never print their values and don't add secrets to them.

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
- Report: files changed; why; commands run and their results; what was not verified; one line `Learning: none | candidate: <name>` for a procedure that repeated.
