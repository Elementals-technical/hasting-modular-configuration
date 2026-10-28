import { SceneEntityHelper } from '../../../../helpers/scene-entity-helper.mjs';
import { SceneTransformHelper } from '../../../../helpers/scene-transform-helper.mjs';
import { LoggerService } from '../../../../services/logger/logger-service.mjs';
import { UF_SIDE_PANEL_PROFILE, resolveUFSidePanelPlan, UF_SIDE_PANEL_FACES, UF_SIDE_PANEL_NODES, UF_SIDE_PANEL_PART_NAMES } from '../../logic/uf-side-panel-policy.mjs';
import { ufHeightOf } from '../../logic/uf-cabinet-height-policy.mjs';
import { BaseProductRule } from '../base-product-rule.mjs';

/**
 * Applies the UF side-panel plan (end or joint face) to the UF_SidePanel template:
 * mirrors the point by side, shows the parts for the cabinet Height and Handle (both copied from
 * the cabinet; 91 Central Groove has its own parts), stretches them by depth (Panel_Top also by height)
 * and sets the Panel_Top Y the plan gives.
 *
 * Example: new RuleUFSidePanelLayout().execute({ currentState }) // Height 91, side 'left'
 */ class RuleUFSidePanelLayout extends BaseProductRule {
    execute({ currentState }) {
        // 1. Only UF panel products are laid out here.
        if (currentState.get('SidePanelProfile') !== UF_SIDE_PANEL_PROFILE) return;
        // 2. Resolve the plan; an unsupported combination keeps the previous scene state.
        const plan = resolveUFSidePanelPlan({
            side: currentState.get('side'),
            face: currentState.get('SidePanelFace') || UF_SIDE_PANEL_FACES.end,
            height: ufHeightOf(currentState),
            depth: currentState.get('Depth'),
            neighbourHeight: currentState.get('SidePanelNeighbourHeight'),
            handle: currentState.get('Handle')
        });
        if (plan.status !== 'resolved') {
            LoggerService.warn(this, '[RuleUFSidePanelLayout] Layout unresolved', plan);
            return;
        }
        // 3. Every node of the template must exist before anything is changed.
        const point = this._find(UF_SIDE_PANEL_NODES.point);
        const parts = UF_SIDE_PANEL_PART_NAMES.map((partName)=>this._find(partName));
        if (!point || parts.includes(null)) {
            LoggerService.warn(this, '[RuleUFSidePanelLayout] Required scene nodes are missing', {
                point: Boolean(point),
                missingParts: UF_SIDE_PANEL_PART_NAMES.filter((partName, index)=>!parts[index])
            });
            return;
        }
        // 4. Show and mirror the point, then apply each part's visibility, stretch and lift.
        this._applyPointSide(point, plan.point);
        parts.forEach((part)=>this._applyPartLayout(part, plan.parts[part.name]));
        LoggerService.log(this, '[RuleUFSidePanelLayout] Applied', plan);
    }
    _applyPointSide(point, pointPlan) {
        SceneTransformHelper.setVisible(point, true);
        const scale = point.getLocalScale();
        point.setLocalScale(pointPlan.scaleX, scale.y, scale.z);
    }
    _applyPartLayout(part, partPlan) {
        SceneTransformHelper.setVisible(part, partPlan.visible);
        SceneTransformHelper.setStretch(part, partPlan.stretch);
        const position = part.getLocalPosition();
        part.setLocalPosition(position.x, partPlan.moveY, position.z);
    }
    _find(name) {
        return SceneEntityHelper.collectByNames(this.entity, [
            name
        ])[0] || null;
    }
    constructor(){
        super({
            name: 'UFSidePanelLayout',
            watchAttributes: [
                'SidePanelProfile',
                'SidePanelFace',
                'SidePanelNeighbourHeight',
                'Height',
                'Handle',
                'Depth',
                'side'
            ],
            priority: 25
        });
    }
}

export { RuleUFSidePanelLayout };
