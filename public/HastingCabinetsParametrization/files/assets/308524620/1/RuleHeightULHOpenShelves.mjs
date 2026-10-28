import { MeshRuleConfigBuilder } from '../../../../../helpers/mesh-rule-config-builder.mjs';
import { ULHOpenShelvesSizeRuleBase } from './ulh-open-shelves-size-rule-base.mjs';

/**
 * ULH-Open-Shelf — Height (cm) → StretchY + MoveY. BaseHeight 0.56 м.
 * MoveY = StretchY / 2 (низ лишається на місці).
 */
export class RuleHeightULHOpenShelves extends ULHOpenShelvesSizeRuleBase {
    constructor() {
        super({
            name: 'Height-ULH-OpenShelves',
            attribute: 'Height',
            priority: 20,
            stretch: MeshRuleConfigBuilder.create()
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

            move: MeshRuleConfigBuilder.create()
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
        });
    }
}
