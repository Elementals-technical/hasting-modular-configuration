
/**
 * Product Config Loader - завантажує дефолтні конфігурації продуктів
 * 
 * Відокремлює конфігурації від основної логіки ProductRegistry.
 * В майбутньому можна завантажувати з JSON/API.
 */

import { RuleScaleWidthCabinetUniBox } from '../rules/CabinetUniBox/RuleScaleWidthCabinetUniBox.mjs';

import { RuleScaleDepthCabinetUniBox } from '../rules/CabinetUniBox/RuleScaleDepthCabinetUniBox.mjs';
// import { RuleScaleHeightCabinetUniBox } from '../rules/CabinetUniBox/RuleScaleHeightCabinetUniBox.mjs';
import { RuleScaleWidthOpenShelves } from '../rules/OpenShelves/RuleScaleWidthOpenShelves.mjs';
import { RuleScaleHeightOpenShelves } from '../rules/OpenShelves/RuleScaleHeightOpenShelves.mjs';
import { RuleScaleDepthOpenShelves } from '../rules/OpenShelves/RuleScaleDepthOpenShelves.mjs';
import { RuleScaleHeightUniSideShelves } from '../rules/UniSideShelves/RuleScaleHeightUniSideShelves.mjs';
import { RuleScaleDepthUniSideShelves } from '../rules/UniSideShelves/RuleScaleDepthUniSideShelves.mjs';
import { RuleChangeCabinetColor } from '../rules/RuleChangeCabinetColor.mjs';
import { RuleChangeSinkType } from '../rules/CabinetUniBox/RuleTypeSlink.mjs';
import { RuleScaleHeightCabinetUniBox } from '../rules/CabinetUniBox/RuleScaleHeightCabinetUniBox.mjs';
import { RuleVisibleSinkCabinet } from '../rules/CabinetUniBox/RuleVisibleSinkCabinet.mjs';
import { RuleVisibleSinkBase } from '../rules/CabinetUniBox/RuleVisibleSinkBase.mjs';
import { RuleChangeHandleGrooveColor } from '../rules/RuleChangeHandleGrooveColor.mjs';
import { RuleChangeCountertopColor } from '../rules/RuleChangeCountertopColor.mjs';
import { RuleHandleVisibility } from '../rules/CabinetUniBox/RuleHandleVisibility.mjs';
import { RuleHandleDrawers } from '../rules/CabinetUniBox/RuleHandleDrawers.mjs';
import { RuleChangeCountertopPositionByStrategy } from '../rules/RuleChangeCountertopPositionByStrategy.mjs';
import { RuleChangeCountertopHeight } from '../rules/RuleChangeCountertopHeight.mjs';
import { RuleSlinkPosition } from '../rules/CabinetUniBox/RuleSlinkPosition.mjs';
import { RuleChangeCountertopDepth } from '../rules/RuleChangeCountertopDepth.mjs';
import { RuleChangeSidePanelVariant } from '../rules/variants/RuleChangeSidePanelVariant.mjs';
import { RuleChangeSidePanelDepth } from '../rules/SidePanel/RuleChangeSidePanelDepth.mjs';
import { RuleChangeSidePanelHeight } from '../rules/SidePanel/RuleChangeSidePanelHeight.mjs';
import { RuleChangeTowelBarVariant } from '../rules/variants/RuleChangeTowelBarVariant.mjs';
import { RuleChangeTowelBarColor } from '../rules/RuleChangeTowelBarColor.mjs';
import { RuleChangeTowelBarHeight } from '../rules/TowelBar/RuleChangeTowelBarHeight.mjs';
import { RuleDividersTopDrawer } from '../rules/Dividers/RuleDividersTopDrawer.mjs';
import { RuleDividersBotDrawer } from '../rules/Dividers/RuleDividersBotDrawer.mjs';
import { RuleDividersTopFullDrawer } from '../rules/Dividers/RuleDividersTopFullDrawer.mjs';
// import { RuleChangeSinkType } from '../rules/CabinetUniBox/RuleTypeSlink.mjs';

// Overlay rules (Grain Direction & Drawer Panel Fluting)
import { RuleGrainDirection } from '../rules/Overlay/RuleGrainDirection.mjs';
import { RuleDrawerPanelFluting } from '../rules/Overlay/RuleDrawerPanelFluting.mjs';
import { RuleDrawerOverlayLayout } from '../rules/Overlay/RuleDrawerOverlayLayout.mjs';
import { RuleHandleOverlayVisibility } from '../rules/Overlay/RuleHandleOverlayVisibility.mjs';
import { RuleOverlayFluting } from '../rules/Overlay/RuleOverlayFluting.mjs';
import { RuleSidePanelOverlayVariant } from '../rules/variants/RuleSidePanelOverlayVariant.mjs';
import { RuleSidePanelOverlayDepth } from '../rules/SidePanel/RuleSidePanelOverlayDepth.mjs';
import { RuleSidePanelOverlayHeight } from '../rules/SidePanel/RuleSidePanelOverlayHeight.mjs';
import { DividerController } from '../../../services/drawer-divider/services/DividerController.mjs';
import { RuleChangeCabinetColorSidePanel } from '../rules/SidePanel/RuleChangeCabinetColorSidePanel.mjs';
import { RuleDepthULHCabinet } from '../rules/CabinetUrbanLowHeight/RuleDepthULHCabinet.mjs';
import { RuleWidthULHCabinet } from '../rules/CabinetUrbanLowHeight/RuleWidthULHCabinet.mjs';
import { RuleHeightULHCabinet } from '../rules/CabinetUrbanLowHeight/RuleHeightULHCabinet.mjs';
import { RuleHandleULHCabinet } from '../rules/CabinetUrbanLowHeight/RuleHandleULHCabinet.mjs';
import { RuleMaterialsCabinetULH } from '../rules/CabinetUrbanLowHeight/RuleMaterialsCabinetULH.mjs';
import { RuleULHSidePanelLayout } from '../rules/CabinetUrbanLowHeight/SidePanel/RuleULHSidePanelLayout.mjs';
import { RuleULHSidePanelMaterials } from '../rules/CabinetUrbanLowHeight/SidePanel/RuleULHSidePanelMaterials.mjs';
import { RuleTypeSinkCabinetULH } from '../rules/CabinetUrbanLowHeight/Sink/RuleTypeSinkCabinetULH.mjs';
import { RuleTypeSideCabinetULH } from '../rules/CabinetUrbanLowHeight/Side/RuleTypeSideCabinetULH.mjs';
import { RuleVisibleULHOpenShelves } from '../rules/CabinetUrbanLowHeight/OpenShelves/RuleVisibleULHOpenShelves.mjs';
import { RuleWidthULHOpenShelves } from '../rules/CabinetUrbanLowHeight/OpenShelves/RuleWidthULHOpenShelves.mjs';
import { RuleHeightULHOpenShelves } from '../rules/CabinetUrbanLowHeight/OpenShelves/RuleHeightULHOpenShelves.mjs';
import { RuleDepthULHOpenShelves } from '../rules/CabinetUrbanLowHeight/OpenShelves/RuleDepthULHOpenShelves.mjs';
import { RuleSinkMountPosition } from '../rules/RuleSinkMountPosition.mjs';
import { RuleCountertopSinkPointPosition } from '../rules/RuleCountertopSinkPointPosition.mjs';
import { COUNTERTOP_SINK_LOCAL_KEY, COUNTERTOP_SINK_POINT_NAME, COUNTERTOP_SINK_TYPE_KEY } from '../../countertop/countertop-hosted-sink.mjs';
import { ULH_SIDE_PANEL_PRODUCTS, ULH_SIDE_PANEL_PROFILE } from '../logic/ulh-side-panel-policy.mjs';
// Collection Lame
import { RuleWidthCabinetLame } from '../rules/CabinetLame/RuleWidthCabinetLame.mjs';
import { RuleHeightCabinetLame } from '../rules/CabinetLame/RuleHeightCabinetLame.mjs';
import { RuleDrawersCabinetLame } from '../rules/CabinetLame/RuleDrawersCabinetLame.mjs';
import { RuleMaterialsCabinetLame } from '../rules/CabinetLame/RuleMaterialsCabinetLame.mjs';
import { RuleMaterialsHandleLame } from '../rules/CabinetLame/RuleMaterialsHandleLame.mjs';
import { RuleMaterialsLegCapLame } from '../rules/CabinetLame/RuleMaterialsLegCapLame.mjs';
import { RuleMaterialsUndertopLame } from '../rules/CabinetLame/RuleMaterialsUndertopLame.mjs';
import { RulePatternCabinetLame } from '../rules/CabinetLame/RulePatternCabinetLame.mjs';
import { RuleTypeSinkCabinetLame } from '../rules/CabinetLame/Sink/RuleTypeSinkCabinetLame.mjs';
import { RuleTypeSideCabinetLame } from '../rules/CabinetLame/Side/RuleTypeSideCabinetLame.mjs';

import { RuleUFSidePanelLayout } from '../rules/CabinetUrbanFreestanding/RuleUFSidePanelLayout.mjs';
import { RuleUFSidePanelMaterials } from '../rules/CabinetUrbanFreestanding/RuleUFSidePanelMaterials.mjs';
import { UF_SIDE_PANEL_PRODUCTS, UF_SIDE_PANEL_PROFILE, UF_SIDE_PANEL_TEMPLATE } from '../logic/uf-side-panel-policy.mjs';
import { TRICOT_SIDE_PANEL_PRODUCTS, TRICOT_SIDE_PANEL_PROFILE, TRICOT_SIDE_PANEL_TEMPLATE } from '../logic/tricot-side-panel-policy.mjs';
// Collection Class
import { RuleWidthCabinetClass } from '../rules/CabinetClass/RuleWidthCabinetClass.mjs';
import { RuleHeightCabinetClass } from '../rules/CabinetClass/RuleHeightCabinetClass.mjs';
import { RuleDrawersCabinetClass } from '../rules/CabinetClass/RuleDrawersCabinetClass.mjs';
import { RuleMaterialsCabinetClass } from '../rules/CabinetClass/RuleMaterialsCabinetClass.mjs';
// Collection Class (Cabinet Side)
import { RuleTypeSideCabinetClass } from '../rules/CabinetClass/Side/RuleTypeSideCabinetClass.mjs';
import { RuleVisibleSideCabinetClass } from '../rules/CabinetClass/Side/RuleVisibleSideCabinetClass.mjs';
// Collection Class (Cabinet Sink)
import { RuleTypeSinkCabinetClass } from '../rules/CabinetClass/Sink/RuleTypeSinkCabinetClass.mjs';
import { RuleVisibleSinkCabinetClass } from '../rules/CabinetClass/Sink/RuleVisibleSinkCabinetClass.mjs';
import { RuleWidthCabinetUrbanDuplex } from '../rules/CabinetUrbanDuplex/RuleWidthCabinetUrbanDuplex.mjs';
import { RuleHeightCabinetUrbanDuplex } from '../rules/CabinetUrbanDuplex/RuleHeightCabinetUrbanDuplex.mjs';
import { RuleDepthCabinetUrbanDuplex } from '../rules/CabinetUrbanDuplex/RuleDepthCabinetUrbanDuplex.mjs';

import { RuleHandleSideCabinetUrbanDuplex } from '../rules/CabinetUrbanDuplex/RuleHandleSideCabinetUrbanDuplex.mjs';
import { RuleHandleCabinetUrbanDuplex } from '../rules/CabinetUrbanDuplex/RuleHandleCabinetUrbanDuplex.mjs';

import { RuleDrawersCabinetUrbanDuplex } from '../rules/CabinetUrbanDuplex/RuleDrawersCabinetUrbanDuplex.mjs';

import { RuleTypeSinkCabinetUrbanDuplex } from '../rules/CabinetUrbanDuplex/Sink/RuleTypeSinkCabinetUrbanDuplex.mjs';
import { RuleTypeSideCabinetUrbanDuplex } from '../rules/CabinetUrbanDuplex/Side/RuleTypeSideCabinetUrbanDuplex.mjs';

