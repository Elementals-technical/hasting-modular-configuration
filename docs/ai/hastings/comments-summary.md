# Comments ledger summary (2026-10-28)

`comments-ledger.csv`: 413 rows = 262 docx comments + 151 sheet notes. 308 are unique; 105 carry `dedup_of`. Root rows carry the whole-thread class.

## Counts: source × status_class × live_state

| source | n | thr | appr | prop | supd | ques | conf | bug | r-u | unk | open | live-only | unk(state) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| gdoc-1QB6Rx-dev-feedback | 88 | 28 | 16 | 5 | | 6 | 1 | 14 | 32 | 14 | 51 | 37 | |
| local-devfeedback | 48 | 22 | 7 | | | | 1 | 10 | 21 | 9 | 48 | | |
| local-devfeedback-2 | 3 | 2 | | 2 | | | | | | 1 | 3 | | |
| gdoc-151UdA-ush-original | 45 | 38 | 23 | 1 | 8 | 7 | 4 | | | 2 | 45 | | |
| local-ush-original | 45 | 38 | 23 | 1 | 8 | 7 | 4 | | | 2 | 45 | | |
| file-ulh-clarification-live | 7 | 7 | | | | 5 | | | | 2 | 7 | | |
| local-ulh-clarification | 7 | 7 | | | | 5 | | | | 2 | 7 | | |
| file-phase2-questions-b2 | 19 | 8 | 8 | | 2 | 3 | | | | 6 | 19 | | |
| sheet-ct-basin-rules | 24 | 24 | 16 | | | | | 2 | | 6 | 8 | | 16 |
| sheet-ct-basin-rules-gb | 3 | 3 | | | | | | | | 3 | 3 | | |
| sheet-ush-sku-price | 80 | 64 | 25 | 2 | 1 | 2 | | 39 | | 11 | 32 | | 48 |
| sheet-class-sku | 14 | 10 | 6 | 2 | | 1 | | 2 | | 3 | 10 | | 4 |
| sheet-tricot/mako/ufs-sku | 7 | 7 | | | | 1 | | | | 6 | 6 | | 1 |
| sheet-list-material | 15 | 15 | 3 | | | | | | | 12 | 14 | | 1 |
| sheet-handle-cabinet-options | 8 | 8 | 1 | | | | | | | 7 | 8 | | |

local-devfeedback-1 has 0 comments. No row is `local-only`.

## Bug-evidence threads
- DF#C3 ALL: How-to-buy HubSpot form had the wrong form, a spam/unregistered domain and a config URL that was not captured (C9, C11, C14, C27). It now works; the swatch-form fields are unconfirmed.
- DF#C41 URBAN: switching Fenix 5.1" to Porcelain 5.5" resets the top to .5" (C43).
- DF#C48 ULH: lower-level width options are limited (C50).
- DF#C51 URBAN: the 19.7" top is slightly short and not flush with the OS cabinet (C53).
- DF#C61 URBAN: after SB→SC, the Intraplayer shows only SB widths (C63).
- DF#C72 URBAN: the D&D move is still blocked for the OS cabinet (C74).
- 43 sheet notes, all resolved (done=1) except ush BasinStylePrice!H122:
  - ush CounterTopPrice I8–I11, I14, I28, I29, H11, H28, H29.
  - ush BasinStylePrice H5, H13–H34, H44–H47, H57–H60, H99–H102, H108, H109, H120, H122 (price missing, mostly 4" tops).
  - ush CabinetsPrice L8, L13, L15.
  - class CountertopPricing I15, I16.
  - ct-basin-rules D10 (18.1" depth) and C7 (4" missing).

## Conflicting threads
- DF#C64 URBAN countertop-thickness: P0249 allows 4" only with an integrated basin in an SB; C69 allows 4" only with Vessel style. ULH P0039 says Vessel OR SB; P0485/P0514 leave Vessel out. Dev implemented the SB-only rule (C65).
- USH#C27–C29 ULH cabinet-depth: body says "Depths: 46cm" (P0764/P0773/P0778); the comment says "Already made 50.5cm".
- USH#C33 ULH lower-countertop-length: the comment prefers option #1 (full length); Phase 2 Q P0094 prices by the uncovered portion.

"." markers with no reply (unknown) sit on client defect text in the doc body: DF#C59 (CR #47), C77, C80–C84 and C85 (MAKO legs).

## Needs the Google Docs UI (resolved = not exported)
- local-only: **0**. All 103 local comments are still in the live exports, so the snapshots give no resolved or deleted candidates.
- Backlog disco links whose thread is missing from the live DF export (resolved or deleted): P2V1 #11–14, 19, 35, 37, 41, 43, 45, 48–50, 56, 58–60, 62, 66 and Requirement gap R3–R5, R9. Older links: 203 in Backlogv2 and 22 in Sheet2. 221 distinct disco ids.
- ULH#C4 → related thread disco=AAACHTfN3mY, which is not in the export.
- USH: the export has no threading or resolution flag. Threads were rebuilt by anchor (C18/19, C20/21, C22/23, C31/32, C39/40, C42–44). Open TBDs: C1, C8, C10, C11, C25, C38, C43.
- DF tab 1 (C0–C36) is `live-only` only because that tab has no local snapshot.

## Dedup map
- local-devfeedback 48 → DF C37–C84. Matched on author, second, text and anchor text. local-devfeedback-2: 3 → DF C85–C87.
- local-ush-original 45 → gdoc-151UdA, 1:1. local-ulh-clarification 7 → live, 1:1.
- USH#C39/C40 and their local copies → Phase 2 Q #C15/#C16 (stacked side-panel Q&A).
- Copies within one source (no `dedup_of`): USH C20/21 = C18/19; C32 = C31; list-material A1 #1/#2.

## Conventions
- IDs: docx `<src>#C<n>`; sheet `<src>!<sheet>!<cell>#<k>`, where k is the order within the cell.
- Sheet notes come from raw XLSX threadedComments (author, date, done). done=1 → `live_state=unknown` plus an excerpt prefix `[resolved]` (the enum has no resolved state). 66 of 131 sheet threads are resolved; 37 notes are bare "link to" (unknown).
- `backlog_ref` = `task_id` from backlog-ledger.csv, joined on source_anchor. Phase2v1 rows were mapped by exact title = heading (disco ids follow comment dates); BV2-51/59/60 are How-to-buy and Live chat. Phase 2 Q #C7 → RG R10 is inferred.
- `rule_ref` holds the related or conflicting norm anchors. The GB sheet uses family ALL (Class/Tricot/Lame/Mako, no enum value).
