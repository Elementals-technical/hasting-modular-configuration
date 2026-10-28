import { BaseProductRule } from '../base-product-rule.mjs';
import { LoggerService } from '../../../../services/logger/logger-service.mjs';
import { MeshRuleConfigBuilder } from '../../../../helpers/mesh-rule-config-builder.mjs';
import { SceneEntityHelper } from '../../../../helpers/scene-entity-helper.mjs';
import { SceneTransformHelper } from '../../../../helpers/scene-transform-helper.mjs';

/**
 * Правило масштабування продукту по ширині.
 * 
 * Реагує на зміни атрибута 'Width' в store.
 * Застосовує відповідний крок масштабування до всіх дочірніх entities з певними тегами.
 */
export class RuleSlinkPosition extends BaseProductRule {
    constructor(context) {
        super({
            name: 'SlinkPosition',
            watchAttributes: ['Height', 'Thickness'],  // реагуємо на height
            priority: 60
        });

        this.context = context;

        // Твої дані з таблиці
        this.dataHeightSizeProduct = {
            move: MeshRuleConfigBuilder.create()
                .breakpoints([56, 53, 50])
                .meshes([
                    'Sink_Point',
                ])
                .values({
                    56: { y: 0 },
                    53: { y: -0.03 },
                    50: { y: -0.06 },
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
        let thickness = currentState.get('Thickness');
        if (thickness === undefined || thickness === null || thickness === '') {
            thickness = 0.5;
            LoggerService.log(
                this,
                '⚠️ [RuleApplyCabinetMaterial] CabinetColor is empty, skip'
            );
            // return;
        }

        LoggerService.log(
            this,
            `📏 [RuleScaleHeight] Executing for height: ${height}`,
            { previousHeight: previousState?.get('Height') }
        );

        if (Number.isNaN(height)) {
            LoggerService.log(this, '⚠️ [RuleScaleHeight] height is NaN, skip');
            return;
        }

 
        this._applyMoveY(height, thickness, this.dataHeightSizeProduct.move);
    }

    // ================== helpers ==================

    _getValueForHeight(map, height) {
        if (!map) return undefined;

        // напряму числом
        if (Object.prototype.hasOwnProperty.call(map, height)) {
            return map[height];
        }
        // або ключі-строки
        const key = Object.keys(map).find(k => parseInt(k) === height);
        return key ? map[key] : undefined;
    }


    // ================== MoveY ==================

    _applyMoveY(height, thickness, entitiesByName) {

        const stratchCountertop = this.context.productConfig?.thicknessOffsets?.sink;
        if (!stratchCountertop) {
            LoggerService.log(this, '⚠️ [SlinkPosition] No thicknessOffsets.sink in productConfig, skip');
            return;
        }

        const thicknessOffset = stratchCountertop[thickness];
        if (!thicknessOffset) {
            LoggerService.log(this, `⚠️ [SlinkPosition] No offset for thickness=${thickness}, skip`);
            return;
        }

        const cfg = entitiesByName.values;
        let appliedCount = 0;

        const entities = SceneEntityHelper.collectByNames(
            this.context.entity,
            Object.keys(cfg)
        );

        entities.map(entity => {
            const configForMesh = cfg[entity.name];

            const value = configForMesh[height];
            if (!value) {
                LoggerService.log(
                    this,
                    '[RuleScaleHeight] No value for height',
                    { entityName: entity.name, height: height }
                );
                return;
            }

            SceneTransformHelper.setLocalPosition(entity, { y: value.y + thicknessOffset.y });

            appliedCount++;


        });


        LoggerService.log(
            this,
            `✅ [RuleScaleHeight] MoveY applied`,
            { height, appliedCount }
        );
    }


}
