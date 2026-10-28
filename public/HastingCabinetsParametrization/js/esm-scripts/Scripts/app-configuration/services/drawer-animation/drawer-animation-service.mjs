import { LoggerService } from '../logger/logger-service.mjs';

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
 * @typedef {Object} DrawerMoveConfig
 * @property {number} moveZ - Зміщення по осі Z (в метрах)
 */ /**
 * @typedef {Object} DrawerObjectConfig
 * @property {DrawerMoveConfig} close - Конфігурація закритого стану
 * @property {Object<string, DrawerMoveConfig>} openByDepth - Конфігурація відкритого стану за глибиною
 */ /**
 * @typedef {Object} DrawersOpenCloseConfig
 * @property {string} depthUnit - Одиниця виміру глибини ('cm')
 * @property {Object<string, DrawerObjectConfig>} objects - Конфігурація об'єктів
 */ /**
 * Дефолтний конфіг анімацій шухляд.
 * @type {DrawersOpenCloseConfig}
 */ const DEFAULT_CONFIG = {
    depthUnit: 'cm',
    objects: {
        TopDrawerOpenClose_Point: {
            close: {
                moveZ: 0
            },
            openByDepth: {
                '46': {
                    moveZ: 0.3
                },
                '50.5': {
                    moveZ: 0.335
                }
            }
        },
        BotDrawerOpenClose_Point: {
            close: {
                moveZ: 0
            },
            openByDepth: {
                '46': {
                    moveZ: 0.3
                },
                '50.5': {
                    moveZ: 0.335
                }
            }
        }
    }
};
/**
 * Сервіс для анімації відкриття/закриття шухляд.
 *
 * Анімує *DrawerOpenClose_Point по осі Z.
 * Дівайдери (DividersUni_Point_Clone) є дочірніми елементами OpenClose_Point,
 * тому автоматично рухаються разом — жодної додаткової синхронізації не потрібно.
 *
 * @example
 * const service = new DrawerAnimationService(app);
 * await service.openDrawer('Sink-Base_1', 'Top');
 * await service.closeDrawer('Sink-Base_1', 'Top');
 */ class DrawerAnimationService {
    // ======================== CONFIG ========================
    /**
     * Встановити конфігурацію анімацій шухляд
     * @param {DrawersOpenCloseConfig} config
     */ setConfig(config) {
        this._config = config;
        LoggerService.log(this, `[DrawerAnimation] Config set with ${Object.keys(config?.objects || {}).length} objects`);
    }
    /** @returns {DrawersOpenCloseConfig|null} */ getConfig() {
        return this._config;
    }
    // ======================== PUBLIC API ========================
    /**
     * Відкрити шухляду з анімацією
     * @param {string} cabinetId - ID кабінету (напр. 'Sink-Base_1')
     * @param {string} drawerType - Тип шухляди: 'Top' | 'TopFull' | 'Bot'
     * @returns {Promise<boolean>} true якщо успішно
     */ async openDrawer(cabinetId, drawerType) {
        const stateKey = `${cabinetId}_${drawerType}`;
        if (this._drawerStates.get(stateKey) === 'open') {
            LoggerService.log(this, `[DrawerAnimation] ${stateKey} already open`);
            return true;
        }
        const objectName = this._getObjectName(drawerType);
        if (!objectName) return false;
        const objectConfig = this._config?.objects?.[objectName];
        if (!objectConfig) {
            LoggerService.warn(this, `[DrawerAnimation] No config for object "${objectName}"`);
            return false;
        }
        const depth = this._getCabinetDepth(cabinetId);
        if (depth === null) {
            LoggerService.warn(this, `[DrawerAnimation] Cannot get depth for "${cabinetId}"`);
            return false;
        }
        const moveZ = this._getMoveZForDepth(objectConfig.openByDepth, depth);
        if (moveZ === null) {
            LoggerService.warn(this, `[DrawerAnimation] No moveZ mapping for depth ${depth}`);
            return false;
        }
        const cabinet = this.app.root.findByName(cabinetId);
        if (!cabinet) {
            LoggerService.error(this, `[DrawerAnimation] Cabinet "${cabinetId}" not found`);
            return false;
        }
        const entity = cabinet.findByName(objectName);
        if (!entity) {
            LoggerService.error(this, `[DrawerAnimation] Entity "${objectName}" not found in "${cabinetId}"`);
            return false;
        }
        const posKey = `${cabinetId}_${objectName}`;
        if (!this._originalPositions.has(posKey)) {
            const pos = entity.getLocalPosition();
            this._originalPositions.set(posKey, {
                x: pos.x,
                y: pos.y,
                z: pos.z
            });
        }
        LoggerService.log(this, `[DrawerAnimation] Opening ${stateKey} (depth=${depth}, moveZ=${moveZ})`);
        const origZ = this._originalPositions.get(posKey).z;
        await this._animateZ(entity, posKey, origZ + moveZ);
        this._drawerStates.set(stateKey, 'open');
        return true;
    }
    /**
     * Закрити шухляду з анімацією
     * @param {string} cabinetId - ID кабінету
     * @param {string} drawerType - Тип шухляди: 'Top' | 'TopFull' | 'Bot'
     * @returns {Promise<boolean>} true якщо успішно
     */ async closeDrawer(cabinetId, drawerType) {
        const stateKey = `${cabinetId}_${drawerType}`;
        if (this._drawerStates.get(stateKey) !== 'open') {
            LoggerService.log(this, `[DrawerAnimation] ${stateKey} already closed`);
            return true;
        }
        const objectName = this._getObjectName(drawerType);
        if (!objectName) return false;
        const cabinet = this.app.root.findByName(cabinetId);
        if (!cabinet) return false;
        const entity = cabinet.findByName(objectName);
        if (!entity) return false;
        const posKey = `${cabinetId}_${objectName}`;
        const originalPos = this._originalPositions.get(posKey);
        if (!originalPos) return false;
        LoggerService.log(this, `[DrawerAnimation] Closing ${stateKey}`);
        await this._animateZ(entity, posKey, originalPos.z);
        this._drawerStates.set(stateKey, 'closed');
        this._originalPositions.delete(posKey);
        return true;
    }
    /**
     * Закрити всі відкриті шухляди миттєво (без анімації)
     */ closeAllImmediate() {
        for (const [stateKey, state] of this._drawerStates.entries()){
            if (state !== 'open') continue;
            const [cabinetId, drawerType] = this._parseStateKey(stateKey);
            const objectName = this._getObjectName(drawerType);
            if (!objectName) continue;
            const cabinet = this.app.root.findByName(cabinetId);
            if (!cabinet) continue;
            const entity = cabinet.findByName(objectName);
            if (!entity) continue;
            const posKey = `${cabinetId}_${objectName}`;
            this._cancelAnimation(posKey);
            const originalPos = this._originalPositions.get(posKey);
            if (originalPos) {
                entity.setLocalPosition(originalPos.x, originalPos.y, originalPos.z);
            }
        }
        this._drawerStates.clear();
        this._originalPositions.clear();
        LoggerService.log(this, '[DrawerAnimation] All drawers closed immediately');
    }
    /**
     * Перевірити чи шухляда відкрита
     * @param {string} cabinetId
     * @param {string} drawerType
     * @returns {boolean}
     */ isDrawerOpen(cabinetId, drawerType) {
        return this._drawerStates.get(`${cabinetId}_${drawerType}`) === 'open';
    }
    /**
     * Toggle шухляду (відкрити/закрити)
     * @param {string} cabinetId
     * @param {string} drawerType
     * @returns {Promise<boolean>}
     */ async toggleDrawer(cabinetId, drawerType) {
        if (this.isDrawerOpen(cabinetId, drawerType)) {
            return this.closeDrawer(cabinetId, drawerType);
        } else {
            return this.openDrawer(cabinetId, drawerType);
        }
    }
    // ======================== PRIVATE ========================
    /**
     * Маппінг drawerType → назва scene node (рухома частина)
     * @param {string} drawerType
     * @returns {string|null}
     */ _getObjectName(drawerType) {
        switch(drawerType){
            case 'Top':
            case 'TopFull':
                return 'TopDrawerOpenClose_Point';
            case 'Bot':
                return 'BotDrawerOpenClose_Point';
            default:
                LoggerService.warn(this, `[DrawerAnimation] Unknown drawerType: "${drawerType}"`);
                return null;
        }
    }
    /**
     * Отримати глибину кабінету з конфігурації продукту
     * @param {string} cabinetId
     * @returns {number|null} Глибина в cm
     */ _getCabinetDepth(cabinetId) {
        const compositionManager = this.app.compositionManager;
        if (!compositionManager) return null;
        const composition = compositionManager.getActiveComposition();
        if (!composition) return null;
        const config = composition.getProduct(cabinetId);
        return config?.Depth ?? null;
    }
    /**
     * Знайти moveZ для заданої глибини.
     * Точний збіг → повертаємо; інакше — лінійна інтерполяція між найближчими.
     *
     * @param {Object<string, DrawerMoveConfig>} openByDepth
     * @param {number} depth
     * @returns {number|null}
     */ _getMoveZForDepth(openByDepth, depth) {
        if (!openByDepth) return null;
        const depthStr = String(depth);
        if (openByDepth[depthStr]) return openByDepth[depthStr].moveZ;
        const keys = Object.keys(openByDepth).map(Number).sort((a, b)=>a - b);
        if (keys.length === 0) return null;
        if (depth <= keys[0]) return openByDepth[String(keys[0])].moveZ;
        if (depth >= keys[keys.length - 1]) return openByDepth[String(keys[keys.length - 1])].moveZ;
        let lower = keys[0], upper = keys[keys.length - 1];
        for(let i = 0; i < keys.length - 1; i++){
            if (depth >= keys[i] && depth <= keys[i + 1]) {
                lower = keys[i];
                upper = keys[i + 1];
                break;
            }
        }
        const t = (depth - lower) / (upper - lower);
        return openByDepth[String(lower)].moveZ + t * (openByDepth[String(upper)].moveZ - openByDepth[String(lower)].moveZ);
    }
    /**
     * Анімація по Z з easeInOutCubic
     * @param {object} entity - PlayCanvas entity
     * @param {string} animKey - Ключ для скасування
     * @param {number} targetZ - Цільова Z позиція (local)
     * @returns {Promise<void>}
     */ _animateZ(entity, animKey, targetZ) {
        this._cancelAnimation(animKey);
        return new Promise((resolve)=>{
            const startZ = entity.getLocalPosition().z;
            const deltaZ = targetZ - startZ;
            if (Math.abs(deltaZ) < 0.0001) {
                resolve();
                return;
            }
            const duration = DrawerAnimationService.ANIMATION_DURATION_MS;
            const startTime = performance.now();
            let cancelled = false;
            const tick = ()=>{
                if (cancelled || !entity.parent) {
                    resolve();
                    return;
                }
                const progress = Math.min((performance.now() - startTime) / duration, 1);
                // easeInOutCubic
                const eased = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
                const currentZ = startZ + deltaZ * eased;
                const localPos = entity.getLocalPosition();
                entity.setLocalPosition(localPos.x, localPos.y, currentZ);
                if (progress < 1) {
                    requestAnimationFrame(tick);
                } else {
                    const finalPos = entity.getLocalPosition();
                    entity.setLocalPosition(finalPos.x, finalPos.y, targetZ);
                    this._activeAnimations.delete(animKey);
                    resolve();
                }
            };
            this._activeAnimations.set(animKey, {
                cancel: ()=>{
                    cancelled = true;
                }
            });
            requestAnimationFrame(tick);
        });
    }
    /** Скасувати активну анімацію @param {string} animKey */ _cancelAnimation(animKey) {
        const anim = this._activeAnimations.get(animKey);
        if (anim) {
            anim.cancel();
            this._activeAnimations.delete(animKey);
        }
    }
    /**
     * Розпарсити stateKey у [cabinetId, drawerType]
     * @param {string} key - напр. 'Sink-Base_1_Top'
     * @returns {[string, string]}
     */ _parseStateKey(key) {
        const lastUnderscore = key.lastIndexOf('_');
        return [
            key.substring(0, lastUnderscore),
            key.substring(lastUnderscore + 1)
        ];
    }
    /**
     * @param {object} app - PlayCanvas app instance
     */ constructor(app){
        this.app = app;
        /** @type {DrawersOpenCloseConfig} */ this._config = DEFAULT_CONFIG;
        /** Стан кожної шухляди: 'open' | 'closed' @type {Map<string, string>} */ this._drawerStates = new Map();
        /** Активні анімації (для скасування) @type {Map<string, { cancel: Function }>} */ this._activeAnimations = new Map();
        /** Початкові позиції об'єктів @type {Map<string, {x: number, y: number, z: number}>} */ this._originalPositions = new Map();
    }
}
/** @type {number} Тривалість анімації в мілісекундах */ _define_property(DrawerAnimationService, "ANIMATION_DURATION_MS", 400);

export { DrawerAnimationService };
