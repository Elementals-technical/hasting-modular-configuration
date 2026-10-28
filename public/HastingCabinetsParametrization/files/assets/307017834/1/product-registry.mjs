
/**
 * Product Registry - реєстр продуктів та їх правил
 * 
 * Централізоване місце для конфігурації всіх типів продуктів.
 * В майбутньому можна завантажувати з JSON/API.
 */

import { RuleScaleWidthCabinetUniBox } from '../rules/CabinetUniBox/RuleScaleWidthCabinetUniBox.mjs';
import { RuleScaleDepthCabinetUniBox } from '../rules/CabinetUniBox/RuleScaleDepthCabinetUniBox.mjs';
import { RuleScaleWidthOpenShelves } from '../rules/OpenShelves/RuleScaleWidthOpenShelves.mjs';
import { RuleScaleHeightOpenShelves } from '../rules/OpenShelves/RuleScaleHeightOpenShelves.mjs';
import { RuleScaleDepthOpenShelves } from '../rules/OpenShelves/RuleScaleDepthOpenShelves.mjs';
import { RuleScaleHeightUniSideShelves } from '../rules/UniSideShelves/RuleScaleHeightUniSideShelves.mjs';
import { RuleScaleDepthUniSideShelves } from '../rules/UniSideShelves/RuleScaleDepthUniSideShelves.mjs';
import { RuleChangeCabinetColor } from '../rules/RuleChangeCabinetColor.mjs';
import { RuleScaleHeightCabinetUniBox } from '../rules/CabinetUniBox/RuleScaleHeightCabinetUniBox.mjs';

export class ProductRegistry {
    static _instance = null;

    constructor() {
        // Реєстр конфігурацій продуктів
        this._productConfigs = new Map();

        // Глобальні правила (для всіх продуктів)
        this._globalRules = [];

        // Ініціалізація дефолтних конфігурацій
        this._initializeDefaultConfigs();
    }

    static get instance() {
        if (!ProductRegistry._instance) {
            ProductRegistry._instance = new ProductRegistry();
        }
        return ProductRegistry._instance;
    }

