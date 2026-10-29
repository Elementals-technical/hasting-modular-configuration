# Hastings knowledge schemas

Machine-checked by `.agents/skills/local-maintain-agent-guidance/scripts/qa-coverage.mjs`. CSV: UTF-8, header row, RFC 4180 quoting. Pipeline: RAW (backup store `sources/raw/<source_id>/`) → NORMALIZED (`normalized/<source_id>/`) → DERIVED (files below). Anchors: `<source_id>@P0001` (1-based paragraph over all `w:p`, tables included — same scheme as `HASTINGS_AGENT_HANDOFF/SOURCE_EXTRACTS`), `<source_id>#C12` (comment), `<source_id>!<sheet>!R<row>` (sheet row).

## Enums

- `family`: `USH` `ULH` `UD` `UFS` `CLASS` `TRICOT` `MAKO` `LAME` `URBAN` (all four Urban) `ALL`
- `status_class` (rules and comments): `normative` (client logic doc body), `approved`, `proposed`, `superseded`, `question`, `conflicting`, `bug-evidence`, `resolved-unverified`, `unknown`
- `code_status`: `implemented` `partial` `not-implemented` `contradicts` `unknown` (always with `code_path` when not `unknown`)
- `priority`: `P0` `P1` `P2`
- TC `status`: `NOT_RUN` `PASS` `FAIL` `BLOCKED` `UNKNOWN`

## domain-rules.csv

`rule_id,family,area,rule,condition_exception,trigger_effect,ui_effect,scene_effect,sku_price_effect,source_anchor,source_revision,status_class,priority,code_path,code_status,observed_ui,counterexample,conflict_ref,notes`

- `rule_id`: `R-<FAMILY>-<AREA3>-<NNN>`, e.g. `R-ULH-POS-004`. `area`: `FLOW` `CAB` `CT` `BAS` `POS` `SP` `ACC` `MAT` `SKU` `PRC` `UX` `3D` `SAVE`.
- `source_anchor`: one or more anchors separated by `;`, quoting no more than needed.
- `observed_ui`: TC ids or `not-run`.

## conflicts.csv

`conflict_id,family,topic,norm_a,norm_b,code_behaviour,priority,question_for_client,status,decision`

`norm_a`/`norm_b`: anchor + short quote. `status`: `open` `decided` `superseded`. `decision` only with an anchor of the client's answer.

## comments-ledger.csv

`comment_id,source_id,thread_root,kind,author,date,anchor,family,topic,text_excerpt,status_class,live_state,rule_ref,backlog_ref,dedup_of`

`kind`: `docx-comment` `sheet-note` `backlog-row`. `live_state`: `open-in-live-export`, `local-only` (absent from live export: resolved or deleted, unverified), `live-only`, `unknown`. `dedup_of`: the canonical comment id when this row duplicates another source.

## backlog-ledger.csv

`task_id,source_anchor,sheet,title,type,status_raw,status,owner,family,topic,links,blocker,rule_ref,tc_ref`

`status`: `done` `testing` `in-progress` `todo` `returned` `blocked` `unknown`.

## sku-oracle.csv

`oracle_id,family,component,sku_pattern,example_sku,source_anchor,price_source,price_example,code_path,code_status,notes`

## ui-test-matrix.csv (in `../qa/`)

`TC_ID,requirement_id,source_revision,family,mode,preconditions,selections,actions,expected_ui,expected_scene,expected_sku,expected_price,observed,environment_build_viewport,evidence,status,owner,regression_links,risk,technique,seed_ref`

- `mode`: `prebuilt` `custom` `restore` `any`. `technique`: `positive` `negative` `boundary` `transition` `metamorphic` `pairwise` `smoke`.
- An executed row (`PASS`/`FAIL`) needs `observed`, `environment_build_viewport` and `evidence`. `PASS` needs an expected value or oracle; otherwise `UNKNOWN`.

## media-review.csv

`source_id,media,anchor,rule_ref,what_it_shows,implication,reviewed_by,reviewed`
