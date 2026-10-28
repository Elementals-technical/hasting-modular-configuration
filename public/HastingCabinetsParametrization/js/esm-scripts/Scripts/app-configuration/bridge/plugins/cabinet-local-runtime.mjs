import { createCabinetFacades } from './cabinets.plugin.mjs';
import { captureExactPreset, instantiateExactPreset } from '../../domain/cabinet-placement/portable-preset.mjs';
import { compactFromExactPreset } from '../../domain/cabinet-placement/compact-preset.mjs';
import { PRESET_LEVELS } from '../../domain/presets/preset-formats.mjs';
import { DEFAULT_PRESET_FORMATS } from '../../domain/presets/default-preset-formats.mjs';
import { createPortableBasinTopAdapter } from '../../domain/cabinet-placement/portable-basin-top.mjs';
import { reason, cloneData, isFiniteVec3, canonicalKey } from '../../domain/cabinet-placement/cabinet-contracts.mjs';
import { createSCLineSpatialProfile } from '../../domain/cabinet-placement/engineering/sc-line-spatial-profile.mjs';
import { MODULAR_COLLECTIONS, collectionDescriptor, typeWithRoleBeside, classifyCompositionProducts, classifyCabinetTypes, usesColumns, findModularCollection } from '../../domain/cabinet-placement/modular-collections.mjs';
import { CABINET_COLUMNS_POLICY_ID, boxFromPivot, cabinetsOfRow, layoutColumnRow } from '../../domain/cabinet-placement/columns/cabinet-columns.mjs';
import { reconcileColumnRows, columnRowsToLayouts, columnSupportGroups, columnRowOrder, toStoredColumnRow, placeColumnDrop, dropFloorM, columnSizes } from '../../domain/cabinet-placement/adapters/cabinet-columns-layout.mjs';
import { pruneRows, extentFromBox } from '../../domain/cabinet-placement/cabinet-rows.mjs';
import { CABINET_ROWS_FEATURE, rowsToLayouts, layoutsToRows, assignSupportGroups, sinkCabinetDetector, rowOrder, planCabinetDrop, reconcileRows } from '../../domain/cabinet-placement/adapters/cabinet-rows-layout.mjs';
import { normalizeLegacyData } from '../../domain/composition/operations/legacy-scene-checkpoint.mjs';
import { relativeBox, boxAt, detectDraftCollision, DRAFT_COLLISION_REASON } from '../../domain/cabinet-placement/draft-collision.mjs';
import { ROOM_FLOOR_NAME, FLOOR_COLLIDER_ID, roomController, measureFloorColliderBox } from '../../domain/scene/room/room-offset.mjs';
import { planPlacementSlots, pickDefaultSlot } from '../../domain/cabinet-placement/placement-slots.mjs';
import { withLevel, cabinetLevelM } from '../../domain/cabinet-placement/cabinet-footprint.mjs';
import { COUNTERTOP_PLACEMENT, resolveCountertopPositioningProfile } from '../../domain/countertop/countertop-support-resolver.mjs';
import { isTandemCountertopProduct } from '../../domain/countertop/countertop-role.mjs';
import { createPlacementValidator } from '../../domain/cabinet-placement/kernel/placement-validator.mjs';
import { draftPlacementFacts } from '../../domain/cabinet-placement/adapters/draft-placement-facts.mjs';
import { draftCountertop, countertopSharedWithOtherSinkBase, createCountertopCarry } from '../../domain/cabinet-placement/adapters/countertop-carry.mjs';
import { pickLevelRows, createCountertopSplitPreview } from '../../domain/cabinet-placement/adapters/countertop-split-preview.mjs';
import { createCutoutMarkers, cutterFootprint } from '../../domain/cabinet-placement/adapters/countertop-cutout-markers.mjs';
import { reconcileTandemCountertops, isThinCountertop, snapSinkBaseToThickTop } from '../../domain/countertop/tandem/tandem-countertops.mjs';
import { snapDraftIntoColumn } from '../../domain/cabinet-placement/columns/column-snap.mjs';
import { toRelative } from '../../domain/cabinet-placement/columns/connect-points.mjs';
import { measureConnectPointsM } from '../../domain/cabinet-placement/adapters/connect-points-adapter.mjs';
import { COUNTERTOP_SINK_TYPE_KEY, COUNTERTOP_SINK_LOCAL_KEY, isHostedSinkConfig } from '../../domain/countertop/countertop-hosted-sink.mjs';
import { sinkBaseShiftUnderHostedSink, SINK_BASE_ALIGN_TOLERANCE_M } from '../../domain/countertop/trap/trap-keepout.mjs';

const fail = (code)=>Object.assign(new Error(code), {
        code
    });
const frame = {
    id: 'wall',
    originM: {
        x: 0,
        y: 0,
        z: 0
    },
    xAxis: {
        x: 1,
        y: 0,
        z: 0
    },
    yAxis: {
        x: 0,
        y: 1,
        z: 0
    },
    zAxis: {
        x: 0,
        y: 0,
        z: 1
    }
};
// Dependency versions while no modular collection owns the composition (empty or legacy).
const unassigned = {
    catalogVersion: 'modular-collections-v1',
    policyVersion: 'unassigned'
};
// Fingerprint placeholder while an owner still sees legacy content (never equal to a canonicalKey).
const LEGACY_CONTENT = Symbol('legacy-content');
const impact = ()=>({
        added: [],
        updatedProductIds: [],
        removedProductIds: [],
        derivedChanges: [],
        requiresAcknowledgement: false,
        token: null
    });
// Collections without a placement pack still expose distinct reasons, just like the kernel rules.
const collisionReasons = (ids, countertopId)=>[
        [
            DRAFT_COLLISION_REASON,
            ids.filter((id)=>id !== countertopId)
        ],
        [
            'COUNTERTOP_COLLISION',
            ids.filter((id)=>id === countertopId)
        ]
    ].filter(([, hits])=>hits.length).map(([code, hits])=>({
            ...reason(code, [], {
                collidesWith: hits
            }),
            affectedProductIds: hits
        }));
