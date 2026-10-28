/** Pure matching of a new cover plan against the last published logical products. */

const finite = value => typeof value === 'number' && Number.isFinite(value);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const byString = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const sortedIds = ids => [...ids].sort(byString);
const cloneSegment = segment => ({
    ...segment, supportIds: [...segment.supportIds], cabinetIds: [...segment.cabinetIds]
});

function validSegment(segment) {
    return segment && typeof segment === 'object' && !Array.isArray(segment) &&
        nonempty(segment.planKey) && nonempty(segment.compatibilityKey) &&
        nonempty(segment.materialId) &&
        Array.isArray(segment.supportIds) && segment.supportIds.length > 0 &&
        segment.supportIds.every(nonempty) &&
        Array.isArray(segment.cabinetIds) && segment.cabinetIds.length > 0 &&
        segment.cabinetIds.every(nonempty) &&
        finite(segment.xMinM) && finite(segment.xMaxM) && segment.xMaxM > segment.xMinM &&
        finite(segment.zMinM) && finite(segment.zMaxM) && segment.zMaxM > segment.zMinM &&
        finite(segment.yBottomM) && finite(segment.thicknessM) && segment.thicknessM > 0;
}

function compareNew(a, b) {
    return a.yBottomM - b.yBottomM || a.zMinM - b.zMinM || a.zMaxM - b.zMaxM ||
        a.xMinM - b.xMinM || a.xMaxM - b.xMaxM ||
        byString(sortedIds(a.supportIds).join('\0'), sortedIds(b.supportIds).join('\0')) ||
        byString(a.compatibilityKey, b.compatibilityKey) ||
        byString(sortedIds(a.cabinetIds).join('\0'), sortedIds(b.cabinetIds).join('\0')) ||
        byString(a.materialId, b.materialId) || a.thicknessM - b.thicknessM ||
        byString(a.planKey, b.planKey);
}

function geometrySourceIdentity(segment) {
    return JSON.stringify([
        segment.yBottomM, segment.zMinM, segment.zMaxM,
        segment.xMinM, segment.xMaxM, segment.compatibilityKey,
        sortedIds(segment.supportIds), sortedIds(segment.cabinetIds)
    ]);
}

function canonicalValue(value) {
    if (Array.isArray(value)) return value.map(canonicalValue);
    if (value && typeof value === 'object') {
        const result = {};
        for (const key of Object.keys(value).sort(byString)) result[key] = canonicalValue(value[key]);
        return result;
    }
    return value;
}

function semanticallyEqual(a, b) {
    return JSON.stringify(canonicalValue(a)) === JSON.stringify(canonicalValue(b));
}

function sharedAndDifferent(a, b) {
    const oldIds = new Set(a.supportIds);
    const newIds = new Set(b.supportIds);
    let shared = 0;
    for (const id of oldIds) if (newIds.has(id)) shared++;
    return { shared, differing: oldIds.size + newIds.size - 2 * shared };
}

function overlapArea(a, b) {
    const width = Math.max(0, Math.min(a.xMaxM, b.xMaxM) - Math.max(a.xMinM, b.xMinM));
    const depth = Math.max(0, Math.min(a.zMaxM, b.zMaxM) - Math.max(a.zMinM, b.zMinM));
    return width * depth;
}

function squaredCentreDistance(a, b) {
    const dx = (a.xMinM + a.xMaxM - b.xMinM - b.xMaxM) / 2;
    const dy = a.yBottomM - b.yBottomM;
    const dz = (a.zMinM + a.zMaxM - b.zMinM - b.zMaxM) / 2;
    return dx * dx + dy * dy + dz * dz;
}

function comparePair(a, b) {
    return b.overlap - a.overlap || b.shared - a.shared ||
        a.differing - b.differing || a.distance - b.distance ||
        byString(a.productId, b.productId) || a.newOrdinal - b.newOrdinal;
}

/**
 * Return canonical reuse/replace/create choices without allocating product IDs
 * or touching published resources. Invalid/unsupported plans cannot remove them.
 */
export function planCoverReconciliation({ previous, plan } = {}) {
    if (plan?.status === 'invalid' || plan?.status === 'unsupported') {
        return { status: plan.status, next: [], remove: [] };
    }
    if (plan?.status !== 'ready' || !Array.isArray(plan.segments) ||
        !plan.segments.every(validSegment) || !Array.isArray(previous) ||
        !previous.every(entry => entry && nonempty(entry.productId) && validSegment(entry.segment)) ||
        new Set(previous.map(entry => entry.productId)).size !== previous.length) {
        return { status: 'invalid', next: [], remove: [] };
    }

    const old = [...previous].sort((a, b) => byString(a.productId, b.productId));
    const fresh = [...plan.segments].sort(compareNew);
    const oldUsed = new Set();
    const newAssigned = new Map();

    // Exact geometry and source identity take precedence over pair rankings.
    for (let ordinal = 0; ordinal < fresh.length; ordinal++) {
        const candidate = fresh[ordinal];
        const identity = geometrySourceIdentity(candidate);
        const matches = old.filter(entry => !oldUsed.has(entry.productId) &&
            geometrySourceIdentity(entry.segment) === identity);
        if (!matches.length) continue;
        matches.sort((a, b) => Number(semanticallyEqual(b.segment, candidate)) -
            Number(semanticallyEqual(a.segment, candidate)) || byString(a.productId, b.productId));
        const match = matches[0];
        oldUsed.add(match.productId);
        newAssigned.set(ordinal, match);
    }

    const pairs = [];
    for (let ordinal = 0; ordinal < fresh.length; ordinal++) {
        if (newAssigned.has(ordinal)) continue;
        const candidate = fresh[ordinal];
        for (const entry of old) {
            if (oldUsed.has(entry.productId) ||
                entry.segment.compatibilityKey !== candidate.compatibilityKey) continue;
            const { shared, differing } = sharedAndDifferent(entry.segment, candidate);
            if (!shared) continue;
            pairs.push({
                newOrdinal: ordinal, productId: entry.productId,
                overlap: overlapArea(entry.segment, candidate), shared, differing,
                distance: squaredCentreDistance(entry.segment, candidate), entry
            });
        }
    }
    pairs.sort(comparePair);
    for (const pair of pairs) {
        if (oldUsed.has(pair.productId) || newAssigned.has(pair.newOrdinal)) continue;
        oldUsed.add(pair.productId);
        newAssigned.set(pair.newOrdinal, pair.entry);
    }

    const next = fresh.map((segment, ordinal) => {
        const match = newAssigned.get(ordinal);
        return {
            action: !match ? 'create' : semanticallyEqual(match.segment, segment) ? 'reuse' : 'replace',
            productId: match?.productId ?? null,
            segment: cloneSegment(segment)
        };
    });
    const remove = old.filter(entry => !oldUsed.has(entry.productId)).map(entry => entry.productId);
    return { status: 'ready', next, remove };
}
