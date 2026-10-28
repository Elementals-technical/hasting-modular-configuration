import { MeshRuleConfigBuilder } from '../../../../../helpers/mesh-rule-config-builder.mjs';
import { BaseProductRule } from '../../base-product-rule.mjs';
import { SceneTransformHelper } from '../../../../../helpers/scene-transform-helper.mjs';
import { LoggerService } from '../../../../../services/logger/logger-service.mjs';

/**
 * ULH-Open-Shelf — Depth (cm) → StretchZ + MoveZ.
 * OpenShelvesBack / OpenShelvesMoveBack_Point по Z не змінюються.
 */
export class RuleDepthULHOpenShelves extends BaseProductRule {
    constructor() {
        super({
            name: 'Depth-ULH-OpenShelves',
            watchAttributes: ['Depth'],
            priority: 30,
        });
        this.dataRule = {
            stretchZ: MeshRuleConfigBuilder.create()
                .breakpoints([46, 50])
                .meshes([
                    'OpenShelvesDivider',
                    'OpenShelvesSideWalls',
                    'OpenShelvesTopBot',
                ])
                .values({
                    46: { z: 0 },
                    50: { z: 0.045 },
                })
                .build(),

            moveZ: MeshRuleConfigBuilder.create()
                .breakpoints([46, 50])
                .meshes([
                    'OpenShelvesMoveDivider_Point',
                    'OpenShelvesTopBot_Point',
                    'OpenShelvesSideWalls_Point',
                ])
                .values({
                    46: { z: 0 },
                    50: { z: 0.0225 },
                })
                .build(),
        };
    }

    execute({ currentState }) {
        const size = parseFloat(currentState.get('Depth'));
        if (Number.isNaN(size)) {
            LoggerService.log(this, 'Invalid ULH shelf size', { attribute: 'Depth', size });
            return;
        }
        this._applyTransformConfig(size, this.dataRule.stretchZ, (entity, value) => {
            entity.script?.smartStretch?.margin?.set?.(0.1, 0.1, 0.1);
            return SceneTransformHelper.setStretch(entity, value);
        });
        this._applyTransformConfig(size, this.dataRule.moveZ, (entity, value) =>
            SceneTransformHelper.setLocalPosition(entity, value));
    }
}
