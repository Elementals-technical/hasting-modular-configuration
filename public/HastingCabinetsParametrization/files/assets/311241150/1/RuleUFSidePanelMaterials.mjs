import { UF_SIDE_PANEL_NODES, UF_SIDE_PANEL_PROFILE } from '../../logic/uf-side-panel-policy.mjs';
import { BaseProductRule } from '../base-product-rule.mjs';
import { SceneEntityHelper } from '../../../../helpers/scene-entity-helper.mjs';
import { LoggerService } from '../../../../services/logger/logger-service.mjs';
import { MaterialService } from '../../../../services/material/material-service.mjs';

const PANEL_NODE_NAMES = [
    UF_SIDE_PANEL_NODES.panelBottom,
    UF_SIDE_PANEL_NODES.panelFull,
    UF_SIDE_PANEL_NODES.panelTop
];

const INLAY_NODE_NAMES = [
    UF_SIDE_PANEL_NODES.inlayBottom,
    UF_SIDE_PANEL_NODES.inlayTop
];

// Mirrors RuleULHSidePanelMaterials with the UF side panel node names.
/**
 * Owns material assignment for the Urban Freestanding side panel template:
 * panels use CabinetColor, inlays use HandleGrooveColor with CabinetColor fallback.
 */
export class RuleUFSidePanelMaterials extends BaseProductRule {
    constructor() {
        super({
            name: 'UFSidePanelMaterials',
            watchAttributes: ['CabinetColor', 'HandleGrooveColor'],
            priority: 35
        });
    }

    /**
     * Applies panel and inlay materials to a UF side panel product.
     * Example: CabinetColor 'White' with HandleGrooveColor 'Black' gives white panels and black inlays.
     */
    async execute({ currentState }) {
        // 1. Only UF side panel products own these nodes.
        if (currentState.get('SidePanelProfile') !== UF_SIDE_PANEL_PROFILE) return;

        // 2. Without a cabinet color there is nothing to apply.
        const cabinetColor = this._normalizeMaterialName(currentState.get('CabinetColor'));
        if (!cabinetColor) {
            LoggerService.log(this, '[RuleUFSidePanelMaterials] CabinetColor is empty, skip');
            return;
        }

        // 3. Inlays follow the groove color when one is set, otherwise the cabinet color.
        const inlayColor = this._resolveInlayColor(currentState, cabinetColor);

        LoggerService.log(this, '[RuleUFSidePanelMaterials] Applying materials', {
            cabinetColor,
            inlayColor
        });

        // 4. Apply in one pass when colors match, otherwise per group.
        if (inlayColor === cabinetColor) {
            await this._applyMaterial(cabinetColor, [...PANEL_NODE_NAMES, ...INLAY_NODE_NAMES]);
            return;
        }

        await this._applyMaterial(cabinetColor, PANEL_NODE_NAMES);
        await this._applyMaterial(inlayColor, INLAY_NODE_NAMES);
    }

    _resolveInlayColor(currentState, cabinetColor) {
        const grooveColor = this._normalizeMaterialName(currentState.get('HandleGrooveColor'));
        const hasGrooveColor = grooveColor && grooveColor !== 'None';
        return hasGrooveColor ? grooveColor : cabinetColor;
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
