# Custom cabinet composition and cabinet pricing

Type: AFK. User stories: 11–16, 40–41, 51–52, 57–58.

## What to build

Let the existing builder consume the source-backed Tricot module contract and produce valid cabinet pricing requests. Support SB and SC modules with all three drawer styles, fixed height/depth and correct widths. Verify complete cabinet SKU spelling through commands and pricing fixtures, while keeping unapproved composition policies and missing runtime inputs explicit.

## Acceptance criteria

- [x] SB supports widths 60/80/100/120 cm; SC supports 40/60/80/100/120 cm; both use height 40 and depth 52 cm.
- [x] One drawer, two drawers and one drawer with an inner drawer remain distinct and map to 1DW/2DW/1DWID.
- [x] No Urban handle restrictions, forced heights or extra cabinet types leak into the Tricot catalog.
- [x] Manifest/profile source references and matrix adapters are consistent without fabricated API IDs.
- [x] Cabinet SKUs use `VAN-TRIC`, ordered type/drawer/pattern tokens, one-decimal inch dimensions, CAB and HDL elements, and no Handle Style token.
- [x] Source-backed cabinet cases and expected prices are tested with traceable fixtures, covering the 135 priced combinations where practical.
- [x] Invalid modules and missing required pricing inputs cannot become a confirmed total.
- [x] Builder/catalog, validation and pricing behavior are tested through existing integration boundaries; existing collections retain their behavior.

## Blocked by

- Blocked by #plans/tricot-integration/01-staged-entry-and-preset-catalog.issue.md

## Completion boundary

Use source-backed preparation and declared test contracts, not invented scene products, published DataTables or composition-mixing policies.

## Execution record — 2026-10-06

Status: Complete within the source-backed preparation boundary.

Implemented profile-backed SB/SC catalogs, three distinct drawer tokens, strict cabinet SKU validation and incomplete-price protection. The independently extracted workbook fixture preserves 135 cabinet rows plus two panel material cases and their source cells. Tests cover all 135 cabinet base SKUs and the two audited full-SKU price examples. Final API IDs and scene placement remain issue 7 inputs.

## Handoff integration — 2026-10-07

Connected cabinet table 592, mapped `Sink-Cabinet` to semantic Side-Cabinet and `forced_height_cm` to the three 40-cm drawer relations. Parsed its integrated-basin exclusion for 60-cm inner-drawer Sink Bases. The supplied drawer-family policy is now declared in the profile for the existing builder mixing checks. Cabinet SKU/workbook tests remain unchanged except for assertions on delivered source IDs and defaults. Actual Canvas placement is still pending.
