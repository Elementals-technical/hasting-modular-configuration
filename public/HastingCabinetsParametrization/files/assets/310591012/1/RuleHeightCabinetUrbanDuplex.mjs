import { BaseProductRule } from "../base-product-rule.mjs";
import { LoggerService } from "../../../../services/logger/logger-service.mjs";
import { MeshRuleConfigBuilder } from "../../../../helpers/mesh-rule-config-builder.mjs";
import { SceneTransformHelper } from "../../../../helpers/scene-transform-helper.mjs";

/** Urban Duplex height: stretch and local positions from the size tables. */
export class RuleHeightCabinetUrbanDuplex extends BaseProductRule {
    constructor() {
        super({
            name: "RuleHeightCabinetUrbanDuplex",
            watchAttributes: ["Height"], // реагуємо на height
            priority: 30,
        });

        this.dataRule = {
            stretchY: MeshRuleConfigBuilder.create()
                .breakpoints([56, 53, 38, 28])
                .meshes(["UD_Cabinet_Walls"])
                .values({ 56: { y: 0 }, 53: { y: -0.03 }, 38: { y: -0.18 }, 28: { y: -0.28 } })
                .meshes(["UD_Cabinet_SCBackWall"])
                .values({ 56: { y: 0 }, 53: { y: -0.06 }, 38: { y: -0.36 }, 28: { y: -0.56 } })
                .meshes(["UD_Handle_BaseP_Bot", "UD_Handle_LateralP_Bot", "UD_Handle_Full_Bot"])
                .values({ 56: { y: 0 }, 53: { y: 0.25 }, 38: { y: 0.1 }, 28: { y: 0 } })
                // Config guide "Size change - Stretch Operation", column UD_Cabinet_SCBackWall (changed height values).
                .meshes(["UD_Cabinet_SCBackWall"])
                .values({ 56: { y: 0 }, 53: { y: -0.06 }, 38: { y: -0.36 }, 28: { y: -0.56 } })
                .build(),
            moveY: MeshRuleConfigBuilder.create()
                .breakpoints([56, 53, 38, 28])
                .meshes(["UD_Cabinet_Walls_Point"])
                .values({ 56: { y: 0 }, 53: { y: -0.015 }, 38: { y: -0.09 }, 28: { y: -0.14 } })
                // Sink_Point is positioned by RuleSinkMountPosition (UD-sink-cabinet sinkMount.heightLocalY):
                // the same Y per height plus the countertop thickness offset.
                .meshes(["UD_Cabinet_Mount", "UD_Cabinet_HGroove_Top"])
                .values({ 56: { y: 0 }, 53: { y: -0.03 }, 38: { y: -0.18 }, 28: { y: -0.28 } })
                .meshes(["UD_Handle_BaseP_Bot_Point", "UD_Handle_LateralP_Bot_Point", "UD_Handle_Full_Bot_Point"])
                .values({ 56: { y: 0 }, 53: { y: 0.125 }, 38: { y: 0.05 }, 28: { y: 0 } })
                .meshes(["UD_Countertop_Point"])
                .values({ 56: { y: 0.56 }, 53: { y: 0.53 }, 38: { y: 0.38 }, 28: { y: 0.28 } })
                .build(),
        };
    }

    onInitialize() {
        LoggerService.log(this, `📏 [RuleHeightCabinetUrbanDuplex] Initialized for product "${this.productId}"`);
    }

    /**
     * Основне виконання правила.
     */
    execute({ currentState, previousState }) {
        const height = Number(currentState.get("Height"));

        if (!this.dataRule.stretchY.breakpoints.includes(height)) {
            LoggerService.warn(this, "Unsupported UrbanDuplex cabinet height", {
                height,
            });
            return;
        }

        LoggerService.log(this, `📏 [RuleHeightCabinetUrbanDuplex] Executing for height: ${height}`, {
            previousHeight: previousState?.get("Height"),
        });

        this._applyTransformConfig(height, this.dataRule.stretchY, (entity, value) =>
            SceneTransformHelper.setStretch(entity, value),
        );
        this._applyTransformConfig(height, this.dataRule.moveY, (entity, value) =>
            SceneTransformHelper.setLocalPosition(entity, value),
        );
    }

}
