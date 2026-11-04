# A picked vessel takes its colour, all 8 collections (2026-11-03)

Change under test: picking a vessel sets `VesselColor` in the same command (the current colour if the vessel allows it, else its `defaultFinishByStyle`, else the first it allows), and a model change carries or blanks it. Working tree on `fix/vessel-color-default` on top of `2d4953bc`, uncommitted.

First run: Firefox, local dev. The Summary step was not opened, nothing was saved. A second run (Chrome, final code) is described in its own section below. SKUs below are the ones seen in the price request; no personal data in the screenshots.

## Results

| Collection | Scenario | Result | SKU seen |
|---|---|---|---|
| USH 36" 1-Drawer | Urban Modo | Matte White T1C, $7,992 (`01`) | `VES-URMOD-X-19.7W-5.5H-13D-SS-T1C` |
| | Blade 11 | Antracite Matte OCF, $7,452 (`02`) | `VES-BLD11-X-19.7W-6.1H-15D-CER-OCF` |
| | One undo | basin and colour return | |
| | 36" 2-Drawer | white vessel kept, $7,992 (`03`) | |
| | None, then Urban Modo | T1C kept | |
| | Explicit Avenue Ivory TR9, then Urban Morris | Bianco Gloss TAL; TR9 is disabled for Morris | TR9: `...-POR-TR9`; TAL: `VES-URMORS-X-22.8W-5.1H-14.6D-SSTKR-TAL` |
| | Integrated | colour cleared (0 pressed) | |
| | Customize | colour kept in Custom; Urban Modo there gives T1C | |
| ULH 95" Double | Blade 18 | OCF on both Sink Bases (`04`) | `VES-BLD18-X-21.7W-6.1H-15D-CER-OCF` |
| | Double 2 | both vessels kept | |
| | Compact 83" Multi-Level | colour kept, OCF pressed (`05`) | |
| | Explicit T1D, None, compact card, Urban Modo | black vessel (`06`) | |
| Mako 40" 1-Drawer | Iris | Salvia 415 MT | `VES-IRIS-X-16.5W-4.3H-16.5D-LACM-415` |
| | Frame | 415 kept | `VES-FRM-X-19.7W-4.3H-13.8D-LACM-415` |
| | Undo | Iris returns | |
| | 40" 2-Drawer | green vessel kept, 415 pressed (`07`) | |
| Tricot 40" 1-Drawer | Plaza | default finish | `VES-PLZ-X-23.6W-4.7H-18.9D-LACM-400` |
| | 40" 2-Drawer | colour kept (`08`) | |
| Urban Duplex 36" 2-Drawer | Acquarius | Agata BD MT | `VES-ACQS-X-18.9W-5.5H-13.4D-SSTKR-BD` |
| | Compact 94" Multi-Level | colour kept, Agata BD MT pressed (`09`) | |
| Urban Freestanding 36" 2-Drawer | no Aquarius offered; Morris | TAL | |
| | 42" 2-Drawer | colour kept (`10`) | |
| Lame 40" 1-Drawer | Frame | default finish | `VES-FRM-X-19.7W-4.3H-13.8D-LACM-401` |
| | 40" 1-Drawer 1 | colour kept (`11`) | |
| Class 48" 1-Drawer | Iris | Salvia 415 MT (`12`) | `VES-IRIS-X-16.5W-4.3H-16.5D-LACM-415` |
| | model change | resets to integrated, by `resetSelections` | |

Urban Duplex Aquarius has no default finish, so its first compatible colour depends on the configurator's order; live data gives Agata BD MT.

## SKU and price

- USH: the shape matches oracle row `O-USH-023` (`docs/ai/hastings/sku-oracle.csv`). That row has no SKU text or price oracle either.
- Class: the shape matches the pattern of `O-CLASS-009`, which is itself BLOCKED (no workbook SKU text).
- ULH, Mako, Tricot, Urban Duplex, Lame: the file has no `VES-` row for them. SKU text is BLOCKED, not passed.
- Urban Freestanding: no `VES-` row and no SKU was noted. BLOCKED.
- Prices: no oracle. BLOCKED.

## Second run: Chrome, final code (2026-11-03)

Browser: Chrome through DevTools MCP, isolated context, local dev on the working tree of `fix/vessel-color-default` after the review fixes. Scene values were read from `ConfiguratorAPI.getConfig` per product (read-only), the swatch from `aria-pressed`, the SKU from `pricing-v2/resolve` requests. The write guard was on for the two Summary visits: it blocked 2 POSTs to `/modular/configurations/store` on each, nothing was saved. The console message `[Summary Share] Failed to generate configuration link` is that block.

Every collection was walked in Pre-Built and in Custom (through Customize): pick, swap, undo, None and re-pick, model change, then a pick in Custom. Scene and swatch agreed at every step; no disabled swatch was pressed.

