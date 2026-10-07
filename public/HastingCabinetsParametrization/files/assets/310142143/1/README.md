# Tricot

Products: `Tricot-sink-cabinet` (Sink Base) and `Tricot-side-cabinet` (Side Cabinet).
Both use the shared `RuleWidthCabinetTricot`, following the Mako / UrbanFreestanding rule layout.
`Sink/` and `Side/` hold future product-specific rules.

| Width (cm) | StretchX (m) |
| --- | --- |
| 40 | -0.2 |
| 60 | 0 |
| 80 | 0.2 |
| 100 | 0.4 |
| 120 | 0.6 |

Height is 40 cm and depth is 52 cm, with zero StretchY / StretchZ in the base model.
The width rule handles width changes; height and depth have fixed defaults.
All 16 target entity names match the supplied size table, including `CLMa_Cabinet_Walls`.

Scene integration assumes a `Tricot_Cabinet` template with SmartStretch on the listed targets.
Sink mounting and sink subproducts are currently disabled in the product configuration.
Both products register `RuleMaterialsCabinetTricot` at priority 50 and `RuleMaterialsHandleTricot` at priority 55, before Boolean setup (60).

## Materials

The expected cutout entity names are `Tricot_Top_Drawer_HandleCutout` and
`Tricot_Bot_Drawer_HandleCutout`: the character after `Handle` is Latin `C` (U+0043),
not Cyrillic `С`. Width, drawer and material rules use these exact scene names.

`RuleMaterialsCabinetTricot` watches `CabinetColor` and controls the cabinet floor, walls, standard/fluted handles, side panel and fixed interior/cutter materials.
`RuleMaterialsHandleTricot` watches `HandleGrooveColor` and `CabinetColor` and controls the two cabinet grooves and two handle cutouts.
Missing, empty or `None` groove color falls back to the current `CabinetColor`.
No independent groove default is stored, so it continues to follow cabinet color until overridden.
The cabinet default follows Mako: `Antracite Matte OCF`.

Drawer floors, framing, inner handle and hinges always use the table's exact asset name
`Antracite Matte OCF`. The three Boolean cutters always use `BoolMat`.
Targets include disabled entities and render/model mesh instances. Materials are applied through
`MaterialService`, with caching like Mako to avoid repeated script updates; incomplete targets
remain eligible for retry.

## Drawer layout

Both products use `RuleDrawersCabinetTricot` at priority 40, after width (20).
The `Drawers` attribute follows UniBox's `2D`, `1DWID`, `1D` convention and defaults to `2D`.

| Setting | 2D | 1DWID | 1D |
| --- | --- | --- | --- |
| Top drawer | Enable | Enable | Disable |
| Bottom drawer | Enable | Enable | Enable |
| Top inner handle | Disable | Enable | Disable |
| Top standard handles, cutout, bottom cabinet groove | Enable | Disable | Enable |
| Bottom handles and cutout StretchY | 0 | 0.2 | 0.2 |
| Bottom handle point local Y | 0 | 0.1 | 0.1 |
| Bottom handle cutout local Y | 0 | 0.2 | 0.2 |

Y stretch margin is 0.1 for `Tricot_Bot_Drawer_Handle` and `Tricot_Bot_Drawer_Handle_Flut`.
Other stretch/margin axes and position X/Z are preserved. Positions are assigned absolutely,
so repeated mode changes do not accumulate offsets. Invalid modes leave the scene unchanged.

## Sink Base / Side Cabinet

`Sink/RuleTypeSinkCabinetTricot` and `Side/RuleTypeSideCabinetTricot` are independent
`BaseProductRule` classes. Each contains its own `dataRule` tables built with
`MeshRuleConfigBuilder` for visibility, Boolean state and StretchZ, and its own execution.
Priority 60 applies the type table after
width (20) and drawer layout (40). Both rules watch `Width` and `Drawers` and retry when
required entities, scripts or meshes are not ready.

| Setting | Sink 2D | Sink 1D | Sink 1DWID | Side (all modes) |
| --- | --- | --- | --- | --- |
| Top drawer framing | Enable | Enable | Enable | Disable |
| Bottom drawer framing | Disable | Enable | Disable | Disable |
| Top drawer floor Boolean | True | False | True | False |
| Bottom drawer floor Boolean | False | True | False | False |
| Cabinet floor Boolean | False | True | False | False |
| Cabinet floor StretchZ | -0.725 | -0.725 | 0 | -0.725 |

Subtract cutters are resolved inside the current product instance:
`Tricot_Top_Drawer_BoolB`, `Tricot_Bot_Drawer_BoolB`, `Tricot_Cabinet_SBBoolBox`.
The three floor targets require `meshBoolean`; the cabinet floor also requires `smartStretch`.
Disabled cuts restore source meshes. Enabled cuts rebuild after layout settles, following
the Mako / UrbanFreestanding Boolean workflow. Framing visibility does not override the
parent drawer visibility from the drawer layout rule.