import { RuleMaterialsCabinetUrbanDuplex } from '../rules/CabinetUrbanDuplex/RuleMaterialsCabinetUrbanDuplex.mjs';
import { RuleMaterialsCabinetLateralUrbanDuplex } from '../rules/CabinetUrbanDuplex/RuleMaterialsCabinetLateralUrbanDuplex.mjs';
import { RuleMaterialsHandleGrooveUrbanDuplex } from '../rules/CabinetUrbanDuplex/RuleMaterialsHandleGrooveUrbanDuplex.mjs';
import { RuleMaterialsOtherUrbanDuplex } from '../rules/CabinetUrbanDuplex/RuleMaterialsOtherUrbanDuplex.mjs';

import { RuleWidthUDOpenShelves } from '../rules/CabinetUrbanDuplex/OpenShelves/RuleWidthUDOpenShelves.mjs';
import { RuleHeightUDOpenShelves } from '../rules/CabinetUrbanDuplex/OpenShelves/RuleHeightUDOpenShelves.mjs';
import { RuleDepthUDOpenShelves } from '../rules/CabinetUrbanDuplex/OpenShelves/RuleDepthUDOpenShelves.mjs';
import { RuleMaterialsUDOpenShelves } from '../rules/CabinetUrbanDuplex/OpenShelves/RuleMaterialsUDOpenShelves.mjs';

import { RuleHeightUDOpenShelvesSide } from '../rules/CabinetUrbanDuplex/OpenShelvesSide/RuleHeightUDOpenShelvesSide.mjs';
import { RuleDepthUDOpenShelvesSide } from '../rules/CabinetUrbanDuplex/OpenShelvesSide/RuleDepthUDOpenShelvesSide.mjs';
import { RuleMaterialsUDOpenShelvesSide } from '../rules/CabinetUrbanDuplex/OpenShelvesSide/RuleMaterialsUDOpenShelvesSide.mjs';

// Collection Urban Freestanding
import { RuleWidthCabinetUrbanFreestanding } from '../rules/CabinetUrbanFreestanding/RuleWidthCabinetUrbanFreestanding.mjs';
import { RuleHeightCabinetUrbanFreestanding } from '../rules/CabinetUrbanFreestanding/RuleHeightCabinetUrbanFreestanding.mjs';
import { RuleDepthCabinetUrbanFreestanding } from '../rules/CabinetUrbanFreestanding/RuleDepthCabinetUrbanFreestanding.mjs';
import { RuleDrawersCabinetUrbanFreestanding } from '../rules/CabinetUrbanFreestanding/RuleDrawersCabinetUrbanFreestanding.mjs';
import { RuleHandleCabinetUrbanFreestanding } from '../rules/CabinetUrbanFreestanding/RuleHandleCabinetUrbanFreestanding.mjs';
import { RuleMaterialsCabinetUrbanFreestanding } from '../rules/CabinetUrbanFreestanding/RuleMaterialsCabinetUrbanFreestanding.mjs';
import { RuleMaterialsHandleUrbanFreestanding } from '../rules/CabinetUrbanFreestanding/RuleMaterialsHandleUrbanFreestanding.mjs';
import { RuleWidthUFOpenShelves } from '../rules/CabinetUrbanFreestanding/OpenShelves/RuleWidthUFOpenShelves.mjs';
import { RuleHeightUFOpenShelves } from '../rules/CabinetUrbanFreestanding/OpenShelves/RuleHeightUFOpenShelves.mjs';
import { RuleDepthUFOpenShelves } from '../rules/CabinetUrbanFreestanding/OpenShelves/RuleDepthUFOpenShelves.mjs';
import { RuleMaterialsUFOpenShelves } from '../rules/CabinetUrbanFreestanding/OpenShelves/RuleMaterialsUFOpenShelves.mjs';
import { RuleHeightUFOpenShelvesSide } from '../rules/CabinetUrbanFreestanding/OpenShelvesSide/RuleHeightUFOpenShelvesSide.mjs';
import { RuleDepthUFOpenShelvesSide } from '../rules/CabinetUrbanFreestanding/OpenShelvesSide/RuleDepthUFOpenShelvesSide.mjs';
import { RuleMaterialsUFOpenShelvesSide } from '../rules/CabinetUrbanFreestanding/OpenShelvesSide/RuleMaterialsUFOpenShelvesSide.mjs';
import { RuleTypeSideCabinetUrbanFreestanding } from '../rules/CabinetUrbanFreestanding/Side/RuleTypeSideCabinetUrbanFreestanding.mjs';
import { RuleTypeSinkCabinetUrbanFreestanding } from '../rules/CabinetUrbanFreestanding/Sink/RuleTypeSinkCabinetUrbanFreestanding.mjs';
// Collection Mako
import { RuleWidthCabinetTricot } from '../rules/CabinetTricot/RuleWidthCabinetTricot.mjs';
import { RuleDrawersCabinetTricot } from '../rules/CabinetTricot/RuleDrawersCabinetTricot.mjs';
import { RuleMaterialsCabinetTricot } from '../rules/CabinetTricot/RuleMaterialsCabinetTricot.mjs';
import { RuleMaterialsHandleTricot } from '../rules/CabinetTricot/RuleMaterialsHandleTricot.mjs';
import { RulePatternCabinetTricot } from '../rules/CabinetTricot/RulePatternCabinetTricot.mjs';
import { RuleTypeSinkCabinetTricot } from '../rules/CabinetTricot/Sink/RuleTypeSinkCabinetTricot.mjs';
import { RuleTypeSideCabinetTricot } from '../rules/CabinetTricot/Side/RuleTypeSideCabinetTricot.mjs';
import { RuleTricotSidePanelLayout } from '../rules/CabinetTricot/SidePanel/RuleTricotSidePanelLayout.mjs';
import { RuleTricotSidePanelMaterials } from '../rules/CabinetTricot/SidePanel/RuleTricotSidePanelMaterials.mjs';
import { RuleInitCabinetMako } from '../rules/CabinetMako/RuleInitCabinetMako.mjs';
import { RuleWidthCabinetMako } from '../rules/CabinetMako/RuleWidthCabinetMako.mjs';
import { RuleHeightCabinetMako } from '../rules/CabinetMako/RuleHeightCabinetMako.mjs';
import { RuleHandleCabinetMako } from '../rules/CabinetMako/RuleHandleCabinetMako.mjs';
import { RuleMaterialsCabinetMako } from '../rules/CabinetMako/RuleMaterialsCabinetMako.mjs';
import { RuleLegsCabinetMako } from '../rules/CabinetMako/RuleLegsCabinetMako.mjs';
// Collection Mako (Cabinet Side)
import { RuleDrawersCabinetSideMako } from '../rules/CabinetMako/Side/RuleDrawersCabinetSideMako.mjs';
import { RuleTypeSideCabinetMako } from '../rules/CabinetMako/Side/RuleTypeSideCabinetMako.mjs';
// Collection Mako (Cabinet Sink)
import { RuleTypeSinkCabinetMako } from '../rules/CabinetMako/Sink/RuleTypeSinkCabinetMako.mjs';
import { RuleDrawersCabinetSinkMako } from '../rules/CabinetMako/Sink/RuleDrawersCabinetSinkMako.mjs';
// VesselColor/CountertopColor для basin_sink обробляється composition rule RuleSlinkMaterial
// import { RuleChangeSlinkColor } from '../rules/Slink/RuleChangeSlinkColor.mjs';

// Sink Rules
// import { RuleScaleSinkPrisma } from '../rules/Sinks/RuleScaleSinkPrisma.mjs';
// import { RulePositionSinkOnTop } from '../rules/Sinks/RulePositionSinkOnTop.mjs';
// import { RuleChangeSinkMaterial } from '../rules/Sinks/RuleChangeSinkMaterial.mjs';
// import { RuleAdaptSinkToParent } from '../rules/Sinks/RuleAdaptSinkToParent.mjs';

/**
 * UD handle panels left out of a cabinet's layout box: RuleOpenSideShelfNeighboursUrbanDuplex stretches them over a
 * neighbouring open side shelf, and a box grown by that stretch made the row layout push the shelf away (by the
 * shelf width) on the next relayout (e.g. a Depth change). The cabinet walls still define the box.
 * Read by ProductRegistry_V2.getAabbIgnoreNodes (row layout, countertop group bounds, the shelf rule's own measure).
 */
const UD_HANDLE_AABB_IGNORE_NODES = Object.freeze([
    'UD_Handle_BaseP_Top', 'UD_Handle_BaseP_Bot',
    'UD_Handle_LateralP_Top', 'UD_Handle_LateralP_Bot',
    'UD_Handle_Full_Top', 'UD_Handle_Full_Bot'
]);

const CABINET_AABB_IGNORE_NODES = [
    'HandleBotCut_Top', 'HandleNoCut_Top', 'HandleTopCut_Top',
    'HandleNoCut_Bot', 'HandleTopCut_Bot',
    'TopDrawerInnerHandle',
    'TopDrawerBolts',
    'BotDrawerBoltsSD',
    'BotDrawerBoltsDD',
    'TopDrawerWalls',
    'BotDrawerWalls',
    'TopDrawerFloor',
    'BotDrawerFloor',
    'TopDrawerHinge',
    'BotDrawerHinge',
    'DividersUni_Point_Clone',
    'Dividers46_Point',
    'Dividers50_Point',
    'Divider_A_',
    'Divider_B_',
    'Divider_C_'
];

// Drawer overlays that ship inside the UF / ULH templates; RuleOverlayFluting textures them (product `fluting`).
const UF_FLUTING_OVERLAYS = Object.freeze([
    'UF_Overlay_BotCut_Top', 'UF_Overlay_NoCut_Top', 'UF_Overlay_TopCut_Top',
    'UF_Overlay_NoCut_Bot', 'UF_Overlay_TopCut_Bot'
]);
const ULH_FLUTING_OVERLAYS = Object.freeze(['ULH_Overlay_HNoCut', 'ULH_Overlay_HTopCut']);

const COUNTERTOP_SUPPORT_ANCHOR_BY_COLLECTION = Object.freeze({
    ULH: 'ULH_Countertop_Point',
    CLASS: 'Class_Countertop_Point',
    MAKO: 'Mako_Countertop_Point',
    LAME: 'Lame_Countertop_Point',
    UF: 'UF_Countertop_Point',
    TRICOT: 'Tricot_Countertop_Point'
});

export const SINK_ANCHOR_BY_COLLECTION = Object.freeze({
    ULH: 'ULH_Cabinet_SinkPoint',
    CLASS: 'ClMa_Sink_Point',
    MAKO: 'ClMa_Sink_Point',
    UNIBOX: 'Sink_Point',
    TRICOT: "Tricot_Sink_Point",
    LAME: "Lame_Sink_Point",
});

export const SINK_THICKNESS_OFFSETS = Object.freeze({
    0.375: Object.freeze({ y: -0.003175 }),
    0.4: Object.freeze({ y: -0.003175 }),
    0.5: Object.freeze({ y: 0 }),
    0.75: Object.freeze({ y: 0.00635 }),
    2.4: Object.freeze({ y: 0.045244 }),
    2.5: Object.freeze({ y: 0.047625 }),
    3.125: Object.freeze({ y: 0.066675 }),
    4: Object.freeze({ y: 0.0889 }),
    4.75: Object.freeze({ y: 0.10795 }),
    5.125: Object.freeze({ y: 0.1179 }),
    5.5: Object.freeze({ y: 0.1267 })
});

export class ProductConfigLoader {
    /**
     * Завантажує всі дефолтні конфігурації
     * @param {ProductRegistry} registry - Інстанс ProductRegistry
     */
    static loadDefaultConfigs(registry) {
        this._loadCounterTops(registry);
        this._loadCabinets(registry);
        this._loadSceneAddons(registry);
        this._loadTowelBars(registry);
        this._loadSinks(registry);
        this._loadShelves(registry);
        this._loadGlobalRules(registry);
    }


