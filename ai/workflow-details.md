# Hastings UI AI workflow

Detail for the common lifecycle in `ai/workflow.md`, read for formal features, long/parallel runs, verification design or adapter changes. `AGENTS.md` routes to team contracts and the local operating profile. A task or repository role never grants additional capability by itself. This pilot edits guidance and adapters only; it does not deliver application changes.

A small, settled change needs goal, scope, acceptance and focused evidence, not a ceremonial specification package. A normal feature needs dependency-aware steps and acceptance-to-test mapping. Raise verification rigor for commercial logic, persistence, cross-repository contracts, device/runtime failures or uncertain sources, regardless of diff size.

Use the installed `sdd:*` pipeline only when the feature is deliberately managed by its artifacts. Read that installed version's gates and permissions before invoking it: course aliases and templates are not its schema. Do not run SDD and a local card/agent harness as competing orchestrators. Its configuration/branch/commit defaults cannot override this checkout's profile. An unmet mandatory gate remains unmet; never fabricate an ADR or call a baseline failure a green gate.

## Common lifecycle

1. **Preflight.** Establish Git root, branch/HEAD, relevant dirty diff, owner, environment and allowed operations. Preserve undispatched changes and index. For guidance changes take the maintenance snapshot before editing; check adapter drift and guidance collisions before a branch transition. A disallowed operation stays disallowed even if the task can otherwise continue.
2. **Intake.** State the goal, acceptance criteria, sources with revision/status, exclusions and unknowns. Reuse already settled conversation decisions. Missing product data or a decision-changing conflict blocks that part, not unrelated work. Requirements define expected behavior; code/runtime shows current behavior.
3. **Plan.** Pick one primary procedure, the smallest dependency-complete chunks, impacted consumers and a proof for each acceptance criterion. Research existing implementation before adding another. Do not ask repeatedly for routine steps already inside authorized scope.
4. **Execute.** Keep one writer per changed file set and one coordinator for status. Make the original problem observable. A meaningful logic regression gets a failing test before its fix; reversible prose/configuration edits need structural or behavioral checks suited to them, not artificial TDD. Reproduce unknown failures before guessing a fix. Two failed approaches trigger evidence review and a revised plan.
5. **Verify.** Run the procedure's focused checks and required final gates. A brownfield baseline records failing test names/rules and environment, not just counts. No new failures; changed lines meet their contracts. Existing failures remain visible. Browser/scene behavior needs the UI acceptance gate; DOM checks alone do not prove geometry, SKU or price. Mark each criterion `PASS`, `FAIL`, `BLOCKED`, `UNKNOWN` or `NOT_RUN` with evidence/reason.
6. **Review.** Inspect the final task-scoped diff, AC coverage, boundaries and reuse. Cross-contract, commercial or other high-risk changes get an independent read-only reviewer. Findings return to the implementation owner; a reviewer does not silently modify its own evidence. Small changes may use a direct diff review without extra agents.
7. **Docs sync and learning.** Update the owner of a changed contract, the documentation map when its routes change, and only source-backed durable knowledge. Keep Maintained and Records distinct according to `docs/INDEX.md`. Preserve client/conflict/source ledgers and consequential ADRs; do not erase rationale merely because a temporary card closes.
8. **Handoff.** Report what changed, why, acceptance/evidence, actual checks, limitations and owner of unresolved issues. Commit, PR and deploy are separate capabilities and disabled in the pilot. Never describe local validation as deployed behavior.

## One task state

Use the existing approved plan/checklist as task state; for a deliberately SDD-managed feature use its tracker/tasks.json. Do not duplicate status into an unrelated local task card. For a multi-session local task keep a short checkpoint with goal, phase, decisions, next step and blockers; the coordinator is its writer. Temporary notes are not the only surviving acceptance record.

Capture the run's code identity (HEAD plus relevant uncommitted diff), source/oracle revision, environment/build identity and relevant export fingerprint, scenario/collection, actual observations and evidence. Resume a completed check only if these inputs still match. New deployment, source or test inputs invalidate the affected evidence.

## Delegation and isolation

Roles are task assignments, not new rule owners or fixed model choices. Delegate useful independent research/review; avoid dispatch overhead for trivial work. Code-writing concurrency requires isolated worktrees and an integration plan. Browser QA uses one controller per owned browser session; separate agents require separate profiles/servers/ports/output paths. Respect GPU capacity and serialize heavy runs when capacity is unknown. Subagents inherit the task's restrictions.

Before a long autonomous run declare a suitable iteration/time/cost budget, observable stop criterion and resume point. Unsupported tools or missing integration infrastructure are reported, never simulated as successful execution.

## Runtime enforcement

Claude loads the common instructions through `CLAUDE.md` and `CLAUDE.local.md`; Codex loads `AGENTS.md`, which routes the optional local profile. Neither adapter carries alternative product or workflow policy.

Hard limits live in the runtimes' own permission systems, not in scripts: team path protection in `.claude/settings.json` (`permissions.deny` for the PlayCanvas export, recorded price fixtures and the settings files), personal `ask`/`deny` rules for git delivery in `.claude/settings.local.json`, Claude's `/sandbox` and Codex's `workspace-write` sandbox for writes outside the repository, and the browser write guard for QA. Text rules in `AGENTS.md` remain guidance; anything that must hold every time belongs in those permission rules.
