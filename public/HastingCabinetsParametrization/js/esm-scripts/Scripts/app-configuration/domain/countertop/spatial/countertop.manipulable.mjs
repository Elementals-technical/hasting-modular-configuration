import { defineManipulable } from '../../spatial-manipulation/spec/define.mjs';
import { any, tag } from '../../spatial-manipulation/spec/selectors.mjs';
import '../../spatial-manipulation/runtime/world.mjs';
import '../../spatial-manipulation/core/contracts/validators.mjs';
import '../../spatial-manipulation/core/motion/planner.mjs';
import '../../spatial-manipulation/core/snapping/candidates.mjs';
import '../../spatial-manipulation/core/snapping/latch.mjs';
import '../../spatial-manipulation/runtime/instance-support.mjs';
import '../../spatial-manipulation/core/collision/observation.mjs';
import '../../spatial-manipulation/runtime/events.mjs';
import { createEntityGroupPose } from '../../spatial-manipulation/playcanvas/entity-group-pose.mjs';
import { HASTING_OBSTACLE_ROLES, hastingCollisionProfileFor, resolveHastingCollisionProfile } from '../../composition/spatial/hasting-collision-profiles.mjs';
import { compositionSnapTargets } from './countertop-snap-targets.mjs';

const COUNTERTOP_MANIPULABLE_ID = 'countertop';
const EPSILON_M = 1e-9;
// ---------------------------------------------------------------------------
// Features
// ---------------------------------------------------------------------------
const axis = (a, valueM)=>({
        kind: 'axis',
        axis: a,
        valueM
    });
const point = (u, v)=>({
        kind: 'point',
        pointM: {
            u,
            v
        }
    });