    /**
   * Завантажує конфігурацію стільниці
   * @private
   */
    static _loadCounterTops(registry) {
        // Top_Solid - глобальна стільниця що створюється автоматично при додаванні першої тумби
        // Правила для стільниці (RuleCountertopLayout, RuleCountertopBooleanCutouts)
        // зареєстровані глобально в CompositionManager
        registry.registerProduct('Top_Solid', {
            displayName: 'Countertop',
            category: 'countertops',
            tags: ['countertop', 'top-solid'],
            meshConfig: {
                type: 'single',
                meshes: [
                    { templateName: 'Top_Solid', required: true }
                ],
                // Countertop-hosted sink (ULH lift): built only while the top carries CountertopSinkType; the builder
                // creates the anchor by code at CountertopSinkLocalM (anchorLocalKey). No sinkMount here (sinkCabinetDetector).
                subProducts: [
                    {
                        attachPoint: COUNTERTOP_SINK_POINT_NAME,
                        required: false,
                        configKey: COUNTERTOP_SINK_TYPE_KEY,
                        anchorLocalKey: COUNTERTOP_SINK_LOCAL_KEY,
                        matchTags: ['sink'],
                        matchMode: 'all'
                    }
                ]
            },
            rules: [
                // registry.registerGlobalRule(RuleChangeCountertopHeight, 25),
                // registry.registerGlobalRule(RuleChangeCountertopDepth, 30),
                { rule: RuleChangeCountertopHeight, priority: 25 },
                { rule: RuleChangeCountertopDepth, priority: 30 },
                { rule: RuleChangeCountertopPositionByStrategy, priority: 35 },
                { rule: RuleCountertopSinkPointPosition, priority: 60 },
                // Локальні правила для стільниці
                // Тут можна додати правила масштабування, позиціонування тощо
            ],
            defaultConfig: {
                Thickness: 0.375,
                CountertopLengthM: null,
                CountertopRole: 'basinTop',
            },
            countertopMount: {
                anchorName: 'Countertop_Mount_Point',
                fallbackMeshName: 'TopSolid',
                // TopSolid template is 0.5 in (0.0127 m) thick with a centred pivot.
                baseLocalYM: -0.00635
            },
            thicknessOffsets: {
                countertop: {
                    0.375: { y: -0.003175 },
                    0.4: { y: -0.003175 },
                    0.5: { y: 0 },
                    0.75: { y: 0.00635 },
                    2.4: { y: 0.045244 },
                    2.5: { y: 0.047625 },
                    3.125: { y: 0.066675 },
                    4: { y: 0.0889 },
                    4.75: { y: 0.10795 },
                    5.125: { y: 0.117475 },
                    5.5: { y: 0.126675 },
                },
                sink: {
                    ...SINK_THICKNESS_OFFSETS
                }
            }
        });
        registry.registerProduct('Cabinet_Cover', {
            displayName: 'Cabinet Cover',
            category: 'countertops',
            tags: ['countertop', 'cabinet-cover', 'derived'],
            meshConfig: {
                type: 'single',
                meshes: [{ templateName: 'Top_Solid', required: true }]
            },
            rules: [],
            defaultConfig: {
                CountertopRole: 'cabinetCover',
                generatedBy: 'cabinet-cover-v1'
            }
        });
    }

