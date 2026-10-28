import { cloneData, canonicalKey, isRecord, isFiniteVec3, reason } from '../cabinet-contracts.mjs';
import { operationError } from '../../composition/operations/composition-operation-coordinator.mjs';
import { planCabinetCoverFootprints } from '../../countertop/cover/cover-policy.mjs';
import { resolveULHSidePanelPlan, ULH_SIDE_PANEL_PRODUCTS } from '../../product/logic/ulh-side-panel-policy.mjs';

const id = (value)=>typeof value === 'string' && value.trim().length > 0;
const unique = (values)=>[
        ...new Set(values)
    ].sort();
const statusOf = (checks)=>[
        'invalid',
        'unsupported',
        'pending'
    ].find((s)=>checks.some((c)=>c.status === s)) ?? 'ready';
const obstacleOwned = (obstacle, compositionId)=>obstacle.compositionId === compositionId && (obstacle.kind === 'cabinet-cover' && obstacle.generatedBy === 'cabinet-cover-v1' || obstacle.kind === 'side-panel' && obstacle.generatedBy === 'ulh-derived-panels-v1');
function blocked(status, code) {
    return {
        status,
        reasons: [
            reason(code)
        ],
        requiredDecisionIds: [],
        groupIds: [],
        covers: {
            status,
            segments: []
        },
        panels: {
            status,
            items: []
        },
        collision: {
            status,
            basis: 'prospective',
            replacesProductIds: [],
            retainedObstacles: [],
            prospectiveCovers: [],
            prospectivePanels: []
        }
    };
}
/** Consume a COMPLETE measured prospective composition (including unchanged groups).
 * Positions, exposure and group membership are facts from the trusted scene adapter,
 * not UI assertions. Profile approvals are injected product-owner decisions, never Apply tokens.
 * This plans only: no store writes, cover service request, allocations, or global top lookup.
 */ function planDerivedParts(rawInput, profile = {}) {
    let input;
    try {
        input = cloneData(rawInput);
    } catch  {
        return blocked('invalid', 'INVALID_DERIVED_INPUT');
    }
    if (!isRecord(input) || input.basis !== 'prospective' || !id(input.compositionId) || !Number.isSafeInteger(input.revision) || input.revision < 0 || ![
        'cabinets',
        'supports',
        'basinTops',
        'panelFaces',
        'obstacles'
    ].every((k)=>Array.isArray(input[k])) || !isRecord(input.associatedBasinTopIds) || typeof input.panelSelection?.enabled !== 'boolean') {
        return blocked('invalid', 'INVALID_DERIVED_INPUT');
    }
    if (input.status !== 'ready') return blocked(input.status === 'unsupported' ? 'unsupported' : 'pending', 'DERIVED_GEOMETRY_NOT_READY');
    const checks = [], coverChecks = [], panelChecks = [];
    const add = (target, status, code, decisionIds = [], sourceIds = [])=>{
        const entry = {
            status,
            reason: {
                ...reason(code, decisionIds),
                affectedProductIds: unique(sourceIds)
            }
        };
        target.push(entry);
        if (target !== checks) checks.push(entry);
    };
    const cabinets = new Map();
    for (const cabinet of input.cabinets){
        if (!isRecord(cabinet) || !id(cabinet.id) || !id(cabinet.groupId) || cabinets.has(cabinet.id) || ![
            'standard',
            'remote'
        ].includes(cabinet.placementMode) || ![
            'seed',
            'attached',
            'separate',
            'stacked'
        ].includes(cabinet.classification)) {
            return blocked('invalid', 'INVALID_DERIVED_CABINET');
        }
        cabinets.set(cabinet.id, cabinet);
        if (![
            'SB',
            'SC',
            'OS'
        ].includes(cabinet.roleId)) add(coverChecks, 'unsupported', 'ROLE_UNSUPPORTED', [
            'Q-OSS'
        ], [
            cabinet.id
        ]);
        if (cabinet.roleId === 'OS' && !(cabinet.placementMode === 'remote' && cabinet.classification === 'separate')) {
            add(coverChecks, 'unsupported', 'ATTACHED_OS_COVER_UNRESOLVED', [
                'Q-COVER-ADJACENCY'
            ], [
                cabinet.id
            ]);
        }
    }
    const groupIds = unique([
        ...cabinets.values()
    ].map((c)=>c.groupId));
    const basinIds = new Set(input.basinTops.map((b)=>b?.productId));
    if (basinIds.size !== input.basinTops.length || ![
        ...basinIds
    ].every(id) || Object.keys(input.associatedBasinTopIds).some((group)=>!groupIds.includes(group))) return blocked('invalid', 'INVALID_BASIN_ASSOCIATION');
    for (const group of groupIds){
        if (!Object.hasOwn(input.associatedBasinTopIds, group)) {
            add(checks, 'unsupported', 'DEPTH_ASSOCIATION_UNRESOLVED', [
                'Q-DEPTH'
            ]);
        } else if (input.associatedBasinTopIds[group] !== null && !basinIds.has(input.associatedBasinTopIds[group])) {
            add(checks, 'invalid', 'INVALID_BASIN_ASSOCIATION');
        }
    }
    const supportsByCabinet = new Map(), supportIds = new Set();
    for (const support of input.supports){
        if (!isRecord(support) || !cabinets.has(support.cabinetId) || !id(support.supportId) || supportIds.has(support.supportId)) {
            return blocked('invalid', 'INVALID_DERIVED_SUPPORT');
        }
        supportIds.add(support.supportId);
        if (!supportsByCabinet.has(support.cabinetId)) supportsByCabinet.set(support.cabinetId, []);
        supportsByCabinet.get(support.cabinetId).push(support);
    }
    const obstacleIds = new Set();
    for (const obstacle of input.obstacles){
        if (!isRecord(obstacle) || !id(obstacle.id) || obstacleIds.has(obstacle.id)) return blocked('invalid', 'INVALID_DERIVED_OBSTACLE');
        obstacleIds.add(obstacle.id);
    }
    const segments = [];
    for (const groupId of groupIds){
        const supports = [];
        for (const cabinet of cabinets.values()){
            if (cabinet.groupId !== groupId) continue;
            // U3: separate Remote OS is exempt, irrespective of legacy 'all' mode.
            if (cabinet.roleId === 'OS' && cabinet.placementMode === 'remote' && cabinet.classification === 'separate') continue;
            if (![
                'SC',
                'SB'
            ].includes(cabinet.roleId)) continue;
            const measured = supportsByCabinet.get(cabinet.id);
            if (!measured?.length) add(coverChecks, 'pending', 'SUPPORT_NOT_READY', [], [
                cabinet.id
            ]);
            else supports.push(...measured.map((s)=>({
                    ...s,
                    eligibility: 'direct'
                })));
        }
        if (!supports.length) continue;
        if (!profile.cover?.tolerances) {
            add(coverChecks, 'unsupported', 'COVER_TOLERANCES_UNRESOLVED', [
                'Q-CONTACT'
            ]);
            continue;
        }
        const footprints = planCabinetCoverFootprints({
            version: 1,
            compositionId: input.compositionId,
            revision: input.revision,
            frame: 'world',
            units: 'm',
            profileId: 'ulh-v1',
            settings: {
                enabled: true
            },
            tolerances: profile.cover.tolerances,
            supports,
            // Coverage uses ALL supplied tops and actual contact, not the associated depth-rule top alone.
            basinTops: input.basinTops
        });
        if (footprints.status !== 'ready') {
            for (const diagnostic of footprints.diagnostics)add(coverChecks, footprints.status, 'COVER_' + diagnostic.code.toUpperCase().replaceAll('-', '_'), [], diagnostic.sourceIds);
            continue;
        }
        if (!footprints.segments.length) continue;
        const approvals = profile.cover.approvedDecisionIds ?? [];
        const missing = [
            'PG-02',
            'PG-03',
            'PG-04'
        ].filter((gate)=>!approvals.includes(gate));
        if (!Number.isFinite(profile.cover.thicknessM) || profile.cover.thicknessM <= 0) missing.push('PG-02');
        if (missing.length) {
            add(coverChecks, 'unsupported', 'COVER_PROFILE_UNRESOLVED', unique(missing));
            continue;
        }
        for (const segment of footprints.segments)segments.push({
            ...segment,
            groupId,
            planKey: JSON.stringify([
                groupId,
                segment.planKey
            ]),
            thicknessM: profile.cover.thicknessM
        });
    }
    const panelItems = [], faces = new Map();
    if (input.panelSelection.enabled) {
        if (![
            'NoG',
            'UpperG'
        ].includes(input.panelSelection.requestedType)) add(panelChecks, 'invalid', 'INVALID_PANEL_SELECTION');
        for (const face of input.panelFaces){
            if (!isRecord(face) || !cabinets.has(face.cabinetId) || ![
                'left',
                'right'
            ].includes(face.side)) {
                add(panelChecks, 'invalid', 'INVALID_PANEL_FACE');
                continue;
            }
            const key = JSON.stringify([
                face.cabinetId,
                face.side
            ]);
            if (faces.has(key)) add(panelChecks, 'invalid', 'DUPLICATE_PANEL_FACE');
            faces.set(key, face);
        }
        for (const cabinet of cabinets.values())for (const side of [
            'left',
            'right'
        ]){
            const face = faces.get(JSON.stringify([
                cabinet.id,
                side
            ]));
            if (!face || ![
                'exposed',
                'covered',
                'partial'
            ].includes(face.exposure)) {
                add(panelChecks, 'pending', 'PANEL_EXPOSURE_NOT_READY', [], [
                    cabinet.id
                ]);
                continue;
            }
            if (face.exposure === 'partial' || !profile.panels?.exposureRuleIds?.includes(face.ruleId)) {
                add(panelChecks, 'unsupported', 'PANEL_EXPOSURE_UNRESOLVED', [
                    'Q-PANEL'
                ], [
                    cabinet.id
                ]);
                continue;
            }
            if (face.exposure === 'covered' || face.compatible === false) continue;
            if (face.compatible !== true || !profile.panels.assetReady) {
                add(panelChecks, 'unsupported', 'PANEL_PROFILE_UNRESOLVED', [
                    'Q-PANEL'
                ], [
                    cabinet.id
                ]);
                continue;
            }
            if (!isFiniteVec3(face.positionM) || !id(face.materialId)) {
                add(panelChecks, 'pending', 'PANEL_GEOMETRY_NOT_READY', [], [
                    cabinet.id
                ]);
                continue;
            }
            const geometryPlan = resolveULHSidePanelPlan({
                side,
                handle: face.handle,
                requestedType: input.panelSelection.requestedType,
                height: face.height,
                depth: face.depth
            });
            if (geometryPlan.status !== 'resolved') {
                add(panelChecks, 'unsupported', 'PANEL_GEOMETRY_UNRESOLVED', [
                    'Q-PANEL'
                ], [
                    cabinet.id
                ]);
                continue;
            }
            panelItems.push({
                planKey: JSON.stringify([
                    cabinet.id,
                    side
                ]),
                cabinetId: cabinet.id,
                groupId: cabinet.groupId,
                side,
                productType: ULH_SIDE_PANEL_PRODUCTS[side],
                positionM: face.positionM,
                materialId: face.materialId,
                geometryPlan
            });
        }
    }
    segments.sort((a, b)=>a.planKey.localeCompare(b.planKey));
    panelItems.sort((a, b)=>a.planKey.localeCompare(b.planKey));
    const status = statusOf(checks), coversStatus = statusOf(coverChecks);
    const panelsStatus = input.panelSelection.enabled ? statusOf(panelChecks) : 'not-applicable';
    const replaced = status === 'ready' ? input.obstacles.filter((o)=>obstacleOwned(o, input.compositionId)).map((o)=>o.id) : [];
    const result = {
        status,
        reasons: checks.map((c)=>c.reason),
        requiredDecisionIds: unique(checks.flatMap((c)=>c.reason.decisionIds)),
        groupIds,
        associatedBasinTopIds: input.associatedBasinTopIds,
        covers: {
            status: coversStatus,
            segments: coversStatus === 'ready' ? segments : []
        },
        panels: {
            status: panelsStatus,
            items: panelsStatus === 'ready' ? panelItems : []
        },
        collision: {
            status,
            basis: 'prospective',
            replacesProductIds: unique(replaced),
            retainedObstacles: input.obstacles.filter((o)=>!replaced.includes(o.id)),
            prospectiveCovers: status === 'ready' ? segments : [],
            prospectivePanels: status === 'ready' ? panelItems : []
        }
    };
    return cloneData(result);
}
/** Geometry barrier only: never call aggregator.whenIdle(), full countertop.whenSettled()
 * or cover reconciliation from here (those can wait back on this operation).
 * measureProspective owns staging, must clean its temporary resources before resolving/rejecting.
 */ function createDerivedPlanAdapter({ profile = {}, readDependencies, whenGeometrySettled, measureProspective }) {
    if ([
        readDependencies,
        whenGeometrySettled,
        measureProspective
    ].some((port)=>typeof port !== 'function')) {
        throw new TypeError('Explicit dependency, geometry-only barrier and prospective measurement ports required');
    }
    const pack = cloneData(profile);
    return Object.freeze({
        async evaluate (candidate, { signal } = {}) {
            const checkCancelled = ()=>{
                if (signal?.aborted) throw operationError('CANCELLED');
            };
            checkCancelled();
            const request = cloneData(candidate), dependencies = cloneData(readDependencies());
            const barrier = await whenGeometrySettled({
                signal
            });
            checkCancelled();
            if ([
                'error',
                'cancelled'
            ].includes(barrier?.status)) return blocked('pending', 'GEOMETRY_BARRIER_NOT_READY');
            if (canonicalKey(readDependencies()) !== canonicalKey(dependencies)) return blocked('pending', 'STALE_DEPENDENCIES');
            const input = await measureProspective(request, {
                signal,
                dependencies: cloneData(dependencies)
            });
            checkCancelled();
            if (canonicalKey(readDependencies()) !== canonicalKey(dependencies) || input?.revision !== dependencies.compositionRevision) {
                return blocked('pending', 'STALE_DEPENDENCIES');
            }
            return {
                ...planDerivedParts(input, pack),
                validatedDependencies: dependencies
            };
        }
    });
}

export { createDerivedPlanAdapter, planDerivedParts };
