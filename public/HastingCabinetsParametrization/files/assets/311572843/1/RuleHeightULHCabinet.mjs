import { BaseProductRule } from '../base-product-rule.mjs';
import { LoggerService } from '../../../../services/logger/logger-service.mjs';
import { MeshRuleConfigBuilder } from '../../../../helpers/mesh-rule-config-builder.mjs';
import { SceneTransformHelper } from '../../../../helpers/scene-transform-helper.mjs';

/**
 * Правило масштабування продукту по ширині.
 * 
 * Реагує на зміни атрибута 'Width' в store.
 * Застосовує відповідний крок масштабування до всіх дочірніх entities з певними тегами.
 */
export class RuleHeightULHCabinet extends BaseProductRule {
    constructor(context) {
        super({
            name: 'Height-ULH-Cabinet',
            watchAttributes: ['Height'],  // реагуємо на height
            priority: 20
        });

        this.context = context;
        this.dataRule = {
            stretchY: MeshRuleConfigBuilder.create()
                .meshes(["ULH_Drawer_HNoCut", "ULH_Drawer_HTopCut", "ULH_Overlay_HNoCut", "ULH_Overlay_HTopCut", "ULH_Cabinet_SCBackWall"])
                .breakpoints([25, 28, 35, 38])
                .values({
                    25: { y: 0 },
                    28: { y: 0.06 },
                    35: { y: 0.2 },
                    38: { y: 0.26 }
                })
                .meshes(["ULH_Drawer_BWall"])
                .values({
                    25: { y: 0 },
                    28: { y: 0 },
                    35: { y: 0.095 },
                    38: { y: 0.095 }
                })
                .meshes(["ULH_Drawer_TopFraming"])
                .values({
                    25: { y: 0 },
                    28: { y: 0 },
                    35: { y: 0.2 },
                    38: { y: 0.2 }
                })
                .meshes(["ULH_Cabinet_Walls"])
                .values({
                    25: { y: 0 },
                    28: { y: 0.03 },
                    35: { y: 0.1 },
                    38: { y: 0.13 }
                })
                .meshes(["ULH_Drawer_SWall"])
                .values({
                    25: { y: 0 },
                    28: { y: 0 },
                    35: { y: 0.157 },
                    38: { y: 0.157 }
                })
                .build(),

            moveY: MeshRuleConfigBuilder.create()
                .breakpoints([25, 28, 35, 38])
                .meshes(["ULH_Cabinet_WallsPoint"])
                .values({
                    25: { y: 0 },
                    28: { y: 0.015 },
                    35: { y: 0.05 },
                    38: { y: 0.065 },
                })
                .meshes(["ULH_Cabinet_Mount"])
                .values({
                    25: { y: 0 },
                    28: { y: 0.03 },
                    35: { y: 0.1 },
                    38: { y: 0.13 },
                })
                .meshes(["ULH_Countertop_Point"])
                .values({
                    25: { y: 0.25 },
                    28: { y: 0.28 },
                    35: { y: 0.35 },
                    38: { y: 0.38 },
                })
                .meshes(["ULH_Cabinet_HGroove", "ULH_Cabinet_HBracket"])
                .values({
                    25: { y: 0 },
                    28: { y: 0.03 },
                    35: { y: 0.1 },
                    38: { y: 0.13 },
                }).meshes(["ULH_Drawer_Bolts"])
                .values({
                    25: { y: 0 },
                    28: { y: 0 },
                    35: { y: 0.03 },
                    38: { y: 0.03 },
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
        const height = parseInt(currentState.get('Height'));

        LoggerService.log(
            this,
            `📏 [RuleScaleHeight] Executing for height: ${height}`,
            { previousHeight: previousState?.get('Height') }
        );

        if (Number.isNaN(height)) {
            LoggerService.log(this, '⚠️ [RuleScaleHeight] height is NaN, skip');
            return;
        }


        this._applyTransformConfig(height, this.dataRule.stretchY, (entity, value) => SceneTransformHelper.setStretch(entity, value));
        this._applyTransformConfig(height, this.dataRule.moveY, (entity, value) => SceneTransformHelper.setLocalPosition(entity, value));
    }

}
