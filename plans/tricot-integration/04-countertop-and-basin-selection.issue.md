# Countertop and basin selection

Type: AFK. User stories: 29–36, 40–41, 49–51.

## What to build

Provide the grouped Tricot countertop page and shared compatibility/pricing integration for the master range. Normalize source aliases while preserving metadata. Consume approved thickness/basin rules when provided; otherwise expose a missing dependency rather than approving another collection's combinations.

## Acceptance criteria

- [x] Catalogs contain 71 source countertop colors and the ten source basin styles, with no foreign API variants.
- [x] Preserve Solid Surface, HPL, Porcelain, Glass MT and Glass GL material distinctions.
- [x] Normalize all affected Class/Tricot Glass aliases within their material context, preserving color codes and textures.
- [x] Render countertop color, thickness and basin in the agreed order in both flows.
- [x] Supplied table 593 feeds shared material/width/depth filtering and command validation; incompatible composition-wide/per-Sink-Base basins are reset consistently. Real-scene acceptance is separate.
- [x] Candidate tables 577/578 are not silently treated as final Tricot approval; unavailable approved inputs prevent unsupported selections.
- [x] Shared GB pricing grammar is reused only for verified mappings, with explicit gaps for unresolved thickness or basin inputs.
- [x] Tests cover catalogs, aliases, dependent availability, pricing gaps and both-flow integration using clearly declared fixtures.

## Blocked by

- Blocked by #plans/tricot-integration/03-finishes-patterns-and-groove-colors.issue.md

## Execution record — 2026-10-06

Status: Source catalogs and safety integration prepared; approved compatibility remains open.

Implemented all 71 source colors with five material groups, all ten basins, 40 Glass aliases, external metadata preservation and the agreed section order. Empty thickness options and undetermined rules prevent unsupported choices; countertop pricing remains explicitly incomplete. The unchecked matrix criterion requires final tables and approved thickness/basin/SKU mappings in issue 7. No table 577/578 or another collection's mappings were promoted to approval.

## Handoff integration — 2026-10-07

Connected final countertop table 593 and cabinet table 592 with matching manifest/profile/adapter identities and real response fixtures. Table-derived thicknesses are 0.5, 0.75, 3.125, 4 and 4.75 inches. The loader hydrates opt-in command rules; actual module dimensions, material/thickness/basin eligibility and the cabinet table's integrated/60-cm-inner-drawer exclusion are checked before scene writes. Parent changes reset invalid scoped and global basins. Defaults come from the supplied preset CSV. Both flows pass focused matrix/command tests; legacy profiles retain their existing command behavior. Table notes are preserved, not promoted to extra features. Shared GB SKU/pricing verification and Canvas acceptance remain open.
