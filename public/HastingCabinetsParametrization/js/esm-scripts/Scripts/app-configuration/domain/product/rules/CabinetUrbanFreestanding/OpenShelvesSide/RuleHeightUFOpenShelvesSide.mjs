import { BaseProductRule } from '../../base-product-rule.mjs';
import { LoggerService } from '../../../../../services/logger/logger-service.mjs';
import { MeshRuleConfigBuilder } from '../../../../../helpers/mesh-rule-config-builder.mjs';
import { SceneTransformHelper } from '../../../../../helpers/scene-transform-helper.mjs';
import { ufHeightOf, UF_HEIGHTS } from '../../../logic/uf-cabinet-height-policy.mjs';

/** UF open side shelves: transforms by cabinet height 53/56/88/91 as is (NEW sheet A224:A227, A236:A239). */ class RuleHeightUFOpenShelvesSide extends BaseProductRule {
    onInitialize() {
        LoggerService.log(this, `📏 [RuleHeightUFOpenShelvesSide] Initialized for product "${this.productId}"`);
    }
    /**
     * Основне виконання правила.
     */ execute({ currentState, previousState }) {
        const height = ufHeightOf(currentState);
        if (height === null) {
            LoggerService.warn(this, "Unsupported UF open side shelves height", {
                height: currentState.get("Height")
            });
            return;
        }
        LoggerService.log(this, `📏 [RuleHeightUFOpenShelvesSide] Executing for height: ${height}`, {
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
            name: "RuleHeightUFOpenShelvesSide",
            watchAttributes: [
                "Height"
            ],
            priority: 30
        });
        this.dataRule = {
            stretchY: MeshRuleConfigBuilder.create().breakpoints(UF_HEIGHTS).meshes([
                "UF_OSS_MidWall",
                "UF_OSS_Body"
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
                "UF_OSS_Body_Point",
                "UF_OSS_MidWall_Point"
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
                "UF_OSS_BackShelf_Bot_Point",
                "UF_OSS_FrontShelf_Bot"
            ]).values({
                53: {
                    y: -0.04
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
                "UF_OSS_BackShelf_Top_Point",
                "UF_OSS_FrontShelf_Top"
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
                "UF_OSS_FrontShelf_Top",
                "UF_OSS_BackShelf_Top"
            ]).values({
                53: "Disable",
                56: "Disable",
                88: "Enable",
                91: "Enable"
            }).build()
        };
    }
}

export { RuleHeightUFOpenShelvesSide };
