import { BaseProductRule } from '../../base-product-rule.mjs';
import { LoggerService } from '../../../../../services/logger/logger-service.mjs';
import { SceneTransformHelper } from '../../../../../helpers/scene-transform-helper.mjs';

/**
 * Правило масштабування продукту по ширині.
 *
 * Реагує на зміни атрибута 'Width' в store.
 * Застосовує відповідний крок масштабування до всіх дочірніх entities з певними тегами.
 */ class RuleVisibleSideCabinetClass extends BaseProductRule {
    onInitialize() {
        LoggerService.log(this, `📏 [RuleVisibleSideCabinetClass] Initialized for product "${this.productId}"`);
    }
    /**
     * Основне виконання правила.
     */ execute({ currentState, previousState }) {
        this._applyTransformConfig("side", this.dataRule.visibility, (entity, value)=>SceneTransformHelper.setVisibleByState(entity, value));
    }
    constructor(context){
        super({
            name: "RuleVisibleSideCabinetClass",
            watchAttributes: [],
            priority: 10
        });
        this.context = context;
        this.dataRule = {
            visibility: {
                values: {
                    Mako_Cabinet_HBracket: {
                        side: "Disable"
                    },
                    Mako_Cabinet_SBBoolBox: {
                        side: "Disable"
                    },
                    Mako_Legs: {
                        side: "Disable"
                    },
                    Mako_Bot_Drawer: {
                        side: "Disable"
                    },
                    Mako_Top_Drawer: {
                        side: "Disable"
                    },
                    Class_Bot_Drawer: {
                        side: "Enable"
                    },
                    // Class_Top_Drawer belongs to RuleDrawersCabinetClass alone. This rule runs on every
                    // change (no watchAttributes), so enabling it here brought the top drawer back over
                    // a 1D layout after any unrelated write such as Thickness.
                    Class_Top_Drawer_Framing: {
                        side: "Disable"
                    }
                }
            },
            stretchZ: {
                values: {}
            },
            moveZ: {
                values: {}
            }
        };
    }
}

export { RuleVisibleSideCabinetClass };
