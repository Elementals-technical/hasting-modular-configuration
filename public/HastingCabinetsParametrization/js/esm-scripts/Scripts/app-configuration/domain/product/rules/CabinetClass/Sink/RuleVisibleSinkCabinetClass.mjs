import { BaseProductRule } from '../../base-product-rule.mjs';
import { LoggerService } from '../../../../../services/logger/logger-service.mjs';
import { SceneTransformHelper } from '../../../../../helpers/scene-transform-helper.mjs';

/**
 * Правило масштабування продукту по ширині.
 *
 * Реагує на зміни атрибута 'Width' в store.
 * Застосовує відповідний крок масштабування до всіх дочірніх entities з певними тегами.
 */ class RuleVisibleSinkCabinetClass extends BaseProductRule {
    onInitialize() {
        LoggerService.log(this, `📏 [RuleVisibleSinkCabinetClass] Initialized for product "${this.productId}"`);
    }
    /**
     * Основне виконання правила.
     */ execute({ currentState, previousState }) {
        this._applyTransformConfig("sink", this.dataRule.visibility, (entity, value)=>SceneTransformHelper.setVisibleByState(entity, value));
        this._applyTransformConfig("sink", this.dataRule.stretchZ, (entity, value)=>SceneTransformHelper.setStretch(entity, value));
    }
    constructor(context){
        super({
            name: "RuleVisibleSinkCabinetClass",
            watchAttributes: [],
            priority: 10
        });
        this.context = context;
        this.dataRule = {
            visibility: {
                values: {
                    Mako_Cabinet_HBracket: {
                        sink: "Disable"
                    },
                    Mako_Cabinet_SBBoolBox: {
                        sink: "Disable"
                    },
                    Mako_Legs: {
                        sink: "Disable"
                    },
                    Mako_Bot_Drawer: {
                        sink: "Disable"
                    },
                    Mako_Top_Drawer: {
                        sink: "Disable"
                    },
                    Class_Bot_Drawer: {
                        sink: "Enable"
                    },
                    // Class_Top_Drawer belongs to RuleDrawersCabinetClass alone. This rule runs on every
                    // change (no watchAttributes), so enabling it here brought the top drawer back over
                    // a 1D layout after any unrelated write such as Thickness.
                    Class_Top_Drawer_Framing: {
                        sink: "Enable"
                    }
                }
            },
            stretchZ: {
                values: {
                    CLMa_Cabinet_Floor: {
                        sink: {
                            z: -0.7
                        }
                    }
                }
            },
            moveZ: {
                values: {}
            }
        };
    }
}

export { RuleVisibleSinkCabinetClass };
