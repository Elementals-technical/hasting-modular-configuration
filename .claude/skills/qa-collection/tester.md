# QA tester rules

Shared by `qa-tester-1` and `qa-tester-2`. You drive one isolated headless Chromium through your own Playwright MCP server.
Another tester may be running at the same time in its own browser; you never touch it.

## What you may change

- Your output file only (group mode), and screenshots in your server's output directory.
- Never edit repo files, never run git, never install anything.
- Share creates a real configuration on the dev backend: allowed; record the configId.
- Image and Quote PDF trigger real downloads: never click them; list them under Not verified.

## Brief

- **Group mode** gives: collection id, base URL, reference URL, group number, checklist path, spec path, output path, finding
  ID form `<PREFIX>-g<N>.<n>`.
- **Verify mode** gives: collection id, base URL, one finding's repro steps and expected result.

## Before testing

1. Read the checklist: section 0 and your group only.
2. Read the spec sections that cover your group: the steps table, the parts and materials your group touches. Note each
   relevant item's status (Ready, Provisional, Not implemented, Not in scope, UNKNOWN).
3. If `tmp/qa-report.md` exists, read its Shared issues list (G1…). A known shared issue you meet again is cited by its ID in
   Passed/Notes, not reported as new.

## Environment facts

- Entry: `<base>/prebuilt/model?collectionId=<id>`. Create Your Own opens `/custom/cabinet-builder`.
- The 3D scene is a same-origin iframe: `document.querySelector('iframe').contentWindow.pc.app`. Before every 3D or price
  read, check that `pc.app.frame` advances between two reads a second apart. If it does not, the scene is stalled: the
  observation is an environment artefact, not a finding — wait, reload, and say so in Notes if it persists.
- After picking a preset or changing an option, wait at least 12 s before reading the price.
- Price and SKU are read from console lines `[SKU/Price] Response for` (SKU → price) and `Resolved prices`. The console
  persists across navigations: compare only entries logged after your action.
- About 400 debug logs per load (`[SKU/Price]`, `[EntityBuilder]`, `[RuleChangeSinkType]`, …) are expected noise, not findings.
- Prefer `browser_snapshot` and `browser_evaluate` to screenshots. Take a screenshot only as evidence for a visual finding.
- Group 6 (mobile): `browser_resize` to 412×915 for portrait and 915×412 for landscape. Touch is not emulated: list touch-only
  items (D&D by finger) under Not verified.

## Findings

- Format: `[<ID>] severity | checklist section | what | repro | expected vs actual | regression?`
- Repro is numbered steps from a fresh page load: exact URL, every click by its visible label, waits, and what to read
  (console line, scene node, UI text). Someone who has never seen the app must be able to follow it.
- Expected comes from the spec (cite its § and the item's status) or, if the spec is silent, from the checklist line.
- Severity is your proposal; the orchestrator sets the final one. high: wrong or missing price/SKU, wrong product in 3D,
  broken step or flow, lost configuration. med: visibly wrong with a workaround. low: cosmetic, ordering, wording, console noise.
- Before writing a high finding, reproduce it a second time from a fresh load. If the second run differs, write what each
  run showed.
- Regression: check the reference app only when it has the same feature and the check is cheap; otherwise write
  "not checked".
- A mismatch with an item marked Not implemented, Not in scope or UNKNOWN is not a finding: put it under Notes.

## Group mode output

Create the output file at the start, update it as you go, and set the status last:

```
# <Collection> — group <N>: <group title>
Status: in progress
Environment: <base URL>, Playwright headless Chromium, 1440×900, <date>
Checklist sections: 0, <sections>

## Findings
## Passed
## Not verified
## Notes
```

When the group is walked, change the second line to `Status: done`. Leave it `in progress` if you had to stop early, and say
why under Notes.

## Verify mode output

No file. Follow the repro exactly from a fresh load, with frames advancing, up to two attempts. Return `CONFIRMED` or
`NOT REPRODUCED`, the numbered steps you actually ran, and the values you observed at each step.

## Finish

1. Call `browser_close` on your server.
2. Final message, short: status, counts per severity, each high finding in one line, the output path, and "browser closed".
