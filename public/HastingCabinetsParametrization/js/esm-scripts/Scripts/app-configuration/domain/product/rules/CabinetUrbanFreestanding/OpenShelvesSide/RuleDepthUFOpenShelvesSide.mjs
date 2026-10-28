import { BaseProductRule } from '../../base-product-rule.mjs';
import { LoggerService } from '../../../../../services/logger/logger-service.mjs';
import { MeshRuleConfigBuilder } from '../../../../../helpers/mesh-rule-config-builder.mjs';
import { SceneTransformHelper } from '../../../../../helpers/scene-transform-helper.mjs';
import { UF_DEPTHS } from '../../../registry/CabinetUrbanFreestanding/UFConfig.mjs';

/** UF open side shelves: Depth transforms from the supplied size table. */ class RuleDepthUFOpenShelvesSide extends BaseProductRule {
    onInitialize() {
        LoggerService.log(this, `📏 [RuleDepthUFOpenShelvesSide] Initialized for product "${this.productId}"`);
    }
    /**
     * Основне виконання правила.
     */ execute({ currentState, previousState }) {
        const depth = Number(currentState.get("Depth"));
        if (!this.dataRule.stretchZ.breakpoints.includes(depth)) {
            LoggerService.warn(this, "Unsupported UF open side shelves depth", {
                depth
            });
            return;
        }
        LoggerService.log(this, `📏 [RuleDepthUFOpenShelvesSide] Executing for depth: ${depth}`, {
            previousDepth: previousState?.get("Depth")
        });
        this._applyTransformConfig(depth, this.dataRule.stretchZ, (entity, value)=>{
            SceneTransformHelper.setStretch(entity, value);
        });
        this._applyTransformConfig(depth, this.dataRule.moveZ, (entity, value)=>{
            SceneTransformHelper.setLocalPosition(entity, value);
        });
    }
    constructor(){
        super({
            name: "RuleDepthUFOpenShelvesSide",
            watchAttributes: [
                "Depth"
            ],
            priority: 35
        });
        this.dataRule = {
            stretchZ: MeshRuleConfigBuilder.create().breakpoints(UF_DEPTHS).meshes([
                "UF_OSS_Body",
                "UF_OSS_BackShelf_Top",
                "UF_OSS_BackShelf_Bot"
            ]).values({
                46: {
                    z: -0.04
                },
                50: {
                    z: 0
                }
            }).build(),
            moveZ: MeshRuleConfigBuilder.create().breakpoints(UF_DEPTHS).meshes([
                "UF_OSS_Body_Point",
                "UF_OSS_BackShelf_Bot_Point",
                "UF_OSS_BackShelf_Top_Point"
            ]).values({
                46: {
                    z: -0.02
                },
                50: {
                    z: 0
                }
            }).meshes([
                "UF_OSS_MidWall_Point",
                "UF_OSS_FrontShelf_Bot",
                "UF_OSS_FrontShelf_Top"
            ]).values({
                46: {
                    z: -0.04
                },
                50: {
                    z: 0
                }
            }).build()
        };
    }
}

export { RuleDepthUFOpenShelvesSide };
