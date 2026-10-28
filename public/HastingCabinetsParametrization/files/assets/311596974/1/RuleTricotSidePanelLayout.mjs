import { SceneEntityHelper } from '../../../../../helpers/scene-entity-helper.mjs';
import { SceneTransformHelper } from '../../../../../helpers/scene-transform-helper.mjs';
import { LoggerService } from '../../../../../services/logger/logger-service.mjs';
import {
    TRICOT_SIDE_PANEL_NODES,
    TRICOT_SIDE_PANEL_PROFILE,
    resolveTricotSidePanelPlan
} from '../../../logic/tricot-side-panel-policy.mjs';
import { BaseProductRule } from '../../base-product-rule.mjs';

/**
 * Applies the Tricot side-panel plan to the Tricot_SidePanel template: shows the panel and mirrors it by side.
 * The template has no point node, so the panel mesh itself is mirrored.
 *
 * Example: new RuleTricotSidePanelLayout().execute({ currentState }) // side 'left' → panel scale x −1
 */
export class RuleTricotSidePanelLayout extends BaseProductRule {
    constructor() {
        super({
            name: 'TricotSidePanelLayout',
            watchAttributes: ['SidePanelProfile', 'SidePanelFace', 'side'],
            priority: 25
        });
    }

    execute({ currentState }) {
        // 1. Only Tricot panel products are laid out here.
        if (currentState.get('SidePanelProfile') !== TRICOT_SIDE_PANEL_PROFILE) return;

        // 2. Resolve the plan; an unsupported side or face keeps the previous scene state.
        const plan = resolveTricotSidePanelPlan({
            side: currentState.get('side'),
            face: currentState.get('SidePanelFace') || 'end'
        });
        if (plan.status !== 'resolved') {
            LoggerService.warn(this, '[RuleTricotSidePanelLayout] Layout unresolved', plan);
            return;
        }

        // 3. The panel node must exist before anything is changed.
        const panel = SceneEntityHelper.collectByNames(this.entity, [TRICOT_SIDE_PANEL_NODES.panel])[0];
        if (!panel) {
            LoggerService.warn(this, '[RuleTricotSidePanelLayout] Panel node is missing', {
                node: TRICOT_SIDE_PANEL_NODES.panel
            });
            return;
        }

        // 4. Show the panel and mirror it to the requested side.
        SceneTransformHelper.setVisible(panel, true);
        const scale = panel.getLocalScale();
        panel.setLocalScale(plan.panel.scaleX, scale.y, scale.z);

        LoggerService.log(this, '[RuleTricotSidePanelLayout] Applied', plan);
    }
}
