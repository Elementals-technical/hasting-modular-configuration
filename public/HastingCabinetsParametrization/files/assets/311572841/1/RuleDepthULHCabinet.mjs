import { BaseProductRule } from './../base-product-rule.mjs'; 
import { LoggerService } from '../../../../services/logger/logger-service.mjs';
import { MeshRuleConfigBuilder } from '../../../../helpers/mesh-rule-config-builder.mjs';
import { SceneTransformHelper } from '../../../../helpers/scene-transform-helper.mjs';

/**
 * Правило масштабування продукту по ширині.
 * 
 * Реагує на зміни атрибута 'Width' в store.
 * Застосовує відповідний крок масштабування до всіх дочірніх entities з певними тегами.
 */
export class RuleDepthULHCabinet extends BaseProductRule {
    constructor(context) {
        super({
            name: 'Depth-ULH-Cabinet',
            watchAttributes: ['Depth'],  // реагуємо на depth
            priority: 30
        });

        this.context = context;

        // Твої дані з таблиці
        this.dataRule = {
            stretchZ: MeshRuleConfigBuilder.create()
                .breakpoints([46, 50])
                .meshes(["ULH_Drawer_Floor", "ULH_Drawer_Hinge"])
                .values({
                    46: { z: 0 },
                    50: { z: 0.09 },
                })
                .meshes(["ULH_Cabinet_Walls"])
                .values({
                    46: { z: 0 },
                    50: { z: 0.045 },
                })
                .meshes(["ULH_Drawer_SWall"])
                .values({
                    46: { z: 0 },
                    50: { z: 0.09 },
                })
                .build(),

            moveZ: MeshRuleConfigBuilder.create()
                .breakpoints([46, 50])
                .meshes(["ULH_Cabinet_WallsPoint"])
                .values({
                    46: { z: 0 },
                    50: { z: 0.0225 },
                })
                .meshes(["ULH_Drawer_HNoCut", "ULH_Drawer_HTopCut", "ULH_Overlay_HNoCut", "ULH_Overlay_HTopCut"])
                .values({
                    46: { z: 0 },
                    50: { z: 0.045 },
                }).meshes(["ULH_Cabinet_HGroove", "ULH_Cabinet_HBracket"])
                .values({
                    46: { z: 0 },
                    50: { z: 0.045 },
                })
                .build(),

        };
    }

    onInitialize() {
        LoggerService.log(
            this,
            `📏 [RuleScaleHeight] Initialized for product "${this.productId}"`
        );
    }

    /**
     * Основне виконання правила.
     */
    execute({ currentState, previousState }) {
        const depth = currentState.get('Depth');

        LoggerService.log(
            this,
            `📏 [RuleScaleDepth] Executing for depth: ${depth}`,
            { previousDepth: previousState?.get('Depth') }
        );

        if (Number.isNaN(depth)) {
            LoggerService.log(this, '⚠️ [RuleScaleDepth] depth is NaN, skip');
            return;
        }


        this._applyTransformConfig(depth, this.dataRule.stretchZ, (entity, value) => SceneTransformHelper.setStretch(entity, value));
        this._applyTransformConfig(depth, this.dataRule.moveZ, (entity, value) => SceneTransformHelper.setLocalPosition(entity, value));
    }



}