    /**
     * Завантажує конфігурації шаф
     * @private
     */
    static _loadCabinets(registry) {

        // CabinetUniBox - простий продукт (один mesh)
        // Sink Base - складний продукт (шафа + вибір умивальника)
        registry.registerProduct('Sink-Base', {
            displayName: 'Sink Base Cabinet',
            category: 'cabinets',
            tags: ['cabinet', 'sink-base'],
            sinkMount: {
                anchorName: SINK_ANCHOR_BY_COLLECTION.UNIBOX
            },
            meshConfig: {
                type: 'composite',
                meshes: [
                    { templateName: 'CabinetUniBox', required: true }
                ],
                subProducts: [
                    {
                        attachPoint: SINK_ANCHOR_BY_COLLECTION.UNIBOX,
                        required: true,
                        matchTags: ['sink'],
                        matchMode: 'all',
                        defaultValue: 'Top_HPLPrisma',
                        configKey: 'sinkType'
                    }
                ]
            },
            rules: [
                { rule: RuleVisibleSinkBase, priority: 10 },
                { rule: RuleScaleWidthCabinetUniBox, priority: 10 },
                { rule: RuleScaleHeightCabinetUniBox, priority: 20 },
                { rule: RuleScaleDepthCabinetUniBox, priority: 30 },
                { rule: RuleChangeSinkType, priority: 30 },
                { rule: RuleHandleVisibility, priority: 40 },

                { rule: RuleDividersTopFullDrawer, priority: 44 },
                { rule: RuleDividersTopDrawer, priority: 45 },
                { rule: RuleDividersBotDrawer, priority: 46 },
                { rule: RuleHandleDrawers, priority: 50 },
                { rule: RuleGrainDirection, priority: 55 },
                { rule: RuleDrawerPanelFluting, priority: 56 },
                { rule: RuleDrawerOverlayLayout, priority: 57 },
                { rule: RuleHandleOverlayVisibility, priority: 58 },
                { rule: RuleSlinkPosition, priority: 60 }
            ],
            defaultConfig: {
                Width: 60,
                Height: 56,
                Depth: 46,
                Drawers: '2D',
                sinkType: 'Top_HPLPrisma',
                VesselColor: '',
                Thickness: 0.375,
                GrainDirection: 'None',
                DrawerPanelFluting: 'None',
                topDrawerType: 'Top',
                TopDrawerDividers: new DividerController().getAllSlots(120, "Top", {}),
                BotDrawerDividers: new DividerController().getAllSlots(120, "Bot", {}),
                aabbIgnoreNodes: CABINET_AABB_IGNORE_NODES,
            },
            thicknessOffsets: {
                sink: {
                    0.375: { y: -0.003175 },
                    0.4: { y: -0.003175 },
                    0.5: { y: 0 },

                    2.4: { y: 0.045244 },
                    2.5: { y: 0.047625 },
                    4: { y: 0.0889 },
                    5.125: { y: 0.1179 },
                    5.5: { y: 0.1267 },
                }
            }
        });
        registry.registerProduct('Sink-Cabinet', {
            displayName: 'Sink Base Cabinet',
            category: 'cabinets',
            tags: ['cabinet', 'sink-cabinet'],
            meshConfig: {
                type: 'composite',
                meshes: [
                    { templateName: 'CabinetUniBox', required: true }
                ],
                subProducts: []
            },
            rules: [
                { rule: RuleVisibleSinkCabinet, priority: 10 },
                { rule: RuleScaleWidthCabinetUniBox, priority: 10 },
                { rule: RuleScaleHeightCabinetUniBox, priority: 20 },
                { rule: RuleScaleDepthCabinetUniBox, priority: 30 },
                { rule: RuleHandleVisibility, priority: 40 },
                { rule: RuleDividersTopFullDrawer, priority: 44 },
                // { rule: RuleDividersTopDrawer, priority: 45 },
                { rule: RuleDividersBotDrawer, priority: 46 },
                { rule: RuleHandleDrawers, priority: 50 },
                { rule: RuleGrainDirection, priority: 55 },
                { rule: RuleDrawerPanelFluting, priority: 56 },
                { rule: RuleDrawerOverlayLayout, priority: 57 },
                { rule: RuleHandleOverlayVisibility, priority: 58 },


            ],
            defaultConfig: {
                Width: 60,
                Height: 56,
                Depth: 60,
                Drawers: '2D',
                GrainDirection: 'None',
                DrawerPanelFluting: 'None',
                topDrawerType: 'TopFull',
                TopDrawerDividers: new DividerController().getAllSlots(120, "TopFull", {}),
                BotDrawerDividers: new DividerController().getAllSlots(120, "Bot", {}),
                aabbIgnoreNodes: CABINET_AABB_IGNORE_NODES,
            }
        });
        registry.registerProduct('Open-Shelf', {
            displayName: 'Open Shelf',
            category: 'cabinets',
            tags: ['cabinet', 'open-shelf'],
            meshConfig: {
                type: 'composite',
                meshes: [
                    { templateName: 'UniOpenShelves', required: true }
                ],
                subProducts: []
            },
            rules: [
                { rule: RuleScaleWidthOpenShelves, priority: 10 },
                { rule: RuleScaleHeightOpenShelves, priority: 20 },
                { rule: RuleScaleDepthOpenShelves, priority: 30 }
            ],
            defaultConfig: {
                Width: 60,
                Height: 56,
                Depth: 60,
            }
        });
        registry.registerProduct('Side-Shelf', {
            displayName: 'Side Shelf',
            category: 'cabinets',
            tags: ['cabinet', 'side-shelf'],
            meshConfig: {
                type: 'composite',
                meshes: [
                    { templateName: 'UniOpenSideShelves', required: true }
                ],
                subProducts: []
            },
            rules: [
                { rule: RuleScaleHeightUniSideShelves, priority: 20 },
                { rule: RuleScaleDepthUniSideShelves, priority: 30 }
            ],
            defaultConfig: {
                Height: 56,
                Depth: 60,
            }
        });
        registry.registerProduct("ULH-sink-cabinet", {
            displayName: "Urban Low Height",
            category: "cabinets",
            tags: ["cabinet", "urban-low-height"],
            countertopSupport: {
                strategy: 'support-plane',
                anchorName: COUNTERTOP_SUPPORT_ANCHOR_BY_COLLECTION.ULH,
                fallbackMeshNames: ['ULH_Cabinet_Walls']
            },
            sidePanelSupport: {
                profile: ULH_SIDE_PANEL_PROFILE,
                productTypes: ULH_SIDE_PANEL_PRODUCTS
            },
            sinkMount: {
                anchorName: SINK_ANCHOR_BY_COLLECTION.ULH,
                heightLocalY: {
                    25: { y: -0.31 },
                    28: { y: -0.28 },
                    35: { y: -0.21 },
                    38: { y: -0.18 }
                }
            },
            fluting: { overlayNames: ULH_FLUTING_OVERLAYS },
            meshConfig: {
                type: "composite",
                meshes: [{ templateName: "ULH_Cabinet", required: true }],
                subProducts: [
                    {
                        attachPoint: SINK_ANCHOR_BY_COLLECTION.ULH,
                        required: true,
                        matchTags: ["sink"],
                        matchMode: "all",
                        defaultValue: "Top_HPLPrisma",
                        configKey: "sinkType",
                    },
                ],
            },
            rules: [
                // { rule: RuleVisibleSinkBase, priority: 10 },
                { rule: RuleTypeSinkCabinetULH, priority: 60 },
                { rule: RuleWidthULHCabinet, priority: 10 },
                { rule: RuleHeightULHCabinet, priority: 20 },
                { rule: RuleDepthULHCabinet, priority: 30 },
                { rule: RuleChangeSinkType, priority: 30 },
                { rule: RuleHandleULHCabinet, priority: 40 },
                { rule: RuleMaterialsCabinetULH, priority: 50 },
                { rule: RuleOverlayFluting, priority: 56 },
                { rule: RuleSinkMountPosition, priority: 60 },

                // { rule: RuleDividersTopFullDrawer, priority: 44 },
                // { rule: RuleDividersTopDrawer, priority: 45 },
                // { rule: RuleDividersBotDrawer, priority: 46 },
                // { rule: RuleHandleDrawers, priority: 50 },
                // { rule: RuleGrainDirection, priority: 55 },
            ],
            defaultConfig: {
                Width: 60,
                Height: 25,
                Depth: 46,
                Drawers: '2D',
                Handle: 'handle_pto',
                sinkType: 'Top_HPLPrisma',
                VesselColor: '',
                Thickness: 0.375,
                GrainDirection: 'None',
                DrawerPanelFluting: 'None',
                topDrawerType: 'Top',
                TopDrawerDividers: new DividerController().getAllSlots(120, "Top", {}),
                BotDrawerDividers: new DividerController().getAllSlots(120, "Bot", {}),
                aabbIgnoreNodes: CABINET_AABB_IGNORE_NODES,
            },
            thicknessOffsets: {
                sink: SINK_THICKNESS_OFFSETS
            }
        });
        registry.registerProduct("ULH-side-cabinet", {
            displayName: "Urban Low Height",
            category: "cabinets",
            tags: ["cabinet", "urban-low-height", "ulh-side"],
            countertopSupport: {
                strategy: 'support-plane',
                anchorName: COUNTERTOP_SUPPORT_ANCHOR_BY_COLLECTION.ULH,
                fallbackMeshNames: ['ULH_Cabinet_Walls']
            },
            sidePanelSupport: {
                profile: ULH_SIDE_PANEL_PROFILE,
                productTypes: ULH_SIDE_PANEL_PRODUCTS
            },
            fluting: { overlayNames: ULH_FLUTING_OVERLAYS },
            meshConfig: {
                type: "composite",
                meshes: [{ templateName: "ULH_Cabinet", required: true }],
            },
            rules: [
                { rule: RuleTypeSideCabinetULH, priority: 5 },
                { rule: RuleWidthULHCabinet, priority: 10 },
                { rule: RuleHeightULHCabinet, priority: 20 },
                { rule: RuleDepthULHCabinet, priority: 30 },
                // { rule: RuleChangeSinkType, priority: 30 },
                { rule: RuleHandleULHCabinet, priority: 40 },
                { rule: RuleMaterialsCabinetULH, priority: 50 },
                { rule: RuleOverlayFluting, priority: 56 },

                // { rule: RuleDividersTopFullDrawer, priority: 44 },
                // { rule: RuleDividersTopDrawer, priority: 45 },
                // { rule: RuleDividersBotDrawer, priority: 46 },
                // { rule: RuleHandleDrawers, priority: 50 },
                // { rule: RuleGrainDirection, priority: 55 },
                // { rule: RuleSlinkPosition, priority: 60 }
            ],
            defaultConfig: {
                Width: 60,
                Height: 25,
                Depth: 46,
                Drawers: '2D',
                Handle: 'handle_pto',
                VesselColor: '',
                Thickness: 0.375,
                GrainDirection: 'None',
                DrawerPanelFluting: 'None',
                topDrawerType: 'Top',
                TopDrawerDividers: new DividerController().getAllSlots(120, "Top", {}),
                BotDrawerDividers: new DividerController().getAllSlots(120, "Bot", {}),
                aabbIgnoreNodes: CABINET_AABB_IGNORE_NODES,
            },
        });

        registry.registerProduct('ULH-Open-Shelf', {
             displayName: "Urban Low Height-Open Shelf",
            category: 'cabinets',
            tags: ['cabinet',  "urban-low-height", 'open-shelf'],
            countertopSupport: {
                strategy: 'support-plane',
                // UniOpenShelves has no countertop anchor in the PlayCanvas template.
                // Side walls define the stable outer support footprint. OpenShelvesTopBot has
                // an authored sub-millimetre Z offset and must not expand the depth envelope.
                fallbackMeshNames: ['OpenShelvesSideWalls']
            },
            meshConfig: {
                type: 'composite',
                meshes: [
                    { templateName: 'UniOpenShelves', required: true }
                ],
                subProducts: []
            },
            rules: [
                { rule: RuleVisibleULHOpenShelves, priority: 5 },
                { rule: RuleWidthULHOpenShelves, priority: 10 },
                { rule: RuleHeightULHOpenShelves, priority: 20 },
                { rule: RuleDepthULHOpenShelves, priority: 30 }
            ],
            defaultConfig: {
                Width: 60,
                Height: 25,
                Depth: 46,
            }
        });


        registry.registerProduct("Class-sink-cabinet", {
            displayName: "Class",
            category: "cabinets",
            tags: ["cabinet", "class-sink"],
            countertopSupport: {
                strategy: 'support-plane',
                anchorName: COUNTERTOP_SUPPORT_ANCHOR_BY_COLLECTION.CLASS,
                fallbackMeshNames: ['CLMa_Cabinet_Walls']
            },
            sinkMount: {
                anchorName: SINK_ANCHOR_BY_COLLECTION.CLASS,
                heightLocalY: {
                    40: { y: -0.16 },
                    52: { y: -0.04 }
                }
            },
            meshConfig: {
                type: "composite",
                meshes: [{ templateName: "CLMa_Cabinet", required: true }],
                subProducts: [
                    {
                        attachPoint: SINK_ANCHOR_BY_COLLECTION.CLASS,
                        required: true,
                        matchTags: ["sink"],
                        matchMode: "all",
                        defaultValue: "Top_HPLPrisma",
                        configKey: "sinkType",
                    },
                ],
            },
            rules: [
                { rule: RuleVisibleSinkCabinetClass, priority: 10 },
                { rule: RuleChangeSinkType, priority: 15 },
                { rule: RuleWidthCabinetClass, priority: 20 },
                { rule: RuleHeightCabinetClass, priority: 30 },
                { rule: RuleDrawersCabinetClass, priority: 40 },
                { rule: RuleMaterialsCabinetClass, priority: 50 },
                { rule: RuleTypeSinkCabinetClass, priority: 60 },
                { rule: RuleSinkMountPosition, priority: 70 },
            ],
            defaultConfig: {
                Width: 60,
                Height: 52,
                Depth: 52,
                Thickness: 0.5,
                sinkType: 'Top_HPLPrisma',
                InnerDrawer: 'Disable',
            },
            thicknessOffsets: {
                sink: SINK_THICKNESS_OFFSETS
            }
        });
        registry.registerProduct("Class-side-cabinet", {
            displayName: "Class",
            category: "cabinets",
            tags: ["cabinet", "class-side"],
            countertopSupport: {
                strategy: 'support-plane',
                anchorName: COUNTERTOP_SUPPORT_ANCHOR_BY_COLLECTION.CLASS,
                fallbackMeshNames: ['CLMa_Cabinet_Walls']
            },
            meshConfig: {
                type: "composite",
                meshes: [{ templateName: "CLMa_Cabinet", required: true }],
            },
            rules: [
                { rule: RuleVisibleSideCabinetClass, priority: 10 },
                { rule: RuleWidthCabinetClass, priority: 20 },
                { rule: RuleHeightCabinetClass, priority: 30 },
                { rule: RuleDrawersCabinetClass, priority: 40 },
                { rule: RuleMaterialsCabinetClass, priority: 50 },
                { rule: RuleTypeSideCabinetClass, priority: 60 },
            ],
            defaultConfig: {
                Width: 60,
                Height: 52,
                Depth: 52,
                Thickness: 0.5,
                InnerDrawer: 'Disable',
            },
        });
        registry.registerProduct("Mako-sink-cabinet", {
            displayName: "Mako",
            category: "cabinets",
            tags: ["cabinet", "mako-sink"],
            countertopSupport: {
                strategy: 'support-plane',
                anchorName: COUNTERTOP_SUPPORT_ANCHOR_BY_COLLECTION.MAKO,
                fallbackMeshNames: ['CLMa_Cabinet_Walls']
            },
            sinkMount: {
                anchorName: SINK_ANCHOR_BY_COLLECTION.MAKO,
                heightLocalY: {
                    26: { y: -0.3 },
                    52: { y: -0.04 }
                }
            },
            meshConfig: {
                type: "composite",
                meshes: [{ templateName: "CLMa_Cabinet", required: true }],
                subProducts: [
                    {
                        attachPoint: SINK_ANCHOR_BY_COLLECTION.MAKO,
                        required: true,
                        matchTags: ["sink"],
                        matchMode: "all",
                        defaultValue: "Top_HPLPrisma",
                        configKey: "sinkType",
                    },
                ],
            },
            rules: [
                { rule: RuleInitCabinetMako, priority: 10 },
                { rule: RuleChangeSinkType, priority: 15 },
                { rule: RuleWidthCabinetMako, priority: 20 },
                { rule: RuleHeightCabinetMako, priority: 30 },
                { rule: RuleDrawersCabinetSinkMako, priority: 40 },
                { rule: RuleHandleCabinetMako, priority: 45 },
                { rule: RuleMaterialsCabinetMako, priority: 50 },
                { rule: RuleLegsCabinetMako, priority: 55 },
                { rule: RuleTypeSinkCabinetMako, priority: 60 },
                { rule: RuleSinkMountPosition, priority: 70 },
            ],
            defaultConfig: {
                Width: 60,
                Height: 52,
                Depth: 52,
                Thickness: 0.5,
                sinkType: 'Top_HPLPrisma',
                HandleStyle: 'G57',
                ShowLegs: 'Enable',
                CabinetColor: 'Antracite Matte OCF',
                HandleColor: 'Antracite Matte OCF',
                LegColor: 'Antracite Matte OCF',
            },
            thicknessOffsets: {
                sink: SINK_THICKNESS_OFFSETS
            }
        });
        registry.registerProduct("Mako-side-cabinet", {
            displayName: "Mako",
            category: "cabinets",
            tags: ["cabinet", "mako-side"],
            countertopSupport: {
                strategy: 'support-plane',
                anchorName: COUNTERTOP_SUPPORT_ANCHOR_BY_COLLECTION.MAKO,
                fallbackMeshNames: ['CLMa_Cabinet_Walls']
            },
            meshConfig: {
                type: "composite",
                meshes: [{ templateName: "CLMa_Cabinet", required: true }],
            },
            rules: [
                { rule: RuleInitCabinetMako, priority: 10 },
                { rule: RuleWidthCabinetMako, priority: 20 },
                { rule: RuleHeightCabinetMako, priority: 30 },
                { rule: RuleDrawersCabinetSideMako, priority: 40 },
                { rule: RuleHandleCabinetMako, priority: 45 },
                { rule: RuleMaterialsCabinetMako, priority: 50 },
                { rule: RuleLegsCabinetMako, priority: 55 },
                { rule: RuleTypeSideCabinetMako, priority: 60 },
            ],
            defaultConfig: {
                Width: 60,
                Height: 52,
                Depth: 52,
                Thickness: 0.5,
                HandleStyle: 'G57',
                ShowLegs: 'Enable',
                CabinetColor: 'Antracite Matte OCF',
                HandleColor: 'Antracite Matte OCF',
                LegColor: 'Antracite Matte OCF',
            },
        });

        // Urban Duplex
        // connectPoints of both UD cabinets: the drag snaps to these nodes' faces, not only to the carcass box — the
        // Duplex handle's base and lateral panels end where a neighbour meets them (spec L, column-snap.mjs). The carcass
        // is the config box (the draft's AABB), so only the handle panels are listed.
        const UD_CONNECT_POINTS = ['UD_Handle_BaseP_Top', 'UD_Handle_BaseP_Bot', 'UD_Handle_LateralP_Top', 'UD_Handle_LateralP_Bot']
            .map(node => ({ node, kind: 'x-faces' }));
        registry.registerProduct('UD-sink-cabinet', {
            displayName: 'Urban Duplex',
            category: 'cabinets',
            tags: ['cabinet', 'urban-duplex-sink'],
            countertopSupport: {
                strategy: 'support-plane',
                anchorName: 'UD_Countertop_Point',
                fallbackMeshNames: ['UD_Cabinet_Walls']
            },
            sinkMount: {
                anchorName: SINK_ANCHOR_BY_COLLECTION.UNIBOX,
                // Sink_Point local Y at a 0.5" top, by Height (the UD_Cabinet_Mount move of RuleHeightCabinetUrbanDuplex).
                heightLocalY: {
                    56: { y: 0 },
                    53: { y: -0.03 },
                    38: { y: -0.18 },
                    28: { y: -0.28 }
                }
            },
            meshConfig: {
                type: 'composite',
                meshes: [{ templateName: 'UD_Cabinet', required: true }],
                subProducts: [{
                    attachPoint: SINK_ANCHOR_BY_COLLECTION.UNIBOX,
                    required: true,
                    matchTags: ['sink'],
                    matchMode: 'all',
                    defaultValue: 'Top_HPLPrisma',
                    configKey: 'sinkType'
                }]
            },
            rules: [
                { rule: RuleChangeSinkType, priority: 15 },
                { rule: RuleWidthCabinetUrbanDuplex, priority: 20 },
                { rule: RuleHeightCabinetUrbanDuplex, priority: 30 },
                { rule: RuleDepthCabinetUrbanDuplex, priority: 35 },
                { rule: RuleHandleCabinetUrbanDuplex, priority: 45 },
                { rule: RuleDrawersCabinetUrbanDuplex, priority: 46 },
                { rule: RuleHandleSideCabinetUrbanDuplex, priority: 47 },
                { rule: RuleMaterialsCabinetUrbanDuplex, priority: 50 },
                { rule: RuleMaterialsCabinetLateralUrbanDuplex, priority: 54 },
                { rule: RuleMaterialsHandleGrooveUrbanDuplex, priority: 55 },
                { rule: RuleMaterialsOtherUrbanDuplex, priority: 56 },
                { rule: RuleTypeSinkCabinetUrbanDuplex, priority: 60 },
                { rule: RuleSinkMountPosition, priority: 70 }
            ],
            defaultConfig: { Width: 60, Height: 56, Depth: 46, HandleStyle: 'Duplex', HandleSide: 'Right', Drawers: '2D',
                aabbIgnoreNodes: UD_HANDLE_AABB_IGNORE_NODES },
            thicknessOffsets: {
                sink: SINK_THICKNESS_OFFSETS
            },
            connectPoints: UD_CONNECT_POINTS
        });
        registry.registerProduct('UD-side-cabinet', {
            displayName: 'Urban Duplex',
            category: 'cabinets',
            tags: ['cabinet', 'urban-duplex-side'],
            countertopSupport: {
                strategy: 'support-plane',
                anchorName: 'UD_Countertop_Point',
                fallbackMeshNames: ['UD_Cabinet_Walls']
            },
            meshConfig: {
                type: 'composite',
                meshes: [{ templateName: 'UD_Cabinet', required: true }]
            },
            rules: [
                { rule: RuleWidthCabinetUrbanDuplex, priority: 20 },
                { rule: RuleHeightCabinetUrbanDuplex, priority: 30 },
                { rule: RuleDepthCabinetUrbanDuplex, priority: 35 },
                { rule: RuleHandleCabinetUrbanDuplex, priority: 45 },
                { rule: RuleDrawersCabinetUrbanDuplex, priority: 46 },
                { rule: RuleHandleSideCabinetUrbanDuplex, priority: 47 },
                { rule: RuleMaterialsCabinetUrbanDuplex, priority: 50 },
                { rule: RuleMaterialsCabinetLateralUrbanDuplex, priority: 54 },
                { rule: RuleMaterialsHandleGrooveUrbanDuplex, priority: 55 },
                { rule: RuleMaterialsOtherUrbanDuplex, priority: 56 },
                { rule: RuleTypeSideCabinetUrbanDuplex, priority: 60 }
            ],
            defaultConfig: { Width: 60, Height: 56, Depth: 46, HandleStyle: 'Duplex', HandleSide: 'Right', Drawers: '2D',
                aabbIgnoreNodes: UD_HANDLE_AABB_IGNORE_NODES },
            connectPoints: UD_CONNECT_POINTS
        });

        registry.registerProduct('UD-open-shelves', {
            displayName: 'Urban Duplex Open Shelves',
            category: 'cabinets',
            tags: ['cabinet', 'urban-duplex', 'open-shelf'],
            countertopSupport: {
                strategy: 'support-plane',
                // Same template as ULH-Open-Shelf (UniOpenShelves, no countertop anchor).
                // Side walls define the stable outer support footprint. OpenShelvesTopBot has
                // an authored sub-millimetre Z offset and must not expand the depth envelope.
                fallbackMeshNames: ['OpenShelvesSideWalls']
            },
            meshConfig: {
                type: 'composite',
                meshes: [{ templateName: 'UniOpenShelves', required: true }]
            },
            rules: [
                { rule: RuleWidthUDOpenShelves, priority: 20 },
                { rule: RuleHeightUDOpenShelves, priority: 30 },
                { rule: RuleDepthUDOpenShelves, priority: 35 },
                { rule: RuleMaterialsUDOpenShelves, priority: 50 }
            ],
            defaultConfig: { Width: 60, Height: 56, Depth: 46 }
        });

        registry.registerProduct('UD-open-shelves-side', {
            displayName: 'Urban Duplex Open Side Shelves',
            category: 'cabinets',
            tags: ['cabinet', 'urban-duplex', 'open-shelf', 'open-side-shelf'],
            countertopSupport: {
                strategy: 'support-plane',
                fallbackMeshNames: ['OpenSideShelvesBackWall', 'OpenSideShelvesSideWall']
            },
            meshConfig: {
                type: 'composite',
                meshes: [{ templateName: 'UniOpenSideShelves', required: true }]
            },
            rules: [
                { rule: RuleHeightUDOpenShelvesSide, priority: 30 },
                { rule: RuleDepthUDOpenShelvesSide, priority: 35 },
                { rule: RuleMaterialsUDOpenShelvesSide, priority: 50 }
            ],
            defaultConfig: { Width: 15, Height: 56, Depth: 46 }
        });

        // Urban Freestanding
        registry.registerProduct("UF-sink-cabinet", {
            displayName: "Urban Freestanding",
            category: "cabinets",
            tags: ["cabinet", "urban-freestanding-sink"],
            countertopSupport: {
                strategy: 'support-plane',
                anchorName: COUNTERTOP_SUPPORT_ANCHOR_BY_COLLECTION.UF,
                fallbackMeshNames: ['UF_Cabinet_Walls']
            },
            sidePanelSupport: {
                profile: UF_SIDE_PANEL_PROFILE,
                productTypes: UF_SIDE_PANEL_PRODUCTS
            },
            sinkMount: {
                anchorName: SINK_ANCHOR_BY_COLLECTION.UNIBOX,
                // Sink_Point local Y at a 0.5" top, by UF guide height (ufHeightOf).
                // Values: NEW sheet E41:E44 (Sink_Point MoveY); v69 base is 0.35 at height 91.
                heightLocalY: {
                    53: { y: -0.03 },
                    56: { y: 0 },
                    88: { y: 0.32 },
                    91: { y: 0.35 }
                }
            },
            fluting: { overlayNames: UF_FLUTING_OVERLAYS },
            meshConfig: {
                type: "composite",
                meshes: [{ templateName: "UF_Cabinet", required: true }],
                subProducts: [
                    {
                        attachPoint: SINK_ANCHOR_BY_COLLECTION.UNIBOX,
                        required: true,
                        matchTags: ["sink"],
                        matchMode: "all",
                        defaultValue: "Top_HPLPrisma",
                        configKey: "sinkType",
                    },
                ],
            },
            rules: [
                { rule: RuleChangeSinkType, priority: 15 },
                { rule: RuleWidthCabinetUrbanFreestanding, priority: 20 },
                { rule: RuleHeightCabinetUrbanFreestanding, priority: 30 },
                { rule: RuleDepthCabinetUrbanFreestanding, priority: 35 },
                { rule: RuleDrawersCabinetUrbanFreestanding, priority: 40 },
                { rule: RuleHandleCabinetUrbanFreestanding, priority: 45 },
                { rule: RuleMaterialsCabinetUrbanFreestanding, priority: 50 },
                { rule: RuleMaterialsHandleUrbanFreestanding, priority: 55 },
                { rule: RuleOverlayFluting, priority: 56 },
                { rule: RuleTypeSinkCabinetUrbanFreestanding, priority: 60 },
                { rule: RuleSinkMountPosition, priority: 70 },
            ],
            defaultConfig: {
                Width: 60,
                Height: 91,
                Depth: 50,
                DrawerPanelFluting: 'None',
            },
            thicknessOffsets: {
                sink: SINK_THICKNESS_OFFSETS
            },
        });
        registry.registerProduct("UF-side-cabinet", {
            displayName: "Urban Freestanding",
            category: "cabinets",
            tags: ["cabinet", "urban-freestanding-side"],
            countertopSupport: {
                strategy: 'support-plane',
                anchorName: COUNTERTOP_SUPPORT_ANCHOR_BY_COLLECTION.UF,
                fallbackMeshNames: ['UF_Cabinet_Walls']
            },
            sidePanelSupport: {
                profile: UF_SIDE_PANEL_PROFILE,
                productTypes: UF_SIDE_PANEL_PRODUCTS
            },
            fluting: { overlayNames: UF_FLUTING_OVERLAYS },
            meshConfig: {
                type: "composite",
                meshes: [{ templateName: "UF_Cabinet", required: true }],
            },
            rules: [
                { rule: RuleTypeSideCabinetUrbanFreestanding, priority: 5 },
                { rule: RuleWidthCabinetUrbanFreestanding, priority: 20 },
                { rule: RuleHeightCabinetUrbanFreestanding, priority: 30 },
                { rule: RuleDepthCabinetUrbanFreestanding, priority: 35 },
                { rule: RuleDrawersCabinetUrbanFreestanding, priority: 40 },
                { rule: RuleHandleCabinetUrbanFreestanding, priority: 45 },
                { rule: RuleMaterialsCabinetUrbanFreestanding, priority: 50 },
                { rule: RuleMaterialsHandleUrbanFreestanding, priority: 55 },
                { rule: RuleOverlayFluting, priority: 56 },
            ],
            defaultConfig: {
                Width: 60,
                Height: 91,
                Depth: 50,
                DrawerPanelFluting: 'None',
            },
        });
        registry.registerProduct('UF-open-shelves', {
            displayName: 'Urban Freestanding Open Shelves',
            category: 'cabinets',
            tags: ['cabinet', 'urban-freestanding', 'open-shelf'],
            countertopSupport: {
                strategy: 'support-plane',
                fallbackMeshNames: ['UF_OS_Body'],
            },
            meshConfig: {
                type: 'composite',
                meshes: [{ templateName: 'UF_OpenShelf', required: true }],
            },
            rules: [
                { rule: RuleWidthUFOpenShelves, priority: 20 },
                { rule: RuleHeightUFOpenShelves, priority: 30 },
                { rule: RuleDepthUFOpenShelves, priority: 35 },
                { rule: RuleMaterialsUFOpenShelves, priority: 50 },
            ],
            defaultConfig: { Width: 60, Height: 91, Depth: 50 },
        });
        registry.registerProduct('UF-open-shelves-side', {
            displayName: 'Urban Freestanding Open Side Shelves',
            category: 'cabinets',
            tags: ['cabinet', 'urban-freestanding', 'side-shelf'],
            countertopSupport: {
                strategy: 'support-plane',
                fallbackMeshNames: ['UF_OSS_Body'],
            },
            meshConfig: {
                type: 'composite',
                meshes: [{ templateName: 'UF_OpenSideShelf', required: true }],
            },
            rules: [
                { rule: RuleHeightUFOpenShelvesSide, priority: 30 },
                { rule: RuleDepthUFOpenShelvesSide, priority: 35 },
                { rule: RuleMaterialsUFOpenShelvesSide, priority: 50 },
            ],
            // Template width is fixed at 0.15 m; configuration uses centimetres.
            defaultConfig: { Width: 15, Height: 91, Depth: 50 },
        });

        // Lame: heights 26/52 cm and fixed depth 52 cm.
        registry.registerProduct("Lame-sink-cabinet", {
            displayName: "Lame",
            category: "cabinets",
            tags: ["cabinet", "lame-sink"],
            countertopSupport: {
                strategy: 'support-plane',
                anchorName: COUNTERTOP_SUPPORT_ANCHOR_BY_COLLECTION.LAME,
                fallbackMeshNames: ['Lame_Cabinet_Walls']
            },
            sinkMount: {
                anchorName: SINK_ANCHOR_BY_COLLECTION.LAME,
                heightLocalY: {
                    26: { y: -0.04 },
                    52: { y: -0.04 }
                }
            },
            meshConfig: {
                type: "composite",
                meshes: [{ templateName: "Lame_Cabinet", required: true }],
                subProducts: [{
                    attachPoint: SINK_ANCHOR_BY_COLLECTION.LAME,
                    required: true,
                    matchTags: ["sink"],
                    matchMode: "all",
                    defaultValue: "Top_HPLPrisma",
                    configKey: "sinkType",
                }],
            },
            rules: [
                { rule: RuleTypeSinkCabinetLame, priority: 60 },
                { rule: RuleChangeSinkType, priority: 15 },
                { rule: RuleWidthCabinetLame, priority: 20 },
                { rule: RuleHeightCabinetLame, priority: 30 },
                { rule: RuleDrawersCabinetLame, priority: 40 },
                { rule: RuleMaterialsCabinetLame, priority: 50 },
                { rule: RuleMaterialsHandleLame, priority: 55 },
                { rule: RuleMaterialsLegCapLame, priority: 56 },
                { rule: RuleMaterialsUndertopLame, priority: 57 },
                { rule: RulePatternCabinetLame, priority: 70 },
                { rule: RuleSinkMountPosition, priority: 70 },
            ],
            defaultConfig: {
                Width: 60,
                Height: 52,
                Depth: 52,
                Thickness: 0.5,
                Drawers: '2D',
                CabinetPattern: 'Galles',
                ShowUndertop: 'Disable',
                ShowLegs: 'Disable',
                CabinetColor: 'Antracite Matte OCF',
                HandleColor: 'Antracite Matte OCF',
                sinkType: 'Top_HPLPrisma',
            },
            thicknessOffsets: {
                sink: SINK_THICKNESS_OFFSETS
            },
        });

        registry.registerProduct("Lame-side-cabinet", {
            displayName: "Lame",
            category: "cabinets",
            tags: ["cabinet", "lame-side"],
            countertopSupport: {
                strategy: 'support-plane',
                anchorName: COUNTERTOP_SUPPORT_ANCHOR_BY_COLLECTION.LAME,
                fallbackMeshNames: ['Lame_Cabinet_Walls']
            },
            meshConfig: {
                type: "composite",
                meshes: [{ templateName: "Lame_Cabinet", required: true }],
            },
            rules: [
                { rule: RuleTypeSideCabinetLame, priority: 5 },
                { rule: RuleWidthCabinetLame, priority: 20 },
                { rule: RuleHeightCabinetLame, priority: 30 },
                { rule: RuleDrawersCabinetLame, priority: 40 },
                { rule: RuleMaterialsCabinetLame, priority: 50 },
                { rule: RuleMaterialsHandleLame, priority: 55 },
                { rule: RuleMaterialsLegCapLame, priority: 56 },
                { rule: RuleMaterialsUndertopLame, priority: 57 },
                { rule: RulePatternCabinetLame, priority: 70 },
            ],
            defaultConfig: {
                Width: 60,
                Height: 52,
                Depth: 52,
                Thickness: 0.5,
                Drawers: '2D',
                CabinetPattern: 'Galles',
                ShowUndertop: 'Disable',
                ShowLegs: 'Disable',
                CabinetColor: 'Antracite Matte OCF',
                HandleColor: 'Antracite Matte OCF',
            },
        });

         // Tricot: fixed height 40 cm and depth 52 cm; width is configurable.
        registry.registerProduct("Tricot-sink-cabinet", {
            displayName: "Tricot",
            category: "cabinets",
            tags: ["cabinet", "tricot-sink"],
            countertopSupport: {
                strategy: 'support-plane',
                anchorName: COUNTERTOP_SUPPORT_ANCHOR_BY_COLLECTION.TRICOT,
                fallbackMeshNames: ['CLMa_Cabinet_Walls']
            },
            sidePanelSupport: {
                profile: TRICOT_SIDE_PANEL_PROFILE,
                productTypes: TRICOT_SIDE_PANEL_PRODUCTS
            },
            sinkMount: {
                anchorName: SINK_ANCHOR_BY_COLLECTION.TRICOT,
                // Tricot_Sink_Point local Y at a 0.5" top; the Tricot body has one height (40), as Class at 40.
                heightLocalY: { 40: { y: -0.16 } }
            },
            meshConfig: {
                type: "composite",
                meshes: [{ templateName: "Tricot_Cabinet", required: true }],
                subProducts: [{
                    attachPoint: SINK_ANCHOR_BY_COLLECTION.TRICOT,
                    required: true,
                    matchTags: ["sink"],
                    matchMode: "all",
                    defaultValue: "Top_HPLPrisma",
                    configKey: "sinkType",
                }],
            },
            rules: [
                { rule: RuleChangeSinkType, priority: 15 },
                { rule: RuleWidthCabinetTricot, priority: 20 },
                { rule: RuleDrawersCabinetTricot, priority: 40 },
                { rule: RuleMaterialsCabinetTricot, priority: 50 },
                { rule: RuleMaterialsHandleTricot, priority: 55 },
                { rule: RuleTypeSinkCabinetTricot, priority: 60 },
                { rule: RulePatternCabinetTricot, priority: 70 },
                { rule: RuleSinkMountPosition, priority: 70 },
            ],
            defaultConfig: {
                Width: 60,
                Height: 40,
                Depth: 52,
                sinkType: 'Top_HPLPrisma',
                Drawers: '2D',
                CabinetColor: 'Antracite Matte OCF',
                CabinetPattern: 'Galles',
            },
            thicknessOffsets: {
                sink: SINK_THICKNESS_OFFSETS
            },
        });
        registry.registerProduct("Tricot-side-cabinet", {
            displayName: "Tricot",
            category: "cabinets",
            tags: ["cabinet", "tricot-side"],
            countertopSupport: {
                strategy: 'support-plane',
                anchorName: COUNTERTOP_SUPPORT_ANCHOR_BY_COLLECTION.TRICOT,
                fallbackMeshNames: ['CLMa_Cabinet_Walls']
            },
            sidePanelSupport: {
                profile: TRICOT_SIDE_PANEL_PROFILE,
                productTypes: TRICOT_SIDE_PANEL_PRODUCTS
            },
            meshConfig: {
                type: "composite",
                meshes: [{ templateName: "Tricot_Cabinet", required: true }],
            },
            rules: [
                { rule: RuleWidthCabinetTricot, priority: 20 },
                { rule: RuleDrawersCabinetTricot, priority: 40 },
                { rule: RuleMaterialsCabinetTricot, priority: 50 },
                { rule: RuleMaterialsHandleTricot, priority: 55 },
                { rule: RuleTypeSideCabinetTricot, priority: 60 },
                { rule: RulePatternCabinetTricot, priority: 70 },
            ],
            defaultConfig: { Width: 60, Height: 40, Depth: 52, Drawers: '2D', CabinetColor: 'Antracite Matte OCF', CabinetPattern: 'Galles' },
        });

    }

