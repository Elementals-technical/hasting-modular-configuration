import { LoggerService } from '../logger/logger-service.mjs';

/**
 * Сервіс для роботи з матеріалами в PlayCanvas.
 * 
 * Кешує, завантажує та застосовує матеріали.
 * Не потребує прив'язки до entity — працює автономно.
 * 
 * @example
 * // Завантажити і отримати матеріал
 * const material = await MaterialService.loadMaterial('Avenue_Silver_TRA');
 * 
 * // Застосувати матеріал до entity
 * MaterialService.applyToEntity(entity, material);
 * 
 * // Завантажити і одразу застосувати
 * await MaterialService.applyMaterialByName('Avenue_Silver_TRA', [entity1, entity2]);
 */
export class MaterialService {

    /** @type {pc.Application} */
    static _app = null;

    /** @type {Map<string, pc.Material>} Кеш завантажених матеріалів за іменем */
    static _cache = new Map();

    /** @type {Map<string, Promise<pc.Material>>} Pending завантаження (дедуплікація) */
    static _pending = new Map();

    /**
     * Ініціалізація сервісу. Викликати один раз при старті.
     * Якщо не викликати — app буде знайдений автоматично.
     * @param {pc.Application} app
     */
    static init(app) {
        MaterialService._app = app;
        LoggerService.log(null, '🎨 MaterialService initialized');
    }

    /** @private */
    static _getApp() {
        if (MaterialService._app) return MaterialService._app;
        // auto-discover
        if (typeof pc !== 'undefined' && pc.app) {
            MaterialService._app = pc.app;
            return pc.app;
        }
        return null;
    }

    // ═══════════════════════════════════════════════════════════
    //  STATIC API
    // ═══════════════════════════════════════════════════════════

    /**
     * Завантажує матеріал за іменем. Повертає Promise з resource.
     * Кешує результат — повторний виклик з тим самим ім'ям повертає кеш.
     * 
     * @param {string} materialName — ім'я матеріалу (як в PlayCanvas assets)
     * @returns {Promise<pc.Material>}
     */
    static loadMaterial(materialName) {
        const app = MaterialService._getApp();
        if (!app) return Promise.reject(new Error('MaterialService: app not found'));
        return MaterialService._loadMaterial(materialName);
    }

    /**
     * Завантажує матеріал і застосовує до масиву entities.
     * Автоматично тригерить пов'язані скрипти (TriPlanar, SmartStretch, MeshBoolean).
     * 
     * @param {string} materialName
     * @param {pc.Entity[]} entities 
     * @param {object} [options]
     * @param {boolean} [options.triggerScripts=true] — чи тригерити пов'язані скрипти
     * @returns {Promise<number>} — кількість оновлених entities
     */
    static applyMaterialByName(materialName, entities, options) {
        const app = MaterialService._getApp();
        if (!app) return Promise.reject(new Error('MaterialService: app not found'));
        return MaterialService._applyMaterialByName(materialName, entities, options);
    }

    /**
     * Застосовує вже завантажений матеріал до entity.
     * 
     * @param {pc.Entity} entity
     * @param {pc.Material} material
     * @param {object} [options]
     * @param {boolean} [options.triggerScripts=true]
     * @returns {boolean} — true якщо матеріал було змінено
     */
    static applyToEntity(entity, material, options) {
        return MaterialService._applyToEntity(entity, material, options);
    }

    /**
     * Отримує матеріал з кешу (без завантаження).
     * @param {string} materialName
     * @returns {pc.Material|null}
     */
    static getCached(materialName) {
        return MaterialService._cache.get(materialName) ?? null;
    }

