import { Vec3 } from '../../../../playcanvas-stable.min.mjs';
import { LoggerService } from '../services/logger/logger-service.mjs';

// scene-transform-helper.mjs
/**
 * Універсальний helper для роботи зі сценовими трансформаціями.
 *
 * На цьому етапі реалізовано :
 *  - getStretch(entity): повертає поточний stretch { x, y, z }
 *  - setStretch(entity, stretchXYZ): частково/повністю оновлює stretch
 *

 *  - getPosition / setPosition
 *  - getScale / setScale
 *  - getVisible / setVisible
 *  - тощо
 */ class SceneTransformHelper {
    // ===================== STRETCH =====================
    /**
     * Get the current stretch for the entity.
     *
     * @param {pc.Entity} entity
     * @returns {{ x: number, y: number, z: number } | null}
     */ static getStretch(entity) {
        if (!entity) {
            LoggerService.log(this, "[SceneTransformHelper.getStretch] entity is null/undefined");
            return null;
        }
        const smartStretch = entity.script && entity.script.smartStretch;
        if (!smartStretch) {
            LoggerService.log(this, "[Stretch] entity has no smartStretch script :", {
                entityName: entity.name
            });
            return null;
        }
        const vec = smartStretch.stretchAmount || new Vec3(0, 0, 0);
        return {
            x: vec.x,
            y: vec.y,
            z: vec.z
        };
    }
    /**
     * Встановити/оновити stretch для entity.
     *
     * Приклад:
     *   SceneTransformHelper.setStretch(entity, { x: 0.1 });
     *   SceneTransformHelper.setStretch(entity, { y: -0.02, z: 0.05 });
     *
     * Якщо якесь поле не передано (x/y/z), воно НЕ змінюється.
     *
     * @param {pc.Entity} entity
     * @param {{ x?: number, y?: number, z?: number }} stretchXYZ
     * @returns {{ x: number, y: number, z: number } | null} - нові значення stretch, або null при помилці
     */ static setStretch(entity, stretchXYZ) {
        if (!entity) {
            LoggerService.log(this, "[SceneTransformHelper.setStretch] entity is null/undefined");
            return null;
        }
        const smartStretch = entity.script && entity.script.smartStretch;
        if (entity.name === "TopSolid") ;
        if (!smartStretch) {
            LoggerService.log(this, "[SceneTransformHelper.setStretch] entity has no smartStretch script", {
                entityName: entity.name
            });
            return null;
        }
        const current = smartStretch.stretchAmount || new Vec3(0, 0, 0);
        const next = new Vec3(stretchXYZ.x !== undefined ? stretchXYZ.x : current.x, stretchXYZ.y !== undefined ? stretchXYZ.y : current.y, stretchXYZ.z !== undefined ? stretchXYZ.z : current.z);
        smartStretch.stretchAmount = next;
        // Rebuild MeshBoolean after stretch settles. requestBoolean() coalesces
        // repeated interactive updates and performs the final CSG after frame sync.
        if (entity.script?.meshBoolean && typeof entity.script.meshBoolean.performBoolean === 'function') {
            const mb = entity.script.meshBoolean;
            if (typeof mb.requestBoolean === 'function') {
                mb.requestBoolean({
                    skipWhenNoActiveCutters: true
                });
            } else {
                requestAnimationFrame(()=>{
                    requestAnimationFrame(()=>{
                        const hasActiveCutters = mb._cutters?.some((c)=>c && (!c.parent || c.parent.enabled));
                        if (hasActiveCutters) {
                            mb.performBoolean();
                        }
                    });
                });
            }
        }
        return {
            x: next.x,
            y: next.y,
            z: next.z
        };
    }
    // ===================== POSITION =====================
    /**
     * Отримати поточну локальну позицію entity.
     *
     * @param {pc.Entity} entity
     * @returns {{ x: number, y: number, z: number } | null}
     */ static getLocalPosition(entity) {
        if (!entity) {
            LoggerService.log(this, "[SceneTransformHelper.getLocalPosition] entity is null/undefined");
            return null;
        }
        const pos = entity.getLocalPosition();
        return {
            x: pos.x,
            y: pos.y,
            z: pos.z
        };
    }
    /**
     * Встановити локальну позицію на основі "базової" позиції + offset.
     *
     * Логіка така сама, як ти використовував у правилі:
     *   if (!entity.__baseLocalPosition) {
     *       entity.__baseLocalPosition = entity.getLocalPosition().clone();
     *   }
     *   const base = entity.__baseLocalPosition;
     *   entity.setLocalPosition(base.x, base.y + offsetY, base.z);
     *
     * Тут ми робимо це універсально:
     *   - запамʼятовуємо базову позицію один раз у entity.__baseLocalPosition
     *   - додаємо offset (x/y/z) до бази, а не до поточної позиції.
     *
     * Приклад:
     *   SceneTransformHelper.setLocalPositionOffsetFromBase(entity, { y: offsetY });
     *
     * @param {pc.Entity} entity
     * @param {{ x?: number, y?: number, z?: number }} offset - зміщення від базової позиції
     * @returns {{ x: number, y: number, z: number } | null} - нова позиція або null при помилці
     */ static setLocalPosition(entity, offset) {
        if (!entity) {
            LoggerService.log(this, "[SceneTransformHelper.setLocalPosition] entity is null/undefined");
            return null;
        }
        // Запамʼятовуємо базову позицію один раз
        // if (!entity.__baseLocalPosition) {
        entity.__baseLocalPosition = entity.getLocalPosition().clone();
        // }
        if (entity.name === "CabinetMove_Point") {
            window.CabinetMove_Point = entity;
        }
        if (entity.name === "CabinetBackWallMove_Point") {
            window.CabinetBackWallMove_Point = entity;
        }
        const base = entity.__baseLocalPosition;
        // if (entity.name === "OpenSideShelvesSideWall") {
        // }
        const nextX = offset.x !== undefined ? offset.x : base.x;
        const nextY = offset.y !== undefined ? offset.y : base.y;
        const nextZ = offset.z !== undefined ? offset.z : base.z;
        entity.setLocalPosition(nextX, nextY, nextZ);
        return {
            x: nextX,
            y: nextY,
            z: nextZ
        };
    }
    // ===================== VISIBILITY =====================
    /**
     * Отримати поточний стан visibility (enabled) для entity.
     *
     * @param {pc.Entity} entity
     * @returns {boolean | null}
     */ static getVisible(entity) {
        if (!entity) {
            LoggerService.log(this, "[SceneTransformHelper.getVisible] entity is null/undefined");
            return null;
        }
        return !!entity.enabled;
    }
    /**
     * Встановити visibility (enabled) для entity.
     *
     * @param {pc.Entity} entity
     * @param {boolean} visible
     * @returns {boolean | null} - фінальний стан enabled або null при помилці
     */ static setVisible(entity, visible) {
        if (!entity) {
            LoggerService.log(this, "[SceneTransformHelper.setVisible] entity is null/undefined");
            return null;
        }
        const prev = !!entity.enabled;
        const next = !!visible;
        entity.enabled = next;
        LoggerService.log(this, "[SceneTransformHelper.setVisible] visibility updated", {
            entityName: entity.name,
            from: prev,
            to: next
        });
        return next;
    }
    /**
     * Встановити visibility на основі string-стану ("Enable"/"Disable").
     *
     * @param {pc.Entity} entity
     * @param {string} state - "Enable" | "Disable" | інше
     * @returns {boolean | null} - фінальний стан enabled або null при помилці
     */ static setVisibleByState(entity, state) {
        if (!entity) {
            LoggerService.log(this, "[SceneTransformHelper.setVisibleByState] entity is null/undefined");
            return null;
        }
        if (!state) {
            LoggerService.log(this, "[SceneTransformHelper.setVisibleByState] state is empty", {
                entityName: entity.name
            });
            return null;
        }
        const enabled = state === "Enable";
        !!entity.enabled;
        entity.enabled = enabled;
        return enabled;
    }
    // ===================== ASYNC UTILITIES =====================
    /**
     * Очікує завершення N кадрів для стабілізації трансформацій.
     * Корисно після масових змін позицій, scale, stretch тощо.
     * 
     * @param {number} frameCount - Кількість кадрів для очікування (за замовчуванням 2)
     * @returns {Promise<void>}
     * 
     * @example
     * // Після зміни позицій
     * await SceneTransformHelper.waitForFrames(2);
     * // Тепер можна безпечно читати boundingBox
     */ static waitForFrames(frameCount = 2) {
        return new Promise((resolve)=>{
            let currentFrame = 0;
            const checkFrame = ()=>{
                currentFrame++;
                if (currentFrame >= frameCount) {
                    resolve();
                } else {
                    requestAnimationFrame(checkFrame);
                }
            };
            requestAnimationFrame(checkFrame);
        });
    }
}

export { SceneTransformHelper };
