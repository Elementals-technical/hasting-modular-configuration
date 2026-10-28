import { SceneEntityHelper } from '../../../../helpers/scene-entity-helper.mjs';
import { SceneTransformHelper } from '../../../../helpers/scene-transform-helper.mjs';
import { LoggerService } from '../../../../services/logger/logger-service.mjs';
import { ULH_SIDE_PANEL_PROFILE, resolveULHSidePanelPlan, ULH_SIDE_PANEL_NODES } from '../../logic/ulh-side-panel-policy.mjs';
import { BaseProductRule } from '../base-product-rule.mjs';

class RuleULHSidePanelLayout extends BaseProductRule {
    execute({ currentState }) {
        if (currentState.get('SidePanelProfile') !== ULH_SIDE_PANEL_PROFILE) return;
        const plan = resolveULHSidePanelPlan({
            handle: currentState.get('Handle'),
            requestedType: currentState.get('SidePanelType'),
            height: currentState.get('Height'),
            depth: currentState.get('Depth'),
            side: currentState.get('side')
        });
        if (plan.status !== 'resolved') {
            LoggerService.warn(this, '[RuleULHSidePanelLayout] Layout unresolved', plan);
            return;
        }
        const point = this._find(ULH_SIDE_PANEL_NODES.point);
        const panel = this._find(ULH_SIDE_PANEL_NODES.panel);
        const inlay = this._find(ULH_SIDE_PANEL_NODES.inlay);
        if (!point || !panel || !inlay) {
            LoggerService.warn(this, '[RuleULHSidePanelLayout] Required scene nodes are missing', {
                point: Boolean(point),
                panel: Boolean(panel),
                inlay: Boolean(inlay)
            });
            return;
        }
        SceneTransformHelper.setVisible(point, plan.point.visible);
        SceneTransformHelper.setVisible(panel, plan.panel.visible);
        SceneTransformHelper.setVisible(inlay, plan.inlay.visible);
        const scale = point.getLocalScale();
        point.setLocalScale(plan.point.scaleX, scale.y, scale.z);
        SceneTransformHelper.setStretch(panel, {
            y: plan.panel.stretchY,
            z: plan.panel.stretchZ
        });
        SceneTransformHelper.setStretch(inlay, {
            y: plan.inlay.stretchY,
            z: plan.inlay.stretchZ
        });
        const inlayPosition = inlay.getLocalPosition();
        inlay.setLocalPosition(inlayPosition.x, plan.inlay.moveY, inlayPosition.z);
        LoggerService.log(this, '[RuleULHSidePanelLayout] Applied', plan);
    }
    _find(name) {
        return SceneEntityHelper.collectByNames(this.entity, [
            name
        ])[0] || null;
    }
    constructor(){
        super({
            name: 'ULHSidePanelLayout',
            watchAttributes: [
                'SidePanelProfile',
                'SidePanelType',
                'Handle',
                'Height',
                'Depth',
                'side'
            ],
            priority: 25
        });
    }
}

export { RuleULHSidePanelLayout };
