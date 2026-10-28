import { LoggerService } from '../../services/logger/logger-service.mjs';
import { SidePanelAddon } from './side-panel-addon.mjs';
import { TowelBarAddon } from './towel-bar-addon.mjs';

/**
 * AddonManager — проміжний шар для управління всіма addon state machines.
 *
 * Відповідає за:
 * - Ініціалізацію та реєстрацію addon state machines
 * - Unified lifecycle (ensureAll, removeAll)
 * - Доступ до конкретних addons по імені
 *
 * CompositionManager делегує addon-логіку сюди замість inline коду.
 */ class AddonManager {
    // ====== РЕЄСТРАЦІЯ ======
    /**
     * Зареєструвати addon
     * @param {AddonStateMachine} addon
     */ register(addon) {
        this._addons.set(addon.name, addon);
    }
    /**
     * Отримати addon по імені
     * @param {string} name - 'SidePanel', 'TowelBar', ...
     * @returns {AddonStateMachine|null}
     */ get(name) {
        return this._addons.get(name) || null;
    }
    /**
     * Список зареєстрованих addons
     * @returns {string[]}
     */ list() {
        return [
            ...this._addons.keys()
        ];
    }
    /**
     * Ітерувати по всіх addons
     * @returns {IterableIterator<AddonStateMachine>}
     */ all() {
        return this._addons.values();
    }
    // ====== LIFECYCLE ======
    /**
     * Забезпечити існування всіх addons (при додаванні кабінету)
     * @param {object} composition
     */ async ensureAll(composition) {
        for (const addon of this._addons.values()){
            await addon.ensureExists(composition);
        }
    }
    /**
     * Видалити всі addons (при видаленні останнього кабінету)
     * @param {object} composition
     */ removeAll(composition) {
        for (const addon of this._addons.values()){
            addon.removeAll(composition);
        }
    }
    /**
     * Rebuild every addon machine after composition products/entities are restored.
     * @param {object} [composition]
     * @returns {object} state by addon name
     */ rehydrateAll(composition = this.cm.getActiveComposition()) {
        return Object.fromEntries([
            ...this._addons
        ].map(([name, addon])=>[
                name,
                addon.rehydrate(composition)
            ]));
    }
    /**
     * Скинути глобальний стан всіх addons (для тестів)
     */ resetAll() {
        for (const addon of this._addons.values()){
            addon.setGlobalTypes({
                left: null,
                right: null
            });
        }
    }
    // ====== SHORTCUTS ======
    /** @returns {SidePanelAddon} */ get sidePanel() {
        return this._addons.get('SidePanel');
    }
    /** @returns {TowelBarAddon} */ get towelBar() {
        return this._addons.get('TowelBar');
    }
    /**
     * @param {object} app - PlayCanvas app instance
     * @param {object} compositionManager - CompositionManager instance
     */ constructor(app, compositionManager){
        this.app = app;
        this.cm = compositionManager;
        // Реєстр addon state machines
        this._addons = new Map();
        // Ініціалізація стандартних addons
        this.register(new SidePanelAddon(app, compositionManager));
        this.register(new TowelBarAddon(app, compositionManager));
        LoggerService.log(this, `[AddonManager] Initialized with ${this._addons.size} addons: ${this.list().join(', ')}`);
    }
}

export { AddonManager };
