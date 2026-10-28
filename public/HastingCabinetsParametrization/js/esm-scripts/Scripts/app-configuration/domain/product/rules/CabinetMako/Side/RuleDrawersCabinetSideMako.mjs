import { BaseProductRule } from '../../base-product-rule.mjs';
import { LoggerService } from '../../../../../services/logger/logger-service.mjs';
import { MeshRuleConfigBuilder } from '../../../../../helpers/mesh-rule-config-builder.mjs';
import { SceneTransformHelper } from '../../../../../helpers/scene-transform-helper.mjs';

/**
 * Controls Mako drawer visibility for cabinet heights 26 and 52 cm.
 */ class RuleDrawersCabinetSideMako extends BaseProductRule {
    onInitialize() {
        LoggerService.log(this, `📏 [RuleDrawersCabinetSideMako] Initialized for product "${this.productId}"`);
    }
    /**
     * Основне виконання правила.
     */ execute({ currentState, previousState }) {
        const height = Number(currentState.get("Height"));
        if (height !== 26 && height !== 52) {
            LoggerService.warn(this, "Unsupported Mako cabinet height", {
                height
            });
            return;
        }
        LoggerService.log(this, `📏 [RuleDrawersCabinetSideMako] Executing for height: ${height}`, {
            previousHeight: previousState?.get("Height")
        });
        this._applyTransformConfig(height, this.dataRule.visibility, (entity, value)=>{
            SceneTransformHelper.setVisibleByState(entity, value);
        });
    }
    constructor(){
        super({
            name: "RuleDrawersCabinetSideMako",
            watchAttributes: [
                "Height"
            ],
            priority: 40
        });
        this.dataRule = {
            visibility: MeshRuleConfigBuilder.create().breakpoints([
                26,
                52
            ]).meshes([
                "Mako_Top_Drawer"
            ]).values({
                26: "Disable",
                52: "Enable"
            }).meshes([
                "Mako_Bot_Drawer"
            ]).values({
                26: "Enable",
                52: "Enable"
            }).build()
        };
    }
}

export { RuleDrawersCabinetSideMako };