/**
 * Keys that make a product a countertop (the Top_Solid / Cabinet_Cover config): never a cabinet's. A cabinet carrying
 * them is taken for a top — 27.10: a new SB came from the UI with CountertopRole 'basinTop' and CountertopSinkType, the
 * cover planner counted it as a second basin top and the Apply was refused (CABINET_COVER_RESTORE_FAILED
 * 'ambiguous-basin-top'). Cabinet selections drop them on the way in (draft), out (commit) and when read from the scene.
 */ const COUNTERTOP_ONLY_KEYS = Object.freeze([
    'CountertopRole',
    COUNTERTOP_SINK_TYPE_KEY,
    COUNTERTOP_SINK_LOCAL_KEY,
    'CountertopLengthM',
    'CountertopSinkShiftM',
    'CountertopPlacement',
    'CountertopPositioning',
    'TandemSinkBaseId',
    'generatedBy'
]);
const withoutCountertopKeys = (config)=>{
    const result = {
        ...config ?? {}
    };
    for (const key of COUNTERTOP_ONLY_KEYS)delete result[key];
    return result;
};
const cleanConfig = (config)=>{
    const result = cloneData(config);
    for (const key of [
        'entityName',
        'productId',
        'positionX',
        'positionY',
        'positionZ'
    ])delete result[key];
    return result;
};
/**
 * Sink base (SB) and side cabinet (SC) types of the collection that owns `productType`
 * (roles from the collection's pack, modular-collections.mjs). A sink move swaps SB <-> SC inside one collection.
 *   'ULH-side-cabinet' -> { sinkBase: 'ULH-sink-cabinet', sideCabinet: 'ULH-side-cabinet' }
 * null when the type belongs to no modular collection.
 */ const sinkPairOf = (productType)=>{
    const sinkBase = typeWithRoleBeside(productType, 'SB');
    const sideCabinet = typeWithRoleBeside(productType, 'SC');
    return sinkBase && sideCabinet ? {
        sinkBase,
        sideCabinet
    } : null;
};
/** Sink keys (data-driven): sinkType, VesselColor and every SB default key the SC does not have. */ const sinkKeysOf = (getProductConfig, pair)=>{
    const sbDefaults = getProductConfig(pair.sinkBase)?.defaultConfig ?? {};
    const scDefaults = getProductConfig(pair.sideCabinet)?.defaultConfig ?? {};
    return new Set([
        'sinkType',
        'VesselColor',
        ...Object.keys(sbDefaults).filter((key)=>!Object.hasOwn(scDefaults, key))
    ]);
};
/** The countertop primary source (covers and other sources are not). */ const isCountertopSource = (source)=>{
    const config = source.payload?.config;
    // A tandem top is derived from the basin top on every commit (reconcileTandemCountertops), never edited itself.
    return !!config && config.CountertopRole !== 'cabinetCover' && !isTandemCountertopProduct(config) && [
        'CountertopRole',
        'CountertopLengthM',
        'CountertopSinkShiftM'
    ].some((key)=>key in config);
};
/**
 * Preset import: the cabinets the basin top stood on keep its SupportGroupId. The export drops every cabinet's group (the
 * rows re-derive it for the new row ids) and the rows then find the top's row by its sink base — a top that hosts its sink
 * has none under it, so it fell to the first row (in a stack: onto the lower cabinet). The top's cabinetReferences (the
 * preset's cabinetKeys) name those cabinets: they take the top's group, the other cabinets leave it; the rows then
 * re-derive every group as before (assignSupportGroups). In place; a document without one referencing top is left as is.
 */ const seedBasinTopGroups = (document)=>{
    const tops = document.primarySources.filter(isCountertopSource);
    if (tops.length !== 1) return document;
    const [top] = tops, references = new Set(top.cabinetReferences ?? []);
    if (!document.cabinets.some((c)=>references.has(c.id))) return document;
    const group = top.payload.config.SupportGroupId ?? 'group-1';
    for (const c of document.cabinets){
        if (references.has(c.id)) c.selection = {
            ...c.selection,
            SupportGroupId: group
        };
        else if ((c.selection.SupportGroupId ?? 'group-1') === group) c.selection = {
            ...c.selection,
            SupportGroupId: `${group}~off-top`
        };
    }
    return document;
};
/** Renames cabinet ids (in place) in connections, rows and the primary sources' cabinetReferences. */ const renameCabinetIds = (document, idMap)=>{
    const rename = (id)=>idMap[id] ?? id;
    document.connections = document.connections.map((edge)=>({
            ...edge,
            a: {
                ...edge.a,
                cabinetId: rename(edge.a.cabinetId)
            },
            b: {
                ...edge.b,
                cabinetId: rename(edge.b.cabinetId)
            }
        }));
    document.localLayouts = document.localLayouts.map((layout)=>({
            ...layout,
            orderedCabinetIds: layout.orderedCabinetIds.map(rename)
        }));
    for (const source of document.primarySources)source.cabinetReferences = (source.cabinetReferences ?? []).map(rename);
};
/** Lowers a countertop source (in place): SpatialOffsetM.y = 0, CountertopSinkShiftM removed.
 * positionM = base + SpatialOffsetM (documentOf): lowering drops the lift from both, so the base stays put. */ const lowerCountertop = (source)=>{
    const config = source.payload.config, liftM = Number(config.SpatialOffsetM?.y) || 0;
    if (config.SpatialOffsetM) config.SpatialOffsetM = {
        ...config.SpatialOffsetM,
        y: 0
    };
    if (source.payload.positionM && liftM) source.payload.positionM = {
        ...source.payload.positionM,
        y: source.payload.positionM.y - liftM
    };
    delete config.CountertopSinkShiftM;
};
/** The one countertop source matching `accept`, preferring those that reference `cabinetId`; else INVALID_INPUT. */ const pickCountertop = (document, cabinetId, accept = ()=>true)=>{
    const tops = document.primarySources.filter((source)=>isCountertopSource(source) && accept(source.payload.config));
    const referencing = tops.filter((source)=>(source.cabinetReferences ?? []).includes(cabinetId));
    const picked = referencing.length ? referencing : tops;
    if (picked.length !== 1) throw fail('INVALID_INPUT');
    return picked[0];
};
const LIFTED_M = 0.01;
/** moveSink (HR-CT-01): SB <-> SC type swap WITH new ids (ids carry the type prefix), sink keys moved to the
 * new host, ids renamed in connections/rows/countertop references, countertop lowered (SpatialOffsetM.y = 0,
 * CountertopSinkShiftM removed). Pure; rule validation (HR-PL-05 ...) stays with the pack.
 * -> { document, idMap, sinkHostId } | throws UNKNOWN_CABINET / NOT_SINK_BASE / ALREADY_SINK_BASE / NOT_SIDE_CABINET / INVALID_INPUT */ function moveSinkDocument(doc, fromId, toId, { getProductConfig, uuid }) {
    const from = doc.cabinets.find((c)=>c.id === fromId), to = doc.cabinets.find((c)=>c.id === toId);
    if (!from || !to) throw fail('UNKNOWN_CABINET');
    // SB and SC of the sink cabinet's collection: the sink moves only within one collection.
    const pair = sinkPairOf(from.definitionId);
    if (!pair || from.definitionId !== pair.sinkBase) throw fail('NOT_SINK_BASE');
    if (to.definitionId !== pair.sideCabinet) throw fail(to.definitionId === pair.sinkBase ? 'ALREADY_SINK_BASE' : 'NOT_SIDE_CABINET');
    if (from.frameId !== to.frameId) throw fail('INVALID_INPUT');
    const sinkKeys = sinkKeysOf(getProductConfig, pair);
    const newFrom = `${pair.sideCabinet}-${uuid()}`, newTo = `${pair.sinkBase}-${uuid()}`, idMap = {
        [fromId]: newFrom,
        [toId]: newTo
    };
    const next = cloneData(doc);
    const fromSelection = Object.fromEntries(Object.entries(from.selection).filter(([key])=>!sinkKeys.has(key)));
    const moved = Object.fromEntries(Object.entries(from.selection).filter(([key])=>sinkKeys.has(key)));
    next.cabinets = next.cabinets.map((c)=>c.id === fromId ? {
            ...c,
            id: newFrom,
            definitionId: pair.sideCabinet,
            selection: cloneData(fromSelection)
        } : c.id === toId ? {
            ...c,
            id: newTo,
            definitionId: pair.sinkBase,
            selection: {
                ...c.selection,
                ...cloneData(moved)
            }
        } : c);
    renameCabinetIds(next, idMap);
    // The countertop only (covers and other sources keep their pose).
    for (const source of next.primarySources)if (isCountertopSource(source)) lowerCountertop(source);
    return {
        document: next,
        idMap,
        sinkHostId: newTo
    };
}
/** liftSink (HR-CT-02): the lifted top takes the sink off its SB. SB -> SC under a NEW id with the sink keys removed;
 * the top hosts the sink: CountertopSinkType = SB sinkType, VesselColor = SB VesselColor (if set),
 * CountertopSinkLocalM = sinkLocalM (+ the top's Thickness at lift), CountertopSinkShiftM removed; its pose stays. Pure.
 * -> { document, idMap, sideCabinetId } | throws UNKNOWN_CABINET / NOT_SINK_BASE / INVALID_INPUT */ function liftSinkDocument(doc, fromId, sinkLocalM, { getProductConfig, uuid }) {
    const from = doc.cabinets.find((c)=>c.id === fromId);
    if (!from) throw fail('UNKNOWN_CABINET');
    const pair = sinkPairOf(from.definitionId);
    if (!pair || from.definitionId !== pair.sinkBase) throw fail('NOT_SINK_BASE');
    if (!isFiniteVec3(sinkLocalM)) throw fail('INVALID_INPUT');
    const top = pickCountertop(doc, fromId);
    if (!((Number(top.payload.config.SpatialOffsetM?.y) || 0) > LIFTED_M) || isHostedSinkConfig(top.payload.config)) throw fail('INVALID_INPUT');
    const sinkType = from.selection.sinkType ?? getProductConfig(pair.sinkBase)?.defaultConfig?.sinkType;
    if (typeof sinkType !== 'string' || !sinkType) throw fail('INVALID_INPUT');
    const sinkKeys = sinkKeysOf(getProductConfig, pair), sideCabinetId = `${pair.sideCabinet}-${uuid()}`, idMap = {
        [fromId]: sideCabinetId
    };
    const next = cloneData(doc);
    next.cabinets = next.cabinets.map((c)=>c.id === fromId ? {
            ...c,
            id: sideCabinetId,
            definitionId: pair.sideCabinet,
            selection: Object.fromEntries(Object.entries(c.selection).filter(([key])=>!sinkKeys.has(key)))
        } : c);
    const config = next.primarySources.find((source)=>source.id === top.id).payload.config;
    config[COUNTERTOP_SINK_TYPE_KEY] = sinkType;
    if (from.selection.VesselColor !== undefined) config.VesselColor = cloneData(from.selection.VesselColor);
    // `thickness`: the Thickness the local Y was captured at (RuleCountertopSinkPointPosition re-derives Y from it).
    const thickness = Number(config.Thickness);
    config[COUNTERTOP_SINK_LOCAL_KEY] = {
        x: sinkLocalM.x,
        y: sinkLocalM.y,
        z: sinkLocalM.z,
        ...Number.isFinite(thickness) ? {
            thickness
        } : {}
    };
    delete config.CountertopSinkShiftM;
    renameCabinetIds(next, idMap);
    return {
        document: next,
        idMap,
        sideCabinetId
    };
}
/** landSink (HR-CT-02): the sink the top hosts lands in a cabinet — one landing for both ways it happens:
 * - an SC (the top lowered over it, the UI commits the 'fits' landing via cabinets.landSink) -> the SB under a NEW id;
 * - an SB dropped right under that sink (P210, Andriy 27.10) -> keeps its id and type; its own sink gives way
 *   (one sink, one cut-out).
 * The SB takes sinkType = the top's CountertopSinkType and VesselColor = the top's (if set; moved off the top);
 * CountertopSinkType / CountertopSinkLocalM removed; the top lowered as moveSinkDocument does. Pure.
 * -> { document, idMap, sinkHostId } | throws UNKNOWN_CABINET / NOT_SIDE_CABINET / INVALID_INPUT (no single hosting top) */ function landSinkDocument(doc, toId, { getProductConfig, uuid }) {
    const to = doc.cabinets.find((c)=>c.id === toId);
    if (!to) throw fail('UNKNOWN_CABINET');
    const pair = sinkPairOf(to.definitionId), sinkBase = !!pair && to.definitionId === pair.sinkBase;
    if (!pair || !sinkBase && to.definitionId !== pair.sideCabinet) throw fail('NOT_SIDE_CABINET');
    const top = pickCountertop(doc, toId, isHostedSinkConfig);
    const sinkHostId = sinkBase ? toId : `${pair.sinkBase}-${uuid()}`, idMap = sinkBase ? {} : {
        [toId]: sinkHostId
    };
    const next = cloneData(doc), source = next.primarySources.find((s)=>s.id === top.id), config = source.payload.config;
    const moved = {
        sinkType: config[COUNTERTOP_SINK_TYPE_KEY],
        ...config.VesselColor !== undefined ? {
            VesselColor: config.VesselColor
        } : {}
    };
    next.cabinets = next.cabinets.map((c)=>c.id === toId ? {
            ...c,
            id: sinkHostId,
            definitionId: pair.sinkBase,
            selection: {
                ...c.selection,
                ...cloneData(moved)
            }
        } : c);
    for (const key of [
        COUNTERTOP_SINK_TYPE_KEY,
        COUNTERTOP_SINK_LOCAL_KEY,
        'VesselColor'
    ])delete config[key];
    lowerCountertop(source);
    renameCabinetIds(next, idMap);
    return {
        document: next,
        idMap,
        sinkHostId
    };
}
/** Local renderer adapter for the existing public contract. Committed state remains
 * the ordinary composition; drafts are separate roots. replace() is the existing
 * asynchronous rollback-capable import boundary, never a coordinator materialize port.
 *
 * Collection-driven activation (no URL flags): the runtime OWNS the active 'cabinets'
 * composition only while it is a modular-collection composition (modular-collections.mjs):
 * every cabinet belongs to one collection, or it has no cabinets and the incoming command
 * adds/presets a modular cabinet. While it does not own it, legacy writers, layout and covers
 * behave exactly as without this runtime (compatibility.active === false, guards pass).
 * Activation: freeLayoutPolicy, preserveCabinetPositions=true, modules drag off, modular cover
 * settings, SceneManager writer guard. Deactivation restores all of them.
 * Triggers: command entry (compatibility.prepare, beginAdd, importPreset) and composition
 * changes observed on app 'update' while idle.
 *
 * FreeLayoutPolicy hook — app.compositionManager.freeLayoutPolicy while a collection owns the
 * composition (previous value restored on release). Created per activation by
 * `createLayoutPolicy ?? collection.createLayoutPolicy`, called as
 * factory({ app, collection: { id, catalogVersion, policyVersion }, compositionId, matches, getProductConfig }) -> policy | null:
 *   placeNew(entity, entities, composition, prevEntityId, side)
 *       -> Array<{ entity, position, index, isChanged, config? }> | null   (config: merged into the new snapshot)
 *   reflow(composition, reason, detail?) -> { movedIds } | null            (detail: { reason:'swap', productIds })
 *   observe?(composition?) -> Promise   (no movement: after activation, commits, legacy writes, idle changes)
 *   destroy?() -> void   (called on release)
 * A missing policy or a null/undefined result means the existing preserve-mode behaviour.
 * ULH: rows (domain/cabinet-placement/adapters/cabinet-rows-layout.mjs); drag-and-drop Apply and
 * preset import use the same rows (features.localCabinetRows <-> document.localLayouts). */ function createCabinetLocalRuntime({ app, scene, createScene, getProductConfig, listProductTypes, createInput, createOverlay = null, createLayoutPolicy = null, collections = MODULAR_COLLECTIONS, uuid = ()=>crypto.randomUUID() }) {
    const scope = {
        apiInstanceId: `cabinet-local-${uuid()}`,
        compositionId: 'cabinets'
    };
    let revision = 0, fingerprint = null, busy = false, closed = false, recovery = false, sequence = 0;
    let draft = null, input = null, inputStarted = false, starting = null, started = false;
    // Draft presentation (tint, outline, screen anchors for UI icons); optional port.
    let overlay = null, overlayStarted = false;
    // `active` is the modular collection that owns the composition (null = legacy/empty).
    let active = null, owned = null, switching = false, holds = 0, transition = Promise.resolve();
    let seen = null, wake = null;
    const sessions = new Map(), options = new Map(), journal = new Map(), listeners = new Map();
    const ready = ()=>!closed && !!app.compositionManager?.getActiveComposition?.() && app.compositionManager.getActiveComposition().compositionId === scope.compositionId;
    // Legacy product rules legitimately leave optional object fields undefined.
    // Normalize only this ingress; public commands and the portable codec stay strict.
    // A capture lays the basin top back on its standard pose (spatial beforeCapture): a top shown with a draft
    // (carried, or following a dragged SB) is shown again right after, so reading the state never undoes the preview.
    const snapshot = ()=>{
        try {
            return normalizeLegacyData(scene.capture(), 'composition');
        } finally{
            reshowDraftTop();
        }
    };
    function reshowDraftTop() {
        const record = draft;
        if (!record || record.state?.lifecycle !== 'preview') return;
        const p = record.state.candidate.effectivePlacement.positionM;
        try {
            // Only the carry: the split / join previews re-pose the top on every frame (their `reassert`).
            if (record.carry?.shown) record.carry.show(p);
        } catch  {}
    }
    const syncRevision = (releasing = false)=>{
        // Only a modular composition is this runtime's source; legacy snapshots are never fingerprinted.
        if (!scene || !ready() || busy || !active) return;
        // A top carried over a moved SB's preview (countertop-carry.mjs show) is presentation only: its pose is not a composition
        // change, or the draft would go stale on its first update (Apply off). It is put back exactly before any commit.
        if (draft?.carry?.shown || draft?.split?.shown || draft?.join?.shown) return;
        // Legacy content under an owner = a modular 'replace' in flight (or a release): its snapshot may
        // not even normalize. Never a recovery; the next modular fingerprint counts as a change.
        if (classify().status === 'legacy') {
            fingerprint = LEGACY_CONTENT;
            return;
        }
        let next;
        try {
            const value = snapshot();
            next = canonicalKey({
                products: value.products,
                features: value.features,
                order: value.orderProductIds
            });
        } catch  {
            // A composition released to legacy content is not a runtime failure: re-baseline on next claim.
            if (releasing) {
                revision++;
                fingerprint = null;
            } else recovery = true;
            return;
        }
        if (fingerprint !== null && next !== fingerprint) revision++;
        fingerprint = next;
    };
    const dependencies = ()=>{
        syncRevision();
        const versions = active ?? unassigned;
        return {
            compositionRevision: revision,
            geometryRevision: revision,
            catalogVersion: versions.catalogVersion,
            policyVersion: versions.policyVersion
        };
    };
    const assertIdle = ()=>{
        if (closed) throw fail('API_DESTROYED');
        if (recovery) throw fail('RECOVERY_REQUIRED');
        if (!started || !ready()) throw fail('NOT_READY');
        if (busy || draft || switching) throw fail('COMPOSITION_BUSY');
    };
    /** Public writer guard: blocks only a modular composition that is busy, drafting or in recovery. */ const assertWritable = ()=>{
        if (!active || closed) return;
        if (recovery) throw fail('RECOVERY_REQUIRED');
        if (busy || draft || switching) throw fail('COMPOSITION_BUSY');
    };
    const classify = ()=>{
        if (!ready()) return {
            status: 'unavailable',
            collection: null
        };
        try {
            const composition = app.compositionManager.getActiveComposition();
            const products = typeof composition.getAllProducts === 'function' ? composition.getAllProducts() : scene?.capture().products;
            return classifyCompositionProducts(products ?? {}, collections);
        } catch  {
            return {
                status: 'unavailable',
                collection: null
            };
        }
    };
    const readiness = ()=>{
        if (recovery) return 'error';
        if (!started || !ready()) return 'initializing';
        if (active) return 'ready';
        // Empty: Add/DnD may seed a modular composition. Legacy: not a modular composition.
        const status = classify().status;
        return status === 'empty' ? 'ready' : status === 'legacy' ? 'unsupported' : 'initializing';
    };
    const checkCommand = (request)=>{
        if (request.apiInstanceId !== scope.apiInstanceId || request.compositionId !== scope.compositionId) throw fail('SCOPE_MISMATCH');
        if (typeof request.requestId !== 'string' || !request.requestId) throw fail('INVALID_INPUT');
        if (request.expectedCompositionRevision !== dependencies().compositionRevision) throw fail('STALE_COMPOSITION');
    };
    const emit = (name, data)=>{
        const event = {
            ...scope,
            eventSequence: ++sequence,
            compositionRevision: revision,
            data: cloneData(data)
        };
        for (const callback of listeners.get(name) ?? []){
            try {
                callback(cloneData(event));
            } catch  {}
        }
    };
    const remember = (kind, request, action)=>{
        const key = canonicalKey({
            kind,
            request
        }), old = journal.get(request.requestId);
        if (old) {
            if (old.key !== key) return Promise.reject(fail('REQUEST_ID_REUSED'));
            return old.promise.then(cloneData);
        }
        const entry = {
            key,
            status: 'pending'
        };
        entry.promise = Promise.resolve().then(()=>{
            checkCommand(request);
            return action();
        }).then((result)=>{
            entry.status = 'succeeded';
            entry.result = cloneData(result);
            return result;
        }, (error)=>{
            entry.status = 'failed';
            entry.error = {
                code: error.code ?? 'APPLY_FAILED'
            };
            throw error;
        });
        journal.set(request.requestId, entry);
        return entry.promise.then(cloneData);
    };
    const catalog = {
        resolveChoice ({ definitionId, selection = {} }) {
            // Any modular collection may seed an empty composition; an owned one accepts only its own.
            const config = getProductConfig(definitionId), owner = findModularCollection(definitionId, collections);
            if (!config || config.category !== 'cabinets' || !owner || active && owner !== active || !selection || typeof selection !== 'object' || Array.isArray(selection)) return {
                status: 'unsupported'
            };
            return {
                status: 'valid',
                runtime: {
                    productType: definitionId,
                    config: {
                        ...cloneData(config.defaultConfig ?? {}),
                        ...cloneData(selection),
                        productType: definitionId,
                        category: 'cabinets'
                    }
                }
            };
        },
        getDefinition: (definitionId)=>({
                definitionId,
                fields: Object.keys(getProductConfig(definitionId)?.defaultConfig ?? {})
            })
    };
    const choice = (request)=>{
        const resolved = catalog.resolveChoice(request);
        if (resolved.status !== 'valid') throw fail('CATALOG_UNSUPPORTED');
        return resolved.runtime;
    };
    const poseOf = (config)=>({
            x: Number(config.positionX ?? 0) + Number(config.SpatialOffsetM?.x ?? 0),
            y: Number(config.positionY ?? 0) + Number(config.SpatialOffsetM?.y ?? 0),
            z: Number(config.positionZ ?? 0)
        });
    // Cabinet rows (HR-RW-01–HR-RW-05): the same features.localCabinetRows the standard API's layout policy writes.
    // The document carries them as localLayouts; orderProductIds follow them row by row. Cabinets keep
    // their product order (portable preset keys and anchors stay stable across export/import).
    const isSinkCabinet = sinkCabinetDetector(getProductConfig);
    /** isSinkCabinet for a document cabinet whose selection may leave the sink to the catalog defaults (a new SB). */ const isSinkCabinetWithDefaults = (s)=>isSinkCabinet({
            ...getProductConfig(s.productType)?.defaultConfig ?? {},
            ...s
        });
    /** A document cabinet (or a draft candidate: { definitionId, selection }) is a sink base. */ const isSinkDocumentCabinet = (c)=>isSinkCabinetWithDefaults({
            ...c.selection,
            productType: c.definitionId
        });
    const byRows = (cabinets, rows)=>{
        const rank = new Map(rowOrder(rows).map((id, index)=>[
                id,
                index
            ]));
        return [
            ...cabinets
        ].sort((a, b)=>(rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity) || 0);
    };
    function documentOf(saved = snapshot()) {
        const entries = Object.entries(saved.products);
        const featureSettings = cloneData(saved.features ?? {});
        delete featureSettings.localCabinetConnections;
        delete featureSettings[CABINET_ROWS_FEATURE];
        const cabinets = entries.filter(([, config])=>config.category === 'cabinets').map(([id, config])=>({
                id,
                definitionId: config.productType,
                selection: {
                    ...withoutCountertopKeys(cleanConfig(config)),
                    SpatialOffsetM: {
                        x: 0,
                        y: 0
                    }
                },
                roleId: config.CabinetRole ?? 'cabinet',
                placementMode: 'remote',
                frameId: frame.id,
                positionM: poseOf(config)
            }));
        const ids = new Set(cabinets.map((c)=>c.id));
        return {
            schemaVersion: 1,
            id: scope.compositionId,
            collection: collectionDescriptor(active),
            frames: [
                cloneData(frame)
            ],
            cabinets,
            connections: (saved.features?.localCabinetConnections ?? []).filter((edge)=>ids.has(edge.a.cabinetId) && ids.has(edge.b.cabinetId)),
            localLayouts: savedLayouts(saved, cabinets),
            primarySources: entries.filter(([id])=>!ids.has(id)).map(([id, config])=>({
                    id,
                    subsystem: 'runtime-product',
                    schemaVersion: 1,
                    cabinetReferences: cabinets.filter((c)=>(c.selection.SupportGroupId ?? 'group-1') === (config.SupportGroupId ?? 'group-1')).map((c)=>c.id),
                    payload: {
                        productType: config.productType,
                        config: cleanConfig(config),
                        positionM: poseOf(config)
                    }
                })),
            featureSettings
        };
    }
    // Rows with columns (collection `columns: true`, Urban Duplex): the rows feature holds column rows
    // (adapters/cabinet-columns-layout.mjs); places are always read again from the cabinet boxes.
    const usesColumns$1 = ()=>usesColumns(active?.id ?? null, collections);
    const tierHeightM = ()=>active?.pack?.geometry?.tierHeightM ?? null;
    /** Top of the room floor collider (m); null without a floor or when it cannot be measured. */ const floorLevelM = ()=>{
        try {
            return measureFloorColliderBox(app)?.maxM?.y ?? null;
        } catch  {
            return null;
        }
    };
    /** Options of every column-row read (cabinet-columns.mjs columnRowFromBoxes): the fixed plane and the floor
     * (0 without a measured one: the floor of column rows that store none). */ const columnRowOptions = ()=>({
            tierHeightM: tierHeightM(),
            floorM: floorLevelM() ?? 0
        });
    // Two box sources, one per layer. CONFIG boxes (pivot + Width/Height/Depth) decide rows and places: the saved rows
    // are re-derived from them (documentRows), so a drop is planned on them too. MESH boxes (scene.bounds, panels
    // included) decide what the eye sees: collision, the draft's own body, slot poses.
    /** Mesh box of an entity, world metres. */ const meshBoxOf = (entity)=>{
        const b = scene.bounds(entity);
        return {
            minM: {
                ...b.min
            },
            maxM: {
                ...b.max
            }
        };
    };
    /** Height (cm) of a document cabinet; catalog defaults fill a missing one. */ const heightCmOf = (c)=>Number(c.selection?.Height ?? getProductConfig(c.definitionId)?.defaultConfig?.Height);
    /** Config boxes of document cabinets from their pivots and sizes (cm); catalog defaults fill missing sizes. */ const configBoxesOf = (cabinets)=>Object.fromEntries(cabinets.map((c)=>[
                c.id,
                boxFromPivot(c.positionM, {
                    ...getProductConfig(c.definitionId)?.defaultConfig ?? {},
                    ...c.selection
                })
            ]).filter(([, box])=>box));
    /** Column rows of a document: one row per 'cabinet-columns-v1' layout read from the boxes, standing on the
     * layout's anchor Y (its floor: a lone hanging 28 at y 0.28 over an anchor at y 0 is a `top`); cabinets
     * in no such layout (an older preset, a rows layout) get rows from their boxes on the room floor. */ const columnRowsOfDocument = (document)=>{
        const layouts = (document.localLayouts ?? []).filter((layout)=>layout?.policyId === CABINET_COLUMNS_POLICY_ID).map((layout)=>({
                id: layout.id,
                orderedCabinetIds: [
                    ...layout.orderedCabinetIds
                ],
                bottomM: layout.anchorPositionM?.y
            }));
        return reconcileColumnRows(layouts, configBoxesOf(document.cabinets), columnRowOptions());
    };
    /** World box of a panel node (scene.nodeBounds). Not `meshBoxOf`: scene.bounds wants a volume, and the Duplex
     * handle panels are flat meshes (zero thickness in Z); null when the node has no visible mesh. */ const panelBounds = (node)=>scene.nodeBounds?.(node) ?? null;
    /** Connect points the drag snaps to (registry connectPoints: [{ node, kind }], spec L), or null: the box edges only. */ const connectPointsDeclaredFor = (definitionId)=>getProductConfig(definitionId)?.connectPoints ?? null;
    /** A committed cabinet's config box with the world faces of its panels, measured on its entity (spec L).
     * The box stays the body; no connect points declared, nothing measurable or a failure: the plain box.
     * pointsCache (Map id -> connectPointsM, one per draft): a measurement is read from it and a non-empty one kept in
     * it; an empty one is retried next time, as the neighbours' boxes are. */ const withConnectPoints = (id, definitionId, box, pointsCache)=>{
        const declarations = connectPointsDeclaredFor(definitionId);
        if (!declarations) return box;
        const cached = pointsCache.get(id);
        if (cached) return {
            ...box,
            connectPointsM: cached
        };
        try {
            const connectPointsM = measureConnectPointsM(app.root.findByName(id), declarations, {
                bounds: panelBounds
            });
            if (!connectPointsM.length) return box;
            pointsCache.set(id, connectPointsM);
            return {
                ...box,
                connectPointsM
            };
        } catch  {
            return box;
        }
    };
    /** Column rows of the committed composition with the config boxes of their cabinets and each cabinet's type,
     * { rows, boxes, definitionIdOf }, for the drag snap; `exceptId` leaves a moved cabinet out, so its own box never
     * joins a row. */ function columnRowsWithBoxes(exceptId) {
        const document = documentOf();
        document.cabinets = document.cabinets.filter((c)=>c.id !== exceptId);
        return {
            rows: columnRowsOfDocument(document),
            boxes: configBoxesOf(document.cabinets),
            definitionIdOf: new Map(document.cabinets.map((c)=>[
                    c.id,
                    c.definitionId
                ]))
        };
    }
    /** The config boxes with the world faces of their cabinets' panels (connectPointsM): the drag also snaps to those
     * faces (column-snap.mjs). See withConnectPoints for pointsCache. */ const withPanelFaces = ({ boxes, definitionIdOf }, pointsCache)=>Object.fromEntries(Object.entries(boxes).map(([id, box])=>[
                id,
                withConnectPoints(id, definitionIdOf.get(id), box, pointsCache)
            ]));
    /** document.localLayouts of the saved composition (the rows layout, or column rows for a columns collection). */ function savedLayouts(saved, cabinets) {
        const stored = saved.features?.[CABINET_ROWS_FEATURE];
        if (!usesColumns$1()) return rowsToLayouts(pruneRows(stored ?? [], new Set(cabinets.map((c)=>c.id))), frame.id);
        const rows = reconcileColumnRows(stored, configBoxesOf(cabinets), columnRowOptions());
        return columnRowsToLayouts(rows, frame.id);
    }
    /** Rows feature and cabinet order (ids) of a document. */ function documentRows(document) {
        if (!usesColumns$1()) {
            const rows = layoutsToRows(document.localLayouts);
            return {
                featureRows: rows,
                order: byRows(document.cabinets, rows).map((c)=>c.id)
            };
        }
        const rows = columnRowsOfDocument(document), ranked = columnRowOrder(rows);
        const unranked = document.cabinets.map((c)=>c.id).filter((id)=>!ranked.includes(id));
        return {
            featureRows: rows.map(toStoredColumnRow),
            order: [
                ...ranked,
                ...unranked
            ]
        };
    }
    function serialized(document) {
        if (canonicalKey(document.frames) !== canonicalKey([
            frame
        ])) throw fail('INVALID_PLACEMENT_FRAME');
        const products = {}, { featureRows: rows, order } = documentRows(document);
        const orderProductIds = Object.fromEntries(order.map((id, index)=>[
                id,
                index
            ]));
        for (const cabinet of document.cabinets){
            const runtime = choice(cabinet), p = cabinet.positionM;
            if (!isFiniteVec3(p) || cabinet.frameId !== frame.id) throw fail('INVALID_PLACEMENT');
            products[cabinet.id] = {
                ...withoutCountertopKeys(runtime.config),
                entityName: cabinet.id,
                SpatialOffsetM: {
                    x: 0,
                    y: 0
                },
                positionX: p.x,
                positionY: p.y,
                positionZ: p.z
            };
        }
        for (const source of document.primarySources){
            const { productType, config, positionM: p } = source.payload;
            if (!getProductConfig(productType) || !isFiniteVec3(p)) throw fail('PRESET_SOURCE_NOT_PORTABLE');
            products[source.id] = {
                ...cloneData(config),
                productType,
                entityName: source.id,
                positionX: p.x - Number(config.SpatialOffsetM?.x ?? 0),
                positionY: p.y - Number(config.SpatialOffsetM?.y ?? 0),
                positionZ: p.z
            };
        }
        // No rows (an older preset) = derived from the built cabinets by the layout policy's observe().
        return {
            compositionId: scope.compositionId,
            compositionType: 'bathroom',
            products,
            orderProductIds,
            sceneEntities: {},
            features: {
                ...cloneData(document.featureSettings),
                localCabinetConnections: cloneData(document.connections),
                ...rows.length ? {
                    [CABINET_ROWS_FEATURE]: rows
                } : {}
            }
        };
    }
    const documentProducts = (document)=>Object.fromEntries([
            ...document.primarySources.map((s)=>[
                    s.id,
                    {
                        ...s.payload.config,
                        productType: s.payload.productType
                    }
                ]),
            ...document.cabinets.map((c)=>[
                    c.id,
                    {
                        ...c.selection,
                        productType: c.definitionId,
                        category: 'cabinets'
                    }
                ])
        ]);
    /** Rows -> document: localLayouts and the per-row SupportGroupId (HR-RW-05). */ function applyDocumentRows(document, rows) {
        document.localLayouts = rowsToLayouts(rows, frame.id);
        applyDocumentGroups(document, assignSupportGroups(rows, documentProducts(document), {
            isSinkCabinet
        }));
    }
    /** Column rows -> document: localLayouts and SupportGroupId (a column's bottom gets `${group}~under`: not a support). */ function applyDocumentColumnRows(document, rows) {
        document.localLayouts = columnRowsToLayouts(rows, frame.id);
        applyDocumentGroups(document, columnSupportGroups(rows, documentProducts(document), {
            isSinkCabinet
        }));
    }
    /** Cabinet SupportGroupIds -> document; every primary source references the cabinets of its group. */ function applyDocumentGroups(document, groups) {
        for (const c of document.cabinets)if (groups.has(c.id)) c.selection = {
            ...c.selection,
            SupportGroupId: groups.get(c.id)
        };
        const groupOf = (config)=>config?.SupportGroupId ?? 'group-1';
        for (const s of document.primarySources){
            s.cabinetReferences = document.cabinets.filter((c)=>groupOf(c.selection) === groupOf(s.payload.config)).map((c)=>c.id);
        }
    }
    /** Draft collision: overlap with another cabinet or the primary countertop slab is red and blocks Apply.
     * The preview's box against every committed cabinet except a move's own source, plus the slab. Neighbours are
     * measured once per draft (record.bodies, see measureDraftBodies); the preview moves rigidly with its
     * root pivot, so its box is kept relative to the candidate position. Never throws: a failure is `unknown`. */ const measureNeighbour = (id)=>{
        try {
            const entity = app.root.findByName(id);
            return entity ? meshBoxOf(entity) : null;
        } catch  {
            return null;
        }
    };
    /**
     * The draft pose snapped into the column rows (column-snap.mjs), or null when it stays where it is.
     * The committed rows, their config boxes and the floor are read at the first snap and kept in record.bodies (why:
     * measureDraftBodies), not on every pointer move; only panel faces not measurable yet are measured again.
     */ function snappedIntoColumn(record, positionM) {
        var _bodies, // Only a measured floor is kept; without one this update snaps on 0 and the next one measures again.
        _bodies1;
        if (!usesColumns$1()) return null;
        // record.bodies exists: begin measured it before the draft reached 'preview', the only state updateDraft accepts.
        const bodies = record.bodies;
        (_bodies = bodies).columns ?? (_bodies.columns = columnRowsWithBoxes(record.state.candidate.productId));
        // No committed rows yet: nothing to snap to.
        if (!bodies.columns.rows.length) return null;
        (_bodies1 = bodies).floorM ?? (_bodies1.floorM = floorLevelM());
        try {
            var _bodies2;
            const { rows } = bodies.columns, floorM = bodies.floorM ?? 0;
            const boxes = withPanelFaces(bodies.columns, (_bodies2 = bodies).connectPointsById ?? (_bodies2.connectPointsById = new Map()));
            const relativeBox = bodies.self ?? measureSelf(record);
            // The draft's own panel faces (begin and refreshDraftSelf measure them); [] while unknown: the box edges only.
            const relativeConnectPoints = bodies.selfPoints ?? [];
            const result = snapDraftIntoColumn({
                relativeBox,
                relativeConnectPoints,
                positionM
            }, rows, boxes, {
                floorM
            });
            // Dev only (`window.__UD_SNAP_DEBUG__ = true`): the exact input and output of the last snap, for the console.
            if (globalThis.__UD_SNAP_DEBUG__) globalThis.__udSnapLast = {
                positionM,
                floorM,
                rows,
                boxes,
                relativeBox,
                relativeConnectPoints,
                result
            };
            return result?.positionM ?? null;
        } catch (error) {
            if (globalThis.__UD_SNAP_DEBUG__) globalThis.__udSnapLast = {
                positionM,
                error: String(error?.stack ?? error)
            };
            return null;
        }
    }
    const measureSelf = (record)=>{
        try {
            return relativeBox(meshBoxOf(record.handle.entity), record.state.candidate.effectivePlacement.positionM);
        } catch  {
            return null;
        }
    };
    /** The draft's own panel faces relative to its pivot (spec L), measured like `self`: same entity, same pivot.
     * [] for a product without connect points; null while nothing is measurable (measured again on the next update). */ const measureSelfPoints = (record)=>{
        const declarations = connectPointsDeclaredFor(record.state.candidate.definitionId);
        if (!declarations) return [];
        try {
            const pointsM = measureConnectPointsM(record.handle.entity, declarations, {
                bounds: panelBounds
            });
            // A partial measurement (some nodes still pending) is kept for the whole draft: the preview's rules ran before begin returned.
            return pointsM.length ? toRelative(pointsM, record.state.candidate.effectivePlacement.positionM) : null;
        } catch  {
            return null;
        }
    };
    /** The draft's box and panel faces measured again. A preview settles after begin (deferred Boolean cuts, hooks):
     * a UD 28 measured at begin was 34 cm high with 6 cm under its pivot, so it never fitted under a hanging top.
     * The preview is one entity, so a measurement per update is cheap; a failed one keeps the last good value. */ const refreshDraftSelf = (record)=>{
        if (!record.bodies) return;
        const self = measureSelf(record);
        if (self) record.bodies.self = self;
        const selfPoints = measureSelfPoints(record);
        if (selfPoints) record.bodies.selfPoints = selfPoints;
    };
    const measureNeighbours = (record)=>{
        const own = record.state.candidate.productId;
        try {
            const cabinets = documentOf().cabinets.filter((c)=>c.id !== own).map((c)=>({
                    id: c.id,
                    box: measureNeighbour(c.id)
                }));
            // The room floor (Floor_R1) collides too: a cabinet cannot be dropped into it. No floor = no floor body.
            const floor = measureFloorColliderBox(app);
            return floor ? [
                ...cabinets,
                {
                    id: FLOOR_COLLIDER_ID,
                    box: floor
                }
            ] : cabinets;
        } catch  {
            return null;
        }
    };
    /** The primary slab is a collision obstacle even without a sink/trap (e.g. Remote / vessel / cover style).
     * Measure TopSolid only: its product root can also contain a hanging basin. Generated Cabinet_Cover slabs
     * are not immutable obstacles: the cover planner consumes them under a newly stacked cabinet (AC-21). */ const measureCountertop = ()=>{
        try {
            const adapter = app.compositionManager?.countertopCompositionAdapter ?? null, mesh = adapter?.countertopMesh ?? null;
            const state = adapter?.getState?.(), root = adapter?.countertopRoot ?? null;
            const productId = state?.productId ?? root?.name ?? null;
            if (!mesh || !productId) return null;
            let box = null;
            try {
                box = meshBoxOf(mesh);
            } catch  {}
            // root: the top a moved sink base carries (countertop-carry.mjs). thick: HR-PL-11 (tandem vanities).
            const snapshot = app.compositionManager?.getActiveComposition?.()?.getProduct?.(productId) ?? null;
            // cutouts: the top's basin cut-outs with their HR-CT-06 margins (basin clearance HR-PL-12/13).
            let cutouts = [];
            try {
                cutouts = (adapter.getCoverageInputs?.()?.cutouts ?? []).map((c)=>({
                        ...c
                    }));
            } catch  {}
            return {
                productId,
                box,
                traps: (state?.traps ?? []).map((trap)=>({
                        ...trap
                    })),
                cutouts,
                root,
                mesh,
                thick: !!snapshot && !isThinCountertop(snapshot),
                lengthM: state?.size?.length ?? null,
                attached: state?.placementState === 'attached',
                config: snapshot ? {
                    ...snapshot
                } : null
            };
        } catch  {
            return null;
        }
    };
    /** The per-draft cache record.bodies: the draft's own box and panel faces, the committed neighbours, and (from the
     * first snap) the column rows, the floor and the neighbours' panel faces. Committed cabinets cannot move while a
     * draft is open (assertWritable blocks every writer), so what is measured of them stays true until the draft ends;
     * only geometry that was not measurable yet is measured again. */ function measureDraftBodies(record) {
        record.bodies = {
            self: measureSelf(record),
            selfPoints: measureSelfPoints(record),
            neighbours: measureNeighbours(record)
        };
        record.countertop = measureCountertop();
        // Preserve the source pose even when the slab/body geometry is not ready until a later update.
        if (record.state.kind === 'move') record.carryFromM = {
            ...record.state.candidate.effectivePlacement.positionM
        };
        initializeCountertopCarry(record);
    }
    function initializeCountertopCarry(record) {
        if (record.carryResolved || !record.carryFromM || !record.bodies.self || !record.countertop?.box) return false;
        record.carry = createCountertopCarry({
            countertop: record.countertop,
            cabinetId: record.state.candidate.productId,
            fromM: record.carryFromM,
            box: boxAt(record.bodies.self, record.carryFromM),
            contactM: owned?.validator?.pack?.tolerances?.contactM ?? 0.002
        });
        record.carryResolved = true;
        return !!record.carry;
    }
    /** The BoolB_ cutters under a sink base entity's sink mount (as RuleCountertopBooleanCutouts finds them). */ const sinkCuttersOf = (entity, definitionId)=>{
        const config = getProductConfig(definitionId);
        const anchorName = config?.sinkMount?.anchorName ?? config?.meshConfig?.subProducts?.find((sub)=>sub.configKey === 'sinkType')?.attachPoint ?? null;
        const anchor = anchorName ? entity?.findByName?.(anchorName) : null, found = [];
        const visit = (node)=>{
            if (!node) return;
            if (String(node.name ?? '').includes('BoolB_')) {
                found.push(node);
                return;
            }
            if (node.enabled === false) return;
            (node.children ?? []).forEach(visit);
        };
        (anchor?.children ?? []).forEach(visit);
        return found;
    };
    /** World X of a sink base draft's own sink at `positionM`: the centre of its box (the trap sits at the SB centre,
     * R16.3); undefined for a cabinet without a sink. */ const draftSinkXM = (record, positionM)=>{
        if (!isSinkDocumentCabinet(record.state.candidate)) return undefined;
        const box = positionM ? draftBoxOf(record, positionM) : null;
        return box ? (box.minX + box.maxX) / 2 : undefined;
    };
    /**
     * P210 (Andriy 27.10): a sink base whose box reaches the trap of the sink the top hosts snaps along X so it stands
     * right under that sink — the landing; on Apply the sink lands in it (landSinkDocument). Elsewhere it stays as it is.
     */ const snappedUnderHostedSink = (record, positionM)=>{
        const box = isSinkDocumentCabinet(record.state.candidate) && positionM ? draftBoxOf(record, positionM) : null;
        if (!box) return positionM;
        const dx = sinkBaseShiftUnderHostedSink({
            traps: record.countertop?.traps ?? [],
            minX: box.minX,
            maxX: box.maxX,
            sinkXM: (box.minX + box.maxX) / 2
        });
        return dx ? {
            ...positionM,
            x: positionM.x + dx
        } : positionM;
    };
    /** A sink base draft's basin cut-out relative to its pivot X ({ minX, maxX, vessel }), measured once on the preview's
     * BoolB_ cutters (cutterFootprint, as the cut-out markers do); null for a cabinet without a sink or not measured yet. */ const cutoutOffsetOf = (record)=>{
        if (record.cutoutOffset !== undefined) return record.cutoutOffset;
        const candidate = record.state.candidate, entity = record.handle?.entity ?? null;
        if (!isSinkDocumentCabinet(candidate)) return record.cutoutOffset = null;
        const pivotX = Number(entity?.getPosition?.()?.x);
        const boxes = entity ? sinkCuttersOf(entity, candidate.definitionId).map((cutter)=>cutterFootprint(cutter)).filter(Boolean) : [];
        if (!boxes.length || !Number.isFinite(pivotX)) return null; // measured on a later update
        record.cutoutOffset = {
            minX: Math.min(...boxes.map((b)=>b.minM.x)) - pivotX,
            maxX: Math.max(...boxes.map((b)=>b.maxM.x)) - pivotX,
            vessel: /^Vessel(_|$)/.test(String(candidate.selection?.sinkType ?? ''))
        };
        return record.cutoutOffset;
    };
    /** The draft's basin cut-out in world X at `positionM`, or undefined. */ const draftCutoutM = (record, positionM)=>{
        const offset = cutoutOffsetOf(record);
        return offset && Number.isFinite(positionM?.x) ? {
            minX: positionM.x + offset.minX,
            maxX: positionM.x + offset.maxX,
            vessel: offset.vessel
        } : undefined;
    };
    /** At the landing the preview shows the top's sink only: the draft's own basin (its sink anchor) is hidden there. */ const showLandingPreview = (record, landed)=>{
        const entity = record.handle?.entity, config = getProductConfig(record.state.candidate.definitionId);
        const anchorName = config?.sinkMount?.anchorName ?? config?.meshConfig?.subProducts?.find((sub)=>sub.configKey === 'sinkType')?.attachPoint ?? null;
        const anchor = anchorName ? entity?.findByName?.(anchorName) : null;
        if (anchor && anchor.enabled === landed) anchor.enabled = !landed;
    };
    /** The hosted trap the draft's own sink stands right under at `positionM`, or null. */ const hostedTrapUnderDraft = (record, positionM)=>{
        const sinkXM = draftSinkXM(record, positionM);
        if (sinkXM === undefined) return null;
        return (record.countertop?.traps ?? []).find((trap)=>trap?.hostCabinetId == null && Number.isFinite(trap?.xM) && Math.abs(trap.xM - sinkXM) <= SINK_BASE_ALIGN_TOLERANCE_M) ?? null;
    };
    /** The draft's cabinet as its config box at `positionM`: { minX, maxX, topY }, or null. */ const draftBoxOf = (record, positionM)=>{
        const { definitionId, selection } = record.state.candidate;
        const box = boxFromPivot(positionM, {
            ...getProductConfig(definitionId)?.defaultConfig ?? {},
            ...selection
        });
        return box ? {
            minX: box.minM.x,
            maxX: box.maxM.x,
            topY: box.maxM.y
        } : null;
    };
    /**
     * Tandem vanities (Andriy 23.10): while an SB leaves a top it shares with other SBs (or an SB is added beside a
     * top on an SB), the top follows it in the preview (countertop-split-preview.mjs). Decided once per draft.
     */ function initializeSplitPreview(record) {
        var _record;
        if (record.splitResolved || !record.countertop?.box || !record.countertop.mesh || !record.handle?.entity) return;
        record.splitResolved = true;
        const top = record.countertop, candidate = record.state.candidate, id = candidate.productId;
        if (record.carry || !top.attached || !top.config) return;
        if (!isSinkDocumentCabinet(candidate)) return;
        const hosted = (top.traps ?? []).some((trap)=>trap?.hostCabinetId != null);
        if (record.state.kind === 'move' ? !countertopSharedWithOtherSinkBase(top, id) : !hosted) return;
        (_record = record).document ?? (_record.document = documentOf());
        const group = top.config.SupportGroupId ?? 'group-1';
        const under = record.document.cabinets.filter((c)=>(c.selection.SupportGroupId ?? 'group-1') === group);
        const boxes = configBoxesOf(under);
        const extentOf = (cabinets)=>{
            const list = cabinets.map((c)=>boxes[c.id]).filter(Boolean);
            return list.length ? {
                minX: Math.min(...list.map((b)=>b.minM.x)),
                maxX: Math.max(...list.map((b)=>b.maxM.x))
            } : null;
        };
        const groupExtent = extentOf(under), kept = under.filter((c)=>c.id !== id), keptExtent = extentOf(kept);
        if (!groupExtent || !keptExtent) return;
        const sinkTops = kept.filter(isSinkDocumentCabinet).map((c)=>boxes[c.id]?.maxM.y).filter(Number.isFinite);
        record.split = createCountertopSplitPreview({
            countertop: top,
            groupExtent,
            thin: !top.thick,
            others: {
                ...keptExtent,
                sinkTopY: sinkTops.length ? Math.max(...sinkTops) : null
            },
            sourceRoot: id ? app.root.findByName(id) : null,
            makeTopPreview: (config)=>scene.makePreview(top.config.productType ?? 'Top_Solid', config),
            cuttersOf: (entity)=>sinkCuttersOf(entity, candidate.definitionId),
            measure: (entity)=>{
                try {
                    const mesh = entity.findByName?.('TopSolid');
                    return mesh ? meshBoxOf(mesh) : null;
                } catch  {
                    return null;
                }
            },
            markers: app.root?.addChild ? createCutoutMarkers(app) : null,
            footprintOf: (cutter)=>cutterFootprint(cutter)
        });
        if (record.split && typeof app.on === 'function') {
            record.splitTick = ()=>record.split?.reassert();
            app.on('update', record.splitTick);
        }
    }
    /**
     * Join (config 15280, Andriy 23.10): a thick top carried by its only SB, dragged level with another SB row (its own
     * group), is what Apply extends over both rows (assignSupportGroups extendsTop) — the drag shows the extended top
     * (countertop-split-preview.mjs 'extend' with that row), the carry everywhere else. Decided once per draft.
     */ function initializeJoinPreview(record) {
        var _record;
        if (record.joinResolved || !record.carry || !record.handle?.entity) return;
        record.joinResolved = true;
        const top = record.countertop, candidate = record.state.candidate, id = candidate.productId;
        if (!top?.thick || !top.config || !top.mesh) return;
        (_record = record).document ?? (_record.document = documentOf());
        const cabinets = record.document.cabinets, home = cabinets.find((c)=>c.id === id);
        const groupOf = (c)=>c.selection.SupportGroupId ?? 'group-1', topGroup = top.config.SupportGroupId ?? 'group-1';
        const groups = [
            ...new Set(cabinets.filter((c)=>c.id !== id && isSinkDocumentCabinet(c) && groupOf(c) !== topGroup).map(groupOf))
        ];
        if (!home || !groups.length) return;
        const boxes = configBoxesOf(cabinets);
        const rows = groups.map((group)=>{
            const under = cabinets.filter((c)=>c.id !== id && groupOf(c) === group && boxes[c.id]);
            const sinks = under.filter(isSinkDocumentCabinet);
            return under.length ? {
                minX: Math.min(...under.map((c)=>boxes[c.id].minM.x)),
                maxX: Math.max(...under.map((c)=>boxes[c.id].maxM.x)),
                sinkTopY: Math.max(...sinks.map((c)=>boxes[c.id].maxM.y)),
                cutters: sinks.flatMap((c)=>sinkCuttersOf(app.root.findByName(c.id), c.definitionId))
            } : null;
        }).filter((row)=>row && Number.isFinite(row.sinkTopY));
        const homeBox = boxes[home.id];
        if (!rows.length || !homeBox) return;
        const preview = createCountertopSplitPreview({
            countertop: top,
            groupExtent: {
                minX: homeBox.minM.x,
                maxX: homeBox.maxM.x
            },
            others: rows[0],
            thin: false,
            sourceRoot: id ? app.root.findByName(id) : null,
            home: {
                topY: homeBox.maxM.y
            },
            cuttersOf: (entity)=>sinkCuttersOf(entity, candidate.definitionId),
            measure: ()=>null,
            markers: app.root?.addChild ? createCutoutMarkers(app) : null,
            footprintOf: (cutter)=>cutterFootprint(cutter)
        });
        if (!preview) return;
        record.join = {
            preview,
            rows,
            get shown () {
                return preview.shown;
            },
            hide: ()=>preview.hide(),
            dispose: ()=>{
                if (record.joinTick) app.off?.('update', record.joinTick);
                preview.dispose();
            }
        };
        if (typeof app.on === 'function') {
            record.joinTick = ()=>preview.reassert();
            app.on('update', record.joinTick);
        }
    }
    /** The carried top at `positionM`: extended over a row it joins there (initializeJoinPreview), else carried. */ function showCarriedTop(record, positionM) {
        if (!record.carry) return;
        try {
            initializeJoinPreview(record);
        } catch  {}
        const box = record.join ? draftBoxOf(record, positionM) : null;
        const joined = box ? pickLevelRows(record.join.rows, box) : null;
        if (joined) {
            record.carry.hide();
            try {
                record.join.preview.update(box, record.handle?.entity ?? null, joined);
            } catch  {}
            return;
        }
        record.join?.hide();
        record.carry.show(positionM);
    }
    const showSplitPreview = (record, positionM)=>{
        try {
            initializeSplitPreview(record);
            record.split?.update(draftBoxOf(record, positionM), record.handle?.entity ?? null);
        } catch  {}
    };
    function evaluateDraft(record) {
        var // Geometry that was not ready at begin is measured again (measureDraftBodies).
        _bodies, _bodies1, _n;
        const bodies = record.bodies ?? (record.bodies = {
            self: null,
            neighbours: null
        });
        const p = record.state.candidate.effectivePlacement.positionM;
        (_bodies = bodies).self ?? (_bodies.self = measureSelf(record));
        (_bodies1 = bodies).neighbours ?? (_bodies1.neighbours = measureNeighbours(record));
        if (bodies.neighbours) for (const n of bodies.neighbours)(_n = n).box ?? (_n.box = measureNeighbour(n.id));
        if (!record.countertop?.box) record.countertop = measureCountertop();
        if (initializeCountertopCarry(record)) showCarriedTop(record, p);
        // A carried slab follows its SB's candidate pose, not its cached starting position. The same
        // measured slab (actual custom length) feeds collision and trap validation; absence of traps is irrelevant.
        // Two SBs under one top: the moved one takes only its own trap along (tandem vanities, countertop-carry.mjs).
        const countertop = draftCountertop(record.countertop, {
            carry: record.carry,
            cabinetId: record.state.candidate.productId,
            toM: p
        });
        const neighbours = bodies.neighbours && countertop ? [
            ...bodies.neighbours,
            {
                id: countertop.productId,
                box: countertop.box
            }
        ] : bodies.neighbours;
        let box = null;
        try {
            box = bodies.self ? boxAt(bodies.self, p) : null;
        } catch  {
            box = null;
        }
        // Decision (a): the floor sees the body only (from the pivot Y up); cabinets stay on meshes.
        const collision = neighbours ? detectDraftCollision({
            box,
            neighbours,
            levelM: p?.y ?? null
        }) : {
            status: 'unknown',
            collidesWith: []
        };
        const colliding = collision.status === 'colliding', ids = [
            ...collision.collidesWith
        ];
        record.state.collision = {
            status: collision.status,
            collidesWith: ids
        };
        const verdict = owned?.validator ? validateDraft(record, owned.validator, {
            box,
            collision: {
                ...collision,
                counterpartTypes: countertop ? {
                    [countertop.productId]: 'countertop'
                } : {}
            }
        }) : {
            status: colliding ? 'invalid' : 'valid',
            reasons: colliding ? collisionReasons(ids, countertop?.productId) : [],
            requiredDecisionIds: []
        };
        record.state.validation = {
            ...record.state.validation,
            ...verdict,
            candidateRevision: record.state.candidateRevision
        };
        if (verdict.status === 'valid' && isFiniteVec3(p)) record.lastValidPositionM = {
            ...p
        };
    }
    /** Kernel validation of the draft against the active pack: facts from the document, the measured
     * bodies and the adapter collision (HR-PL-01 is read, not recomputed); only violations involving the
     * draft count (focusIds). A failure here is reported as pending, never as valid. */ function validateDraft(record, validator, { box, collision }) {
        const candidate = record.state.candidate, id = candidate.productId ?? `draft:${record.state.sessionId}`;
        try {
            var // The committed document is read once per draft (see measureDraftBodies).
            _record;
            let config = candidate.selection;
            try {
                config = choice(candidate).config;
            } catch  {}
            (_record = record).document ?? (_record.document = documentOf());
            const facts = draftPlacementFacts({
                pack: validator.pack,
                document: record.document,
                neighbours: record.bodies?.neighbours,
                candidate: {
                    id,
                    definitionId: candidate.definitionId,
                    config,
                    positionM: candidate.effectivePlacement.positionM,
                    box,
                    sinkXM: draftSinkXM(record, candidate.effectivePlacement.positionM),
                    cutoutM: draftCutoutM(record, candidate.effectivePlacement.positionM)
                },
                collision,
                ignoreIds: [
                    FLOOR_COLLIDER_ID
                ],
                countertop: draftCountertop(record.countertop, {
                    carry: record.carry,
                    cabinetId: candidate.productId,
                    toM: candidate.effectivePlacement.positionM
                }) ?? null
            });
            const result = validator.validate(facts, {
                focusIds: [
                    id
                ]
            });
            // UI contract: each reason lists only the committed obstacles of its own type.
            return {
                ...result,
                reasons: result.reasons.map((r)=>({
                        ...r,
                        affectedProductIds: r.affectedProductIds.filter((x)=>x !== id)
                    }))
            };
        } catch (error) {
            return {
                status: 'pending',
                reasons: [
                    reason('VALIDATION_FAILED', [], {
                        message: String(error?.message ?? error)
                    })
                ],
                requiredDecisionIds: []
            };
        }
    }
    /** HR-RW-01: the dropped cabinet joins/inserts into the row it touches or overlaps, or starts a row; only
     * the affected rows are re-laid (left edge fixed). Committed cabinets are measured live; the dropped
     * one on its preview (a move's hidden source keeps its original slot for the row bookkeeping). */ function arrangeDrop(document, saved, id, previewEntity, originalM) {
        if (usesColumns$1()) {
            arrangeColumnDrop(document, saved, id);
            return;
        }
        // Plan A: row logic reads the LEVEL from the pivot (a sink mesh hangs below it); X/Z stay the mesh.
        const box = withLevel(meshBoxOf(previewEntity), cabinetLevelM(previewEntity)), pivot = previewEntity.getPosition();
        const boxes = {}, extents = {
            [id]: extentFromBox(box, pivot.x)
        };
        for (const c of document.cabinets){
            if (c.id === id) continue;
            const entity = app.root.findByName(c.id);
            boxes[c.id] = withLevel(meshBoxOf(entity), cabinetLevelM(entity));
            extents[c.id] = extentFromBox(boxes[c.id], entity.getPosition().x);
        }
        if (originalM) {
            const shift = {
                x: originalM.x - pivot.x,
                y: originalM.y - pivot.y,
                z: originalM.z - pivot.z
            };
            const moved = (p)=>({
                    x: p.x + shift.x,
                    y: p.y + shift.y,
                    z: p.z + shift.z
                });
            boxes[id] = {
                minM: moved(box.minM),
                maxM: moved(box.maxM)
            };
        }
        // A moved sink base leaves its neighbours where they are (D&D Shifting SB, Andriy 22.10): no gap closing.
        const moved = document.cabinets.find((c)=>c.id === id);
        const keepSourceRow = !!originalM && !!moved && isSinkCabinet({
            ...moved.selection,
            productType: moved.definitionId
        });
        const plan = planCabinetDrop({
            rows: reconcileRows(saved.features?.[CABINET_ROWS_FEATURE] ?? null, boxes).rows,
            boxes,
            extents,
            id,
            box,
            keepSourceRow
        });
        for (const c of document.cabinets){
            const x = plan.slots.get(c.id);
            if (x !== undefined) c.positionM = {
                ...c.positionM,
                x
            };
            // A join puts the pivot on the row's level; X comes from the row, Z stays where it was dropped.
            // A new row keeps the dropped pivot y.
            if (c.id === id && plan.bottomM !== null) c.positionM = {
                ...c.positionM,
                y: plan.bottomM
            };
        }
        // A sink base set apart within the level tolerance of a thick top's SBs sits exactly at their level (HR-PL-11).
        snapSinkBaseToThickTop(document, plan.rows, id, {
            isSinkCabinet: isSinkCabinetWithDefaults,
            heightOf: heightCmOf
        });
        applyDocumentRows(document, plan.rows);
    }
    /**
     * Drag-and-drop Apply for a columns collection: the drop joins the row it touches (a 28 dropped onto a 28
     * becomes the top or bottom of a column), else starts a row; the touched row is laid out again.
     * Example: [56][bottom 28] + a 28 dropped above the bottom -> [56][top 28 / bottom 28], top at the plane.
     */ function arrangeColumnDrop(document, saved, id) {
        // 1. CONFIG boxes of every cabinet, the drop included (document.cabinets holds it at its effective pose): the
        //    places planned here are the ones documentRows re-derives from the same boxes when the result is saved.
        const { [id]: box, ...boxes } = configBoxesOf(document.cabinets), tier = columnRowOptions();
        const pivotXOf = new Map(document.cabinets.map((c)=>[
                c.id,
                c.positionM.x
            ]));
        // 2. Rows without the dropped cabinet (a move leaves its old place first), then the drop joins.
        //    The plane and the floor fix the slots: a top dropped 45 cm right of a bottom keeps that shift (bottomOffsetM).
        const stored = saved.features?.[CABINET_ROWS_FEATURE] ?? null;
        const rows = reconcileColumnRows(stored, boxes, tier);
        // A drop that starts its own row stands on the rows' floor, the one the drag snapped and validated it on.
        const plan = placeColumnDrop(rows, boxes, id, box, {
            ...tier,
            floorM: dropFloorM(stored, id, tier.floorM, {
                dropTopM: box?.maxM.y,
                tierHeightM: tier.tierHeightM
            })
        });
        // 3. The touched row laid out again: X of every member, Y on the floor or hanging from the plane.
        const row = plan.rows.find((candidate)=>candidate.id === plan.rowId), allBoxes = {
            ...boxes,
            [id]: box
        };
        const memberBoxes = Object.fromEntries(cabinetsOfRow(row).map((member)=>[
                member,
                allBoxes[member]
            ]));
        const positions = layoutColumnRow(row, columnSizes(memberBoxes, (member)=>pivotXOf.get(member)));
        for (const c of document.cabinets){
            const target = positions.get(c.id);
            if (target) c.positionM = {
                ...c.positionM,
                x: target.pivotXM,
                y: target.pivotYM
            };
        }
        applyDocumentColumnRows(document, plan.rows);
    }
    // authoritative: the scene was just replaced/adopted, its positions are the truth (no reflow follows).
    const observeLayout = async (options)=>{
        try {
            await owned?.policy?.observe?.(undefined, options);
        } catch  {}
    };
    const state = ()=>({
            status: recovery ? 'recovery-required' : busy ? 'applying' : 'ready',
            activeSessionId: draft?.state.sessionId ?? null,
            dependencies: dependencies(),
            reasons: []
        });
    const view = ()=>{
        const d = documentOf();
        return {
            cabinets: d.cabinets,
            connections: d.connections,
            localLayouts: d.localLayouts,
            groups: [],
            selectedCabinetId: app.selectTool?.getSelected?.()?.[0]?.name ?? null
        };
    };
    const announce = ()=>{
        // Legacy content (a modular 'replace' still in flight) is not this runtime's view.
        const status = classify().status, own = active && status !== 'legacy';
        try {
            emit('compositionChange', state());
            if (own || status === 'empty') emit('cabinetsChange', view());
        } catch  {
            if (own) recovery = true;
        }
    };
    const draftState = (record)=>({
            ...cloneData(record.state),
            canApply: !busy && !record.cancelled && record.state.lifecycle === 'preview' && record.state.validation.status === 'valid' && record.state.validation.candidateRevision === record.state.candidateRevision && canonicalKey(record.state.validation.validatedDependencies) === canonicalKey(dependencies()) && record.state.baseCompositionRevision === dependencies().compositionRevision,
            canCancel: !busy && [
                'loading-draft',
                'preview'
            ].includes(record.state.lifecycle)
        });
    const emitDraft = (record)=>{
        emit('placementChange', draftState(record));
        emit('compositionChange', state());
    };
    const preview = {
        getActiveHandles: ()=>draft?.handle ? [
                draft.handle
            ] : [],
        getPickTarget: (handle)=>handle.entity,
        containsPickTarget (handle, target) {
            for(let node = target; node; node = node.parent)if (node === handle.entity) return true;
            return false;
        }
    };
    async function ensureCoverSettings(fallback) {
        const manager = app.compositionManager;
        if (!manager.cabinetCoverCompositionAdapter || manager.getActiveComposition().getCabinetCoverSettings?.() != null) return false;
        // Legacy preset clears composition features. Restore the local policy,
        // including explicit disabled/custom settings, before awaiting geometry.
        await manager.cabinetCoverCompositionAdapter.configure(fallback ?? await scene.defaultCoverSettings());
        return true;
    }
    // Draft input subscribes through the facade, which accepts subscriptions only while ready.
    const ensureInput = ()=>{
        if (closed || readiness() !== 'ready') return;
        if (input && !inputStarted) {
            try {
                input.start();
                inputStarted = true;
            } catch  {}
        }
        if (overlay && !overlayStarted) {
            try {
                overlay.start();
                overlayStarted = true;
            } catch  {}
        }
    };
    /** The overlay draws on the preview's meshes: release it before the preview (and its meshes) goes. */ const disposeDraft = async (record)=>{
        record.carry?.hide();
        if (record.splitTick) app.off?.('update', record.splitTick);
        record.split?.dispose();
        record.join?.dispose();
        try {
            overlay?.release?.();
        } catch  {}
        if (!record.handle || record.handleDisposed) return;
        record.handleDisposed = true;
        await record.handle.dispose();
    };
    async function activate(collection) {
        const manager = app.compositionManager;
        const record = owned = {
            collection,
            policy: null,
            validator: null,
            restoreWrites: null,
            previousPolicy: manager.freeLayoutPolicy,
            previousPreserve: manager.preserveCabinetPositions,
            previousDrag: manager.modules?.dragEnabled
        };
        // Placement rules (kernel) from the collection's pack; a pack error is an activation error, never a permissive draft.
        record.validator = collection.pack ? createPlacementValidator(collection.pack) : null;
        // A 'replace' (preset) onto legacy content: that content is never measured, fingerprinted or given
        // modular covers; the replacing writer (legacyWrite / committed) configures covers afterwards.
        const legacyContent = classify().status === 'legacy';
        let wroteCovers = false;
        active = collection;
        // ULH hangs its cabinets: the room goes down (cabinets stay built from Y = 0), unless the UI set it.
        roomController(app)?.setRuntimeCollection(collection?.id ?? null);
        try {
            const factory = createLayoutPolicy ?? collection.createLayoutPolicy;
            record.policy = typeof factory === 'function' ? factory({
                app,
                collection: collectionDescriptor(collection),
                compositionId: scope.compositionId,
                matches: collection.matches,
                getProductConfig
            }) ?? null : null;
            if (record.policy) manager.freeLayoutPolicy = record.policy;
            manager.preserveCabinetPositions = true;
            manager.modules?.setDragEnabled(false);
            if (!legacyContent) {
                await observeLayout({
                    authoritative: true
                }); // rows of an adopted composition (migration) + seeded widths
                syncRevision();
                if (wroteCovers = await ensureCoverSettings()) await scene.settle();
            }
            if (closed) throw fail('API_DESTROYED');
            record.restoreWrites = scene.guardWrites?.(assertWritable) ?? null;
            ensureInput();
        } catch (error) {
            await deactivate({
                clearCovers: wroteCovers
            });
            throw error;
        }
    }
    async function deactivate({ clearCovers }) {
        const record = owned;
        if (record) syncRevision(true); // keep the last modular fingerprint for the next activation
        owned = null;
        active = null;
        roomController(app)?.setRuntimeCollection(null);
        const manager = app.compositionManager;
        if (!record || !manager) return;
        record.restoreWrites?.();
        manager.preserveCabinetPositions = record.previousPreserve ?? false;
        if (record.policy && manager.freeLayoutPolicy === record.policy) manager.freeLayoutPolicy = record.previousPolicy ?? null;
        try {
            record.policy?.destroy?.();
        } catch  {}
        if (typeof record.previousDrag === 'boolean') manager.modules?.setDragEnabled(record.previousDrag);
        // A released composition keeps no modular cover policy (legacy preset/remove-all clear it too).
        if (clearCovers && ready() && manager.getActiveComposition().getCabinetCoverSettings?.() != null) {
            try {
                await manager.cabinetCoverCompositionAdapter?.resetForComposition?.(scope.compositionId, 'modular-collection-released');
            } catch  {}
        }
    }
    function transitionTo(target) {
        if (!switching && target === active) return Promise.resolve();
        const run = async ()=>{
            if (closed || target === active) return;
            if (busy || draft) throw fail('COMPOSITION_BUSY');
            switching = true;
            try {
                if (active) await deactivate({
                    clearCovers: true
                });
                if (target) await activate(target);
            } finally{
                switching = false;
                seen = null;
                announce();
            }
        };
        return transition = transition.then(run, run);
    }
    /** Pick the owner for an incoming command and (de)activate. 'add' keeps the current owner
     * (an empty composition is claimed by the added cabinet); 'replace' (preset/import) is owned
     * by the incoming cabinets. Resolves true when the command belongs to this runtime. */ async function prepare(kind, productTypes = []) {
        if (closed) throw fail('API_DESTROYED');
        const incoming = classifyCabinetTypes((productTypes ?? []).filter((type)=>getProductConfig(type)?.category === 'cabinets'), collections);
        if (!started) {
            // Nothing is owned before startup: only a modular command or composition waits for it, so a
            // stalled modular runtime never blocks Urban/Class/Mako commands (or the legacy queue).
            if (!starting || !ready() || incoming.status !== 'modular' && classify().status !== 'modular') return false;
            try {
                await starting;
            } catch  {
                return false;
            }
        }
        const current = classify();
        const target = current.status === 'unavailable' ? null : kind === 'replace' && incoming.status !== 'empty' ? incoming.collection : current.status === 'modular' ? current.collection : current.status === 'legacy' ? null : incoming.status === 'modular' ? incoming.collection : incoming.status === 'empty' ? active : null;
        // One composition, one collection: an owned composition rejects foreign cabinets.
        if (kind === 'add' && target && incoming.status !== 'empty' && incoming.collection !== target) throw fail('CATALOG_UNSUPPORTED');
        await transitionTo(target);
        return !!active;
    }
    async function reconcile() {
        if (closed || !started) return;
        const current = classify();
        const target = current.status === 'modular' ? current.collection : null;
        if (target !== active) await transitionTo(target);
        else if (active) {
            await observeLayout();
            await syncTandemTops();
        }
    }
    /**
     * Tandem tops follow a change made outside a drag (e.g. Thickness switched for the whole composition, Andriy 23.10:
     * thick -> thin left a Cabinet_Cover on the SB set apart): the groups are derived again from the rows (a thick top
     * takes the SB rows at its level, a thin one does not) and the tandem tops from the groups; when anything differs
     * from the scene, one commit puts it right. In step -> nothing is written (no loop).
     */ async function syncTandemTops() {
        if (closed || busy || draft || switching || recovery || !active || classify().status !== 'modular') return;
        let document;
        try {
            document = documentOf();
        } catch  {
            return;
        }
        // Only with two or more sink bases (a single SB never has a tandem top) and never twice for one scene state:
        // a commit another writer undid is not fought over.
        if (document.cabinets.filter(isSinkDocumentCabinet).length < 2 && !document.primarySources.some((s)=>isTandemCountertopProduct(s.payload?.config))) return;
        const before = tandemKey(document);
        if (before === lastTandemSync) return;
        if (usesColumns$1()) applyDocumentColumnRows(document, columnRowsOfDocument(document));
        else applyDocumentRows(document, layoutsToRows(document.localLayouts));
        reconcileTandemCountertops(document, {
            isSinkCabinet: isSinkCabinetWithDefaults,
            makeId: (productType)=>`${productType}-${uuid()}`
        });
        if (tandemKey(document) === before) return;
        lastTandemSync = before;
        await committed(document, {
            requestId: `tandem-sync-${uuid()}`
        }, 'tandem-sync');
        announce();
    }
    let lastTandemSync = null;
    /** What tandem sync compares: the sink bases' groups and every tandem top's group and config. */ const tandemKey = (document)=>canonicalKey({
            groups: document.cabinets.filter(isSinkDocumentCabinet).map((c)=>[
                    c.id,
                    c.selection?.SupportGroupId ?? 'group-1'
                ]),
            tandems: document.primarySources.filter((s)=>isTandemCountertopProduct(s.payload?.config)).map((s)=>[
                    s.payload.config.SupportGroupId ?? 'group-1',
                    s.payload.config
                ])
        });
    // Composition changes by any writer (restore, direct SceneManager calls, remove-all) are
    // re-evaluated once the runtime, its commands and public legacy commands are idle.
    const onFrame = ()=>{
        if (closed || !started || busy || draft || switching || holds || app._legacyLineWriteBarrier?.activeCount > 0) return;
        const composition = app.compositionManager?.getActiveComposition?.() ?? null;
        const key = composition ? `${composition.compositionId}|${composition.meta?.lastModified}|${composition.getProductCount?.()}` : '';
        if (seen && seen.composition === composition && seen.key === key) return;
        seen = {
            composition,
            key
        };
        reconcile().catch(()=>{
            seen = {
                composition,
                key
            }; /* retried on the next change or command */ 
        });
    };
    const nextFrame = ()=>new Promise((resolve)=>{
            wake = resolve;
            if (typeof app.once === 'function') app.once('update', ()=>resolve());
            else setTimeout(resolve, 50);
        });
    const held = async (action)=>{
        holds++;
        try {
            return await action();
        } finally{
            holds--;
            seen = null;
        }
    };
    /** Countertop-like products of a { products } map (or a document's primarySources), for the refusal log below:
     * id, type, role, group, length, offset, hosted sink, referenced cabinets. Plain data only. */ const describeTops = (products)=>Object.entries(products ?? {}).filter(([, c])=>c && (c.category === 'countertops' || 'CountertopRole' in c || /^(Top_Solid|Cabinet_Cover)/.test(String(c.productType ?? '')))).map(([id, c])=>({
                id,
                productType: c.productType ?? null,
                role: c.CountertopRole ?? null,
                generatedBy: c.generatedBy ?? null,
                group: c.SupportGroupId ?? null,
                lengthM: c.CountertopLengthM ?? null,
                offset: c.SpatialOffsetM ?? null,
                hostedSink: c[COUNTERTOP_SINK_TYPE_KEY] ?? null
            }));
    const describeSources = (document)=>(document?.primarySources ?? []).map((source)=>({
                id: source.id,
                productType: source.payload?.productType ?? null,
                role: source.payload?.config?.CountertopRole ?? null,
                group: source.payload?.config?.SupportGroupId ?? null,
                hostedSink: source.payload?.config?.[COUNTERTOP_SINK_TYPE_KEY] ?? null,
                cabinetReferences: [
                    ...source.cabinetReferences ?? []
                ]
            }));
    async function committed(document, request, kind, selectedCabinetId = null, sessionId = null) {
        const before = snapshot(), oldIds = new Set(Object.keys(before.products));
        let target = null;
        busy = true;
        try {
            // Tandem vanities: a sink base on its own row gets a clone of a thin basin top (tandem-countertops.mjs).
            reconcileTandemCountertops(document, {
                isSinkCabinet: isSinkCabinetWithDefaults,
                makeId: (productType)=>`${productType}-${uuid()}`
            });
            target = serialized(document);
            // Old local presets may predate policy persistence. Supply the
            // default before the rollback-capable import builds derived covers.
            if (app.compositionManager.cabinetCoverCompositionAdapter && target.features.cabinetCover == null) {
                target.features.cabinetCover = await scene.defaultCoverSettings();
            }
            const result = await scene.replace(target);
            if (result?.postCommitError) recovery = true;
            await observeLayout({
                authoritative: true
            }); // seed row widths; derive rows for a preset that had none
            revision++;
            let after;
            try {
                after = snapshot();
            } catch  {
                recovery = true;
                after = target;
            }
            fingerprint = canonicalKey({
                products: after.products,
                features: after.features,
                order: after.orderProductIds
            });
            const nextIds = Object.keys(after.products);
            return {
                requestId: request.requestId,
                sessionId,
                kind,
                compositionRevision: revision,
                addedProductIds: nextIds.filter((id)=>!oldIds.has(id)),
                removedProductIds: [
                    ...oldIds
                ].filter((id)=>!nextIds.includes(id)),
                updatedProductIds: nextIds.filter((id)=>oldIds.has(id)),
                selectedCabinetId
            };
        } catch (error) {
            if (error.rollbackError) recovery = true;
            // Diagnostics for a refused commit (e.g. CABINET_COVER_RESTORE_FAILED 'ambiguous-basin-top', 27.10): the tops
            // the scene had, the ones the committed document carried and the import target — to see where a second
            // basin top comes from. Logged on failure only.
            try {
                console.warn(`[cabinet-commit] refused ${kind}: ${error?.code ?? error?.message}`, {
                    diagnostics: error?.result?.diagnostics ?? null,
                    sceneTopsBefore: describeTops(before.products),
                    documentSources: describeSources(document),
                    documentCabinets: (document?.cabinets ?? []).map((c)=>({
                            id: c.id,
                            definitionId: c.definitionId,
                            x: c.positionM?.x ?? null,
                            group: c.selection?.SupportGroupId ?? null
                        })),
                    targetTops: describeTops(target?.products)
                });
            } catch  {}
            throw withDiagnosticReasons(error);
        } finally{
            busy = false;
        }
    }
    /**
     * Carries the diagnostics of a refused restore (CABINET_COVER_RESTORE_FAILED keeps them in error.result) to
     * the UI as error.reasons, which the bridge failure() sends instead of the bare code. The error code stays.
     * { code: 'CABINET_COVER_RESTORE_FAILED', result: { diagnostics: [{ code: 'unsupported-cover-profile-source',
     *   sourceIds: ['UD-open-shelves-1'], details: { productType: 'UD-open-shelves' } }] } }
     *   → reasons: [reason('unsupported-cover-profile-source', [], { productType: 'UD-open-shelves', productId: 'UD-open-shelves-1' })]
     */ function withDiagnosticReasons(error) {
        const diagnostics = error?.result?.diagnostics;
        // Reasons already set (e.g. PRESET_MISSING_CABINET_COLOR) or nothing to carry: leave the error as it is.
        if (!error || error.reasons || !Array.isArray(diagnostics)) return error;
        error.reasons = diagnostics.map((diagnostic)=>{
            const params = {};
            const productType = diagnostic?.details?.productType;
            const productId = diagnostic?.details?.productId ?? diagnostic?.sourceIds?.[0];
            if (productType) params.productType = productType;
            if (productId) params.productId = productId;
            // Several sources (e.g. 'ambiguous-basin-top': every basin top candidate): all of them, not only the first.
            if ((diagnostic?.sourceIds?.length ?? 0) > 1) params.sourceIds = [
                ...diagnostic.sourceIds
            ];
            if (Array.isArray(diagnostic?.details?.candidates)) params.candidates = cloneData(diagnostic.details.candidates);
            return reason(String(diagnostic?.code ?? error.code), [], params);
        });
        return error;
    }
    function resolvePlacement(placement, request) {
        if (placement?.kind === 'free') {
            if (placement.frameId !== frame.id || !isFiniteVec3(placement.positionM)) throw fail('INVALID_PLACEMENT');
            return cloneData(placement.positionM);
        }
        const option = options.get(placement?.optionId);
        if (!option || option.revision !== revision || option.key !== canonicalKey({
            definitionId: request.definitionId,
            selection: request.selection
        })) throw fail('STALE_OPTION');
        return cloneData(option.positionM);
    }
    async function placementOptions(request) {
        if (busy) throw fail('COMPOSITION_BUSY');
        const runtime = choice(request), stamp = dependencies();
        const handle = await scene.makePreview(runtime.productType, runtime.config);
        try {
            // The draft's box relative to its pivot, measured on a throw-away probe preview.
            const draftBox = relativeBox(meshBoxOf(handle.entity), handle.entity.getPosition());
            const document = documentOf(), all = document.cabinets;
            if (request.anchorCabinetId && !all.some((c)=>c.id === request.anchorCabinetId)) throw fail('UNKNOWN_CABINET');
            const cabinets = all.map((c)=>{
                const root = app.root.findByName(c.id), p = root.getPosition();
                return {
                    id: c.id,
                    box: meshBoxOf(root),
                    pivotM: {
                        x: p.x,
                        y: p.y,
                        z: p.z
                    }
                };
            });
            let floor = null;
            try {
                floor = measureFloorColliderBox(app);
            } catch  {
                floor = null;
            }
            // Columns: the slots of the document's column rows — the rows serialized() saves the Add into (config boxes,
            // no scene measurement); slot poses and collisions stay on the mesh boxes of `cabinets`.
            const columnRows = usesColumns$1() ? columnRowsOfDocument(document) : null;
            const slots = planPlacementSlots({
                cabinets,
                draft: {
                    relativeBox: draftBox
                },
                obstacles: floor ? [
                    {
                        id: FLOOR_COLLIDER_ID,
                        box: floor
                    }
                ] : [],
                columnRows
            });
            const rows = (cabinets.length ? slots : []).filter((slot)=>!request.anchorCabinetId || slot.anchorCabinetId === request.anchorCabinetId).map((slot)=>({
                    kind: slot.kind,
                    anchorCabinetId: slot.anchorCabinetId ?? null,
                    positionM: cloneData(slot.positionM),
                    availability: slot.availability ?? 'available',
                    reasons: cloneData(slot.reasons ?? []),
                    rowId: slot.rowId ?? null,
                    rowCabinetIds: [
                        ...slot.rowCabinetIds ?? []
                    ],
                    slotId: slot.id
                }));
            if (!cabinets.length) rows.push({
                kind: 'seed',
                anchorCabinetId: null,
                positionM: {
                    x: 0,
                    y: 0,
                    z: 0
                },
                availability: 'available',
                reasons: []
            });
            if (canonicalKey(stamp) !== canonicalKey(dependencies())) throw fail('STALE_DEPENDENCIES');
            return rows.map((row)=>{
                const option = {
                    ...row,
                    id: uuid(),
                    mode: 'standard',
                    frameId: frame.id,
                    surfaceId: row.kind,
                    impact: impact(),
                    dependencies: stamp
                };
                options.set(option.id, {
                    ...option,
                    revision,
                    key: canonicalKey({
                        definitionId: request.definitionId,
                        selection: request.selection
                    })
                });
                return option;
            });
        } finally{
            await handle.dispose();
        }
    }
    async function begin(request, kind) {
        assertIdle();
        if (typeof request.sessionId !== 'string' || !request.sessionId || sessions.has(request.sessionId)) throw fail('SESSION_ID_REUSED');
        // The request's revision was checked on entry. Claiming an empty composition below writes the
        // collection's cover policy, a change made by this very command: re-checks compare against it.
        let expected = request;
        if (kind === 'add') {
            // DnD Add may seed an empty composition: the dragged cabinet's collection claims it.
            const claims = !active;
            if (!await prepare('add', [
                request.definitionId
            ])) throw fail('CATALOG_UNSUPPORTED');
            assertIdle();
            if (claims) expected = {
                ...request,
                expectedCompositionRevision: dependencies().compositionRevision
            };
        }
        const existing = kind === 'move' ? documentOf().cabinets.find((c)=>c.id === request.productId) : null;
        if (kind === 'move' && !existing) throw fail('UNKNOWN_CABINET');
        // The draft is a cabinet: no countertop keys in its preview or its committed selection (withoutCountertopKeys).
        // `selected` itself stays as asked: an option placement is matched on the request's own selection.
        const selected = existing ?? request, clean = {
            ...selected,
            selection: withoutCountertopKeys(selected.selection)
        };
        const runtime = choice(clean);
        let placement = existing ? {
            kind: 'free',
            frameId: frame.id,
            positionM: existing.positionM
        } : request.initialPlacement;
        if (!placement) {
            const choices = await placementOptions(request);
            assertIdle();
            checkCommand(expected);
            const preferCabinetId = app.selectTool?.getSelected?.()?.[0]?.name ?? request.anchorCabinetId ?? null;
            const picked = choices.some((c)=>c.kind === 'seed') ? choices[0] : pickDefaultSlot(choices, {
                preferCabinetId
            }) ?? choices[0];
            if (!picked) throw fail('INVALID_PLACEMENT');
            placement = {
                kind: 'option',
                optionId: picked.id
            };
        }
        const p = resolvePlacement(placement, selected);
        const record = {
            handle: null,
            cancelled: false,
            state: {
                sessionId: request.sessionId,
                kind,
                lifecycle: 'loading-draft',
                baseCompositionRevision: revision,
                candidateRevision: 0,
                candidate: {
                    definitionId: selected.definitionId,
                    selection: cloneData(clean.selection),
                    productId: existing?.id ?? null,
                    placement: {
                        kind: 'free',
                        frameId: frame.id,
                        positionM: p
                    },
                    effectivePlacement: {
                        mode: 'remote',
                        frameId: frame.id,
                        positionM: p
                    }
                },
                validation: {
                    status: 'pending',
                    reasons: [],
                    requiredDecisionIds: [],
                    validatedDependencies: null,
                    candidateRevision: 0
                },
                collision: {
                    status: 'unknown',
                    collidesWith: []
                },
                impact: impact()
            }
        };
        draft = record;
        sessions.set(request.sessionId, record);
        emitDraft(record);
        try {
            record.loading = scene.makePreview(runtime.productType, runtime.config, {
                productId: existing?.id
            });
            record.handle = await record.loading;
            if (record.cancelled || closed) {
                await disposeDraft(record);
                throw fail('CANCELLED');
            }
            record.handle.entity.setPosition(p.x, p.y, p.z);
            record.state.lifecycle = 'preview';
            measureDraftBodies(record);
            record.state.validation = {
                ...record.state.validation,
                validatedDependencies: dependencies()
            };
            evaluateDraft(record);
            showSplitPreview(record, record.state.candidate.effectivePlacement.positionM);
            emitDraft(record);
            return draftState(record);
        } catch (error) {
            if (draft === record) draft = null;
            // A preview built before the failure never outlives the session (a move's source reappears).
            if (record.handle && !record.handleDisposed) {
                try {
                    await disposeDraft(record);
                } catch  {
                    recovery = true;
                }
            }
            record.state.lifecycle = record.cancelled ? 'cancelled' : 'error';
            emitDraft(record);
            throw error;
        }
    }
    const beginHeld = (request, kind)=>held(()=>begin(request, kind));
    const sourceAdapter = createPortableBasinTopAdapter({
        canBuildTop: (type)=>!!getProductConfig(type) && type !== 'Cabinet_Cover'
    });
    const sourceAdapters = {
        'runtime-product': sourceAdapter
    };
    const defaultsOf = (type)=>getProductConfig(type)?.defaultConfig ?? {};
    async function exportExact(request, defaultAnchor = false) {
        assertIdle();
        await scene.settle();
        assertIdle();
        const document = documentOf();
        let anchorCabinetId = request.anchorCabinetId;
        if (anchorCabinetId == null && defaultAnchor) {
            const lowest = [
                ...document.cabinets
            ].sort((a, b)=>a.positionM.y - b.positionM.y || a.positionM.x - b.positionM.x)[0];
            anchorCabinetId = lowest?.id;
        }
        // SupportGroupId of a cabinet is derived from its row (import re-derives it for the new row ids).
        return captureExactPreset({
            document,
            anchorCabinetId,
            catalog,
            sourceAdapters,
            isPortableChoice: (c)=>catalog.resolveChoice(c).status === 'valid',
            serializeChoice: (c)=>{
                const selection = {
                    ...c.selection
                };
                delete selection.SupportGroupId;
                return {
                    definitionId: c.definitionId,
                    selection
                };
            }
        });
    }
    /**
     * A rows-level preset (ulh-compact-v1, urban-compact-v2) -> the exact preset importExact loads.
     * The owning collection is the preset's `collection`, else the collection of its first cabinet type.
     * Example: expandRowsPreset(DEFAULT_PRESET_FORMATS.get('ulh-compact-v1'),
     *   { rows: [{ products: [{ name: 'ULH-side-cabinet', Width: 60 }] }] }) -> { presetSchemaVersion: 2, presetLayout: { layoutMode: 'exact', ... }, ... }
     * Throws PRESET_COLLECTION_UNSUPPORTED, PRESET_MISSING_CABINET_COLOR, or what format.expand throws (PRESET_INVALID, ...).
     */ async function expandRowsPreset(format, preset) {
        // 1. Owner: no collection in a hand-written preset, so the collection of its first cabinet type owns it.
        const firstType = preset?.rows?.[0]?.products?.[0]?.name;
        const id = preset?.collection ?? findModularCollection(firstType, collections)?.id ?? null;
        const owner = collections.find((c)=>c.id === id);
        if (!owner) throw fail('PRESET_COLLECTION_UNSUPPORTED');
        // 2. Expand in the owner's terms.
        const exact = format.expand(preset, {
            collection: collectionDescriptor(owner),
            defaultsOf,
            // The preset's collection, not the active one (it becomes active only in importExact): no tier there = none.
            tierHeightM: owner.pack?.geometry?.tierHeightM ?? null,
            categoryOf: (type)=>getProductConfig(type)?.category,
            // A real sink cabinet (sinkMount), not a side cabinet the UI copied sinkType onto.
            isSinkCabinet: (selection, definitionId)=>isSinkCabinet({
                    ...selection,
                    productType: definitionId
                }),
            // Mirror CompositionManager's basin-top creation: without these the top falls back to LEGACY positioning.
            topDefaults: (sinkSelection, selections)=>({
                    CountertopPositioning: resolveCountertopPositioningProfile({
                        cabinets: selections,
                        getProductConfig
                    }).strategy,
                    CountertopPlacement: COUNTERTOP_PLACEMENT.SUPPORTED,
                    CountertopRole: 'basinTop',
                    ...Number.isFinite(sinkSelection?.Height) ? {
                        Height: sinkSelection.Height
                    } : {},
                    ...Number.isFinite(sinkSelection?.Depth) ? {
                        Depth: sinkSelection.Depth
                    } : {}
                })
        });
        // 3. Covers take their material from CabinetColor: without it the cover plan is unsupported and the
        // whole import rolls back as CABINET_COVER_RESTORE_FAILED. Refuse up front with a clear reason.
        const covers = exact.presetLayout.featureSettings?.cabinetCover ?? await scene.defaultCoverSettings();
        const uncolored = covers && covers.enabled !== false ? exact.presetProducts.filter((p)=>typeof p.selection?.CabinetColor !== 'string' || !p.selection.CabinetColor.trim()) : [];
        if (uncolored.length) throw Object.assign(fail('PRESET_MISSING_CABINET_COLOR'), {
            reasons: [
                {
                    code: 'PRESET_MISSING_CABINET_COLOR',
                    messageKey: 'cabinet.preset_missing_cabinet_color',
                    params: {
                        field: 'CabinetColor',
                        products: uncolored.map((p)=>p.definitionId)
                    },
                    affectedProductIds: [],
                    decisionIds: []
                }
            ]
        });
        return exact;
    }
    /** The registered format of a preset document, or null when no format claims it (two claiming still throws). */ function formatOfDocument(preset) {
        try {
            return DEFAULT_PRESET_FORMATS.resolve(preset);
        } catch (error) {
            if (error.code === 'PRESET_FORMAT_UNKNOWN') return null;
            throw error;
        }
    }
    /**
     * composition.importPreset: one entry for every registered format.
     * Example: importAnyPreset(request) with request.preset = { format: 'urban-compact-v2', rows: [...] } -> receipt of importExact.
     */ async function importAnyPreset(request) {
        const format = formatOfDocument(request.preset);
        // 1. No format claims it: the exact loader, as before, reports what is wrong (PRESET_INVALID_DOCUMENT, ...).
        if (!format) return importExact(request, request.preset);
        // 2. A product list has no positions or rows: it is loaded through presetProducts, not here.
        if (format.level === PRESET_LEVELS.LIST) throw fail('PRESET_LEVEL_NOT_IMPORTABLE');
        // 3. Rows are expanded to an exact preset first; an exact preset loads as is.
        if (format.level === PRESET_LEVELS.ROWS) return importExact(request, await expandRowsPreset(format, request.preset));
        return importExact(request, request.preset);
    }
    /**
     * composition.exportPreset: exact by default; request.format picks a registered format.
     * Example: exportAnyPreset({ ...scope, format: 'urban-compact-v2' }) -> { format: 'urban-compact-v2', rows: [...] }.
     */ async function exportAnyPreset(request) {
        // 1. No format asked: the exact preset, as before.
        if (request.format == null) return exportExact(request);
        const format = DEFAULT_PRESET_FORMATS.get(request.format);
        // 2. A product list cannot carry the scene back.
        if (format.level === PRESET_LEVELS.LIST) throw fail('PRESET_FORMAT_NOT_EXPORTABLE');
        // 3. Rows: the exact preset minus defaults/positions; anchor defaults to the lowest-leftmost cabinet.
        if (format.level === PRESET_LEVELS.ROWS) return format.compact(await exportExact(request, true), {
            defaultsOf,
            tierHeightM: tierHeightM()
        });
        return exportExact(request);
    }
    async function importExact(request, preset) {
        assertIdle();
        // A preset replaces the composition: its cabinets' collection owns the result.
        await prepare('replace', Array.isArray(preset?.presetProducts) ? preset.presetProducts.map((p)=>p?.definitionId) : []);
        assertIdle();
        const converted = instantiateExactPreset({
            preset,
            targetDocument: documentOf(),
            catalog,
            sourceAdapters,
            isPortableChoice: (c)=>catalog.resolveChoice(c).status === 'valid',
            anchorPositionM: request.anchorPositionM,
            makeId: (kind, key)=>`${kind === 'cabinet' ? preset.presetProducts.find((p)=>p.key === key)?.definitionId : kind === 'source' ? preset.presetLayout.primarySources.find((p)=>p.key === key)?.payload.productType : kind}-${uuid()}`
        });
        // Rows arrive as localLayouts (ids remapped, anchors translated); groups follow the new row ids,
        // the basin top's row first (seedBasinTopGroups).
        seedBasinTopGroups(converted.document);
        if (usesColumns$1()) applyDocumentColumnRows(converted.document, columnRowsOfDocument(converted.document));
        else applyDocumentRows(converted.document, layoutsToRows(converted.document.localLayouts));
        const receipt = await committed(converted.document, request, 'preset');
        announce();
        return {
            ...receipt,
            keyToProductId: converted.keyToProductId
        };
    }
    const service = {
        scope,
        getCompositionState: state,
        getCabinetsState: view,
        getCatalog: ()=>listProductTypes().flatMap((definitionId)=>{
                const owner = findModularCollection(definitionId, collections);
                return owner && (!active || owner === active) && getProductConfig(definitionId)?.category === 'cabinets' ? [
                    {
                        definitionId,
                        collectionId: owner.id,
                        roleId: 'cabinet',
                        label: definitionId,
                        availability: 'available',
                        reasons: []
                    }
                ] : [];
            }),
        getConfigurationOptions: (request)=>{
            const { config } = choice(request);
            return {
                definitionId: request.definitionId,
                selection: cloneData(request.selection ?? {}),
                completeness: 'complete',
                reasons: [],
                fields: Object.entries(config).filter(([, value])=>[
                        'string',
                        'number',
                        'boolean'
                    ].includes(typeof value)).map(([key, value])=>({
                        key,
                        label: key,
                        unit: [
                            'Width',
                            'Height',
                            'Depth'
                        ].includes(key) ? 'cm' : null,
                        required: false,
                        values: [
                            {
                                value,
                                availability: 'available',
                                reasons: []
                            }
                        ]
                    }))
            };
        },
        getPlacementOptions: placementOptions,
        select (_scope, id) {
            assertIdle();
            if (id !== null && !documentOf().cabinets.some((c)=>c.id === id)) throw fail('UNKNOWN_CABINET');
            app.selectTool?.setSelectedByName(id ? [
                id
            ] : [], {
                mode: 'replace'
            });
            return {
                selectedCabinetId: id
            };
        },
        beginAdd: (request)=>remember('beginAdd', request, ()=>beginHeld(request, 'add')),
        beginMove: (request)=>remember('beginMove', request, ()=>beginHeld(request, 'move')),
        async updateDraft (request) {
            const record = sessions.get(request.sessionId);
            if (!record || record !== draft || busy || record.cancelled || record.state.lifecycle !== 'preview') throw fail('SESSION_BUSY');
            if (request.expectedCandidateRevision !== record.state.candidateRevision) throw fail('STALE_CANDIDATE');
            if (request.selectionPatch !== undefined) throw fail('UNSUPPORTED_OPERATION');
            const p = resolvePlacement(request.placement, record.state.candidate);
            // The preview still stands at the previous effective pose: its box is measured again there.
            refreshDraftSelf(record);
            // Columns (HR-RW-10): a cabinet within 3 cm of a free column slot, a row end at the plane or the floor
            // lands exactly there. `placement` keeps the raw pointer pose (the drag adapter reads it back),
            // `effectivePlacement` is what the preview shows, the validator checks and apply commits.
            // P210: a sink base reaching the sink the top hosts lands right under it.
            const effective = snappedUnderHostedSink(record, snappedIntoColumn(record, p) ?? p);
            record.handle.entity.setPosition(effective.x, effective.y, effective.z);
            showLandingPreview(record, !!hostedTrapUnderDraft(record, effective));
            showCarriedTop(record, effective);
            showSplitPreview(record, effective);
            record.state.candidate.placement = {
                kind: 'free',
                frameId: frame.id,
                positionM: p
            };
            record.state.candidate.effectivePlacement = {
                mode: 'remote',
                frameId: frame.id,
                positionM: effective
            };
            record.state.candidateRevision++;
            evaluateDraft(record);
            emitDraft(record);
            return draftState(record);
        },
        getPlacementState (_scope, sessionId) {
            const record = sessions.get(sessionId);
            if (!record) throw fail('SESSION_NOT_FOUND');
            return draftState(record);
        },
        async settleInput (_scope, sessionId) {
            const record = sessions.get(sessionId);
            if (!record) throw fail('SESSION_NOT_FOUND');
            if (record === draft) await input?.settle();
            return draftState(record);
        },
        apply: (request)=>remember('apply', request, async ()=>{
                const record = sessions.get(request.sessionId);
                if (!record || record !== draft || busy || record.state.lifecycle !== 'preview') throw fail('SESSION_BUSY');
                await input?.stop();
                if (record !== draft || busy || record.cancelled || record.state.lifecycle !== 'preview') throw fail('SESSION_BUSY');
                if (request.expectedCandidateRevision !== record.state.candidateRevision) throw fail('STALE_CANDIDATE');
                if (record.state.baseCompositionRevision !== dependencies().compositionRevision) throw fail('STALE_COMPOSITION');
                // A colliding draft is shown red and cannot be applied (move it clear first).
                if (record.state.validation.status !== 'valid') {
                    throw Object.assign(fail('PLACEMENT_COLLISION'), {
                        reasons: cloneData(record.state.validation.reasons)
                    });
                }
                const saved = snapshot(), d = documentOf(saved), candidate = record.state.candidate;
                const id = candidate.productId ?? `${candidate.definitionId}-${uuid()}`;
                const cabinet = {
                    id,
                    definitionId: candidate.definitionId,
                    selection: candidate.selection,
                    roleId: 'cabinet',
                    placementMode: 'remote',
                    frameId: frame.id,
                    positionM: candidate.effectivePlacement.positionM
                };
                const originalM = d.cabinets.find((c)=>c.id === id)?.positionM ?? null;
                if (candidate.productId) d.cabinets = d.cabinets.map((c)=>c.id === id ? cabinet : c);
                else d.cabinets.push(cabinet);
                d.connections = d.connections.filter((c)=>c.a.cabinetId !== id && c.b.cabinetId !== id);
                // Unmeasurable scene: keep the free drop and take a moved cabinet out of its old row; the
                // layout policy adopts it into a row later without moving it.
                try {
                    arrangeDrop(d, saved, id, record.handle.entity, candidate.productId ? originalM : null);
                } catch  {
                    d.localLayouts = d.localLayouts.map((layout)=>({
                            ...layout,
                            orderedCabinetIds: layout.orderedCabinetIds.filter((member)=>member !== id)
                        })).filter((layout)=>layout.orderedCabinetIds.length);
                }
                // P210: an SB right under the sink the top hosts takes it — one sink, one cut-out (the draft validated the pose).
                if (hostedTrapUnderDraft(record, d.cabinets.find((c)=>c.id === id)?.positionM)) Object.assign(d, landSinkDocument(d, id, {
                    getProductConfig,
                    uuid
                }).document);
                record.carry?.commit(d.primarySources.filter(isCountertopSource), d.cabinets.find((c)=>c.id === id)?.positionM);
                record.carry?.hide();
                record.join?.hide();
                record.split?.hide();
                record.state.lifecycle = 'applying';
                emitDraft(record);
                try {
                    const receipt = await committed(d, request, record.state.kind, id, request.sessionId);
                    // Source is committed. Cleanup failure must not invite replaying the mutation.
                    try {
                        await disposeDraft(record);
                    } catch  {
                        recovery = true;
                    }
                    draft = null;
                    record.state.lifecycle = 'committed';
                    emitDraft(record);
                    announce();
                    emit('placementAction', {
                        status: 'committed',
                        sessionId: request.sessionId,
                        receipt
                    });
                    return receipt;
                } catch (error) {
                    record.state.lifecycle = 'preview';
                    showCarriedTop(record, candidate.effectivePlacement.positionM);
                    showSplitPreview(record, candidate.effectivePlacement.positionM);
                    emitDraft(record);
                    throw error;
                }
            }),
        async cancel (_scope, sessionId) {
            const record = sessions.get(sessionId);
            if (!record) throw fail('SESSION_NOT_FOUND');
            if (busy || record !== draft) return draftState(record);
            record.cancelled = true;
            await input?.stop();
            try {
                await record.loading;
            } catch  {}
            await disposeDraft(record);
            draft = null;
            seen = null;
            record.state.lifecycle = 'cancelled';
            emitDraft(record);
            emit('placementAction', {
                status: 'cancelled',
                sessionId
            });
            return draftState(record);
        },
        exportPreset: (request)=>exportAnyPreset(request),
        // Compact (ulh-compact-v1) = exact preset minus defaults/positions; anchor defaults to the lowest-leftmost cabinet.
        async exportCompactPreset (request) {
            const exact = await exportExact(request, true);
            return compactFromExactPreset(exact, {
                defaultsOf,
                tierHeightM: tierHeightM()
            });
        },
        importPreset: (request)=>remember('importPreset', request, ()=>held(()=>importAnyPreset(request))),
        // HR-CT-01: the UI commits a pending 'sink-landing' (fits): one committed() swaps SB <-> SC with new ids.
        moveSink: (request)=>remember('moveSink', request, ()=>held(async ()=>{
                    assertIdle();
                    if (typeof request.fromCabinetId !== 'string' || typeof request.toCabinetId !== 'string') throw fail('INVALID_INPUT');
                    const { document, idMap, sinkHostId } = moveSinkDocument(documentOf(), request.fromCabinetId, request.toCabinetId, {
                        getProductConfig,
                        uuid
                    });
                    const receipt = await committed(document, request, 'moveSink', sinkHostId);
                    app.selectTool?.setSelectedByName([
                        sinkHostId
                    ], {
                        mode: 'replace'
                    });
                    announce();
                    return {
                        ...receipt,
                        idMap,
                        sinkHostId
                    };
                })),
        // HR-CT-02: a lifted top takes the sink off its SB (SB -> SC, the top hosts it); the selection follows a selected SB.
        liftSink: (request)=>remember('liftSink', request, ()=>held(async ()=>{
                    assertIdle();
                    if (typeof request.fromCabinetId !== 'string' || !isFiniteVec3(request.sinkLocalM)) throw fail('INVALID_INPUT');
                    const { document, idMap, sideCabinetId } = liftSinkDocument(documentOf(), request.fromCabinetId, request.sinkLocalM, {
                        getProductConfig,
                        uuid
                    });
                    const before = app.selectTool?.getSelected?.()?.[0]?.name ?? null, selected = idMap[before] ?? before;
                    const receipt = await committed(document, request, 'liftSink', selected);
                    if (before === request.fromCabinetId) app.selectTool?.setSelectedByName([
                        sideCabinetId
                    ], {
                        mode: 'replace'
                    });
                    announce();
                    return {
                        ...receipt,
                        idMap,
                        sideCabinetId
                    };
                })),
        // HR-CT-02: the hosting top lands over a side cabinet (SC -> SB); selects the new SB.
        landSink: (request)=>remember('landSink', request, ()=>held(async ()=>{
                    assertIdle();
                    if (typeof request.toCabinetId !== 'string') throw fail('INVALID_INPUT');
                    const current = documentOf(), to = current.cabinets.find((c)=>c.id === request.toCabinetId);
                    // Public contract: the UI lands a hosted sink on an SC; an SB takes it only by a drop (apply, P210).
                    if (to && sinkPairOf(to.definitionId)?.sinkBase === to.definitionId) throw fail('ALREADY_SINK_BASE');
                    const { document, idMap, sinkHostId } = landSinkDocument(current, request.toCabinetId, {
                        getProductConfig,
                        uuid
                    });
                    const receipt = await committed(document, request, 'landSink', sinkHostId);
                    app.selectTool?.setSelectedByName([
                        sinkHostId
                    ], {
                        mode: 'replace'
                    });
                    announce();
                    return {
                        ...receipt,
                        idMap,
                        sinkHostId
                    };
                })),
        // Deprecated: use importPreset; kept for the UI and dev-panel callers.
        importCompactPreset: (request)=>remember('importCompactPreset', request, ()=>held(async ()=>{
                    const format = formatOfDocument(request.preset);
                    // Only rows-level documents: anything else is not a compact preset.
                    if (format?.level !== PRESET_LEVELS.ROWS) throw fail('PRESET_INVALID');
                    return importExact(request, await expandRowsPreset(format, request.preset));
                })),
        getCommandResult (_scope, id) {
            const entry = journal.get(id);
            return entry ? {
                status: entry.status,
                ...entry.result ? {
                    result: entry.result
                } : {},
                ...entry.error ? {
                    error: entry.error
                } : {}
            } : {
                status: 'unknown'
            };
        },
        on (event, callback, { emitCurrent = false } = {}) {
            if (!listeners.has(event)) listeners.set(event, new Set());
            listeners.get(event).add(callback);
            if (emitCurrent) emit(event, event === 'placementChange' ? draft ? draftState(draft) : null : event === 'compositionChange' ? state() : view());
            return ()=>listeners.get(event).delete(callback);
        }
    };
    const facade = createCabinetFacades({
        service,
        scope,
        collectionId: null,
        buildId: 'cabinet-local-v1',
        enabled: true,
        inputEnabled: true,
        readDependencies: dependencies,
        getReadiness: readiness
    });
    // Constructed side-effect free; it touches the scene/DOM only after start() (see ensureInput).
    overlay = createOverlay?.({
        app,
        api: facade.api,
        preview,
        uuid
    }) ?? null;
    // Capabilities name the owning collection; 'unsupported' means "not a modular composition".
    const api = Object.freeze({
        ...facade.api,
        cabinets: Object.freeze({
            ...facade.api.cabinets,
            async getCapabilities () {
                const result = await facade.api.cabinets.getCapabilities();
                if (result?.ok) {
                    result.data.collectionId = active?.id ?? null;
                    if (result.data.readiness === 'unsupported') result.data.reasons = [
                        reason('NOT_MODULAR_COMPOSITION')
                    ];
                }
                return result;
            }
        }),
        ...overlay?.api ? {
            placementOverlay: overlay.api
        } : {}
    });
    const legacyWrite = async (action)=>{
        assertIdle();
        const before = snapshot();
        busy = true;
        try {
            const result = await action();
            await observeLayout();
            await ensureCoverSettings(before.features?.cabinetCover);
            await scene.settle();
            // Validate before reporting success, while rollback is still available.
            snapshot();
            return result;
        } catch (error) {
            try {
                const restored = await scene.replace(before);
                if (restored?.postCommitError) recovery = true;
            } catch (rollbackError) {
                recovery = true;
                error.rollbackError = rollbackError;
            }
            throw error;
        } finally{
            busy = false;
            seen = null;
            syncRevision();
            announce();
        }
    };
    const compatibility = {
        /** True only while a modular collection owns the composition (routing of addProduct/presetProducts). */ get active () {
            return !closed && !!active;
        },
        /** Called by product.plugin before routing: (de)activates for the incoming product types.
         * kind: 'add' | 'replace'. Rejects CATALOG_UNSUPPORTED for a foreign cabinet on an owned composition. */ prepare: (kind, productTypes)=>prepare(kind, productTypes),
        addProduct: (type, config = {})=>held(async ()=>{
                if (!await prepare('add', [
                    type
                ])) throw fail('CATALOG_UNSUPPORTED');
                choice({
                    definitionId: type,
                    selection: config
                });
                return legacyWrite(async ()=>{
                    const id = await scene.add(type, config);
                    if (!id) throw fail('ADD_FAILED');
                    return id;
                });
            }),
        presetProducts: (products, globalConfig = {})=>held(async ()=>{
                if (!await prepare('replace', (products ?? []).map((item)=>item?.name))) throw fail('CATALOG_UNSUPPORTED');
                assertIdle();
                products.forEach(({ name, ...config })=>choice({
                        definitionId: name,
                        selection: {
                            ...globalConfig,
                            ...config
                        }
                    }));
                return legacyWrite(async ()=>{
                    const ids = await scene.preset(products, globalConfig);
                    if (ids?.length !== products.length) throw fail('PRESET_INCOMPLETE');
                    return ids;
                });
            })
    };
    return {
        api,
        compatibility,
        assertIdle,
        assertWritable,
        get activeCollectionId () {
            return active?.id ?? null;
        },
        start () {
            return starting ?? (starting = (async ()=>{
                // Script.initialize order is not guaranteed. Construct scene ports only
                // after the synchronous initialization pass, not during bridge exposure.
                await null;
                // The 'cabinets' composition and SceneManager may come from a later script: wait, never fail.
                for(;;){
                    if (closed) throw fail('API_DESTROYED');
                    if (ready()) {
                        try {
                            scene ?? (scene = createScene?.());
                        } catch (error) {
                            if (![
                                'INVALID_APPLICATION',
                                'ULH_LOCAL_SCENE_NOT_READY'
                            ].includes(error?.code)) throw error;
                        }
                        if (scene) break;
                        if (!createScene) throw fail('NOT_READY');
                    }
                    await nextFrame();
                }
                input = createInput?.({
                    app,
                    api: facade.api,
                    preview,
                    readFrame: ()=>frame,
                    readSpatialProfile: ()=>createSCLineSpatialProfile(),
                    readBodies: ()=>{
                        const bodies = documentOf().cabinets.filter((c)=>c.id !== draft?.state.candidate.productId).map((c)=>({
                                id: c.id,
                                entity: app.root.findByName(c.id),
                                tags: [
                                    'cabinet'
                                ]
                            }));
                        // The room floor: the dragged cabinet's bottom snaps onto its top (rule rest-on-floor).
                        const floor = app.root.findByName(ROOM_FLOOR_NAME);
                        return floor?.enabled ? [
                            ...bodies,
                            {
                                id: FLOOR_COLLIDER_ID,
                                entity: floor,
                                tags: [
                                    'floor'
                                ]
                            }
                        ] : bodies;
                    }
                });
                started = true;
                app.on?.('update', onFrame);
                // An already modular composition is claimed now; a failed claim is retried by commands.
                await reconcile().catch(()=>{});
                if (closed) throw fail('API_DESTROYED');
                ensureInput();
                return {
                    status: 'ready',
                    ...scope
                };
            })().catch((error)=>{
                if (!closed) recovery = true;
                throw error;
            }));
        },
        async destroy () {
            closed = true;
            wake?.();
            if (draft) draft.cancelled = true;
            app.off?.('update', onFrame);
            try {
                await starting;
            } catch  {}
            await transition.catch(()=>{});
            await input?.destroy();
            try {
                await overlay?.destroy();
            } catch  {}
            await Promise.allSettled([
                ...journal.values()
            ].map((entry)=>entry.promise));
            if (draft) {
                try {
                    await draft.loading;
                } catch  {}
                await disposeDraft(draft);
            }
            await deactivate({
                clearCovers: false
            });
            facade.destroy();
            listeners.clear();
        }
    };
}

export { createCabinetLocalRuntime, landSinkDocument, liftSinkDocument, moveSinkDocument, seedBasinTopGroups, withoutCountertopKeys };
