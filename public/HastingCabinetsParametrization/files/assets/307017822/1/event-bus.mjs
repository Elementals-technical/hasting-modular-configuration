import { Script } from 'playcanvas';

/**
 * @deprecated Не використовується активно. Events ніколи не fire-яться.
 * Залишено для сумісності з PlayCanvas Editor (скрипт може бути прив'язаний до entity).
 */
export class EventBus extends Script {

    static scriptName = 'eventBus';

    static EVENTS = {
        // Події Сцени
        SCENE_ADD_PRODUCT: 'scene:add-product',
        SCENE_REMOVE_PRODUCT: 'scene:remove-product',
        SCENE_UPDATE: 'scene:update',

        // Події Продукту
        PRODUCT_UPDATE: (id) => `product:${id}:update`,
        PRODUCT_STATE_CHANGED: (productId) => `product:state:changed:${productId}`,

        // Події Зміни Стейту (для правил)
        STATE_CHANGED: (id, key) => `state:${id}:${key}:changed`
    };

    /**
     * Called when the script is about to run for the first time.
     */
    initialize() {
    }

    /**
     * Called for enabled (running state) scripts on each tick.
     *
     * @param {number} dt - The delta time in seconds since the last frame.
     */
    update(dt) {
    }
}