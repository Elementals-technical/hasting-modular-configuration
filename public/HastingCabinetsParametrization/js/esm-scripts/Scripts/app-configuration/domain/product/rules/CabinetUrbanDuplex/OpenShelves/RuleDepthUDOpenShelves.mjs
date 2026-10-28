import { BaseProductRule } from '../../base-product-rule.mjs';
import { LoggerService } from '../../../../../services/logger/logger-service.mjs';
import { MeshRuleConfigBuilder } from '../../../../../helpers/mesh-rule-config-builder.mjs';
import { SceneTransformHelper } from '../../../../../helpers/scene-transform-helper.mjs';

/** UD open shelves: Depth transforms from the supplied size table. */ class RuleDepthUDOpenShelves extends BaseProductRule {
    onInitialize() {
        LoggerService.log(this, `📏 [RuleDepthUDOpenShelves] Initialized for product "${this.productId}"`);
    }
    /**
     * Основне виконання правила.
     */ execute({ currentState, previousState }) {
        const depth = Number(currentState.get("Depth"));
        if (!this.dataRule.stretchZ.breakpoints.includes(depth)) {
            LoggerService.warn(this, "Unsupported UD open shelves depth", {
                depth
            });
            return;
        }
        LoggerService.log(this, `📏 [RuleDepthUDOpenShelves] Executing for depth: ${depth}`, {
            previousDepth: previousState?.get("Depth")
        });
        this._applyTransformConfig(depth, this.dataRule.stretchZ, (entity, value)=>SceneTransformHelper.setStretch(entity, value));
        this._applyTransformConfig(depth, this.dataRule.moveZ, (entity, value)=>SceneTransformHelper.setLocalPosition(entity, value));
    }
    constructor(){
        super({
            name: "RuleDepthUDOpenShelves",
            watchAttributes: [
                "Depth"
            ],
            priority: 35
        });
        this.dataRule = {
            stretchZ: MeshRuleConfigBuilder.create().breakpoints([
                46,
                50
            ]).meshes([
                'OpenShelvesDivider',
                'OpenShelvesSideWalls',
                'OpenShelvesTopBot'
            ]).values({
                46: {
                    z: 0
                },
                50: {
                    z: 0.045
                }
            }).build(),
            moveZ: MeshRuleConfigBuilder.create().breakpoints([
                46,
                50
            ]).meshes([
                'OpenShelvesMoveDivider_Point',
                'OpenShelvesSideWalls_Point',
                'OpenShelvesTopBot_Point'
            ]).values({
                46: {
                    z: 0
                },
                50: {
                    z: 0.0225
                }
            }).build()
        };
    }
}

export { RuleDepthUDOpenShelves };
