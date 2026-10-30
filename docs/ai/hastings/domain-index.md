# Domain index

Revision 1 · 2026-10-28 · 382 rules in [`domain-rules.csv`](domain-rules.csv) (schema: [`SCHEMAS.md`](SCHEMAS.md)). Find the family row, then filter the CSV by `rule_id` prefix `R-<FAMILY>-<AREA>-`. `URBAN` rules apply to USH, ULH, UD and UFS. Team per-collection contracts: `skills/hastings-<id>/SKILL.md`, `docs/products/<id>.md` (level-3 sources).

Areas: FLOW steps/navigation · CAB cabinets/styles/limits · CT countertop · BAS basin/vessel/faucet · POS positioning/DnD/offset/remote · SP side panels · ACC accessories/legs/undertop · MAT materials/colours · SKU · PRC price · UX messages/tooltips · 3D scene · SAVE persistence.

| Family | FLOW | CAB | CT | BAS | POS | SP | ACC | MAT | SKU | PRC | UX | 3D | SAVE | total |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| USH | 3 | 16 | 5 | 8 | 5 | 10 | 14 | 19 | 1 | 3 | 1 | 1 |  | 86 |
| ULH | 1 | 11 | 19 | 3 | 34 | 4 |  |  | 2 |  | 13 | 3 |  | 90 |
| UD | 1 | 6 | 3 |  | 3 |  | 1 | 4 |  |  | 1 |  |  | 19 |
| UFS |  | 2 | 1 |  | 2 | 1 | 1 |  | 1 |  |  |  |  | 8 |
| URBAN |  | 2 | 4 | 2 | 10 |  |  | 1 | 1 | 3 |  |  |  | 23 |
| CLASS | 1 | 7 | 2 | 7 | 7 |  | 2 | 5 | 6 |  |  | 1 |  | 38 |
| TRICOT | 1 | 8 | 3 | 6 | 6 | 5 | 1 | 6 | 4 |  | 2 | 8 |  | 50 |
| MAKO | 1 | 10 | 3 | 7 | 4 |  | 7 | 1 | 3 |  |  |  |  | 36 |
| LAME | 1 | 6 | 2 | 4 | 4 | 2 | 8 | 3 | 2 |  |  |  |  | 32 |

## P0 rules the code reading marks `contradicts` / `not-implemented` (verify in UI before acting)

| Rule | Code status | Rule (short) | UI result |
|---|---|---|---|
| R-CLASS-CAB-007 | not-implemented | A 60 cm SB with 1DWID is not available when the countertop style is Integrated. | BLOCKED (scene +) |
| R-CLASS-POS-004 | not-implemented | Floating countertop options are available (like Urban Low Height + Duplex), only with thick countertops. | not run |
| R-CLASS-POS-005 | not-implemented | Floating compatibility by basin (thick tops): integrated LB440/LB575/LB856/VA030/VA023/LV890 yes; LB175, LV892 | not run |
| R-LAME-ACC-006 | not-implemented | Undertop is not available for configurations that have a 60 cm SB cabinet. | FAIL TC-LAME-ACC-006 |
| R-LAME-POS-004 | not-implemented | Floating countertop options available only with thick countertops - but Lame has thin countertops only. | not run |
| R-LAME-SP-001 | not-implemented | Side panels follow the pre-render structure (optional panel at the unit end). | not run |
| R-LAME-SP-002 | not-implemented | Side panels match the cabinet pattern. | not run |
| R-MAKO-ACC-002 | contradicts | When legs are used they are positioned only at the left and right ends of the vanity, never in the middle of t | not run |
| R-MAKO-CAB-007 | not-implemented | G50 handle is only available in Metal (Gold/Silver); no lacquered G50. | BLOCKED (G50 absent) |
| R-MAKO-POS-004 | not-implemented | Floating countertop options available only with thick countertops - but Mako has thin countertops only. | not run |
| R-TRICOT-ACC-001 | not-implemented | Inner drawer dividers, same as Class (Metal or Oak). | not run |
| R-TRICOT-BAS-006 | not-implemented | Faucet hole options (0-3) are offered. | FAIL TC-TRICOT-BAS-006 |
| R-TRICOT-CT-001 | not-implemented | On Approve the countertop becomes a Vessel countertop style with the vessel hole cutout, and any SB already in | not run |
| R-TRICOT-POS-004 | not-implemented | Floating countertop options are available, only with thick countertops. | not run |
| R-TRICOT-POS-005 | not-implemented | Floating compatibility by basin (thick): LB175, LV892 and HPL 4" VA024 are not floating-compatible; others and | not run |
| R-UD-CAB-005 | contradicts | Mixing heights: only standard 56H (2DW) cabinets may pair with low 28H cabinets, because abutted drawer height | not run |
| R-UD-CT-003 | contradicts | UD lower countertop (cabinetCover) default colour comes from the Lateral Panel colour (team decision). | not run |
| R-UD-MAT-002 | contradicts | UD contrasting handle groove colour applies. | not run |
| R-ULH-CT-001 | contradicts | A lower SC needs its own countertop whose default material/colour matches the cabinet; user may change it; a o | not run |
| R-ULH-CT-018 | contradicts | Double-basin countertop moved remote: both cabinets change to SC. | not run |
| R-ULH-POS-005 | not-implemented | Stacked units: a 2-drawer look is made by adding a 2nd low-height cabinet beneath; the bottom cabinet must be  | not run |
| R-ULH-SKU-002 | contradicts | Lower-cabinet countertops (offset/remote) need new SKUs in cabinet materials 3D, LACM, LACG, ST, BM, ESS using | not run |
| R-ULH-SP-004 | not-implemented | Stacked SPs: combined 50/56 H (25+25, 28+28) -> one full-height SP; 70/76 H (35+35, 38+38) -> separate SPs, sa | not run |
| R-URBAN-BAS-002 | contradicts | Vessel hole cut-out centre at least 15″ (38 cm) from the countertop end; tops shorter than 32″ keep the vessel | not run |
| R-URBAN-CAB-002 | contradicts | Cabinets not under the main countertop (e.g. OS) have no designated length limit. | not run |
| R-URBAN-POS-010 | not-implemented | Free cabinet movement and countertop offset/remote for all collections when a thick countertop is used. | not run |
| R-USH-MAT-012 | contradicts | Syntesi (first section): 1/2″; 50.5 cm only; 2 colours; select top sizes 60, 70, 80, 90, 105, 120, 140; basins | not run |
| R-USH-POS-005 | not-implemented | USH: cabinets can be remotely positioned and countertops offset/remote when a thick countertop is used (same r | not run |
| R-USH-PRC-002 | contradicts | For now do NOT include the extra 1 cm per side panel when calculating the total countertop length (client TBD) | not run |
| R-USH-SKU-001 | not-implemented | Thick countertops (4″, 5-1/8″, 5-1/2″) need ghost brackets: single basin <=120 cm 2, 121-179 3, 180-220 4, 221 | not run |

## Where else to look

- Conflicts and client questions: [`conflicts-and-decisions.md`](conflicts-and-decisions.md).
- Consumers of an attribute: [`dependency-graph.md`](dependency-graph.md).
- SKU/price expectations: [`sku-price-oracle-map.md`](sku-price-oracle-map.md).
- Comment status per thread: [`comments-ledger.csv`](comments-ledger.csv) ([summary](comments-summary.md)); backlog: [`backlog-ledger.csv`](backlog-ledger.csv) ([summary](backlog-summary.md)).
- Reviewed figures: [`media-review.csv`](media-review.csv) (137 of 313 unique embedded images opened = 43.8 %; 764 files incl. live/local duplicates).
