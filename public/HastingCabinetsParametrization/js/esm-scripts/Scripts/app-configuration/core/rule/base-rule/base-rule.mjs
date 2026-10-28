import { Script } from '../../../../../../playcanvas-stable.min.mjs';

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
 * @deprecated Legacy базовий клас правил (PlayCanvas Script).
 * Нові правила наслідують BaseProductRule (domain/product/rules/base-product-rule.mjs).
 * Залишено для сумісності з PlayCanvas Editor.
 */ class BaseRule extends Script {
    initialize() {}
}
_define_property(BaseRule, "scriptName", 'baseRule');

export { BaseRule };
