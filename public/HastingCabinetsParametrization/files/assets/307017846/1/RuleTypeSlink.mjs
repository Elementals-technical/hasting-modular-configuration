import { ProductRegistry_V2 } from "../../registry/product-registry-v2.mjs";
import { BaseProductRule } from "../base-product-rule.mjs";

 
/**
 * Правило зміни типу умивальника (sink).
 * 
 * Реагує на зміни атрибута 'sinkType' в store.
 * Викликає SubProductManager для заміни під-продукту.
 * 
 * @example
 * // Створення з вибором умивальника
 * const id = await window.ConfiguratorAPI.addProduct("Sink-Cabinet", { sinkType: "Top_HPLPrisma" });
 * 
 * // Зміна умивальника після створення
 * await window.ConfiguratorAPI.setConfig(id, { sinkType: "Top_HPLCover" });
 */
export class RuleChangeSinkType extends BaseProductRule {
    constructor() {
        super({
            name: 'ChangeSinkType',
            watchAttributes: ['sinkType'],
            priority: 15  // Вищий пріоритет ніж Width/Height/Depth rules
        });
    }

    /**
     * Перевіряє чи потрібно виконувати правило.
     * Виконується тільки якщо sinkType реально змінився.
     */
    shouldExecute(changes, currentState, previousState) {
        return changes.sinkType !== undefined && 
               changes.sinkType !== previousState.get('sinkType');
    }

    /**
     * Виконує зміну типу умивальника.
     */
    async execute({ changes, currentState, previousState }) {
        const newSinkType = changes.sinkType;
        const oldSinkType = previousState.get('sinkType');

        console.log(`🔄 [RuleChangeSinkType] Changing sink from "${oldSinkType}" to "${newSinkType}"`);

        try {
            // Отримуємо необхідні дані з контексту
            const entity = this.entity;
            if (!entity) {
                console.error(`❌ [RuleChangeSinkType] No entity in context`);
                return;
            }

            const registry = ProductRegistry_V2.instance;
            const productType = this.context.productConfig?.productType ||
                registry.detectProductType(entity.name);
            const sinkAnchorName = registry.getSinkAnchorName(productType);

            if (!productType || !sinkAnchorName) {
                console.error(`❌ [RuleChangeSinkType] Sink mount is unavailable for: ${entity.name}`);
                return;
            }

            // sinkType: "Vessel" — проміжний стан (Vessel стиль обрано, модель ще ні).
            // Видаляємо поточний sink mesh, не створюємо новий.
            if (newSinkType === 'Vessel') {
                const attachPoint = entity.findByName(sinkAnchorName);
                if (attachPoint && attachPoint.children.length > 0) {
                    attachPoint.children[0].destroy();
                    console.log(`✅ [RuleChangeSinkType] Cleared sink for Vessel placeholder`);
                }
                return;
            }

            // Конвертуємо currentState в звичайний об'єкт для передачі
            const configObject = currentState.getAll();

            const success = await registry.subProductManager.changeSubProduct(
                entity,
                productType,
                newSinkType,
                configObject,
                this.app
            );

            if (success) {
                console.log(`✅ [RuleChangeSinkType] Successfully changed to "${newSinkType}"`);
            } else {
                console.error(`❌ [RuleChangeSinkType] Failed to change to "${newSinkType}"`);
            }
        } catch (error) {
            console.error(`❌ [RuleChangeSinkType] Error changing sink type:`, error);
        }
    }
}
