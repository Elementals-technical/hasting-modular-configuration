import { Entity } from '../../../../../../playcanvas-stable.min.mjs';
import { resolveMeshBooleanCutters, disableCabinetShadowCasters } from '../hooks/post-clone-hooks.mjs';
import { captureTemplateGeometry } from '../../cabinet-placement/adapters/template-geometry-metadata.mjs';

/**
 * Product Entity Builder - створює entities з mesh конфігурацій
 *
 * Відповідає за побудову ієрархії entities на основі meshConfig.
 */ class ProductEntityBuilder {
    /**
     * Створює entity з meshes на основі конфігурації
     * @param {string} productType - Тип продукту
     * @param {Object} config - Конфігурація продукту
     * @param {pc.Application} app - PlayCanvas application
     * @returns {Promise<pc.Entity>}
     */ async createEntityFromMeshes(productType, config, app, context = {}) {
        this._checkPreviewAbort(context);
        const meshConfig = this.registry.getMeshConfig(productType);
        if (!meshConfig) {
            console.error(`[EntityBuilder] No mesh config for "${productType}"`);
            return null;
        }
        // Створюємо root entity
        const rootEntity = new Entity(`${productType}_Root`);
        if (context.purpose === 'preview') rootEntity.enabled = false;
        try {
            // Обробка різних типів mesh config
            if (meshConfig.type === 'variants') {
                // Для variants - обираємо активний варіант
                await this._loadVariant(rootEntity, meshConfig, config, productType, app, context);
            } else {
                // Для single/composite/multiple - стандартна обробка
                // 1. Обробляємо основні meshes
                if (meshConfig.meshes) {
                    for (const meshDef of meshConfig.meshes){
                        const meshEntity = await this._loadMesh(meshDef, productType, app, context);
                        if (meshEntity) {
                            rootEntity.addChild(meshEntity);
                        } else if (meshDef.required) {
                            if (context.purpose === 'preview') throw this._previewUnavailable(productType);
                            console.error(`[EntityBuilder] Required mesh failed for "${productType}"`);
                            rootEntity.destroy();
                            return null;
                        }
                    }
                }
                // 2. Обробляємо subProducts
                if (meshConfig.subProducts?.length > 0) {
                    this._createConfigAnchors(rootEntity, meshConfig.subProducts, config);
                    await this._attachSubProducts(rootEntity, meshConfig.subProducts, productType, config, app, context);
                }
            }
            this._checkPreviewAbort(context);
            return rootEntity;
        } catch (error) {
            rootEntity.destroy();
            throw error;
        }
    }
    /**
     * Завантажує варіант mesh на основі config
     * @private
     */ async _loadVariant(rootEntity, meshConfig, config, productType, app, context = {}) {
        const variants = meshConfig.variants || [];
        // Визначаємо ключ для вибору варіанту
        const variantKey = config.SidePanelType || config.variant || meshConfig.defaultVariant || 'None';
        // Знаходимо варіант
        const variant = variants.find((v)=>v.key === variantKey);
        if (!variant) {
            if (context.purpose === 'preview') throw this._previewUnavailable(productType);
            console.warn(`[EntityBuilder] Variant "${variantKey}" not found for "${productType}"`);
            return;
        }
        // Якщо варіант None або немає templateName - не завантажуємо mesh
        if (variant.key === 'None' || !variant.templateName) {
            if (context.purpose === 'preview' && variant.key !== 'None') throw this._previewUnavailable(productType);
            console.log(`[EntityBuilder] Variant "${variantKey}" has no mesh for "${productType}"`);
            return;
        }
        // Завантажуємо mesh для варіанту
        const meshEntity = await this._cloneTemplate(variant.templateName, app, context);
        if (!meshEntity) {
            if (context.purpose === 'preview') throw this._previewUnavailable(productType);
            console.error(`[EntityBuilder] Failed to load variant template "${variant.templateName}" for "${productType}"`);
            return;
        }
        rootEntity.addChild(meshEntity);
        console.log(`✅ [EntityBuilder] Loaded variant "${variantKey}" (${variant.templateName}) for "${productType}"`);
    }
    /**
     * Завантажує і додає mesh до entity
     * @private
     */ async _loadMesh(meshDef, productType, app, context = {}) {
        const templateName = meshDef.templateName;
        if (!templateName) {
            if (meshDef.required) {
                console.error(`[EntityBuilder] Required mesh has no templateName for "${productType}"`);
            }
            return null;
        }
        const meshEntity = await this._cloneTemplate(templateName, app, context);
        if (!meshEntity) {
            if (meshDef.required) {
                console.error(`[EntityBuilder] Required template "${templateName}" not found`);
            }
            return null;
        }
        // console.log(`✅ [EntityBuilder] Added mesh "${templateName}" to "${productType}"`);
        return meshEntity;
    }
    /**
     * Creates by code the attach points a sub-product declares with `anchorLocalKey` (no Editor entity), before the
     * sub-products attach — only while the parent config selects that sub-product (`config[configKey]`), at the
     * local `{x, y, z}` stored under `config[anchorLocalKey]`. Idempotent.
     * @private
     */ _createConfigAnchors(rootEntity, subProductDefs, config) {
        for (const def of subProductDefs){
            if (!def.anchorLocalKey || !config?.[def.configKey] || rootEntity.findByName(def.attachPoint)) continue;
            const local = config[def.anchorLocalKey] || {};
            const coord = (value)=>Number.isFinite(Number(value)) ? Number(value) : 0;
            const anchor = new Entity(def.attachPoint);
            anchor.setLocalPosition(coord(local.x), coord(local.y), coord(local.z));
            rootEntity.addChild(anchor);
        }
    }
    /**
     * Прикріплює під-продукти до root entity
     * @private
     */ async _attachSubProducts(rootEntity, subProductDefs, parentProductType, parentConfig, app, context = {}) {
        for (const subProductDef of subProductDefs){
            await this._attachSingleSubProduct(rootEntity, subProductDef, parentProductType, parentConfig, app, context);
        }
    }
    /**
     * Прикріплює один під-продукт
     * @private
     */ async _attachSingleSubProduct(rootEntity, subProductDef, parentProductType, parentConfig, app, context = {}) {
        // Визначаємо який під-продукт створювати
        let subProductType = this._determineSubProductType(subProductDef, parentConfig);
        if (!subProductType) {
            if (context.purpose === 'preview' && subProductDef.required) throw this._previewUnavailable(parentProductType);
            if (subProductDef.required) {
                console.error(`[EntityBuilder] Required sub-product not specified for "${parentProductType}"`);
            }
            return;
        }
        // Отримуємо конфігурацію під-продукту
        const subProductConfig = this.registry.getProductConfig(subProductType);
        // Створюємо конфігурацію з наслідуванням
        const subProductFinalConfig = this._mergeConfigWithParent(subProductConfig, parentConfig, subProductType);
        // Створюємо під-продукт рекурсивно
        const subProductEntity = await this.createEntityFromMeshes(subProductType, subProductFinalConfig, app, context);
        if (!subProductEntity) {
            if (context.purpose === 'preview' && subProductDef.required) throw this._previewUnavailable(subProductType);
            if (subProductDef.required) {
                console.error(`[EntityBuilder] Failed to create required sub-product "${subProductType}"`);
            }
            return;
        }
        // Зберігаємо посилання на батька
        subProductEntity._parentConfig = parentConfig;
        subProductEntity._parentProductType = parentProductType;
        // Знаходимо точку прикріплення
        const attachPoint = rootEntity.findByName(subProductDef.attachPoint);
        if (!attachPoint) {
            if (context.purpose === 'preview') {
                subProductEntity.destroy();
                throw this._previewUnavailable(`${parentProductType}:${subProductDef.attachPoint}`);
            }
            console.error(`[EntityBuilder] Attach point "${subProductDef.attachPoint}" not found in "${parentProductType}"`);
            rootEntity.addChild(subProductEntity);
        } else {
            attachPoint.addChild(subProductEntity);
        // console.log(`✅ [EntityBuilder] Attached sub-product "${subProductType}" to "${subProductDef.attachPoint}"`);
        }
        // Додаємо ProductController
        if (context.purpose === 'preview') {
            // Parent stays disabled until the adapter finishes configuration.
            subProductEntity.enabled = true;
        } else if (!subProductEntity.script || !subProductEntity.script.has('productController')) {
            if (!subProductEntity.script) subProductEntity.addComponent('script');
            subProductEntity.script.create('productController');
        }
    }
    /**
     * Визначає який під-продукт створювати
     * @private
     */ _determineSubProductType(subProductDef, config) {
        let subProductType = subProductDef.productType;
        if (!subProductType) {
            const configKey = this._getConfigKeyForSubProduct(subProductDef);
            subProductType = config[configKey];
            if (!subProductType) {
                subProductType = subProductDef.defaultValue || subProductDef.defaultOption;
            }
            // Валідація тегів
            if (subProductType && subProductDef.matchTags) {
                const isValid = this._validateSubProductTags(subProductType, subProductDef);
                if (!isValid) {
                    console.warn(`[EntityBuilder] Sub-product "${subProductType}" does not match tags ${JSON.stringify(subProductDef.matchTags)}`);
                    subProductType = subProductDef.defaultValue || subProductDef.defaultOption;
                }
            }
        }
        return subProductType;
    }
    /**
     * Валідує чи відповідає під-продукт тегам
     * @private
     */ _validateSubProductTags(subProductType, subProductDef) {
        const matchMode = subProductDef.matchMode || 'any';
        return matchMode === 'all' ? this.tagService.hasAllTags(subProductType, subProductDef.matchTags) : this.tagService.hasAnyTag(subProductType, subProductDef.matchTags);
    }
    /**
     * Визначає ключ конфігурації для під-продукту
     * @private
     */ _getConfigKeyForSubProduct(subProductDef) {
        if (subProductDef.configKey) {
            return subProductDef.configKey;
        }
        if (subProductDef.matchTags?.length > 0) {
            const firstTag = subProductDef.matchTags[0];
            return `${firstTag}Type`;
        }
        if (subProductDef.options?.length > 0) {
            if (subProductDef.options.some((opt)=>opt.includes('Top_'))) {
                return 'sinkType';
            }
        }
        return 'subProductType';
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
        console.log(`🔗 [EntityBuilder] Sub-product "${subProductType}" inherited from parent:`, inheritFromParent.filter((p)=>parentConfig[p] !== undefined));
        return mergedConfig;
    }
    /**
     * Клонує template з assets
     * @private
     */ async _cloneTemplate(templateName, app, context = {}) {
        if (context.purpose === 'preview') return this._clonePreviewTemplate(templateName, app, context);
        const asset = app.assets.find(templateName, 'template');
        if (!asset) {
            console.warn(`[EntityBuilder] Template "${templateName}" not found in assets`);
            return null;
        }
        if (asset.resource) {
            const instance = asset.resource.instantiate();
            const dataCloned = instance.clone();
            dataCloned.enabled = true;
            resolveMeshBooleanCutters(dataCloned);
            disableCabinetShadowCasters(dataCloned, templateName);
            return dataCloned.clone();
        }
        return new Promise((resolve)=>{
            asset.ready(()=>{
                const instance = asset.resource.instantiate();
                const dataCloned = instance.clone();
                dataCloned.enabled = true;
                resolveMeshBooleanCutters(dataCloned);
                disableCabinetShadowCasters(dataCloned, templateName);
                resolve(dataCloned);
            });
            app.assets.load(asset);
        });
    }
    _previewUnavailable(detail) {
        return Object.assign(new Error(`Preview model unavailable: ${detail}`), {
            code: 'PREVIEW_MODEL_UNAVAILABLE'
        });
    }
    _checkPreviewAbort(context) {
        if (context.purpose === 'preview' && context.signal?.aborted) {
            throw Object.assign(new Error('Preview cancelled'), {
                code: 'CANCELLED'
            });
        }
    }
    async _clonePreviewTemplate(templateName, app, context) {
        this._checkPreviewAbort(context);
        const asset = app.assets.find(templateName, 'template');
        if (!asset) return null;
        if (!asset.resource) {
            await new Promise((resolve, reject)=>{
                const cleanup = ()=>{
                    asset.off('load', loaded);
                    asset.off('error', failed);
                    context.signal?.removeEventListener('abort', cancelled);
                };
                const loaded = ()=>{
                    cleanup();
                    resolve();
                };
                const failed = ()=>{
                    cleanup();
                    reject(this._previewUnavailable(templateName));
                };
                const cancelled = ()=>{
                    cleanup();
                    reject(Object.assign(new Error('Preview cancelled'), {
                        code: 'CANCELLED'
                    }));
                };
                asset.on('load', loaded);
                asset.on('error', failed);
                context.signal?.addEventListener('abort', cancelled, {
                    once: true
                });
                if (context.signal?.aborted) {
                    cancelled();
                    return;
                }
                try {
                    app.assets.load(asset);
                } catch (error) {
                    cleanup();
                    reject(error);
                }
            });
        }
        this._checkPreviewAbort(context);
        if (!asset.resource) throw this._previewUnavailable(templateName);
        const entity = asset.resource.instantiate();
        try {
            entity.enabled = false;
            captureTemplateGeometry(entity);
            // Template scripts may mutate global composition/selection when enabled.
            // Isolated rule configuration is supplied by the preview adapter instead.
            const stripScripts = (node)=>{
                if (node.script) node.removeComponent('script');
                for (const child of node.children)stripScripts(child);
            };
            stripScripts(entity);
            resolveMeshBooleanCutters(entity);
            disableCabinetShadowCasters(entity, templateName);
            this._checkPreviewAbort(context);
            entity.enabled = true; // Still detached, then attached under a disabled preview root.
            return entity;
        } catch (error) {
            entity.destroy();
            throw error;
        }
    }
    /**
     * Застосовує видимість meshes
     */ applyMeshVisibility(entity, meshes) {
        meshes.forEach((meshDef)=>{
            const meshEntity = entity.findByName(meshDef.name);
            if (meshEntity) {
                meshEntity.enabled = meshDef.visible;
            } else if (meshDef.required) {
                console.warn(`[EntityBuilder] Required mesh "${meshDef.name}" not found`);
            }
        });
    }
    /**
     * Застосовує варіант (показує тільки вказані meshes)
     */ applyVariant(entity, allMeshes, visibleMeshNames) {
        allMeshes.forEach((meshDef)=>{
            const meshEntity = entity.findByName(meshDef.name);
            if (meshEntity) {
                meshEntity.enabled = visibleMeshNames.includes(meshDef.name);
            }
        });
    }
    /**
     * Змінює варіант для entity (для products з type: 'variants')
     * @param {pc.Entity} entity - Root entity продукту
     * @param {string} productType - Тип продукту
     * @param {string} newVariantKey - Новий ключ варіанту
     * @param {pc.Application} app - PlayCanvas application
     * @returns {Promise<boolean>} - Успішність зміни
     */ async changeVariant(entity, productType, newVariantKey, app) {
        const meshConfig = this.registry.getMeshConfig(productType);
        if (!meshConfig || meshConfig.type !== 'variants') {
            console.warn(`[EntityBuilder] Product "${productType}" does not support variants`);
            return false;
        }
        const variants = meshConfig.variants || [];
        const newVariant = variants.find((v)=>v.key === newVariantKey);
        if (!newVariant) {
            console.error(`[EntityBuilder] Variant "${newVariantKey}" not found for "${productType}"`);
            return false;
        }
        // Cancellation: відміна попереднього changeVariant для цього entity
        const entityId = entity._guid || entity.name;
        if (this._pendingVariants.has(entityId)) {
            this._pendingVariants.get(entityId).cancelled = true;
        }
        const token = {
            cancelled: false
        };
        this._pendingVariants.set(entityId, token);
        // Видаляємо всі дочірні entities (старий варіант)
        const children = [
            ...entity.children
        ];
        children.forEach((child)=>{
            child.destroy();
        });
        // Якщо новий варіант None або без templateName - просто видаляємо
        if (newVariant.key === 'None' || !newVariant.templateName) {
            this._pendingVariants.delete(entityId);
            console.log(`[EntityBuilder] Changed to variant "None" for "${productType}"`);
            return true;
        }
        // Завантажуємо новий варіант
        const meshEntity = await this._cloneTemplate(newVariant.templateName, app);
        // Перевірка чи не був скасований конкурентним викликом
        if (token.cancelled) {
            if (meshEntity) meshEntity.destroy();
            console.log(`[EntityBuilder] changeVariant cancelled for "${productType}" (superseded by newer call)`);
            return null;
        }
        this._pendingVariants.delete(entityId);
        if (!meshEntity) {
            console.error(`[EntityBuilder] Failed to load variant template "${newVariant.templateName}"`);
            return false;
        }
        entity.addChild(meshEntity);
        console.log(`✅ [EntityBuilder] Changed variant to "${newVariantKey}" (${newVariant.templateName}) for "${productType}"`);
        return meshEntity;
    }
    constructor(registry, tagService){
        this.registry = registry;
        this.tagService = tagService;
        this._pendingVariants = new Map();
    }
}

export { ProductEntityBuilder };
