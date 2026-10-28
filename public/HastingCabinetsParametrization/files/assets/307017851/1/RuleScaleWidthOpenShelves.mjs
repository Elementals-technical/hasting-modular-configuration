import { BaseProductRule } from './../base-product-rule.mjs';
import { LoggerService } from '../../../../services/logger/logger-service.mjs';
import { MeshRuleConfigBuilder } from '../../../../helpers/mesh-rule-config-builder.mjs';
import { SceneTransformHelper } from '../../../../helpers/scene-transform-helper.mjs';
import { SceneEntityHelper } from '../../../../helpers/scene-entity-helper.mjs';

/**
 * Правило масштабування продукту по ширині.
 * 
 * Реагує на зміни атрибута 'Width' в store.
 * Застосовує відповідний крок масштабування до всіх дочірніх entities з певними тегами.
 */
export class RuleScaleWidthOpenShelves extends BaseProductRule {
    constructor(context) {
        super({
            name: 'ScaleWidth-OpenShelves',
            watchAttributes: ['Width'],  // Спрацьовує тільки при зміні width
            priority: 10  // Низький пріоритет = виконується раніше
        });

        this._targetTags = [
            'OpenShelvesBack',
            'OpenShelvesDivider',
            'OpenShelvesSideWalls',
            'OpenShelvesTopBot',
        ];

        this._meshRuleConfig = MeshRuleConfigBuilder.create()
            .breakpoints([25, 35, 50, 60, 70])
            .meshes(this._targetTags)
            .values({
                25: { x: -0.35 },
                35: { x: -0.25 },
                50: { x: -0.1 },
                60: { x: 0.0 }, // Default
                70: { x: 0.1 },
            })
            .build(),

            this.context = context;
    }

    /**
     * Ініціалізація правила.
     * Викликається автоматично при реєстрації через RuleExecutor.
     */
    onInitialize() {
        LoggerService.log(
            this,
            `📏 [RuleScaleWidth] Initialized for product "${this.productId}"`,
            { targetTags: this._targetTags.length }
        );
    }

    /**
     * Виконання правила при зміні width у store.
     * 
     * @param {Object} params
     * @param {Object} params.changes - Зміни (містить width)
     * @param {Object} params.currentState - Поточний стан з новим width
     * @param {Object} params.previousState - Попередній стан
     */
    execute({ changes, currentState, previousState }) {
        const newWidth = currentState.get('Width');

        LoggerService.log(
            this,
            `📏 [RuleScaleWidth] Executing for width: ${newWidth}`,
            { previousWidth: previousState?.get('Width') }
        );
   
        // Застосовуємо масштабування
        this._applyScaleToEntities(newWidth);
    }

    /**
     * Застосовує масштабування до всіх target entities.
     * @private
     */
    _applyScaleToEntities(width) {
        // захист від строк / чисел
        const widthKey = String(width);
        if (!widthKey) return;

        LoggerService.log(
            this,
            `📐 [RuleScaleWidth] Applying width "${widthKey}"`
        );

        const entities = SceneEntityHelper.collectByNames(
            this.context.entity,
            this._targetTags
        );

        let appliedCount = 0;

        entities.forEach(entity => {
            const configForMesh = this._meshRuleConfig.values[entity.name];
            if (!configForMesh) {
                LoggerService.log(
                    this,
                    '[RuleScaleWidth] No config for mesh name',
                    { entityName: entity.name }
                );
                return;
            }

            const value = configForMesh[widthKey];
            if (!value) {
                LoggerService.log(
                    this,
                    '[RuleScaleWidth] No value for width',
                    { entityName: entity.name, width: widthKey }
                );
                return;
            }

            SceneTransformHelper.setStretch(entity, value);
            appliedCount++;
        });

        LoggerService.log(
            this,
            `✅ [RuleScaleWidth] Applied to ${appliedCount} entities`
        );
    }
}