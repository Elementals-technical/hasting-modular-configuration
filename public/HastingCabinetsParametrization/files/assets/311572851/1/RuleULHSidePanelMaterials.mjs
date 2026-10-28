import { ULH_SIDE_PANEL_NODES } from '../../../logic/ulh-side-panel-policy.mjs';
import { BaseProductRule } from '../../base-product-rule.mjs';
import { SceneEntityHelper } from '../../../../../helpers/scene-entity-helper.mjs';
import { LoggerService } from '../../../../../services/logger/logger-service.mjs';
import { MaterialService } from '../../../../../services/material/material-service.mjs';

/**
 * Owns material assignment for the single-template Urban Low Height side panel.
 */
export class RuleULHSidePanelMaterials extends BaseProductRule {
    constructor(context = null) {
        super({
            name: 'ULHSidePanelMaterials',
            watchAttributes: ['CabinetColor', 'HandleGrooveColor'],
            priority: 35
        });

        this.context = context;
    }

    async execute({ currentState, previousState }) {
        const cabinetColor = this._normalizeMaterialName(currentState.get('CabinetColor'));
        if (!cabinetColor) {
            LoggerService.log(this, '[RuleULHSidePanelMaterials] CabinetColor is empty, skip');
            return;
        }

        const grooveColor = this._normalizeMaterialName(currentState.get('HandleGrooveColor'));
        const inlayColor = grooveColor && grooveColor !== 'None'
            ? grooveColor
            : cabinetColor;

        LoggerService.log(this, '[RuleULHSidePanelMaterials] Applying materials', {
            cabinetColor,
            inlayColor,
            previousCabinetColor: previousState?.get('CabinetColor'),
            previousGrooveColor: previousState?.get('HandleGrooveColor')
        });

        if (inlayColor === cabinetColor) {
            await this._applyMaterial(cabinetColor, [
                ULH_SIDE_PANEL_NODES.panel,
                ULH_SIDE_PANEL_NODES.inlay
            ]);
            return;
        }

        await this._applyMaterial(cabinetColor, [ULH_SIDE_PANEL_NODES.panel]);
        await this._applyMaterial(inlayColor, [ULH_SIDE_PANEL_NODES.inlay]);
    }

    async _applyMaterial(materialName, targetNames) {
        const entities = SceneEntityHelper.collectByNames(this.entity, targetNames);
        if (entities.length === 0) return;
        await MaterialService.applyMaterialByName(materialName, entities);
    }

    _normalizeMaterialName(value) {
        if (value === undefined || value === null) return null;
        const normalized = String(value).trim();
        return normalized || null;
    }
}
