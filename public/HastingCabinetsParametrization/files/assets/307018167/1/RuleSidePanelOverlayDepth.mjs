import { BaseProductRule } from '../base-product-rule.mjs';
import { LoggerService } from '../../../../services/logger/logger-service.mjs';
import { MeshRuleConfigBuilder } from '../../../../helpers/mesh-rule-config-builder.mjs';
import { SceneEntityHelper } from '../../../../helpers/scene-entity-helper.mjs';
import { SceneTransformHelper } from '../../../../helpers/scene-transform-helper.mjs';


export class RuleSidePanelOverlayDepth extends BaseProductRule {
    constructor(context) {
        super({
            name: 'SidePanelOverlayDepth',
            watchAttributes: ['Depth', 'GrainDirection'],
            priority: 42
        });

        this.context = context;

        this.depthConfig = {
            visibility: MeshRuleConfigBuilder.create()
                .breakpoints([46, 50.5])
                // Depth 46 Points
                .meshes([
                    'SidePanel_UpperG_46D_Overlay_Point',
                    'SidePanel_CenterG_46D_Overlay_Point',
                    'SidePanels_DoubleG_46D_Overlay_Point',
                    'SidePanels_NoG_46D_Overlay_Point'
                ])
                .values({
                    46: 'Enable',
                    50.5: 'Disable'
                })
                // Depth 50.5 Points
                .meshes([
                    'SidePanel_UpperG_50D_Overlay_Point',
                    'SidePanel_CenterG_50D_Overlay_Point',
                    'SidePanels_DoubleG_50D_Overlay_Point',
                    'SidePanels_NoG_50D_Overlay_Point'
                ])
                .values({
                    46: 'Disable',
                    50.5: 'Enable'
                })
                .build()
        };
    }

    onInitialize() {
        LoggerService.log(
            this,
            `[RuleSidePanelOverlayDepth] Initialized for product "${this.productId}"`
        );
    }

    execute() {
        // Side panel grain overlays replaced by triplanar rotation.
        return;
    }

    _applyVisibility(depth, config) {
        const cfg = config.values;
        const entityNames = Object.keys(cfg);
        let appliedCount = 0;

        entityNames.forEach(baseName => {
            const entities = SceneEntityHelper.collectByPredicate(
                this.context.entity,
                e => e.name.includes(baseName)
            );

            const state = cfg[baseName][depth]; // 'Enable' або 'Disable'

            if (state && entities.length > 0) {
                entities.forEach(entity => {
                    SceneTransformHelper.setVisibleByState(entity, state);
                    appliedCount++;
                });
            }
        });

        LoggerService.log(
            this,
            `[RuleSidePanelOverlayDepth] Visibility applied`,
            { depth, appliedCount }
        );
    }
}
