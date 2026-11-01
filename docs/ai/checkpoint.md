# Checkpoint — Hastings AI-agent setup

Revision 4 · updated 2026-11-01. Running state of the agent layer in this checkout; after restructure stage 2 this file moves to `.work/checkpoint.md` (personal, outside Git).

## Objective
One agent workflow for Claude Code and Codex on top of the Hastings knowledge layer (`docs/ai`), the risk-based UI matrix, a real browser baseline and owner handoffs. Agents never commit, push or deploy; backend and PlayCanvas belong to other owners.

## State (2026-11-01, restructure stage 1)
- Root: `AGENTS.md` (team) + `CLAUDE.md` (`@AGENTS.md`); personal `AGENTS.local.md` / `CLAUDE.local.md` are ignored and recovered with `ai-env.mjs snapshot/restore`.
- Skills: one root `.agents/skills/` (6 `local-*`, 4 `hastings-*`, 2 `hasting-*` routers); `.claude/skills` and `.claude/rules` are symlinks. Rules: `ai/rules/*.md` with `paths:` frontmatter.
- Enforcement: `permissions.deny/ask` in `.claude/settings.json` (team) and `.claude/settings.local.json` (personal); Codex sandbox + `.codex/rules`. The 2026-10-30 hook engine, runtime adapters, generated wrappers and `test-routing` were removed on 2026-11-01.
- Tooling: `ai-env.mjs`, `validate-guidance.mjs` (13 checks), `test-tooling.mjs` (14), `qa-coverage.mjs`, `mcp-smoke.mjs`, `extract-docx.py`, `extract-xlsx.py`; live routing probes in `tests/probes.md`.
- MCP: Chrome (`--autoConnect`, user session) and Firefox (own profile) smoke PASS (2026-10-28).
- Knowledge (2026-10-28 snapshot): 47 sources, 382 rules, 75 conflicts (65 open), 413 comments, 445 backlog rows, 65 oracle rows, 137/313 images reviewed. Originals of the 9 `local-*` sources are not in this checkout.
- QA: 976 TCs; 29 executed (20 PASS, 9 FAIL), 5 UNKNOWN, 97 BLOCKED; handoffs HO-001…HO-009.

## Blocked / open
- Fluting options file `1Kg1_GQi…` 403; resolved comment threads need the Google Docs UI; Hastings Config Guide, Drive recordings, Slack/take.ms/Gyazo links not opened.
- Scene-pointer scenarios (DnD, in-scene "+", swap) BLOCKED in the scripted harness; Playwright browsers not installed.
- 3 configuration records created on the dev backend by the Summary auto-save before the write-guard existed (HO-002).

## Tricot client feedback task (2026-10-28, uncommitted)
- Implemented in the working tree, nothing committed or deployed: vessel Delete (`vesselBasinSelection.ts`, `replayValues.ts` basin fan-out), per-collection price tiers (`ruleData.priceTiers`, Tricot LACM 1 / WDV 2, Class WDV 3), Tricot step order + Faucet Details (default 0).
- Verified: targeted vitest, `tsc`, eslint/prettier on changed files; Chrome on local dev (evidence `qa/evidence/2026-10-28/tricot-task/README.md`). Wood Veneer loading not reproduced (staging + local).
- Committed since as `11434e24` (in `origin/phase-2/staging`, PR #497); staging deploy not checked.
- Follow-up (committed by the user as `37ff56b3` on `phase2/ui-fixes`, = origin): Handle Groove Color (20 LACM) was split Standard $ (Latte, white rule) / Classic $$ (19); Tricot profile now has `HandleGrooveColor: { LACM: 1 }` + tests; vitest, tsc, eslint, prettier, build and Chrome local dev pass (`local/groove-pricefilter/`).
- Follow-up 2 superseded by follow-up 3 (uncommitted): GB block of 'list material' > Material Pricing Tiers for every colour field of Tricot, Lame, Mako, Class (K-CTML-014 decided by the user; R-TRICOT-UX-002 superseded). New `ruleData.priceTiers.bySku` (collection-wide) + optional `byAttribute`; `selectPriceTierOverride` merges them. Verified: vitest (full suite: only 4 pre-existing HEAD failures — `tricotCatalog`, `urbanDuplexPresets`, `columnsCompactPreset`, `ModelPage.compactPricing`), tsc, eslint, prettier, build; Chrome local dev `qa/evidence/2026-10-28/gb-pricefilter/README.md`. Not reached in the browser: Lame/Mako/Class Vessel Color, Mako Leg Color.
- Faucet Holes (uncommitted): merge `f97e04ea` replaced the Tricot `FaucetHolesAmount` attribute (0-3) with `DividersOption`/`DividersStyle`, leaving the Faucet Details step empty (also on `origin/phase-2/staging` by local refs). Attribute restored from `11434e24`; `tricotCatalog` passes, full suite 3 failures (all pre-existing), prettier, build pass. Browser not checked: Chrome DevTools approval timed out twice (scenario `qa/scenarios/tc/LOCAL-TRICOT-faucet-holes.json`).
- Price filter of all 8 collections checked against Material Pricing Tiers on the live configurators (2026-10-29, `qa/evidence/2026-10-29/pricefilter-all-collections/README.md`): every listed material matches; no tier for Ceramic and SS vessels, UD/UFS SSTL Matte White, Metal; Syntesi Standard $ by code only. Added the Azzurra-block pin in `priceFilters.test.ts`, fixed the stale tier comment in `priceFilters.ts`. Browser not run.
- Tricot divider SKU (uncommitted, 2026-10-29): `tricot/sku-profile.json#dividers` = Class's VAN-GBDIV-MTL / -OAK + Class's non-blocking divider gap (Q-N2 closed by the user); test in `collectionOrganizerPricing.test.ts`; `docs/drawer-organizers-ui.md` Q-N2 rows; R-TRICOT-ACC-001 partial. Verified: vitest (full suite 3 pre-existing failures), tsc, eslint, prettier, build; Chrome local dev: Metal column → Summary Drawer Organizer $170 (`qa/evidence/2026-10-29/tricot-divider-sku/`). Oak blocked by 3D (v81 Metal only, Q-K3). Out of scope: GB faucet-hole/hole-cut SKUs (CT-GB*-FAHO, -HCUT; Class has none either).
- Faucet Details hints (uncommitted, 2026-10-29): USH `hints` 1/2/3 copied to `class`, `mako`, `lame`, `tricot` `ui.json`; parity test over every `ui.json` with a `faucet-holes` step in `resolveSectionState.test.ts`. Verified: vitest (2 failures that also fail on HEAD: `lamePackage`, `partialCollectionPackages` preset counts), tsc, eslint, prettier; Firefox local dev for all four plus USH (`qa/evidence/2026-10-29/faucet-hints/README.md`). Chrome and custom flow not run.
- Open: USH vessel Delete in the browser (needs a vessel-compatible top); UFS WDV tier and Class LAM/SGLS tiers are client questions; team PRD `plans/tricot-integration.prd.md` is stale on the step order.

## Next
Restructure stage 2 (`docs/ai/qa/evidence` and `docs/qa` out of Git, `docs/records/`, `.work/`); product specifications in `docs/products/` for every collection; review of `docs/` for stale and duplicated material. Then the BLOCKED/NOT_RUN P0 rows with native MCP tools, starting with HO-001…HO-005 regressions.
