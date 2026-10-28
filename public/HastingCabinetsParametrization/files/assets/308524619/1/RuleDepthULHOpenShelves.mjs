import { MeshRuleConfigBuilder } from '../../../../../helpers/mesh-rule-config-builder.mjs';
import { ULHOpenShelvesSizeRuleBase } from './ulh-open-shelves-size-rule-base.mjs';

/**
 * ULH-Open-Shelf — Depth (cm) → StretchZ + MoveZ.
 * OpenShelvesBack / OpenShelvesMoveBack_Point по Z не змінюються.
 */
export class RuleDepthULHOpenShelves extends ULHOpenShelvesSizeRuleBase {
    constructor() {
        super({
            name: 'Depth-ULH-OpenShelves',
            attribute: 'Depth',
            priority: 30,
            stretch: MeshRuleConfigBuilder.create()
                .breakpoints([46, 50.5])
                .meshes([
                    'OpenShelvesDivider',
                    'OpenShelvesSideWalls',
                    'OpenShelvesTopBot',
                ])
                .values({
                    46: { z: 0 },
                    50.5: { z: 0.045 },
                })
                .build(),

            move: MeshRuleConfigBuilder.create()
                .breakpoints([46, 50.5])
                .meshes([
                    'OpenShelvesMoveDivider_Point',
                    'OpenShelvesTopBot_Point',
                    'OpenShelvesSideWalls_Point',
                ])
                .values({
                    46: { z: 0 },
                    50.5: { z: 0.0225 },
                })
                .build(),
        });
    }
}
