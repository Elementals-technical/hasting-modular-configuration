# HO-005: Class/Tricot/Mako/Lame step structure differs from client logic (Faucet Details, Accessories)

| Field | Value |
|---|---|
| Risk / severity | Tricot: S2 (P0 rule: faucet holes not offered at all); Class/Mako/Lame: S3 (P1: no Accessories step; legs/dividers placement) |
| Owning boundary | frontend `public/collections/<id>/ui.json` (verified by observed step paths) · client decision for placement (K-CTML-012) |
| Environment / build | staging, `index-B-mLU0_Q.js`, Chrome 156 + Firefox 147 (Tricot/Mako) |
| Frequency | 1/1 per family |
| TC / rule | TC-TRICOT-FLOW-001, TC-TRICOT-BAS-006, TC-CLASS-FLOW-001, TC-MAKO-FLOW-001, TC-LAME-FLOW-001, TC-OBS-CTML-FAUCET-DEFAULT |

## Observed step paths (prebuilt, Next from Model)
- Tricot: Cabinet Finishes → Accessories → Countertop & Basin → Summary (**no Faucet Details**).
- Class / Mako / Lame: Color → Countertop & Basin → Faucet Details → Summary (**no Accessories**; Mako legs not offered for the default 1DW — legs are 2DW-only).
- Class/Mako/Lame Faucet Holes: options 0–3 present, **none pre-selected**, Summary shows **no faucet line** (Urban families show "Faucet Holes 0 $0.00").

Evidence: `docs/ai/qa/evidence/2026-10-28/TC-BASE-{TRICOT,CLASS,MAKO,LAME}-PB/smoke-log.json`, `*/41-options.txt`, `*/90-summary.txt`.

## Expected
- Tricot: R-TRICOT-BAS-006 (faucet holes 0–3) and R-TRICOT-FLOW-001 (Accessories before Faucet Details, Faucet Details before Summary; DF1 P0012–13).
- Class/Mako/Lame: R-*-FLOW-001 (Accessories step before Faucet Details) — placement of legs/undertop is an open conflict K-CTML-012.

## Requested change
1. Frontend: Tricot — add Faucet Details step (0–3) and order per client.
2. Client decision K-CTML-012, then frontend adds the Accessories step for Class/Mako/Lame (dividers; Mako legs; Lame legs/undertop/panels as decided).
3. Frontend: decide a faucet default (0 like Urban) and show the faucet line in Summary consistently.

## Acceptance criteria
- [ ] Step paths match the client order per family; Summary lists faucet holes for every family.
- [ ] Price/SKU unchanged by step reordering (metamorphic).
