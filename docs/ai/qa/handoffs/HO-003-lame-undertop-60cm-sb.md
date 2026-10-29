# HO-003: Lame undertop is offered and priced with a 60 cm Sink Base

| Field | Value |
|---|---|
| Risk / severity | S2 (invalid configuration sold) · any Lame vanity with a 60 cm SB |
| Owning boundary | frontend rules/data (verified: option available in UI; rule absent per code reading `R-LAME-ACC-006` not-implemented) |
| Environment / build | staging, `index-B-mLU0_Q.js`, Chrome 156 (write-guard + no-cache harness) |
| Entry | `/prebuilt/model?collectionId=lame` → Create Your Own → Next: Color |
| Frequency | 1/1 |
| TC / rule | TC-LAME-ACC-006 · R-LAME-ACC-006 · open conflict K-CTML-019 (scope wording) |

## Steps
1. Create Your Own (default single SB; countertop length 0.60 m = 60 cm). 2. Next: Color. 3. Expand "Undertop Color", click **On**.

## Expected
Client (gdoc-webgl-live@P0263): "This is not available for vanity configurations that have a 60cm SB cabinet." Undertop should be unavailable (disabled with explanation).

## Actual
"On" is enabled; total changes **$4,477.00 → $5,033.00 (+$556)**; Off restores $4,477.00. Evidence: `docs/ai/qa/evidence/2026-10-28/TC-LAME-ACC-006/` (`04-countertop.txt`, `06-snapshot-expanded.txt`, `10-price-on.txt`, `11-undertop-on-1.png`).

## Suspected root cause
No availability rule for undertop vs SB width in the Lame collection package (`public/collections/lame/`), confidence medium (code reading by the rules pass, not traced line-by-line).

## Requested change
Frontend: add the availability rule (undertop disabled when any SB is 60 cm) with the client message; or record a client decision if K-CTML-019 resolves the scope differently (e.g. only single-cabinet 60 cm vanities).

## Acceptance criteria
- [ ] With a 60 cm SB the Undertop control is disabled with an explanation; price unchanged.
- [ ] Adding the undertop then switching to a 60 cm SB removes it (dependent-change) and restores the price.
- [ ] Non-60 cm SB: undertop available and priced per Lame workbook (oracle `gh-lame-sku`, team copy 2026-10-04).

## Regression tests
TC-LAME-ACC-006 (+ `-NEG`, `-TRA` rows); unit test on the availability rule.

## Open decision
K-CTML-019 — ask the client whether "configurations that have a 60 cm SB" includes multi-cabinet vanities containing one.
