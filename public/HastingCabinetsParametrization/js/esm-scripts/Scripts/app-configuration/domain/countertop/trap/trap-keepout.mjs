import { boxesOverlap } from '../../cabinet-placement/draft-collision.mjs';

const finite = (v)=>typeof v === 'number' && Number.isFinite(v);
/** @param {{ traps: {id:string, xM:number}[], ctBox: {minM,maxM}, sideM:number, belowM:number }} input */ function trapKeepOutZones({ traps = [], ctBox, sideM, belowM } = {}) {
    if (!ctBox || !finite(sideM) || !finite(belowM)) return [];
    const bottom = ctBox.minM.y;
    // A trap hangs under the top only while the top is over it: a top moved off its sink has no keep-out
    // there (the uncovered sink is reported by the coverage rule instead).
    return traps.filter((trap)=>finite(trap?.xM) && trap.xM >= ctBox.minM.x && trap.xM <= ctBox.maxM.x).map((trap)=>Object.freeze({
            trapId: trap.id,
            hostCabinetId: trap.hostCabinetId ?? null,
            minM: Object.freeze({
                x: trap.xM - sideM,
                y: bottom - belowM,
                z: ctBox.minM.z
            }),
            maxM: Object.freeze({
                x: trap.xM + sideM,
                y: bottom,
                z: ctBox.maxM.z
            })
        }));
}
/** How far an SB's own sink may be from a hosted sink's trap and still count as right under it (metres). */ const SINK_BASE_ALIGN_TOLERANCE_M = 0.002;
/**
 * Ids of the trap hosts among `bodies` ({ id, box }): the cabinet carrying the top under a trap.
 * - the trap's owner (`hostCabinetId`): its top within `contactM` of the top's bottom, its X range containing the trap;
 * - a sink base of `sinkBases` ({ id, sinkXM }) under a trap of a sink the top hosts (`hostCabinetId: null`): the same,
 *   and its own sink at `sinkXM` within SINK_BASE_ALIGN_TOLERANCE_M of the trap (P210: the only valid position).
 * A hosted trap exempts nobody else, not even an id-less body.
 */ function trapHostIds({ traps = [], bodies = [], ctBottomM, contactM = 0, sinkBases = [] } = {}) {
    const hosts = new Set();
    if (!finite(ctBottomM)) return hosts;
    const sinkXById = new Map((sinkBases ?? []).filter((b)=>b?.id != null).map((b)=>[
            b.id,
            b.sinkXM
        ]));
    const carries = (body, trap)=>!!body?.box && Math.abs(body.box.maxM.y - ctBottomM) <= contactM && body.box.minM.x <= trap.xM && trap.xM <= body.box.maxM.x;
    const alignedUnder = (body, trap)=>trap.hostCabinetId == null && sinkXById.has(body.id) && finite(sinkXById.get(body.id)) && Math.abs(sinkXById.get(body.id) - trap.xM) <= SINK_BASE_ALIGN_TOLERANCE_M;
    for (const trap of traps){
        if (!finite(trap?.xM)) continue;
        for (const body of bodies){
            if (body?.id == null) continue;
            const owner = trap.hostCabinetId != null && body.id === trap.hostCabinetId;
            if ((owner || alignedUnder(body, trap)) && carries(body, trap)) hosts.add(body.id);
        }
    }
    return hosts;
}
/**
 * Drag snap (P210): a sink base whose X range [minX, maxX] reaches the trap of a sink the top hosts is moved along X so
 * that its own sink (at `sinkXM`) stands exactly under that sink. Returns the X shift (metres), or 0 when no hosted
 * trap is in reach. The nearest such trap wins. Level (top on the top's bottom) is the validator's business.
 * Example: SB [0.48, 1.08], its sink at 0.78, hosted trap at 0.913 -> +0.133.
 */ function sinkBaseShiftUnderHostedSink({ traps = [], minX, maxX, sinkXM } = {}) {
    if (!finite(minX) || !finite(maxX) || !finite(sinkXM)) return 0;
    let best = null;
    for (const trap of traps){
        if (trap?.hostCabinetId != null || !finite(trap?.xM) || trap.xM < minX || trap.xM > maxX) continue;
        const dx = trap.xM - sinkXM;
        if (best === null || Math.abs(dx) < Math.abs(best)) best = dx;
    }
    return best ?? 0;
}
/** `[{ trapId, bodyId }]` for every non-host body ({ id, box }) overlapping a zone beyond `tolM`. */ function trapKeepOutViolations({ zones = [], bodies = [], hostIds = [], tolM = 0 } = {}) {
    const hosts = hostIds instanceof Set ? hostIds : new Set(hostIds ?? []), out = [];
    for (const zone of zones)for (const body of bodies){
        if (!body?.box || hosts.has(body.id)) continue;
        if (boxesOverlap(zone, body.box, tolM)) out.push({
            trapId: zone.trapId,
            bodyId: body.id
        });
    }
    return out;
}
/** Zones + hosts + violations in one step for a countertop box and its traps. */ function countertopTrapViolations({ traps = [], ctBox, bodies = [], sideM, belowM, contactM = 0, tolM = 0 } = {}) {
    const zones = trapKeepOutZones({
        traps,
        ctBox,
        sideM,
        belowM
    });
    if (!zones.length) return [];
    const hostIds = trapHostIds({
        traps,
        bodies,
        ctBottomM: ctBox.minM.y,
        contactM
    });
    return trapKeepOutViolations({
        zones,
        bodies,
        hostIds,
        tolM
    });
}

export { SINK_BASE_ALIGN_TOLERANCE_M, countertopTrapViolations, sinkBaseShiftUnderHostedSink, trapHostIds, trapKeepOutViolations, trapKeepOutZones };
