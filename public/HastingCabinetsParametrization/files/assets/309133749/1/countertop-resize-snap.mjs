/**
 * Countertop end-handle resize math (engine-free, metres along world X).
 * - closestPointOnLineToRay / lineXAtRay: perspective-safe pointer -> world X (camera ray vs the
 *   world line along X through the moving end);
 * - anchoredLengthM: one end moves, the opposite end (anchor) stays;
 * - collectCountertopEdgeTargets + snapCountertopLengthM: snap the moving end to cabinet /
 *   composition edges and the length to the limits / basin minimum within 1 in, otherwise round
 *   the length to 0.1 in steps (HR-CT-03); finally clamp (the clamp wins over the rounding) to [minLengthM, maxLengthM].
 */
export const RESIZE_INCH_M = 0.0254;
export const COUNTERTOP_RESIZE_SNAP_TOLERANCE_M = RESIZE_INCH_M;
export const COUNTERTOP_RESIZE_STEP_M = RESIZE_INCH_M / 10;
const PARALLEL_EPSILON = 1e-9;
const CLAMP_EPSILON_M = 1e-6;
const SNAP_PRIORITY = Object.freeze(['composition-edge', 'cabinet-edge', 'limit-min', 'limit-max', 'basin-min']);

const finite = value => typeof value === 'number' && Number.isFinite(value);
const isPoint = p => finite(p?.x) && finite(p?.y) && finite(p?.z);
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const round6 = value => Math.round(value * 1e6) / 1e6;

/**
 * Closest point on the infinite line `linePoint + s * lineDirection` to the ray
 * `rayOrigin + t * rayDirection` (t >= 0). Null for bad input or a near-parallel ray.
 */
export function closestPointOnLineToRay({ rayOrigin, rayDirection, linePoint, lineDirection } = {}) {
    if (![rayOrigin, rayDirection, linePoint, lineDirection].every(isPoint)) return null;
    const a = dot(lineDirection, lineDirection), c = dot(rayDirection, rayDirection);
    if (a < PARALLEL_EPSILON || c < PARALLEL_EPSILON) return null;
    const b = dot(lineDirection, rayDirection), w0 = sub(linePoint, rayOrigin);
    const d = dot(lineDirection, w0), e = dot(rayDirection, w0);
    const denom = a * c - b * b;
    if (denom <= PARALLEL_EPSILON * a * c) return null;
    let t = (a * e - b * d) / denom;
    let s = (b * e - c * d) / denom;
    if (t < 0) { t = 0; s = -d / a; } // the ray starts in front of the camera
    return {
        s, t,
        point: { x: linePoint.x + s * lineDirection.x, y: linePoint.y + s * lineDirection.y, z: linePoint.z + s * lineDirection.z }
    };
}

/** World X where the ray passes closest to the line along X at (yM, zM); null when parallel. */
export function lineXAtRay({ rayOrigin, rayDirection, yM, zM } = {}) {
    if (!finite(yM) || !finite(zM)) return null;
    const hit = closestPointOnLineToRay({ rayOrigin, rayDirection, linePoint: { x: 0, y: yM, z: zM }, lineDirection: { x: 1, y: 0, z: 0 } });
    return hit && finite(hit.point.x) ? hit.point.x : null;
}

const assertSide = side => { if (side !== 'left' && side !== 'right') throw new TypeError("side must be 'left' or 'right'"); };

/** Length with the `side` end at `xM` and the opposite end fixed at `anchorXM`. */
export function anchoredLengthM(side, xM, anchorXM) {
    assertSide(side);
    if (!finite(xM) || !finite(anchorXM)) throw new TypeError('xM and anchorXM must be finite');
    return side === 'right' ? xM - anchorXM : anchorXM - xM;
}

/** Moving-end X for a length (inverse of anchoredLengthM). */
export const movingEndXM = (side, lengthM, anchorXM) => (assertSide(side), side === 'right' ? anchorXM + lengthM : anchorXM - lengthM);

/**
 * `[{ minM, maxM }]` cabinet boxes -> `[{ kind, xM }]`: min/max X of every cabinet
 * ('cabinet-edge') plus the composition min/max over all cabinets ('composition-edge', which
 * replaces a cabinet edge at the same X).
 */
export function collectCountertopEdgeTargets(boxes = []) {
    const xs = [];
    for (const box of boxes ?? []) {
        if (finite(box?.minM?.x)) xs.push(box.minM.x);
        if (finite(box?.maxM?.x)) xs.push(box.maxM.x);
    }
    if (!xs.length) return [];
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const targets = [{ kind: 'composition-edge', xM: minX }];
    if (maxX !== minX) targets.push({ kind: 'composition-edge', xM: maxX });
    for (const x of xs) {
        if (targets.some(target => Math.abs(target.xM - x) < CLAMP_EPSILON_M)) continue;
        targets.push({ kind: 'cabinet-edge', xM: x });
    }
    return targets;
}

/**
 * Snap / round / clamp a raw anchored length.
 * @returns {{ lengthM, rawLengthM, snappedTo: null | { kind, xM } }}
 */
export function snapCountertopLengthM({ side, rawLengthM, anchorXM, edgeTargets = [], limits = null, snap = true,
    toleranceM = COUNTERTOP_RESIZE_SNAP_TOLERANCE_M, stepM = COUNTERTOP_RESIZE_STEP_M } = {}) {
    assertSide(side);
    if (!finite(rawLengthM) || !finite(anchorXM)) throw new TypeError('rawLengthM and anchorXM must be finite');
    let lengthM = rawLengthM, snappedTo = null;
    if (snap) {
        const candidates = [];
        for (const target of edgeTargets ?? []) {
            if (!finite(target?.xM)) continue;
            const length = anchoredLengthM(side, target.xM, anchorXM);
            if (length > 0) candidates.push({ kind: target.kind, xM: target.xM, lengthM: length });
        }
        const lengthTargets = [['limit-min', limits?.minLengthM], ['limit-max', limits?.maxLengthM], ['basin-min', limits?.basinMinLengthM]];
        for (const [kind, length] of lengthTargets) {
            if (finite(length) && length > 0) candidates.push({ kind, xM: movingEndXM(side, length, anchorXM), lengthM: length });
        }
        let best = null;
        for (const candidate of candidates) {
            const distance = Math.abs(candidate.lengthM - rawLengthM);
            if (distance > toleranceM + 1e-12) continue;
            const rank = SNAP_PRIORITY.indexOf(candidate.kind);
            if (!best || distance < best.distance - 1e-9 || (Math.abs(distance - best.distance) <= 1e-9 && rank < best.rank)) {
                best = { ...candidate, distance, rank };
            }
        }
        if (best) { lengthM = best.lengthM; snappedTo = { kind: best.kind, xM: round6(best.xM) }; }
        else if (finite(stepM) && stepM > 0) lengthM = Math.round(rawLengthM / stepM) * stepM;
    }
    if (limits && finite(limits.minLengthM) && finite(limits.maxLengthM)) {
        const clamped = Math.min(Math.max(lengthM, limits.minLengthM), limits.maxLengthM);
        if (Math.abs(clamped - lengthM) > CLAMP_EPSILON_M) {
            const kind = clamped <= limits.minLengthM ? 'limit-min' : 'limit-max';
            snappedTo = { kind, xM: round6(movingEndXM(side, clamped, anchorXM)) };
        }
        lengthM = clamped;
    }
    return { lengthM: round6(lengthM), rawLengthM: round6(rawLengthM), snappedTo };
}
