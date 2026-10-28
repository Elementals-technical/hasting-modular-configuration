import { BaseProductRule } from '../base-product-rule.mjs';
import { LoggerService } from '../../../../services/logger/logger-service.mjs';
import { SceneEntityHelper } from '../../../../helpers/scene-entity-helper.mjs';
import { SceneTransformHelper } from '../../../../helpers/scene-transform-helper.mjs';

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
        this._applyVisibility(this.ruleData.visibility);
        this._applyStretchZ(this.ruleData.stretchZ);
    }
    // ================== Visibility ==================
    _applyVisibility(cfg) {
        let appliedCount = 0;
        const entities = SceneEntityHelper.collectByNames(this.context.entity, Object.keys(cfg));
        entities.forEach((entity)=>{
            const configForMesh = cfg[entity.name];
            const value = configForMesh;
            if (value === undefined || value === null) {
                LoggerService.log(this, "[RuleVisibleSinkCabinetClass] No value for visibility", {
                    entityName: entity.name,
                    visibility: value
                });
                return;
            }
            SceneTransformHelper.setVisibleByState(entity, value);
            appliedCount++;
        });
        LoggerService.log(this, `✅ [RuleVisibleSinkCabinetClass] Visibility applied`, {
            appliedCount
        });
    }
    // ================== StretchZ ==================
    _applyStretchZ(cfg) {
        let appliedCount = 0;
        const entities = SceneEntityHelper.collectByNames(this.context.entity, Object.keys(cfg));
        entities.forEach((entity)=>{
            const configForMesh = cfg[entity.name];
            if (!configForMesh) {
                LoggerService.log(this, "[RuleVisibleSinkCabinetClass] No config for mesh name", {
                    entityName: entity.name
                });
                return;
            }
            const value = configForMesh;
            if (!value) {
                LoggerService.log(this, "[RuleVisibleSinkCabinetClass] No value for stretch Z", {
                    entityName: entity.name,
                    stretchZ: value.z
                });
                return;
            }
            SceneTransformHelper.setStretch(entity, value);
            appliedCount++;
        });
        LoggerService.log(this, `✅ [RuleVisibleSinkCabinetClass] StretchZ applied`, {
            appliedCount
        });
    }
    constructor(context){
        super({
            name: "RuleVisibleSinkCabinetClass",
            watchAttributes: [],
            priority: 10
        });
        this.context = context;
        this.ruleData = {
            visibility: {
                Mako_Cabinet_HBracket: "Disable",
                Mako_Cabinet_SBBoolBox: "Disable",
                Mako_Legs: "Disable",
                Mako_Bot_Drawer: "Disable",
                Mako_Top_Drawer: "Disable",
                Class_Bot_Drawer: "Enable",
                Class_Top_Drawer: "Enable",
                Class_Top_Drawer_Framing: "Enable"
            },
            stretchZ: {
                CLMa_Cabinet_Floor: {
                    z: -0.7
                }
            },
            moveZ: {}
        };
    }
}

export { RuleVisibleSinkCabinetClass };
