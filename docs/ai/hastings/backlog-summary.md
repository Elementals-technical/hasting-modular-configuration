# Backlog ledger — summary (2026-10-28)

Inputs: `normalized/sheet-backlog` (live, RAW sha256 `17c72b…`), `local-backlog-xlsx` (`0edeef…`), `sheet-customer-backlog`. [`backlog-ledger.csv`](backlog-ledger.csv): **445 rows, 344 unique**. 101 rows are marked `~dup-of-<root>`: the earlier sheet in workbook order wins, and chains resolve to the root.
IDs: `P2V1-<B>`, `RG-<A>`, `S1-<№>`, `BV2-<#>` (col A on R3–R103/R225+, C on R106–R223), `BV2-P2-<A>`, `S2-<H>`, else `<code>!R<row>`; `CUST-MOD-n`, `CUST-PLAYER-n`.

## Task rows per sheet

| sheet | non-empty | tasks | dup | excluded |
|---|---|---|---|---|
| Backlog - Phase2v1 | 82 | 81 | 0 | header; cols O–W (legend U1:V13, pivot O24:W29) |
| Requirement gap | 9 | 8 | 8 | header |
| Change Request | 2 | 1 | 1 | header |
| Sheet1 | 50 | 48 | 0 | header, R6 separator |
| Backlogv2 | 239 | 218 | 14 | headers R1–2/R261, legend R10/11/13, 12 section labels, R104 totals, R105/R260 markers |
| Sheet2 | 93 | 86 | 78 | 6 section labels, R114 separator |
| customer Модульный/Player | 3/2 | 2/1 | 0 | А-дек 5, 2д 4: other projects |

The 1054-row formatted range is not the task count. Duplicates are matched as follows:
- RG/CR by their `№`.
- BV2-75→43 by its own note.
- BV2-P2-5→P2V1-11 by the same `disco`.
- 12 BV2→S1 by the Sheet2 crosswalk with an identical `disco` or title, or by exact translation (BV2-2/27/28).
- The Sheet2 left block and the R88–R136 block are copies of Sheet1.
- Sheet2 client items → BV2 by `disco` or title.

## Status × sheet

| status | P2V1 | RG | CR | S1 | BV2 | S2 | CUST | unique |
|---|---|---|---|---|---|---|---|---|
| done | 39 | 0 | 0 | 0 | 210 | 0 | 2 | 239 |
| testing | 19 | 2 | 0 | 30 | 1 | 23 | 0 | 51 |
| in-progress | 5 | 0 | 0 | 0 | 0 | 0 | 0 | 5 |
| todo | 5 | 0 | 0 | 0 | 0 | 0 | 1 | 6 |
| returned | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 1 |
| blocked | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 1 |
| unknown | 12 | 6 | 1 | 18 | 6 | 63 | 0 | 41 |

- **Status.** P2V1 uses col H, which is a VLOOKUP of code I. BV2 uses col N, a VLOOKUP of O=SUM(L:M); the `#N/A` on R87 is code 1, so done. BV2 col H is the frontend ✅/❌ flag and is kept as `front=` in `blocker`. Sheet1/Sheet2 have no status column, so status comes from position under the «На тесте» separator; Sheet1 R41–R55 → unknown.
- **Owner.** BV2 L=Oleg; M and Sheet1 H = ALO (assumed).
- **Family.** Taken from the row text (multi-level → ULH); otherwise `unknown` (56 rows). BV2 above PHASE 2, Sheet1 and Sheet2 → USH by context (the phase-1 product).

## Open / blocked / returned (unique)

- Returned: P2V1-51 dnd/countertop — placing a thick top auto-changes the cabinet type.
- Blocked: BV2-60 USH Live Chat (waiting for the client).
- In progress: P2V1-32 side panels floating; P2V1-42 builder max limit (blocker: counting non-primary tops); P2V1-7 ULH D&D in Summary; P2V1-79 CLASS/MAKO countertop colours; P2V1-65 dividers.
- Testing: P2V1-73 UFS side panels; countertop P2V1-38/44/46/52/61/62/80; SB/SC P2V1-53 (offset top)/55/56/66; DnD P2V1-40/60; P2V1-72/76/77/78/82 TRICOT/LAME/CLASS; BV2-43.
- Todo: P2V1-74/75/84 UD, 81 MAKO, 83 LAME legs; CUST-PLAYER-1.
- No status:
  - P2V1-23 ULH multi-level lower top colour.
  - P2V1-24 ULH groove colour.
  - P2V1-47 basin positioning (CR).
  - P2V1-68 D&D SC.
  - P2V1-69 ULH multi-level ends.
  - P2V1-54/57/70 D&D.
  - P2V1-67 ULH «+» (PlayCanvas).
  - BV2-P2-1..4 (P2-3 ULH 2 sinks counted; P2-4 Save/Restore).
- Sheet1 is a stale USH round-7/8 list. Priority rows without a done BV2 twin: SKU S1-1/7/10/11, price S1-40, side panels S1-4/5/6/12, countertop S1-2/3/16/17/43, undo/redo S1-25.

## Live vs local

Both RAW files are 130038 B. All 26 ZIP parts are byte-identical; only the ZIP entry timestamps differ. 4039 non-empty cells or records were compared (sheets + formulas + links): **0 changed status/owner/text cells**.

## Seed anchors

The following seeds cite the correct rows: HC-046 (P2v1!6), HC-050/066 (Sheet1!9), HC-051 (Sheet1!5), HC-052 (Sheet1!10, 11; Sheet2!11), HC-056 (Sheet1!7), HC-059 (P2v1!11), HC-067 (Sheet1!8), HC-074 (Backlogv2!8), HC-075 (P2v1!5).

| seed | cited | actual | correct |
|---|---|---|---|
| HC-012 | Sheet1!12 | S1-16 countertop options lost | Sheet1!R22 (S1-25); P2v1!R25, R43; BV2!R29, R73, R169, R196. P2v1!6 is partial (redo) |
| HC-068 | Sheet1!15 | S1-14 Summary button | Sheet1!R18, R46, R47 (№15 = R5) |

Seeds that cite a sheet without a row: HC-011/070 → BV2!R42, R221, R266, Sheet1!R48; HC-023 → P2v1!R13, R18, R56, Sheet1!R2, R29; HC-069 → BV2!R88.

## External links (341 unique)

| kind | URLs | rows | access |
|---|---|---|---|
| Doc 1QB6Rx `disco=`/tab | 247 | 279 | connector 404; threads need Docs UI |
| take.ms | 47 | 93 | browser |
| Slack | 20 | 21 | workspace login |
| Gyazo | 17 | 16 | browser |
| Drive folders (recordings) | 3 | 3 | account access |
| vivid3d app | 2 | 2 | login |
| prnt.sc, monosnap, Figma, doc 1BtDeZ, hs-sites | 1 each | 5 | browser |

No Loom links. Out-of-scope tabs: 5 Asana, 2 Threekit. Access not checked (no network).
