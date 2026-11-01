---
name: local-maintain-agent-guidance
description: Maintain Hastings AI guidance, canonical local-* workflows, runtime adapters, permission rules, knowledge and backup/collision tooling. Use for an authorized workflow/configuration change or before a git pull. Do not use for application features or unrelated domain/team guidance.
---

# Maintain Agent Guidance

Use the common lifecycle in `ai/workflow.md`; this skill owns only the procedure below. Runtime adapters and subagents do not replace that owner.

Scripts live in `scripts/` next to this file and run from the repository root with plain `node` (macOS and Windows). Below, `S=.agents/skills/local-maintain-agent-guidance/scripts`.

## Owners

Choose exactly one owner with [`references/surface-decision-matrix.md`](references/surface-decision-matrix.md). Team facts (rules, invariants, commands, DoD, collection operating contracts) belong to the team files and are only linked. `tests/policy-owners.tsv` lists mechanically checked markers; a team marker found in a personal file is a validator error.

## Change procedure

1. `node $S/ai-env.mjs snapshot <label>` before editing. Preserve the initial Git index and undispatched files; an existing dirty tree is not permission to stage or rewrite them. Capture an adoption baseline when changing shared guidance.
2. Verify every path, command, contract and claim against code, config or a run before writing it. Distinguish agreed expected behavior from observed behavior; report conflicts rather than silently changing either. Report commands you ran with Node version, result and side effects in the final report.
3. Edit the single owner; replace stale text instead of appending a second version.
4. Nothing to regenerate: `.claude/skills` is a symlink to `../.agents/skills`, so Claude Code sees every skill directly. After adding a skill, add it to `tests/expected-skills.txt`.
5. Validate (below). For a permission-rule change, check it in a live session (`/permissions` in Claude Code). Then `node $S/ai-env.mjs snapshot <label>-after` and `verify`.

## Durable learning

Persist only with evidence: an explicit user decision, an accepted review correction, a confirmed root cause, an approved architecture/contract decision, or two confirmed project examples. Route: client rule → `docs/ai/hastings/domain-rules.csv` (+ conflict row if it contradicts another source); dependency → `dependency-graph.md`; workflow step → the matching `local-*` skill; mechanical rule → a validator check; temporary state → `docs/ai/checkpoint.md`. Never persist hypotheses, raw chat, credentials or document secrets.

## Before git pull or branch switch

The user fetches. Then: `node $S/ai-env.mjs snapshot pre-pull` → `node $S/ai-env.mjs collisions` (default refs `origin/phase-2/staging`, `origin/phase-2/production`; `--all-remotes` for every ref). Pull only on "collisions: none"; on a collision move the personal file to a non-colliding path, never keep two versions of one path. Some guidance is already tracked in this checkout; preserve that state. Machine-local runtime settings stay separate. Never stage, stash, untrack or reapply files without the task authority; check the actual index and collisions rather than assuming a local-* name means untracked.

## Browser MCP

Configuration and per-OS commands: `docs/ai/env/windows-mac-mcp-runbook.md`. Change pinned versions only after the smoke test there passes; record the result.

## Validate

`node $S/validate-guidance.mjs`, `node $S/test-tooling.mjs`, and for QA artefacts `node $S/qa-coverage.mjs`. Static checks do not prove model behaviour: after changing skill descriptions run the `claude -p` probes in `tests/probes.md` and include the result in the final report. Report budgets, results and anything unvalidated.
