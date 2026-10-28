import { BaseProductRule } from '../base-product-rule.mjs';
import { LoggerService } from '../../../../services/logger/logger-service.mjs';
import { MeshRuleConfigBuilder } from '../../../../helpers/mesh-rule-config-builder.mjs';
import { SceneEntityHelper } from '../../../../helpers/scene-entity-helper.mjs';
import { SceneTransformHelper } from '../../../../helpers/scene-transform-helper.mjs';

class RuleSidePanelOverlayHeight extends BaseProductRule {
    onInitialize() {
        LoggerService.log(this, `[RuleSidePanelOverlayHeight] Initialized for product "${this.productId}"`);
    }
    execute() {
        // Side panel grain overlays replaced by triplanar rotation.
        return;
    }
    _applyVisibility(height, config) {
        const cfg = config.values;
        const entityNames = Object.keys(cfg);
        let appliedCount = 0;
        entityNames.forEach((baseName)=>{
            const entities = SceneEntityHelper.collectByPredicate(this.context.entity, (e)=>e.name.includes(baseName));
            const state = cfg[baseName][height]; // 'Enable' або 'Disable'
            if (state && entities.length > 0) {
                entities.forEach((entity)=>{
                    SceneTransformHelper.setVisibleByState(entity, state);
                    appliedCount++;
                });
            }
        });
        LoggerService.log(this, `[RuleSidePanelOverlayHeight] Visibility applied`, {
            height,
            appliedCount
        });
    }
    constructor(context){
        super({
            name: 'SidePanelOverlayHeight',
            watchAttributes: [
                'Height',
                'GrainDirection',
                'SidePanelType'
            ],
            priority: 43
        });
        this.context = context;
        this.heightConfig = {
            visibility: MeshRuleConfigBuilder.create().breakpoints([
                50,
                53,
                56
            ])// Height 50
            .meshes([
                'SidePanel_NoG_50H_46D_Panel_Overlay',
                'SidePanel_NoG_50H_50D_Panel_Overlay'
            ]).values({
                50: 'Enable',
                53: 'Disable',
                56: 'Disable'
            })// Height 53
            .meshes([
                'SidePanel_NoG_53H_46D_Panel_Overlay',
                'SidePanel_NoG_53H_50D_Panel_Overlay'
            ]).values({
                50: 'Disable',
                53: 'Enable',
                56: 'Disable'
            })// Height 56
            .meshes([
                'SidePanel_NoG_56H_46D_Panel_Overlay',
                'SidePanel_NoG_56H_50D_Panel_Overlay'
            ]).values({
                50: 'Disable',
                53: 'Disable',
                56: 'Enable'
            }).build()
        };
    }
}

export { RuleSidePanelOverlayHeight };
