# Guidance surface decision matrix

| Need | Canonical owner | Keep out |
|---|---|---|
| One request or temporary constraint | the conversation, `docs/ai/checkpoint.md` | durable files |
| Team rule, invariant, command, DoD, collection operating contract | team: `AGENTS.md`, `ai/rules/*.md`, `.agents/skills/hastings-*`, `docs/products/*` (change via team PR) | any personal copy |
| Common cross-runtime lifecycle | `ai/workflow.md` | independent Claude/Codex workflows |
| Personal rule for every task in this repo | `AGENTS.local.md` (adapter `CLAUDE.local.md`) | team files, per-tool copies |
| Repeatable workflow | one `.agents/skills/local-*/SKILL.md` (+ `references/` for conditional detail) | root guidance, domain rules |
| Client requirement with source anchor | `docs/ai/hastings/domain-rules.csv` | skills, root |
| Contradiction between sources | `docs/ai/hastings/conflicts-and-decisions.md` | silently picking one |
| Attribute → consumers | `docs/ai/hastings/dependency-graph.md` | code copies |
| SKU/price oracle | `docs/ai/hastings/sku-price-oracle-map.md` | guessed values |
| Source freshness, access | `source-ledger.csv`, `link-access-audit.csv`, `comments-ledger.csv` | prose claims "studied" |
| Test design and execution state | `docs/ai/qa/ui-test-matrix.csv` + evidence index | chat-only results |
| Foreign-owner defect | `docs/ai/qa/handoffs/HO-xxx.md` | generic "check PlayCanvas" |
| Runtime discovery | `AGENTS.md`, thin Claude imports, `.claude/skills -> ../.agents/skills` symlink | hand-written copies of canonical skills |
| Hard limits (what the agent may never do) | `permissions.deny`/`ask` in `.claude/settings.json` (team) and `.claude/settings.local.json` (personal); Codex sandbox and `.codex/rules` | prose rules, scripts that parse shell text |
| Recovery of personal files | `ai-env.mjs snapshot` store outside the repo | `.git/info/exclude` (it hides, it does not protect) |
| Deterministic check | a script in `scripts/` | prose checklists |

Before adding guidance: is it stable and repeatedly useful; which scope; does an owner already cover it; can a script enforce it; can it replace stale text; are all paths and commands current?