    /**
     * Ініціалізація дефолтних конфігурацій продуктів
     * В майбутньому це може завантажуватись з JSON або API
     */
    _initializeDefaultConfigs() {
        // CabinetUniBox
        this.registerProduct('CabinetUniBox', {
            displayName: 'Universal Box Cabinet',
            category: 'cabinets',
            meshConfig: {
                type: 'single',
                meshes: [
                    { templateName: 'CabinetUniBox', required: true }
                ]
            },
            rules: [
                { rule: RuleScaleWidthCabinetUniBox, priority: 10 },
                // { rule: RuleScaleHeightCabinetUniBox, priority: 10 },
                { rule: RuleScaleDepthCabinetUniBox, priority: 10 }
            ],
            defaultConfig: {
                Width: 40,
                Height: 56,
                Depth: 46, 
            }
        });

        // UniOpenShelves
        this.registerProduct('UniOpenShelves', {
            displayName: 'Universal Open Shelves',
            category: 'shelves',
            meshConfig: {
                type: 'single',
                templateName: 'UniOpenShelves',
                meshes: [
                    { name: 'UniOpenShelves', visible: true, required: true }
                ]
            },
            rules: [
                { rule: RuleScaleWidthOpenShelves, priority: 10 },
                { rule: RuleScaleHeightOpenShelves, priority: 10 },
                { rule: RuleScaleDepthOpenShelves, priority: 10 }
            ],
            defaultConfig: {
                Width: 60,
                Height: 56,
                Depth: 46, 
            }
        });
        // Реєстрація окремих Sinks як під-продуктів
        this.registerProduct('Top_HPLPrisma', {
            displayName: 'HPL Prisma Sink',
            category: 'sinks',
            isSubProduct: true,  // Це під-продукт
            parentAttachPoint: 'SlinkEmptyEntety',  // Точка прикріплення в батьківському entity
            inheritFromParent: ['Width', 'Depth'],  // Наслідувати ці параметри з батьківського продукту
            meshConfig: {
                type: 'single',
                meshes: [
                    { templateName: 'Top_HPLPrisma', required: true }
                ]
            },
            rules: [
                // // Правила для Sink (власні + доступ до батьківської конфігурації)
                // { rule: RuleScaleSinkPrisma, priority: 10 },        // Масштабування по Width/Depth
                // { rule: RulePositionSinkOnTop, priority: 15 },      // Позиціонування на висоті Cabinet
                // { rule: RuleChangeSinkMaterial, priority: 5 },      // Зміна матеріалу
                // { rule: RuleAdaptSinkToParent, priority: 12 }       // Адаптація до розмірів Cabinet
            ],
            defaultConfig: {
                Material: 'HPL_White',
            }
        });
        this.registerProduct('Top_HPLCover', {
            displayName: 'HPL Cover Sink',
            category: 'sinks',
            isSubProduct: true,
            parentAttachPoint: 'SlinkEmptyEntety',
            inheritFromParent: ['Width', 'Depth'],
            meshConfig: {
                type: 'single',
                meshes: [
                    { templateName: 'Top_HPLCover', required: true }
                ]
            },
            rules: [],
            defaultConfig: {

                Material: 'HPL_White',

            }
        });

        // UniOpenSideShelves
        this.registerProduct('UniOpenSideShelves', {
            displayName: 'Universal Side Shelves',
            category: 'shelves',
            meshConfig: {
                type: 'single',
                templateName: 'UniOpenSideShelves',
                meshes: [
                    { name: 'UniOpenSideShelves', visible: true, required: true }
                ]
            },
            rules: [
                { rule: RuleScaleHeightUniSideShelves, priority: 10 },
                { rule: RuleScaleDepthUniSideShelves, priority: 10 }
            ],
            defaultConfig: {
                Width: 30, // Fixed width for side shelves
                Height: 72,
                Depth: 35,
                Color: '#FFFFFF'
            }
        });

        // Sink Base - складний продукт (шафа + вибір умивальника)
        this.registerProduct('SinkBase', {
            displayName: 'Sink Base Cabinet',
            category: 'cabinets',
            meshConfig: {
                type: 'composite',
                meshes: [
                    { templateName: 'CabinetUniBox', required: true }
                ],
                subProducts: [
                    {
                        attachPoint: 'SlinkEmptyEntety',  // Точка в CabinetUniBox
                        productType: null,  // Буде вибрано динамічно
                        required: true,
                        options: ['Top_HPLPrisma', 'Top_HPLQuadra', 'Top_HPLCover', 'Top_HPLStrip'],
                        defaultOption: 'Top_HPLPrisma'
                    }
                ]
            },
            rules: [
                { rule: RuleScaleWidthCabinetUniBox, priority: 10 },
                { rule: RuleScaleHeightCabinetUniBox, priority: 10 },
                { rule: RuleScaleDepthCabinetUniBox, priority: 10 }
            ],
            defaultConfig: {
                Width: 60,
                Height: 72,
                Depth: 60,
                Color: '#FFFFFF',
                sinkType: 'Top_HPLPrisma'  // Дефолтний умивальник
            }
        });

        // ПРИКЛАД: Продукт з multiple meshes (шафа + умивальник)
        // this.registerProduct('CabinetWithSink', {
        //     displayName: 'Cabinet with Sink',
        //     category: 'cabinets',
        //     meshConfig: {
        //         type: 'multiple',
        //         templateName: 'CabinetWithSink',
        //         meshes: [
        //             { name: 'Cabinet', visible: true, required: true },
        //             { name: 'Sink', visible: true, required: true }
        //         ]
        //     },
        //     rules: [...],
        //     defaultConfig: { ... }
        // });

        // ПРИКЛАД: Продукт з composite structure (один template, різні варіанти)
        // this.registerProduct('ModularCabinet', {
        //     displayName: 'Modular Cabinet',
        //     category: 'cabinets',
        //     meshConfig: {
        //         type: 'composite',
        //         templateName: 'ModularCabinet',
        //         meshes: [
        //             { name: 'Frame', visible: true, required: true },
        //             { name: 'Door_Left', visible: true, required: false },
        //             { name: 'Door_Right', visible: true, required: false },
        //             { name: 'Drawer_Top', visible: false, required: false },
        //             { name: 'Drawer_Bottom', visible: false, required: false }
        //         ],
        //         variants: {
        //             'single-door': ['Frame', 'Door_Left'],
        //             'double-door': ['Frame', 'Door_Left', 'Door_Right'],
        //             'with-drawers': ['Frame', 'Drawer_Top', 'Drawer_Bottom']
        //         }
        //     },
        //     rules: [...],
        //     defaultConfig: {
        //         variant: 'double-door',
        //         ...
        //     }
        // });

        // Глобальні правила (для всіх продуктів)
        this.registerGlobalRule(RuleChangeCabinetColor, 5);
    }

