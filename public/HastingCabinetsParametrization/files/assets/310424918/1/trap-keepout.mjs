/**
 * Sink trap keep-out (Ryan 03.10): nothing within 6″ left/right of the trap and 8″ below the
 * countertop, except the sink base the trap sits in. Engine-free; boxes are `{ minM, maxM }` in
 * world metres (the draft-collision shape).
 *
 * - zone: one box per trap — X [trapX − sideM, trapX + sideM], Y [ctBottom − belowM, ctBottom],
 *   Z = the countertop's Z range;
 * - host: the cabinet that owns the trap's sink, while the top rests on it (|top − ctBottom| ≤
 *   contactM) and its X range contains the trap; a host is never a violator;
 * - prospective host: a sink base (`sinkBases`) set right under the trap of a sink the TOP hosts (HR-CT-02,
 *   `hostCabinetId: null`): its top on the top's bottom and its own sink exactly under that sink (P210, Andriy
 *   27.10: one valid position, one sink — the top's sink goes into the SB on Apply);
 * - violator: a body whose box overlaps a zone by more than `tolM` on every axis (touching is not
 *   an overlap).
 */
import { boxesOverlap } from '../../cabinet-placement/draft-collision.mjs';

const finite = v => typeof v === 'number' && Number.isFinite(v);

/** @param {{ traps: {id:string, xM:number}[], ctBox: {minM,maxM}, sideM:number, belowM:number }} input */
export function trapKeepOutZones({ traps = [], ctBox, sideM, belowM } = {}) {
    if (!ctBox || !finite(sideM) || !finite(belowM)) return [];
    const bottom = ctBox.minM.y;
    // A trap hangs under the top only while the top is over it: a top moved off its sink has no keep-out
    // there (the uncovered sink is reported by the coverage rule instead).
    return traps.filter(trap => finite(trap?.xM) && trap.xM >= ctBox.minM.x && trap.xM <= ctBox.maxM.x).map(trap => Object.freeze({
        trapId: trap.id, hostCabinetId: trap.hostCabinetId ?? null,
        minM: Object.freeze({ x: trap.xM - sideM, y: bottom - belowM, z: ctBox.minM.z }),
        maxM: Object.freeze({ x: trap.xM + sideM, y: bottom, z: ctBox.maxM.z })
    }));
}

/** How far an SB's own sink may be from a hosted sink's trap and still count as right under it (metres). */
export const SINK_BASE_ALIGN_TOLERANCE_M = 0.002;

/**
 * Ids of the trap hosts among `bodies` ({ id, box }): the cabinet carrying the top under a trap.
 * - the trap's owner (`hostCabinetId`): its top within `contactM` of the top's bottom, its X range containing the trap;
 * - a sink base of `sinkBases` ({ id, sinkXM }) under a trap of a sink the top hosts (`hostCabinetId: null`): the same,
 *   and its own sink at `sinkXM` within SINK_BASE_ALIGN_TOLERANCE_M of the trap (P210: the only valid position).
 * A hosted trap exempts nobody else, not even an id-less body.
 */
export function trapHostIds({ traps = [], bodies = [], ctBottomM, contactM = 0, sinkBases = [] } = {}) {
    const hosts = new Set();
    if (!finite(ctBottomM)) return hosts;
    const sinkXById = new Map((sinkBases ?? []).filter(b => b?.id != null).map(b => [b.id, b.sinkXM]));
    const carries = (body, trap) => !!body?.box && Math.abs(body.box.maxM.y - ctBottomM) <= contactM
        && body.box.minM.x <= trap.xM && trap.xM <= body.box.maxM.x;
    const alignedUnder = (body, trap) => trap.hostCabinetId == null && sinkXById.has(body.id)
        && finite(sinkXById.get(body.id)) && Math.abs(sinkXById.get(body.id) - trap.xM) <= SINK_BASE_ALIGN_TOLERANCE_M;
    for (const trap of traps) {
        if (!finite(trap?.xM)) continue;
        for (const body of bodies) {
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
 */
export function sinkBaseShiftUnderHostedSink({ traps = [], minX, maxX, sinkXM } = {}) {
    if (!finite(minX) || !finite(maxX) || !finite(sinkXM)) return 0;
    let best = null;
    for (const trap of traps) {
        if (trap?.hostCabinetId != null || !finite(trap?.xM) || trap.xM < minX || trap.xM > maxX) continue;
        const dx = trap.xM - sinkXM;
        if (best === null || Math.abs(dx) < Math.abs(best)) best = dx;
    }
    return best ?? 0;
}

/** `[{ trapId, bodyId }]` for every non-host body ({ id, box }) overlapping a zone beyond `tolM`. */
export function trapKeepOutViolations({ zones = [], bodies = [], hostIds = [], tolM = 0 } = {}) {
    const hosts = hostIds instanceof Set ? hostIds : new Set(hostIds ?? []), out = [];
    for (const zone of zones) for (const body of bodies) {
        if (!body?.box || hosts.has(body.id)) continue;
        if (boxesOverlap(zone, body.box, tolM)) out.push({ trapId: zone.trapId, bodyId: body.id });
    }
    return out;
}

/** Zones + hosts + violations in one step for a countertop box and its traps. */
export function countertopTrapViolations({ traps = [], ctBox, bodies = [], sideM, belowM, contactM = 0, tolM = 0 } = {}) {
    const zones = trapKeepOutZones({ traps, ctBox, sideM, belowM });
    if (!zones.length) return [];
    const hostIds = trapHostIds({ traps, bodies, ctBottomM: ctBox.minM.y, contactM });
    return trapKeepOutViolations({ zones, bodies, hostIds, tolM });
}
