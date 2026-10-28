import { BaseProductRule } from '../base-product-rule.mjs';
import { LoggerService } from '../../../../services/logger/logger-service.mjs';
import { SceneTransformHelper } from '../../../../helpers/scene-transform-helper.mjs';

/**
 * Правило початкової конфігурації шафи Mako.
 */ class RuleInitCabinetMako extends BaseProductRule {
    onInitialize() {
        LoggerService.log(this, `📏 [RuleInitCabinetMako] Initialized for product "${this.productId}"`);
    }
    /**
     * Основне виконання правила.
     */ execute() {
        this._applyTransformConfig("init", this.dataRule.visibility, (entity, value)=>{
            SceneTransformHelper.setVisibleByState(entity, value);
        });
        this._applyTransformConfig("init", this.dataRule.stretchZ, (entity, value)=>{
            SceneTransformHelper.setStretch(entity, value);
        });
        this._applyTransformConfig("init", this.dataRule.moveZ, (entity, value)=>{
            SceneTransformHelper.setLocalPosition(entity, value);
        });
    }
    constructor(){
        super({
            name: "RuleInitCabinetMako",
            watchAttributes: [],
            priority: 10
        });
        this.dataRule = {
            visibility: {
                values: {
                    Mako_Cabinet_HBracket: {
                        init: "Enable"
                    },
                    Mako_Cabinet_SBBoolBox: {
                        init: "Enable"
                    },
                    Mako_Legs: {
                        init: "Enable"
                    },
                    Mako_Bot_Drawer: {
                        init: "Enable"
                    },
                    Mako_Top_Drawer: {
                        init: "Enable"
                    },
                    Class_Bot_Drawer: {
                        init: "Disable"
                    },
                    Class_Top_Drawer: {
                        init: "Disable"
                    }
                }
            },
            stretchZ: {
                values: {
                    CLMa_Cabinet_Walls: {
                        init: {
                            z: 0.014
                        }
                    }
                }
            },
            moveZ: {
                values: {
                    CLMa_Cabinet_WallsPoint: {
                        init: {
                            z: 0.007
                        }
                    }
                }
            }
        };
    }
}

export { RuleInitCabinetMako };
