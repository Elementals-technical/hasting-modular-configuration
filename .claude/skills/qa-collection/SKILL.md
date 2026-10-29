---
name: qa-collection
description: Run a checklist QA pass of one configurator collection on staging by splitting the checklist into six fixed groups and delegating them, two at a time, to the qa-tester-1 and qa-tester-2 subagents, each driving its own isolated headless browser; then re-verify every high finding and consolidate one report. Use when the user asks to test, QA or walk the checklist for a collection, or to resume such a run.
---

The main session is the orchestrator. It never drives a browser itself; the testers do. It owns severity, deduplication and
the final report.

# Inputs

- **Collection id** — `collectionId` as in `public/collections/registry.json` (tricot, mako, class, lame,
  urban-freestanding, urban-duplex, urban-low-height, ...). One run covers one collection; collections go one after another,
  never two runs at once (each run already uses two browsers).
- **Spec** — `tmp/specs/<collectionId>.md`, the lead's collection spec. If it is missing, stop and ask the user for it.
- **Base URL** — staging, `https://hasting-modular-phase-2-p98qb.ondigitalocean.app` unless the user names another.
  Reference app for "is this a regression": `https://hasting-modular-configuration-v3aur.ondigitalocean.app`.
- **Checklist** — `checklist.md` next to this file: section 0 plus groups 1–6.
- **Finding prefix** — T (tricot), M (mako), C (class), L (lame), UF, UD, ULH; for another collection, pick a short one and
  say so.

# Preconditions

- Each tester defines its browser inline (`mcpServers` in its agent file): the server starts with the tester and stops when
  it finishes, so the main session has no browser tools of its own here. A tester reporting "tools missing" means its
  server failed to start: stop and tell the user.
- No other QA run or Playwright-heavy session is active on this machine. Ask if unsure.
- The browser settings (headless, hardware WebGL through ANGLE d3d11, 1440×900, isolated profile) live in `playwright.json`
  next to this file.
- Both agent files pin `@playwright/mcp@0.0.83`, which needs `chromium_headless_shell-1247`. A tester failing with
  "Browser chromium is not installed" means the pin and the installed build disagree: after changing the pin, run
  `npx @playwright/mcp@<version> install-browser chromium` once.

# Run

1. **Plan the groups.** Start from groups 1–6. Drop a group only when the spec says the whole area does not exist for this
   collection (for example group 3's accessories part is still walked for the Accessories step opening). Say which groups
   run and why any were dropped.
2. **Resume.** A group whose `tmp/<collectionId>/g<N>.md` exists with `Status: done` is not run again. A file without it is
   rerun from scratch (the tester overwrites it).
3. **Waves.** Dispatch the pending groups two at a time: one to `qa-tester-1`, one to `qa-tester-2`, in the same message.
   Wait for both to finish before the next wave. The brief for each is only:
   - collection id, base URL, reference URL;
   - group number and the path `.claude/skills/qa-collection/checklist.md`;
   - spec path;
   - output path `tmp/<collectionId>/g<N>.md` and the finding ID form `<PREFIX>-g<N>.<n>`.
   Nothing else: the tester's own file carries the method.
4. **Read the results.** After each wave read the group files, not just the testers' summaries. A file without `Status: done`
   means the group failed: rerun it once in the next wave; if it fails again, list it under Not verified.
5. **Verify wave.** Collect every finding the testers marked high. Send each one, alone, to `qa-tester-1` (one browser
   only, so the CPU is free and timing artefacts don't repeat): the brief is the finding's repro steps and expected result
   only, never the tester's verdict or actual result, with the instruction "verify mode". The tester returns `CONFIRMED` or
   `NOT REPRODUCED` with exact numbered steps. Record each result in `tmp/<collectionId>/verify.md`. A finding not
   reproduced becomes WITHDRAWN with the reason; a confirmed one takes the verify run's numbered steps as its repro.
6. **Consolidate** into `tmp/<collectionId>.md`:
   - Header: environment (base URL and the deployed ref if known), browser (Playwright headless Chromium, hardware WebGL,
     1440×900), date, groups run.
   - `## Findings`, most severe first, renumbered `<PREFIX>-1..n`, each as
     `[<ID>] severity | checklist section | what | repro | expected vs actual | regression?`.
   - Merge duplicates found by two groups into one finding citing both sections.
   - Set the final severity yourself (rules below). Apply the spec statuses: a mismatch with a **Ready** item is a bug, with
     a **Provisional** item a provisional finding, and **Not implemented** / **Not in scope** / **UNKNOWN** items are not bugs
     (list UNKNOWN ones under Questions). A spec line marked `[code: …]` was written from the code, so the code matching it
     is no evidence.
   - `## Withdrawn` (from the verify wave), `## Passed`, `## Not verified`, `## Questions for the lead / client`.
   - A `## Summary` with counts per severity.
7. **Clean up.** Every tester must have reported that it closed its browser. Do not kill browser processes by PID: other
   sessions may own them.
8. **Report** to the user: counts, the high findings in one line each, what was not verified, and the report path.

# Severity

- **high** — the client would buy or see the wrong thing or cannot finish: wrong or missing price or SKU, wrong product in
  3D, a step or flow that breaks, lost configuration.
- **med** — visibly wrong with a workaround: a wrong material on a part, a misplaced part, an option that should be hidden,
  wrong labels on a selectable value.
- **low** — cosmetic, ordering, wording, console noise, performance.
