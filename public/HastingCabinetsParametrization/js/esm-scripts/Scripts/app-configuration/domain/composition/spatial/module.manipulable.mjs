import { defineManipulable } from '../../spatial-manipulation/spec/define.mjs';
import { any, tag, envelope, all, not } from '../../spatial-manipulation/spec/selectors.mjs';
import { edges } from '../../spatial-manipulation/spec/extractors.mjs';
import '../../spatial-manipulation/runtime/world.mjs';
import '../../spatial-manipulation/core/contracts/validators.mjs';
import '../../spatial-manipulation/core/motion/planner.mjs';
import '../../spatial-manipulation/core/snapping/candidates.mjs';
import '../../spatial-manipulation/core/snapping/latch.mjs';
import '../../spatial-manipulation/runtime/instance-support.mjs';
import '../../spatial-manipulation/core/collision/observation.mjs';
import '../../spatial-manipulation/runtime/events.mjs';
import { HASTING_OBSTACLE_ROLES, hastingCollisionProfileFor } from './hasting-collision-profiles.mjs';

const MODULE_MANIPULABLE_ID = 'composition-module';
const U = [
    'min',
    'center',
    'max'
];
const V = [
    'min',
    'max'
];
const EPSILON_M = 1e-6;
const moduleManipulable = defineManipulable({
    id: MODULE_MANIPULABLE_ID,
    frame: {
        plane: 'xy',
        origin: ({ host })=>({
                x: 0,
                y: 0,
                z: host?.fixedZ ?? 0
            })
    },
    motion: {
        axes: [
            'u',
            'v'
        ]
    },
    target: {
        entities: ({ host })=>host?.entity ? [
                host.entity
            ] : null,
        pick: ({ host })=>host?.entity ? [
                host.entity
            ] : null
    },
    snapping: {
        features: {
            self: {
                select: 'self',
                extract: edges({
                    u: U,
                    v: V
                }, {
                    support: [
                        'v.min'
                    ]
                })
            },
            cabinet: {
                select: tag('cabinet'),
                extract: edges({
                    u: U,
                    v: V
                }, {
                    support: [
                        'v.max'
                    ]
                })
            },
            // End panels only: a joint strip is flush with the taller cabinet, so snapping to it would leave a panel-thick gap.
            panel: {
                select: all(tag('side-panel'), not(tag('side-panel-joint'))),
                extract: edges({
                    u: [
                        'min',
                        'max'
                    ]
                })
            },
            row: {
                select: envelope(tag('cabinet'), {
                    id: 'row'
                }),
                extract: edges({
                    u: [
                        'min',
                        'max'
                    ],
                    v: [
                        'min'
                    ]
                })
            }
        },
        rules: [
            // Side by side: my edge against the neighbour's opposite edge (highest priority).
            {
                id: 'u-abut',
                from: [
                    'self.u.min',
                    'self.u.max'
                ],
                to: [
                    'cabinet.u.max',
                    'cabinet.u.min',
                    'panel.u.max',
                    'panel.u.min'
                ],
                op: 'align-u',
                priority: 0
            },
            // The row's outer edges.
            {
                id: 'u-row-edge',
                from: [
                    'self.u.min',
                    'self.u.max'
                ],
                to: [
                    'row.u.min',
                    'row.u.max'
                ],
                op: 'align-u',
                priority: 1
            },
            // Flush edges and centres with a neighbour (e.g. stacked modules).
            {
                id: 'u-flush',
                from: [
                    'self.u.min',
                    'self.u.max'
                ],
                to: [
                    'cabinet.u.min',
                    'cabinet.u.max'
                ],
                op: 'align-u',
                priority: 2
            },
            {
                id: 'u-center',
                from: 'self.u.center',
                to: 'cabinet.u.center',
                op: 'align-u',
                priority: 3
            },
            // Vertical: back to the floor line, level with neighbours, or resting on a module below.
            {
                id: 'v-floor',
                from: 'self.v.min',
                to: 'row.v.min',
                op: 'align-v',
                priority: 0
            },
            {
                id: 'v-stack',
                from: 'self.v.min',
                to: 'cabinet.v.max',
                op: 'align-v',
                priority: 1,
                when: 'overlap-u',
                epsilonM: EPSILON_M
            },
            {
                id: 'v-level',
                from: [
                    'self.v.min',
                    'self.v.max'
                ],
                to: [
                    'cabinet.v.min',
                    'cabinet.v.max'
                ],
                op: 'align-v',
                priority: 2
            }
        ]
    },
    collision: {
        // Touching faces are fine; any real overlap with another module or a side panel is reported.
        epsilonM: 1e-4,
        source: hastingCollisionProfileFor,
        against: any(tag('cabinet'), tag('side-panel')),
        volumes: hastingCollisionProfileFor,
        roles: HASTING_OBSTACLE_ROLES
    }
});

export { MODULE_MANIPULABLE_ID, moduleManipulable };
