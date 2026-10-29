# HO-007: Firefox — USH page blank (inconclusive, needs manual check)

| Field | Value |
|---|---|
| Risk / severity | unknown (possible S1 for Firefox users of the default collection) |
| Owning boundary | unknown — not enough evidence |
| Environment | Firefox 147.0.3, dedicated MCP profile, staging `index-B-mLU0_Q.js` |
| Frequency | 2/2 automated loads |
| TC | TC-XB-FF-USH (UNKNOWN) |

## Observed
`/prebuilt/model?collectionId=urban-standard-height`: page text 0 chars after 18–25 s, screenshot dark/blank, **0 console messages**, in the second run the tab disappeared from the page list; no crash dump in the profile. Other families (Tricot, Mako, ULH, UD) render in the same profile. Evidence: `docs/ai/qa/evidence/2026-10-28/TC-XB-FIREFOX-001/USH-03-shot.png`, `TC-XB-FIREFOX-002/USH-03-shot.png`.

## Why not a defect yet
The Firefox MCP (0.10.7) on Firefox 147 lacks script tools; tab handling in the run was irregular. Could be harness, Firefox 147 or the app.

## Requested action
Open the USH URL manually in a current Firefox; if blank, capture `about:crashes`, the console and a profiler recording, then re-file to the right owner.
