/**
 * Length limits of a remote (detached) countertop and the reasons its drag overlay turns red.
 * Engine-free; all values are metres along world X.
 *
 * - Requested limits come from the UI per collection (`countertop.setLengthLimits`); default
 *   one 60 cm cabinet (0.6 m, ≈ 23.6 in) … 120 in.
 * - Basin minimum: every sink / basin cut-out must stay inside the top with a small margin.
 *   The top resizes symmetrically about its centre (SmartStretch), so the minimum is twice the
 *   farthest cut-out edge from that centre plus the margin on each end.
 * - Effective limits: min = max(requested min, basin min); max = max(requested max, min) so a
 *   clamp is always defined (the basin wins over a too-small collection maximum).
 */
import { syncEntityWorld } from '../spatial-manipulation/playcanvas/scene-measure.mjs';
import { COUNTERTOP_COVERAGE_REASON } from './countertop-resize-bounds.mjs';

export const INCH_M = 0.0254;
/** Default min = one 60 cm cabinet (exactly 0.6 m); default max = 120 in (3.048 m). */
export const DEFAULT_COUNTERTOP_LENGTH_LIMITS_M = Object.freeze({ minM: 0.6, maxM: 120 * INCH_M });
export const COUNTERTOP_BASIN_MARGIN_M = INCH_M;
export const COUNTERTOP_LENGTH_EPSILON_M = 1e-4;
export const COUNTERTOP_OVERLAY_REASON = Object.freeze({
    COLLISION: 'COUNTERTOP_COLLISION',
    BASIN_CONFLICT: 'BASIN_CONFLICT',
    LENGTH_OUT_OF_RANGE: 'LENGTH_OUT_OF_RANGE',
    TRAP_KEEPOUT: 'TRAP_KEEPOUT',
    BASIN_EDGE_TOO_CLOSE: COUNTERTOP_COVERAGE_REASON.BASIN_EDGE,
    SINK_BASE_NOT_COVERED: COUNTERTOP_COVERAGE_REASON.SB_NOT_COVERED,
    SINK_LANDING_GAP: 'SINK_LANDING_GAP',
    SINK_LANDING_UNFIT: 'SINK_LANDING_UNFIT',
    COUNTERTOP_BELOW_COVER: 'COUNTERTOP_BELOW_COVER'
});

const finite = value => typeof value === 'number' && Number.isFinite(value);
const round = value => Math.round(value * 1e6) / 1e6;

/** `{ minM, maxM } | null` -> requested limits (null = defaults). Throws TypeError on bad input. */
export function normalizeCountertopLengthLimits(limits) {
    if (limits === null || limits === undefined) return DEFAULT_COUNTERTOP_LENGTH_LIMITS_M;
    if (typeof limits !== 'object' || Array.isArray(limits)) throw new TypeError('limits must be { minM, maxM } or null');
    const unknown = Object.keys(limits).filter(key => key !== 'minM' && key !== 'maxM');
    if (unknown.length) throw new TypeError(`limits: unknown key "${unknown[0]}"`);
    const minM = limits.minM ?? DEFAULT_COUNTERTOP_LENGTH_LIMITS_M.minM;
    const maxM = limits.maxM ?? DEFAULT_COUNTERTOP_LENGTH_LIMITS_M.maxM;
    if (!finite(minM) || !finite(maxM) || minM <= 0 || maxM <= 0) throw new TypeError('limits must be positive metres');
    if (minM > maxM) throw new TypeError('limits.minM must not exceed limits.maxM');
    return Object.freeze({ minM, maxM });
}

/** Length the top needs so every cut-out `{ minX, maxX }` stays inside, symmetric about `centerXM`. */
export function resolveBasinMinLengthM({ centerXM, cutoutsM = [], marginM = COUNTERTOP_BASIN_MARGIN_M } = {}) {
    if (!finite(centerXM)) return 0;
    let reach = 0;
    for (const cutout of cutoutsM) {
        if (!finite(cutout?.minX) || !finite(cutout?.maxX)) continue;
        reach = Math.max(reach, Math.abs(cutout.minX - centerXM), Math.abs(cutout.maxX - centerXM));
    }
    return reach > 0 ? round(2 * (reach + marginM)) : 0;
}

export function resolveCountertopLengthLimitsM({ requestedM = DEFAULT_COUNTERTOP_LENGTH_LIMITS_M, basinMinLengthM = 0 } = {}) {
    const basin = finite(basinMinLengthM) && basinMinLengthM > 0 ? basinMinLengthM : 0;
    const minLengthM = Math.max(requestedM.minM, basin);
    return Object.freeze({
        minLengthM, maxLengthM: Math.max(requestedM.maxM, minLengthM),
        requestedMinM: requestedM.minM, requestedMaxM: requestedM.maxM, basinMinLengthM: basin
    });
}

export function clampCountertopLengthM(lengthM, limits) {
    if (!limits) return lengthM;
    return Math.min(Math.max(lengthM, limits.minLengthM), limits.maxLengthM);
}

