import { tag } from '../../spatial-manipulation/spec/selectors.mjs';
import { edges, corners } from '../../spatial-manipulation/spec/extractors.mjs';
import '../../spatial-manipulation/runtime/world.mjs';
import '../../spatial-manipulation/core/contracts/validators.mjs';
import '../../spatial-manipulation/core/motion/planner.mjs';
import '../../spatial-manipulation/core/snapping/candidates.mjs';
import '../../spatial-manipulation/core/snapping/latch.mjs';
import '../../spatial-manipulation/runtime/instance-support.mjs';
import '../../spatial-manipulation/core/collision/observation.mjs';
import '../../spatial-manipulation/runtime/events.mjs';

/** A cabinet's LEVEL is its pivot Y (body bottom); a sink bowl may hang below it. Bodies carrying
 * meta.levelLiftM (pivot above mesh bottom, along V) get their V edges from the body level; U edges
 * and collision volumes stay on the mesh. */ const levelledEdges = (extract)=>(body)=>{
        const lift = body?.meta?.levelLiftM;
        if (!Number.isFinite(lift) || !body.boundsUV) return extract(body);
        const { min, max } = body.boundsUV, v = min.v + lift;
        return extract({
            ...body,
            boundsUV: {
                min: {
                    ...min,
                    v
                },
                max: {
                    ...max,
                    v: Math.max(max.v, v)
                }
            }
        });
    };
/** Engineering-only draft interaction policy for the approved SC line. Geometry and
 * document ownership stay with the caller; this describes movement and semantics. */ function createSCLineSpatialProfile({ gridStepM = .01 } = {}) {
    if (!Number.isFinite(gridStepM) || gridStepM <= 0) throw new TypeError('Invalid SC spatial grid step');
    const edgeFeatures = levelledEdges(edges({
        u: [
            'min',
            'center',
            'max'
        ],
        v: [
            'min',
            'center',
            'max'
        ]
    }));
    const cornerFeatures = corners();
    return Object.freeze({
        plane: 'xy',
        motion: {
            axes: [
                'u',
                'v'
            ],
            gridM: {
                u: gridStepM,
                v: gridStepM
            }
        },
        snapping: {
            features: {
                selfEdges: {
                    select: 'self',
                    extract: edgeFeatures
                },
                cabinetEdges: {
                    select: tag('cabinet'),
                    extract: edgeFeatures
                },
                selfCorners: {
                    select: 'self',
                    extract: cornerFeatures
                },
                cabinetCorners: {
                    select: tag('cabinet'),
                    extract: cornerFeatures
                },
                floorEdges: {
                    select: tag('floor'),
                    extract: edgeFeatures
                }
            },
            rules: [
                {
                    id: 'rest-on-floor',
                    from: 'selfEdges.v.min',
                    to: 'floorEdges.v.max',
                    op: 'align-v',
                    priority: 1
                },
                {
                    id: 'abut-left',
                    from: 'selfEdges.u.max',
                    to: 'cabinetEdges.u.min',
                    op: 'align-u',
                    priority: 0
                },
                {
                    id: 'abut-right',
                    from: 'selfEdges.u.min',
                    to: 'cabinetEdges.u.max',
                    op: 'align-u',
                    priority: 0
                },
                {
                    id: 'abut-below',
                    from: 'selfEdges.v.max',
                    to: 'cabinetEdges.v.min',
                    op: 'align-v',
                    priority: 1
                },
                {
                    id: 'abut-above',
                    from: 'selfEdges.v.min',
                    to: 'cabinetEdges.v.max',
                    op: 'align-v',
                    priority: 1
                },
                {
                    id: 'align-center-u',
                    from: 'selfEdges.u.center',
                    to: 'cabinetEdges.u.center',
                    op: 'align-u',
                    priority: 2
                },
                {
                    id: 'align-center-v',
                    from: 'selfEdges.v.center',
                    to: 'cabinetEdges.v.center',
                    op: 'align-v',
                    priority: 2
                },
                {
                    id: 'match-corners',
                    from: [
                        'selfCorners.corner.min.min',
                        'selfCorners.corner.min.max',
                        'selfCorners.corner.max.min',
                        'selfCorners.corner.max.max'
                    ],
                    to: [
                        'cabinetCorners.corner.min.min',
                        'cabinetCorners.corner.min.max',
                        'cabinetCorners.corner.max.min',
                        'cabinetCorners.corner.max.max'
                    ],
                    op: 'coincide-uv',
                    priority: 3
                }
            ]
        },
        collision: {
            against: tag('cabinet'),
            volumes: 'bounds'
        }
    });
}

export { createSCLineSpatialProfile, levelledEdges };
