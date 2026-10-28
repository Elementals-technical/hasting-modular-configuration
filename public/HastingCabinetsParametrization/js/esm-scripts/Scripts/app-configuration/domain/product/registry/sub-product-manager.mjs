import { SnapshotProductAttribute } from '../../../services/product/snapshot-product-attribute.mjs';

class SubProductManager {
    /**
     * Змінює під-продукт
     * @param {pc.Entity} parentEntity - Батьківський entity
     * @param {string} parentProductType - Тип батьківського продукту
     * @param {string} newSubProductType - Новий тип під-продукту
     * @param {Object} parentConfig - Конфігурація батька
     * @param {pc.Application} app - PlayCanvas application
     * @returns {Promise<boolean>}
     */ async changeSubProduct(parentEntity, parentProductType, newSubProductType, parentConfig, app) {
        const meshConfig = this.registry.getMeshConfig(parentProductType);
        if (!meshConfig?.subProducts) {
            console.error(`[SubProductManager] No sub-products defined for "${parentProductType}"`);
            return false;
        }
        // Знаходимо визначення під-продукту
        const subProductDef = this._findSubProductDefinition(meshConfig.subProducts, newSubProductType);
        if (!subProductDef) {
            console.error(`[SubProductManager] Sub-product "${newSubProductType}" does not match any definition`);
            return false;
        }
        // Знаходимо точку прикріплення
        const attachPoint = parentEntity.findByName(subProductDef.attachPoint);
        if (!attachPoint) {
            console.error(`[SubProductManager] Attach point "${subProductDef.attachPoint}" not found`);
            return false;
        }
        // Перевіряємо чи потрібна зміна
        const currentSubProduct = attachPoint.children[0];
        if (currentSubProduct) {
            const currentType = this.registry.detectProductType(currentSubProduct.name);
            if (currentType === newSubProductType) {
                console.log(`ℹ️ [SubProductManager] Sub-product already "${newSubProductType}", skipping change`);
                return true;
            }
        }
        // Видаляємо старий під-продукт
        this._removeOldSubProduct(attachPoint);
        // Створюємо новий під-продукт
        const success = await this._createAndAttachSubProduct(attachPoint, newSubProductType, parentProductType, parentConfig, app);
        if (success) {
            console.log(`✅ [SubProductManager] Changed sub-product to "${newSubProductType}" at "${subProductDef.attachPoint}"`);
        }
        return success;
    }
    /**
     * Оновлює під-продукт коли змінюється батьківська конфігурація
     * @param {pc.Entity} parentEntity - Батьківський entity
     * @param {string} parentProductType - Тип батьківського продукту
     * @param {Object} newParentConfig - Нова конфігурація батька
     * @param {pc.Application} app - PlayCanvas application
     */ async updateSubProductFromParent(parentEntity, parentProductType, newParentConfig, app) {
        const meshConfig = this.registry.getMeshConfig(parentProductType);
        if (!meshConfig?.subProducts) {
            return;
        }
        for (const subProductDef of meshConfig.subProducts){
            await this._updateSingleSubProduct(parentEntity, subProductDef, newParentConfig);
        }
    }
    /**
     * Оновлює один під-продукт
     * @private
     */ async _updateSingleSubProduct(parentEntity, subProductDef, newParentConfig) {
        const attachPoint = parentEntity.findByName(subProductDef.attachPoint);
        if (!attachPoint || attachPoint.children.length === 0) return;
        const subProductEntity = attachPoint.children[0];
        const subProductType = this.registry.detectProductType(subProductEntity.name);
        if (!subProductType) return;
        // Отримуємо нову конфігурацію з наслідуванням
        const subProductConfig = this.registry.getProductConfig(subProductType);
        const newSubProductConfig = this._mergeConfigWithParent(subProductConfig, newParentConfig, subProductType);
        // Оновлюємо посилання
        subProductEntity._parentConfig = newParentConfig;
        // Виконуємо правила під-продукту
        const productController = subProductEntity.script?.get('productController');
        if (productController?.ruleExecutor) {
            const currentSnapshot = new SnapshotProductAttribute(newSubProductConfig);
            const previousSnapshot = new SnapshotProductAttribute(subProductEntity._parentConfig || {});
            await productController.ruleExecutor.executeRules({
                changes: newSubProductConfig,
                currentState: currentSnapshot,
                previousState: previousSnapshot
            });
            console.log(`🔄 [SubProductManager] Updated sub-product "${subProductType}" from parent config changes`);
        }
    }
    /**
     * Знаходить визначення під-продукту по тегах або options
     * @private
     */ _findSubProductDefinition(subProductDefs, newSubProductType) {
        for (const def of subProductDefs){
            // Перевірка по matchTags
            if (def.matchTags) {
                const matchMode = def.matchMode || 'any';
                const matches = matchMode === 'all' ? this.tagService.hasAllTags(newSubProductType, def.matchTags) : this.tagService.hasAnyTag(newSubProductType, def.matchTags);
                if (matches) {
                    return def;
                }
            }
            // Fallback: перевірка по старому options
            if (def.options?.includes(newSubProductType)) {
                return def;
            }
        }
        return null;
    }
    /**
     * Видаляє старий під-продукт
     * @private
     */ _removeOldSubProduct(attachPoint) {
        const oldSubProduct = attachPoint.children[0];
        if (oldSubProduct) {
            oldSubProduct.destroy();
        }
    }
    /**
     * Створює і прикріплює новий під-продукт
     * @private
     */ async _createAndAttachSubProduct(attachPoint, subProductType, parentProductType, parentConfig, app) {
        // Отримуємо конфігурацію під-продукту з наслідуванням
        const subProductConfig = this.registry.getProductConfig(subProductType);
        const subProductFinalConfig = this._mergeConfigWithParent(subProductConfig, parentConfig, subProductType);
        // Створюємо новий під-продукт
        const newSubProductEntity = await this.entityBuilder.createEntityFromMeshes(subProductType, subProductFinalConfig, app);
        if (!newSubProductEntity) {
            console.error(`[SubProductManager] Failed to create sub-product "${subProductType}"`);
            return false;
        }
        // Зберігаємо посилання на батька
        newSubProductEntity._parentConfig = parentConfig;
        newSubProductEntity._parentProductType = parentProductType;
        // Прикріплюємо
        attachPoint.addChild(newSubProductEntity);
        // Додаємо ProductController
        if (!newSubProductEntity.script || !newSubProductEntity.script.has('productController')) {
            if (!newSubProductEntity.script) newSubProductEntity.addComponent('script');
            newSubProductEntity.script.create('productController');
        }
        return true;
    }
    /**
     * Зливає конфігурацію під-продукту з батьківською
     * @private
     */ _mergeConfigWithParent(subProductConfig, parentConfig, subProductType) {
        if (!subProductConfig) return parentConfig;
        const mergedConfig = {
            ...subProductConfig.defaultConfig,
            ...parentConfig
        };
        const inheritFromParent = subProductConfig.inheritFromParent || [];
        inheritFromParent.forEach((paramName)=>{
            if (parentConfig[paramName] !== undefined) {
                mergedConfig[paramName] = parentConfig[paramName];
            }
        });
        console.log(`🔗 [SubProductManager] Sub-product "${subProductType}" inherited from parent:`, inheritFromParent.filter((p)=>parentConfig[p] !== undefined));
        return mergedConfig;
    }
    constructor(registry, tagService, entityBuilder){
        this.registry = registry;
        this.tagService = tagService;
        this.entityBuilder = entityBuilder;
    }
}

export { SubProductManager };
