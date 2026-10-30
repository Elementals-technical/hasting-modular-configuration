# Tricot drawer divider SKU (2026-10-29)

Change: `public/collections/tricot/sku-profile.json#dividers` = Class's Inner Drawer Dividers (client 'Class Vanities - SKUs + Pricing' > Accessories_Pricing): Metal `VAN-GBDIV-MTL-3.9W-2H-16.9D`, Oak `VAN-GBDIV-OAK-3.8W-2.6H-16.9D`, plus Class's non-blocking `divider` price gap. Dev decision 2026-10-29 (Q-N2).

Live price (`GET /pricing-v2/resolve`, 2026-10-29): MTL 170, OAK 150 (resolver `VAN/matrix`).

Browser: Chrome MCP, local dev `localhost:5173`, uncommitted tree, one `--serve` session, write-guard and collections no-cache. Scenario `docs/ai/qa/scenarios/tc/LOCAL-TRICOT-divider-sku.json`.

| Step | Result |
|---|---|
| Tricot prebuilt → Accessories (`/prebuilt/side-panels`) → Drawer Dividers → Customize | the only editable drawer opened at once (Bottom); hint and "0 columns · Bottom drawer" |
| ⊕ "Add divider column (left)" | "1 column · Bottom drawer", `Divider column 1 of 1` (`14-column-1.png`) |
| Summary | Accessories › Drawer Organizer: "Material: Metal, Columns: 1, Drawer: Bottom, 3.9″ × 2″ × 16.9″", "Metal × 1 · Bottom drawer **$170.00**"; no "No SKU" gap; Total List Price $8,531.00 (`23-summary-1.png`) |
| Writes | 2 POST `/modular/configurations/store` (Summary auto-save) blocked by the guard; nothing sent |
| Console | PlayCanvas "not ready" warnings; `[Summary Share] Failed to generate configuration link` ×2 = the blocked auto-save |

The Summary text does not print SKUs; the SKU of the line is checked by `collectionOrganizerPricing.test.ts` ("organizers of Tricot from the read-model"). Oak was not checked: the 3D export v81 accepts only Metal.
