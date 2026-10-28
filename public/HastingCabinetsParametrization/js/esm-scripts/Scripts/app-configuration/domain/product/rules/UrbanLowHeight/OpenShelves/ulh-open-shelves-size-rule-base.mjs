import { BaseProductRule } from '../../base-product-rule.mjs';
import { LoggerService } from '../../../../../services/logger/logger-service.mjs';
import { SceneEntityHelper } from '../../../../../helpers/scene-entity-helper.mjs';
import { SceneTransformHelper } from '../../../../../helpers/scene-transform-helper.mjs';

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
 * Спільна логіка розмірних правил ULH-Open-Shelf
 * (таблиця "UniOpenShelves template (Open Shelves Size Rules)").
 *
 * Дочірні класи задають:
 *   attribute — атрибут store ('Width' | 'Height' | 'Depth');
 *   stretch   — MeshRuleConfigBuilder.build() → SmartStretch.stretchAmount;
 *   move      — MeshRuleConfigBuilder.build() → абсолютна localPosition по осі (опційно).
 *
 * Base model: 0.6 × 0.56 м, "Set Stretch margin to 0.1".
 */ class ULHOpenShelvesSizeRuleBase extends BaseProductRule {
    execute({ currentState }) {
        const size = parseFloat(currentState.get(this.attribute));
        if (Number.isNaN(size)) {
            LoggerService.log(this, `⚠️ [${this.name}] ${this.attribute} is NaN, skip`);
            return;
        }
        const stretched = this._apply(size, this.ruleData.stretch, (entity, value)=>{
            entity.script?.smartStretch?.margin?.set?.(ULHOpenShelvesSizeRuleBase.STRETCH_MARGIN, ULHOpenShelvesSizeRuleBase.STRETCH_MARGIN, ULHOpenShelvesSizeRuleBase.STRETCH_MARGIN);
            return SceneTransformHelper.setStretch(entity, value);
        });
        const moved = this._apply(size, this.ruleData.move, (entity, value)=>SceneTransformHelper.setLocalPosition(entity, value));
        LoggerService.log(this, `✅ [${this.name}] ${this.attribute}=${size}`, {
            stretched,
            moved
        });
    }
    /** Значення для breakpoint (ключі об'єкта — рядки: "50.5"). */ static valueFor(map, size) {
        if (!map) return undefined;
        const key = Object.keys(map).find((k)=>parseFloat(k) === size);
        return key !== undefined ? map[key] : undefined;
    }
    _apply(size, cfg, applyFn) {
        const values = cfg?.values;
        if (!values) return 0;
        const names = Object.keys(values);
        const entities = SceneEntityHelper.collectByNames(this.entity, names);
        let applied = 0;
        for (const entity of entities){
            const value = ULHOpenShelvesSizeRuleBase.valueFor(values[entity.name], size);
            if (!value) {
                LoggerService.warn(this, `[${this.name}] No value for ${this.attribute}`, {
                    entityName: entity.name,
                    size,
                    breakpoints: cfg.breakpoints
                });
                continue;
            }
            if (applyFn(entity, value) !== null) applied++;
        }
        return applied;
    }
    constructor({ name, attribute, priority, stretch = null, move = null }){
        super({
            name,
            watchAttributes: [
                attribute
            ],
            priority
        });
        this.attribute = attribute;
        this.ruleData = {
            stretch,
            move
        };
    }
}
/** SmartStretch margin з таблиці. */ _define_property(ULHOpenShelvesSizeRuleBase, "STRETCH_MARGIN", 0.1);

export { ULHOpenShelvesSizeRuleBase };
