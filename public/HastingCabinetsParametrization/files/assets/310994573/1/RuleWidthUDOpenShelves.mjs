import { BaseProductRule } from "../../base-product-rule.mjs";
import { LoggerService } from "../../../../../services/logger/logger-service.mjs";
import { MeshRuleConfigBuilder } from "../../../../../helpers/mesh-rule-config-builder.mjs";
import { SceneTransformHelper } from "../../../../../helpers/scene-transform-helper.mjs";

/** UD open shelves: Width transforms from the supplied size table. */
export class RuleWidthUDOpenShelves extends BaseProductRule {
    constructor() {
        super({
            name: "RuleWidthUDOpenShelves",
            watchAttributes: ["Width"], // реагуємо на width
            priority: 20,
        });

        this.dataRule = {
            stretchX: MeshRuleConfigBuilder.create().breakpoints([25, 35, 50, 60, 70]).meshes(['OpenShelvesBack', 'OpenShelvesDivider', 'OpenShelvesSideWalls', 'OpenShelvesTopBot']).values({25: {x: -0.35},35: {x: -0.25},50: {x: -0.1},60: {x: 0},70: {x: 0.1}}).build()
        };
    }

    onInitialize() {
        LoggerService.log(this, `📏 [RuleWidthUDOpenShelves] Initialized for product "${this.productId}"`);
    }

    /**
     * Основне виконання правила.
     */
    execute({ currentState, previousState }) {
        const width = Number(currentState.get("Width"));

        if (!this.dataRule.stretchX.breakpoints.includes(width)) {
            LoggerService.warn(this, "Unsupported UD open shelves width", {
                width,
            });
            return;
        }

        LoggerService.log(this, `📏 [RuleWidthUDOpenShelves] Executing for width: ${width}`, {
            previousWidth: previousState?.get("Width"),
        });

        this._applyTransformConfig(width, this.dataRule.stretchX, (entity, value) => SceneTransformHelper.setStretch(entity, value));
    }

}
