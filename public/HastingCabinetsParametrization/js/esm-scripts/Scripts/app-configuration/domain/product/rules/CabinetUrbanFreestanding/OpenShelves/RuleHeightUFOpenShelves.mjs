import { BaseProductRule } from '../../base-product-rule.mjs';
import { LoggerService } from '../../../../../services/logger/logger-service.mjs';
import { MeshRuleConfigBuilder } from '../../../../../helpers/mesh-rule-config-builder.mjs';
import { SceneTransformHelper } from '../../../../../helpers/scene-transform-helper.mjs';
import { ufHeightOf, UF_HEIGHTS } from '../../../logic/uf-cabinet-height-policy.mjs';

/** UF open shelves: transforms by cabinet height 53/56/88/91 as is (NEW sheet A192:A195, A204:A207). */ class RuleHeightUFOpenShelves extends BaseProductRule {
    onInitialize() {
        LoggerService.log(this, `📏 [RuleHeightUFOpenShelves] Initialized for product "${this.productId}"`);
    }
    /**
     * Основне виконання правила.
     */ execute({ currentState, previousState }) {
        const height = ufHeightOf(currentState);
        if (height === null) {
            LoggerService.warn(this, "Unsupported UF open shelves height", {
                height: currentState.get("Height")
            });
            return;
        }
        LoggerService.log(this, `📏 [RuleHeightUFOpenShelves] Executing for height: ${height}`, {
            previousHeight: previousState?.get("Height")
        });
        this._applyTransformConfig(height, this.dataRule.stretchY, (entity, value)=>{
            SceneTransformHelper.setStretch(entity, value);
        });
        this._applyTransformConfig(height, this.dataRule.moveY, (entity, value)=>{
            SceneTransformHelper.setLocalPosition(entity, value);
        });
        this._applyTransformConfig(height, this.dataRule.visibility, (entity, value)=>{
            SceneTransformHelper.setVisibleByState(entity, value);
        });
    }
    constructor(){
        super({
            name: "RuleHeightUFOpenShelves",
            watchAttributes: [
                "Height"
            ],
            priority: 30
        });
        this.dataRule = {
            stretchY: MeshRuleConfigBuilder.create().breakpoints(UF_HEIGHTS).meshes([
                "UF_OS_Back",
                "UF_OS_Body"
            ]).values({
                53: {
                    y: -0.38
                },
                56: {
                    y: -0.35
                },
                88: {
                    y: -0.03
                },
                91: {
                    y: 0
                }
            }).build(),
            moveY: MeshRuleConfigBuilder.create().breakpoints(UF_HEIGHTS).meshes([
                "UF_OS_Back_Point",
                "UF_OS_Body_Point"
            ]).values({
                53: {
                    y: -0.19
                },
                56: {
                    y: -0.175
                },
                88: {
                    y: -0.015
                },
                91: {
                    y: 0
                }
            }).meshes([
                "UF_OS_DividerBot_Point"
            ]).values({
                53: {
                    y: -0.042
                },
                56: {
                    y: -0.028
                },
                88: {
                    y: -0.01
                },
                91: {
                    y: 0
                }
            }).meshes([
                "UF_OS_DividerTop_Point"
            ]).values({
                53: {
                    y: 0
                },
                56: {
                    y: 0
                },
                88: {
                    y: -0.0193
                },
                91: {
                    y: 0
                }
            }).build(),
            visibility: MeshRuleConfigBuilder.create().breakpoints(UF_HEIGHTS).meshes([
                "UF_OS_DividerTop"
            ]).values({
                53: "Disable",
                56: "Disable",
                88: "Enable",
                91: "Enable"
            }).build()
        };
    }
}

export { RuleHeightUFOpenShelves };
