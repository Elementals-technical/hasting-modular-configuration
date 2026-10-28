import { LoggerService } from '../../services/logger/logger-service.mjs';
import { AddonStateMachine } from './addon-state-machine.mjs';

/**
 * TowelBar Addon — State Machine для тримачів рушників.
 *
 * Особливості:
 * - Окремий колір (TowelBarColor), незалежний від CabinetColor
 * - Позиціювання через composition rule RuleTowelBars (враховує SidePanel AABB)
 * - Rotation: left → 180°, right → 0° (через composition rule)
 */
export class TowelBarAddon extends AddonStateMachine {
    constructor(app, compositionManager) {
        super(app, compositionManager, {
            name: 'TowelBar',
            products: ['TowelBar_Left', 'TowelBar_Right']
        });

        // Глобальний колір (незалежний від CabinetColor)
        this._globalColor = null;
    }

    // ====== OVERRIDE: buildConfig ======

    /**
     * Config для TowelBar entity
     */
    buildConfig(side, type, composition) {
        const refCabinet = this._getReferenceCabinet(side);

        const config = {
            TowelBarType: type,
            Height: refCabinet?.Height || 56,
        };

        if (this._globalColor) {
            config.TowelBarColor = this._globalColor;
        }

        return config;
    }

    // ====== UNIQUE: Color ======

    /**
     * Встановити колір для всіх TowelBars
     * @param {string} materialName
     */
    async setColor(materialName) {
        this.cm?.getActiveComposition?.()?.assertMutable?.();
        this._globalColor = materialName;

        // Оновити існуючі bars
        for (const [side, sideState] of Object.entries(this._sides)) {
            if (sideState.state === AddonStateMachine.STATES.ACTIVE && sideState.entityName) {
                await this.cm.updateProductConfig(sideState.entityName, {
                    TowelBarColor: materialName
                });
            }
        }

        LoggerService.log(this, `[TowelBar] Color set to "${materialName}"`);
    }

    /**
     * Отримати глобальний колір
     * @returns {string|null}
     */
    getColor() {
        return this._globalColor;
    }

    /**
     * Скинути глобальний колір (для reset)
     */
    resetColor() {
        this.cm?.getActiveComposition?.()?.assertMutable?.();
        this._globalColor = null;
    }
}
