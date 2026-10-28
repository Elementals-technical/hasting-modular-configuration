import { BaseProductRule } from '../base-product-rule.mjs';
import { LoggerService } from '../../../../services/logger/logger-service.mjs';
import { SceneEntityHelper } from '../../../../helpers/scene-entity-helper.mjs';
import { getGrainRotationAngle } from '../Overlay/grain-rotation-config.mjs';

/**
 * SidePanel Grain Direction — повертає текстури через triplanar rotation.
 * Аналогічно RuleGrainDirection, але для side panel entities.
 */
export class RuleSidePanelOverlayVariant extends BaseProductRule {
    constructor(context) {
        super({
            name: 'SidePanelOverlayVariant',
            watchAttributes: ['SidePanelType', 'GrainDirection', 'CabinetColor'],
            priority: 41
        });

        this.context = context;
    }

    onInitialize() {
        LoggerService.log(
            this,
            `[RuleSidePanelOverlayVariant] Initialized for product "${this.productId}"`
        );
    }

    execute({ currentState }) {
        const sidePanelType = currentState.get('SidePanelType');
        const grainType = currentState.get('GrainDirection');
        const cabinetColor = currentState.get('CabinetColor');
        const entity = this.context.entity;

        if (!sidePanelType || sidePanelType === 'None' || !grainType || grainType === 'None' || !cabinetColor) {
            this._setRotation(entity, 0);
            return;
        }

        const angle = getGrainRotationAngle(cabinetColor, grainType);

        if (angle === null) {
            this._setRotation(entity, 0);
            return;
        }

        this._setRotation(entity, angle);

        LoggerService.log(
            this,
            `[RuleSidePanelOverlayVariant] Applied rotation ${angle}°`,
            { sidePanelType, grainType, cabinetColor }
        );
    }

    _setRotation(rootEntity, angle) {
        const entities = SceneEntityHelper.collectByPredicate(
            rootEntity,
            (e) => e.script?.triPlanarMapping && !e.name.includes('_Overlay')
        );

        entities.forEach((ent) => {
            const triPlanar = ent.script.triPlanarMapping;
            triPlanar.rotationAngle = angle;
            triPlanar.updateUniforms?.();
        });
    }
}
