import { MeshRuleConfigBuilder } from '../../../../../helpers/mesh-rule-config-builder.mjs';
import { ULHOpenShelvesSizeRuleBase } from './ulh-open-shelves-size-rule-base.mjs';

/** ULH-Open-Shelf — Width (cm) → StretchX. BaseWidth 0.6 м. */
export class RuleWidthULHOpenShelves extends ULHOpenShelvesSizeRuleBase {
    constructor() {
        super({
            name: 'Width-ULH-OpenShelves',
            attribute: 'Width',
            priority: 10,
            stretch: MeshRuleConfigBuilder.create()
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
        });
    }
}