    /**
     * Завантажує конфігурації умивальників
     * @private
     */
    static _loadSinks(registry) {
        // Top_HPLPrisma
        registry.registerProduct('Top_HPLPrisma', {
            displayName: 'HPL Prisma Sink',
            category: 'sinks',
            tags: ['sink', 'prisma'],
            isSubProduct: true,
            parentAttachPoint: 'Sink_Point',
            inheritFromParent: ['Width', 'Depth'],
            meshConfig: {
                type: 'single',
                meshes: [
                    { templateName: 'Top_HPLPrisma', required: true }
                ]
            },
            rules: [],
            defaultConfig: {

            }
        });

        // Top_HPLPrisma
        registry.registerProduct('Top_Glass_Nettuno', {
            displayName: 'Glass Nettuno',
            category: 'sinks',
            tags: ['sink', 'prisma'],
            isSubProduct: true,
            parentAttachPoint: 'Sink_Point',
            inheritFromParent: ['Width', 'Depth'],
            meshConfig: {
                type: 'single',
                meshes: [
                    { templateName: 'Top_Glass_Nettuno', required: true }
                ]
            },
            rules: [],
            defaultConfig: {

            }
        });

        // Top_HPLQuadra
        registry.registerProduct('Top_HPLQuadra', {
            displayName: 'HPL Quadra Sink',
            category: 'sinks',
            tags: ['sink', 'quadra'],
            isSubProduct: true,
            parentAttachPoint: 'SlinkEmptyEntety',
            inheritFromParent: ['Width', 'Depth'],
            meshConfig: {
                type: 'single',
                meshes: [
                    { templateName: 'Top_HPLQuadra', required: true }
                ]
            },
            rules: [],
            defaultConfig: {

            }
        });

        // Top_HPLCover
        registry.registerProduct('Top_HPLCover', {
            displayName: 'HPL Cover Sink',
            category: 'sinks',
            tags: ['sink', 'cover'],
            isSubProduct: true,
            parentAttachPoint: 'SlinkEmptyEntety',
            inheritFromParent: ['Width', 'Depth'],
            meshConfig: {
                type: 'single',
                meshes: [
                    { templateName: 'Top_HPLCover', required: true }
                ]
            },
            rules: [],
            defaultConfig: {}
        });

        // Top_HPLStrip
        registry.registerProduct('Top_HPLStrip', {
            displayName: 'HPL Strip Sink',
            category: 'sinks',
            tags: ['sink', 'strip'],
            isSubProduct: true,
            parentAttachPoint: 'Sink_Point',
            inheritFromParent: ['Width', 'Depth'],
            meshConfig: {
                type: 'single',
                meshes: [
                    { templateName: 'Top_HPLStrip', required: true }
                ]
            },
            rules: [],
            defaultConfig: {
                // Width: 60,
                // Height: 5,
                // Depth: 60,
                // Material: 'HPL_White',
                // OffsetY: 0
            }
        });

        // new products

        registry.registerProduct('Top_HPL/Fenix_Cover_Gres', {
            displayName: 'HPL/Fenix Cover Gres',
            category: 'sinks',
            tags: ['sink', 'cover', 'fenix'],
            isSubProduct: true,
            parentAttachPoint: 'Sink_Point',
            inheritFromParent: ['Width', 'Depth'],
            meshConfig: {
                type: 'single',
                meshes: [
                    { templateName: 'Top_HPL_Fenix_Cover_Gres', required: true }
                ]
            },
            rules: [],
            defaultConfig: {
            }
        });

        registry.registerProduct('Top_HPL/Fenix_Prisma_Gres', {
            displayName: 'HPL/Fenix Prisma Gres',
            category: 'sinks',
            tags: ['sink', 'prisma', 'fenix'],
            isSubProduct: true,
            parentAttachPoint: 'Sink_Point',
            inheritFromParent: ['Width', 'Depth'],
            meshConfig: {
                type: 'single',
                meshes: [
                    { templateName: 'Top_HPL_Fenix_Prisma_Gres', required: true }
                ]
            },
            rules: [],
            defaultConfig: {
            }
        });

        registry.registerProduct('Top_HPL/Fenix_Quadra_Gres', {
            displayName: 'HPL/Fenix Quadra Gres',
            category: 'sinks',
            tags: ['sink', 'quadra', 'fenix'],
            isSubProduct: true,
            parentAttachPoint: 'Sink_Point',
            inheritFromParent: ['Width', 'Depth'],
            meshConfig: {
                type: 'single',
                meshes: [
                    { templateName: 'Top_HPL_Fenix_Quadra_Gres', required: true }
                ]
            },
            rules: [],
            defaultConfig: {
            }
        });

        registry.registerProduct('Top_HPL/Fenix_Strip_Gres', {
            displayName: 'HPL/Fenix Strip Gres',
            category: 'sinks',
            tags: ['sink', 'strip', 'fenix'],
            isSubProduct: true,
            parentAttachPoint: 'Sink_Point',
            inheritFromParent: ['Width', 'Depth'],
            meshConfig: {
                type: 'single',
                meshes: [
                    { templateName: 'Top_HPL_Fenix_Strip_Gres', required: true }
                ]
            },
            rules: [],
            defaultConfig: {
            }
        });

        registry.registerProduct('Top_Glass_Ovale', {
            displayName: 'Glass Ovale',
            category: 'sinks',
            tags: ['sink', 'glass', 'oval'],
            isSubProduct: true,
            parentAttachPoint: 'Sink_Point',
            inheritFromParent: ['Width', 'Depth'],
            meshConfig: {
                type: 'single',
                meshes: [
                    { templateName: 'Top_Glass_Ovale', required: true }
                ]
            },
            rules: [],
            defaultConfig: {
            }
        });

        registry.registerProduct('Top_Mineralmarmo_Diamond', {
            displayName: 'Mineralmarmo Diamond',
            category: 'sinks',
            tags: ['sink', 'mineralmarmo', 'diamond'],
            isSubProduct: true,
            parentAttachPoint: 'Sink_Point',
            inheritFromParent: ['Width', 'Depth'],
            meshConfig: {
                type: 'single',
                meshes: [
                    { templateName: 'Top_Mineralmarmo_Diamond', required: true }
                ]
            },
            rules: [],
            defaultConfig: {
            }
        });

        registry.registerProduct('Top_Ocritech_Oly55', {
            displayName: 'Ocritech Oly55',
            category: 'sinks',
            tags: ['sink', 'ocritech', 'oly55'],
            isSubProduct: true,
            parentAttachPoint: 'Sink_Point',
            inheritFromParent: ['Width', 'Depth'],
            meshConfig: {
                type: 'single',
                meshes: [
                    { templateName: 'Top_Ocritech_Oly55', required: true }
                ]
            },
            rules: [],
            defaultConfig: {
            }
        });

        registry.registerProduct('Top_Ocritech_Oly56', {
            displayName: 'Ocritech Oly56',
            category: 'sinks',
            tags: ['sink', 'ocritech', 'oly56'],
            isSubProduct: true,
            parentAttachPoint: 'Sink_Point',
            inheritFromParent: ['Width', 'Depth'],
            meshConfig: {
                type: 'single',
                meshes: [
                    { templateName: 'Top_Ocritech_Oly56', required: true }
                ]
            },
            rules: [],
            defaultConfig: {
            }
        });

        registry.registerProduct('Top_Ocritech_Orion', {
            displayName: 'Ocritech Orion',
            category: 'sinks',
            tags: ['sink', 'ocritech', 'orion'],
            isSubProduct: true,
            parentAttachPoint: 'Sink_Point',
            inheritFromParent: ['Width', 'Depth'],
            meshConfig: {
                type: 'single',
                meshes: [
                    { templateName: 'Top_Ocritech_Orion', required: true }
                ]
            },
            rules: [],
            defaultConfig: {
            }
        });

        registry.registerProduct('Top_Ocritech_Quadra', {
            displayName: 'Ocritech Quadra',
            category: 'sinks',
            tags: ['sink', 'ocritech', 'quadra'],
            isSubProduct: true,
            parentAttachPoint: 'Sink_Point',
            inheritFromParent: ['Width', 'Depth'],
            meshConfig: {
                type: 'single',
                meshes: [
                    { templateName: 'Top_Ocritech_Quadra', required: true }
                ]
            },
            rules: [],
            defaultConfig: {
            }
        });

        registry.registerProduct('Top_Ocritech_Rayo', {
            displayName: 'Ocritech Rayo',
            category: 'sinks',
            tags: ['sink', 'ocritech', 'rayo'],
            isSubProduct: true,
            parentAttachPoint: 'Sink_Point',
            inheritFromParent: ['Width', 'Depth'],
            meshConfig: {
                type: 'single',
                meshes: [
                    { templateName: 'Top_Ocritech_Rayo', required: true }
                ]
            },
            rules: [],
            defaultConfig: {
            }
        });

        registry.registerProduct('Top_Ocritech_Roll', {
            displayName: 'Ocritech Roll',
            category: 'sinks',
            tags: ['sink', 'ocritech', 'roll'],
            isSubProduct: true,
            parentAttachPoint: 'Sink_Point',
            inheritFromParent: ['Width', 'Depth'],
            meshConfig: {
                type: 'single',
                meshes: [
                    { templateName: 'Top_Ocritech_Roll', required: true }
                ]
            },
            rules: [],
            defaultConfig: {
            }
        });

        registry.registerProduct('Top_Porcelain_Cover', {
            displayName: 'Porcelain Cover',
            category: 'sinks',
            tags: ['sink', 'porcelain', 'cover'],
            isSubProduct: true,
            parentAttachPoint: 'Sink_Point',
            inheritFromParent: ['Width', 'Depth'],
            meshConfig: {
                type: 'single',
                meshes: [
                    { templateName: 'Top_Porcelain_Cover', required: true }
                ]
            },
            rules: [],
            defaultConfig: {
            }
        });

        registry.registerProduct('Top_Porcelain_Prisma', {
            displayName: 'Porcelain Prisma',
            category: 'sinks',
            tags: ['sink', 'porcelain', 'prisma'],
            isSubProduct: true,
            parentAttachPoint: 'Sink_Point',
            inheritFromParent: ['Width', 'Depth'],
            meshConfig: {
                type: 'single',
                meshes: [
                    { templateName: 'Top_Porcelain_Prisma', required: true }
                ]
            },
            rules: [],
            defaultConfig: {
            }
        });

        registry.registerProduct('Top_Porcelain_Quadra', {
            displayName: 'Porcelain Quadra',
            category: 'sinks',
            tags: ['sink', 'porcelain', 'quadra'],
            isSubProduct: true,
            parentAttachPoint: 'Sink_Point',
            inheritFromParent: ['Width', 'Depth'],
            meshConfig: {
                type: 'single',
                meshes: [
                    { templateName: 'Top_Porcelain_Quadra', required: true }
                ]
            },
            rules: [],
            defaultConfig: {
            }
        });

        registry.registerProduct('Top_Porcelain_Strip', {
            displayName: 'Porcelain Strip',
            category: 'sinks',
            tags: ['sink', 'porcelain', 'strip'],
            isSubProduct: true,
            parentAttachPoint: 'Sink_Point',
            inheritFromParent: ['Width', 'Depth'],
            meshConfig: {
                type: 'single',
                meshes: [
                    { templateName: 'Top_Porcelain_Strip', required: true }
                ]
            },
            rules: [],
            defaultConfig: {
            }
        });

        registry.registerProduct('Top_Tekorlux_Syntesi', {
            displayName: 'Top_Tekorlux_Syntesi',
            category: 'sinks',
            tags: ['sink', 'syntesi'],
            isSubProduct: true,
            parentAttachPoint: 'Sink_Point',
            inheritFromParent: ['Width', 'Depth'],
            meshConfig: {
                type: 'single',
                meshes: [
                    { templateName: 'Top_Syntesi', required: true }
                ]
            },
            rules: [],
            defaultConfig: {
            }
        });

        registry.registerProduct('Top_Tekorlux_Quadra', {
            displayName: 'Tekorlux Quadra',
            category: 'sinks',
            tags: ['sink', 'tekorlux', 'quadra'],
            isSubProduct: true,
            parentAttachPoint: 'Sink_Point',
            inheritFromParent: ['Width', 'Depth'],
            meshConfig: {
                type: 'single',
                meshes: [
                    { templateName: 'Top_Tekorlux_Quadra', required: true }
                ]
            },
            rules: [],
            defaultConfig: {
            }
        });

        registry.registerProduct('Top_Tekorlux_Rectangular', {
            displayName: 'Tekorlux Rectangular',
            category: 'sinks',
            tags: ['sink', 'tekorlux', 'rectangular'],
            isSubProduct: true,
            parentAttachPoint: 'Sink_Point',
            inheritFromParent: ['Width', 'Depth'],
            meshConfig: {
                type: 'single',
                meshes: [
                    { templateName: 'Top_Tekorlux_Rectangular', required: true }
                ]
            },
            rules: [],
            defaultConfig: {
            }
        });

        registry.registerProduct('Top_Tekorlux_Ron', {
            displayName: 'Tekorlux Ron',
            category: 'sinks',
            tags: ['sink', 'tekorlux', 'ron'],
            isSubProduct: true,
            parentAttachPoint: 'Sink_Point',
            inheritFromParent: ['Width', 'Depth'],
            meshConfig: {
                type: 'single',
                meshes: [
                    { templateName: 'Top_Tekorlux_Ron', required: true }
                ]
            },
            rules: [],
            defaultConfig: {
            }
        });

        registry.registerProduct('Top_Tekorlux_Trip', {
            displayName: 'Tekorlux Trip',
            category: 'sinks',
            tags: ['sink', 'tekorlux', 'trip'],
            isSubProduct: true,
            parentAttachPoint: 'Sink_Point',
            inheritFromParent: ['Width', 'Depth'],
            meshConfig: {
                type: 'single',
                meshes: [
                    { templateName: 'Top_Tekorlux_Trip', required: true }
                ]
            },
            rules: [],
            defaultConfig: {
            }
        });

        registry.registerProduct('Top_Tekormud_Tivi', {
            displayName: 'Tekormud Tivi',
            category: 'sinks',
            tags: ['sink', 'tekorlux', 'tivi'],
            isSubProduct: true,
            parentAttachPoint: 'Sink_Point',
            inheritFromParent: ['Width', 'Depth'],
            meshConfig: {
                type: 'single',
                meshes: [
                    { templateName: 'Top_Tekormud_Tivi', required: true }
                ]
            },
            rules: [],
            defaultConfig: {
            }
        });
        registry.registerProduct('Vessel_Blade11', {
            displayName: 'Vessel Blade 11',
            category: 'sinks',
            tags: ['sink', 'vessel', 'blade', '11'],
            isSubProduct: true,
            parentAttachPoint: 'Sink_Point',
            inheritFromParent: ['Width', 'Depth'],
            meshConfig: {
                type: 'single',
                meshes: [
                    { templateName: 'Vessel_Blade11', required: true }
                ]
            },
            rules: [],
            defaultConfig: {
            }
        });
        registry.registerProduct('Vessel_Blade18', {
            displayName: 'Vessel Blade 18',
            category: 'sinks',
            tags: ['sink', 'vessel', 'blade', '18'],
            isSubProduct: true,
            parentAttachPoint: 'Sink_Point',
            inheritFromParent: ['Width', 'Depth'],
            meshConfig: {
                type: 'single',
                meshes: [
                    { templateName: 'Vessel_Blade18', required: true }
                ]
            },
            rules: [],
            defaultConfig: {
            }
        });
        registry.registerProduct('Vessel_Frame', {
            displayName: 'Vessel Frame',
            category: 'sinks',
            tags: ['sink', 'vessel', 'frame'],
            isSubProduct: true,
            parentAttachPoint: 'Sink_Point',
            inheritFromParent: ['Width', 'Depth'],
            meshConfig: {
                type: 'single',
                meshes: [
                    { templateName: 'Vessel_Frame', required: true }
                ]
            },
            rules: [],
            defaultConfig: {
            }
        });
        registry.registerProduct('Vessel_Iris', {
            displayName: 'Vessel Iris',
            category: 'sinks',
            tags: ['sink', 'vessel', 'iris'],
            isSubProduct: true,
            parentAttachPoint: 'Sink_Point',
            inheritFromParent: ['Width', 'Depth'],
            meshConfig: {
                type: 'single',
                meshes: [
                    { templateName: 'Vessel_Iris', required: true }
                ]
            },
            rules: [],
            defaultConfig: {
            }
        });
        registry.registerProduct('Vessel_UrbanModo', {
            displayName: 'Vessel Urban Modo',
            category: 'sinks',
            tags: ['sink', 'vessel', 'urban', 'modo'],
            isSubProduct: true,
            parentAttachPoint: 'Sink_Point',
            inheritFromParent: ['Width', 'Depth'],
            meshConfig: {
                type: 'single',
                meshes: [
                    { templateName: 'Vessel_UrbanModo', required: true }
                ]
            },
            rules: [],
            defaultConfig: {
            }
        });
        registry.registerProduct('Vessel_UrbanMorris', {
            displayName: 'Vessel Urban Morris',
            category: 'sinks',
            tags: ['sink', 'vessel', 'urban', 'morris'],
            isSubProduct: true,
            parentAttachPoint: 'Sink_Point',
            inheritFromParent: ['Width', 'Depth'],
            meshConfig: {
                type: 'single',
                meshes: [
                    { templateName: 'Vessel_UrbanMorris', required: true }
                ]
            },
            rules: [],
            defaultConfig: {
            }
        });
        registry.registerProduct('Vessel_Aquarius', {
            displayName: 'Vessel Aquarius',
            category: 'sinks',
            tags: ['sink', 'vessel', 'aquarius'],
            isSubProduct: true,
            parentAttachPoint: 'Sink_Point',
            inheritFromParent: ['Width', 'Depth'],
            meshConfig: {
                type: 'single',
                meshes: [
                    { templateName: 'Vessel_Aquarius', required: true }
                ]
            },
            rules: [],
            defaultConfig: {
            }
        });
    }


