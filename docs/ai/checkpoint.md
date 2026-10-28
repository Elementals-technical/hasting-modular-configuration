# Checkpoint — Hastings AI-agent setup

Revision 2 · 2026-10-28 · task: set up the personal AI-agent system (plan: `~/.claude/plans/pasted-content-id-9ee6-drifting-pie.md`).

## Objective
Local-only agent layer + browser MCP + Hastings knowledge + risk-based UI matrix + real browser baseline + owner handoffs. No commit/push/deploy, no backend/PlayCanvas edits, no team-file edits; UI read-only (submits only with per-case approval).

## Decisions (user, 2026-10-28)
Mode A; Russian reports; Claude Code only; old unprefixed skills migrated to `local-*` (moved to the ai-env store); UI read-only with per-case approval.

## Done and verified
- Layer: `AGENTS.local.md`, `CLAUDE.local.md`, 6 `local-*` skills, 10 generated wrappers; tooling (`ai-env.mjs`, `validate-guidance.mjs`, `test-routing.mjs`, `test-tooling.mjs`, `qa-coverage.mjs`, `mcp-smoke.mjs`, `extract-docx.py`, `extract-xlsx.py`).
- MCP: Chrome (`--autoConnect`, user session) and Firefox (own profile) smoke PASS; persistent session mode for scripted runs.
- Sources: 47 in `hastings/source-ledger.csv` (3 docs unreachable by the Drive connector read via the user's Chrome; fluting file 403); 609 links in `link-access-audit.csv`.
- Knowledge: 382 rules, 75 conflicts (65 open; 42 open P0 with client questions), 413 comments, 445 backlog rows, 65 oracle rows, 137/313 unique images reviewed.
- QA: 976 TCs; 29 executed (20 PASS, 9 FAIL), 5 UNKNOWN, 97 BLOCKED; handoffs HO-001…HO-008.

## Blocked / open
- `.claude/settings.local.json` hook + allow rules: user applies `env/claude-settings-local.snippet.json` (agent may not self-modify).
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
- Open: USH vessel Delete in the browser (needs a vessel-compatible top); UFS WDV tier and Class LAM/SGLS tiers are client questions; team PRD `plans/tricot-integration.prd.md` is stale on the step order.

## Next
User actions from the final report; then run the BLOCKED/NOT_RUN P0 rows with native MCP tools (session started in the repo root), starting with HO-001…HO-005 regressions.
