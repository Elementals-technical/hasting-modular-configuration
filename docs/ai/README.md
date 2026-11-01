# docs/ai — Hastings agent knowledge

Client requirements, QA state and environment notes for agents working in this repository; `AGENTS.md` routes here. One question → one file: read that file, not the folder.

Precedence on conflict: `docs/products/<id>/` (specification) and `.agents/skills/hastings-<id>/` (team, maintained) → `hastings/*.csv` (extracted from client sources, dated) → `hastings/normalized/` (raw extracts). Record a disagreement in `hastings/conflicts-and-decisions.md`; do not silently change either side.

## Read on demand

| Question | File |
|---|---|
| What a collection must do (specification) and how it is wired | `../products/<id>/README.md` ([index](../products/README.md)) |
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
| Defect owned by PlayCanvas / backend / frontend | [`qa/handoffs/`](qa/handoffs/) — HO-001…HO-009, [template](qa/handoffs/ownership-handoff-template.md) |
| Branches, hosts, MCP setup per OS | [`env/environment-branch-map.md`](env/environment-branch-map.md), [`env/windows-mac-mcp-runbook.md`](env/windows-mac-mcp-runbook.md) |

Lifecycle, routing and the checkpoint are owned by `AGENTS.md` and `ai/workflow.md` and are not repeated here.

## Data layout

- `hastings/normalized/<source_id>/` — per-source extracts (`paragraphs.jsonl`, `comments.jsonl`, `tables.jsonl`, `links.csv`, `media.csv`, `summary.json`), 33 sources. Originals are not in this repository: a live source is re-fetched from its `origin` URL in `source-ledger.csv`; the `local-*` snapshots have no original in this checkout — use the extract or the matching live source.
- `qa/scenarios/` — browser scenarios; `lib/` holds the read-only probe, write-guard and collections no-cache harness.
- `qa/evidence/<date>/` — screenshots, snapshots, console and network logs. Still tracked (≈390 MB, 2026-10-28…30); moving to `.work/qa/` outside Git is planned — do not add new runs here.

## Check

`node .agents/skills/local-maintain-agent-guidance/scripts/qa-coverage.mjs` (schemas, source vs execution coverage) and `validate-guidance.mjs` (links, required files, budgets); live routing probes: `tests/probes.md` in the same skill.
