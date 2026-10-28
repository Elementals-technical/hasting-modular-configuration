import { buildPlacementFacts } from '../kernel/placement-facts.mjs';
import { SINK_BASE_ALIGN_TOLERANCE_M, trapHostIds, trapKeepOutZones } from '../../countertop/trap/trap-keepout.mjs';
import { basinEdgeMarginM, COUNTERTOP_BASIN_EDGE_MARGIN_M } from '../../countertop/countertop-resize-bounds.mjs';

const finite = (v)=>typeof v === 'number' && Number.isFinite(v);
/** Does the pack give `definitionId` a sink-capable role (trait `sink`, the SB)? */ const isSinkBase = (pack, definitionId)=>pack?.traits?.[pack?.roles?.[definitionId]]?.sink === true;
/** Sink trap facts (HR-PL-06) from the countertop read once per draft ({ box, traps }) and the measured bodies;
 * null without a top, traps or pack trap geometry (the rule stays silent). A sink base draft whose own sink stands
 * right under the sink the top hosts (and whose top meets the top) is that trap's host — P210. */ function draftTrapFacts({ pack, countertop, neighbours, candidate } = {}) {
    const geometry = pack?.geometry?.trap, traps = countertop?.traps ?? [], ctBox = countertop?.box ?? null;
    if (!geometry || !ctBox || !traps.length) return null;
    const bodies = [
        ...neighbours ?? [],
        ...candidate ? [
            {
                id: candidate.id,
                box: candidate.box
            }
        ] : []
    ];
    // The draft's own sink X (`candidate.sinkXM`, measured on its preview): it must stand right under the top's sink.
    const sinkBases = candidate && isSinkBase(pack, candidate.definitionId) ? [
        {
            id: candidate.id,
            sinkXM: candidate.sinkXM
        }
    ] : [];
    return {
        zones: trapKeepOutZones({
            traps,
            ctBox,
            ...geometry
        }),
        hosts: [
            ...trapHostIds({
                traps,
                bodies,
                ctBottomM: ctBox.minM.y,
                contactM: pack.tolerances?.contactM ?? 0,
                sinkBases
            })
        ]
    };
}
/**
 * Basin clearance facts (HR-PL-12 / HR-PL-13, Andriy 27.10) for a sink base draft whose basin would be cut into the top:
 * the top's X ends and bottom, the draft's cut-out with its margin and the top's other cut-outs with theirs. A margin is
 * the HR-CT-06 one: min(10 cm, half the free width on the basin's SB); Vessel 0; a basin without an SB (hosted) 10 cm.
 * null without a top, without the draft's measured cut-out, for a non-SB, or at the landing (the draft stands right under
 * the sink the top hosts: no new cut-out, P210).
 */ function draftBasinFacts({ pack, countertop, candidate } = {}) {
    const ctBox = countertop?.box ?? null, cut = candidate?.cutoutM ?? null;
    if (!ctBox || !cut || !finite(cut.minX) || !finite(cut.maxX) || !isSinkBase(pack, candidate.definitionId)) return null;
    const landing = finite(candidate.sinkXM) && (countertop.traps ?? []).some((trap)=>trap?.hostCabinetId == null && finite(trap?.xM) && Math.abs(trap.xM - candidate.sinkXM) <= SINK_BASE_ALIGN_TOLERANCE_M);
    if (landing) return null;
    const hostWidthM = candidate.box ? candidate.box.maxM.x - candidate.box.minM.x : NaN;
    const marginOf = (c)=>c.vessel ? 0 : finite(c.marginM) ? c.marginM : COUNTERTOP_BASIN_EDGE_MARGIN_M;
    return {
        minX: ctBox.minM.x,
        maxX: ctBox.maxM.x,
        bottomM: ctBox.minM.y,
        candidate: {
            id: candidate.id,
            minX: cut.minX,
            maxX: cut.maxX,
            marginM: cut.vessel ? 0 : basinEdgeMarginM({
                cutoutWidthM: cut.maxX - cut.minX,
                hostWidthM
            })
        },
        // The draft's own cut-out (a moved SB still cut into the top) is not another basin.
        cutouts: (countertop.cutouts ?? []).filter((c)=>finite(c?.minX) && finite(c?.maxX) && (c.id == null || c.id !== candidate.id)).map((c)=>({
                id: c.id ?? null,
                minX: c.minX,
                maxX: c.maxX,
                marginM: marginOf(c)
            }))
    };
}
/**
 * @param {object} input
 * @param {object} input.pack                 collection pack
 * @param {{cabinets:object[]}} input.document  CompositionDocument (id, definitionId, selection, positionM)
 * @param {{id:string, box:object|null}[]|null} input.neighbours  measured committed cabinets (floor included or not)
 * @param {{id:string, definitionId:string, config:object, positionM:object, box:object|null, sinkXM?:number}} input.candidate
 *   sinkXM: world X of a sink base draft's own sink (trap); cutoutM: its basin cut-out { minX, maxX, vessel } in world X
 * @param {{status:string, collidesWith:string[]}} input.collision
 * @param {string[]} [input.ignoreIds]        pseudo-bodies to drop (floor collider)
 * @param {{box:object, traps:object[], cutouts?:object[], thick?:boolean}|null} [input.countertop]  the top's box, sink traps and
 *   basin cut-outs (adapter state: { minX, maxX, vessel, id, marginM? }),
 *   thick: not a thin top (HR-PL-11); null = no trap rule
 */ function draftPlacementFacts({ pack, document, neighbours, candidate, collision, ignoreIds = [], countertop = null } = {}) {
    const ignore = new Set(ignoreIds), boxes = new Map((neighbours ?? []).map((n)=>[
            n.id,
            n.box ?? null
        ]));
    const cabinets = (document?.cabinets ?? []).filter((c)=>c.id !== candidate.id && !ignore.has(c.id)).map((c)=>({
            id: c.id,
            productType: c.definitionId,
            config: c.selection,
            pivotM: c.positionM,
            meshBox: boxes.get(c.id) ?? null
        }));
    return buildPlacementFacts({
        pack,
        cabinets,
        collision,
        candidate: {
            id: candidate.id,
            productType: candidate.definitionId,
            config: candidate.config,
            pivotM: candidate.positionM,
            meshBox: candidate.box
        },
        trap: draftTrapFacts({
            pack,
            countertop,
            neighbours: (neighbours ?? []).filter((n)=>!ignore.has(n.id)),
            candidate
        }),
        basin: draftBasinFacts({
            pack,
            countertop,
            candidate
        }),
        countertop: countertop ? {
            thick: countertop.thick === true
        } : null
    });
}

export { draftBasinFacts, draftPlacementFacts, draftTrapFacts };
