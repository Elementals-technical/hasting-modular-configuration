# docs/ai — personal knowledge base (local-only)

Inventory and routing for the personal agent layer. Untracked and visible in `git status` (un-ignored at the end of `.gitignore`); do not commit without team agreement. Team guidance lives in `AGENTS.md`, `ai/`, `skills/hastings-*`, `docs/products/` and wins on conflict. Root routing: `AGENTS.local.md`.

## Read on demand (one file per question)

| Question | File |
|---|---|
| Continue earlier work | [`checkpoint.md`](checkpoint.md) |
| Which commands work, with which Node | [`verified-commands.md`](verified-commands.md) |
| Client rule for a family/area | [`hastings/domain-index.md`](hastings/domain-index.md) → [`domain-rules.csv`](hastings/domain-rules.csv) |
| Sources disagree | [`hastings/conflicts-and-decisions.md`](hastings/conflicts-and-decisions.md) ([`conflicts.csv`](hastings/conflicts.csv)) |
| Blast radius of a change | [`hastings/dependency-graph.md`](hastings/dependency-graph.md), [`feature-index.md`](hastings/feature-index.md) |
| Expected SKU / price | [`hastings/sku-price-oracle-map.md`](hastings/sku-price-oracle-map.md) ([`sku-oracle.csv`](hastings/sku-oracle.csv)) |
| Is a source current / accessible | [`hastings/source-ledger.csv`](hastings/source-ledger.csv), [`link-access-audit.csv`](hastings/link-access-audit.csv) |
| What a client comment says and its status | [`hastings/comments-ledger.csv`](hastings/comments-ledger.csv), [summary](hastings/comments-summary.md) |
| Backlog item status | [`hastings/backlog-ledger.csv`](hastings/backlog-ledger.csv), [summary](hastings/backlog-summary.md) |
| CSV columns and enums | [`hastings/SCHEMAS.md`](hastings/SCHEMAS.md) |
| How to test in a browser | [`qa/browser-validation.md`](qa/browser-validation.md) |
| Test design and results | [`qa/ui-test-matrix.csv`](qa/ui-test-matrix.csv), [`qa/test-evidence-index.csv`](qa/test-evidence-index.csv) |
| Defect for PlayCanvas/backend/frontend owner | [`qa/handoffs/`](qa/handoffs/ownership-handoff-template.md) |
| Branches, hosts, MCP setup per OS | [`env/environment-branch-map.md`](env/environment-branch-map.md), [`env/windows-mac-mcp-runbook.md`](env/windows-mac-mcp-runbook.md) |

## Data layout

- `hastings/normalized/<source_id>/` — NORMALIZED sources (paragraph/comment/table/link extracts; XLSX sheets as CSV). RAW files and extracted images are outside the repo in the ai-env store (`sources/raw/`, `sources/media/`).
- `qa/scenarios/` — browser scenarios (`lib/` helpers: read-only probe, write-guard, collections no-cache harness); `qa/evidence/<date>/` — screenshots, snapshots, console, network.
- `history/` — superseded personal notes (not guidance).

## Regenerate / check

`node .agents/skills/local-maintain-agent-guidance/scripts/qa-coverage.mjs` (schemas + source vs execution coverage), `validate-guidance.mjs`, `test-routing.mjs`.
