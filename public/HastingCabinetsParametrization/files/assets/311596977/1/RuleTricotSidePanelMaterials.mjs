import { SceneEntityHelper } from '../../../../../helpers/scene-entity-helper.mjs';
import { LoggerService } from '../../../../../services/logger/logger-service.mjs';
import { MaterialService } from '../../../../../services/material/material-service.mjs';
import { TRICOT_SIDE_PANEL_NODES, TRICOT_SIDE_PANEL_PROFILE } from '../../../logic/tricot-side-panel-policy.mjs';
import { BaseProductRule } from '../../base-product-rule.mjs';

/**
 * Tricot side panel material: the panel follows the cabinet color, not the front pattern (guide sheet Tricot, row 115).
 * Example: CabinetColor 'Antracite Matte OCF' paints Tricot_SidePanel_Panel with that material.
 */
export class RuleTricotSidePanelMaterials extends BaseProductRule {
    constructor() {
        super({
            name: 'TricotSidePanelMaterials',
            watchAttributes: ['CabinetColor'],
            priority: 35
        });
    }

    async execute({ currentState }) {
        // 1. Only Tricot side panel products own this node.
        if (currentState.get('SidePanelProfile') !== TRICOT_SIDE_PANEL_PROFILE) return;

        // 2. Without a cabinet color there is nothing to apply.
        const cabinetColor = String(currentState.get('CabinetColor') ?? '').trim();
        if (!cabinetColor) {
            LoggerService.log(this, '[RuleTricotSidePanelMaterials] CabinetColor is empty, skip');
            return;
        }

        // 3. Paint the panel with the cabinet color.
        const panels = SceneEntityHelper.collectByNames(this.entity, [TRICOT_SIDE_PANEL_NODES.panel]);
        if (panels.length === 0) return;
        await MaterialService.applyMaterialByName(cabinetColor, panels);
    }
}
