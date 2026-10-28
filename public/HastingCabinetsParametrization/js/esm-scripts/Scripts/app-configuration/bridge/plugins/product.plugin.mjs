import { LoggerService } from '../../services/logger/logger-service.mjs';
import { ProductConfigPlugin } from './product-config.plugin.mjs';

/**
 * Product CRUD Plugin для ConfiguratorAPI.
 *
 * Інкапсулює операції додавання, видалення, swap та preset продуктів.
 * Методи доступні через ConfiguratorAPI.*
 */ class ProductPlugin {
    /**
   * @param {{ app: object, bridge: object }} ctx
   * @returns {object}
   */ static create(ctx) {
        const { app, bridge } = ctx;
        /** Helper: повертає SceneManager або кидає помилку */ const _sm = ()=>{
            if (!app.sceneManager) {
                throw new Error("SceneManager is not initialized yet!");
            }
            return app.sceneManager;
        };
        /**
     * Re-sync triplanar uniforms на всіх cabinet+countertop entities.
     * Викликається після кожної структурної операції (add/remove/swap/preset),
     * щоб compose-cascade не залишив tri_rotation/tri_scale десинхронізованими
     * на shared material clones. Див. product-config.plugin.mjs для деталей.
     */ const _resyncTriplanarAfterStructureChange = ()=>{
            ProductConfigPlugin._resyncAllTriplanarUniforms(app.compositionManager);
        };
        return {
            /**
       * Додати продукт справа (за замовчуванням)
       * @param {string} type - Тип продукту
       * @param {object} [config] - Початкова конфігурація
       * @returns {Promise<string>} ID створеного продукту
       */ addProduct: async (type, config)=>{
                LoggerService.log(bridge, `[API] addProduct`, {
                    type,
                    config
                });
                const modular = bridge._cabinetRuntimePlugin?.compatibility;
                // A collection-driven runtime claims/releases the composition for this product first.
                await modular?.prepare?.('add', [
                    type
                ]);
                if (modular?.active) return modular.addProduct(type, config);
                const productId = await _sm().addProductByParams(type, null, "right", config);
                _sm().updateButtonsPositions();
                _resyncTriplanarAfterStructureChange();
                return productId;
            },
            /**
       * Preset продуктів
       * @param {Array<{name: string, ...config}>} data - Масив продуктів
       * @param {object} [globalConfig] - Глобальна конфігурація
       * @returns {Promise<string[]>} Масив ID створених продуктів
       */ presetProducts: async (data, globalConfig = null)=>{
                LoggerService.log(bridge, `[API] presetProducts`, {
                    count: data?.length,
                    data,
                    globalConfig
                });
                const modular = bridge._cabinetRuntimePlugin?.compatibility;
                // A preset replaces the composition: its products decide modular vs legacy ownership.
                await modular?.prepare?.('replace', Array.isArray(data) ? data.map((item)=>item?.name) : []);
                if (modular?.active) return modular.presetProducts(data, globalConfig);
                const dataPreset = await _sm().presetProducts(data, globalConfig);
                _sm().updateButtonsPositions();
                _resyncTriplanarAfterStructureChange();
                return dataPreset;
            },
            /**
       * Додати продукт зліва
       * @param {string} type - Тип продукту
       * @param {object} [config={}] - Початкова конфігурація
       * @returns {Promise<string>} ID створеного продукту
       */ addProductByLeft: async (type, config = {})=>{
                LoggerService.log(bridge, `[API] addProductByLeft`, {
                    type,
                    config
                });
                await bridge._cabinetRuntimePlugin?.compatibility?.prepare?.('add', [
                    type
                ]);
                const productId = await _sm().addProductByLeft(type, config);
                _sm().updateButtonsPositions();
                _resyncTriplanarAfterStructureChange();
                return productId;
            },
            /**
       * Додати продукт справа
       * @param {string} type - Тип продукту
       * @param {object} [config={}] - Початкова конфігурація
       * @returns {Promise<string>} ID створеного продукту
       */ addProductByRight: async (type, config = {})=>{
                LoggerService.log(bridge, `[API] addProductByRight`, {
                    type,
                    config
                });
                await bridge._cabinetRuntimePlugin?.compatibility?.prepare?.('add', [
                    type
                ]);
                const productId = await _sm().addProductByRight(type, config);
                _sm().updateButtonsPositions();
                _resyncTriplanarAfterStructureChange();
                return productId;
            },
            /**
       * Видалити всі продукти
       */ removeAllProduct: async ()=>{
                LoggerService.log(bridge, `[API] removeAllProduct`);
                await _sm().removeAllProducts();
                _resyncTriplanarAfterStructureChange();
            },
            /**
       * Видалити продукт за ID
       * @param {string} id - ID продукту
       */ removeProduct: (id)=>{
                LoggerService.log(bridge, `[API] removeProduct`, {
                    id
                });
                const result = _sm().removeProduct(id);
                if (result === null) {
                    return null;
                }
                _resyncTriplanarAfterStructureChange();
            },
            /**
       * Поміняти місцями два продукти
       * @param {string} idA
       * @param {string} idB
       */ swapProducts: (idA, idB)=>{
                LoggerService.log(bridge, `[API] swapProducts`, {
                    idA,
                    idB
                });
                _sm().swapProducts(idA, idB);
                _resyncTriplanarAfterStructureChange();
            },
            /**
       * Додати продукт з повними параметрами позиціювання
       * @param {string} type - Тип продукту
       * @param {string|null} prevEntityId - ID попереднього entity
       * @param {string} side - 'left' або 'right'
       * @param {object} [initialConfig] - Початкова конфігурація
       * @returns {Promise<string>} ID створеного продукту
       */ setProductByParams: async (type, prevEntityId, side, initialConfig = {})=>{
                LoggerService.log(bridge, `[API] setProductByParams`, {
                    type,
                    prevEntityId,
                    side,
                    initialConfig
                });
                await bridge._cabinetRuntimePlugin?.compatibility?.prepare?.('add', [
                    type
                ]);
                const productId = await _sm().addProductByParams(type, prevEntityId, side, initialConfig);
                _sm().updateButtonsPositions();
                _resyncTriplanarAfterStructureChange();
                return productId;
            },
            /**
       * Отримує інформацію про крайні шафи (ліва та права)
       * @returns {object} { leftCabinetId, rightCabinetId }
       */ getEdgeCabinets: ()=>{
                const compositionManager = app.compositionManager;
                if (!compositionManager) {
                    LoggerService.warn(bridge, '[Bridge] CompositionManager not available');
                    return {
                        leftCabinetId: null,
                        rightCabinetId: null
                    };
                }
                return compositionManager.getEdgeCabinets();
            }
        };
    }
}

export { ProductPlugin };
