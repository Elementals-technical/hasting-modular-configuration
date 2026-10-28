---
name: local-maintain-agent-guidance
description: Maintain the personal Hastings agent layer: AGENTS.local.md, local-* skills and Claude wrappers, docs/ai knowledge and ledgers, browser MCP config, ai-env backup/collision tooling, durable learning; run before a git pull. Do not use for application code or tracked team guidance (AGENTS.md, ai/*, skills/hastings-*).
---

# Maintain Agent Guidance

Scripts live in `scripts/` next to this file and run from the repository root with plain `node` (macOS and Windows). Below, `S=.agents/skills/local-maintain-agent-guidance/scripts`.

## Owners

Choose exactly one owner with [`references/surface-decision-matrix.md`](references/surface-decision-matrix.md). Team facts (rules, invariants, commands, DoD, collection operating contracts) belong to the team files and are only linked. `tests/policy-owners.tsv` lists mechanically checked markers; a team marker found in a personal file is a validator error.

## Change procedure

1. `node $S/ai-env.mjs snapshot <label>` before editing.
2. Verify every path, command, contract and claim against code, config or a run before writing it; code wins. Commands go to `docs/ai/verified-commands.md` with date, Node version, result and side effects.
3. Edit the single owner; replace stale text instead of appending a second version.
4. `node $S/ai-env.mjs sync` (regenerates `.claude/skills/*` wrappers for `local-*` and team `skills/hastings-*`).
5. Validate (below), then `node $S/ai-env.mjs snapshot <label>-after` and `verify`.

## Durable learning

Persist only with evidence: an explicit user decision, an accepted review correction, a confirmed root cause, an approved architecture/contract decision, or two confirmed project examples. Route: client rule → `docs/ai/hastings/domain-rules.csv` (+ conflict row if it contradicts another source); dependency → `dependency-graph.md`; workflow step → the matching `local-*` skill; mechanical rule → a validator check; temporary state → `docs/ai/checkpoint.md`. Never persist hypotheses, raw chat, credentials or document secrets.

## Before git pull or branch switch

The user fetches. Then: `node $S/ai-env.mjs snapshot pre-pull` → `node $S/ai-env.mjs collisions` (default refs `origin/phase-2/staging`, `origin/phase-2/production`; `--all-remotes` for every ref). Pull only on "collisions: none"; on a collision move the personal file to a non-colliding path, never keep two versions of one path. The layer is untracked but visible in `git status` (un-ignore lines at the end of `.gitignore`, a local uncommitted change): never stage it; a pull that touches `.gitignore` needs that change stashed or re-applied.

## Browser MCP

Configuration and per-OS commands: `docs/ai/env/windows-mac-mcp-runbook.md`. Change pinned versions only after the smoke test there passes; record the result.

## Validate

`node $S/validate-guidance.mjs`, `node $S/test-routing.mjs`, `node $S/test-tooling.mjs`, and for QA artefacts `node $S/qa-coverage.mjs`. Static routing fixtures do not prove model behaviour: for a live check run one `claude -p` probe from the repository root. Report chain sizes, results and anything unvalidated.
