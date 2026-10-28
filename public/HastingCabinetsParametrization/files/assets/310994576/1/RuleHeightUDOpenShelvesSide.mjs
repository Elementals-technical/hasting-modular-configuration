import { Vec3 } from "playcanvas";
import { BaseProductRule } from "../../base-product-rule.mjs";
import { LoggerService } from "../../../../../services/logger/logger-service.mjs";
import { MeshRuleConfigBuilder } from "../../../../../helpers/mesh-rule-config-builder.mjs";
import { SceneEntityHelper } from "../../../../../helpers/scene-entity-helper.mjs";
import { SceneTransformHelper } from "../../../../../helpers/scene-transform-helper.mjs";

// 28: as RuleHeightUDOpenShelves (stretch -0.28, move -0.14). Without it an OSS 28H kept the 56 height
// (unsupported height: warn and return).
// Exported: RuleOpenSideShelfNeighboursUrbanDuplex adds the countertop context on top of these values.
/** SmartStretch margin of the shelf walls (m), the RuleHeightUDOpenShelves value. Exported for the neighbour rule. */
export const UD_OPEN_SHELVES_SIDE_STRETCH_MARGIN_M = 0.1;

export const UD_OPEN_SHELVES_SIDE_HEIGHT_STRETCH_Y = MeshRuleConfigBuilder.create()
    .breakpoints([56, 53, 28])
    .meshes(["OpenSideShelvesMidWall", "OpenSideShelvesBackWall", "OpenSideShelvesSideWall"])
    .values({ 56: { y: 0 }, 53: { y: -0.03 }, 28: { y: -0.28 } })
    .build();

export const UD_OPEN_SHELVES_SIDE_HEIGHT_MOVE_Y = MeshRuleConfigBuilder.create()
    .breakpoints([56, 53, 28])
    .meshes(["OpenSideShelves_Point"])
    .values({ 56: { y: 0 }, 53: { y: -0.015 }, 28: { y: -0.14 } })
    .build();

/** UD open side shelves: Height transforms from the supplied size table. */
export class RuleHeightUDOpenShelvesSide extends BaseProductRule {
    constructor() {
        super({
            name: "RuleHeightUDOpenShelvesSide",
            watchAttributes: ["Height"], // реагуємо на height
            priority: 30,
        });

        this.dataRule = {
            stretchY: UD_OPEN_SHELVES_SIDE_HEIGHT_STRETCH_Y,
            moveY: UD_OPEN_SHELVES_SIDE_HEIGHT_MOVE_Y,
        };
    }

    onInitialize() {
        LoggerService.log(this, `📏 [RuleHeightUDOpenShelvesSide] Initialized for product "${this.productId}"`);
    }

    /**
     * Основне виконання правила.
     */
    execute({ currentState, previousState }) {
        const height = Number(currentState.get("Height"));

        if (!this.dataRule.stretchY.breakpoints.includes(height)) {
            LoggerService.warn(this, "Unsupported UD open side shelves height", {
                height,
            });
            return;
        }

        LoggerService.log(this, `📏 [RuleHeightUDOpenShelvesSide] Executing for height: ${height}`, {
            previousHeight: previousState?.get("Height"),
        });

        // Stretch margin 0.1 m, as RuleHeightUDOpenShelves sets for the same template family. Without it the template
        // margin (~0.15 m) leaves too short a middle to shrink: measured 16.10 at Height 28, the shelf stayed 298.7 mm
        // high instead of 280 (only 262 mm of the 280 came off), and the countertop could not lie on it.
        const stretchMeshes = SceneEntityHelper.collectByNames(this.entity, Object.keys(this.dataRule.stretchY.values));
        for (const mesh of stretchMeshes) {
            const smartStretch = mesh.script?.smartStretch;
            if (smartStretch) smartStretch.margin = new Vec3(
                UD_OPEN_SHELVES_SIDE_STRETCH_MARGIN_M, UD_OPEN_SHELVES_SIDE_STRETCH_MARGIN_M, UD_OPEN_SHELVES_SIDE_STRETCH_MARGIN_M);
        }
        this._applyTransformConfig(height, this.dataRule.stretchY, (entity, value) =>
            SceneTransformHelper.setStretch(entity, value),
        );
        this._applyTransformConfig(height, this.dataRule.moveY, (entity, value) =>
            SceneTransformHelper.setLocalPosition(entity, value),
        );
    }

}