    /**
     * Завантажує конфігурації scene addons (SidePanels, etc.)
     * @private
     */
    static _loadSceneAddons(registry) {
        // SidePanel_Left - ліва панель (автоматично створюється при наявності cabinets)
        registry.registerProduct('SidePanel_Left', {
            displayName: 'Left Side Panel',
            category: 'addons',
            tags: ['addon', 'side-panel', 'left'],
            meshConfig: {
                type: 'variants',
                variants: [
                    { key: 'None', templateName: null, anchorName: null },
                    { key: 'UpperG', templateName: 'SidePanel_UpperG', anchorName: null },
                    { key: 'CenterG', templateName: 'SidePanel_CenterG', anchorName: null },
                    { key: 'DoubleG', templateName: 'SidePanels_DoubleG', anchorName: null },
                    { key: 'NoG', templateName: 'SidePanels_NoG', anchorName: null }
                ]
            },
            rules: [
                { rule: RuleChangeSidePanelVariant, priority: 10 },
                { rule: RuleChangeSidePanelDepth, priority: 20 },
                { rule: RuleChangeSidePanelHeight, priority: 30 },
                { rule: RuleChangeCabinetColorSidePanel, priority: 35 },

                { rule: RuleSidePanelOverlayVariant, priority: 41 },
                { rule: RuleSidePanelOverlayDepth, priority: 42 },
                { rule: RuleSidePanelOverlayHeight, priority: 43 }
            ],
            defaultConfig: {
                SidePanelType: 'None',
                side: 'left',
                GrainDirection: 'None'
            }
        });

        // SidePanel_Right - права панель
        registry.registerProduct('SidePanel_Right', {
            displayName: 'Right Side Panel',
            category: 'addons',
            tags: ['addon', 'side-panel', 'right'],
            meshConfig: {
                type: 'variants',
                variants: [
                    { key: 'None', templateName: null, anchorName: null },
                    { key: 'UpperG', templateName: 'SidePanel_UpperG', anchorName: null },
                    { key: 'CenterG', templateName: 'SidePanel_CenterG', anchorName: null },
                    { key: 'DoubleG', templateName: 'SidePanels_DoubleG', anchorName: null },
                    { key: 'NoG', templateName: 'SidePanels_NoG', anchorName: null }
                ]
            },
            rules: [
                { rule: RuleChangeSidePanelVariant, priority: 10 },
                { rule: RuleChangeSidePanelDepth, priority: 20 },
                { rule: RuleChangeSidePanelHeight, priority: 30 },
                { rule: RuleChangeCabinetColorSidePanel, priority: 35 },
                { rule: RuleSidePanelOverlayVariant, priority: 41 },
                { rule: RuleSidePanelOverlayDepth, priority: 42 },
                { rule: RuleSidePanelOverlayHeight, priority: 43 }
            ],
            defaultConfig: {
                SidePanelType: 'None',
                side: 'right',
                GrainDirection: 'None'
            }
        });

        // ULH side panels are distinct products. They share one artist template;
        // the ULH layout rule controls PTO/Upper Groove geometry inside it.
        registry.registerProduct(ULH_SIDE_PANEL_PRODUCTS.left, {
            displayName: 'Urban Low Height Left Side Panel',
            category: 'addons',
            tags: ['addon', 'side-panel', 'left', 'urban-low-height'],
            meshConfig: {
                type: 'single',
                meshes: [
                    { templateName: 'ULH_UniSidePanel', required: true }
                ]
            },
            rules: [
                { rule: RuleULHSidePanelLayout, priority: 25 },
                { rule: RuleULHSidePanelMaterials, priority: 35 }
            ],
            defaultConfig: {
                SidePanelType: 'NoG',
                SidePanelProfile: ULH_SIDE_PANEL_PROFILE,
                side: 'left',
                GrainDirection: 'None'
            }
        });

        registry.registerProduct(ULH_SIDE_PANEL_PRODUCTS.right, {
            displayName: 'Urban Low Height Right Side Panel',
            category: 'addons',
            tags: ['addon', 'side-panel', 'right', 'urban-low-height'],
            meshConfig: {
                type: 'single',
                meshes: [
                    { templateName: 'ULH_UniSidePanel', required: true }
                ]
            },
            rules: [
                { rule: RuleULHSidePanelLayout, priority: 25 },
                { rule: RuleULHSidePanelMaterials, priority: 35 }
            ],
            defaultConfig: {
                SidePanelType: 'NoG',
                SidePanelProfile: ULH_SIDE_PANEL_PROFILE,
                side: 'right',
                GrainDirection: 'None'
            }
        });

        // UF side panels are distinct products. They share one artist template;
        // the UF layout rule toggles the end/joint parts inside it by cabinet height.
        for (const side of ['left', 'right']) {
            registry.registerProduct(UF_SIDE_PANEL_PRODUCTS[side], {
                displayName: `Urban Freestanding ${side === 'left' ? 'Left' : 'Right'} Side Panel`,
                category: 'addons',
                tags: ['addon', 'side-panel', side, 'urban-freestanding'],
                meshConfig: {
                    type: 'single',
                    meshes: [
                        { templateName: UF_SIDE_PANEL_TEMPLATE, required: true }
                    ]
                },
                rules: [
                    { rule: RuleUFSidePanelLayout, priority: 25 },
                    { rule: RuleUFSidePanelMaterials, priority: 35 }
                ],
                defaultConfig: {
                    SidePanelType: 'NoG',
                    SidePanelProfile: UF_SIDE_PANEL_PROFILE,
                    SidePanelFace: 'end',
                    side,
                    GrainDirection: 'None'
                }
            });
        }

        // Tricot side panels are distinct products on the Tricot_SidePanel template;
        // the Tricot layout rule mirrors the panel by side.
        for (const side of ['left', 'right']) {
            registry.registerProduct(TRICOT_SIDE_PANEL_PRODUCTS[side], {
                displayName: `Tricot ${side === 'left' ? 'Left' : 'Right'} Side Panel`,
                category: 'addons',
                tags: ['addon', 'side-panel', side, 'tricot'],
                meshConfig: {
                    type: 'single',
                    meshes: [
                        { templateName: TRICOT_SIDE_PANEL_TEMPLATE, required: true }
                    ]
                },
                rules: [
                    { rule: RuleTricotSidePanelLayout, priority: 25 },
                    { rule: RuleTricotSidePanelMaterials, priority: 35 }
                ],
                defaultConfig: {
                    SidePanelType: 'NoG',
                    SidePanelProfile: TRICOT_SIDE_PANEL_PROFILE,
                    SidePanelFace: 'end',
                    side,
                    GrainDirection: 'None'
                }
            });
        }
    }

