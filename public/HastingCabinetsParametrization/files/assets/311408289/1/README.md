# Lame

Products: Lame-sink-cabinet and Lame-side-cabinet. Both instantiate Lame_Cabinet.

Width: 40/60/80/100/120 cm; stretch X: -0.2/0/0.2/0.4/0.6 m.
Height: 26/52 cm; wall stretch Y: -0.26/0 m. Depth is fixed at 52 cm, with no stretch operation.

Height positions (26/52 cm):
- Lame_Cabinet_WallsPoint: +0.13/0 m
- Lame_TopDrawer and Lame_Top_Cabinet_Frame: authored positions, no movement
- Lame_Cabinet_Floor: +0.26/0 m
- Lame_Countertop_Point: 0.52/0.52 m
- Lame_Sink_Point: -0.04/-0.04 m

The sink variant uses the existing sink subproduct and thickness offset rules. The crossed-out Undertop note is not applied. Type setup: Sink enables Lame_Top_Drawer_Framing, subtracts the product-local Lame_Top_Drawer_BoolB from Lame_Top_Drawer_Walls, and sets Lame_Cabinet_Floor stretch Z to 0. Side disables framing and Boolean and sets floor stretch Z to -0.702 m. 

Drawers: 2D (default) enables Lame_BotDrawer and Lame_Bot_Cabinet_Frame; 1D disables both. Drawers is independent of Height.

Materials: four separate rules for CabinetColor, HandleColor, LegCapColor and UndertopColor. LegCapColor and UndertopColor fall back to the current HandleColor when absent, empty or None. CabinetColor also applies fixed Antracite Matte to frames and drawer walls, and BoolMat to Lame_Top_Drawer_BoolB. Both products default CabinetColor and HandleColor to Antracite Matte OCF.

## Composition undertop

RuleLameUndertop and LameUndertopService manage one separate Lame_Undertop template per composition, following UF baseboard lifecycle and mesh centering. Set ShowUndertop to Enable/Disable on the Lame cabinets with setConfigBatch({ productType: 'Lame-' }, ...). Default: Disable. If any Lame cabinet enables it, the slab covers all Lame cabinets and uses the first enabled cabinet's UndertopColor, falling back to HandleColor.

StretchX = sum(Width / 100) - 0.6 + 0.09 when side panels are enabled. Three 60 cm cabinets use 1.2, as confirmed by the user. The template keeps authored Z and baseline Y; both heights keep MoveY = 0. All cabinets must share height 26 or 52 and depth 52; mixed heights hide the continuous slab.

While present, both Lame_Countertop_Point and Lame_Sink_Point receive +0.02 m from absolute height/thickness baselines. The composition handler runs before countertop layout, which also observes ShowUndertop, as do cutout and collision refresh rules. Disabling restores the original support planes and destroys the runtime slab.

## Cabinet patterns

RulePatternCabinetLame applies CabinetPattern to Lame_Top_Drawer_Flut, Lame_Bot_Drawer_Flut and Lame_SidePanel_Flut after CabinetColor. Modes: Galles (default), Gessatto, Oxford, Piquet, Plisse. Updated table U/V: Galles 32/32, Gessatto 60/60, Oxford 30/18, Piquet 32/20, Plisse 240/240. Galles bumpiness/intensity: 1.2/1.2. Detail Tiling V defaults to 0 (follow U) in TriPlanarMapping, preserving existing collections. Galles AO asset is named Galles_Pattern_AO_1K without a file extension, per supplied table.

Pattern readiness: the separate optional Lame_SidePanel_Flut does not block drawer patterns. Ready targets are updated even if another target lacks triPlanarMapping; incomplete existing targets are retried on later updates. Galles AO accepts the exact table name or its .jpg variant.

LAME ONLY independent pattern mode: RulePatternCabinetLame sets triPlanarMapping.lamePattern = true. Normal/AO use object-aligned metre coordinates times the table U/V values and ignore the base material scale, rotation and grain. Existing rules leave lamePattern false and use the original scalar detailTiling path. No new script component or manual PlayCanvas attribute is needed; update the existing tri-planar-mapping.mjs and imported chunks together. Blocks are marked LAME ONLY.

## Composition legs (Lame only)

ShowLegs: Enable/Disable, default Disable. RuleLameLegs and LameLegsService own exactly two Lame_Legs template instances per composition: right scale X +1 and mirrored left -1. Other collections never load or position these assets. Mixed collections or heights hide the pair. Any enabled Lame cabinet enables the shared pair.

For a multi-cabinet row use each outer cabinet centre and width. Right X offsets for 40/60/80/100/120 cm: -0.2/0/0.2/0.25/0.3 m; left offsets are mirrored. Without a side panel: right X -0.052 m, left X +0.052 m, Z -0.003 m. With a panel on that side: no correction.

Height 26 selects Lame_Leg_Long and Lame_Leg_Long_Cap; height 52 selects Lame_Leg_Short and Lame_Leg_Short_Cap (asset names are swapped in the updated artist table). Base heights remain 0.3022/0.561 m. Authored Y is preserved. X uses only the table width delta plus the side-panel correction, without extra geometry alignment. Z uses the table correction. Each leg uses its outer cabinet CabinetColor, with LegCapColor falling back to HandleColor.

## Side panel addon (local source, 2026-10-29)

The `lame` group profile now registers `Lame-SidePanel_Left/Right` on `Lame_SidePanel`.
Panels align to measured outer walls, following the user decision that replaces the guide's MoveX table.
Layout, material/pattern propagation and5cm countertop accounting are covered by `tests/node/lame-side-panel.test.mjs`.
Delivery/browser status and the remaining single-side undertop limitation: `docs/features/lame-side-panels/README.md`.
