import { SPATIAL_MANIPULATION_SCHEMA_VERSION } from '../contracts/constants.mjs';
import { throwSpatialInvalidInput, SPATIAL_MANIPULATION_ERROR_CODE } from '../contracts/errors.mjs';
import { deepFreeze, assertExactKeys, assertPlainData, pathOf } from '../contracts/immutable.mjs';
import { normalizeMotionFrameV1, buildFramePointM } from '../motion/frame.mjs';
import { MOTION_AXES, normalizeUvM, normalizeMotionGrid, resolveDragGridOffsetM } from '../motion/grid.mjs';
import { normalizeMotionBoundsM, clampOffsetToBoundsM } from '../motion/bounds.mjs';
import { createSnapCandidatesV1, normalizeSnapGeometrySnapshotV1 } from './candidates.mjs';
import { createNextSnapLatchV1, normalizeSnapLatchV1 } from './latch.mjs';

const REQUEST_KEYS = [
    'schemaVersion',
    'frame',
    'requestedOffsetM',
    'currentAppliedOffsetM',
    'allowedAxes',
    'snapshot',
    'activeLatch',
    'thresholds',
    'motionPreview',
    'metric'
];
const THRESHOLD_KEYS = [
    'engagePx',
    'releasePx',
    'switchMarginPx',
    'tieEpsilonPx'
];
const MOTION_PREVIEW_KEYS = [
    'boundsM',
    'grid',
    'rawOffsetM'
];
const METRIC_KEYS = [
    'metricId',
    'unit',
    'projectionRevision',
    'measure'
];
const requireSchemaVersion = (value, path)=>{
    if (value !== SPATIAL_MANIPULATION_SCHEMA_VERSION) {
        throwSpatialInvalidInput(path);
    }
    return value;
};
const requireNumber = (value, path)=>{
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throwSpatialInvalidInput(path);
    }
    return value;
};
const requireRevision = (value, path)=>{
    if (!Number.isSafeInteger(value) || value < 0) {
        throwSpatialInvalidInput(path);
    }
    return value;
};
const requireStringId = (value, path)=>{
    if (typeof value !== 'string' || value.length === 0) {
        throwSpatialInvalidInput(path);
    }
    return value;
};
const throwSpatialStale = (code, field)=>{
    const error = new Error(`Stale spatial manipulation dependency: ${field}`);
    error.code = code;
    error.field = field;
    throw error;
};
const normalizeAxisList = (value, path)=>{
    if (!Array.isArray(value)) {
        throwSpatialInvalidInput(path);
    }
    const seen = new Set();
    return value.map((axis, index)=>{
        if (!MOTION_AXES.includes(axis) || seen.has(axis)) {
            throwSpatialInvalidInput(pathOf(path, index));
        }
        seen.add(axis);
        return axis;
    });
};
const normalizeThresholds = (value, path)=>{
    assertPlainData(value, path);
    assertExactKeys(value, THRESHOLD_KEYS, path);
    const engagePx = requireNumber(value.engagePx, pathOf(path, 'engagePx'));
    const releasePx = requireNumber(value.releasePx, pathOf(path, 'releasePx'));
    const switchMarginPx = requireNumber(value.switchMarginPx, pathOf(path, 'switchMarginPx'));
    const tieEpsilonPx = requireNumber(value.tieEpsilonPx, pathOf(path, 'tieEpsilonPx'));
    if (engagePx < 0) throwSpatialInvalidInput(pathOf(path, 'engagePx'));
    if (releasePx <= engagePx) throwSpatialInvalidInput(pathOf(path, 'releasePx'));
    if (switchMarginPx < 0) throwSpatialInvalidInput(pathOf(path, 'switchMarginPx'));
    if (tieEpsilonPx < 0) throwSpatialInvalidInput(pathOf(path, 'tieEpsilonPx'));
    return {
        engagePx,
        releasePx,
        switchMarginPx,
        tieEpsilonPx
    };
};
const normalizeMotionPreview = (value, path)=>{
    assertPlainData(value, path);
    assertExactKeys(value, MOTION_PREVIEW_KEYS, path);
    return {
        boundsM: normalizeMotionBoundsM(value.boundsM, pathOf(path, 'boundsM')),
        grid: value.grid === null ? null : normalizeMotionGrid(value.grid, pathOf(path, 'grid')),
        rawOffsetM: normalizeUvM(value.rawOffsetM, pathOf(path, 'rawOffsetM'))
    };
};
const normalizeMetric = (value, path)=>{
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        throwSpatialInvalidInput(path);
    }
    assertExactKeys(value, METRIC_KEYS, path);
    if (value.unit !== 'css-px') {
        throwSpatialInvalidInput(pathOf(path, 'unit'));
    }
    if (typeof value.measure !== 'function') {
        throwSpatialInvalidInput(pathOf(path, 'measure'));
    }
    return {
        metricId: requireStringId(value.metricId, pathOf(path, 'metricId')),
        unit: 'css-px',
        projectionRevision: requireRevision(value.projectionRevision, pathOf(path, 'projectionRevision')),
        measure: value.measure
    };
};
const normalizeRequest = (value)=>{
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        throwSpatialInvalidInput('');
    }
    assertExactKeys(value, REQUEST_KEYS, '');
    requireSchemaVersion(value.schemaVersion, 'schemaVersion');
    return {
        schemaVersion: SPATIAL_MANIPULATION_SCHEMA_VERSION,
        frame: normalizeMotionFrameV1(value.frame, 'frame'),
        requestedOffsetM: normalizeUvM(value.requestedOffsetM, 'requestedOffsetM'),
        currentAppliedOffsetM: normalizeUvM(value.currentAppliedOffsetM, 'currentAppliedOffsetM'),
        allowedAxes: normalizeAxisList(value.allowedAxes, 'allowedAxes'),
        snapshot: normalizeSnapGeometrySnapshotV1(value.snapshot, 'snapshot'),
        activeLatch: normalizeSnapLatchV1(value.activeLatch, 'activeLatch'),
        thresholds: normalizeThresholds(value.thresholds, 'thresholds'),
        motionPreview: normalizeMotionPreview(value.motionPreview, 'motionPreview'),
        metric: normalizeMetric(value.metric, 'metric')
    };
};
const assertSnapshotMatchesFrame = (request)=>{
    if (request.snapshot.frameId !== request.frame.frameId) {
        throwSpatialStale(SPATIAL_MANIPULATION_ERROR_CODE.STALE_FRAME, 'snapshot.frameId');
    }
    if (request.snapshot.frameRevision !== request.frame.frameRevision) {
        throwSpatialStale(SPATIAL_MANIPULATION_ERROR_CODE.STALE_FRAME, 'snapshot.frameRevision');
    }
};
const proposedFromCandidates = (candidates, requestedOffsetM)=>{
    const proposed = {
        ...requestedOffsetM
    };
    for (const candidate of candidates){
        for (const axis of candidate.controlledAxes){
            proposed[axis] = requestedOffsetM[axis] + candidate.correctionM[axis];
        }
    }
    return proposed;
};
const sameNumberM = (left, right)=>{
    const scale = Math.max(Math.abs(left), Math.abs(right), 1);
    return Math.abs(left - right) <= Number.EPSILON * 16 * scale;
};
const resolveCandidateOffsetM = (request, candidates)=>{
    const semanticOffsetM = proposedFromCandidates(candidates, request.requestedOffsetM);
    const semanticAxes = Array.from(new Set(candidates.flatMap((candidate)=>candidate.controlledAxes)));
    const griddedOffsetM = resolveDragGridOffsetM({
        rawOffsetM: request.motionPreview.rawOffsetM,
        priorAppliedRequestM: semanticOffsetM,
        currentOffsetM: request.currentAppliedOffsetM,
        grid: request.motionPreview.grid,
        allowedAxes: request.allowedAxes,
        semanticSnappedAxes: semanticAxes
    });
    return clampOffsetToBoundsM(griddedOffsetM, request.motionPreview.boundsM).offsetM;
};
const previewSatisfiesCorrections = (request, candidates, previewOffsetM)=>{
    for (const candidate of candidates){
        for (const axis of candidate.controlledAxes){
            if (!sameNumberM(previewOffsetM[axis], request.requestedOffsetM[axis] + candidate.correctionM[axis])) {
                return false;
            }
        }
    }
    return true;
};
const sourceSpanAtPreview = (request, previewOffsetM)=>{
    const deltaU = previewOffsetM.u - request.snapshot.referenceOffsetM.u;
    return {
        min: request.snapshot.movingBoundsM.min.u + deltaU,
        max: request.snapshot.movingBoundsM.max.u + deltaU
    };
};
const positiveOverlap = (left, right, epsilonM)=>{
    const overlap = Math.min(left.max, right.max) - Math.max(left.min, right.min);
    return overlap > epsilonM;
};
const abutsWithoutOverlap = (left, right, epsilonM)=>{
    const overlap = Math.min(left.max, right.max) - Math.max(left.min, right.min);
    if (overlap > epsilonM) return false;
    const gap = Math.max(right.min - left.max, left.min - right.max, 0);
    return gap <= epsilonM;
};
const candidateEligibleAtPreview = (request, candidate, previewOffsetM)=>{
    if (candidate.eligibility.kind === 'none') return true;
    if (!candidate.targetSpanUM) return false;
    const sourceSpan = sourceSpanAtPreview(request, previewOffsetM);
    if (candidate.eligibility.kind === 'positive-u-overlap') {
        return positiveOverlap(sourceSpan, candidate.targetSpanUM, candidate.eligibility.epsilonM);
    }
    if (candidate.eligibility.kind === 'u-abut-without-overlap') {
        return abutsWithoutOverlap(sourceSpan, candidate.targetSpanUM, candidate.eligibility.epsilonM);
    }
    return false;
};
// The candidate witness is generated at the requested offset (uncontrolled axis at the moving box
// mid-extent or the source span midpoint); a planned preview moves it by the same amount on the
// uncontrolled axes.
const witnessAtPreview = (request, candidate, previewOffsetM)=>{
    const witness = {
        ...candidate.sourceWitnessOffsetM
    };
    const controlled = new Set(candidate.controlledAxes);
    for (const axis of MOTION_AXES){
        if (!controlled.has(axis)) {
            witness[axis] += previewOffsetM[axis] - request.requestedOffsetM[axis];
        }
    }
    return witness;
};
const evaluatedAtForPreview = (request, candidates, previewOffsetM, fallback = 'requested')=>{
    const controlled = new Set(candidates.flatMap((candidate)=>candidate.controlledAxes));
    return MOTION_AXES.some((axis)=>!controlled.has(axis) && !sameNumberM(previewOffsetM[axis], request.requestedOffsetM[axis])) ? 'planned' : fallback;
};
const evaluateMetric = (request, candidate)=>{
    const previewOffsetM = resolveCandidateOffsetM(request, [
        candidate
    ]);
    // Class A (T5.2 review, 2026-09-16): accepted design divergence vs legacy. A candidate whose
    // semantic proposal the bounds/grid preview cannot reach is unavailable here (a reachable
    // alternative may then be selected); legacy kept such a pair and let the input adapter release
    // the latch after apply.
    if (!previewSatisfiesCorrections(request, [
        candidate
    ], previewOffsetM) || !candidateEligibleAtPreview(request, candidate, previewOffsetM)) {
        return null;
    }
    const sourceWitnessOffsetM = witnessAtPreview(request, candidate, previewOffsetM);
    const evaluatedAt = evaluatedAtForPreview(request, [
        candidate
    ], previewOffsetM);
    const beforeWorldM = buildFramePointM(request.frame, sourceWitnessOffsetM);
    const afterWorldM = buildFramePointM(request.frame, {
        u: sourceWitnessOffsetM.u + candidate.correctionM.u,
        v: sourceWitnessOffsetM.v + candidate.correctionM.v
    });
    const metricRequest = deepFreeze({
        schemaVersion: SPATIAL_MANIPULATION_SCHEMA_VERSION,
        source: {
            ...candidate.source
        },
        target: {
            ...candidate.target
        },
        beforeWorldM,
        afterWorldM,
        correctionM: {
            ...candidate.correctionM
        }
    });
    let value;
    try {
        value = request.metric.measure(metricRequest);
    } catch  {
        return null;
    }
    if (value === null || typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        return null;
    }
    return {
        ...candidate,
        proposedOffsetM: {
            u: request.requestedOffsetM.u + candidate.correctionM.u,
            v: request.requestedOffsetM.v + candidate.correctionM.v
        },
        previewOffsetM,
        distanceValue: value,
        evaluatedAt
    };
};
const compareStable = (left, right)=>{
    if (left.priority !== right.priority) {
        return left.priority - right.priority;
    }
    return left.pairId.localeCompare(right.pairId);
};
const compareDistanceThenStable = (left, right)=>{
    if (!sameNumberM(left.distanceValue, right.distanceValue)) {
        return left.distanceValue - right.distanceValue;
    }
    return compareStable(left, right);
};
const bestByMinTieGroup = (candidates, tieEpsilonPx)=>{
    if (candidates.length === 0) return null;
    const minDistance = Math.min(...candidates.map((candidate)=>candidate.distanceValue));
    const tieGroup = candidates.filter((candidate)=>candidate.distanceValue <= minDistance + tieEpsilonPx);
    return tieGroup.sort(compareStable)[0] ?? null;
};
const controlsOnlyAllowedAxes = (candidate, allowedAxes)=>{
    const allowed = new Set(allowedAxes);
    return candidate.controlledAxes.every((axis)=>allowed.has(axis));
};
const sameAxisCorrection = (left, right, axis)=>Math.abs(left.correctionM[axis] - right.correctionM[axis]) <= 1e-9;
const axesConflict = (left, right)=>left.controlledAxes.some((axis)=>right.controlledAxes.includes(axis));
const usesAxis = (candidate, axis)=>candidate.controlledAxes.includes(axis);
// A scalar pair is a compatible projection of a bundle pair when the bundle's rule lists the
// scalar's rule, the scalar controls one of the bundle's axes and both propose the same
// correction on that axis. The same relation defines the scalar -> bundle upgrade and the
// bundle -> constituent expansion.
const isCompatibleProjection = (scalar, bundleCandidate)=>bundleCandidate.bundle !== undefined && scalar.bundle === undefined && scalar.controlledAxes.length === 1 && bundleCandidate.controlledAxes.includes(scalar.controlledAxes[0]) && bundleCandidate.bundle.compatibleScalarRuleIds.includes(scalar.ruleId) && sameAxisCorrection(scalar, bundleCandidate, scalar.controlledAxes[0]);
const activeLatchFor = (request)=>request.activeLatch && request.activeLatch.snapshotQueryRevision === request.snapshot.queryRevision ? request.activeLatch : null;
// Phase 1 — retention: the active bundle (by bundle ID) and then the active pairs in latch order,
// each within the release threshold and not conflicting with an already retained pair.
const retainedActiveCandidates = (sorted, request, latch)=>{
    const retained = [];
    const withinRelease = (candidate)=>candidate.distanceValue <= request.thresholds.releasePx;
    if (latch.activeBundleId !== null) {
        const bundle = bestByMinTieGroup(sorted.filter((candidate)=>candidate.bundle !== undefined && candidate.bundleId === latch.activeBundleId && withinRelease(candidate)), request.thresholds.tieEpsilonPx);
        if (bundle) retained.push(bundle);
    }
    const byPairId = new Map(sorted.map((candidate)=>[
            candidate.pairId,
            candidate
        ]));
    for (const pairId of latch.activePairIds){
        const candidate = byPairId.get(pairId);
        if (!candidate || !withinRelease(candidate)) continue;
        if (retained.some((existing)=>axesConflict(existing, candidate))) continue;
        retained.push(candidate);
    }
    return retained;
};
// Eligibility of `candidate` at the preview of the whole selection it would join.
const eligibleWithSelection = (request, candidate, selection)=>{
    if (selection.some((existing)=>axesConflict(existing, candidate))) return false;
    const combined = [
        ...selection,
        candidate
    ];
    return candidateEligibleAtPreview(request, candidate, resolveCandidateOffsetM(request, combined));
};
const replaceConflicting = (selected, candidate)=>{
    const kept = selected.filter((existing)=>!axesConflict(existing, candidate));
    kept.push(candidate);
    return kept;
};
// Deterministic selection over the evaluated candidates: retention within release, one global
// challenger against the switch margin, per-axis fill, scalar -> bundle upgrade and combined
// eligibility. Tie order everywhere is distance, then lower rule priority within tieEpsilonPx,
// then stable pair ID (`bestByMinTieGroup`).
const selectCandidates = (evaluated, request)=>{
    const sorted = evaluated.slice().sort(compareDistanceThenStable);
    const { engagePx, switchMarginPx, tieEpsilonPx } = request.thresholds;
    const engaged = sorted.filter((candidate)=>candidate.distanceValue <= engagePx);
    const latch = activeLatchFor(request);
    let selected = latch ? retainedActiveCandidates(sorted, request, latch) : [];
    // Phase 2 — one global challenger: the best engaged pair by tie order, excluding the compatible
    // projections of a retained bundle that retains over its projections. It joins when it conflicts
    // with no retained pair, or when it beats the closest conflicting retained pair by the switch
    // margin (then the conflicting pairs are displaced). Other engaged pairs never displace a
    // retained pair.
    const retainedBundles = selected.filter((candidate)=>candidate.bundle !== undefined && candidate.bundle.retainOverProjection);
    const challengers = engaged.filter((candidate)=>!retainedBundles.some((bundle)=>isCompatibleProjection(candidate, bundle)));
    const challenger = bestByMinTieGroup(challengers, tieEpsilonPx);
    if (challenger && !selected.includes(challenger)) {
        const conflicting = selected.filter((candidate)=>axesConflict(candidate, challenger));
        const closest = conflicting.reduce((best, candidate)=>best === null || candidate.distanceValue < best.distanceValue ? candidate : best, null);
        if (closest === null || challenger.distanceValue <= closest.distanceValue - switchMarginPx) {
            selected = replaceConflicting(selected, challenger);
        }
    }
    // Phase 3 — per-axis fill: for each free axis (in axis order), the best engaged pair using it
    // by tie order is added when it fits the selection (no axis conflict, eligible at the combined
    // preview); otherwise the axis stays free for this sample.
    for (const axis of MOTION_AXES){
        if (selected.some((candidate)=>usesAxis(candidate, axis))) continue;
        const winner = bestByMinTieGroup(engaged.filter((candidate)=>usesAxis(candidate, axis)), tieEpsilonPx);
        if (winner && eligibleWithSelection(request, winner, selected)) {
            selected.push(winner);
        }
    }
    // Phase 4 — bundle upgrade: a selected scalar pair is replaced by the best engaged bundle pair
    // it is a compatible projection of, provided the bundle's other axes are free and the bundle is
    // eligible with the rest of the selection.
    const upgrades = [];
    for (const scalar of selected){
        if (scalar.bundle !== undefined || scalar.controlledAxes.length !== 1) continue;
        const others = selected.filter((candidate)=>candidate !== scalar);
        for (const bundle of engaged){
            if (isCompatibleProjection(scalar, bundle) && !upgrades.includes(bundle) && eligibleWithSelection(request, bundle, others)) {
                upgrades.push(bundle);
            }
        }
    }
    const upgrade = bestByMinTieGroup(upgrades, tieEpsilonPx);
    if (upgrade) {
        selected = replaceConflicting(selected, upgrade);
    }
    // Phase 5 — every selected pair must stay eligible at the preview of the whole selection.
    // The result keeps selection order (retained pairs, challenger, fills, upgrade), which is the
    // order of the active pairs, of the next latch and of the product guides derived from them.
    const previewOffsetM = resolveCandidateOffsetM(request, selected);
    return selected.filter((candidate)=>candidateEligibleAtPreview(request, candidate, previewOffsetM));
};
const expandSelectedBundles = (selected, evaluated, request)=>{
    const expanded = [];
    const consumed = new Set();
    for (const candidate of selected){
        if (!candidate.bundle) {
            expanded.push(candidate);
            consumed.add(candidate.pairId);
            continue;
        }
        const constituents = [];
        for (const axis of candidate.controlledAxes){
            const matches = evaluated.filter((scalar)=>isCompatibleProjection(scalar, candidate) && scalar.controlledAxes[0] === axis && (candidate.bundle.retainOverProjection || scalar.distanceValue <= request.thresholds.engagePx));
            const match = bestByMinTieGroup(matches, request.thresholds.tieEpsilonPx);
            if (match) {
                constituents.push({
                    ...match,
                    bundleId: candidate.bundleId
                });
            }
        }
        const complete = constituents.length === candidate.controlledAxes.length && new Set(constituents.flatMap((item)=>item.controlledAxes)).size === candidate.controlledAxes.length;
        const previewOffsetM = complete ? resolveCandidateOffsetM(request, constituents) : null;
        const previewValid = complete && previewSatisfiesCorrections(request, constituents, previewOffsetM) && constituents.every((item)=>candidateEligibleAtPreview(request, item, previewOffsetM));
        if (previewValid) {
            for (const constituent of constituents){
                if (!consumed.has(constituent.pairId)) {
                    expanded.push({
                        ...constituent,
                        previewOffsetM,
                        evaluatedAt: evaluatedAtForPreview(request, constituents, previewOffsetM, constituent.evaluatedAt)
                    });
                    consumed.add(constituent.pairId);
                }
            }
        } else {
            expanded.push(candidate);
            consumed.add(candidate.pairId);
        }
    }
    // Selection order is kept; a bundle expands in place to its constituents in bundle axis order.
    return expanded;
};
const resolvedPair = (candidate, request, selection)=>{
    const pair = {
        pairId: candidate.pairId,
        ruleId: candidate.ruleId,
        source: {
            ...candidate.source
        },
        target: {
            ...candidate.target
        },
        controlledAxes: candidate.controlledAxes.slice(),
        selection,
        proposedCorrectionM: {
            ...candidate.correctionM
        },
        distance: {
            value: candidate.distanceValue,
            unit: 'css-px',
            metricId: request.metric.metricId,
            evaluatedAt: candidate.evaluatedAt
        }
    };
    if (candidate.bundleId !== undefined) {
        pair.bundleId = candidate.bundleId;
    }
    return pair;
};
const RELEASE_MESSAGES = Object.freeze({
    threshold: 'Active snap latch released: no snap candidate within threshold',
    'invalid-dependency': 'Active snap latch released: snap geometry snapshot is not ready or incomplete'
});
// DiagnosticV1 record (§7 data model): `actual.reason` carries the release reason
// ('threshold' | 'invalid-dependency'); `expected.latch` names the released latch by its bundle ID
// when it was a bundle latch, otherwise by its comma-joined active pair IDs.
const releaseDiagnostic = (activeLatch, reason)=>deepFreeze({
        code: 'SPATIAL_SNAP_LATCH_RELEASED',
        message: RELEASE_MESSAGES[reason],
        expected: {
            latch: activeLatch.activeBundleId ?? activeLatch.activePairIds.join(',')
        },
        actual: {
            reason
        }
    });