/** The countertop's own edges, centre and corners (`ct.*`). */ const countertopFeatures = (body)=>{
    const { min, max } = body.boundsUV;
    const f = (featureId, role, geometry)=>({
            key: featureId,
            featureId,
            role,
            geometry
        });
    return [
        f('ct.left', 'ct-left', axis('u', min.u)),
        f('ct.centerX', 'ct-center-x', axis('u', (min.u + max.u) / 2)),
        f('ct.right', 'ct-right', axis('u', max.u)),
        f('ct.bottom', 'ct-bottom', axis('v', min.v)),
        f('ct.top', 'ct-top', axis('v', max.v)),
        f('ct.leftTop', 'ct-corner-left-top', point(min.u, max.v)),
        f('ct.leftBottom', 'ct-corner-left-bottom', point(min.u, min.v)),
        f('ct.rightTop', 'ct-corner-right-top', point(max.u, max.v)),
        f('ct.rightBottom', 'ct-corner-right-bottom', point(max.u, min.v))
    ];
};
// ---------------------------------------------------------------------------
// Rules (priorities: lower wins inside a distance tie group)
// ---------------------------------------------------------------------------
const PRIORITY = Object.freeze({
    sideAbut: 0,
    compositionEdge: 0,
    moduleJoint: 1,
    compositionCenter: 2,
    edge: 3,
    supportTop: 3,
    cabinetCenter: 4
});
const SIDE_ABUT = Object.freeze({
    family: 'side-abut',
    compatible: [
        'x-composition-edge-left',
        'x-composition-edge-right',
        'x-edge',
        'x-side-abut-left',
        'x-side-abut-right'
    ],
    retainOverProjection: true
});
const COUNTERTOP_SNAP_RULES = Object.freeze([
    {
        id: 'x-composition-edge-left',
        from: 'ct-left',
        to: 'composition-edge-left',
        op: 'align-u',
        priority: PRIORITY.compositionEdge
    },
    {
        id: 'x-composition-edge-right',
        from: 'ct-right',
        to: 'composition-edge-right',
        op: 'align-u',
        priority: PRIORITY.compositionEdge
    },
    {
        id: 'x-composition-center',
        from: 'ct-center-x',
        to: 'composition-center',
        op: 'align-u',
        priority: PRIORITY.compositionCenter
    },
    {
        id: 'x-module-joint',
        from: [
            'ct-left',
            'ct-right'
        ],
        to: 'module-joint',
        op: 'align-u',
        priority: PRIORITY.moduleJoint
    },
    {
        id: 'x-edge',
        from: [
            'ct-left',
            'ct-right'
        ],
        to: [
            'cabinet-edge',
            'side-panel-edge'
        ],
        op: 'align-u',
        priority: PRIORITY.edge
    },
    {
        id: 'x-cabinet-center',
        from: 'ct-center-x',
        to: 'cabinet-center',
        op: 'align-u',
        priority: PRIORITY.cabinetCenter
    },
    // Scalar X side-abut fallback: only while Y is frozen; with Y free the corner bundles carry it.
    {
        id: 'x-side-abut-left',
        from: 'ct-left',
        to: 'support-endpoint-right',
        op: 'align-u',
        priority: PRIORITY.sideAbut,
        when: 'abut-u',
        epsilonM: EPSILON_M,
        onlyWhenFrozen: 'v'
    },
    {
        id: 'x-side-abut-right',
        from: 'ct-right',
        to: 'support-endpoint-left',
        op: 'align-u',
        priority: PRIORITY.sideAbut,
        when: 'abut-u',
        epsilonM: EPSILON_M,
        onlyWhenFrozen: 'v'
    },
    {
        id: 'y-support-top',
        from: 'ct-bottom',
        to: 'support-top',
        op: 'align-v',
        priority: PRIORITY.supportTop,
        when: 'overlap-u',
        epsilonM: EPSILON_M
    },
    {
        id: 'xy-side-abut-left',
        from: [
            'ct-corner-left-top',
            'ct-corner-left-bottom'
        ],
        to: 'support-endpoint-right',
        op: 'coincide-uv',
        priority: PRIORITY.sideAbut,
        when: 'abut-u',
        epsilonM: EPSILON_M,
        bundle: SIDE_ABUT
    },
    // A lowered Remote top docked to the row end: its top corner on the cabinet cover's top corner.
    {
        id: 'xy-cover-abut-left',
        from: 'ct-corner-left-top',
        to: 'cover-endpoint-right',
        op: 'coincide-uv',
        priority: PRIORITY.sideAbut,
        when: 'abut-u',
        epsilonM: EPSILON_M,
        bundle: SIDE_ABUT
    },
    {
        id: 'xy-cover-abut-right',
        from: 'ct-corner-right-top',
        to: 'cover-endpoint-left',
        op: 'coincide-uv',
        priority: PRIORITY.sideAbut,
        when: 'abut-u',
        epsilonM: EPSILON_M,
        bundle: SIDE_ABUT
    },
    {
        id: 'xy-side-abut-right',
        from: [
            'ct-corner-right-top',
            'ct-corner-right-bottom'
        ],
        to: 'support-endpoint-left',
        op: 'coincide-uv',
        priority: PRIORITY.sideAbut,
        when: 'abut-u',
        epsilonM: EPSILON_M,
        bundle: SIDE_ABUT
    }
]);
// ---------------------------------------------------------------------------
// Spec
// ---------------------------------------------------------------------------
const COUNTERTOP_VOLUME = resolveHastingCollisionProfile({
    role: 'countertop'
}).profile;
const structure = any(tag('cabinet'), tag('side-panel'));
const countertopManipulable = defineManipulable({
    id: COUNTERTOP_MANIPULABLE_ID,
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
        entities: ({ host })=>host?.transformTargets?.() ?? null,
        pick: ({ host })=>host?.pickEntities?.() ?? null,
        pose: ({ host })=>host?.transformTargets ? createEntityGroupPose({
                frame: {
                    uAxis: {
                        x: 1,
                        y: 0,
                        z: 0
                    },
                    vAxis: {
                        x: 0,
                        y: 1,
                        z: 0
                    }
                },
                resolveTargets: ()=>host.transformTargets() ?? [],
                beforeCapture: ()=>host.beforeCapture?.()
            }) : null
    },
    snapping: {
        features: {
            self: {
                select: 'self',
                extract: countertopFeatures
            },
            composition: {
                select: structure,
                extract: compositionSnapTargets
            }
        },
        rules: COUNTERTOP_SNAP_RULES
    },
    collision: {
        source: ()=>COUNTERTOP_VOLUME,
        against: structure,
        volumes: hastingCollisionProfileFor,
        roles: HASTING_OBSTACLE_ROLES
    }
});

export { COUNTERTOP_MANIPULABLE_ID, COUNTERTOP_SNAP_RULES, countertopManipulable };
