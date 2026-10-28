import { ProductConfigLoader } from './product-config-loader.mjs';
import { ProductTagService } from './product-tag-service.mjs';
import { ProductEntityBuilder } from './product-entity-builder.mjs';
import { SubProductManager } from './sub-product-manager.mjs';
import { ProductQueryService } from './product-query-service.mjs';

function _define_property(obj, key, value) {
    if (key in obj) {
        Object.defineProperty(obj, key, {
            value: value,
            enumerable: true,
            configurable: true,
            writable: true
        });
    } else {
        obj[key] = value;
    }
    return obj;
}
class ProductRegistry_V2 {
    static get instance() {
        if (!ProductRegistry_V2._instance) {
            ProductRegistry_V2._instance = new ProductRegistry_V2();
        }
        return ProductRegistry_V2._instance;
    }
    // ========== CORE REGISTRY METHODS ==========
    /**
     * Реєструє новий тип продукту
     * @param {string} productType - Тип продукту
     * @param {Object} config - Конфігурація продукту
     */ registerProduct(productType, config) {
        this._productConfigs.set(productType, {
            productType,
            displayName: config.displayName || productType,
            category: config.category || 'default',
            tags: config.tags || [],
            isSubProduct: config.isSubProduct || false,
            parentAttachPoint: config.parentAttachPoint || null,
            inheritFromParent: config.inheritFromParent || [],
            meshConfig: config.meshConfig || {
                type: 'single',
                templateName: productType,
                meshes: [
                    {
                        name: productType,
                        visible: true,
                        required: true
                    }
                ]
            },
            rules: config.rules || [],
            defaultConfig: config.defaultConfig || {},
            thicknessOffsets: config.thicknessOffsets || null,
            countertopSupport: config.countertopSupport || null,
            countertopMount: config.countertopMount || null,
            sinkMount: config.sinkMount || null,
            fluting: config.fluting || null,
            sidePanelSupport: config.sidePanelSupport || null,
            connectPoints: config.connectPoints || null
        });
    }
    /**
     * Реєструє глобальне правило
     * @param {Class} RuleClass - Клас правила
     * @param {number} priority - Пріоритет
     */ registerGlobalRule(RuleClass, priority = 0) {
        this._globalRules.push({
            rule: RuleClass,
            priority
        });
    }
    /**
     * Отримує конфігурацію продукту
     * @param {string} productType - Тип продукту
     * @returns {Object|null}
     */ getProductConfig(productType) {
        return this._productConfigs.get(productType);
    }
    /**
     * Отримує mesh конфігурацію
     * @param {string} productType - Тип продукту
     * @returns {Object|null}
     */ getMeshConfig(productType) {
        const config = this.getProductConfig(productType);
        return config ? config.meshConfig : null;
    }
    /**
     * Отримує дефолтну конфігурацію
     * @param {string} productType - Тип продукту
     * @returns {Object}
     */ getDefaultConfig(productType) {
        const config = this.getProductConfig(productType);
        return config ? {
            ...config.defaultConfig
        } : {};
    }
    /** Product capability used by support-plane countertop positioning. */ getCountertopSupport(productType) {
        return this.getProductConfig(productType)?.countertopSupport || null;
    }
    /** Countertop mount-plane metadata (anchor plus an optional verified mesh fallback). */ getCountertopMount(productType) {
        return this.getProductConfig(productType)?.countertopMount || null;
    }
    /** Collection-specific scene anchor used to attach and resolve a sink. */ getSinkMount(productType) {
        return this.getProductConfig(productType)?.sinkMount || null;
    }
    /** Collection-specific side-panel template and positioning profile. */ getSidePanelSupport(productType) {
        return this.getProductConfig(productType)?.sidePanelSupport || null;
    }
    /** Connect points a dragged cabinet snaps to: [{ node, kind }] (kinds: columns/connect-points.mjs), or null (the box edges only). */ getConnectPoints(productType) {
        return this.getProductConfig(productType)?.connectPoints || null;
    }
    /** Resolve a sink anchor from a registered product type or a live entity name. */ getSinkAnchorName(productTypeOrEntityName) {
        const productType = this._productConfigs.has(productTypeOrEntityName) ? productTypeOrEntityName : this.detectProductType(productTypeOrEntityName || '');
        if (!productType) return null;
        const config = this.getProductConfig(productType);
        return config?.sinkMount?.anchorName || config?.meshConfig?.subProducts?.find((subProduct)=>subProduct.configKey === 'sinkType')?.attachPoint || null;
    }
    /** True when a scene node name is a registered collection sink mount. */ isSinkAnchorName(entityName) {
        if (typeof entityName !== 'string' || !entityName) return false;
        for (const config of this._productConfigs.values()){
            if (config?.sinkMount?.anchorName === entityName) return true;
        }
        return false;
    }
    /** Unique scene anchor names declared by the registered product collections. */ getSinkAnchorNames() {
        const names = new Set();
        for (const config of this._productConfigs.values()){
            const name = config?.sinkMount?.anchorName;
            if (typeof name === 'string' && name) names.add(name);
        }
        return [
            ...names
        ];
    }
    /**
     * Отримує всі правила для продукту (специфічні + глобальні)
     * @param {string} productType - Тип продукту
     * @returns {Array<{rule: Class, priority: number}>}
     */ getRulesForProduct(productType) {
        const config = this.getProductConfig(productType);
        if (!config) return [
            ...this._globalRules
        ];
        const allRules = [
            ...config.rules,
            ...this._globalRules
        ];
        return allRules.sort((a, b)=>b.priority - a.priority);
    }
    /**
     * Визначає тип продукту за назвою entity
     * @param {string} entityName - Назва entity
     * @returns {string|null}
     */ detectProductType(entityName) {
        if (typeof entityName !== 'string' || !entityName) return null;
        // Найдовший збіг: 'ULH-Open-Shelf-…' містить і 'Open-Shelf', і 'ULH-Open-Shelf'.
        let match = null;
        for (const productType of this._productConfigs.keys()){
            if (entityName.includes(productType) && (!match || productType.length > match.length)) {
                match = productType;
            }
        }
        return match;
    }
    /**
     * Отримує aabbIgnoreNodes для типу продукту
     * @param {string} productType - Тип продукту
     * @returns {string[]}
     */ getAabbIgnoreNodes(productType) {
        const config = this.getProductConfig(productType);
        return config?.defaultConfig?.aabbIgnoreNodes || [];
    }
    /**
     * Отримує aabbIgnoreNodes по entity name (визначає productType автоматично)
     * @param {string} entityName - Ім'я entity (наприклад 'Sink-Base-abc123')
     * @returns {string[]}
     */ getAabbIgnoreNodesByEntity(entityName) {
        const productType = this.detectProductType(entityName);
        if (!productType) return [];
        return this.getAabbIgnoreNodes(productType);
    }
    /**
     * Збирає всі aabbIgnoreNodes з масиву entities (union)
     * @param {pc.Entity[]} entities
     * @returns {string[]}
     */ collectAabbIgnoreNodes(entities) {
        const allNodes = new Set();
        entities.forEach((e)=>{
            const nodes = this.getAabbIgnoreNodesByEntity(e.name);
            nodes.forEach((n)=>allNodes.add(n));
        });
        return [
            ...allNodes
        ];
    }
    /**
     * Отримує всі зареєстровані типи продуктів
     * @returns {Array<string>}
     */ getAllProductTypes() {
        return Array.from(this._productConfigs.keys());
    }
    /**
     * Отримує продукти за категорією
     * @param {string} category - Категорія
     * @returns {Array<Object>}
     */ getProductsByCategory(category) {
        const products = [];
        this._productConfigs.forEach((config, productType)=>{
            if (config.category === category) {
                products.push(config);
            }
        });
        return products;
    }
    // ========== DELEGATED TO TAG SERVICE ==========
    /**
     * Делегат до TagService.getProductsByTags()
     */ getProductsByTags(tags, mode = 'any') {
        return this.tagService.getProductsByTags(tags, mode);
    }
    /**
     * Делегат до TagService.hasAllTags()
     */ hasAllTags(productType, tags) {
        return this.tagService.hasAllTags(productType, tags);
    }
    /**
     * Делегат до TagService.hasAnyTag()
     */ hasAnyTag(productType, tags) {
        return this.tagService.hasAnyTag(productType, tags);
    }
    /**
     * Делегат до TagService.getAllTags()
     */ getAllTags() {
        return this.tagService.getAllTags();
    }
    // ========== DELEGATED TO ENTITY BUILDER ==========
    /**
     * Делегат до EntityBuilder.createEntityFromMeshes()
     */ async createEntityFromMeshes(productType, config, app, context = {}) {
        return await this.entityBuilder.createEntityFromMeshes(productType, config, app, context);
    }
    // ========== DELEGATED TO SUB-PRODUCT MANAGER ==========
    /**
     * Делегат до SubProductManager.changeSubProduct()
     */ async changeSubProduct(parentEntity, parentProductType, newSubProductType, parentConfig, app) {
        return await this.subProductManager.changeSubProduct(parentEntity, parentProductType, newSubProductType, parentConfig, app);
    }
    /**
     * Делегат до SubProductManager.updateSubProductFromParent()
     */ async updateSubProductFromParent(parentEntity, parentProductType, newParentConfig, app) {
        return await this.subProductManager.updateSubProductFromParent(parentEntity, parentProductType, newParentConfig, app);
    }
    // ========== DELEGATED TO QUERY SERVICE ==========
    /**
     * Делегат до QueryService.getAllProductsInfo()
     */ getAllProductsInfo() {
        return this.queryService.getAllProductsInfo();
    }
    /**
     * Делегат до QueryService.getProductDetails()
     */ getProductDetails(productType) {
        return this.queryService.getProductDetails(productType);
    }
    /**
     * Делегат до QueryService.getProductStatistics()
     */ getProductStatistics() {
        return this.queryService.getProductStatistics();
    }
    /**
     * Делегат до QueryService.getAvailableSubProducts()
     */ getAvailableSubProducts(productType) {
        return this.queryService.getAvailableSubProducts(productType);
    }
    /**
     * Делегат до QueryService.searchProducts()
     */ searchProducts(query) {
        return this.queryService.searchProducts(query);
    }
    /**
     * Делегат до QueryService.exportToJSON()
     */ exportToJSON() {
        return this.queryService.exportToJSON();
    }
    // ========== UTILITY METHODS ==========
    /**
     * Завантажує конфігурацію з JSON (для майбутнього)
     * @param {Object} jsonConfig - JSON конфігурація
     */ loadFromJSON(jsonConfig) {
        console.warn('[ProductRegistry_v2] loadFromJSON not implemented yet');
    }
    constructor(){
        // Реєстр конфігурацій продуктів 1
        this._productConfigs = new Map();
        // Глобальні правила
        this._globalRules = [];
        // Ініціалізація сервісів 
        this.tagService = new ProductTagService(this);
        this.entityBuilder = new ProductEntityBuilder(this, this.tagService);
        this.subProductManager = new SubProductManager(this, this.tagService, this.entityBuilder);
        this.queryService = new ProductQueryService(this, this.tagService);
        // Завантаження дефолтних конфігурацій
        ProductConfigLoader.loadDefaultConfigs(this);
    }
}
_define_property(ProductRegistry_V2, "_instance", null);

export { ProductRegistry_V2 };
