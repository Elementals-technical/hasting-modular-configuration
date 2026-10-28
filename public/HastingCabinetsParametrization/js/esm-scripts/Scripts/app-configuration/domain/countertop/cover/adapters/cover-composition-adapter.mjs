import { measureEntityBoundsM } from '../../../spatial-manipulation/playcanvas/scene-measure.mjs';
import { ProductRegistry_V2 } from '../../../product/registry/product-registry-v2.mjs';
import { isCabinetCoverProduct, resolveBasinTopProduct, isTandemCountertopProduct } from '../../countertop-role.mjs';
import { planCabinetCovers } from '../cover-policy.mjs';
import { createUlHSupportDescriptor } from './cover-support-adapter.mjs';
import { isLineOnlyType, isCoverSource } from '../../countertop-collections.mjs';

const VERSION = 1;
const PROFILE_ID = 'ulh-v1';
const GENERATED_BY = 'cabinet-cover-v1';
const SETTING_KEYS = Object.freeze([
    // materialId is accepted only for persisted v1/backward compatibility.
    // Runtime cover material is always derived from each source CabinetColor.
    'enabled',
    'profileId',
    'eligibilityMode',
    'materialId',
    'thicknessM',
    'tolerances'
]);
const WATCH_PARAMS = Object.freeze([
    'Width',
    'Height',
    'Depth',
    'CabinetRole',
    'CountertopRole',
    'productType',
    'CabinetColor',
    'SpatialOffsetM',
    'CountertopLengthM',
    'Thickness',
    'thicknessM',
    'generatedBy',
    'CountertopPositioning',
    'CountertopPlacement',
    'SupportGroupId',
    'sinkType',
    'SidePanel'
]);
const read = (snapshot, key)=>typeof snapshot?.get === 'function' ? snapshot.get(key) : snapshot?.[key];
const entriesOf = (products)=>products instanceof Map ? [
        ...products.entries()
    ] : Object.entries(products ?? {});
const clone = (value)=>value === undefined ? undefined : structuredClone(value);
const finite = (value)=>typeof value === 'number' && Number.isFinite(value);
const nonempty = (value)=>typeof value === 'string' && value.trim().length > 0;
function cancelled(compositionId, revision) {
    return {
        status: 'cancelled',
        compositionId,
        revision,
        diagnostics: []
    };
}
function diagnosticPlan(compositionId, revision, status, diagnostics) {
    return {
        version: VERSION,
        compositionId,
        revision,
        status,
        segments: [],
        diagnostics: diagnostics.map((item)=>({
                ...item,
                sourceIds: [
                    ...item.sourceIds ?? []
                ]
            }))
    };
}
function validateSettings(settings) {
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
        throw new TypeError('Cabinet cover settings must be an object');
    }
    const unknown = Object.keys(settings).filter((key)=>!SETTING_KEYS.includes(key));
    if (unknown.length) throw new TypeError(`Unknown cabinet cover setting: ${unknown[0]}`);
    if (typeof settings.enabled !== 'boolean') {
        throw new TypeError('Cabinet cover enabled must be boolean');
    }
    if (!settings.enabled) return;
    if (!nonempty(settings.profileId)) throw new TypeError('Cabinet cover profileId is required');
    if (![
        'all',
        'sc-with-adjacent-open'
    ].includes(settings.eligibilityMode)) {
        throw new TypeError('Cabinet cover eligibilityMode is invalid');
    }
    if (!finite(settings.thicknessM) || settings.thicknessM <= 0) {
        throw new TypeError('Cabinet cover thicknessM must be positive');
    }
    if (!settings.tolerances || typeof settings.tolerances !== 'object' || Array.isArray(settings.tolerances)) {
        throw new TypeError('Cabinet cover tolerances are required');
    }
    for (const key of [
        'contactM',
        'adjacencyM',
        'numericalM'
    ]){
        if (!finite(settings.tolerances[key]) || settings.tolerances[key] < 0) {
            throw new TypeError(`Cabinet cover tolerances.${key} must be nonnegative`);
        }
    }
}
function normalizeBounds(value) {
    const min = value?.minM ?? value?.min;
    const max = value?.maxM ?? value?.max;
    if (!min || !max || ![
        'x',
        'y',
        'z'
    ].every((axis)=>finite(min[axis]) && finite(max[axis]) && max[axis] > min[axis])) {
        return null;
    }
    return {
        min,
        max
    };
}
function unrotated(entity) {
    let data;
    try {
        data = entity?.getWorldTransform?.()?.data;
    } catch  {
        return false;
    }
    if (!data || data.length !== 16 || !Array.from(data).every(finite)) return false;
    const diagonal = [
        data[0],
        data[5],
        data[10]
    ];
    if (diagonal.some((value)=>value <= 1e-6)) return false;
    const scale = Math.max(1, ...diagonal.map(Math.abs));
    const zero = (value)=>Math.abs(value) <= 1e-6 * scale;
    return [
        1,
        2,
        3,
        4,
        6,
        7,
        8,
        9,
        11
    ].every((index)=>zero(data[index])) && Math.abs(data[15] - 1) <= 1e-6;
}
function collectNamed(root, name) {
    const matches = [];
    const stack = root ? [
        root
    ] : [];
    const seen = new Set();
    while(stack.length){
        const node = stack.pop();
        if (!node || seen.has(node)) continue;
        seen.add(node);
        if (node.name === name) matches.push(node);
        for (const child of node.children ?? [])stack.push(child);
    }
    return matches;
}
function contextualSnapshot(snapshot, eligibilityMode, adjacentRoles) {
    return {
        get (key) {
            if (key === 'eligibilityMode') return eligibilityMode;
            if (key === 'adjacentRoles') return adjacentRoles;
            return read(snapshot, key);
        }
    };
}
function adjacentRolesFor(productId, snapshots, order) {
    const ordered = entriesOf(snapshots).filter(([, snapshot])=>read(snapshot, 'category') === 'cabinets').sort(([left], [right])=>{
        const leftOrder = Number(order?.[left]);
        const rightOrder = Number(order?.[right]);
        if (Number.isFinite(leftOrder) && Number.isFinite(rightOrder) && leftOrder !== rightOrder) {
            return leftOrder - rightOrder;
        }
        return String(left).localeCompare(String(right));
    });
    const index = ordered.findIndex(([id])=>id === productId);
    if (index < 0) return [];
    return [
        ordered[index - 1],
        ordered[index + 1]
    ].filter(Boolean).map(([, snapshot])=>read(snapshot, 'CabinetRole')).filter((role)=>typeof role === 'string' && role.length > 0);
}
const ADJACENT_LEVEL_TOLERANCE_M = 0.005;
const withinTolerance = (a, b, tolerance)=>{
    const distance = Math.abs(a - b);
    if (!Number.isFinite(distance)) return false;
    return distance <= tolerance + 8 * Number.EPSILON * Math.max(1, distance, tolerance);
};
const hasSupportBounds = (support)=>support && [
        'xMinM',
        'xMaxM',
        'yTopM',
        'zMinM',
        'zMaxM'
    ].every((key)=>finite(support[key]));
