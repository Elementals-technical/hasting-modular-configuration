import { CABINET_COVER_PLAN_VERSION, COVER_DIAGNOSTIC_CODE } from './cover-contracts.mjs';

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const finite = value => typeof value === 'number' && Number.isFinite(value);
const byString = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const uniqueSorted = values => [...new Set(values)].sort(byString);
const intersects = (aMin, aMax, bMin, bMax) => Math.min(aMax, bMax) > Math.max(aMin, bMin);
const withinDistance = (a, b, tolerance) => {
    const distance = Math.abs(a - b);
    if (!Number.isFinite(distance)) return false;
    // Allow arithmetic noise at an explicit tolerance boundary, but do not let
    // a large world-space origin turn a real physical gap into adjacency.
    return distance <= tolerance + 8 * Number.EPSILON * Math.max(1, distance, tolerance);
};
const diagnostic = (code, sourceIds = [], details) => ({
    code, sourceIds: uniqueSorted(sourceIds), ...(details === undefined ? {} : { details })
});
const compareDiagnostic = (a, b) => byString(a.code, b.code) ||
    byString(a.sourceIds.join('\0'), b.sourceIds.join('\0')) ||
    byString(JSON.stringify(a.details), JSON.stringify(b.details));

function invalid(field, sourceIds = [], reason = 'Required valid value') {
    return diagnostic(COVER_DIAGNOSTIC_CODE.INVALID_INPUT, sourceIds, { field, reason });
}

function checkId(value, field, diagnostics, sourceIds = []) {
    if (!nonempty(value)) diagnostics.push(invalid(field, sourceIds, 'Expected nonempty string'));
}

function checkSpan(item, minField, maxField, prefix, diagnostics, sourceIds) {
    const min = item[minField];
    const max = item[maxField];
    if (!finite(min) || !finite(max) || !(max > min)) {
        diagnostics.push(invalid(`${prefix}.${minField}/${maxField}`, sourceIds, 'Expected finite positive span'));
    }
}

function checkCoordinate(item, field, prefix, diagnostics, sourceIds) {
    if (!finite(item[field])) diagnostics.push(invalid(`${prefix}.${field}`, sourceIds, 'Expected finite number'));
}

