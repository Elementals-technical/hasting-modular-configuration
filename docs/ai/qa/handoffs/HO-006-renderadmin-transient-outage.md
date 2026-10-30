# HO-006: One transient RenderAdmin failure makes the whole configurator unavailable

| Field | Value |
|---|---|
| Risk / severity | S2 availability (intermittent) |
| Owning boundary | frontend resilience (verified: no automatic retry) · backend availability (suspected) |
| Environment / build | staging, `index-B-mLU0_Q.js`, Chrome 156, 2026-10-28 ≈15:47 local |
| Entry | `/prebuilt/model?collectionId=urban-standard-height` |
| Frequency | 1 of 3 loads in the same minute window |
| TC | TC-OBS-RENDERADMIN-TRANSIENT |

## Actual
`GET renderadmin.vivid3d.tech/configurators/4…`, `/datatables/438`, `/datatables/439` → `net::ERR_FAILED`; UI: "Collection unavailable — The collection data could not be loaded. Please try again." The next two loads succeeded (304); `curl` 200 and CORS preflight 204 from the same machine. Evidence: `docs/ai/qa/evidence/2026-10-28/OBS-renderadmin-transient/` (`first-failure/05-probe.txt`, `a-probe.txt`, `a-net.txt`).

## Expected
No client rule. A transient source error should be retried automatically before the user sees an outage.

## Requested change
Frontend: bounded retry with backoff for collection source loads (`src/entities/collection/lib/loadCollection.ts` remote sources). Backend: check RenderAdmin error logs for ≈15:47 local 2026-10-28.

## Acceptance criteria
- [ ] A single failed source request is retried; the error card appears only after retries fail.
