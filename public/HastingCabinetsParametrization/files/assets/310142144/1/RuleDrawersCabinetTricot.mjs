import { Vec3 } from "playcanvas";
import { BaseProductRule } from "../base-product-rule.mjs";
import { LoggerService } from "../../../../services/logger/logger-service.mjs";
import { MeshRuleConfigBuilder } from "../../../../helpers/mesh-rule-config-builder.mjs";
import { SceneEntityHelper } from "../../../../helpers/scene-entity-helper.mjs";
import { SceneTransformHelper } from "../../../../helpers/scene-transform-helper.mjs";

/** Tricot drawer layout: two drawers, one with an inner drawer, or one drawer. */
export class RuleDrawersCabinetTricot extends BaseProductRule {
    constructor() {
        super({ name: "RuleDrawersCabinetTricot", watchAttributes: ["Drawers"], priority: 40 });
        const modes = ["2D", "1DWID", "1D"];
        this.marginTargets = ["Tricot_Bot_Drawer_Handle", "Tricot_Bot_Drawer_Handle_Flut"];
        this.dataRule = {
            visibility: MeshRuleConfigBuilder.create()
                .breakpoints(modes)
                .meshes(["Tricot_TopDrawer"])
                .values({ "2D": "Enable", "1DWID": "Enable", "1D": "Disable" })
                .meshes(["Tricot_BotDrawer"])
                .values({ "2D": "Enable", "1DWID": "Enable", "1D": "Enable" })
                .meshes(["Tricot_Top_Drawer_HandleInner"])
                .values({ "2D": "Disable", "1DWID": "Enable", "1D": "Disable" })
                .meshes([
                    "Tricot_Top_Drawer_Handle_Flut",
                    "Tricot_Top_Drawer_Handle",
                    "Tricot_Top_Drawer_HandleCutout",
                    "Tricot_Cabinet_HGroove_Bot",
                ])
                .values({ "2D": "Enable", "1DWID": "Disable", "1D": "Enable" })
                .build(),
            stretchY: MeshRuleConfigBuilder.create()
                .breakpoints(modes)
                .meshes([...this.marginTargets])
                .values({ "2D": { y: 0 }, "1DWID": { y: 0.2 }, "1D": { y: 0.2 } })
                .build(),
            moveY: MeshRuleConfigBuilder.create()
                .breakpoints(modes)
                .meshes(["Tricot_Bot_Drawer_Handle_Point"])
                .values({ "2D": { y: 0 }, "1DWID": { y: 0.1 }, "1D": { y: 0.1 } })
                .meshes(["Tricot_Bot_Drawer_HandleCutout"])
                .values({ "2D": { y: 0 }, "1DWID": { y: 0.2 }, "1D": { y: 0.2 } })
                .build(),
        };
    }

    execute({ currentState }) {
        const drawers = currentState.get("Drawers");
        if (!this.dataRule.visibility.breakpoints.includes(drawers)) {
            LoggerService.warn(this, "Unsupported Tricot drawer mode", { productId: this.productId, drawers });
            return;
        }
        // Assign through the SmartStretch setter so the mesh is refreshed.
        for (const entity of SceneEntityHelper.collectByNames(this.entity, this.marginTargets)) {
            const script = entity.script?.smartStretch;
            if (!script) {
                LoggerService.warn(this, "Tricot handle SmartStretch is missing", { entityName: entity.name });
                continue;
            }
            const margin = script.margin;
            script.margin = new Vec3(margin?.x ?? 0.07, 0.07, margin?.z ?? 0.07);
        }
        this._applyTransformConfig(drawers, this.dataRule.visibility, (entity, value) =>
            SceneTransformHelper.setVisibleByState(entity, value),
        );
        this._applyTransformConfig(drawers, this.dataRule.stretchY, (entity, value) =>
            SceneTransformHelper.setStretch(entity, value),
        );
        this._applyTransformConfig(drawers, this.dataRule.moveY, (entity, value) =>
            SceneTransformHelper.setLocalPosition(entity, value),
        );
    }
}
