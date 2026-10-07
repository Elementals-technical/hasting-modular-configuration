# Tricot implementation tracker

Branch: `feat/tricot-integration`. Scope: [approved PRD](../tricot-integration.prd.md).

The only maintained list of outstanding external questions is [open-questions.uk.md](open-questions.uk.md). The audit, PRD and dated execution records below preserve historical evidence; they are not separate current request lists.

The eight vertical slices were approved by the user. Issues and implementation notes are written in English. AFK slices are independently verifiable with explicit staging dependencies; completing them does not constitute real-scene acceptance. Do not invent preset layouts, API identities, scene mappings, panel quantities or unconfirmed countertop rules.

| Order | Issue                                                                                   | Type | Dependencies         | Status                                        |
| ----- | --------------------------------------------------------------------------------------- | ---- | -------------------- | --------------------------------------------- |
| 1     | [Staged entry and preset catalog](01-staged-entry-and-preset-catalog.issue.md)          | AFK  | None                 | Complete (staged)                             |
| 2     | [Custom cabinets and pricing](02-custom-cabinets-and-pricing.issue.md)                  | AFK  | 1                    | Complete (staged)                             |
| 3     | [Finishes, patterns and groove colors](03-finishes-patterns-and-groove-colors.issue.md) | AFK  | 2                    | Complete (staged)                             |
| 4     | [Countertop and basin selection](04-countertop-and-basin-selection.issue.md)            | AFK  | 3                    | Matrix connected; pricing/scene pending       |
| 5     | [Side panels and pricing](05-side-panels-and-pricing.issue.md)                          | AFK  | 3                    | SKU/quantity/width implemented; scene pending |
| 6     | [Summary and persistence](06-summary-and-persistence.issue.md)                          | AFK  | 4, 5                 | Prepared; acceptance pending                  |
| 7     | [Product and scene handoff](07-product-and-scene-handoff.issue.md)                      | HITL | 1–6; external inputs | Partial cabinet runtime integrated; gaps remain |
| 8     | [Real-scene acceptance](08-real-scene-acceptance.issue.md)                              | AFK  | 7                    | Blocked by 7                                  |

## Baseline

- TypeScript passed during the audit.
- The four audited suites had 92 passing tests and one existing Class default-pricing failure. Preserve unrelated behavior; do not silently rewrite expected prices to hide that failure.
- Full test baseline: 212 passing suites, one existing failed suite, one skipped; 1922 passing tests, one failed, one expected failure, six skipped and three todo.
- Full lint baseline: 93 errors and three warnings in existing files; unrelated lint cleanup is outside the approved scope.
- Issue 1: TypeScript, changed-file lint and 26 focused tests passed. Complete staging catalog and readiness checks, not live acceptance.
- Required external inputs and ownership are described in issue 7 and the PRD.

## Execution policy

Work in numbered order, using the `do-work` feedback loops. Record checks, baseline failures and remaining dependencies per issue. Production activation and full acceptance remain blocked until the actual handoff passes validation.

## Verification — 2026-10-06

- `npm run tsc`: passed.
- `npm run build`: passed; Vite reports dependency annotation and large-chunk warnings.
- Changed-file lint: 39 TypeScript files, zero errors/warnings.
- `npm run lint`: same existing baseline, 93 errors and three warnings; no new changed-file findings.
- Full `npm test`: 220 files (218 passed, one failed, one skipped); 2099 passed, one failed, one expected failure, six skipped and three todo. The only failure remains the pre-existing Class default-pricing test at `src/shared/lib/pricing/__tests__/collectionPricing.test.ts:461`.
- The six new Tricot suites contain 175 passing tests. The total passing count increased by 177, including new coverage in the existing readiness/reason-message suites.
- `git diff --check`: passed. Source importer reproduces packaged catalog/presets from the archived master; workbook cases retain source-cell provenance.
- No real-scene/browser acceptance, deployment, external API publication, commit or push has been performed. Changes remain local on the dedicated branch.

## Verification — 2026-10-07