    /**
     * Реєструє новий тип продукту
     * @param {string} productType - Тип продукту (префікс назви entity)
     * @param {Object} config - Конфігурація продукту
     * @param {Object} config.meshConfig - Конфігурація mesh структури
     * @param {string} config.meshConfig.type - 'single' | 'multiple' | 'composite'
     * @param {string} config.meshConfig.templateName - Назва template на сцені
     * @param {Array} config.meshConfig.meshes - Список meshes [{name, visible, required}]
     * @param {Object} [config.meshConfig.variants] - Варіанти комбінацій meshes (для composite)
     */
    registerProduct(productType, config) {
        this._productConfigs.set(productType, {
            productType,
            displayName: config.displayName || productType,
            category: config.category || 'default',
            meshConfig: config.meshConfig || {
                type: 'single',
                templateName: productType,
                meshes: [{ name: productType, visible: true, required: true }]
            },
            rules: config.rules || [],
            defaultConfig: config.defaultConfig || {}
        });
    }

    /**
     * Реєструє глобальне правило (застосовується до всіх продуктів)
     * @param {Class} RuleClass - Клас правила
     * @param {number} priority - Пріоритет виконання
     */
    registerGlobalRule(RuleClass, priority = 0) {
        this._globalRules.push({ rule: RuleClass, priority });
    }

    /**
     * Отримує конфігурацію продукту за типом
     * @param {string} productType - Тип продукту
     * @returns {Object|null}
     */
    getProductConfig(productType) {
        return this._productConfigs.get(productType);
    }

    /**
     * Визначає тип продукту за назвою entity
     * @param {string} entityName - Назва entity (наприклад "CabinetUniBox-1")
     * @returns {string|null}
     */
    detectProductType(entityName) {

        // Шукаємо зареєстрований тип, що міститься в назві entity
        for (const productType of this._productConfigs.keys()) {
            if (entityName.includes(productType)) {
                return productType;
            }
        }
        return null;
    }

    /**
     * Отримує всі правила для продукту (специфічні + глобальні)
     * @param {string} productType - Тип продукту
     * @returns {Array<{rule: Class, priority: number}>}
     */
    getRulesForProduct(productType) {
   
        const config = this.getProductConfig(productType);
        if (!config) return [...this._globalRules];

        // Об'єднуємо специфічні правила продукту з глобальними
        const allRules = [
            ...config.rules,
            ...this._globalRules
        ];

        // Сортуємо за пріоритетом
        return allRules.sort((a, b) => b.priority - a.priority);
    }

    /**
     * Отримує дефолтну конфігурацію для продукту
     * @param {string} productType - Тип продукту
     * @returns {Object}
     */
    getDefaultConfig(productType) {
        const config = this.getProductConfig(productType);
        return config ? { ...config.defaultConfig } : {};
    }

