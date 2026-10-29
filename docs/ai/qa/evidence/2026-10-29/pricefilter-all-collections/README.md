# Price filter of every collection against Material Pricing Tiers (2026-10-29)

Oracle: client 'list material' > Material Pricing Tiers (sha256:7e27b55e, modified 2026-10-27), Azzurra block for Urban Standard Height, Urban Low Height, Urban Duplex, Urban Freestanding; GB block for Tricot, Lame, Mako, Class (K-CTML-014).

Method: node probe (not kept) over the live configurators 4, 8, 9, 11, 12, 13, 14 (`GET /configurators/<id>?view=full&serialize=true`, 2026-10-29, read-only). Every colour attribute with a `configurator:` source went through `resolveConfiguratorOptions` (the options of `ColorField`), and USH Countertop and Vessel through `buildCountertopColorOptions` (its `CountertopPage`, with the Syntesi options of datatable 438). Each option's tier came from `filterOptionsByTier` with the collection's `selectPriceTierOverride`, which is what the grid and the full mode use. Browser: not run.

## Materials in the document: all match

| Block | Collections | SKU → tier (live options) |
|---|---|---|
| Azzurra | USH, ULH, UD, UFS | 3D 1; white lacquer (Bianco 0B MT/GL) 1; LACM 2; LACG 3; ST 3; BM 3; HPL, ESS, FX, POR 4; GLSM, GLSG 2 (USH/ULH); SSMMO 2, SSOCR 1, SSTM (Tekormud) 3 (USH/ULH); SSTKR 3 |
| GB | Tricot, Lame, Mako, Class | LACM 2; LACG 3; LAM 1 (Class); POR, HPL 4; SSTL 2; SSTMT 1; GLSM, GLSG, SGLS 2; WDV 3 (Tricot) |
| GB, material outside the block (Azzurra table) | Tricot, Lame Vessel | SSTKR Tekorlux 3 (52) |
| | Mako Countertop | FX Fenix 4 (9) |

## Not in the document: no tier from it (client questions, nothing changed)

| Material | Where | Now |
|---|---|---|
| Ceramic `CER` (Antracite, Cemento, Cenere, Gloss White, Matte White) | Vessel Color of USH, ULH, UD, UFS | no tier: hidden under any Price |
| Solid Surface `SS` (Matte Black T1D, Matte White T1C) | Vessel Color of USH, ULH, UD, UFS | no tier |
| Solid-Surface `SSTL` Matte White | Countertop Color of UD, UFS | no tier (GB ranks SSTL Classic $$; the Azzurra block lists no Technolite) |
| Syntesi `SSSYN` (Bianco Gloss TAN, Bianco Matte TAP) | USH Countertop | Standard $ by the code's material map (`syntesi: 1`), not by the document |
| Metal `MTL` (Gold, Silver) | Lame, Mako Handle / Leg / Undertop | no tier |

Interpretation to confirm: Bianco Calce DA and Bianco Male FA (MT/GL; colours White + Beige) are not "Lacq MT/GL White" in the code (exception since `00f620b0`, 2026-04-01), so they keep Classic $$ (MT) / Specialty $$$ (GL).

Guard: `src/shared/constants/__tests__/priceFilters.test.ts` pins the shared table to the Azzurra block and the white MT/GL rule; `cabinetColorPriceTiers.test.ts` pins the GB block for every colour field of the GB collections.