- `npm run tsc` and `npm run build`: passed; existing Vite annotation/large-chunk warnings remain.
- Six Tricot suites: 181 passing tests (six additional cases since October 6).
- `node --test scripts/download-tricot-images.test.mjs`: passed; all 41 archived PNG signatures and SHA-256 hashes match their exact source URLs and preset mappings.
- Changed-source lint: 45 TypeScript/TSX/MJS files, zero errors/warnings. Full lint retains the existing 93 errors and three warnings.
- Full `npm test`: 220 files (218 passed, one failed, one skipped); 2105 passed, one failed, one expected failure, six skipped and three todo. The only failure is still the pre-existing Class default-pricing test at `collectionPricing.test.ts:461`.
- `git diff --check`: passed. No actual Canvas/browser acceptance, external writes, commit, push or deployment.

## Panel follow-up verification — 2026-10-07

- Six Tricot suites: 197 passed, including 29 panel tests (16 additional cases in this follow-up).
- `npm run tsc` and `npm run build`: passed; existing dependency annotation/large-chunk warnings remain.
- Changed-source lint: 47 files, zero errors/warnings. Full `npm run lint`: the unchanged baseline of 93 errors and three warnings.
- Full `npm test`: 220 files (218 passed, one failed, one skipped); 2121 passed, one failed, one expected failure, six skipped and three todo. Only the pre-existing Class default-pricing test at `collectionPricing.test.ts:461` fails.
- Node PNG integrity check and `git diff --check`: passed. Both supplied screenshots were reviewed; no image replacement or actual scene binding was fabricated.
- Work remains local on `feat/tricot-integration`; no commit, push, external API mutation or deployment.

## Partial runtime verification — 2026-10-07

- Integrated the confirmed cabinet runtime contract using `do-work`; no grilling session or guessed mappings were required.
- Eight Tricot suites: 238 passing tests, including 41 new production-runtime/adapter checks. Broader focused run: 13 suites / 287 passing tests.
- `npm run tsc` and `npm run build`: passed; existing bundle/dependency warnings remain.
- Changed-source lint: 57 files, no errors. Full `npm run lint`: unchanged staging baseline, 93 errors / 3 warnings.
- Full `npm test -- --maxWorkers=4`: 223 passing files / 1 skipped; 2184 passing tests / 1 expected failure / 6 skipped / 3 todo. No unexpected test failure. The historical Class baseline failure is no longer present after the staging merge.
- Node PNG integrity and `git diff --check`: passed. Preset recipes/defaults and exact images are preserved.
- No real browser/visual acceptance, commit, push, deployment or external API mutation. `?collectionId=tricot` still shows the staged dependency screen, not an activated partial configurator.

## Remaining activation work

Issues 1–3 are complete within their staging boundaries. Received and integrated resources are recorded in [handoff.md](handoff.md). All presets retain their approved defaults and recipes; the manifest remains staged. Follow [open-questions.uk.md](open-questions.uk.md) for the outstanding inputs, then execute issue 8 against the actual scene in both flows. No full readiness is claimed.

## Commit handoff — 2026-10-07

- The user authorized local commits for all completed work. Changes are grouped into collection/runtime support, the staged Tricot package with tests/assets, and documentation. No push or deployment is included.
- Final `npm run tsc` and `npm run build`: passed; existing Vite annotation/large-chunk warnings remain.
- Final `npm test -- --maxWorkers=4`: 223 passing files / 1 skipped; 2184 passing tests / 1 expected failure / 6 skipped / 3 todo. No unexpected failures.
- Changed-source lint: all 57 TypeScript/TSX/MJS files passed. Full lint still reports the unchanged staging baseline of 93 errors and 3 warnings.
- `node --test scripts/download-tricot-images.test.mjs` and staged diff whitespace checks: passed.
- [open-questions.uk.md](open-questions.uk.md) is committed with the documentation and is the only maintained outstanding external request list. Historical audit/PRD/issue records are retained and explicitly distinguished from current requests.
- The manifest remains staged. Real-scene/browser acceptance and issue 8 are still pending; automated validation is not full activation.
