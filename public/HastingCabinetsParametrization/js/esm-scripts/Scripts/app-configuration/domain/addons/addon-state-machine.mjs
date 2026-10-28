import { LoggerService } from '../../services/logger/logger-service.mjs';
import { ProductFactory } from '../product/factory/product-factory.mjs';
import { ProductRegistry_V2 } from '../product/registry/product-registry-v2.mjs';

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
/**
 * Базовий клас State Machine для Addon продуктів.
 *
 * Стани: IDLE → CREATING → ACTIVE → UPDATING → REMOVING → IDLE
 *
 * Забезпечує:
 * - Уніфікований lifecycle для всіх addons (SidePanel, TowelBar, ...)
 * - Per-side state management (left/right незалежні)
 * - Race condition protection (transition guards)
 * - Persistence глобального типу (відновлення після re-add кабінетів)
 *
 * Використання:
 *   class MyAddon extends AddonStateMachine {
 *       constructor(app, cm) {
 *           super(app, cm, { name: 'MyAddon', products: ['MyAddon_Left', 'MyAddon_Right'] });
 *       }
 *       buildConfig(side, type, composition) { return { ... }; }
 *   }
 */ class AddonStateMachine {
    // ====== PUBLIC API ======
    /**
     * Встановити тип addon
     * @param {string} type - Тип ('None' для видалення, або конкретний тип)
     * @param {string} [side='both'] - 'left' | 'right' | 'both'
     * @returns {Promise<boolean>}
     */ async setType(type, side = 'both') {
        this.cm?.getActiveComposition?.()?.assertMutable?.();
        if (!this._validateType(type)) return false;
        const sides = side === 'both' ? Object.keys(this._sides) : [
            side
        ];
        for (const s of sides){
            if (!this._sides[s]) {
                LoggerService.warn(this, `[${this.name}] Unknown side: "${s}"`);
                continue;
            }
            await this._transition(s, type);
        }
        // Trigger composition rules (await гарантує завершення перед наступним API викликом)
        await this.cm.aggregator.onCompositionStructureChanged(this.cm._activeCompositionId, this.cm.getAllCompositions());
        return true;
    }
    /**
     * Забезпечити існування addons (викликається при додаванні кабінету)
     * @param {object} composition
     */ async ensureExists(composition) {
        composition?.assertMutable?.();
        if (!this._hasDependency()) return;
        for (const [side, sideState] of Object.entries(this._sides)){
            if (sideState.type && sideState.type !== 'None' && sideState.state === AddonStateMachine.STATES.IDLE) {
                await this._transition(side, sideState.type);
            }
        }
    }
    /**
     * Видалити всі addons (викликається при видаленні останнього кабінету)
     * @param {object} composition
     */ removeAll(composition) {
        composition?.assertMutable?.();
        for (const [side, sideState] of Object.entries(this._sides)){
            if (sideState.state === AddonStateMachine.STATES.ACTIVE) {
                this._removeSync(side, sideState, composition);
                this._setState(side, AddonStateMachine.STATES.IDLE);
                sideState.entityName = null;
            }
        }
    }
    /**
     * Отримати стан сторони
     * @param {string} side
     * @returns {{ state: string, type: string|null, entityName: string|null }}
     */ getState(side) {
        return this._sides[side] ? {
            ...this._sides[side]
        } : null;
    }
    /**
     * Отримати глобальні типи
     * @returns {object} { left: string|null, right: string|null }
     */ getGlobalTypes() {
        const result = {};
        for (const [side, sideState] of Object.entries(this._sides)){
            result[side] = sideState.type;
        }
        return result;
    }
    /**
     * Rebuild runtime ownership from products already restored into a composition.
     * This changes only state-machine bookkeeping; restored products and entities
     * keep their existing IDs and are not recreated.
     * @param {object} composition
     * @returns {object} state by side
     */ rehydrate(composition) {
        const nextSides = Object.fromEntries(Object.entries(this._sides).map(([side, current])=>[
                side,
                {
                    ...current,
                    state: AddonStateMachine.STATES.IDLE,
                    type: null,
                    entityName: null
                }
            ]));
        const typeKey = this._getTypeKey();
        const requestedTypeKey = `${this.name}RequestedType`;
        const products = composition?.getAllProducts?.() ?? {};
        for (const [productId, snapshot] of Object.entries(products)){
            const config = typeof snapshot?.getAll === 'function' ? snapshot.getAll() : snapshot;
            if (!config || config.category !== this.category) continue;
            if (!Object.hasOwn(config, typeKey) && !Object.hasOwn(config, requestedTypeKey)) continue;
            const side = config.side || this._extractSide(config.productType || '');
            if (!nextSides[side]) continue;
            if (nextSides[side].entityName) {
                throw Object.assign(new Error(`[${this.name}] Multiple restored products for side "${side}"`), {
                    code: 'ADDON_REHYDRATE_DUPLICATE',
                    addon: this.name,
                    side
                });
            }
            const type = config[requestedTypeKey] ?? config[typeKey];
            if (typeof type !== 'string' || !type) {
                throw Object.assign(new Error(`[${this.name}] Restored product "${productId}" has no valid type`), {
                    code: 'ADDON_REHYDRATE_INVALID',
                    addon: this.name,
                    side,
                    productId
                });
            }
            nextSides[side] = {
                ...nextSides[side],
                state: AddonStateMachine.STATES.ACTIVE,
                type,
                entityName: productId
            };
        }
        this._sides = nextSides;
        LoggerService.log(this, `[${this.name}] Rehydrated addon state from composition`);
        return Object.fromEntries(Object.entries(this._sides).map(([side, state])=>[
                side,
                {
                    ...state
                }
            ]));
    }
    /**
     * Встановити глобальні типи (для відновлення стану)
     */ setGlobalTypes(types) {
        this.cm?.getActiveComposition?.()?.assertMutable?.();
        for (const [side, type] of Object.entries(types)){
            if (this._sides[side]) {
                this._sides[side].type = type;
            }
        }
    }
    // ====== STATE TRANSITIONS ======
    /**
     * @private
     */ async _transition(side, type) {
        this.cm?.getActiveComposition?.()?.assertMutable?.();
        const current = this._sides[side];
        // Guard: не дозволяємо transition під час creating/removing
        if (current.state === AddonStateMachine.STATES.CREATING || current.state === AddonStateMachine.STATES.REMOVING) {
            LoggerService.warn(this, `[${this.name}] ${side}: transition blocked (state=${current.state})`);
            return;
        }
        if (type === 'None') {
            // → REMOVING → IDLE
            current.type = type;
            if (current.state === AddonStateMachine.STATES.ACTIVE || current.state === AddonStateMachine.STATES.UPDATING) {
                this._setState(side, AddonStateMachine.STATES.REMOVING);
                try {
                    await this._onRemove(side, current);
                } catch (error) {
                    LoggerService.error(this, `[${this.name}] ${side}: _onRemove failed`, error);
                } finally{
                    current.entityName = null;
                    current.type = null;
                    this._setState(side, AddonStateMachine.STATES.IDLE);
                }
            } else {
                current.type = null;
            }
            return;
        }
        if (current.state === AddonStateMachine.STATES.IDLE) {
            // IDLE → CREATING → ACTIVE
            if (!this._hasDependency()) {
                current.type = type; // Зберігаємо для persistence
                return;
            }
            current.type = type;
            this._setState(side, AddonStateMachine.STATES.CREATING);
            try {
                const entityName = await this._onCreate(side, type);
                current.entityName = entityName;
                this._setState(side, AddonStateMachine.STATES.ACTIVE);
            } catch (error) {
                LoggerService.error(this, `[${this.name}] ${side}: _onCreate failed, rolling back to IDLE`, error);
                current.type = null;
                current.entityName = null;
                this._setState(side, AddonStateMachine.STATES.IDLE);
            }
        } else if (current.state === AddonStateMachine.STATES.ACTIVE) {
            // ACTIVE → UPDATING → ACTIVE
            const previousType = current.type;
            current.type = type;
            this._setState(side, AddonStateMachine.STATES.UPDATING);
            try {
                await this._onUpdate(side, type, current);
                this._setState(side, AddonStateMachine.STATES.ACTIVE);
            } catch (error) {
                LoggerService.error(this, `[${this.name}] ${side}: _onUpdate failed, reverting to previous type`, error);
                current.type = previousType;
                this._setState(side, AddonStateMachine.STATES.ACTIVE);
            }
        }
    }
    /**
     * @private
     */ _setState(side, newState) {
        const old = this._sides[side].state;
        this._sides[side].state = newState;
        LoggerService.log(this, `[${this.name}] ${side}: ${old} → ${newState}`);
    }
    // ====== LIFECYCLE HOOKS (override в дочірніх) ======
    /**
     * Створити addon entity. Override в дочірньому класі для custom config.
     * @param {string} side
     * @param {string} type
     * @returns {Promise<string>} entityName
     */ async _onCreate(side, type) {
        const productType = this._resolveProductType(side, type);
        const composition = this.cm.getActiveComposition();
        composition?.assertMutable?.();
        const entity = await new ProductFactory().createProductEntity(productType);
        if (!entity) {
            LoggerService.error(this, `[${this.name}] Failed to create ${productType}`);
            return null;
        }
        this.app.root.addChild(entity);
        const config = this.buildConfig(side, type, composition);
        config.entityName = entity.name;
        config.productType = productType;
        config.category = this.category;
        config.side = side;
        composition.addProduct(entity.name, config);
        try {
            await this.cm._executeProductRules(entity, config);
        } catch (error) {
            // Cleanup: прибираємо частково створений entity
            composition.removeProduct(entity.name);
            entity.destroy();
            throw error; // re-throw для _transition catch
        }
        LoggerService.log(this, `[${this.name}] Created ${productType} (${type}) as ${entity.name}`);
        return entity.name;
    }
    /**
     * Оновити існуючий addon. Override для custom update logic.
     * @param {string} side
     * @param {string} type
     * @param {object} current - sideState
     */ async _onUpdate(side, type, current) {
        const typeKey = this._getTypeKey();
        await this.cm.updateProductConfig(current.entityName, {
            [typeKey]: type
        });
        LoggerService.log(this, `[${this.name}] Updated ${current.entityName} to ${type}`);
    }
    /**
     * Видалити addon entity. Override для custom cleanup.
     * @param {string} side
     * @param {object} current - sideState
     */ async _onRemove(side, current) {
        this._removeSync(side, current, this.cm.getActiveComposition());
    }
    /**
     * Синхронне видалення (для removeAll без async)
     * @private
     */ _removeSync(side, current, composition) {
        composition?.assertMutable?.();
        if (!current.entityName) return;
        const entity = this.app.root.findByName(current.entityName);
        if (entity) {
            if (composition) composition.removeProduct(current.entityName);
            entity.destroy();
            LoggerService.log(this, `[${this.name}] Removed ${current.entityName}`);
        }
    }
    /**
     * Побудувати config для нового addon entity.
     * ОБОВ'ЯЗКОВО override в дочірньому класі.
     * @param {string} side
     * @param {string} type
     * @param {object} composition
     * @returns {object} config для addProduct
     */ buildConfig(side, type, composition) {
        const typeKey = this._getTypeKey();
        return {
            [typeKey]: type
        };
    }
    // ====== HELPERS ======
    /**
     * Resolve the concrete registered product for this addon instance.
     * Collection-aware addons may override this while preserving the public state-machine API.
     */ _resolveProductType(side, type) {
        return this._sides[side]?.productType || null;
    }
    /**
     * Перевірити чи є залежність (кабінети існують)
     * @returns {boolean}
     */ _hasDependency() {
        return this.cm.getProductEntitiesByCategory(this.dependsOn).length > 0;
    }
    /**
     * Валідація типу через ProductRegistry
     * @param {string} type
     * @returns {boolean}
     */ _validateType(type) {
        if (type === 'None') return true;
        const firstProduct = this.products[0];
        const registry = ProductRegistry_V2.instance;
        const config = registry.getProductConfig(firstProduct);
        const validTypes = config?.meshConfig?.variants?.map((v)=>v.key) || [];
        if (!validTypes.includes(type)) {
            LoggerService.error(this, `[${this.name}] Invalid type "${type}". Valid: ${validTypes.join(', ')}`);
            return false;
        }
        return true;
    }
    /**
     * Отримати ключ типу для config (напр. 'SidePanelType', 'TowelBarType')
     * @returns {string}
     */ _getTypeKey() {
        return `${this.name}Type`;
    }
    /**
     * Витягнути сторону з productType
     * @param {string} productType - 'SidePanel_Left' → 'left'
     * @returns {string}
     */ _extractSide(productType) {
        if (productType.includes('Left')) return 'left';
        if (productType.includes('Right')) return 'right';
        return 'default';
    }
    /**
     * Отримати reference кабінет для сторони
     * @param {string} side
     * @returns {object|null} cabinet config
     */ _getReferenceCabinet(side) {
        const { leftCabinetId, rightCabinetId } = this.cm.getEdgeCabinets();
        const id = side === 'left' ? leftCabinetId : rightCabinetId;
        return this.cm.getActiveComposition()?.getProduct(id);
    }
    /**
     * @param {object} app - PlayCanvas app instance
     * @param {object} compositionManager - CompositionManager instance
     * @param {object} config
     * @param {string} config.name - Назва addon ('SidePanel', 'TowelBar')
     * @param {string[]} config.products - Product types (['SidePanel_Left', 'SidePanel_Right'])
     * @param {string} [config.category='addons'] - Категорія в store
     * @param {string} [config.dependsOn='cabinets'] - Категорія залежності
     */ constructor(app, compositionManager, config){
        this.app = app;
        this.cm = compositionManager;
        this.name = config.name;
        this.products = config.products;
        this.category = config.category || 'addons';
        this.dependsOn = config.dependsOn || 'cabinets';
        // State per side
        this._sides = {};
        for (const productType of this.products){
            const side = this._extractSide(productType);
            this._sides[side] = {
                state: AddonStateMachine.STATES.IDLE,
                type: null,
                entityName: null,
                productType: productType
            };
        }
        LoggerService.log(this, `[${this.name}] State Machine initialized (sides: ${Object.keys(this._sides).join(', ')})`);
    }
}
_define_property(AddonStateMachine, "STATES", {
    IDLE: 'idle',
    CREATING: 'creating',
    ACTIVE: 'active',
    UPDATING: 'updating',
    REMOVING: 'removing'
});

export { AddonStateMachine };
