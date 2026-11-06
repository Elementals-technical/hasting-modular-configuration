<!-- Task card template: copy to .claude/tasks/<branch-short-description>.md at Spec intake. Rules: CLAUDE.md → Task cards. -->

# C-5. Class: a basin never lands on a Sink Base it doesn't fit

**Stage:** PR (awaits the user)

## Goal
A composition has one basin, and the countertop rules judge it by the narrowest placed Sink Base. Class, SB 80 + SB 60: Matte White 8cm is refused with "Not available for current cabinet width", and VA023 never lands on the 60. For every collection.

## Sources
- Vivid: none; C-5 in the user's "Medium-баги конфігуратора" artifact (read in Chrome: VA023 not allowed on SB 60, spec §7.5; rule for mixed widths §7.3 UNKNOWN) · PRD: none
- Collections: class; the same rule reaches every collection through `useSinkBaseDimensions`
- Product data: R-CLASS-BAS-002, R-CLASS-BAS-001, R-USH-BAS-002 ("dictated by the minimum SB size"), R-USH-BAS-007/008 (docs/ai/hastings/domain-rules.csv); RenderAdmin table 578 (live VA023 row is material Technomat, min_sb_cm 80), configurator 8 (Matte White 8cm: GBMaterial Technomat)
- Figma: none

## Out of scope
- Different basins per Sink Base and fallback basins: built in Chunks 2-5, removed. Undo, Prebuilt restore, Summary and USH pricing all assume one basin per composition.
- Reverse order with no basin left (Matte White 8cm chosen on SB 80, SB 60 added after): colour shows refused, VA023 stays. Separate task, user decision; `useAvailabilityResets` keeps "with none allowed the basin stays".
- USH colour tile hint: generic text on `CountertopPage`, as on a lone SB 60 today; rewording touches every refused colour there. Awaiting the user.
- `prebuiltModelCompatibility.ts:67`, `ModelPage.tsx:323` preset Sink Base choice: no effect on current data (only mixed preset is Mako 60 + 80, Mako min_sb is 60).
- Dead `applyIntegratedBasin` in `useBasinState.ts:150`: predates this task, report as a candidate.
- Tricot's command gate, re-recording fixtures, the 18 stable baseline failures.
- Scene changes: handoff only.
- Git: no branch, commit or PR without the user's command; the change stays in the working tree of `phase2/ui-fixes`.

## Decisions
- User: one basin per composition, judged by the narrowest Sink Base. Supersedes per-Sink-Base distribution, after code review proved the app assumes one basin.
- User: no available basin for a Sink Base → the selection is blocked with a message; only the colour's own material counts (LB440 isn't available for Technomat).
- User: reverse order with no basin left is a separate task.
- The rule covers vessels too: a vessel goes on every Sink Base (R-USH-BAS-007/008), so 80 + 60 refuses it where `min_vsl_cm` is 80.
- `useSinkBaseDimensions` returns the narrowest Sink Base's width and depth; all three consumers judge rules with it.

## Reuse
- Reuse as is: `src/shared/hooks/useSinkBaseDimensions.ts` — the only source of the Sink Base width the rules read
- Reuse as is: `useAvailabilityResets` — re-picks the basin when the narrowest Sink Base refuses it
- Lift first: none

## Trace
- Selection: scene `getConfig` → `useSinkBaseDimensions` (first wrong boundary: it picked the widest) → `useCountertopRuleState` / `useCountertopContext` / `PlayCanvasIntegration` → `buildCountertopRuleState`, `evaluateCountertopMaterial` → field options → command → scene.
- Pricing: not changed.

## Plan
- [x] Chunks 1-6: per-Sink-Base distribution, LB440, colour block by a separate narrowest input. Superseded; root cause evidence kept: the RED test showed `["VA023", "VA023"]`.
- [x] Chunk 7: revert every production file of Chunks 1-6 to HEAD and delete the new ones; RED tests through the real hook, Class and USH; `useSinkBaseDimensions` picks the narrowest; related cases: 80 + 80, Matte White, Urban Duplex Strip and Cover refused with Prisma enabled on 80 + 60, vessel refused on 80 + 60, reset when SB 60 is added under Strip.
- [x] Test & verify: full checks; browser walk on `modular`: class, urban-duplex, urban-standard-height, custom flow, no Save.
- [x] Review: code review of the final diff.
- [x] Docs sync: `docs/products/README.md` through `docs-manager`.