const noSnapResolution = (request, diagnostics = [])=>deepFreeze({
        schemaVersion: SPATIAL_MANIPULATION_SCHEMA_VERSION,
        proposedOffsetM: {
            ...request.requestedOffsetM
        },
        correctionM: {
            u: 0,
            v: 0
        },
        snappedAxes: [],
        pairs: [],
        nextLatch: null,
        diagnostics
    });
function resolveSnapV1(input) {
    const request = normalizeRequest(input);
    assertSnapshotMatchesFrame(request);
    if (request.snapshot.readiness !== 'ready' || request.snapshot.coverage !== 'complete') {
        return noSnapResolution(request, request.activeLatch ? [
            releaseDiagnostic(request.activeLatch, 'invalid-dependency')
        ] : []);
    }
    const rawCandidates = createSnapCandidatesV1({
        snapshot: request.snapshot,
        requestedOffsetM: request.requestedOffsetM
    }).filter((candidate)=>controlsOnlyAllowedAxes(candidate, request.allowedAxes));
    const evaluated = rawCandidates.map((candidate)=>evaluateMetric(request, candidate)).filter((candidate)=>candidate !== null);
    const selected = expandSelectedBundles(selectCandidates(evaluated, request), evaluated, request);
    if (selected.length === 0) {
        return noSnapResolution(request, request.activeLatch ? [
            releaseDiagnostic(request.activeLatch, 'threshold')
        ] : []);
    }
    const selectedIds = new Set(selected.map((candidate)=>candidate.pairId));
    const selectedAxes = new Set();
    const proposedOffsetM = {
        ...request.requestedOffsetM
    };
    const correctionM = {
        u: 0,
        v: 0
    };
    for (const candidate of selected){
        for (const axis of candidate.controlledAxes){
            selectedAxes.add(axis);
            proposedOffsetM[axis] = candidate.proposedOffsetM[axis];
            correctionM[axis] = candidate.correctionM[axis];
        }
    }
    const activePairs = selected.map((candidate)=>resolvedPair(candidate, request, 'active'));
    const activeBundle = selected.find((candidate)=>candidate.bundleId !== undefined)?.bundleId ?? null;
    const activeBundleIds = new Set(activeBundle === null ? [] : [
        activeBundle
    ]);
    const candidatePairs = evaluated.filter((candidate)=>!selectedIds.has(candidate.pairId) && !activeBundleIds.has(candidate.bundleId) && candidate.distanceValue <= request.thresholds.engagePx).sort(compareDistanceThenStable).map((candidate)=>resolvedPair(candidate, request, 'candidate'));
    return deepFreeze({
        schemaVersion: SPATIAL_MANIPULATION_SCHEMA_VERSION,
        proposedOffsetM,
        correctionM,
        snappedAxes: MOTION_AXES.filter((axis)=>selectedAxes.has(axis)),
        pairs: [
            ...activePairs,
            ...candidatePairs
        ],
        nextLatch: createNextSnapLatchV1({
            snapshotQueryRevision: request.snapshot.queryRevision,
            activePairIds: activePairs.map((pair)=>pair.pairId),
            activeBundleId: activeBundle
        }),
        diagnostics: []
    });
}

export { resolveSnapV1 };