    /**
     * Очищає кеш матеріалів.
     * @param {string} [materialName] — якщо вказано, очищає тільки цей; інакше весь кеш
     */
    static clearCache(materialName) {
        if (materialName) {
            MaterialService._cache.delete(materialName);
        } else {
            MaterialService._cache.clear();
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  INTERNAL STATIC METHODS
    // ═══════════════════════════════════════════════════════════

    /** @private */
    static _loadMaterial(materialName) {
        // 1. Кеш
        if (MaterialService._cache.has(materialName)) {
            return Promise.resolve(MaterialService._cache.get(materialName));
        }

        // 2. Вже йде завантаження — повертаємо той самий Promise
        if (MaterialService._pending.has(materialName)) {
            return MaterialService._pending.get(materialName);
        }

        // 3. Починаємо завантаження
        const promise = MaterialService._doLoadMaterial(materialName);
        MaterialService._pending.set(materialName, promise);

        promise.finally(() => {
            MaterialService._pending.delete(materialName);
        });

        return promise;
    }

    /**
     * Внутрішнє завантаження матеріалу.
     * @private
     */
    static _doLoadMaterial(materialName) {
        return new Promise((resolve, reject) => {
            const app = MaterialService._getApp();
            // UI names can differ in case only ("ROVERE PRUSSIA 255" vs scene "Rovere Prussia 255").
            const matAsset = app.assets.find(materialName, 'material')
                ?? app.assets.filter(a => a.type === 'material' && a.name?.toLowerCase() === String(materialName).trim().toLowerCase())[0];

            if (!matAsset) {
                LoggerService.log(
                    null,
                    `❌ [MaterialService] Material asset not found: "${materialName}"`
                );
                reject(new Error(`Material asset not found: "${materialName}"`));
                return;
            }

            // Якщо ресурс вже завантажений
            if (matAsset.resource) {
                MaterialService._waitForTextures(matAsset.resource, materialName)
                    .then(material => {
                        MaterialService._cache.set(materialName, material);
                        resolve(material);
                    })
                    .catch(reject);
                return;
            }

            // Завантажуємо asset
            app.assets.load(matAsset);

            matAsset.ready((loadedAsset) => {
                const resource = loadedAsset.resource || matAsset.resource;
                if (!resource) {
                    reject(new Error(`Material loaded but resource is null: "${materialName}"`));
                    return;
                }

                MaterialService._waitForTextures(resource, materialName)
                    .then(material => {
                        MaterialService._cache.set(materialName, material);
                        resolve(material);
                    })
                    .catch(reject);
            });

            matAsset.on('error', (err) => {
                LoggerService.log(
                    null,
                    `❌ [MaterialService] Failed to load: "${materialName}"`,
                    err
                );
                reject(err);
            });
        });
    }

    /**
     * Чекає поки текстури матеріалу завантажаться (diffuseMap і т.д.)
     * @private
     */
    static _waitForTextures(materialResource, materialName) {
        return new Promise((resolve) => {
            const diffuseRef = materialResource._assetReferences?.diffuseMap?.asset;

            if (!diffuseRef) {
                // Немає diffuseMap або вже завантажений — повертаємо як є
                resolve(materialResource);
                return;
            }

            if (diffuseRef.resource) {
                // Текстура вже завантажена
                resolve(materialResource);
                return;
            }

            // Чекаємо на завантаження текстури
            diffuseRef.ready(() => {
                resolve(materialResource);
            });
        });
    }

    /**
     * Завантажує і застосовує матеріал до entities.
     * @param {string} materialName
     * @param {pc.Entity[]} entities
     * @param {object} [options]
     * @returns {Promise<number>}
     */
    static async _applyMaterialByName(materialName, entities, options = {}) {
        if (!entities || entities.length === 0) {
            return 0;
        }

        const material = await MaterialService._loadMaterial(materialName);
        let appliedCount = 0;

        entities.forEach(entity => {
            const changed = MaterialService._applyToEntity(entity, material, options);
            if (changed) appliedCount++;
        });

        LoggerService.log(
            null,
            `✅ [MaterialService] Applied "${materialName}"`,
            { appliedCount, totalEntities: entities.length }
        );

        return appliedCount;
    }

    /**
     * Застосовує матеріал до одного entity + тригерить пов'язані скрипти.
     * @param {pc.Entity} entity
     * @param {pc.Material} material
     * @param {object} [options]
     * @returns {boolean}
     */
    static _applyToEntity(entity, material, options = {}) {
        const { triggerScripts = true } = options;
        let changed = false;

        if (MaterialService._isInternalRenderProxy(entity)) {
            return false;
        }

        // Render component
        if (entity.render && entity.render.meshInstances) {
            entity.render.meshInstances.forEach(mi => {
                mi.material = material;
                changed = true;
            });
        }

        // Model component (legacy)
        if (entity.model && entity.model.meshInstances) {
            entity.model.meshInstances.forEach(mi => {
                mi.material = material;
                changed = true;
            });
        }

        // Тригерим пов'язані скрипти
        if (changed && triggerScripts && entity.script) {
            MaterialService._triggerRelatedScripts(entity);
        }

        return changed;
    }

    static _isInternalRenderProxy(entity) {
        return !!entity?._ssaoLocalMaskProxy
            || !!entity?.render?._ssaoLocalMaskProxy
            || !!entity?._ssaoNormalPrepassProxy
            || !!entity?.render?._ssaoNormalPrepassProxy
            || /^__ssao_(local_mask|normal_prepass)_proxy__/i.test(entity?.name || '');
    }

    /**
     * Тригерить пов'язані скрипти після зміни матеріалу.
     * @private
     */
    static _triggerRelatedScripts(entity) {
        // TriPlanarMapping
        if (
            entity.script.triPlanarMapping &&
            typeof entity.script.triPlanarMapping.refreshMaterials === 'function'
        ) {
            entity.script.triPlanarMapping.refreshMaterials();
        }

        // SmartStretch
        if (
            entity.script.smartStretch &&
            typeof entity.script.smartStretch.refreshMaterials === 'function'
        ) {
            entity.script.smartStretch.refreshMaterials();
        }

        // MeshBoolean
        if (
            entity.script.meshBoolean &&
            typeof entity.script.meshBoolean.performBoolean === 'function'
        ) {
            entity.script.meshBoolean.performBoolean();
        }
    }
}
