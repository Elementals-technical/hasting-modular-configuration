import { BaseProductRule } from '../base-product-rule.mjs';
import { LoggerService } from '../../../../services/logger/logger-service.mjs';
import { MeshRuleConfigBuilder } from '../../../../helpers/mesh-rule-config-builder.mjs';
import { SceneTransformHelper } from '../../../../helpers/scene-transform-helper.mjs';
import { ufHeightOf, UF_HEIGHTS } from '../../logic/uf-cabinet-height-policy.mjs';

/** Urban Freestanding height: stretch and local positions from the size tables, keyed by the guide height (NEW sheet A26:A29: 53 / 56 / 88 / 91). */ class RuleHeightCabinetUrbanFreestanding extends BaseProductRule {
    onInitialize() {
        LoggerService.log(this, `📏 [RuleHeightCabinetUrbanFreestanding] Initialized for product "${this.productId}"`);
    }
    /**
     * Основне виконання правила.
     */ execute({ currentState, previousState }) {
        const height = ufHeightOf(currentState);
        if (height === null) {
            LoggerService.warn(this, "Unsupported UrbanFreestanding cabinet height", {
                height: currentState.get("Height")
            });
            return;
        }
        LoggerService.log(this, `📏 [RuleHeightCabinetUrbanFreestanding] Executing for height: ${height}`, {
            previousHeight: previousState?.get("Height")
        });
        this._applyTransformConfig(height, this.dataRule.stretchY, (entity, value)=>{
            SceneTransformHelper.setStretch(entity, value);
        });
        this._applyTransformConfig(height, this.dataRule.moveY, (entity, value)=>{
            SceneTransformHelper.setLocalPosition(entity, value);
        });
    }
    constructor(){
        super({
            name: "RuleHeightCabinetUrbanFreestanding",
            watchAttributes: [
                "Height"
            ],
            priority: 30
        });
        this.dataRule = {
            stretchY: MeshRuleConfigBuilder.create().breakpoints(UF_HEIGHTS).meshes([
                "UF_Cabinet_Walls"
            ]).values({
                53: {
                    y: -0.38
                },
                56: {
                    y: -0.35
                },
                88: {
                    y: -0.03
                },
                91: {
                    y: 0
                }
            }).build(),
            // Sink_Point is positioned by RuleSinkMountPosition
            // (UF-sink-cabinet sinkMount.heightLocalY by guide height, plus the countertop thickness offset).
            moveY: MeshRuleConfigBuilder.create().breakpoints(UF_HEIGHTS).meshes([
                "UF_Cabinet_HBracket",
                "UF_Cabinet_Mount"
            ]).values({
                53: {
                    y: -0.38
                },
                56: {
                    y: -0.35
                },
                88: {
                    y: -0.03
                },
                91: {
                    y: 0
                }
            }).meshes([
                "UF_Cabinet_Walls_Point"
            ]).values({
                53: {
                    y: -0.19
                },
                56: {
                    y: -0.175
                },
                88: {
                    y: -0.015
                },
                91: {
                    y: 0
                }
            })// Absolute local Y = guide height in m (v69 base at 91: 0.91).
            .meshes([
                "UF_Countertop_Point"
            ]).values({
                53: {
                    y: 0.53
                },
                56: {
                    y: 0.56
                },
                88: {
                    y: 0.88
                },
                91: {
                    y: 0.91
                }
            }).build()
        };
    }
}

export { RuleHeightCabinetUrbanFreestanding };
