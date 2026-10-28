import { BaseProductRule } from "../base-product-rule.mjs";
import { LoggerService } from "../../../../services/logger/logger-service.mjs";
import { MeshRuleConfigBuilder } from "../../../../helpers/mesh-rule-config-builder.mjs";
import { SceneTransformHelper } from "../../../../helpers/scene-transform-helper.mjs";

export class RuleDrawersCabinetClass extends BaseProductRule {
    constructor() {
        super({
            name: "RuleDrawersCabinetClass",
            watchAttributes: ["Drawers", "InnerDrawer", "Height"],
            priority: 40,
        });

        this.valuesInnerDrawer = ["Disable", "Enable"];

        this.dataRule = {
            stretchY: MeshRuleConfigBuilder.create()
                .breakpoints([40, 52])
                .meshes(["Class_Bot_Drawer_HFrame", "Class_Bot_Drawer_HInsert"])
                .values({
                    40: { y: 0.142 },
                    52: { y: 0 },
                })
                .build(),

            moveY: MeshRuleConfigBuilder.create()
                .breakpoints([40, 52])
                .meshes(["Class_Bot_Drawer_HPoint"])
                .values({
                    40: { y: 0.07 },
                    52: { y: 0 },
                })
                .build(),

            visibility: MeshRuleConfigBuilder.create()
                .breakpoints(["1D", "2D", "1D-with-inner"])
                .meshes(["Class_Top_Drawer"])
                .values({
                    "1D": "Disable",
                    "2D": "Enable",
                    "1D-with-inner": "Enable",
                })
                .meshes(["Class_Top_Drawer_HInner"])
                .values({
                    "1D": "Disable",
                    "2D": "Disable",
                    "1D-with-inner": "Enable",
                })
                .meshes(["Class_Top_Drawer_HFrame", "Class_Top_Drawer_HInsert"])
                .values({
                    "1D": "Disable",
                    "2D": "Enable",
                    "1D-with-inner": "Disable",
                })
                .build(),
        };
    }

    onInitialize() {
        LoggerService.log(this, `📏 [RuleDrawersCabinetClass] Initialized for product "${this.productId}"`);
    }

    execute({ currentState, previousState }) {
        const height = Number(currentState.get("Height"));
        const drawers = currentState.get("Drawers");
        const innerDrawer = currentState.get("InnerDrawer") ?? "Disable";

        LoggerService.log(this, `📏 [RuleDrawersCabinetClass] Executing for height: ${height}`, {
            previousHeight: previousState?.get("Height"),
        });

        if (height !== 40 && height !== 52) {
            LoggerService.warn(this, "Unsupported Class cabinet height", {
                productId: this.productId,
                height,
            });
            return;
        }

        const mode = this._resolveMode({ drawers, height, innerDrawer });

        this._applyTransformConfig(height, this.dataRule.stretchY, (entity, value) => {
            SceneTransformHelper.setStretch(entity, value);
        });

        this._applyTransformConfig(height, this.dataRule.moveY, (entity, value) => {
            SceneTransformHelper.setLocalPosition(entity, value);
        });

        this._applyTransformConfig(mode, this.dataRule.visibility, (entity, value) => {
            SceneTransformHelper.setVisibleByState(entity, value);
        });

        LoggerService.log(this, "Class drawer configuration applied", {
            productId: this.productId,
            height,
            drawers,
            innerDrawer,
            mode,
        });
    }

    _resolveMode({ drawers, height, innerDrawer }) {
        const value = String(drawers ?? "").trim().toUpperCase();
        if (["2", "2D", "2DW"].includes(value)) return "2D";
        if (["1+INNER", "1DWID", "1D-WITH-INNER"].includes(value)) return "1D-with-inner";
        if (["1", "1D", "1DW"].includes(value)) return "1D";

        // Backward-compatible fallback for configurations saved before Drawers
        // became authoritative for Class drawer visibility.
        return height === 52 ? "2D" : innerDrawer === "Enable" ? "1D-with-inner" : "1D";
    }

}