function collectGeometryErrors(input, withThickness = true) {
    const errors = [];
    const unsupported = [];
    const settings = input.settings;
    const tolerances = input.tolerances;
    if (withThickness && (!finite(settings.thicknessM) || !(settings.thicknessM > 0))) {
        errors.push(invalid('settings.thicknessM', [], 'Expected finite positive number'));
    }
    if (!isRecord(tolerances)) {
        errors.push(invalid('tolerances', [], 'Expected object'));
    } else {
        for (const field of ['contactM', 'adjacencyM', 'numericalM']) {
            if (!finite(tolerances[field]) || tolerances[field] < 0) {
                errors.push(invalid(`tolerances.${field}`, [], 'Expected finite nonnegative number'));
            }
        }
    }
    if (!Array.isArray(input.supports)) errors.push(invalid('supports', [], 'Expected array'));
    if (!Array.isArray(input.basinTops)) errors.push(invalid('basinTops', [], 'Expected array'));
    if (Array.isArray(input.supports)) {
        const seen = new Set();
        for (const item of input.supports) {
            const prefix = isRecord(item) && nonempty(item.supportId)
                ? `supports.${item.supportId}` : 'supports';
            if (!isRecord(item)) {
                errors.push(invalid(prefix, [], 'Expected object'));
                continue;
            }
            const ids = nonempty(item.supportId) ? [item.supportId] : [];
            checkId(item.supportId, `${prefix}.supportId`, errors, ids);
            checkId(item.cabinetId, `${prefix}.cabinetId`, errors, ids);
            checkId(item.productType, `${prefix}.productType`, errors, ids);
            checkId(item.compatibilityKey, `${prefix}.compatibilityKey`, errors, ids);
            checkId(item.materialId, `${prefix}.materialId`, errors, ids);
            if (nonempty(item.supportId)) {
                if (seen.has(item.supportId)) errors.push(invalid(`${prefix}.supportId`, ids, 'Duplicate support ID'));
                seen.add(item.supportId);
            }
            checkSpan(item, 'xMinM', 'xMaxM', prefix, errors, ids);
            checkSpan(item, 'zMinM', 'zMaxM', prefix, errors, ids);
            checkCoordinate(item, 'yTopM', prefix, errors, ids);
            // yBottomM is optional: callers built before carried cabinets omit it.
            const hasBottom = item.yBottomM !== undefined;
            if (hasBottom && (!finite(item.yBottomM) || item.yBottomM > item.yTopM)) {
                errors.push(invalid(`${prefix}.yBottomM`, ids, 'Expected finite number not above yTopM'));
            }
            if (!['direct', 'extension', 'none', 'unknown'].includes(item.eligibility)) {
                errors.push(invalid(`${prefix}.eligibility`, ids, 'Expected direct, extension, none, or unknown'));
            } else if (item.eligibility === 'unknown') {
                unsupported.push(diagnostic(COVER_DIAGNOSTIC_CODE.UNKNOWN_ELIGIBILITY, ids,
                    { field: `${prefix}.eligibility` }));
            }
            // The v1 DTO is axis-aligned. Explicit orientation metadata must not be silently ignored.
            for (const field of ['orientation', 'rotation', 'rotationY', 'rotationYRad', 'rotationYDeg', 'yaw']) {
                if (Object.hasOwn(item, field) && item[field] !== null && item[field] !== 0 && item[field] !== 'axis-aligned') {
                    unsupported.push(diagnostic(COVER_DIAGNOSTIC_CODE.UNSUPPORTED_ORIENTATION, ids,
                        { field: `${prefix}.${field}` }));
                }
            }
        }
    }
    if (Array.isArray(input.basinTops)) {
        const seen = new Set();
        for (const item of input.basinTops) {
            const prefix = isRecord(item) && nonempty(item.productId)
                ? `basinTops.${item.productId}` : 'basinTops';
            if (!isRecord(item)) {
                errors.push(invalid(prefix, [], 'Expected object'));
                continue;
            }
            const ids = nonempty(item.productId) ? [item.productId] : [];
            checkId(item.productId, `${prefix}.productId`, errors, ids);
            if (nonempty(item.productId)) {
                if (seen.has(item.productId)) errors.push(invalid(`${prefix}.productId`, ids, 'Duplicate basin product ID'));
                seen.add(item.productId);
            }
            checkSpan(item, 'xMinM', 'xMaxM', prefix, errors, ids);
            checkSpan(item, 'zMinM', 'zMaxM', prefix, errors, ids);
            checkCoordinate(item, 'yBottomM', prefix, errors, ids);
            for (const field of ['orientation', 'rotation', 'rotationY', 'rotationYRad', 'rotationYDeg', 'yaw']) {
                if (Object.hasOwn(item, field) && item[field] !== null && item[field] !== 0 && item[field] !== 'axis-aligned') {
                    unsupported.push(diagnostic(COVER_DIAGNOSTIC_CODE.UNSUPPORTED_ORIENTATION, ids,
                        { field: `${prefix}.${field}` }));
                }
            }
        }
    }
    return { errors, unsupported };
}

function compareSupport(a, b) {
    return a.xMinM - b.xMinM || a.xMaxM - b.xMaxM ||
        a.yTopM - b.yTopM || a.zMinM - b.zMinM || a.zMaxM - b.zMaxM ||
        byString(a.compatibilityKey, b.compatibilityKey) ||
        byString(a.materialId, b.materialId) || byString(a.supportId, b.supportId);
}

function compareBasin(a, b) {
    return a.xMinM - b.xMinM || a.xMaxM - b.xMaxM ||
        a.yBottomM - b.yBottomM || a.zMinM - b.zMinM || a.zMaxM - b.zMaxM ||
        byString(a.productId, b.productId);
}

function samePlane(a, b, contactM) {
    return withinDistance(a.yTopM, b.yTopM, contactM);
}

function sameDepth(a, b, numericalM) {
    return withinDistance(a.zMinM, b.zMinM, numericalM) &&
        withinDistance(a.zMaxM, b.zMaxM, numericalM);
}

function incompatibleOverlaps(supports, contactM, numericalM) {
    const diagnostics = [];
    for (let i = 0; i < supports.length; i++) {
        const a = supports[i];
        for (let j = i + 1; j < supports.length; j++) {
            const b = supports[j];
            if (!intersects(a.xMinM, a.xMaxM, b.xMinM, b.xMaxM) ||
                !intersects(a.zMinM, a.zMaxM, b.zMinM, b.zMaxM) ||
                !samePlane(a, b, contactM)) continue;
            if (a.compatibilityKey !== b.compatibilityKey || a.materialId !== b.materialId ||
                !sameDepth(a, b, numericalM) ||
                (a.eligibility === 'none') !== (b.eligibility === 'none')) {
                diagnostics.push(diagnostic(COVER_DIAGNOSTIC_CODE.INCOMPATIBLE_SUPPORT_OVERLAP,
                    [a.supportId, b.supportId], { compatibilityKeys: [a.compatibilityKey, b.compatibilityKey] }));
            }
        }
    }
    return diagnostics;
}

