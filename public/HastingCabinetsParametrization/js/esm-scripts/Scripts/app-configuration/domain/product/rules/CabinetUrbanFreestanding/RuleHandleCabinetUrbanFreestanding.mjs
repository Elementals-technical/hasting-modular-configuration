import { BaseProductRule } from '../base-product-rule.mjs';
import { LoggerService } from '../../../../services/logger/logger-service.mjs';
import { MeshRuleConfigBuilder } from '../../../../helpers/mesh-rule-config-builder.mjs';
import { SceneTransformHelper } from '../../../../helpers/scene-transform-helper.mjs';
import { SceneEntityHelper } from '../../../../helpers/scene-entity-helper.mjs';
import { FLUTING_TEXTURES } from '../Overlay/overlay-texture-config.mjs';
import { ufHeightOf, isCentralGrooveTall, UF_HEIGHTS } from '../../logic/uf-cabinet-height-policy.mjs';

// Variant key of Central Groove on the 91 cabinet (NEW sheet column D66); every other variant is the guide height.
const CENTRAL_GROOVE_TALL = "CG91";
// All five overlays; they show only with a fluting value (DrawerPanelFluting), on top of the handle tables below.
const UF_OVERLAY_NAMES = [
    "UF_Overlay_BotCut_Top",
    "UF_Overlay_NoCut_Top",
    "UF_Overlay_TopCut_Top",
    "UF_Overlay_NoCut_Bot",
    "UF_Overlay_TopCut_Bot"
];
/**
 * UF handle styles by guide height: 91 UG, 88 PTO, 56 UG, 53 PTO, and Central Groove on the 91 cabinet (NEW sheet B66:F66).
 * Each UF_Overlay_* follows its UF_Handle* (NEW sheet A68:F79) and is visible only while DrawerPanelFluting is a fluting value.
 */ class RuleHandleCabinetUrbanFreestanding extends BaseProductRule {
    execute({ currentState }) {
        const height = ufHeightOf(currentState);
        if (height === null) {
            LoggerService.warn(this, "Unsupported Urban Freestanding cabinet height", {
                height: currentState.get("Height"),
                handle: currentState.get("Handle")
            });
            return;
        }
        const variant = isCentralGrooveTall(height, currentState.get("Handle")) ? CENTRAL_GROOVE_TALL : height;
        this._applyTransformConfig(variant, this.dataRule.visibility, (entity, value)=>SceneTransformHelper.setVisibleByState(entity, value));
        if (this.dataRule.topHandleVisibility.breakpoints.includes(variant)) {
            this._applyTransformConfig(variant, this.dataRule.topHandleVisibility, (entity, value)=>SceneTransformHelper.setVisibleByState(entity, value));
        }
        this._applyTransformConfig(variant, this.dataRule.grooveStretchY, (entity, value)=>SceneTransformHelper.setStretch(entity, value));
        // None, empty or unknown fluting: the handle tables above do not decide, no overlay is shown.
        if (!Object.hasOwn(FLUTING_TEXTURES, currentState.get("DrawerPanelFluting"))) {
            for (const overlay of SceneEntityHelper.collectByNames(this.entity, UF_OVERLAY_NAMES)){
                SceneTransformHelper.setVisibleByState(overlay, "Disable");
            }
        }
    }
    constructor(){
        super({
            name: "RuleHandleCabinetUrbanFreestanding",
            watchAttributes: [
                "Height",
                "Handle",
                "DrawerPanelFluting"
            ],
            priority: 45
        });
        this.dataRule = {
            visibility: MeshRuleConfigBuilder.create().breakpoints([
                ...UF_HEIGHTS,
                CENTRAL_GROOVE_TALL
            ]).meshes([
                "UF_Cabinet_HGroove_Top"
            ]).values({
                53: "Disable",
                56: "Disable",
                88: "Disable",
                91: "Enable",
                [CENTRAL_GROOVE_TALL]: "Disable"
            }).meshes([
                "UF_Cabinet_HGroove_Bot",
                "UF_HandleTopCut_Bot",
                "UF_Overlay_TopCut_Bot"
            ]).values({
                53: "Disable",
                56: "Enable",
                88: "Disable",
                91: "Enable",
                [CENTRAL_GROOVE_TALL]: "Enable"
            }).meshes([
                "UF_HandleNoCut_Bot",
                "UF_Overlay_NoCut_Bot"
            ]).values({
                53: "Enable",
                56: "Disable",
                88: "Enable",
                91: "Disable",
                [CENTRAL_GROOVE_TALL]: "Disable"
            }).build(),
            // At 53 / 56 cm the top drawer is disabled; preserve its authored handle states.
            topHandleVisibility: MeshRuleConfigBuilder.create().breakpoints([
                88,
                91,
                CENTRAL_GROOVE_TALL
            ]).meshes([
                "UF_HandleTopCut_Top",
                "UF_Overlay_TopCut_Top"
            ]).values({
                88: "Disable",
                91: "Enable",
                [CENTRAL_GROOVE_TALL]: "Disable"
            }).meshes([
                "UF_HandleNoCut_Top",
                "UF_Overlay_NoCut_Top"
            ]).values({
                88: "Enable",
                91: "Disable",
                [CENTRAL_GROOVE_TALL]: "Disable"
            }).meshes([
                "UF_HandleBotCut_Top",
                "UF_Overlay_BotCut_Top"
            ]).values({
                88: "Disable",
                91: "Disable",
                [CENTRAL_GROOVE_TALL]: "Enable"
            }).build(),
            // NEW sheet D81: only CG on the 91 cabinet makes UF_Cabinet_HGroove_Bot taller (StretchY 0.07, it grows upward); X stays from RuleWidth.
            // The zeros reset the groove when the style switches back from CG.
            grooveStretchY: MeshRuleConfigBuilder.create().breakpoints([
                ...UF_HEIGHTS,
                CENTRAL_GROOVE_TALL
            ]).meshes([
                "UF_Cabinet_HGroove_Bot"
            ]).values({
                53: {
                    y: 0
                },
                56: {
                    y: 0
                },
                88: {
                    y: 0
                },
                91: {
                    y: 0
                },
                [CENTRAL_GROOVE_TALL]: {
                    y: 0.07
                }
            }).build()
        };
    }
}

export { RuleHandleCabinetUrbanFreestanding };
