import { LoggerService } from '../../../../services/logger/logger-service.mjs';
import { ProductRegistry_V2 } from '../../registry/product-registry-v2.mjs';
import { BaseProductRule } from '../base-product-rule.mjs';

/**
 * Правило для зміни варіанту TowelBar
 *
 * Реагує на зміни атрибута 'TowelBarType' в store.
 * Обробляє зміну TowelBarType для продуктів з type: 'variants'
 */ class RuleChangeTowelBarVariant extends BaseProductRule {
    onInitialize() {
        LoggerService.log(this, `🎨 [RuleChangeTowelBarVariant] Initialized for product "${this.context.productId}"`);
    }
    /**
     * Основне виконання правила
     */ async execute({ changes, currentState, previousState }) {
        const newVariantKey = currentState.get('TowelBarType');
        // Перевіряємо чи є значення
        if (newVariantKey === undefined || newVariantKey === null || newVariantKey === '') {
            LoggerService.warn(this, '⚠️ [RuleChangeTowelBarVariant] TowelBarType is empty, skip');
            return;
        }
        // Перевіряємо що продукт підтримує variants
        const productType = currentState.get('productType');
        const meshConfig = ProductRegistry_V2.instance.getMeshConfig(productType);
        if (!meshConfig || meshConfig.type !== 'variants') {
            LoggerService.warn(this, `⚠️ [RuleChangeTowelBarVariant] Product "${productType}" does not support variants`);
            return;
        }
        LoggerService.log(this, `🔄 [RuleChangeTowelBarVariant] Changing variant to "${newVariantKey}" for "${productType}"`);
        // Використовуємо EntityBuilder для зміни варіанту
        const registry = ProductRegistry_V2.instance;
        await registry.entityBuilder.changeVariant(this.entity, productType, newVariantKey, this.app);
    }
    constructor(context){
        super({
            name: 'ChangeTowelBarVariant',
            watchAttributes: [
                'TowelBarType'
            ],
            priority: 10
        });
        this.context = context;
    }
}

export { RuleChangeTowelBarVariant };