- USH 36" 1-Drawer: Urban Modo gives Matte White T1C, $7,992; Blade 11 gives Antracite Matte OCF, $7,452; undo returns both. None keeps the colour in the scene with `sinkType` Vessel. 36" 2-Drawer keeps T1C. Summary shows `Color: T1C` and is not Incomplete. Custom keeps it, and Blade 18 gives OCF. Integrated sets the scene `VesselColor` to ""; back to Vessel, no swatch is pressed.
- Mako 40" 1-Drawer: Iris gives Salvia 415 (scene "Salvia 415 Lacquered MT"), Plaza keeps 415, 40" 2-Drawer keeps it, Custom Frame keeps it.
- Tricot 40" 1-Drawer: Plaza gives Antracite 400, Iris keeps it, 40" 2-Drawer keeps it, Custom Frame keeps it.
- Lame 40" 1-Drawer: Frame gives Fumo 401, Iris keeps it, 40" 1-Drawer 1 keeps it, Custom Plaza keeps it.
- Class 48" 1-Drawer (two Sink Bases): Iris gives 415 on both, Plaza keeps it on both. A model change resets to integrated by `resetSelections`. Custom Frame gives Fumo 401.
- Urban Freestanding 36" 2-Drawer: Morris gives TAL, Blade 11 gives OCF, 42" 2-Drawer keeps TAL. Custom Urban Modo gives T1C.
- Urban Duplex 36" 2-Drawer: Acquarius gives Agata BD, Urban Modo gives T1C, undo returns. Compact 94" Multi-Level keeps Agata BD. Custom Blade 18 gives OCF.
- ULH 95" Double (two Sink Bases): Blade 18 gives OCF on both, Urban Modo gives T1C on both, undo returns. Double 2 keeps OCF on both. Custom Morris gives TAL on both.
- ULH review scenarios: 36" 1-Drawer, Urban Modo (T1C from the plan), None, compact 83" Multi-Level: the scene has no colour; Urban Modo again gives T1C. Explicit Matte Black T1D, None, compact 82": the scene keeps T1D; Urban Modo gives T1D, Summary `SSOCR | Matte Black T1D`, $13,186, not Incomplete. The blanking of a non-explicit colour is therefore shown in the browser on the compact path; the flat path is still shown only in node tests.

Console: besides the blocked Share, one error, React "two children with the same key" for the scene iframe in `PlayCanvasIntegration`. This work does not touch that file. It was not compared with a build where it could show; production builds strip it.

### Baseline: deployed Phase 2 staging, build `index-B7aj_nC8.js`, USH

- Urban Modo: scene `VesselColor` empty, no swatch pressed, $5,879 (the original bug).
- Vessel style with no vessel, then a model card: Model Compatibility Restriction popup.
- Blade 18, then Customize on 24" 1-Drawer: the vessel stays on the narrow model and the basin list is empty.

Both open defects below therefore exist without this work (seen on USH; the Mako popup was seen only on local).

### New observation, not investigated

Plaza (23.6" wide) sticks out past the left edge of the top on a 60 cm Sink Base (Lame, and Tricot in the first run). Not related to colour; no positioning code changed; not compared with staging.

## Not run in the browser

- Restore.
- Chrome and Firefox on a deployed build of this work.
- Mobile.
- USH with two Sink Bases (USH has no double model that allows a vessel; ULH covers it).
- SKU and price oracle status is unchanged (BLOCKED).

## Observed defects, outside this change

- A Model Compatibility Restriction popup appears on any card with Vessel style and no vessel (USH on deployed staging and on local, Mako on local). Probable cause, from reading code and not traced: `selectedCountertopSinkType` passes the literal "Vessel".
- Customize can place a vessel on a model too narrow for it (USH 24" with Blade 18: the basin list is empty and the vessel stays; also on deployed staging).
- A Save hold set after a refused replay cannot be cleared in the app: `clearRuntimeOutOfSync` has no caller.
- Plaza sticks out past the left edge of the top on a 60 cm Sink Base (see the second run).

## Screenshots

- `01-ush-urban-modo.png` USH, Urban Modo, T1C
- `02-ush-blade-11.png` USH, Blade 11, OCF
- `03-ush-model-change.png` USH, model change
- `04-ulh-double-two-vessels.png` ULH 95" Double, two vessels
- `05-ulh-compact-carry.png` ULH, compact carry
- `06-ulh-explicit-t1d-compact.png` ULH, explicit T1D through None and a compact model
- `07-mako-model-change.png` Mako, model change
- `08-tricot-model-change.png` Tricot, model change
- `09-urban-duplex-compact.png` Urban Duplex, compact
- `10-urban-freestanding.png` Urban Freestanding
- `11-lame.png` Lame
- `12-class-iris.png` Class, Iris
