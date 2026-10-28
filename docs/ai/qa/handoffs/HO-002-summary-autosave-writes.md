# HO-002: Opening the Summary page saves the configuration to the backend (no user action)

| Field | Value |
|---|---|
| Risk / severity | S2 (process/data) · every Summary view can create a stored configuration; QA "read-only" runs are not read-only |
| Owning boundary | frontend (verified: code path) · product decision needed |
| Environment / build | Phase 2 staging, bundle `index-B-mLU0_Q.js`, Chrome 156, 1920×873 |
| Entry | `/prebuilt/summary?collectionId=<id>` reached via Next |
| Test account role | anonymous |
| Frequency | Class, Tricot, Lame: 1/1 each; USH, UD, UFS, Mako: 0/1 (no POST observed) |
| TC | TC-OBS-SUMMARY-AUTOSAVE, TC-BASE-CLASS/TRICOT/LAME-PB |

## Steps
1. Fresh load of `/prebuilt/model?collectionId=class`. 2. Next until Summary. 3. Do not click Share, Quote or How to Buy.

## Expected
Unknown — no client rule. A "view" step is expected to be side-effect free unless the product decides otherwise.

## Actual
`POST https://renderapi-dev.vivid3d.tech/modular/configurations/store` → **201** right after Summary renders (network evidence `docs/ai/qa/evidence/2026-10-28/TC-BASE-CLASS-PB/92-network.txt` reqid 1971, Tricot reqid 2297, Lame reqid 3045). The QA baseline therefore created **3 configuration records on the dev backend on 2026-10-28** before a write-guard was added; their ids were not captured.

## Frontend evidence
`src/pages/prebuilt/summary/SummaryPage.tsx` effect at ≈L1536–1585: when the URL has no `configId`, it builds the request, hashes it (ignoring `savedAt`) and calls `saveConfiguration(request)` to obtain a share link ("[Summary Share]"). Separately, How to Buy (`src/features/bottomStickyBar/ui/BottomStickyBar.tsx` `prepareHowToBuyConfiguration`) saves on click.

## Suspected root cause / notes
Design choice to have a link ready for QR/quote. Confidence high for the trigger. Why only 3 of 7 families posted is unexplained: `buildConfigurationRequest` may return null for the others (then their Summary has no share link) — **unverified**.

## Requested change / decision
1. Product owner: confirm whether Summary may create records automatically; if not, save only on Share / Quote / How to Buy.
2. Frontend: explain/verify the families without a POST (share link present?).
3. Backend owner: decide whether the 3 test records from 2026-10-28 should be cleaned up (created ≈15:30–15:40 local, Class/Tricot/Lame default models).

## Acceptance criteria
- [ ] Behaviour documented; if removed, Summary view sends no non-GET request until a user action.
- [ ] Share/Quote still produce a working link (TC to add).

## QA mitigation already in place
All later Chrome runs use `docs/ai/qa/scenarios/lib/write-guard.js` (blocks non-GET in the agent tab; logged in `window.__blockedWrites`). Firefox runs avoid the Summary page.
