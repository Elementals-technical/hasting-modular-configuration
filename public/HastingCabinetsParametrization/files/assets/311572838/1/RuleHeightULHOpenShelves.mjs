import { MeshRuleConfigBuilder } from '../../../../../helpers/mesh-rule-config-builder.mjs';
import { BaseProductRule } from '../../base-product-rule.mjs';
import { SceneTransformHelper } from '../../../../../helpers/scene-transform-helper.mjs';
import { LoggerService } from '../../../../../services/logger/logger-service.mjs';

/**
 * ULH-Open-Shelf — Height (cm) → StretchY + MoveY. BaseHeight 0.56 м.
 * MoveY = StretchY / 2 (низ лишається на місці).
 */
export class RuleHeightULHOpenShelves extends BaseProductRule {
    constructor() {
        super({
            name: 'Height-ULH-OpenShelves',
            watchAttributes: ['Height'],
            priority: 20,
        });
        this.dataRule = {
            stretchY: MeshRuleConfigBuilder.create()
                .breakpoints([25, 28, 35, 38])
                .meshes([
                    'OpenShelvesBack',
                    'OpenShelvesSideWalls',
                    'OpenShelvesTopBot',
                ])
                .values({
                    25: { y: -0.31 },
                    28: { y: -0.28 },
                    35: { y: -0.21 },
                    38: { y: -0.18 },
                })
                .build(),

            moveY: MeshRuleConfigBuilder.create()
                .breakpoints([25, 28, 35, 38])
                .meshes([
                    'OpenShelvesMoveBack_Point',
                    'OpenShelvesMoveDivider_Point',
                    'OpenShelvesTopBot_Point',
                    'OpenShelvesSideWalls_Point',
                ])
                .values({
                    25: { y: -0.155 },
                    28: { y: -0.14 },
                    35: { y: -0.105 },
                    38: { y: -0.09 },
                })
                .build(),
        };
    }

    execute({ currentState }) {
        const size = parseFloat(currentState.get('Height'));
        if (Number.isNaN(size)) {
            LoggerService.log(this, 'Invalid ULH shelf size', { attribute: 'Height', size });
            return;
        }
        this._applyTransformConfig(size, this.dataRule.stretchY, (entity, value) => {
            entity.script?.smartStretch?.margin?.set?.(0.1, 0.1, 0.1);
            return SceneTransformHelper.setStretch(entity, value);
        });
        this._applyTransformConfig(size, this.dataRule.moveY, (entity, value) =>
            SceneTransformHelper.setLocalPosition(entity, value));
    }
}
