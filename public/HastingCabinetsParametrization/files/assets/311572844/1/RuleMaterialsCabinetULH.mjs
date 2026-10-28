import { SceneEntityHelper } from '../../../../helpers/scene-entity-helper.mjs';
import { LoggerService } from '../../../../services/logger/logger-service.mjs';
import { MaterialService } from '../../../../services/material/material-service.mjs';
import { BaseProductRule } from '../base-product-rule.mjs';

export const ULH_CABINET_GROOVE_NODE = 'ULH_Cabinet_HGroove';

/** Exterior ULH meshes that always inherit the user-selected cabinet finish. */
export const ULH_CABINET_EXTERIOR_NODES = Object.freeze([
    'ULH_Cabinet_Walls',
    'ULH_Cabinet_SCBackWall',
    'ULH_Cabinet_HBracket',
    'ULH_Drawer_HNoCut',
    'ULH_Drawer_HTopCut',
    'ULH_Overlay_HNoCut',
    'ULH_Overlay_HTopCut'
]);

/** All authored finish meshes, kept as the public compatibility list used by tests/tools. */
export const ULH_CABINET_MATERIAL_NODES = Object.freeze([
    ...ULH_CABINET_EXTERIOR_NODES.slice(0, 3),
    ULH_CABINET_GROOVE_NODE,
    ...ULH_CABINET_EXTERIOR_NODES.slice(3)
]);

/** Applies CabinetColor to the authored exterior meshes of both ULH cabinet variants. */
export class RuleMaterialsCabinetULH extends BaseProductRule {
    constructor(context = null) {
        super({
            name: 'RuleMaterialsCabinetULH',
            watchAttributes: ['CabinetColor', 'HandleGrooveColor', 'Handle'],
            priority: 50
        });

        this.context = context;
    }

    async execute({ currentState, previousState }) {
        const cabinetColor = this._materialName(currentState.get('CabinetColor'));
        const handle = currentState.get('Handle');
        const requestedGrooveColor = this._materialName(currentState.get('HandleGrooveColor'));
        const grooveColor = handle === 'handle_urban_topcut' && requestedGrooveColor
            ? requestedGrooveColor
            : cabinetColor;
        if (!cabinetColor && !grooveColor) {
            LoggerService.log(this, '[ULH materials] CabinetColor and active groove color are empty, skip');
            return;
        }

        const exteriorTargets = SceneEntityHelper.collectByNames(
            this.entity,
            ULH_CABINET_EXTERIOR_NODES
        );
        const grooveTargets = SceneEntityHelper.collectByNames(
            this.entity,
            [ULH_CABINET_GROOVE_NODE]
        );
        const allTargets = SceneEntityHelper.collectByNames(
            this.entity,
            ULH_CABINET_MATERIAL_NODES
        );
        if (exteriorTargets.length === 0 && grooveTargets.length === 0) {
            LoggerService.warn(this, '[ULH materials] No authored cabinet material targets found', {
                productId: this.productId
            });
            return;
        }

        LoggerService.log(this, '[ULH materials] Applying CabinetColor', {
            productId: this.productId,
            cabinetColor,
            grooveColor,
            previousCabinetColor: previousState?.get('CabinetColor'),
            previousGrooveColor: previousState?.get('HandleGrooveColor'),
            exteriorTargets: exteriorTargets.map(entity => entity.name),
            grooveTargets: grooveTargets.map(entity => entity.name)
        });
        if (cabinetColor) {
            const cabinetTargets = grooveColor === cabinetColor
                ? allTargets
                : exteriorTargets;
            if (cabinetTargets.length) await MaterialService.applyMaterialByName(cabinetColor, cabinetTargets);
        }
        if (grooveColor && grooveColor !== cabinetColor && grooveTargets.length) {
            await MaterialService.applyMaterialByName(grooveColor, grooveTargets);
        }
    }

    _materialName(value) {
        const name = String(value ?? '').trim();
        return !name || name === 'None' ? null : name;
    }
}
