import { Vec3 } from 'playcanvas';
import { BaseProductRule } from "../../base-product-rule.mjs";
import { LoggerService } from "../../../../../services/logger/logger-service.mjs";
import { MeshRuleConfigBuilder } from "../../../../../helpers/mesh-rule-config-builder.mjs";
import { SceneEntityHelper } from "../../../../../helpers/scene-entity-helper.mjs";
import { SceneTransformHelper } from "../../../../../helpers/scene-transform-helper.mjs";

/** UD open shelves: Height transforms from the supplied size table. */
export class RuleHeightUDOpenShelves extends BaseProductRule {
    constructor() {
        super({
            name: "RuleHeightUDOpenShelves",
            watchAttributes: ["Height"], // реагуємо на height
            priority: 30,
        });

        this.dataRule = {
            stretchY: MeshRuleConfigBuilder.create().breakpoints([56, 53, 38, 28]).meshes(['OpenShelvesBack', 'OpenShelvesSideWalls', 'OpenShelvesTopBot']).values({56: {y: 0},53: {y: -0.03},38: {y: -0.18},28: {y: -0.28}}).build(),
            moveY: MeshRuleConfigBuilder.create().breakpoints([56, 53, 38, 28]).meshes(['OpenShelvesMoveBack_Point', 'OpenShelvesMoveDivider_Point', 'OpenShelvesSideWalls_Point', 'OpenShelvesTopBot_Point']).values({56: {y: 0},53: {y: -0.015},38: {y: -0.09},28: {y: -0.14}}).build(),
            visibility: MeshRuleConfigBuilder.create().breakpoints([56,53,38,28]).meshes(['OpenShelvesDivider']).values({56:'Enable',53:'Enable',38:'Disable',28:'Disable'}).build()
        };
    }

    onInitialize() {
        LoggerService.log(this, `📏 [RuleHeightUDOpenShelves] Initialized for product "${this.productId}"`);
    }

    /**
     * Основне виконання правила.
     */
    execute({ currentState, previousState }) {
        const height = Number(currentState.get("Height"));

        if (!this.dataRule.stretchY.breakpoints.includes(height)) {
            LoggerService.warn(this, "Unsupported UD open shelves height", {
                height,
            });
            return;
        }

        LoggerService.log(this, `📏 [RuleHeightUDOpenShelves] Executing for height: ${height}`, {
            previousHeight: previousState?.get("Height"),
        });

        // Table: BaseHeight 0.56 m, stretch margin 0.1 m.
        for (const entity of SceneEntityHelper.collectByNames(this.entity, ['OpenShelvesBack', 'OpenShelvesSideWalls', 'OpenShelvesTopBot'])) {
            const stretch = entity.script?.smartStretch;
            if (stretch) stretch.margin = new Vec3(0.1, 0.1, 0.1);
        }
        this._applyTransformConfig(height, this.dataRule.stretchY, (entity, value) => SceneTransformHelper.setStretch(entity, value));
        this._applyTransformConfig(height, this.dataRule.moveY, (entity, value) => SceneTransformHelper.setLocalPosition(entity, value));
        this._applyTransformConfig(height, this.dataRule.visibility, (entity, value) => SceneTransformHelper.setVisibleByState(entity, value));
    }

}
