# T-7: Countertop Color silently removes both side panels (2026-11-02)

Ticket (user, client QA): on Tricot prebuilt, after `No groove` on Accessories, a Countertop Color click removes both panels without a message, the price drops and Accessories shows None.

## Cause

`setupSidePanelListener` (`src/features/sidePanel/lib/sidePanelMiddleware.ts`) reacts to `setCountertopColorSku` and skips the cabinet-type guard for it (added in `19656580` for the Syntesi rule). In a prebuilt model nothing has set `activeCabinetType` or `selectedProductConfig`, so `sidePanelAvailabilityRule` returns an empty `allowed`, `resolveGroove` returns `None` and `applyGrooveToActiveSides` removes the active panels as `auto-removed`.

What decides whether it shows: the first backtrack (Accessories to Countertop in the current step order) fires the Quick Editor auto-select in `PlayCanvasIntegration.tsx`, which fills the cabinet type as a side effect, but only while the hint has not been seen. The seen flag is kept in `sessionStorage`, so **any tab that showed the hint once and loads the page again reproduces the bug on plain desktop**. A fresh tab hides it. It also shows in the ticket's step order (that move is forward) and on 390x844 mobile (the auto-select does not run).

## Fix

In the listener, a countertop colour change counts only for `reasonCode === "syntesi-countertop"`, the only countertop-dependent rule of `selectSidePanelAvailability`; every other trigger counts only on a SP-eligible selected cabinet, as before. Regression test: `src/features/sidePanel/lib/__tests__/sidePanelCountertopChange.test.ts` (6 of 10 red before the fix, 10 green after).

## Browser

Chrome 156 (user profile, `--autoConnect`) through `mcp-smoke.mjs --serve`, own tabs, write-guard + no-cache, 0 blocked writes, Summary not opened. Model `40'' 1-Drawer`. `sceneSP` is the count of enabled scene entities named `*sidepanel*`. Scenarios: `docs/ai/qa/scenarios/tc/LOCAL-T7-*.json`.

| Folder | Build | Viewport, step order | Result |
|---|---|---|---|
| `before-p98qb-desktop-seen-lame` | p98qb `index-BJOaxqLf.js` | Lame 24'' default model, desktop, current, tab that saw the hint | FAIL, the user's steps: Matte White $9,178, HPL (Bianco Kos) $6,440, None, `sceneSP` 10 to 0 |
| `before-p98qb-desktop-seen-tricot` | p98qb `index-BJOaxqLf.js` | Tricot 24'' default model, desktop, current, tab that saw the hint | FAIL: $10,215, Matte White $6,253, None; re-add $8,247; HPL removes again, $8,216 |
| `after-local-desktop-seen-lame` | local, with the fix | same as above | PASS: $9,178, HPL $11,163, `NoG`, both `active`, `sceneSP` 10 |
| `after-local-desktop-seen-tricot` | local, with the fix | same as above | PASS: $10,215, Matte White $8,247, HPL $10,215, `NoG`, both `active`, `sceneSP` 4 |
| `before-p98qb-mobile` | p98qb `index-BJOaxqLf.js` | 390x844 mobile+touch, current | FAIL: $12,841, Matte White $8,791, None, `sceneSP` 4 to 0; re-add $10,786; Bianco Kos removes again, $10,842 |
| `before-p98qb-ticket-order` | p98qb `index-BJOaxqLf.js` | desktop, `ui.json` reordered in the tab | FAIL: $8,791, None |
| `before-local-head-ticket-order` | local HEAD `33da37d0` | desktop, reordered | FAIL: $8,791, None |
| `after-local-mobile` | local, with the fix | 390x844 mobile+touch, current | PASS: $12,841, Matte White $10,786, Bianco Kos $12,841; undo $10,786, redo $12,841; 48'' model $13,508; `NoG`, both `active`, `sceneSP` 4 throughout; `No groove` pressed |
| `after-local-ticket-order` | local, with the fix | desktop, reordered | PASS: $10,786, panels kept |
| `after-local-desktop` | local, with the fix | desktop, current | PASS: $10,786 (same as before the fix) |
| `after-local-lame-mobile` | local, with the fix | Lame 40'' 1-Drawer, 390x844, current | PASS: Matte White $10,261, Bianco Kos $12,333, panels kept |
| `after-local-ush-syntesi` | local, with the fix | USH 24'' 1-Drawer, desktop, current | PASS: `Bianco Matte TAP` (Syntesi) still removes the panels: $7,053 to $4,047, None, `auto-removed` |

SKU requested with the panels: `VAN-TRIC-SP-.8W-15.7H-20.5D-CAB-WDV-932`, the O-TRICOT-002 pattern. The price is compared with the desktop control of the same day, not with the price list.

## Not verified

- Deployed builds: p98qb and staging do not have the fix yet.
- Custom flow, tablet sizes, restore (needs a stored configuration) and T-13.
- Fresh-tab desktop runs at 1024x768 and 1025x768 did not reproduce before the fix, although the mobile media query is `max-width: 1024px`; why 1024 still auto-selects is not established.
- The ticket's starting price is $13,086, here $12,841 (other amounts match); not explained.
- Console: `[error] Failed to compile fragment shader` on the USH page, also recorded on 2026-10-30 (`../../2026-10-30/empty-filters/README.md`); `[useAvailabilityResets] DrawerPanelFluting was not cleared` warning on Tricot before and after the fix. Neither investigated.

Tab lists, network logs and harness logs are not kept here.
