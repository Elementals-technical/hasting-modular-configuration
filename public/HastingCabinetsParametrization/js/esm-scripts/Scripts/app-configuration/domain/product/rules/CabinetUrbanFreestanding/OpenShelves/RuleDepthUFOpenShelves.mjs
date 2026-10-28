import { BaseProductRule } from '../../base-product-rule.mjs';
import { LoggerService } from '../../../../../services/logger/logger-service.mjs';
import { MeshRuleConfigBuilder } from '../../../../../helpers/mesh-rule-config-builder.mjs';
import { SceneTransformHelper } from '../../../../../helpers/scene-transform-helper.mjs';
import { UF_DEPTHS } from '../../../registry/CabinetUrbanFreestanding/UFConfig.mjs';

/** UF open shelves: Depth transforms from the supplied size table (UF_OS_Back has no depth cell: it is 1 cm thick). */ class RuleDepthUFOpenShelves extends BaseProductRule {
    onInitialize() {
        LoggerService.log(this, `📏 [RuleDepthUFOpenShelves] Initialized for product "${this.productId}"`);
    }
    /**
     * Основне виконання правила.
     */ execute({ currentState, previousState }) {
        const depth = Number(currentState.get("Depth"));
        if (!this.dataRule.stretchZ.breakpoints.includes(depth)) {
            LoggerService.warn(this, "Unsupported UF open shelves depth", {
                depth
            });
            return;
        }
        LoggerService.log(this, `📏 [RuleDepthUFOpenShelves] Executing for depth: ${depth}`, {
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
            name: "RuleDepthUFOpenShelves",
            watchAttributes: [
                "Depth"
            ],
            priority: 35
        });
        this.dataRule = {
            stretchZ: MeshRuleConfigBuilder.create().breakpoints(UF_DEPTHS).meshes([
                "UF_OS_DividerBot",
                "UF_OS_DividerTop",
                "UF_OS_Body"
            ]).values({
                46: {
                    z: -0.04
                },
                50: {
                    z: 0
                }
            }).build(),
            moveZ: MeshRuleConfigBuilder.create().breakpoints(UF_DEPTHS).meshes([
                "UF_OS_Body_Point",
                "UF_OS_DividerBot_Point",
                "UF_OS_DividerTop_Point"
            ]).values({
                46: {
                    z: -0.02
                },
                50: {
                    z: 0
                }
            }).build()
        };
    }
}

export { RuleDepthUFOpenShelves };
