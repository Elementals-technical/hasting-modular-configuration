import { BaseProductRule } from '../base-product-rule.mjs';
import { LoggerService } from '../../../../services/logger/logger-service.mjs';
import { MeshRuleConfigBuilder } from '../../../../helpers/mesh-rule-config-builder.mjs';
import { SceneTransformHelper } from '../../../../helpers/scene-transform-helper.mjs';

/**
 * Width (cm) → stretch.x of the width-driven meshes, handles included.
 * Exported for RuleOpenSideShelfNeighboursUrbanDuplex: its base handle stretch is this value.
 */ const URBAN_DUPLEX_WIDTH_STRETCH_BY_WIDTH = Object.freeze({
    25: {
        x: -0.35
    },
    35: {
        x: -0.25
    },
    40: {
        x: -0.2
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
});
/** Urban Duplex width: stretch and local positions from the size tables. */ class RuleWidthCabinetUrbanDuplex extends BaseProductRule {
    onInitialize() {
        LoggerService.log(this, `📏 [RuleWidthCabinetUrbanDuplex] Initialized for product "${this.productId}"`);
    }
    /**
     * Основне виконання правила.
     */ execute({ currentState, previousState }) {
        const width = Number(currentState.get("Width"));
        if (!this.dataRule.stretchX.breakpoints.includes(width)) {
            LoggerService.warn(this, "Unsupported UrbanDuplex cabinet width", {
                width
            });
            return;
        }
        LoggerService.log(this, `📏 [RuleWidthCabinetUrbanDuplex] Executing for width: ${width}`, {
            previousWidth: previousState?.get("Width")
        });
        this._applyTransformConfig(width, this.dataRule.stretchX, (entity, value)=>SceneTransformHelper.setStretch(entity, value));
    }
    constructor(){
        super({
            name: "RuleWidthCabinetUrbanDuplex",
            watchAttributes: [
                "Width"
            ],
            priority: 20
        });
        this.dataRule = {
            stretchX: MeshRuleConfigBuilder.create().breakpoints([
                25,
                35,
                40,
                50,
                60,
                70,
                80,
                90,
                100,
                105,
                120
            ]).meshes([
                "UD_Cabinet_Bolts",
                "UD_Cabinet_HGroove_Bot",
                "UD_Cabinet_HGroove_Top",
                "UD_Cabinet_Mount",
                "UD_Handle_BaseP_Top",
                "UD_Handle_Full_Top",
                "UD_Handle_Inner_Top",
                "UD_Handle_LateralP_Top",
                "UD_BotDrawer_Low_Walls",
                "UD_Cabinet_Walls",
                "UD_Cabinet_SCBackWall",
                "UD_Handle_BaseP_Bot",
                "UD_Handle_LateralP_Bot",
                "UD_Handle_Full_Bot",
                "UD_TopDrawer_Walls",
                "UD_TopDrawer_Hinge",
                "UD_BotDrawer_High_Walls",
                "UD_BotDrawer_Hinge"
            ]).values(URBAN_DUPLEX_WIDTH_STRETCH_BY_WIDTH).build()
        };
    }
}

export { RuleWidthCabinetUrbanDuplex, URBAN_DUPLEX_WIDTH_STRETCH_BY_WIDTH };
