/**
 * Placement checks — the registry of named geometric predicates a pack rule can reference.
 * A check is pure: (facts, params, pack) -> violation[]; violation = { ids (affected), params?, unresolved?, focus? (ids that
 * tie the violation to a candidate without being affected, e.g. the draft in a collision) }.
 * `unresolved` marks a pair whose answer depends on an undecided trait (null): the validator reports it
 * as a decision gate instead of silently allowing it. New kinds of relation are added HERE (code),
 * which rule uses them and with what numbers is pack data.
 */
import { matchesSelector } from './placement-facts.mjs';
import { trapKeepOutViolations } from '../../countertop/trap/trap-keepout.mjs';

const overlap1 = (a, b) => a && b ? Math.min(a[1], b[1]) - Math.max(a[0], b[0]) : -Infinity;
const tol = (facts, key) => facts.tolerances?.[key] ?? 0;

/** a sits on or above b: a's level at/over b's top and their footprints overlap in X and Z. */
export const isAbove = (a, b, t) => a.measured && b.measured && a.levelM >= b.topM - t &&
    overlap1(a.x, b.x) > t && overlap1(a.z, b.z) > t;
const touching = (a, b, t) => Math.abs(a.levelM - b.topM) <= t;

/** Pairs (upper, lower) with upper above lower; `contact`: 'any' | 'touching' | 'gap'. */
function abovePairs(facts, contact = 'any') {
    const t = tol(facts, 'levelM'), out = [];
    for (const a of facts.cabinets) for (const b of facts.cabinets) {
        if (a === b || !isAbove(a, b, t)) continue;
        const touch = touching(a, b, t);
        if (contact === 'touching' && !touch || contact === 'gap' && touch) continue;
        out.push([a, b]);
    }
    return out;
}

const M_PER_IN = 0.0254;
/** Inches for a hint: whole, at least 1 (a hint never says "0″"). */
const inches = m => `${Math.max(1, Math.round(Math.abs(m) / M_PER_IN))}″`;

/**
 * Why a sink base is in a trap keep-out zone, as a text variant of TRAP_KEEPOUT (P210, Andriy 27.10). An SB may stand
 * right under a sink (it hosts it), so the hint tells the user how to get there — or that the sink already has its SB:
 *   SB_NEAR_HOSTED_SINK  the trap belongs to another SB standing under it -> keep 6″ away from it;
 *   SB_BESIDE            top at the countertop's underside, the trap not over it -> slide it under the sink (to centre);
 *   SB_LEVEL             under the trap, its top not at the countertop's underside -> make the top meet the countertop;
 *   SB_BESIDE_LEVEL      both.
 * Zone geometry: trap X = the zone's X centre, the countertop's bottom = the zone's top (trap-keepout.mjs).
 */
function trapKeepOutSinkBaseHint(facts, fact, zone) {
    const trapX = (zone.minM.x + zone.maxM.x) / 2, ctBottomM = zone.maxM.y, contactM = tol(facts, 'contactM');
    const under = f => f.measured && f.x[0] <= trapX && trapX <= f.x[1];
    const hosts = new Set(facts.trap.hosts ?? []);
    if (facts.cabinets.some(f => f.id !== fact.id && hosts.has(f.id) && under(f))) return { messageId: 'TRAP_KEEPOUT.SB_NEAR_HOSTED_SINK', params: {} };
    const beside = !under(fact), dy = fact.topM - ctBottomM, level = Math.abs(dy) > contactM;
    const dx = trapX - (fact.x[0] + fact.x[1]) / 2;   // to centre the SB under the trap
    const params = { distance: inches(dx), direction: dx < 0 ? 'left' : 'right', height: inches(dy), above: dy < 0 ? 'below' : 'above' };
    if (beside && level) return { messageId: 'TRAP_KEEPOUT.SB_BESIDE_LEVEL', params };
    if (beside) return { messageId: 'TRAP_KEEPOUT.SB_BESIDE', params };
    if (level) return { messageId: 'TRAP_KEEPOUT.SB_LEVEL', params };
    return null; // under the sink at its level: the drag snaps it to the landing, so the general text is enough
}

const roleParams = (a, b) => ({ upperRole: a.role, lowerRole: b.role, upperId: a.id, lowerId: b.id });

