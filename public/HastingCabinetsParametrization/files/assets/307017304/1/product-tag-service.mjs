/**
 * Product Tag Service - сервіс для роботи з тегами продуктів
 * 
 * Відповідає за пошук, фільтрацію та валідацію продуктів по тегах.
 */

export class ProductTagService {
    constructor(registry) {
        this.registry = registry;
    }

    /**
     * Знаходить продукти за тегами
     * @param {Array<string>} tags - Масив тегів для пошуку
     * @param {string} mode - 'any' (хоча б один тег) або 'all' (всі теги)
     * @returns {Array<Object>} Масив продуктів
     */
    getProductsByTags(tags, mode = 'any') {
        const products = [];
        
        this.registry._productConfigs.forEach((config, productType) => {
            const productTags = config.tags || [];
            let matches = false;

            if (mode === 'all') {
                // Всі теги повинні бути присутні
                matches = tags.every(tag => productTags.includes(tag));
            } else {
                // Хоча б один тег присутній
                matches = tags.some(tag => productTags.includes(tag));
            }
 
            if (matches) {
                products.push({
                    productType,
                    displayName: config.displayName,
                    category: config.category,
                    tags: productTags,
                    isSubProduct: config.isSubProduct || false
                });
            }
        });

        return products;
    }

    /**
     * Перевіряє чи має продукт ВСІ вказані теги
     * @param {string} productType - Тип продукту
     * @param {Array<string>} tags - Теги для перевірки
     * @returns {boolean}
     */
    hasAllTags(productType, tags) {
        const config = this.registry.getProductConfig(productType);
        if (!config) return false;

        const productTags = config.tags || [];
        return tags.every(tag => productTags.includes(tag));
    }

    /**
     * Перевіряє чи має продукт ХОЧА Б ОДИН з вказаних тегів
     * @param {string} productType - Тип продукту
     * @param {Array<string>} tags - Теги для перевірки
     * @returns {boolean}
     */
    hasAnyTag(productType, tags) {
        const config = this.registry.getProductConfig(productType);
        if (!config) return false;

        const productTags = config.tags || [];
        return tags.some(tag => productTags.includes(tag));
    }

    /**
     * Отримує всі унікальні теги з реєстру
     * @returns {Array<string>}
     */
    getAllTags() {
        const tagsSet = new Set();

        this.registry._productConfigs.forEach((config) => {
            if (config.tags) {
                config.tags.forEach(tag => tagsSet.add(tag));
            }
        });

        return Array.from(tagsSet).sort();
    }

    /**
     * Знаходить продукти які відповідають визначенню під-продукту
     * @param {Object} subProductDef - Визначення під-продукту з matchTags
     * @returns {Array<string>} productTypes
     */
    getMatchingProductsByTags(subProductDef) {
        if (!subProductDef.matchTags || subProductDef.matchTags.length === 0) {
            return subProductDef.options || [];
        }

        const matchMode = subProductDef.matchMode || 'any';
        const matchingProducts = this.getProductsByTags(subProductDef.matchTags, matchMode);

        return matchingProducts.map(p => p.productType);
    }
}
