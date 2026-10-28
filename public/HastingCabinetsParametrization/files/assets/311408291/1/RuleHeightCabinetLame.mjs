import { BaseProductRule } from "../base-product-rule.mjs";
import { LoggerService } from "../../../../services/logger/logger-service.mjs";
import { MeshRuleConfigBuilder } from "../../../../helpers/mesh-rule-config-builder.mjs";
import { SceneTransformHelper } from "../../../../helpers/scene-transform-helper.mjs";

/**
 * Правило масштабування продукту по висоті.
 *
 * Реагує на зміни атрибута 'Height' в store.
 * Застосовує відповідний крок масштабування до всіх дочірніх entities з певними іменами.
 */
export class RuleHeightCabinetLame extends BaseProductRule {
    constructor() {
        super({
            name: "RuleHeightCabinetLame",
            watchAttributes: ["Height"], // реагуємо на height
            priority: 30,
        });

        this.dataRule = {
            stretchY: MeshRuleConfigBuilder.create()
                .breakpoints([26, 52])
                .meshes(["Lame_Cabinet_Walls"])
                .values({
                    26: { y: -0.26 },
                    52: { y: 0 },
                })
                .build(),

            moveY: MeshRuleConfigBuilder.create()
                .breakpoints([26, 52])
                .meshes(["Lame_Cabinet_WallsPoint"])
                .values({
                    26: { y: 0.13 },
                    52: { y: 0 },
                })
                .meshes(["Lame_Countertop_Point"])
                .values({
                    26: { y: 0.52 },
                    52: { y: 0.52 },
                })
                // Upper drawer and top frame stay at their authored positions.
                .meshes(["Lame_Cabinet_Floor"])
                .values({ 26: { y: 0.26 }, 52: { y: 0 } })
                .meshes(["Lame_Sink_Point"])
                .values({ 26: { y: -0.04 }, 52: { y: -0.04 } })
                .build(),
        };
    }

    onInitialize() {
        LoggerService.log(this, `📏 [RuleHeightCabinetLame] Initialized for product "${this.productId}"`);
    }

    /**
     * Основне виконання правила.
     */
    execute({ currentState, previousState }) {
        const height = Number(currentState.get("Height"));

        if (height !== 26 && height !== 52) {
            LoggerService.warn(this, "Unsupported Lame cabinet height", {
                height,
            });
            return;
        }

        LoggerService.log(this, `📏 [RuleHeightCabinetLame] Executing for height: ${height}`, {
            previousHeight: previousState?.get("Height"),
        });

        this._applyTransformConfig(height, this.dataRule.stretchY, (entity, value) => {
            SceneTransformHelper.setStretch(entity, value);
        });
        this._applyTransformConfig(height, this.dataRule.moveY, (entity, value) => {
            SceneTransformHelper.setLocalPosition(entity, value);
        });
    }
}
