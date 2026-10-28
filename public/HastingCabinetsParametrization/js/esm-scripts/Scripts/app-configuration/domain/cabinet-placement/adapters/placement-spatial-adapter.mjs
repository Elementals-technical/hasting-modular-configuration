import { cloneData, canonicalKey, isFiniteVec3 } from '../cabinet-contracts.mjs';
import { CompositionStore } from '../../composition/composition-store.mjs';
import { createCompositionWriteGuard } from '../../composition/operations/composition-write-guard.mjs';
import { operationError } from '../../composition/operations/composition-operation-coordinator.mjs';

const detach = (entity)=>entity.parent?.removeChild(entity);
const synchronous = (result)=>{
    if (result?.then) throw operationError('ASYNC_PUBLICATION_NOT_ALLOWED');
};
const reject = (prefix, result)=>{
    throw Object.assign(operationError(prefix + '_' + String(result?.status ?? 'pending').toUpperCase()), {
        reasons: cloneData(result?.reasons ?? result?.diagnostics ?? [])
    });
};
const toWorld = (frame, p)=>{
    if (!frame || !isFiniteVec3(p)) throw operationError('INVALID_FRAME');
    const result = Object.fromEntries([
        'x',
        'y',
        'z'
    ].map((axis)=>[
            axis,
            frame.originM[axis] + frame.xAxis[axis] * p.x + frame.yAxis[axis] * p.y + frame.zAxis[axis] * p.z
        ]));
    if (!isFiniteVec3(result)) throw operationError('INVALID_POSITION');
    return result;
};
/** Owns only roots it creates/adopts, never global scene enumeration. Actual geometry,
 * isolated product rules and primary-source mapping remain explicit project ports.
 * validateProspective must include complete measured geometry, T9 derived planning and
 * collision/policy validation; status:valid is not a substitute for missing evidence.
 */ function createCabinetSceneAdapter({ scope, coordinator, root, factory, catalog, codec, collectionId = 'ULH', readSource, publishSource, configure, validateProspective, whenGeometrySettled, getSelection, setSelection, resolvePrimarySource, initialRecords = [] }) {
    if (!root?.addChild || !factory?.createProductEntity || !codec?.validate || [
        readSource,
        publishSource,
        configure,
        validateProspective,
        whenGeometrySettled,
        getSelection,
        setSelection
    ].some((fn)=>typeof fn !== 'function')) throw operationError('INVALID_SCENE_PORTS');
    const guard = createCompositionWriteGuard({
        collectionId,
        coordinator
    });
    let current = new Map(initialRecords.map((record)=>[
            record.id,
            record
        ]));
    const retired = new Set();
    async function release(record) {
        if (record.disposal) return record.disposal;
        // Failed cleanup stays owned for recovery; do not disguise it as released.
        record.disposal = (async ()=>{
            try {
                await record.release?.();
            } finally{
                record.entity.destroy();
            }
            record.disposed = true;
        })();
        return record.disposal;
    }
    async function releaseAll(records) {
        const results = await Promise.allSettled([
            ...records
        ].map(release));
        const failure = results.find((result)=>result.status === 'rejected');
        if (failure) {
            coordinator.markRecoveryRequired();
            throw operationError('RECOVERY_REQUIRED', failure.reason);
        }
    }
    const pose = (entity, p)=>entity.setPosition(p.x, p.y, p.z);
    function descriptors(document) {
        const result = document.cabinets.map((c)=>{
            const choice = catalog.resolveChoice(c);
            if (choice.status !== 'valid') reject('CATALOG', choice);
            const frame = document.frames.find((f)=>f.id === c.frameId);
            return {
                id: c.id,
                productType: choice.runtime.productType,
                config: cloneData(choice.runtime.config),
                frame: cloneData(frame),
                positionM: toWorld(frame, c.positionM),
                derived: false
            };
        });
        for (const source of document.primarySources){
            if (typeof resolvePrimarySource !== 'function') throw operationError('SOURCE_SUBSYSTEM_UNSUPPORTED');
            const descriptor = resolvePrimarySource(cloneData(source), cloneData(document));
            if (descriptor?.id !== source.id) throw operationError('INVALID_SOURCE_MAPPING');
            result.push({
                ...cloneData(descriptor),
                derived: false
            });
        }
        return result;
    }
    function createTransaction(input) {
        const { requestId, sessionId = null, kind = 'add', selectedCabinetId = null } = input;
        // A trusted command may use a narrower validator (for example, an SC-only
        // replacement). Public restore continues through the ordinary codec.
        const checked = (input.validateDocument ?? codec.validate)(input.document);
        if (checked.status !== 'valid') reject('DOCUMENT', checked);
        const document = cloneData(checked.document);
        if (document.collection?.id !== collectionId) throw operationError('UNSUPPORTED_COLLECTION');
        if (document.id !== scope.compositionId) throw operationError('SCOPE_MISMATCH');
        if (selectedCabinetId !== null && !document.cabinets.some((c)=>c.id === selectedCabinetId)) throw operationError('UNKNOWN_CABINET');
        const primary = descriptors(document);
        return {
            captureBefore () {
                const source = readSource();
                return {
                    ...source,
                    records: new Map(current),
                    selected: getSelection(),
                    poses: [
                        ...current.values()
                    ].map((record)=>({
                            record,
                            parent: record.entity.parent,
                            enabled: record.entity.enabled,
                            position: {
                                ...record.entity.getPosition()
                            }
                        }))
                };
            },
            async prepare (before, { signal }) {
                const stage = {
                    created: new Set(),
                    records: new Map(),
                    materialized: false,
                    published: false,
                    document,
                    retired: []
                };
                const cancelled = ()=>{
                    if (signal?.aborted) throw operationError('CANCELLED');
                };
                const add = async (descriptor)=>{
                    cancelled();
                    if (!descriptor?.id || typeof descriptor.productType !== 'string' || !descriptor.config || !isFiniteVec3(descriptor.positionM) || stage.records.has(descriptor.id)) throw operationError('INVALID_SCENE_PLAN');
                    const orientation = descriptor.frame ? {
                        xAxis: descriptor.frame.xAxis,
                        yAxis: descriptor.frame.yAxis,
                        zAxis: descriptor.frame.zAxis
                    } : null;
                    const signature = canonicalKey({
                        productType: descriptor.productType,
                        config: descriptor.config,
                        derived: descriptor.derived,
                        orientation
                    });
                    const old = before.records.get(descriptor.id);
                    const existing = root.findByName?.(descriptor.id);
                    if (existing && existing !== old?.entity) throw operationError('SCENE_ID_CONFLICT');
                    if (old && old.signature === signature) {
                        stage.records.set(descriptor.id, {
                            ...old,
                            positionM: cloneData(descriptor.derived ? old.positionM : descriptor.positionM)
                        });
                        return;
                    }
                    // Preview purpose suppresses controllers that write global state during construction.
                    // configure owns isolated rules/resources for this staged root (and its disposer).
                    const entity = await factory.createProductEntity(descriptor.productType, cloneData(descriptor.config), {
                        purpose: 'preview',
                        productId: descriptor.id,
                        signal
                    });
                    if (!entity?.destroy || !entity?.setPosition || !entity?.getPosition) throw operationError('SCENE_MODEL_UNAVAILABLE');
                    const record = {
                        ...descriptor,
                        entity,
                        signature,
                        release: null
                    };
                    stage.created.add(record);
                    entity.name = descriptor.id;
                    entity.enabled = false;
                    cancelled();
                    const configured = await configure(entity, cloneData(descriptor.config), {
                        productType: descriptor.productType,
                        signal,
                        document: cloneData(document),
                        frame: cloneData(descriptor.frame ?? null),
                        derived: descriptor.derived
                    });
                    if (configured && typeof configured === 'object') {
                        if (!isFiniteVec3(configured.positionM) || configured.release != null && typeof configured.release !== 'function' || configured.afterEnable != null && typeof configured.afterEnable !== 'function') throw operationError('INVALID_SCENE_CONFIGURATION');
                        record.release = configured.release ?? null;
                        record.afterEnable = configured.afterEnable ?? null;
                        record.positionM = cloneData(configured.positionM);
                    } else record.release = configured;
                    if (record.release != null && typeof record.release !== 'function') throw operationError('INVALID_SCENE_DISPOSER');
                    cancelled();
                    pose(entity, record.positionM);
                    stage.records.set(descriptor.id, record);
                };
                try {
                    for (const descriptor of primary)if (!descriptor.defer) await add(descriptor);
                    const validation = await validateProspective({
                        document: cloneData(document),
                        records: [
                            ...stage.records.values()
                        ],
                        signal
                    });
                    cancelled();
                    if (validation?.status !== 'valid') reject('PROSPECTIVE', validation);
                    if (validation.primary !== undefined) {
                        if (!Array.isArray(validation.primary)) throw operationError('INVALID_PRIMARY_PLAN');
                        const deferred = new Set(primary.filter((item)=>item.defer).map((item)=>item.id));
                        if (validation.primary.length !== deferred.size || validation.primary.some((item)=>!deferred.delete(item.id) || item.derived)) throw operationError('INVALID_PRIMARY_PLAN');
                        for (const descriptor of validation.primary)await add({
                            ...cloneData(descriptor),
                            derived: false
                        });
                    } else if (primary.some((item)=>item.defer)) throw operationError('INVALID_PRIMARY_PLAN');
                    if (!Array.isArray(validation.derived)) throw operationError('INVALID_DERIVED_PLAN');
                    for (const descriptor of validation.derived)await add({
                        ...cloneData(descriptor),
                        derived: true
                    });
                    stage.nextStore = new CompositionStore(scope.compositionId, before.store.compositionType);
                    stage.nextStore.setMutationGuard(guard);
                    stage.nextRevision = before.revision + 1;
                    return stage;
                } catch (error) {
                    await releaseAll(stage.created);
                    throw error;
                }
            },
            async materialize (stage, before, { mutationContext }) {
                coordinator.assertTransactionContext(mutationContext, {
                    source: false
                });
                stage.materialized = true;
                const retained = new Set([
                    ...stage.records.values()
                ].map((r)=>r.entity));
                for (const old of before.records.values())if (!retained.has(old.entity)) detach(old.entity);
                for (const record of stage.records.values()){
                    const borrowed = before.records.get(record.id)?.entity === record.entity;
                    // Borrowed legacy roots keep their authored parent/pivot. Reparenting
                    // or reapplying an identical world pose can invalidate their measured
                    // geometry even though the source document has not moved them.
                    if (!borrowed && record.entity.parent !== root) root.addChild(record.entity);
                    const currentPosition = record.entity.getPosition();
                    if ([
                        'x',
                        'y',
                        'z'
                    ].some((axis)=>currentPosition[axis] !== record.positionM[axis])) pose(record.entity, record.positionM);
                    if (record.entity.enabled !== true) record.entity.enabled = true;
                    synchronous(record.afterEnable?.());
                }
                synchronous(setSelection(selectedCabinetId));
                // Strict geometry-only port; never await the full legacy aggregator/cover cycle.
                const settled = await whenGeometrySettled({
                    document: cloneData(document),
                    records: [
                        ...stage.records.values()
                    ]
                });
                if (settled?.status !== 'ready') reject('GEOMETRY', settled);
            },
            publish (stage, before, { mutationContext }) {
                coordinator.assertTransactionContext(mutationContext);
                const oldSources = new Map([
                    ...before.document.cabinets,
                    ...before.document.primarySources
                ].map((c)=>[
                        c.id,
                        c
                    ]));
                const nextSources = new Map([
                    ...document.cabinets,
                    ...document.primarySources
                ].map((c)=>[
                        c.id,
                        c
                    ]));
                const oldIds = new Set(oldSources.keys()), nextIds = new Set(nextSources.keys());
                const receipt = {
                    requestId,
                    sessionId,
                    kind,
                    compositionRevision: stage.nextRevision,
                    addedProductIds: [
                        ...nextIds
                    ].filter((id)=>!oldIds.has(id)),
                    updatedProductIds: [
                        ...nextIds
                    ].filter((id)=>oldIds.has(id) && canonicalKey(oldSources.get(id)) !== canonicalKey(nextSources.get(id))),
                    removedProductIds: [
                        ...oldIds
                    ].filter((id)=>!nextIds.has(id)),
                    selectedCabinetId
                };
                for (const record of stage.records.values()){
                    if (record.derived && record.productType !== 'Cabinet_Cover') continue;
                    const offset = record.productType === 'Top_Solid' ? record.config.SpatialOffsetM : null;
                    const offsetX = Number.isFinite(offset?.x) ? offset.x : 0;
                    const offsetY = Number.isFinite(offset?.y) ? offset.y : 0;
                    stage.nextStore.addProduct(record.id, {
                        ...cloneData(record.config),
                        productType: record.productType,
                        entityName: record.id,
                        ...document.cabinets.some((c)=>c.id === record.id) ? {
                            category: 'cabinets'
                        } : {},
                        ...record.derived && record.productType === 'Cabinet_Cover' ? {
                            category: 'countertops',
                            CountertopRole: 'cabinetCover'
                        } : {},
                        positionX: record.positionM.x - offsetX,
                        positionY: record.positionM.y - offsetY,
                        positionZ: record.positionM.z
                    }, mutationContext);
                }
                stage.nextStore.setCabinetDocument(document, stage.nextRevision, mutationContext);
                // Replacement must apply the incoming preset's cover policy. Copying
                // the old store setting here would silently keep the previous cover.
                const coverSettings = [
                    'preset',
                    'restore'
                ].includes(kind) ? document.featureSettings?.cabinetCover : document.featureSettings?.cabinetCover ?? before.store.getCabinetCoverSettings?.();
                if (coverSettings !== null && coverSettings !== undefined) stage.nextStore.setCabinetCoverSettings(coverSettings, mutationContext);
                synchronous(publishSource(stage.nextStore, stage.nextRevision, mutationContext));
                current = stage.records;
                stage.published = true;
                const retained = new Set([
                    ...current.values()
                ].map((r)=>r.entity));
                stage.retired = [
                    ...before.records.values()
                ].filter((r)=>!retained.has(r.entity));
                for (const record of stage.retired)retired.add(record);
                return receipt;
            },
            async rollback (before, stage, { mutationContext }) {
                coordinator.assertTransactionContext(mutationContext);
                for (const record of stage.created)detach(record.entity);
                for (const old of before.poses){
                    if (old.parent && old.record.entity.parent !== old.parent) old.parent.addChild(old.record.entity);
                    pose(old.record.entity, old.position);
                    old.record.entity.enabled = old.enabled;
                }
                synchronous(publishSource(before.store, before.revision, mutationContext));
                current = before.records;
                for (const record of stage.retired)retired.delete(record);
                synchronous(setSelection(before.selected));
                stage.materialized = false;
                stage.published = false;
                await releaseAll(stage.created);
            },
            async dispose (stage) {
                if (!stage.materialized && !stage.published) await releaseAll(stage.created);
            }
        };
    }
    return Object.freeze({
        createTransaction,
        async releaseRetired () {
            const batch = [
                ...retired
            ];
            await releaseAll(batch);
            for (const record of batch)retired.delete(record);
        },
        async destroy ({ preserveEntities = [] } = {}) {
            const keep = new Set(preserveEntities);
            await releaseAll(new Set([
                ...current.values(),
                ...retired
            ].filter((r)=>!keep.has(r.entity))));
            current.clear();
            retired.clear();
        }
    });
}

export { createCabinetSceneAdapter };