function blocksConnection(left, right, noneSupports, anchor, tolerances) {
    return noneSupports.some(item =>
        item.compatibilityKey === anchor.compatibilityKey &&
        samePlane(item, anchor, tolerances.contactM) &&
        sameDepth(item, anchor, tolerances.numericalM) &&
        item.xMinM <= right && item.xMaxM >= left);
}

function groupSupports(supports, tolerances) {
    const none = supports.filter(item => item.eligibility === 'none');
    const coverable = supports.filter(item => item.eligibility !== 'none');
    const groups = [];
    for (const item of coverable) {
        let target = null;
        for (const group of groups) {
            if (group.anchor.compatibilityKey !== item.compatibilityKey ||
                group.anchor.materialId !== item.materialId ||
                !samePlane(group.anchor, item, tolerances.contactM) ||
                !sameDepth(group.anchor, item, tolerances.numericalM) ||
                (item.xMinM > group.xMaxM &&
                    !withinDistance(item.xMinM, group.xMaxM, tolerances.adjacencyM)) ||
                blocksConnection(group.xMaxM, item.xMinM, none, group.anchor, tolerances)) continue;
            target = group;
            break;
        }
        if (target) {
            target.members.push(item);
            target.xMaxM = Math.max(target.xMaxM, item.xMaxM);
        } else {
            groups.push({ anchor: item, members: [item], xMinM: item.xMinM, xMaxM: item.xMaxM });
        }
    }
    return groups.filter(group => group.members.some(item => item.eligibility === 'direct'));
}

function unionIntervals(intervals) {
    const sorted = intervals.filter(([start, end]) => end > start)
        .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const union = [];
    for (const interval of sorted) {
        const last = union[union.length - 1];
        if (last && interval[0] <= last[1]) last[1] = Math.max(last[1], interval[1]);
        else union.push([...interval]);
    }
    return union;
}

function subtractIntervals(start, end, intervals) {
    const remaining = [];
    let cursor = start;
    for (const [cutStart, cutEnd] of unionIntervals(intervals)) {
        if (cutEnd <= cursor || cutStart >= end) continue;
        if (cutStart > cursor) remaining.push([cursor, Math.min(cutStart, end)]);
        cursor = Math.max(cursor, cutEnd);
        if (cursor >= end) break;
    }
    if (cursor < end) remaining.push([cursor, end]);
    return remaining;
}

/**
 * X intervals of `item`'s top that another cabinet stands on, so no cover goes there.
 * A cabinet stands on `item` when its bottom touches item's top (within contactM)
 * and their footprints overlap in X and Z. Supports without yBottomM never stand on anything.
 *
 * Example: item x 0..0.6, yTop 0.28; other x 0.1..0.45, yBottom 0.28 -> [[0.1, 0.45]].
 */
function intervalsUnderCarriedCabinets(item, supports, tolerances) {
    const intervals = [];
    for (const other of supports) {
        // A support cannot stand on itself.
        if (other.supportId === item.supportId) continue;
        // Older callers do not report a bottom, so nothing is known to stand on item.
        if (other.yBottomM === undefined) continue;
        // A gap larger than contactM means the other cabinet does not rest on this top.
        if (!withinDistance(other.yBottomM, item.yTopM, tolerances.contactM)) continue;
        if (!intersects(item.xMinM, item.xMaxM, other.xMinM, other.xMaxM)) continue;
        if (!intersects(item.zMinM, item.zMaxM, other.zMinM, other.zMaxM)) continue;
        intervals.push([Math.max(item.xMinM, other.xMinM), Math.min(item.xMaxM, other.xMaxM)]);
    }
    return intervals;
}

function compareSegment(a, b) {
    return a.yBottomM - b.yBottomM || a.zMinM - b.zMinM || a.zMaxM - b.zMaxM ||
        a.xMinM - b.xMinM || a.xMaxM - b.xMaxM ||
        byString(a.compatibilityKey, b.compatibilityKey) ||
        byString(a.supportIds.join('\0'), b.supportIds.join('\0'));
}

function makeSegment(group, xMinM, xMaxM, settings, withThickness) {
    const members = group.members.filter(item => intersects(item.xMinM, item.xMaxM, xMinM, xMaxM));
    if (members.length === 0) return null;
    const supportIds = uniqueSorted(members.map(item => item.supportId));
    const cabinetIds = uniqueSorted(members.map(item => item.cabinetId));
    const { anchor } = group;
    return {
        planKey: JSON.stringify([anchor.compatibilityKey, anchor.yTopM, anchor.zMinM, anchor.zMaxM,
            xMinM, xMaxM, supportIds]),
        supportIds, cabinetIds, compatibilityKey: anchor.compatibilityKey,
        xMinM, xMaxM, yBottomM: anchor.yTopM, zMinM: anchor.zMinM, zMaxM: anchor.zMaxM,
        ...(withThickness ? { thicknessM: settings.thicknessM } : {}),
        materialId: nonempty(settings.materialId) ? settings.materialId.trim() : anchor.materialId
    };
}

