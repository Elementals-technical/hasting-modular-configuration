# HO-004: Mako G50 handle style cannot be selected anywhere

| Field | Value |
|---|---|
| Risk / severity | S2 (missing product option) |
| Owning boundary | frontend collection data/UI (verified: no control; suspected: data incomplete) |
| Environment / build | staging, `index-B-mLU0_Q.js`, Chrome 156 |
| Entry | `/prebuilt/model?collectionId=mako` (prebuilt list) and Create Your Own |
| Frequency | 1/1 |
| TC / rule | TC-MAKO-CAB-005 (FAIL), TC-MAKO-CAB-007 (BLOCKED) · R-MAKO-CAB-005, R-MAKO-CAB-007 |

## Steps
1. Builder → Cabinet Style: only "2 Drawer", "1 Drawer". 2. Next: Color → Handle Color: colours only (Lacquered MT list + Metal Gold/Silver). 3. Prebuilt list: no G50 model.

## Expected
Client: Mako handle styles G57 and G50 (gdoc-webgl-live@P0156); G50 only in Metal (@P0157; DF2 P0017 "The G50 handle is only available in Metal").

## Actual
No handle-style choice; Summary shows "G57" for the default. Repo evidence: `public/collections/mako/presets.json` has 0 G50 entries; `ui.json` has only an image path for G50; product-profile notes "G50 comes in 20 and 36 cm; which cabinet width takes which length is not described". Evidence: `docs/ai/qa/evidence/2026-10-28/TC-MAKO-CAB-007/{22-style-snapshot.txt,08-color-snapshot.txt,37-color-2dw-snapshot.txt}`.

## Suspected root cause
G50 intentionally not exposed until the G50 length/width mapping is clarified (product-profile note) — confidence medium.

## Requested change
Product/client: answer the G50 length ↔ cabinet width mapping (R-MAKO-CAB-008). Frontend: then expose handle style and restrict G50 colours to Metal.

## Acceptance criteria
- [ ] Handle style G57/G50 selectable; G50 shows Metal (Gold/Silver) only; SKU `…/G50-…` priced per `sheet-mako-sku`.
- [ ] Switching G57 lacquered → G50 auto-corrects the colour with a message (dependent-change).
