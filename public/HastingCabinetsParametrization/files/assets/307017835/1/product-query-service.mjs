/**
 * Product Query Service - API для отримання інформації про продукти
 * 
 * Відповідає за пошук, статистику та експорт інформації про продукти.
 */

export class ProductQueryService {
    constructor(registry, tagService) {
        this.registry = registry;
        this.tagService = tagService;
    }

    /**
     * Отримує повну інформацію про всі продукти
     * @returns {Array<Object>}
     */ 
    getAllProductsInfo() {
        const products = [];
        
        this.registry._productConfigs.forEach((config, productType) => {
            products.push({
                productType,
                displayName: config.displayName,
                category: config.category,
                tags: config.tags || [],
                isSubProduct: config.isSubProduct || false,
                parentAttachPoint: config.parentAttachPoint || null,
                inheritFromParent: config.inheritFromParent || [],
                hasSubProducts: config.meshConfig?.subProducts?.length > 0,
                rulesCount: config.rules?.length || 0,
                defaultConfig: config.defaultConfig
            });
        });
        
        return products;
    }

    /**
     * Отримує детальну інформацію про конкретний продукт
     * @param {string} productType - Тип продукту
     * @returns {Object|null}
     */
    getProductDetails(productType) {
        const config = this.registry.getProductConfig(productType);
        if (!config) return null;
        
        const details = {
            productType,
            displayName: config.displayName,
            category: config.category,
            tags: config.tags || [],
            isSubProduct: config.isSubProduct || false,
            parentAttachPoint: config.parentAttachPoint || null,
            inheritFromParent: config.inheritFromParent || [],
            meshConfig: config.meshConfig,
            rules: config.rules.map(r => ({
                name: r.rule.name,
                priority: r.priority
            })),
            defaultConfig: config.defaultConfig
        };
        
        // Додаємо інформацію про під-продукти
        if (config.meshConfig?.subProducts) {
            details.subProducts = config.meshConfig.subProducts.map(sp => ({
                attachPoint: sp.attachPoint,
                required: sp.required,
                matchTags: sp.matchTags || [],
                matchMode: sp.matchMode || 'any',
                defaultValue: sp.defaultValue || sp.defaultOption,
                configKey: sp.configKey,
                availableProducts: this.tagService.getMatchingProductsByTags(sp)
            }));
        }
        
        return details;
    }

    /**
     * Отримує статистику по продуктах
     * @returns {Object}
     */
    getProductStatistics() {
        let totalProducts = 0;
        let subProducts = 0;
        let productsWithSubProducts = 0;
        const categoryCounts = {};
        const tagCounts = {};
        
        this.registry._productConfigs.forEach((config) => {
            totalProducts++;
            
            if (config.isSubProduct) {
                subProducts++;
            }
            
            if (config.meshConfig?.subProducts?.length > 0) {
                productsWithSubProducts++;
            }
            
            // Рахуємо категорії
            const category = config.category || 'default';
            categoryCounts[category] = (categoryCounts[category] || 0) + 1;
            
            // Рахуємо теги
            if (config.tags) {
                config.tags.forEach(tag => {
                    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                });
            }
        });
        
        return {
            totalProducts,
            subProducts,
            mainProducts: totalProducts - subProducts,
            productsWithSubProducts,
            categories: categoryCounts,
            tags: tagCounts,
            globalRulesCount: this.registry._globalRules.length
        };
    }

    /**
     * Знаходить можливі під-продукти для конкретного продукту
     * @param {string} productType - Тип батьківського продукту
     * @returns {Object|null}
     */
    getAvailableSubProducts(productType) {
        const config = this.registry.getProductConfig(productType);
        if (!config || !config.meshConfig?.subProducts) {
            return null;
        }
        
        const result = {};
        
        config.meshConfig.subProducts.forEach((subProductDef, index) => {
            const key = subProductDef.configKey || `subProduct_${index}`;
            const availableProducts = this.tagService.getMatchingProductsByTags(subProductDef);
            
            result[key] = {
                attachPoint: subProductDef.attachPoint,
                required: subProductDef.required,
                matchTags: subProductDef.matchTags || [],
                matchMode: subProductDef.matchMode || 'any',
                defaultValue: subProductDef.defaultValue || subProductDef.defaultOption,
                availableProducts: availableProducts.map(productType => {
                    const pConfig = this.registry.getProductConfig(productType);
                    return {
                        productType,
                        displayName: pConfig?.displayName || productType,
                        tags: pConfig?.tags || []
                    };
                })
            };
        });
        
        return result;
    }

    /**
     * Пошук продуктів за запитом
     * @param {string} query - Пошуковий запит
     * @returns {Array<Object>}
     */
    searchProducts(query) {
        const lowerQuery = query.toLowerCase();
        const results = [];
        
        this.registry._productConfigs.forEach((config, productType) => {
            const matches = 
                productType.toLowerCase().includes(lowerQuery) ||
                config.displayName.toLowerCase().includes(lowerQuery) ||
                config.category.toLowerCase().includes(lowerQuery) ||
                (config.tags && config.tags.some(tag => tag.toLowerCase().includes(lowerQuery)));
            
            if (matches) {
                results.push({
                    productType,
                    displayName: config.displayName,
                    category: config.category,
                    tags: config.tags || [],
                    isSubProduct: config.isSubProduct || false
                });
            }
        });
        
        return results;
    }

    /**
     * Експортує конфігурацію в JSON
     * @returns {Object}
     */
    exportToJSON() {
        const config = {
            products: {},
            globalRules: this.registry._globalRules.map(r => ({
                ruleName: r.rule.name,
                priority: r.priority
            }))
        };

        this.registry._productConfigs.forEach((productConfig, productType) => {
            config.products[productType] = {
                displayName: productConfig.displayName,
                category: productConfig.category,
                tags: productConfig.tags,
                meshConfig: productConfig.meshConfig,
                defaultConfig: productConfig.defaultConfig,
                rules: productConfig.rules.map(r => ({
                    ruleName: r.rule.name,
                    priority: r.priority
                }))
            };
        });

        return config;
    }
}