/** Compute cabinet covers from explicit, axis-aligned world-space metres. Never mutates input. */
export function planCabinetCovers(input) {
    return planGeometry(input, true);
}

/** Geometry-only footprint query. Never invent a thickness just to detect uncovered supports. */
export function planCabinetCoverFootprints(input) {
    return planGeometry(input, false);
}

function planGeometry(input, withThickness) {
    const compositionId = isRecord(input) && nonempty(input.compositionId) ? input.compositionId : null;
    const revision = isRecord(input) && Number.isSafeInteger(input.revision) && input.revision >= 0
        ? input.revision : null;
    const result = (status, segments, diagnostics) => ({
        version: CABINET_COVER_PLAN_VERSION, compositionId, revision, status, segments,
        diagnostics: diagnostics.sort(compareDiagnostic)
    });
    const envelopeErrors = [];
    if (!isRecord(input)) return result('invalid', [], [invalid('input', [], 'Expected object')]);
    if (input.version !== CABINET_COVER_PLAN_VERSION) envelopeErrors.push(invalid('version', [], 'Expected version 1'));
    if (!nonempty(input.compositionId)) envelopeErrors.push(invalid('compositionId', [], 'Expected nonempty string'));
    if (!Number.isSafeInteger(input.revision) || input.revision < 0) {
        envelopeErrors.push(invalid('revision', [], 'Expected nonnegative safe integer'));
    }
    if (input.frame !== 'world') envelopeErrors.push(invalid('frame', [], 'Expected world'));
    if (input.units !== 'm') envelopeErrors.push(invalid('units', [], 'Expected metres'));
    if (!nonempty(input.profileId)) envelopeErrors.push(invalid('profileId', [], 'Expected nonempty string'));
    if (!isRecord(input.settings)) envelopeErrors.push(invalid('settings', [], 'Expected object'));
    else if (typeof input.settings.enabled !== 'boolean') {
        envelopeErrors.push(invalid('settings.enabled', [], 'Expected boolean'));
    }
    if (envelopeErrors.length) return result('invalid', [], envelopeErrors);
    if (!input.settings.enabled) return result('ready', [], []);

    const { errors, unsupported } = collectGeometryErrors(input, withThickness);
    if (errors.length) return result('invalid', [], errors);
    if (unsupported.length) return result('unsupported', [], unsupported);

    const supports = [...input.supports].sort(compareSupport);
    const basinTops = [...input.basinTops].sort(compareBasin);
    const conflicts = incompatibleOverlaps(supports, input.tolerances.contactM, input.tolerances.numericalM);
    if (conflicts.length) return result('unsupported', [], conflicts);
    const groups = groupSupports(supports, input.tolerances);
    const depthErrors = [];
    const segments = [];
    for (const group of groups) {
        const covered = [];
        // 1. intervals under a basin top
        for (const basin of basinTops) {
            for (const item of group.members) {
                if (!intersects(item.xMinM, item.xMaxM, basin.xMinM, basin.xMaxM) ||
                    !withinDistance(item.yTopM, basin.yBottomM, input.tolerances.contactM) ||
                    !intersects(item.zMinM, item.zMaxM, basin.zMinM, basin.zMaxM)) continue;
                if ((basin.zMinM > item.zMinM &&
                    !withinDistance(basin.zMinM, item.zMinM, input.tolerances.numericalM)) ||
                    (basin.zMaxM < item.zMaxM &&
                    !withinDistance(basin.zMaxM, item.zMaxM, input.tolerances.numericalM))) {
                    depthErrors.push(diagnostic(COVER_DIAGNOSTIC_CODE.PARTIAL_DEPTH_OVERLAP,
                        [item.supportId, basin.productId], { supportId: item.supportId, productId: basin.productId }));
                } else {
                    covered.push([Math.max(item.xMinM, basin.xMinM), Math.min(item.xMaxM, basin.xMaxM)]);
                }
            }
        }
        // 2. intervals under a cabinet standing on this support
        for (const item of group.members) {
            covered.push(...intervalsUnderCarriedCabinets(item, supports, input.tolerances));
        }
        // 3. the rest gets a cover
        for (const [start, end] of subtractIntervals(group.xMinM, group.xMaxM, covered)) {
            const segment = makeSegment(group, start, end, input.settings, withThickness);
            if (segment) segments.push(segment);
        }
    }
    if (depthErrors.length) return result('unsupported', [], depthErrors);
    return result('ready', segments.sort(compareSegment), []);
}