export const CHECKS = Object.freeze({
    /** The adapter's collision verdict, optionally filtered by obstacle type (HR-PL-01/HR-PL-10).
     * Each reason lists its overlapped neighbours; `focus` ties the violation to the draft. */
    collision(facts, { counterpartType } = {}) {
        const c = facts.collision;
        if (c?.status !== 'colliding') return [];
        // Untyped hits keep the legacy cabinet/floor reason. Typed obstacles get their own pack rule.
        const ids = c.collidesWith.filter(id => !counterpartType || (c.counterpartTypes?.[id] ?? 'cabinet') === counterpartType);
        return ids.length ? [{ ids, focus: [facts.candidateId].filter(Boolean), params: { collidesWith: [...ids] } }] : [];
    },
    /** Forbidden "upper on/above lower" pairs selected by role/trait (HR-PL-03: on or above, touching or with a gap). */
    stackRelation(facts, { upper, lower, contact = 'any' } = {}) {
        const out = [];
        for (const [a, b] of abovePairs(facts, contact)) {
            const u = matchesSelector(a, upper), l = matchesSelector(b, lower);
            if (u === false || l === false) continue;
            out.push({ ids: [a.id, b.id], params: roleParams(a, b), unresolved: u === null || l === null });
        }
        return out;
    },
    /**
     * Vertical tiers (HR-PL-02): depth of each support chain (a cabinet on a cabinet on a cabinet = 3).
     * A pack with `geometry.tierHeightM` has columns: an upper cabinet that touches its lower one and ends
     * inside the tier the lower one starts is the same tier, not the next one.
     * Example (UD, tierHeightM 0.56): [56][28 on 28][56] = 1 tier; 56 on 56, 38 on 28, 28 two cm above 28 = 2 tiers.
     */
    maxStackDepth(facts, { max = 2 } = {}, pack) {
        const t = tol(facts, 'levelM');
        const tierHeightM = pack?.geometry?.tierHeightM;
        const SAME_TIER = 0;   // a column top stays in the tier of its support
        const NEXT_TIER = 1;   // a cabinet on a cabinet starts the next tier
        const FIRST_TIER = 1;  // a cabinet with nothing below stands in the first tier

        // 1. support pairs: each cabinet -> the cabinets it stands on or above
        const supportsOf = new Map(facts.cabinets.map(upper =>
            [upper, facts.cabinets.filter(lower => lower !== upper && isAbove(upper, lower, t))]));

        // 2. a pair inside the tier is a column, not a tier. The tier starts where its lowest cabinet stands
        //    (tierBaseM): a staircase 28/28/28 ends above the tier even though each step touches the one below.
        const isColumn = (upper, lower, tierBaseM) => {
            if (typeof tierHeightM !== 'number') return false;   // the pack has no columns (ULH): every pair is two tiers
            if (!touching(upper, lower, t)) return false;          // a gap between them: the upper one is a tier of its own
            return upper.topM <= tierBaseM + tierHeightM + t;
        };

        // 3. tiers of each chain: the deepest support decides (the first one on a tie).
        //    info = { tiers, tierBaseM, chain }
        const infoOf = new Map();
        const tiersOf = upper => {
            if (infoOf.has(upper)) return infoOf.get(upper);
            const onTheFloor = { tiers: FIRST_TIER, tierBaseM: upper.levelM, chain: [upper.id] };
            infoOf.set(upper, onTheFloor);                          // cycle guard (overlapping boxes); also the answer with no support
            let deepest = null;
            for (const lower of supportsOf.get(upper)) {
                const below = tiersOf(lower);
                const column = isColumn(upper, lower, below.tierBaseM);
                const candidate = {
                    tiers: below.tiers + (column ? SAME_TIER : NEXT_TIER),
                    tierBaseM: column ? below.tierBaseM : upper.levelM,
                    chain: [upper.id, ...below.chain]
                };
                if (deepest && candidate.tiers <= deepest.tiers) continue;   // not deeper than a support already seen
                deepest = candidate;
            }
            // Nothing below: the cabinet stands on the floor.
            if (!deepest) return onTheFloor;
            infoOf.set(upper, deepest);
            return deepest;
        };
        const chain = new Map(facts.cabinets.map(f => [f, tiersOf(f).chain]));
        // one violation per chain over the limit, reported at its top
        const overTheLimit = f => tiersOf(f).tiers > max;
        return facts.cabinets.filter(f => overTheLimit(f) && !facts.cabinets.some(g => isAbove(g, f, t) && overTheLimit(g)))
            .map(f => ({ ids: chain.get(f), params: { max, tiers: tiersOf(f).tiers } }));
    },
    /** Subject not higher than a side-by-side reference (HR-PL-04): no X overlap (that is HR-PL-03), X gap ≤ maxGapM (null = whole composition). */
    higherThan(facts, { subject, reference, maxGapM = null } = {}) {
        const t = tol(facts, 'levelM'), out = [];
        for (const a of facts.cabinets) for (const b of facts.cabinets) {
            if (a === b || !a.measured || !b.measured) continue;
            if (matchesSelector(a, subject) !== true || matchesSelector(b, reference) !== true) continue;
            const ov = overlap1(a.x, b.x);
            if (ov > t || (maxGapM !== null && -ov > maxGapM)) continue;
            if (a.topM > b.topM + t) out.push({ ids: [a.id, b.id], params: roleParams(a, b) });
        }
        return out;
    },
    /** Every selected cabinet shares one level (HR-PL-05). */
    sameLevel(facts, { select } = {}) {
        const t = tol(facts, 'levelM'), picked = facts.cabinets.filter(f => f.measured && matchesSelector(f, select) === true);
        if (picked.length < 2) return [];
        const levels = picked.map(f => f.levelM);
        return Math.max(...levels) - Math.min(...levels) > t ? [{ ids: picked.map(f => f.id), params: { count: picked.length } }] : [];
    },
    /** Tandem vanities under a THICK top (Andriy 23.10): one top lies on every selected cabinet, so their tops must be at
     * one level (beyond levelM -> all of them affected); silent without a thick top (a thin top is cloned per SB). */
    sameTopUnderThickTop(facts, { select } = {}) {
        if (facts.countertop?.thick !== true) return [];
        const t = tol(facts, 'levelM'), picked = facts.cabinets.filter(f => f.measured && matchesSelector(f, select) === true);
        if (picked.length < 2) return [];
        const tops = picked.map(f => f.topM);
        return Math.max(...tops) - Math.min(...tops) > t ? [{ ids: picked.map(f => f.id), params: { count: picked.length } }] : [];
    },
    /**
     * A sink base draft whose basin is cut into the top (its top meets the top's bottom within levelM, its cut-out over
     * the top) keeps clear of the top's ends and of its other basins (Andriy 27.10; facts.basin, draftBasinFacts):
     *   kind 'edge' (HR-PL-12): each cut-out end >= its HR-CT-06 margin inside the top's ends;
     *   kind 'gap'  (HR-PL-13): to every other basin >= the SUM of both margins (two SBs side by side stay valid).
     * params: distance / direction = the shortest slide that clears it; margin / required = the needed clearance.
     */
    basinClearance(facts, { kind = 'edge' } = {}) {
        const b = facts.basin, c = b?.candidate, t = 1e-3;
        const fact = c ? facts.cabinets.find(f => f.id === c.id) : null;
        if (!fact?.measured || Math.abs(fact.topM - b.bottomM) > tol(facts, 'levelM')) return [];
        if (c.maxX <= b.minX + t || c.minX >= b.maxX - t) return []; // not over the top: nothing is cut
        const slide = dx => ({ distance: inches(dx), direction: dx < 0 ? 'left' : 'right' });
        if (kind === 'edge') {
            const left = b.minX + c.marginM - c.minX, right = c.maxX - (b.maxX - c.marginM);
            if (left <= t && right <= t) return [];
            return [{ ids: [fact.id], params: { role: fact.role, margin: inches(c.marginM), ...slide(left > t ? left : -right) } }];
        }
        const known = new Set(facts.cabinets.map(f => f.id)), out = [];
        for (const e of b.cutouts ?? []) {
            const required = c.marginM + e.marginM, gap = Math.max(e.minX - c.maxX, c.minX - e.maxX);
            if (gap >= required - t) continue;
            const dx = c.minX + c.maxX < e.minX + e.maxX ? e.minX - required - c.maxX : e.maxX + required - c.minX;
            out.push({ ids: [fact.id, ...(e.id && known.has(e.id) ? [e.id] : [])], focus: [fact.id],
                params: { role: fact.role, required: inches(required), ...slide(dx) } });
        }
        return out;
    },
    /** Selected cabinets inside a sink trap keep-out zone (HR-PL-06), the trap's host excluded; silent without `facts.trap`.
     * A sink base (trait `sink`) gets a text that says why it is blocked and how to fix it (trapKeepOutSinkBaseHint). */
    trapKeepOut(facts, { select } = {}) {
        if (!facts.trap?.zones?.length) return [];
        const picked = facts.cabinets.filter(f => f.measured && matchesSelector(f, select) === true);
        const bodies = picked.map(f => ({ id: f.id, role: f.role, box: { minM: { x: f.x[0], y: f.levelM, z: f.z[0] }, maxM: { x: f.x[1], y: f.topM, z: f.z[1] } } }));
        return trapKeepOutViolations({ zones: facts.trap.zones, bodies, hostIds: facts.trap.hosts, tolM: tol(facts, 'collisionM') })
            .map(v => {
                const fact = picked.find(f => f.id === v.bodyId), zone = facts.trap.zones.find(z => z.trapId === v.trapId);
                const hint = fact?.traits?.sink === true && zone ? trapKeepOutSinkBaseHint(facts, fact, zone) : null;
                return { ids: [v.bodyId], params: { role: fact.role, ...(hint?.params ?? {}) }, ...(hint ? { messageId: hint.messageId } : {}) };
            });
    }
});
