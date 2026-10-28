import { BaseProductRule } from '../base-product-rule.mjs';
import { LoggerService } from '../../../../services/logger/logger-service.mjs';
import { MeshRuleConfigBuilder } from '../../../../helpers/mesh-rule-config-builder.mjs';
import { SceneEntityHelper } from '../../../../helpers/scene-entity-helper.mjs';
import { SceneTransformHelper } from '../../../../helpers/scene-transform-helper.mjs';

class RuleChangeSidePanelHeight extends BaseProductRule {
    onInitialize() {
        LoggerService.log(this, `📏 [RuleChangeSidePanelHeight] Initialized for product "${this.productId}"`);
    }
    execute({ currentState, previousState }) {
        const height = parseInt(currentState.get('Height'));
        LoggerService.log(this, `📏 [RuleChangeSidePanelHeight] Executing for height: ${height}`, {
            previousHeight: previousState?.get('Height')
        });
        if (Number.isNaN(height)) {
            LoggerService.log(this, '⚠️ [RuleChangeSidePanelHeight] height is NaN, skip');
            return;
        }
        this._applyVisibility(height, this.heightConfig.visibility);
    }
    _applyVisibility(height, entitiesByName) {
        const cfg = entitiesByName.values;
        let appliedCount = 0;
        const entities = SceneEntityHelper.collectByNames(this.context.entity, Object.keys(cfg));
        entities.forEach((entity)=>{
            const configForMesh = cfg[entity.name];
            const value = configForMesh[height];
            if (!value) {
                LoggerService.log(this, '[RuleChangeSidePanelHeight] No value for height', {
                    entityName: entity.name,
                    height
                });
                return;
            }
            SceneTransformHelper.setVisibleByState(entity, value);
            appliedCount++;
        });
        LoggerService.log(this, `✅ [RuleChangeSidePanelHeight] Visibility applied`, {
            height,
            appliedCount
        });
    }
    constructor(context){
        super({
            name: 'ChangeSidePanelHeight',
            watchAttributes: [
                'Height'
            ],
            priority: 20
        });
        this.context = context;
        this.heightConfig = {
            visibility: MeshRuleConfigBuilder.create().breakpoints([
                50,
                53,
                56
            ]).meshes([
                'SidePanel_NoG_50H_50D_Panel',
                'SidePanel_NoG_50H_46D_Panel'
            ]).values({
                50: 'Enable',
                53: 'Disable',
                56: 'Disable'
            }).meshes([
                'SidePanel_NoG_53H_50D_Panel',
                'SidePanel_NoG_53H_46D_Panel'
            ]).values({
                50: 'Disable',
                53: 'Enable',
                56: 'Disable'
            }).meshes([
                'SidePanel_NoG_56H_50D_Panel',
                'SidePanel_NoG_56H_46D_Panel'
            ]).values({
                50: 'Disable',
                53: 'Disable',
                56: 'Enable'
            }).build()
        };
    }
}

export { RuleChangeSidePanelHeight };
