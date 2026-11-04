# HO-011: Urban Duplex nominal Depth 50 produces 50.5 cm cabinets and a 50 cm countertop

Date: 2026-11-03. Status: OPEN — scene geometry contract requires reconciliation; the frontend now sends catalog-valid nominal depth 50 for Multi-Level presets.

| Field               | Value                                                                                                                |
| ------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Risk / severity     | S3 geometry mismatch; nominal depth also feeds SKU/pricing                                                           |
| Owning boundary     | PlayCanvas depth geometry rules — verified mismatch; intended physical depth needs owner/source confirmation         |
| Environment / build | Local localhost:5174, frontend HEAD b0401683 plus the five preset depth corrections; Chrome 156, 1920×936            |
| Entry               | `/prebuilt/model?collectionId=urban-duplex&preset=44`, `Urban Duplex · 70" 1-Drawer Multi-Level`                     |
| Scene identity      | `Hasting-phase-2-stage-v99`; `js/esm.mjs` SHA-256 `2b47c0839047ecce6dffade1ed7bdae34b0928b29a2b31081782c2daf97bfa91` |
| Product / key       | `UD-sink-cabinet`, `UD-side-cabinet`, `UD-open-shelves`, `Top_Solid`, `Cabinet_Cover`; nominal `Depth: 50`           |
| Frequency           | Observed after fresh preset 44 load and settled geometry; all five Multi-Level presets apply the same depth rules    |
| Rule                | R-UD-POS-003; cabinet matrix 594 nominal depths 46/50; products/rules require connected depths to agree              |

## Starting state and reproduction

1. Use the frontend with Multi-Level preset shared depths corrected from unsupported 50.5 to nominal 50.
2. Open preset 44 in a fresh document and wait for imported products and geometry to settle.
3. Read scoped `cabinets.getState`, `countertop.getState`, `cabinetCover.getState`, and enabled mesh bounds.
4. Compare the cabinet fronts and OS side walls with the upper and lower countertop front edges.

## Expected contract and source decision

Nominal depth is 50 cm: client `Pre-Render | Hybrid Models` gives 19.7D for the 61", 70" and 94" models; [pricing specification](../../../products/urban-duplex/pricing.md) defines 50 cm as 19.7D. Matrix 594 accepts 50/46. The shared UniOpenShelves size-rule image supplied by the user separately names a physical deep variant 50.5 cm. These are distinct layers: confirm the intended physical carcass/front/countertop depth and any deliberate overhang before modifying geometry constants. In either convention, connected parts should obey one agreed depth/overhang contract.

## Actual and frontend evidence

- Runtime cabinet selections all have `Depth: 50`; upper countertop size depth is 49.999998 cm and lower cover depth is approximately 50.00006 cm.
- Enabled drawer front `UD_Handle_BaseP_Bot` reaches z≈50.500064 cm. OS side wall reaches z≈50.500042 cm, with a total depth≈50.500002 cm.
- Drawer cabinet and OS `smartStretch.stretchAmount.z` are 0.045. The base 46 cm geometry consequently gains 4.5 cm, while the countertop gains only 4 cm.
- Thus the earlier 4.5 cm countertop protrusion is removed, but a 0.5 cm front-edge mismatch remains. Do not describe the entire geometry issue as fixed.
- Upper countertop length is 85.05 cm over OSS15 + SB70 + a 0.05 cm gap; lower cover length is 90 cm over SC90. An independent excessive length along X was not reproduced.
- Local evidence: `.work/ud-preset-analysis-2026-11-03/fix/preset-44.json`; other five-preset probes and the before-fix report are in the same local evidence directory. These files are not committed artifacts.
- Frontend regression verifies compact products inherit catalog-valid effective depth. `Model → Customize` for preset 64 preserves three modules at Depth50, and the read-only compact export retains shared.Depth50.

## Root cause and ownership

The shipped `RuleDepthCabinetUrbanDuplex` and `RuleDepthUDOpenShelves` accept depth 50 but use a 0.045 m stretch delta, while the countertop layout applies nominal depth as 0.50 m. This is a verified scene mapping discrepancy after removing the invalid frontend input 50.5. The desired physical dimension is a source/owner decision, not established by a state value alone.

Frontend must retain valid nominal depth for commands, SKU and persistence. It cannot safely scale foreign meshes or assign a different countertop depth solely to hide this mismatch. Canonical scene/source and generated export are read-only under this checkout's AGENTS.md.

## Requested owner change and acceptance

- [ ] Decide and document nominal depth versus physical geometry and allowed countertop overhang for UD, including OS/OSS and hybrid drawer cabinets.
- [ ] Reconcile the scene's depth transforms and countertop/cover layout against that decision; preserve nominal SKU values and connected-depth rules.
- [ ] Verify both 46 and 50, all five Multi-Level presets, flat UD controls, hybrid handles, basins and covers.
- [ ] Deliver through canonical source → scene export; identify the actual loaded export before rerunning embedded UI acceptance.
- [ ] Confirm scene layout export/restore and SKU depth tokens remain consistent. Missing independent price cells remain BLOCKED.

No scene/source/export changes were made in this frontend task. This handoff does not authorize a renderer edit or select the physical-depth convention on behalf of the product owner.
