import { BaseProductRule } from "../base-product-rule.mjs";
import { LoggerService } from "../../../../services/logger/logger-service.mjs";
import { MeshRuleConfigBuilder } from "../../../../helpers/mesh-rule-config-builder.mjs";

/** Mirror Urban Duplex handle points to the selected side. */
export class RuleHandleSideCabinetUrbanDuplex extends BaseProductRule {
    static attributeOptions = Object.freeze({
        HandleSide: Object.freeze(["Left", "Right"]),
    });

    constructor() {
        super({
            name: "RuleHandleSideCabinetUrbanDuplex",
            watchAttributes: ["HandleSide"],
            priority: 47,
        });
        this.dataRule = {
            scaleX: MeshRuleConfigBuilder.create()
                .breakpoints(RuleHandleSideCabinetUrbanDuplex.attributeOptions.HandleSide)
                .meshes([
                    "UD_Handle_LateralP_Top_Point",
                    "UD_Handle_BaseP_Top_Point",
                    "UD_Handle_BaseP_Bot_Point",
                    "UD_Handle_LateralP_Bot_Point",
                ])
                .values({ Left: { x: -1 }, Right: { x: 1 } })
                .build(),
        };
    }

    execute({ currentState }) {
        const configuredSide = currentState.get("HandleSide");
        const handleSide = configuredSide === undefined ? "Right" : configuredSide;
        const sides = RuleHandleSideCabinetUrbanDuplex.attributeOptions.HandleSide;
        if (!sides.includes(handleSide)) {
            console.warn(`[${this.name}] Invalid HandleSide. Allowed values: ${sides.join(", ")}`, {
                productId: this.productId,
                value: handleSide,
            });
            return;
        }
        this._applyTransformConfig(handleSide, this.dataRule.scaleX, (entity, value) => {
            const scale = entity.getLocalScale();
            entity.setLocalScale(value.x, scale.y, scale.z);
        });
    }

}
