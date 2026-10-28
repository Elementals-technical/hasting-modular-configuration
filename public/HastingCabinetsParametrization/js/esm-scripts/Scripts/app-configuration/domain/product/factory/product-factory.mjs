import { Entity, Color, StandardMaterial, app } from '../../../../../../playcanvas-stable.min.mjs';
import { ProductRegistry_V2 } from '../registry/product-registry-v2.mjs';

class ProductFactory {
    /**
   * Створює готовий до використання продукт.
   * @param {string} productType - Тип продукту
   * @param {object} [config={}] - Початкова конфігурація
   * @returns {Promise<pc.Entity>} Готова сутність (ще не додана на сцену)
   */ async createProductEntity(productType, config = {}, context = {}) {
        const preview = context.purpose === 'preview';
        if (preview && (typeof context.productId !== 'string' || !context.productId)) {
            throw Object.assign(new Error('Preview requires an owned product ID'), {
                code: 'INVALID_PREVIEW_CONTEXT'
            });
        }
        if (preview && context.signal?.aborted) {
            throw Object.assign(new Error('Preview cancelled'), {
                code: 'CANCELLED'
            });
        }
        // 1. Отримуємо дефолтну конфігурацію та мержимо з переданою
        const defaultConfig = this.registry.getDefaultConfig(productType);
        const finalConfig = {
            ...defaultConfig,
            ...config
        };
        // 2. Створюємо entity з meshes через ProductRegistry
        let entity = await this.registry.createEntityFromMeshes(productType, finalConfig, this.app, context);
        if (preview && context.signal?.aborted) {
            entity?.destroy();
            throw Object.assign(new Error('Preview cancelled'), {
                code: 'CANCELLED'
            });
        }
        // 3. Фолбек (якщо не вдалося створити)
        if (!entity) {
            if (preview) {
                throw Object.assign(new Error(`Preview model unavailable: ${productType}`), {
                    code: 'PREVIEW_MODEL_UNAVAILABLE'
                });
            }
            console.error(`🏭 [ProductFactory] Failed to create entity for product type '${productType}'. Using placeholder.`);
            entity = this._createPlaceholder();
        }
        const id = preview ? context.productId : `${productType}-${Math.random().toString(36).substr(2, 9)}`;
        entity.name = id;
        // Detached previews are configured explicitly; committed controllers must not run.
        if (preview) {
            entity.enabled = false;
            return entity;
        }
        // 4. Гарантуємо наявність контролера на root entity
        if (!entity.script || !entity.script.has("productController")) {
            if (!entity.script) entity.addComponent("script");
            entity.script.create("productController");
        }
        return entity;
    }
    removeProduct(id) {
        const entity = this.app.root.findByName(id);
        if (!entity) {
            console.warn(`[ProductFactory] Entity '${id}' not found on scene.`);
            return;
        }
        this.app?.selectTool.setSelected(entity, {
            mode: "remove"
        });
        entity.destroy();
        return entity;
    }
    /**
   * @private
   */ _createPlaceholder() {
        const entity = new Entity();
        entity.addComponent("model", {
            type: "box"
        });
        entity.setLocalScale(0.6, 0.6, 0.6);
        entity.setPosition(0, 0, 0);
        const randomR = Math.random();
        const randomG = Math.random();
        const randomB = Math.random();
        const randomColor = new Color(randomR, randomG, randomB);
        const material = new StandardMaterial();
        material.diffuse = randomColor;
        material.update();
        const meshInstances = entity.model.meshInstances;
        if (meshInstances && meshInstances.length > 0) {
            meshInstances[0].material = material;
        }
        return entity;
    }
    constructor({ app: app$1 = app, registry = ProductRegistry_V2.instance } = {}){
        this.app = app$1;
        this.registry = registry;
    }
}

export { ProductFactory };
