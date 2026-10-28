import { BaseProductRule } from "../base-product-rule.mjs";
import { LoggerService } from "../../../../services/logger/logger-service.mjs";
import { MeshRuleConfigBuilder } from "../../../../helpers/mesh-rule-config-builder.mjs";
import { SceneTransformHelper } from "../../../../helpers/scene-transform-helper.mjs";
import { SceneEntityHelper } from "../../../../helpers/scene-entity-helper.mjs";

/**
 * Правило масштабування продукту по ширині.
 *
 * Реагує на зміни атрибута 'Width' в store.
 * Застосовує відповідний крок масштабування до всіх дочірніх entities з певними тегами.
 */
export class RuleWidthCabinetClass extends BaseProductRule {
    constructor(context) {
        super({
            name: "Width-Cabinet-Class",
            watchAttributes: ["Width"], // Спрацьовує тільки при зміні width
            priority: 20, // Низький пріоритет = виконується раніше
        });

        this.context = context;

        this.ruleData = {
            stretchX: MeshRuleConfigBuilder.meshes([
                "CLMa_Cabinet_Floor",
                "Mako_Cabinet_HBracket",
                "Class_Bot_Drawer_Floor",
                "Class_Bot_Drawer_Hinge",
                "Class_Bot_Drawer_HFrame",
                "Class_Bot_Drawer_HInsert",
                "Class_Top_Drawer_Floor",
                "Class_Top_Drawer_HFrame",
                "Class_Top_Drawer_HInner",
                "Class_Top_Drawer_HInsert",
                "Class_Top_Drawer_Hinge",
                "CLMa_Cabinet_Walls",
            ])
                .breakpoints([40, 60, 80, 100, 120])
                .values({
                    40: { x: -0.2 },
                    60: { x: 0 }, // Default
                    80: { x: 0.2 },
                    100: { x: 0.4 },
                    120: { x: 0.6 },
                })
                .build(),
        };
    }

    /**
     * Ініціалізація правила.
     * Викликається автоматично при реєстрації через RuleExecutor.
     */
    onInitialize() {
        LoggerService.log(this, `📏 [RuleWidthCabinetClass] Initialized for product "${this.productId}"`);
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
        const newWidth = currentState.get("Width");

        LoggerService.log(this, `📏 [RuleWidthCabinetClass] Executing for width: ${newWidth}`, {
            previousWidth: previousState?.get("Width"),
        });

        // Застосовуємо масштабування
        this._applyScaleToEntities(newWidth, this.ruleData.stretchX);
    }

    /**
     * Застосовує масштабування до всіх target entities.
     * @private
     */
    _applyScaleToEntities(width, stretchX) {
        // захист від строк / чисел
        const widthKey = String(width);
        const cnf = stretchX.values;
        if (!widthKey) return;

        LoggerService.log(this, `📐 [RuleWidthCabinetClass] Applying width "${widthKey}"`);

        const entities = SceneEntityHelper.collectByNames(this.context.entity, Object.keys(cnf));

        let appliedCount = 0;

        entities.forEach((entity) => {
            const configForMesh = cnf[entity.name];
            if (!configForMesh) {
                LoggerService.log(this, "[RuleWidthCabinetClass] No config for mesh name", { entityName: entity.name });
                return;
            }

            const value = configForMesh[widthKey];
            if (!value) {
                LoggerService.log(this, "[RuleWidthCabinetClass] No value for width", {
                    entityName: entity.name,
                    width: widthKey,
                });
                return;
            }

            SceneTransformHelper.setStretch(entity, value);
            appliedCount++;
        });

        LoggerService.log(this, `✅ [RuleWidthCabinetClass] Applied to ${appliedCount} entities`);
    }
}