    /**
     * Завантажує конфігурації towel bars
     * @private
     */
    static _loadTowelBars(registry) {
        // TowelBar_Left - ліва панель (автоматично створюється при наявності cabinets)
        registry.registerProduct('TowelBar_Left', {
            displayName: 'Left Towel Bar',
            category: 'addons',
            tags: ['addon', 'towel-bar', 'left'],
            meshConfig: {
                type: 'variants',
                variants: [
                    { key: 'None', templateName: null, anchorName: null },
                    { key: 'TowelBar40_R', templateName: 'TowelBar40_R', anchorName: null }
                ]
            },
            rules: [
                { rule: RuleChangeTowelBarVariant, priority: 10 },
                { rule: RuleChangeTowelBarHeight, priority: 20 }
            ],
            defaultConfig: {
                TowelBarType: 'None',
                side: 'left'
            }
        });

        // TowelBar_Right - права панель
        registry.registerProduct('TowelBar_Right', {
            displayName: 'Right Towel Bar',
            category: 'addons',
            tags: ['addon', 'towel-bar', 'right'],
            meshConfig: {
                type: 'variants',
                variants: [
                    { key: 'None', templateName: null, anchorName: null },
                    { key: 'TowelBar40_R', templateName: 'TowelBar40_R', anchorName: null }
                ]
            },
            rules: [
                { rule: RuleChangeTowelBarVariant, priority: 10 },
                { rule: RuleChangeTowelBarHeight, priority: 20 }
            ],
            defaultConfig: {
                TowelBarType: 'None',
                side: 'right'
            }
        });
    }

