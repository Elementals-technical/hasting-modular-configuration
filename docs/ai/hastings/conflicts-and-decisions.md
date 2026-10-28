# Conflicts and decisions

Revision 1 · 2026-10-28 · generated from [`conflicts.csv`](conflicts.csv) (75 rows: Urban `K-URB-*` 40, Class/Tricot/Mako/Lame `K-CTML-*` 35). The agent records conflicts; it never decides them. Full anchors and quotes: the CSV.

## Decision protocol

- Source hierarchy (team Notion hub, updated 2026-10-04): level 1 = client primary documents (Urban Standard Height Logic, Hastings Scoping 2) and written client answers; level 2 = client live sites (Design Ideas, 2D configurator) for look and options; level 3 = team-derived material (Config Guide, tasks, repo docs) — level 3 never overrides level 1.
- A later dated client answer (comment/Q&A) supersedes an earlier document statement only when it names the same case; otherwise the conflict stays `open`.
- Code is evidence of current behaviour, not of the requirement. Team docs (`docs/products/*`) are level 3.
- An open P0 conflict makes dependent test cases `BLOCKED` (see `../qa/ui-test-matrix.csv`) and requires a client question; record the answer's anchor in `decision` and set `status=decided`.

## Counts

By priority/status: {('P0', 'decided'): 1, ('P0', 'open'): 42, ('P0', 'superseded'): 1, ('P1', 'decided'): 2, ('P1', 'open'): 19, ('P1', 'superseded'): 2, ('P2', 'decided'): 1, ('P2', 'open'): 4, ('P2', 'superseded'): 3}. By family: {'ALL': 4, 'CLASS': 7, 'LAME': 6, 'MAKO': 8, 'TRICOT': 10, 'UD': 4, 'UFS': 1, 'ULH': 15, 'URBAN': 12, 'USH': 8}.

## Open P0 conflicts — questions for the client