/**
 * Physical neighbours from measured world AABBs: same level (yTop within 5 mm),
 * overlapping depth plane, and an X gap within `adjacencyM`. Returns `null`
 * when the product has no measured bounds so callers keep the order fallback.
 */ function physicalAdjacentRolesFor(productId, snapshots, boundsById, adjacencyM) {
    const self = boundsById.get(productId);
    if (!hasSupportBounds(self) || !finite(adjacencyM) || adjacencyM < 0) return null;
    let left = null;
    let right = null;
    for (const [otherId, other] of boundsById){
        if (otherId === productId || !hasSupportBounds(other)) continue;
        if (!withinTolerance(other.yTopM, self.yTopM, ADJACENT_LEVEL_TOLERANCE_M)) continue;
        if (Math.min(other.zMaxM, self.zMaxM) <= Math.max(other.zMinM, self.zMinM)) continue;
        const otherCenter = (other.xMinM + other.xMaxM) / 2;
        const selfCenter = (self.xMinM + self.xMaxM) / 2;
        if (otherCenter < selfCenter) {
            const gap = Math.abs(self.xMinM - other.xMaxM);
            if (withinTolerance(self.xMinM, other.xMaxM, adjacencyM) && (!left || gap < left.gap)) {
                left = {
                    id: otherId,
                    gap
                };
            }
        } else if (otherCenter > selfCenter) {
            const gap = Math.abs(other.xMinM - self.xMaxM);
            if (withinTolerance(other.xMinM, self.xMaxM, adjacencyM) && (!right || gap < right.gap)) {
                right = {
                    id: otherId,
                    gap
                };
            }
        }
    }
    return [
        left,
        right
    ].filter(Boolean).map(({ id })=>read(snapshots?.[id] ?? snapshots?.get?.(id), 'CabinetRole')).filter((role)=>typeof role === 'string' && role.length > 0);
}
const sameRoles = (a, b)=>a.length === b.length && a.every((role, index)=>role === b[index]);
function normalizeMeasuredBasinEndpoints(basinTops, supports, tolerances) {
    const numericalM = tolerances?.numericalM;
    const contactM = tolerances?.contactM;
    if (!finite(numericalM) || numericalM < 0 || !finite(contactM) || contactM < 0) {
        return {
            basinTops,
            diagnostics: [],
            errors: []
        };
    }
    const diagnostics = [];
    const errors = [];
    const normalized = basinTops.map((basin)=>{
        const candidates = supports.filter((support)=>Math.abs(support.yTopM - basin.yBottomM) <= contactM && (basin.zMinM <= support.zMinM || Math.abs(basin.zMinM - support.zMinM) <= numericalM) && (basin.zMaxM >= support.zMaxM || Math.abs(basin.zMaxM - support.zMaxM) <= numericalM)).flatMap((support)=>[
                {
                    coordinate: support.xMinM,
                    supportId: support.supportId
                },
                {
                    coordinate: support.xMaxM,
                    supportId: support.supportId
                }
            ]);
        const next = {
            ...basin
        };
        const selected = [];
        for (const endpoint of [
            {
                field: 'xMinM',
                label: 'min'
            },
            {
                field: 'xMaxM',
                label: 'max'
            }
        ]){
            const raw = basin[endpoint.field];
            const nearest = candidates.map((candidate)=>({
                    ...candidate,
                    delta: Math.abs(raw - candidate.coordinate)
                })).filter((candidate)=>candidate.delta <= numericalM).sort((left, right)=>left.delta - right.delta || left.coordinate - right.coordinate || String(left.supportId).localeCompare(String(right.supportId)))[0];
            if (!nearest || nearest.coordinate === raw) continue;
            next[endpoint.field] = nearest.coordinate;
            selected.push(nearest.supportId);
            diagnostics.push({
                code: 'measurement-endpoint-normalized',
                sourceIds: [
                    basin.productId,
                    nearest.supportId
                ].sort(),
                details: {
                    productId: basin.productId,
                    supportId: nearest.supportId,
                    axis: 'x',
                    endpoint: endpoint.label,
                    raw,
                    normalized: nearest.coordinate,
                    delta: nearest.delta,
                    tolerance: numericalM
                }
            });
        }
        if (!(next.xMaxM > next.xMinM)) {
            errors.push({
                code: 'measurement-resolution-insufficient',
                sourceIds: [
                    ...new Set([
                        basin.productId,
                        ...selected
                    ])
                ].sort(),
                details: {
                    productId: basin.productId,
                    rawMinM: basin.xMinM,
                    rawMaxM: basin.xMaxM,
                    normalizedMinM: next.xMinM,
                    normalizedMaxM: next.xMaxM,
                    tolerance: numericalM
                }
            });
        }
        return next;
    });
    return {
        basinTops: normalized,
        diagnostics,
        errors
    };
}
/**
 * Coalesces cabinet-cover reconciliation around the countertop's geometry-only barrier.
 * It intentionally never calls countertop.whenSettled(), aggregator.whenIdle(), or spatial refresh.
 */ function createCoverCompositionAdapter({ app, getComposition, getActiveCompositionId, countertopAdapter, service, plan = planCabinetCovers, createSupport = createUlHSupportDescriptor, measure = measureEntityBoundsM, measureBasin = measure, allowFreeLayout = ()=>false, // composition -> settings while none are saved, or null (countertop-collections.mjs: enabledByDefault).
defaultSettingsFor = ()=>null, watchCompositions = [
    'cabinets'
] } = {}) {
    if (!app?.root?.findByName || typeof getComposition !== 'function' || typeof getActiveCompositionId !== 'function' || typeof countertopAdapter?.whenGeometrySettled !== 'function' || typeof allowFreeLayout !== 'function' || typeof defaultSettingsFor !== 'function' || !service || [
        'request',
        'supersede',
        'getState',
        'whenSettled',
        'reset',
        'destroy'
    ].some((method)=>typeof service[method] !== 'function')) {
        throw new TypeError('Cabinet cover composition adapter dependencies are incomplete');
    }
    const settingsByComposition = new Map();
    const revisions = new Map();
    const inFlight = new Set();
    const resettingCompositions = new Set();
    const suspendedCompositions = new Set();
    const producerGenerations = new Map();
    const producerOperations = new Map();
    let requestToken = 0;
    let destroyed = false;
    let failedResetCompositionId = null;
    const assertNotSuspended = (compositionId)=>{
        if (suspendedCompositions.has(compositionId)) {
            throw Object.assign(new Error('Legacy cover reconciliation is suspended'), {
                code: 'ULH_LEGACY_WRITE_UNSUPPORTED'
            });
        }
    };
    const producerGeneration = (compositionId)=>producerGenerations.get(compositionId) ?? 0;
    const invalidateProducer = (compositionId)=>{
        const generation = producerGeneration(compositionId) + 1;
        producerGenerations.set(compositionId, generation);
        return generation;
    };
    const producerIsCurrent = (compositionId, generation, token)=>!destroyed && token === requestToken && generation === producerGeneration(compositionId) && !resettingCompositions.has(compositionId);
    const trackProducer = (compositionId, operation)=>{
        let operations = producerOperations.get(compositionId);
        if (!operations) producerOperations.set(compositionId, operations = new Set());
        operations.add(operation);
        operation.then(()=>{
            operations.delete(operation);
            if (!operations.size) producerOperations.delete(compositionId);
        }, ()=>{
            operations.delete(operation);
            if (!operations.size) producerOperations.delete(compositionId);
        });
        return operation;
    };
    const successfulReset = (result)=>[
            'applied',
            'unchanged'
        ].includes(result?.status);
    const settingsFor = (compositionId)=>{
        if (settingsByComposition.has(compositionId)) return settingsByComposition.get(compositionId);
        const composition = getComposition(compositionId);
        const saved = composition?.getCabinetCoverSettings?.() ?? null;
        if (saved !== null) settingsByComposition.set(compositionId, clone(saved));
        if (saved !== null) return saved;
        // Defaults are not cached: they follow the composition's cabinets (a UF line -> covers on).
        return defaultSettingsFor(composition) ?? null;
    };
    const saveSettings = (compositionId, settings)=>{
        getComposition(compositionId)?.assertMutable?.();
        const saved = clone(settings);
        settingsByComposition.set(compositionId, saved);
        getComposition(compositionId)?.setCabinetCoverSettings?.(saved);
    };
    const nextRevision = (compositionId)=>{
        const revision = (revisions.get(compositionId) ?? -1) + 1;
        revisions.set(compositionId, revision);
        return revision;
    };
    const rootOf = (productId)=>app.root.findByName(productId) ?? null;
    function disabledPlan(compositionId, revision) {
        return plan({
            version: VERSION,
            compositionId,
            revision,
            frame: 'world',
            units: 'm',
            profileId: settingsFor(compositionId)?.profileId ?? PROFILE_ID,
            settings: {
                enabled: false
            },
            tolerances: {},
            supports: [],
            basinTops: []
        });
    }
    function buildPlan(compositionId, revision) {
        const settings = settingsFor(compositionId) ?? {
            enabled: false
        };
        if (!settings.enabled) return disabledPlan(compositionId, revision);
        const freeLayoutAllowed = allowFreeLayout() === true;
        if (settings.profileId !== PROFILE_ID) {
            return diagnosticPlan(compositionId, revision, 'unsupported', [
                {
                    code: 'unsupported-cover-profile',
                    sourceIds: [],
                    details: {
                        profileId: settings.profileId
                    }
                }
            ]);
        }
        const composition = getComposition(compositionId);
        if (!composition || composition.compositionId !== compositionId) {
            return diagnosticPlan(compositionId, revision, 'unsupported', [
                {
                    code: 'missing-cover-composition',
                    sourceIds: [
                        compositionId
                    ]
                }
            ]);
        }
        const products = composition.getAllProducts?.() ?? {};
        const entries = entriesOf(products);
        const cabinets = entries.filter(([, snapshot])=>read(snapshot, 'category') === 'cabinets' && read(snapshot, 'generatedBy') !== GENERATED_BY);
        if (!cabinets.length) {
            return plan({
                version: VERSION,
                compositionId,
                revision,
                frame: 'world',
                units: 'm',
                profileId: settings.profileId,
                settings,
                tolerances: settings.tolerances,
                supports: [],
                basinTops: []
            });
        }
        const diagnostics = [];
        const supports = [];
        const order = composition.getOrderProductIds?.() ?? {};
        const firstPass = [];
        for (const [productId, snapshot] of cabinets){
            const productType = read(snapshot, 'productType');
            // A line cabinet without covers (UF open shelf): not a support, not an error.
            if (isLineOnlyType(productType)) continue;
            if (!isCoverSource(productType, {
                freeLayout: freeLayoutAllowed
            })) {
                diagnostics.push({
                    code: 'unsupported-cover-profile-source',
                    sourceIds: [
                        productId
                    ],
                    details: {
                        profileId: settings.profileId,
                        productType: productType ?? null
                    }
                });
                continue;
            }
            const supportFor = (adjacentRoles)=>createSupport({
                    productId,
                    snapshot: contextualSnapshot(snapshot, settings.eligibilityMode, adjacentRoles),
                    root: rootOf(productId),
                    measure,
                    registry: ProductRegistry_V2.instance
                });
            const orderRoles = adjacentRolesFor(productId, products, order);
            firstPass.push({
                productId,
                supportFor,
                orderRoles,
                result: supportFor(orderRoles)
            });
        }
        // Neighbours must be physically adjacent (same level, X gap within
        // adjacencyM); the flat composition order alone would join cabinets
        // across a hole or across rows. Without measured bounds keep the order.
        const boundsById = new Map(firstPass.filter(({ result })=>result?.status === 'supported' && hasSupportBounds(result.support)).map(({ productId, result })=>[
                productId,
                result.support
            ]));
        for (const entry of firstPass){
            let { result } = entry;
            const physicalRoles = physicalAdjacentRolesFor(entry.productId, products, boundsById, settings.tolerances?.adjacencyM);
            if (physicalRoles && !sameRoles(physicalRoles, entry.orderRoles)) {
                result = entry.supportFor(physicalRoles);
            }
            if (result?.status === 'supported' && result.support) supports.push(result.support);
            else diagnostics.push(...result?.diagnostics ?? [
                {
                    code: 'invalid-ulh-source',
                    sourceIds: [
                        entry.productId
                    ]
                }
            ]);
        }
        const basinTops = [];
        const resolution = resolveBasinTopProduct(products);
        if (resolution.status !== 'found') {
            const hasUnresolvedTop = entries.some(([, snapshot])=>read(snapshot, 'category') === 'countertops' && !isCabinetCoverProduct(snapshot));
            if (!(freeLayoutAllowed && resolution.status === 'missing' && !hasUnresolvedTop)) {
                diagnostics.push({
                    code: resolution.status === 'ambiguous' ? 'ambiguous-basin-top' : 'missing-basin-top',
                    sourceIds: [
                        ...resolution.candidateIds
                    ],
                    // Which tops compete (27.10, P210 follow-up): role, type, group, length, a hosted sink, a scene root.
                    details: {
                        candidates: resolution.candidateIds.map((id)=>{
                            const snapshot = products instanceof Map ? products.get(id) : products?.[id];
                            return {
                                id,
                                productType: read(snapshot, 'productType') ?? null,
                                role: read(snapshot, 'CountertopRole') ?? null,
                                generatedBy: read(snapshot, 'generatedBy') ?? null,
                                group: read(snapshot, 'SupportGroupId') ?? null,
                                lengthM: read(snapshot, 'CountertopLengthM') ?? null,
                                hostedSink: read(snapshot, 'CountertopSinkType') ?? null,
                                inScene: !!rootOf(id)
                            };
                        })
                    }
                });
            }
        } else {
            // The basin top, then the tandem tops (clones of a thin basin top on sink bases set apart, Ryan 23.10):
            // a cabinet under any of them gets no cover.
            const tandemIds = entries.filter(([, snapshot])=>isTandemCountertopProduct(snapshot)).map(([productId])=>productId);
            for (const productId of [
                resolution.productId,
                ...tandemIds
            ]){
                const root = rootOf(productId);
                const meshes = collectNamed(root, 'TopSolid');
                const mesh = meshes.length === 1 ? meshes[0] : null;
                let bounds = null;
                try {
                    bounds = mesh && unrotated(root) && unrotated(mesh) ? normalizeBounds(measureBasin(mesh)) : null;
                } catch  {
                    bounds = null;
                }
                if (!root || !mesh || !bounds) {
                    diagnostics.push({
                        code: !root || !mesh ? 'missing-basin-top-geometry' : 'unsupported-basin-top-geometry',
                        sourceIds: [
                            productId
                        ]
                    });
                } else {
                    basinTops.push({
                        productId,
                        xMinM: bounds.min.x,
                        xMaxM: bounds.max.x,
                        yBottomM: bounds.min.y,
                        zMinM: bounds.min.z,
                        zMaxM: bounds.max.z
                    });
                }
            }
        }
        if (diagnostics.length) {
            return diagnosticPlan(compositionId, revision, 'unsupported', diagnostics);
        }
        const normalized = normalizeMeasuredBasinEndpoints(basinTops, supports, settings.tolerances);
        if (normalized.errors.length) {
            return diagnosticPlan(compositionId, revision, 'unsupported', normalized.errors);
        }
        const result = plan({
            version: VERSION,
            compositionId,
            revision,
            frame: 'world',
            units: 'm',
            profileId: settings.profileId,
            settings,
            tolerances: settings.tolerances,
            supports,
            basinTops: normalized.basinTops
        });
        return result.status === 'ready' && normalized.diagnostics.length ? {
            ...result,
            diagnostics: [
                ...result.diagnostics,
                ...normalized.diagnostics
            ]
        } : result;
    }
    async function beginRevision(compositionId, revision, settings, token, generation) {
        const state = service.getState();
        if (failedResetCompositionId !== null || state.compositionId !== null && state.compositionId !== compositionId) {
            const resetOwner = state.compositionId ?? failedResetCompositionId;
            let resetResult;
            try {
                resetResult = await service.reset();
            } catch (error) {
                failedResetCompositionId = resetOwner;
                throw error;
            }
            if (!successfulReset(resetResult)) {
                failedResetCompositionId = resetOwner;
                return resetResult;
            }
            failedResetCompositionId = null;
        }
        if (!producerIsCurrent(compositionId, generation, token)) {
            return cancelled(compositionId, revision);
        }
        if (!settings.enabled) return service.request(disabledPlan(compositionId, revision));
        // Reserve the source revision immediately. This cancels stale material preparation while
        // retaining the last valid publication, and keeps service.whenSettled waiting for the
        // real post-barrier plan at this same revision.
        if (service.supersede({
            compositionId,
            revision
        })) {
            return {
                status: 'reserved',
                compositionId,
                revision,
                diagnostics: []
            };
        }
        return {
            status: 'invalid',
            compositionId,
            revision,
            diagnostics: [
                {
                    code: 'cover-revision-reservation-rejected',
                    sourceIds: []
                }
            ]
        };
    }
    async function runRequest(token, generation, compositionId, revision, initialResult) {
        const settings = settingsFor(compositionId) ?? {
            enabled: false
        };
        const invalidated = await initialResult;
        if (!settings.enabled || invalidated?.status !== 'reserved') return invalidated;
        if (!producerIsCurrent(compositionId, generation, token)) return cancelled(compositionId, revision);
        try {
            const geometryResult = await countertopAdapter.whenGeometrySettled();
            if (geometryResult?.status === 'error' || geometryResult?.status === 'cancelled') {
                return service.request(diagnosticPlan(compositionId, revision, 'unsupported', [
                    {
                        code: 'cover-geometry-barrier-failed',
                        sourceIds: [],
                        details: {
                            status: geometryResult.status,
                            reason: geometryResult.reason ?? geometryResult.code ?? null
                        }
                    }
                ]));
            }
        } catch (error) {
            if (!producerIsCurrent(compositionId, generation, token)) return cancelled(compositionId, revision);
            return service.request(diagnosticPlan(compositionId, revision, 'unsupported', [
                {
                    code: 'cover-geometry-barrier-failed',
                    sourceIds: [],
                    details: {
                        message: String(error?.message ?? error)
                    }
                }
            ]));
        }
        if (!producerIsCurrent(compositionId, generation, token)) return cancelled(compositionId, revision);
        let nextPlan;
        try {
            // Read both snapshots and roots only after the geometry barrier.
            nextPlan = buildPlan(compositionId, revision);
        } catch (error) {
            nextPlan = diagnosticPlan(compositionId, revision, 'unsupported', [
                {
                    code: 'cover-input-extraction-failed',
                    sourceIds: [],
                    details: {
                        message: String(error?.message ?? error)
                    }
                }
            ]);
        }
        return service.request(nextPlan);
    }
    function createReservation(compositionId) {
        if (destroyed || !nonempty(compositionId)) {
            return {
                immediate: Promise.resolve(cancelled(compositionId ?? null, null))
            };
        }
        assertNotSuspended(compositionId);
        getComposition(compositionId)?.assertMutable?.();
        if (resettingCompositions.has(compositionId)) {
            return {
                immediate: Promise.resolve({
                    ...cancelled(compositionId, null),
                    diagnostics: [
                        {
                            code: 'cover-composition-teardown-in-progress',
                            sourceIds: [
                                compositionId
                            ]
                        }
                    ]
                })
            };
        }
        if (compositionId !== getActiveCompositionId()) {
            return {
                immediate: Promise.resolve({
                    status: 'invalid',
                    compositionId,
                    revision: null,
                    diagnostics: [
                        {
                            code: 'inactive-cover-composition',
                            sourceIds: [
                                compositionId
                            ],
                            details: {
                                activeCompositionId: getActiveCompositionId() ?? null
                            }
                        }
                    ]
                })
            };
        }
        const token = ++requestToken;
        const generation = producerGeneration(compositionId);
        const revision = nextRevision(compositionId);
        const settings = settingsFor(compositionId) ?? {
            enabled: false
        };
        const initialResult = beginRevision(compositionId, revision, settings, token, generation);
        // Acceptance is synchronous up to service.supersede(). Keep a rejection observer even when
        // a newer accepted source replaces this reservation before aggregation reaches applyFn.
        initialResult.catch(()=>{});
        return {
            compositionId,
            token,
            generation,
            revision,
            initialResult
        };
    }
    function runReservation(reservation) {
        if (reservation.immediate) return reservation.immediate;
        const { compositionId, token, generation, revision, initialResult } = reservation;
        const operation = runRequest(token, generation, compositionId, revision, initialResult);
        inFlight.add(operation);
        operation.then(()=>inFlight.delete(operation), ()=>inFlight.delete(operation));
        return trackProducer(compositionId, operation);
    }
    function acceptSourceChange({ compositionId = getActiveCompositionId() } = {}) {
        const reservation = createReservation(compositionId);
        return reservation;
    }
    function requestReconcile({ compositionId = getActiveCompositionId(), reason = 'source-changed' } = {}) {
        assertNotSuspended(compositionId);
        return runReservation(createReservation(compositionId));
    }
    function suspendForComposition(compositionId) {
        if (destroyed || suspendedCompositions.has(compositionId) || inFlight.size || (producerOperations.get(compositionId)?.size ?? 0)) {
            throw Object.assign(new Error('Legacy cover writer is active or unavailable'), {
                code: 'LEGACY_WRITERS_BUSY'
            });
        }
        suspendedCompositions.add(compositionId);
        let resumed = false;
        return ()=>{
            if (resumed) return;
            resumed = true;
            suspendedCompositions.delete(compositionId);
        };
    }
    async function whenSettled() {
        while(inFlight.size)await Promise.allSettled([
            ...inFlight
        ]);
        const result = await service.whenSettled();
        if (inFlight.size) return whenSettled();
        return result;
    }
    async function configure(patch, { compositionId = getActiveCompositionId(), reconcile = true } = {}) {
        if (!nonempty(compositionId)) throw new TypeError('Cabinet cover compositionId is required');
        assertNotSuspended(compositionId);
        getComposition(compositionId)?.assertMutable?.();
        if (resettingCompositions.has(compositionId)) {
            throw Object.assign(new Error(`Cabinet cover composition "${compositionId}" is being torn down`), {
                code: 'COMPOSITION_TEARDOWN_IN_PROGRESS',
                compositionId
            });
        }
        if (reconcile && compositionId !== getActiveCompositionId()) {
            throw new TypeError('Activate the composition before reconciling its cabinet covers');
        }
        if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
            throw new TypeError('Cabinet cover configuration patch must be an object');
        }
        const current = settingsFor(compositionId) ?? {};
        const merged = {
            ...current,
            ...clone(patch),
            ...patch.tolerances === undefined ? {} : {
                tolerances: {
                    ...current.tolerances ?? {},
                    ...clone(patch.tolerances)
                }
            }
        };
        validateSettings(merged);
        saveSettings(compositionId, merged);
        if (!reconcile) return getState(compositionId);
        return requestReconcile({
            compositionId,
            reason: 'settings-changed'
        });
    }
    function getState(compositionId = getActiveCompositionId()) {
        const serviceState = service.getState();
        const composition = getComposition(compositionId);
        if (suspendedCompositions.has(compositionId) && composition?.hasMutationGuard?.()) {
            const entries = entriesOf(composition.getAllProducts?.()).filter(([, snapshot])=>isCabinetCoverProduct(snapshot)).map(([productId, snapshot])=>({
                    productId,
                    segment: clone(read(snapshot, 'coverSegment'))
                }));
            const revision = composition.getCabinetDocument?.()?.revision ?? null;
            return Object.freeze({
                compositionId: compositionId ?? null,
                activeCompositionId: getActiveCompositionId() ?? null,
                settings: clone(composition.getCabinetCoverSettings?.() ?? null),
                service: {
                    ...serviceState,
                    compositionId,
                    phase: 'modular-owned',
                    stale: false,
                    requestedRevision: revision,
                    appliedRevision: revision,
                    entries
                },
                serviceOwnsRequestedComposition: false
            });
        }
        return Object.freeze({
            compositionId: compositionId ?? null,
            activeCompositionId: getActiveCompositionId() ?? null,
            settings: clone(settingsFor(compositionId) ?? null),
            service: serviceState,
            serviceOwnsRequestedComposition: serviceState.compositionId === (compositionId ?? null)
        });
    }
    function activateComposition(compositionId) {
        if (!nonempty(compositionId) || destroyed) {
            return Promise.resolve(cancelled(compositionId ?? null, null));
        }
        assertNotSuspended(compositionId);
        getComposition(compositionId)?.assertMutable?.();
        if (resettingCompositions.has(compositionId)) {
            return Promise.resolve(cancelled(compositionId, null));
        }
        const token = ++requestToken;
        const generation = producerGeneration(compositionId);
        const operation = (async ()=>{
            const state = service.getState();
            if (state.compositionId !== null && state.compositionId !== compositionId) {
                let resetResult;
                try {
                    resetResult = await service.reset();
                } catch (error) {
                    failedResetCompositionId = state.compositionId;
                    throw error;
                }
                if (!successfulReset(resetResult)) {
                    failedResetCompositionId = state.compositionId;
                    return resetResult;
                }
                failedResetCompositionId = null;
            }
            if (!producerIsCurrent(compositionId, generation, token)) {
                return cancelled(compositionId, null);
            }
            return requestReconcile({
                compositionId,
                reason: 'active-composition-changed'
            });
        })();
        return trackProducer(compositionId, operation);
    }
    async function resetForComposition(compositionId, reason = 'composition-reset') {
        if (!nonempty(compositionId)) return cancelled(compositionId ?? null, null);
        assertNotSuspended(compositionId);
        getComposition(compositionId)?.assertMutable?.();
        const serviceCompositionId = service.getState().compositionId;
        const ownsFailedCleanup = failedResetCompositionId === compositionId && serviceCompositionId === null;
        const pendingProducers = [
            ...producerOperations.get(compositionId) ?? []
        ];
        if (serviceCompositionId !== compositionId && !ownsFailedCleanup && !pendingProducers.length) {
            settingsByComposition.delete(compositionId);
            getComposition(compositionId)?.setCabinetCoverSettings?.(null);
            revisions.delete(compositionId);
            return {
                status: 'unchanged',
                compositionId,
                revision: null,
                diagnostics: []
            };
        }
        invalidateProducer(compositionId);
        resettingCompositions.add(compositionId);
        try {
            let result = {
                status: 'unchanged',
                compositionId,
                revision: null,
                diagnostics: []
            };
            if (serviceCompositionId === compositionId || ownsFailedCleanup) {
                try {
                    result = await service.reset();
                } catch (error) {
                    failedResetCompositionId = compositionId;
                    await Promise.allSettled(pendingProducers);
                    throw error;
                }
            }
            await Promise.allSettled(pendingProducers);
            if (!successfulReset(result)) {
                failedResetCompositionId = compositionId;
            } else {
                if (failedResetCompositionId === compositionId) failedResetCompositionId = null;
                settingsByComposition.delete(compositionId);
                getComposition(compositionId)?.setCabinetCoverSettings?.(null);
                revisions.delete(compositionId);
            }
            return result;
        } finally{
            resettingCompositions.delete(compositionId);
        }
    }
    async function destroy() {
        if (destroyed) return service.whenSettled();
        destroyed = true;
        requestToken++;
        settingsByComposition.clear();
        revisions.clear();
        resettingCompositions.clear();
        producerGenerations.clear();
        producerOperations.clear();
        const result = await service.destroy();
        if (result?.status !== 'error') failedResetCompositionId = null;
        return result;
    }
    async function resetRuntime(reason = 'cover-runtime-reset') {
        if (destroyed) return cancelled(null, null);
        if (suspendedCompositions.size) assertNotSuspended(suspendedCompositions.values().next().value);
        for (const id of new Set([
            getActiveCompositionId(),
            service.getState().compositionId,
            ...settingsByComposition.keys(),
            ...producerOperations.keys()
        ])){
            if (id) getComposition(id)?.assertMutable?.();
        }
        requestToken++;
        revisions.clear();
        settingsByComposition.clear();
        resettingCompositions.clear();
        producerGenerations.clear();
        producerOperations.clear();
        const result = await service.reset();
        if (result?.status !== 'error') failedResetCompositionId = null;
        return result;
    }
    function toAggregationHandler() {
        return {
            watchCompositions: [
                ...watchCompositions
            ],
            watchParams: [
                ...WATCH_PARAMS
            ],
            acceptFn: (context)=>acceptSourceChange({
                    compositionId: context.compositionId ?? getActiveCompositionId()
                }),
            aggregateFn: (_collections, context = {})=>({
                    compositionId: context.compositionId ?? getActiveCompositionId()
                }),
            applyFn: (input, context = {})=>context.accepted ? runReservation(context.accepted) : requestReconcile({
                    compositionId: input?.compositionId ?? context.compositionId ?? getActiveCompositionId(),
                    reason: 'aggregation-without-reservation'
                })
        };
    }
    return Object.freeze({
        configure,
        getState,
        acceptSourceChange,
        requestReconcile,
        whenSettled,
        suspendForComposition,
        activateComposition,
        resetForComposition,
        resetRuntime,
        destroy,
        toAggregationHandler
    });
}

export { createCoverCompositionAdapter };
