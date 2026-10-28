import { MeshRuleConfigBuilder } from '../../../../../helpers/mesh-rule-config-builder.mjs';
import { BaseProductRule } from '../../base-product-rule.mjs';
import { SceneTransformHelper } from '../../../../../helpers/scene-transform-helper.mjs';
import { LoggerService } from '../../../../../services/logger/logger-service.mjs';

/** ULH-Open-Shelf — Width (cm) → StretchX. BaseWidth 0.6 м. */
export class RuleWidthULHOpenShelves extends BaseProductRule {
    constructor() {
        super({
            name: 'Width-ULH-OpenShelves',
            watchAttributes: ['Width'],
            priority: 10,
        });
        this.dataRule = {
            stretchX: MeshRuleConfigBuilder.create()
                .breakpoints([25, 35, 50, 60, 70, 80, 90, 105, 120])
                .meshes([
                    'OpenShelvesBack',
                    'OpenShelvesDivider',
                    'OpenShelvesSideWalls',
                    'OpenShelvesTopBot',
                ])
                .values({
                    25: { x: -0.35 },
                    35: { x: -0.25 },
                    50: { x: -0.1 },
                    60: { x: 0 },
                    70: { x: 0.1 },
                    80: { x: 0.2 },
                    90: { x: 0.3 },
                    105: { x: 0.45 },
                    120: { x: 0.6 },
                })
                .build(),
        };
    }

    execute({ currentState }) {
        const size = parseFloat(currentState.get('Width'));
        if (Number.isNaN(size)) {
            LoggerService.log(this, 'Invalid ULH shelf size', { attribute: 'Width', size });
            return;
        }
        this._applyTransformConfig(size, this.dataRule.stretchX, (entity, value) => {
            entity.script?.smartStretch?.margin?.set?.(0.1, 0.1, 0.1);
            return SceneTransformHelper.setStretch(entity, value);
        });
    }
}
