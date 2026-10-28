import { Script } from 'playcanvas';

/**
 * @deprecated Legacy базовий клас правил (PlayCanvas Script).
 * Нові правила наслідують BaseProductRule (domain/product/rules/base-product-rule.mjs).
 * Залишено для сумісності з PlayCanvas Editor.
 */
export class BaseRule extends Script {

    static scriptName = 'baseRule';

    initialize() {
    }
}