/**
 * Red reasons for a countertop state (`getState()` with `lengthLimitsM`). Length rules apply
 * only to a detached top (an attached one follows the composition and is not resizable).
 * `trapViolations` ([{ trapId, bodyId }], trap/trap-keepout.mjs) is red too; its bodies join `collidesWith`.
 * `coverageViolations` ([{ code }], countertop-resize-bounds.mjs; only set for a moved top) is red too.
 */
export function evaluateCountertopOverlay(state) {
    const reasons = [];
    const collision = state?.collision ?? { status: 'unknown', collidesWith: [] };
    if (collision.status === 'colliding') {
        reasons.push({ code: COUNTERTOP_OVERLAY_REASON.COLLISION, message: 'The countertop overlaps another object' });
    }
    const trapped = [...new Set((state?.trapViolations ?? []).map(v => v.bodyId))];
    if (trapped.length) {
        reasons.push({ code: COUNTERTOP_OVERLAY_REASON.TRAP_KEEPOUT, message: 'A cabinet is inside the sink trap clearance zone (6″ sides, 8″ below the countertop)' });
    }
    const coverage = state?.coverageViolations ?? [];
    if (coverage.some(v => v.code === COUNTERTOP_COVERAGE_REASON.BASIN_EDGE)) {
        reasons.push({ code: COUNTERTOP_OVERLAY_REASON.BASIN_EDGE_TOO_CLOSE, message: 'A basin cut-out is too close to a countertop end (10 cm)' });
    }
    if (coverage.some(v => v.code === COUNTERTOP_COVERAGE_REASON.SB_NOT_COVERED)) {
        reasons.push({ code: COUNTERTOP_OVERLAY_REASON.SINK_BASE_NOT_COVERED, message: 'The sink base is not fully covered by the countertop' });
    }
    const landing = state?.landingReasons ?? [];
    if (landing.includes(COUNTERTOP_OVERLAY_REASON.SINK_LANDING_GAP)) {
        reasons.push({ code: COUNTERTOP_OVERLAY_REASON.SINK_LANDING_GAP, message: 'The sink would land across two cabinets or over empty space' });
    }
    if (landing.includes(COUNTERTOP_OVERLAY_REASON.SINK_LANDING_UNFIT)) {
        reasons.push({ code: COUNTERTOP_OVERLAY_REASON.SINK_LANDING_UNFIT, message: 'The sink cannot land on this cabinet' });
    }
    if ((state?.heightReasons ?? []).includes(COUNTERTOP_OVERLAY_REASON.COUNTERTOP_BELOW_COVER)) {
        reasons.push({ code: COUNTERTOP_OVERLAY_REASON.COUNTERTOP_BELOW_COVER, message: 'A lowered countertop must stay beside the row, its top no lower than the adjacent cabinet cover' });
    }
    const lengthM = state?.size?.length, limits = state?.lengthLimitsM;
    if (finite(lengthM) && limits) {
        // The per-side coverage rule (countertop-resize-bounds.mjs) supersedes the symmetric basin minimum when it was evaluated.
        if (!Array.isArray(state?.coverageViolations) && limits.basinMinLengthM > 0 && lengthM < limits.basinMinLengthM - COUNTERTOP_LENGTH_EPSILON_M) {
            reasons.push({ code: COUNTERTOP_OVERLAY_REASON.BASIN_CONFLICT, message: 'A basin cut-out would leave the countertop' });
        }
        if (state.attached === false && (lengthM < limits.requestedMinM - COUNTERTOP_LENGTH_EPSILON_M ||
            lengthM > limits.maxLengthM + COUNTERTOP_LENGTH_EPSILON_M)) {
            reasons.push({ code: COUNTERTOP_OVERLAY_REASON.LENGTH_OUT_OF_RANGE, message: 'The countertop length is outside the allowed range' });
        }
    }
    const status = reasons.length ? 'colliding' : collision.status === 'clear' ? 'clear' : 'unknown';
    return { status, reasons, collidesWith: [...new Set([...(collision.collidesWith ?? []), ...trapped])] };
}

/** World X extent of a cut-out helper: every mesh under it, visible or not (cutters are hidden). */
export function measureCutoutExtentXM(entity) {
    let minX = Infinity, maxX = -Infinity;
    const visit = node => {
        if (!node) return;
        for (const component of [node.render, node.model]) {
            for (const meshInstance of component?.meshInstances ?? []) {
                const c = meshInstance?.aabb?.center, h = meshInstance?.aabb?.halfExtents;
                if (!finite(c?.x) || !finite(h?.x)) continue;
                minX = Math.min(minX, c.x - Math.abs(h.x));
                maxX = Math.max(maxX, c.x + Math.abs(h.x));
            }
        }
        for (const child of node.children ?? []) visit(child);
    };
    syncEntityWorld(entity);
    visit(entity);
    return Number.isFinite(minX) && Number.isFinite(maxX) ? { minX, maxX } : null;
}
