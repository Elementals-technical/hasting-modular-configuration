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
- Open: USH vessel Delete in the browser (needs a vessel-compatible top); UFS WDV tier and Class LAM/SGLS tiers are client questions; team PRD `plans/tricot-integration.prd.md` is stale on the step order.

## Next
User actions from the final report; then run the BLOCKED/NOT_RUN P0 rows with native MCP tools (session started in the repo root), starting with HO-001…HO-005 regressions.
