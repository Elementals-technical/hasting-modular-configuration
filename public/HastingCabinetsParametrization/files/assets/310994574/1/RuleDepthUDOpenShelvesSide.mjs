import { BaseProductRule } from "../../base-product-rule.mjs";
import { LoggerService } from "../../../../../services/logger/logger-service.mjs";
import { MeshRuleConfigBuilder } from "../../../../../helpers/mesh-rule-config-builder.mjs";
import { SceneTransformHelper } from "../../../../../helpers/scene-transform-helper.mjs";

/** UD open side shelves: Depth transforms from the supplied size table. */
export class RuleDepthUDOpenShelvesSide extends BaseProductRule {
    constructor() {
        super({
            name: "RuleDepthUDOpenShelvesSide",
            watchAttributes: ["Depth"], // реагуємо на depth
            priority: 35,
        });

        this.dataRule = {
            stretchZ: MeshRuleConfigBuilder.create()
                .breakpoints([46, 50])
                .meshes(["OpenSideShelvesBackShelf"])
                .values({ 46: { z: 0 }, 50: { z: 0.097 } })
                .meshes(["OpenSideShelvesSideWall"])
                .values({ 46: { z: 0 }, 50: { z: 0.063 } })
                .build(),
            moveZ: MeshRuleConfigBuilder.create()
                .breakpoints([46, 50])
                .meshes(["OpenSideShelvesMidSWall_Point"])
                .values({ 46: { z: 0 }, 50: { z: 0.045 } })
                .meshes(["OpenSideShelvesSideWall_Point"])
                .values({ 46: { z: 0 }, 50: { z: 0.023 } })
                .build(),
        };
    }

    onInitialize() {
        LoggerService.log(this, `📏 [RuleDepthUDOpenShelvesSide] Initialized for product "${this.productId}"`);
    }

    /**
     * Основне виконання правила.
     */
    execute({ currentState, previousState }) {
        const depth = Number(currentState.get("Depth"));

        if (!this.dataRule.stretchZ.breakpoints.includes(depth)) {
            LoggerService.warn(this, "Unsupported UD open side shelves depth", {
                depth,
            });
            return;
        }

        LoggerService.log(this, `📏 [RuleDepthUDOpenShelvesSide] Executing for depth: ${depth}`, {
            previousDepth: previousState?.get("Depth"),
        });

        this._applyTransformConfig(depth, this.dataRule.stretchZ, (entity, value) =>
            SceneTransformHelper.setStretch(entity, value),
        );
        this._applyTransformConfig(depth, this.dataRule.moveZ, (entity, value) =>
            SceneTransformHelper.setLocalPosition(entity, value),
        );
    }

}