    /**
     * Завантажує конфігурації полиць
     * @private
     */
    static _loadShelves(registry) {
        // UniOpenShelves
        registry.registerProduct('UniOpenShelves', {
            displayName: 'Universal Open Shelves',
            category: 'shelves',
            tags: ['shelves', 'open', 'universal'],
            meshConfig: {
                type: 'single',
                meshes: [
                    { templateName: 'UniOpenShelves', required: true }
                ]
            },
            rules: [
                { rule: RuleScaleWidthOpenShelves, priority: 10 },
                { rule: RuleScaleHeightOpenShelves, priority: 10 },
                { rule: RuleScaleDepthOpenShelves, priority: 10 }
            ],
            defaultConfig: {
                Width: 60,
                Height: 72,
                Depth: 35,
                Color: '#FFFFFF'
            }
        });

        registry.registerProduct('CabinetUniBox', {
            displayName: 'Universal Open Shelves',
            category: 'shelves',
            tags: ['shelves', 'open', 'universal'],
            meshConfig: {
                type: 'single',
                meshes: [
                    { templateName: 'CabinetUniBox', required: true }
                ]
            },
            rules: [
                { rule: RuleVisibleSinkCabinet, priority: 10 },
                { rule: RuleScaleWidthCabinetUniBox, priority: 10 },
                { rule: RuleScaleHeightCabinetUniBox, priority: 20 },
                { rule: RuleScaleDepthCabinetUniBox, priority: 30 },
                { rule: RuleGrainDirection, priority: 55 },
                { rule: RuleDrawerPanelFluting, priority: 56 },
                { rule: RuleDrawerOverlayLayout, priority: 57 },
                { rule: RuleHandleOverlayVisibility, priority: 58 },
            ],
            defaultConfig: {
                Width: 60,
                Height: 56,
                Depth: 60,
                GrainDirection: 'None',
                DrawerPanelFluting: 'None',
                aabbIgnoreNodes: CABINET_AABB_IGNORE_NODES,
            }
        });

        // UniOpenSideShelves
        registry.registerProduct('UniOpenSideShelves', {
            displayName: 'Universal Side Shelves',
            category: 'shelves',
            tags: ['shelves', 'side', 'universal'],
            meshConfig: {
                type: 'single',
                meshes: [
                    { templateName: 'UniOpenSideShelves', required: true }
                ]
            },
            rules: [
                { rule: RuleScaleHeightUniSideShelves, priority: 10 },
                { rule: RuleScaleDepthUniSideShelves, priority: 10 }
            ],
            defaultConfig: {
                Width: 30,
                Height: 72,
                Depth: 35,
                Color: '#FFFFFF'
            }
        });
    }

    /**
     * Завантажує глобальні правила
     * @private
     */
    static _loadGlobalRules(registry) {

        registry.registerGlobalRule(RuleChangeCabinetColor, 5);
        registry.registerGlobalRule(RuleChangeHandleGrooveColor, 10);
        // registry.registerGlobalRule(, 20);
        registry.registerGlobalRule(RuleChangeTowelBarColor, 35);
        registry.registerGlobalRule(RuleChangeCountertopColor, 200);
    }


}