    /**
     * Отримує всі зареєстровані типи продуктів
     * @returns {Array<string>}
     */
    getAllProductTypes() {
        return Array.from(this._productConfigs.keys());
    }

    /**
     * Отримує продукти за категорією
     * @param {string} category - Категорія ('cabinets', 'shelves', тощо)
     * @returns {Array<Object>}
     */
    getProductsByCategory(category) {
        const products = [];
        this._productConfigs.forEach((config, productType) => {
            if (config.category === category) {
                products.push(config);
            }
        });
        return products;
    }

    /**
     * Завантажує конфігурацію з JSON (для майбутнього)
     * @param {Object} jsonConfig - JSON конфігурація
     */
    loadFromJSON(jsonConfig) {
        // TODO: Реалізувати завантаження з JSON
        // Це дозволить зовнішнім системам налаштовувати продукти без зміни коду
        console.warn('[ProductRegistry] loadFromJSON not implemented yet');
    }

    /**
         * Отримує mesh конфігурацію для продукту
         * @param {string} productType - Тип продукту
         * @returns {Object|null}
         */
    getMeshConfig(productType) {
        const config = this.getProductConfig(productType);
        return config ? config.meshConfig : null;
    }

    /**
     * Обробляє mesh конфігурацію для клонованого entity
     * @param {Entity} clonedEntity - Клонований entity
     * @param {string} productType - Тип продукту
     * @param {Object} [options] - Додаткові опції
     * @param {string} [options.variant] - Назва варіанту (для composite)
     * @returns {Entity} - Оброблений entity
     */
    processMeshConfig(clonedEntity, productType, options = {}) {
        const meshConfig = this.getMeshConfig(productType);

        if (!meshConfig) {
            console.warn(`[ProductRegistry] No mesh config for "${productType}"`);
            return clonedEntity;
        }

        const { type, meshes, variants } = meshConfig;
        const { variant } = options;

        switch (type) {
            case 'single':
                // Один mesh - нічого не робимо
                break;

            case 'multiple':
                // Декілька окремих meshes - всі видимі
                this._applyMeshVisibility(clonedEntity, meshes);
                break;

            case 'composite':
                // Один template, різні варіанти
                if (variant && variants && variants[variant]) {
                    // Застосовуємо варіант
                    this._applyVariant(clonedEntity, meshes, variants[variant]);
                } else {
                    // Застосовуємо дефолтну видимість
                    this._applyMeshVisibility(clonedEntity, meshes);
                }
                break;

            default:
                console.warn(`[ProductRegistry] Unknown mesh type "${type}"`);
        }

        return clonedEntity;
    }

    /**
     * Застосовує видимість meshes
     * @private
     */
    _applyMeshVisibility(entity, meshes) {
        meshes.forEach(meshDef => {
            const meshEntity = entity.findByName(meshDef.name);
            if (meshEntity) {
                meshEntity.enabled = meshDef.visible;
            } else if (meshDef.required) {
                console.warn(`[ProductRegistry] Required mesh "${meshDef.name}" not found`);
            }
        });
    }

    /**
     * Застосовує варіант (показує тільки вказані meshes)
     * @private
     */
    _applyVariant(entity, allMeshes, visibleMeshNames) {
        allMeshes.forEach(meshDef => {
            const meshEntity = entity.findByName(meshDef.name);
            if (meshEntity) {
                meshEntity.enabled = visibleMeshNames.includes(meshDef.name);
            }
        });
    }

    /**
     * Експортує конфігурацію в JSON (для майбутнього)
     * @returns {Object}
     */
    exportToJSON() {
        const config = {
            products: {},
            globalRules: this._globalRules.map(r => ({
                ruleName: r.rule.name,
                priority: r.priority
            }))
        };

        this._productConfigs.forEach((productConfig, productType) => {
            config.products[productType] = {
                displayName: productConfig.displayName,
                category: productConfig.category,
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
