import { BaseProductRule } from '../base-product-rule.mjs';
import { LoggerService } from '../../../../services/logger/logger-service.mjs';
import { MeshRuleConfigBuilder } from '../../../../helpers/mesh-rule-config-builder.mjs';
import { SceneEntityHelper } from '../../../../helpers/scene-entity-helper.mjs';
import { SceneTransformHelper } from '../../../../helpers/scene-transform-helper.mjs';

class RuleChangeSidePanelDepth extends BaseProductRule {
    onInitialize() {
        LoggerService.log(this, `📏 [RuleChangeSidePanelDepth] Initialized for product "${this.productId}"`);
    }
    execute({ currentState, previousState }) {
        const depth = currentState.get('Depth');
        LoggerService.log(this, `📏 [RuleChangeSidePanelDepth] Executing for depth: ${depth}`, {
            previousDepth: previousState?.get('Depth')
        });
        if (depth === undefined || depth === null || Number.isNaN(depth)) {
            LoggerService.log(this, '⚠️ [RuleChangeSidePanelDepth] depth is invalid, skip');
            return;
        }
        this._applyVisibility(depth, this.depthConfig.visibility);
    }
    _applyVisibility(depth, entitiesByName) {
        const cfg = entitiesByName.values;
        let appliedCount = 0;
        const entities = SceneEntityHelper.collectByNames(this.context.entity, Object.keys(cfg));
        entities.forEach((entity)=>{
            const configForMesh = cfg[entity.name];
            const value = configForMesh[depth];
            if (!value) {
                LoggerService.log(this, '[RuleChangeSidePanelDepth] No value for depth', {
                    entityName: entity.name,
                    depth
                });
                return;
            }
            SceneTransformHelper.setVisibleByState(entity, value);
            appliedCount++;
        });
        LoggerService.log(this, `✅ [RuleChangeSidePanelDepth] Visibility applied`, {
            depth,
            appliedCount
        });
    }
    constructor(context){
        super({
            name: 'ChangeSidePanelDepth',
            watchAttributes: [
                'Depth'
            ],
            priority: 30
        });
        this.context = context;
        this.depthConfig = {
            visibility: MeshRuleConfigBuilder.create().breakpoints([
                46,
                50.5
            ]).meshes([
                'SidePanel_UpperG_46D_Point',
                'SidePanel_CenterG_46D_Point',
                'SidePanels_DoubleG_46D_Point',
                'SidePanels_NoG_46D_Point'
            ]).values({
                46: 'Enable',
                50.5: 'Disable'
            }).meshes([
                'SidePanel_UpperG_50D_Point',
                'SidePanel_CenterG_50D_Point',
                'SidePanels_DoubleG_50D_Point',
                'SidePanels_NoG_50D_Point'
            ]).values({
                46: 'Disable',
                50.5: 'Enable'
            }).build()
        };
    }
}

export { RuleChangeSidePanelDepth };
