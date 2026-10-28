import { SceneEntityHelper } from '../../../../../helpers/scene-entity-helper.mjs';
import { SceneTransformHelper } from '../../../../../helpers/scene-transform-helper.mjs';
import { LoggerService } from '../../../../../services/logger/logger-service.mjs';
import {
    ULH_SIDE_PANEL_NODES,
    ULH_SIDE_PANEL_PROFILE,
    resolveULHSidePanelPlan
} from '../../../logic/ulh-side-panel-policy.mjs';
import { BaseProductRule } from '../../base-product-rule.mjs';

export class RuleULHSidePanelLayout extends BaseProductRule {
    constructor() {
        super({
            name: 'ULHSidePanelLayout',
            watchAttributes: [
                'SidePanelProfile', 'SidePanelType', 'Handle', 'Height', 'Depth', 'side'
            ],
            priority: 25
        });
    }

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

        const names = Object.values(ULH_SIDE_PANEL_NODES);
        const byName = new Map();
        for (const entity of SceneEntityHelper.collectByNames(this.entity, names)) {
            if (!byName.has(entity.name)) byName.set(entity.name, entity);
        }
        const point = byName.get(ULH_SIDE_PANEL_NODES.point);
        const panel = byName.get(ULH_SIDE_PANEL_NODES.panel);
        const inlay = byName.get(ULH_SIDE_PANEL_NODES.inlay);
        if (!point || !panel || !inlay) {
            LoggerService.warn(this, '[RuleULHSidePanelLayout] Required scene nodes are missing', {
                point: Boolean(point),
                panel: Boolean(panel),
                inlay: Boolean(inlay)
            });
            return;
        }

        this.dataRule = {
            visibility: { values: {
                [point.name]: { layout: plan.point.visible },
                [panel.name]: { layout: plan.panel.visible },
                [inlay.name]: { layout: plan.inlay.visible }
            } },
            scaleX: { values: { [point.name]: { layout: plan.point.scaleX } } },
            stretch: { values: {
                [panel.name]: { layout: { y: plan.panel.stretchY, z: plan.panel.stretchZ } },
                [inlay.name]: { layout: { y: plan.inlay.stretchY, z: plan.inlay.stretchZ } }
            } },
            moveY: { values: { [inlay.name]: { layout: { y: plan.inlay.moveY } } } }
        };
        // Preserve first-match selection and validate the entire template before changing any node.
        const apply = (configuration, applyValue) => this._applyTransformConfig('layout', configuration, (entity, value) => {
            if (byName.get(entity.name) === entity) return applyValue(entity, value);
        });
        apply(this.dataRule.visibility, (entity, value) => SceneTransformHelper.setVisible(entity, value));
        apply(this.dataRule.scaleX, (entity, value) => {
            const scale = entity.getLocalScale();
            entity.setLocalScale(value, scale.y, scale.z);
        });
        apply(this.dataRule.stretch, (entity, value) => SceneTransformHelper.setStretch(entity, value));
        apply(this.dataRule.moveY, (entity, value) => {
            const position = entity.getLocalPosition();
            entity.setLocalPosition(position.x, value.y, position.z);
        });

        LoggerService.log(this, '[RuleULHSidePanelLayout] Applied', plan);
    }

}
