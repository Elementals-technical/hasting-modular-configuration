import { BaseProductRule } from '../../base-product-rule.mjs';
import { LoggerService } from '../../../../../services/logger/logger-service.mjs';
import { MeshRuleConfigBuilder } from '../../../../../helpers/mesh-rule-config-builder.mjs';
import { SceneTransformHelper } from '../../../../../helpers/scene-transform-helper.mjs';

/** UF open shelves: Width transforms from the supplied size table. */ class RuleWidthUFOpenShelves extends BaseProductRule {
    onInitialize() {
        LoggerService.log(this, `📏 [RuleWidthUFOpenShelves] Initialized for product "${this.productId}"`);
    }
    /**
     * Основне виконання правила.
     */ execute({ currentState, previousState }) {
        const width = Number(currentState.get("Width"));
        if (!this.dataRule.stretchX.breakpoints.includes(width)) {
            LoggerService.warn(this, "Unsupported UF open shelves width", {
                width
            });
            return;
        }
        LoggerService.log(this, `📏 [RuleWidthUFOpenShelves] Executing for width: ${width}`, {
            previousWidth: previousState?.get("Width")
        });
        this._applyTransformConfig(width, this.dataRule.stretchX, (entity, value)=>{
            SceneTransformHelper.setStretch(entity, value);
        });
    }
    constructor(){
        super({
            name: "RuleWidthUFOpenShelves",
            watchAttributes: [
                "Width"
            ],
            priority: 20
        });
        this.dataRule = {
            stretchX: MeshRuleConfigBuilder.create().breakpoints([
                25,
                35,
                50,
                60,
                70,
                80,
                90,
                100,
                105,
                120
            ]).meshes([
                "UF_OS_DividerBot",
                "UF_OS_DividerTop",
                "UF_OS_Back",
                "UF_OS_Body"
            ]).values({
                25: {
                    x: -0.35
                },
                35: {
                    x: -0.25
                },
                50: {
                    x: -0.1
                },
                60: {
                    x: 0
                },
                70: {
                    x: 0.1
                },
                80: {
                    x: 0.2
                },
                90: {
                    x: 0.3
                },
                100: {
                    x: 0.4
                },
                105: {
                    x: 0.45
                },
                120: {
                    x: 0.6
                }
            }).build()
        };
    }
}

export { RuleWidthUFOpenShelves };