| ID | Family | Topic | Question |
|---|---|---|---|
| K-URB-001 | ULH | Thickness allowed for offset / remote countertops | Please confirm one matrix: (a) top resting on cabinets but shifted, basin still over its SB: 4″/5⅛″/5½″? (b) top shifted so an integrated basin is off its SB: 5⅛″/5½″ only? (c) same with a vessel: is 4″ allowed (C69) even though r |
| K-URB-002 | ULH | 2.4″ (Porcelain 2-3/8″) top allowed to slide (offset) | May a 2-3/8″ Porcelain top be shifted (offset) along the cabinets while the basin stays on its SB, or must 2-3/8″ behave like thin tops (no movement)? |
| K-URB-003 | URBAN | Lower countertop (cabinetCover) material, default colour and SKU | Is the lower top offered in cabinet finishes (3D/LACM/LACG/ST/BM/ESS, default = cabinet colour, checkbox 'match countertop') or in countertop finishes? Which price list rows exist for 0.5″ lower tops in each material? For Urban Du |
| K-URB-004 | ULH | Length of the lower countertop (production + price) | Confirm: is the lower top produced and priced at the exposed (uncovered) length (Block 2 answer) or at the full lower-cabinet length (comment C33, option 1)? If they differ, which length goes in the SKU W token? |
| K-URB-005 | URBAN | Side panel +1 cm per side in countertop length | Should the countertop SKU/price width include +1 cm per side panel (P0188) or not for now (P0730)? Should SP options be blocked when cabinets + panels exceed the material max length? |
| K-URB-006 | URBAN | Maximum two Sink Bases | Confirm the hard limit of two Sink Bases per vanity (all Urban collections), including tandem/remote vanities that each carry their own top. |
| K-URB-007 | ULH | Double-basin top moved remote: cabinet conversion | Confirm both SBs must become SCs when a double-basin top is lifted remote, and whether the move should be blocked until the scene supports it. |
| K-URB-008 | ULH | SB->SC auto conversion: size list and return blocking | Bug evidence, no decision needed: confirm expected tooltip text for blocked return and whether the SC keeps its old width when converted back. |
| K-URB-009 | URBAN | Offset/remote and free movement scope (USH, UFS) | For Phase 2, must Urban Standard Height offer countertop offset/remote and free cabinet movement with 4″/5⅛″/5½″ tops (single row only)? Is Urban Freestanding excluded because it is thin-only? |
| K-URB-010 | USH | Syntesi sizes and basins (two sections in the same doc) | Is a 140 cm Syntesi top and a 58 cm Syntesi basin (min SB 70) offered, or only Syntesi 48 on single SBs 60-120 cm? |
| K-URB-011 | UD | Open Side Shelf handle restriction in Urban Duplex | In Urban Duplex, may Open Side Shelves be used next to the Upper Groove cabinets (no PTO option exists)? |
| K-URB-012 | UD | Mixing standard 56H with low 28H cabinets | Confirm: 56H 2DW next to 28H 1DW (top-aligned, drawer lines matching) must be allowed; every other height mix (56+38, 53+28, 53+38) refused? |
| K-URB-013 | UD | Stacking in Urban Duplex | May low-height UD cabinets (38H on 28H, 28H on 28H) be stacked, or is stacking unavailable in UD altogether? |
| K-URB-014 | URBAN | Cabinet heights allowed for offset / multi-level | Does comment C34 (all heights incl. 53H/56H) apply to the offset countertop concept in any collection, given Block 2 excludes UD 53/56H from offset? |
| K-URB-015 | ULH | Remote composition multi-level vs 2-row rule | Under a remote (floating) top, may the lower cabinets form two rows, or must they be a single abutted row? |
| K-URB-017 | URBAN | Vessel hole cut-out edge distance | Confirm the 15″ (38 cm) is measured from the cut-out centre to the countertop end, applies in every mode (standard/offset/remote, D&D basin move), and the <32″ exception centres the hole. |
| K-URB-018 | URBAN | Length limit for cabinets not under the main countertop | Should the lower row (not under the main top) be unlimited, or limited by its own lower-top material max (when it carries an SC top)? |
| K-URB-020 | USH | Side panel groove options for 2-drawer cabinets | Is a 1-groove side panel valid next to a 56H 2-drawer Upper Groove cabinet? If yes, which SP SKU/height? |
| K-URB-022 | URBAN | Porcelain thin thickness (3/8″ vs 1/2″) and UFS thin tops | Is Porcelain's thin top 3/8″ or 1/2″? For UFS, which materials come in 0.4″ and which in 0.5″? |
| K-URB-023 | USH | Mineralmarmo / Tekormud 46 cm depth | At 46 cm depth, are Mineralmarmo and Tekormud available (vessel only? integrated?) or 50.5 cm only? |
| K-URB-024 | USH | Tekorlux Ron 50 single-cabinet / no side panels | Is Tekorlux Ron 50 single-cabinet only and incompatible with side panels, or is this a data-table error copied from Syntesi? |
| K-URB-025 | URBAN | Countertop materials for Urban Duplex and Urban Freestanding | Which countertop materials/basins are sold for UD and UFS (all USH materials or only Tekorlux/HPL/Fenix/Porcelain)? Is there a UD/UFS countertop price list? |
| K-URB-026 | ULH | ULH Open Shelf widths | Do ULH Open Shelves exist wider than 70 cm (80-120 cm) at 28/25 cm height? |
| K-URB-027 | UFS | Short floor cabinet price | Please confirm the 1DW short cabinet rows were loaded into the price backend (sheet ref) and the SKU spelling (height 22H/20.9H, SC type code). |
| K-URB-028 | ULH | Stacked units in ULH | Confirm ULH stacking (SB on SC, SC on SC) is in Phase 2 scope, with combined-height side panels per comment C40. |
| K-URB-030 | ULH | SB moved with its own thin/thick top triggers trap error | Bug evidence: confirm the trap keep-out must ignore the SB that hosts the trap (moving together with its top). |
| K-URB-032 | URBAN | Remote lower cabinet shallower than the countertop | Must remote lower cabinets be allowed a different (shallower) depth than the upper cabinets/top? Which depth does the lower top take? |
| K-URB-033 | ULH | Remote SC moved under the trap | When a remote SC is dragged under the trap: auto-convert to SB (with basin/trap centring) or block? |
| K-URB-035 | UD | Urban Duplex handle groove colour | Is the UD groove colour an independent choice (contrasting) or always the Lateral Panel colour? How is it priced? |
| K-CTML-001 | MAKO | Floating countertop (thick only) vs Mako thin-only tops [doc-vs-doc] | Mako is sold with thin tops only, yet the logic doc offers floating tops 'only with thick countertops'. Should Mako offer a floating/offset countertop at all? If yes, which thick materials/thicknesses (and SKUs/prices) are sold fo |
| K-CTML-002 | LAME | Floating countertop (thick only) vs Lame thin-only tops [doc-vs-doc] | Same as Mako: should Lame offer a floating/offset countertop? If yes, with which thick tops and how does the undertop/legs logic apply to it? |
| K-CTML-003 | ALL | Class/Tricot (all GB): cabinets abutted only vs free movement and offset/remote tops with  | For Class and Tricot with a thick top (3.1/4/4.7), should users (a) float/offset the countertop only, or (b) also move cabinets freely with the Urban Low Height D&D rules (SB->SC auto-change, 4" lateral only, 10 cm / 15" basin-edg |
| K-CTML-005 | MAKO | Leg position: outer ends only vs legs on every cabinet [client-vs-code] | For a multi-cabinet Mako vanity, is there exactly one leg set at the outer left and outer right ends regardless of cabinet count/width (no mid support even at 220 cm)? |
| K-CTML-006 | MAKO | G50 handle Metal only [client-vs-code] | When a user switches G57 -> G50 while a lacquered handle colour is selected, should the handle colour reset to a Metal default (Silver or Gold?) automatically or ask for confirmation? |
| K-CTML-009 | TRICOT | SB 1DWID 60 cm with Integrated top: Approve/Cancel modal -> Vessel vs silent refusal [clie | Confirm the modal wording and that Approve switches the whole countertop to Vessel with cutout only ('None') or a default vessel on every SB. Does the same modal apply to Class (same rule at gdoc-webgl-live@P0030) and to switching |
| K-CTML-010 | CLASS | SB 60 cm 1DWID not available with Integrated top [client-vs-code] | Should Class use the same Approve/Cancel modal as Tricot (switch to Vessel with cutout), or simply disable the option? |
| K-CTML-019 | LAME | Undertop 60 cm restriction scope [doc-vs-doc ambiguity / code] | Does the undertop restriction apply when any 60 cm cabinet is present, only a 60 cm Sink Base, or only a single 60 cm vanity? When a 60 cm SB is added later, is an existing undertop removed automatically with a message? |
| K-CTML-020 | LAME | Side panels (pattern-matched) not implemented; undertop length must include panels [client | Lame side panels: one per end or both ends, thickness (5 cm each as the 120+10 cm undertop example suggests?), SKU/price (VAN-LAMEV-SP-...), and does the panel show the cabinet pattern on its outer face? |
| K-CTML-023 | MAKO | Leg quantity / unit of the leg price [client-vs-team-doc] | Is $745 / $1,340 per single leg or per set, and how many legs does a composition take (2 = one per end, or 4 = front+back at each end)? |
| K-CTML-024 | ALL | VA030 (SS Texturizzato) offered or not [doc-vs-doc / code] | Is VA030 (SS Texturizzato) offered for Class, Tricot, Mako and Lame? Which Solid Surface colours are Texturizzato? |
| K-CTML-026 | CLASS | Cabinet Color palette must be the Class pre-render list [client-vs-code] | Confirm the Class front palette (Lacquered MT/GL, Smoke glass, Porcelain, Glass MT/GL, Laminates per the pre-render) so configurator 8 can be corrected. |
| K-CTML-035 | TRICOT | Solid Surface header with Technolite / Technomat and Matte White price group [client-vs-te | Confirm Matte White = SS Technolite (SSTL, 0.5"/4.7") and Matte White 8cm = SS Technomat (SSTMT, 3.1", VA023), and the labels to show under the 'Solid Surface' header. |

## Implementation drift found during setup (frontend, not client conflicts)

| Topic | Evidence | Owner |
|---|---|---|
| Class configurator id 8 in `public/collections/class/manifest.json` vs 9 in `docs/products/README.md`, `docs/ecosystem-map.md` | commit `0cf03981` | team docs |
| `docs/products` lacks pages for UFS, Tricot, Lame | repo tree | team docs |
| "220 cm" noted as "not expressible yet" in Class/Mako/Lame profiles, but enforced via remote countertop tables | rules agent: `R-*-CAB` rows, `useCountertopLengthGuard` | team docs |
| ULH collection JSON cached heuristically; strict schema rejects stale data | HO-001 | frontend + hosting |
| Summary page saves the configuration automatically | HO-002 | frontend (product decision) |
