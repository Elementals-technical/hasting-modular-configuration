# HO-001: ULH "Collection unavailable" for returning users — stale collection JSON from heuristic browser cache

| Field | Value |
|---|---|
| Risk / severity | S1 blocker for affected users (Urban Low Height cannot start at all) · likely for anyone who opened ULH on Phase 2 between 2026-10-12 and the 2026-10-28 deploy (client UAT testers included) |
| Owning boundary | **frontend** (collection loader fetch policy) — verified; **devops/hosting** (static headers for `/collections/*.json`) — contributing, verified by headers |
| Environment / build | Phase 2 staging `hasting-modular-phase-2-staging-ar3wz…`, bundle `index-B-mLU0_Q.js` (= `origin/phase-2/staging` `cd4f3053`); same bundle on `…phase-2-p98qb…`; Chrome 156 (user profile that visited staging on 2026-10-27); viewport 1920×873 |
| Entry | `/prebuilt/model?collectionId=urban-low-height` |
| Scene / asset ids | n/a (fails before the scene starts) |
| Test account role | anonymous |
| Frequency | 3/3 loads in the affected Chrome profile; 0/2 in a fresh profile (Firefox 147 own profile, Chrome with cache-revalidation harness) |
| TC / rule | TC-BASE-ULH-PB, TC-ULH-LOAD-repro · availability of every collection (baseline) |

## Starting state
A browser that loaded ULH on staging before the 2026-10-28 deploy (its HTTP cache holds `/collections/urban-low-height/sku-profile.json` stored 27 Oct 2026 11:07:05 GMT).

## Steps to reproduce
1. In such a browser open `/prebuilt/model?collectionId=urban-low-height` (plain navigation, no hard reload).
2. Observe the error card. Click Retry — same result.

## Expected
The configurator loads ULH with the current deployed data (a fresh profile shows "Urban Low Height · 24" 1-Drawer", total $6,174.00).

## Actual
"Collection unavailable — The collection data is invalid and the configurator cannot start. Collection: urban-low-height". Error object (React state, read-only): `code: "source-validation-failed"`, `SKU profile failed validation: unrecognized_keys ["materialSkus"] at path ["cabinetCover"]` (ZodError). No console output; all requests 200/304.

Evidence (`docs/ai/qa/evidence/2026-10-28/`): `TC-BASE-ULH-PB/12-shot-1.png`, `TC-ULH-LOAD-repro/11-shot-1.png`, `20-collection-error.txt`, `40-static-files.txt`, `50-cache-headers.txt`; fix simulation `TC-BASE-ULH-PB-nocache/`.

## Frontend evidence
- Cached copy used by the app: 8,731 B, `etag W/"8737-315532801000"`, contains `cabinetCover.materialSkus`, response headers `cache-control: private`, `last-modified: Tue, 01 Jan 1980 00:00:01 GMT`, `date: Tue, 27 Oct 2026 11:07:05 GMT`; resource timing `deliveryType: cache`, `transferSize: 0` (served without revalidation).
- Server now: 8,969 B, `etag W/"8969-…"`, no `materialSkus` (= HEAD), `cache-control: no-cache`.
- 4 of 6 ULH collection files differ between cache and server (manifest, sku-profile, product-profile, ui).
- `materialSkus` added in `7f44e30b` (2026-10-12), removed in `515bc1d9` (2026-10-28 05:52 +02:00); the schema rejects unknown keys.
- Loader: `src/entities/collection/lib/loadCollection.ts:542` `defaultFetchJson` → `fetch(url, { signal })` (default cache mode).

## Suspected root cause
Unversioned collection JSON + `Last-Modified` 1980 + (earlier) `cache-control: private` without `max-age` → Chrome heuristic freshness ≈ 10 % of 46 years → the old file is "fresh" and never revalidated; the new bundle's strict schema rejects it. Confidence: **high** (headers, timing, git history, and the fix simulation below).

## Why the frontend should own the fix
The loader decides how collection data is fetched; hosting headers alone do not evict entries already cached by users. A schema relaxation would hide the mismatch instead of loading the current data.

## Requested change
1. Frontend: fetch collection files so they are always revalidated or versioned — e.g. `fetch(url, { signal, cache: "no-cache" })` in `defaultFetchJson`, or a build-version query on every `/collections/` URL.
2. Hosting: keep `cache-control: no-cache` (or `max-age=0, must-revalidate`) for `/collections/**`; avoid the 1980 `Last-Modified` if the platform allows.
3. Tell UAT testers to hard-reload or clear site data for the staging host until (1) is deployed.

## Acceptance criteria
- [ ] In a browser holding the stale entry, ULH loads after the fix is deployed (no manual cache clearing).
- [ ] Network shows conditional requests (304/200) for `/collections/**` on every load.
- [ ] TC-BASE-ULH-PB passes: Summary total $6,174.00 = sum of lines; no error card.
- [ ] Same check for UD, UFS and Class (their files also changed in `515bc1d9`).

## Fix simulation (done, read-only)
With a tab-only init script adding `cache: 'no-cache'` to `/collections/` fetches, ULH loaded and completed the prebuilt flow (Summary $2,003 + $1,063 + $3,108 + $0 = $6,174.00) — `TC-BASE-ULH-PB-nocache`.

## Proposed regression tests
- Unit: `defaultFetchJson` passes a revalidating cache mode (or versioned URL).
- UI: TC-BASE-ULH-PB in a profile with a pre-deploy cache; Firefox fresh profile as control.

## Dependencies / open decisions
None for the fix. Note: affected client testers may report "ULH broken" — not a data problem.
