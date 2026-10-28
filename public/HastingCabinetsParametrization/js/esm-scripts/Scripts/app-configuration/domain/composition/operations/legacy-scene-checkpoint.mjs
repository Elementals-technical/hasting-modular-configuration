import { canonicalKey, cloneData, isRecord } from '../../cabinet-placement/cabinet-contracts.mjs';
import { operationError } from './composition-operation-coordinator.mjs';

const vector = (value, keys)=>{
    if (!value || !keys.every((k)=>Number.isFinite(value[k]))) throw operationError('LEGACY_POSE_REQUIRED');
    return Object.fromEntries(keys.map((k)=>[
            k,
            value[k]
        ]));
};
const pose = (entity)=>({
        positionM: vector(entity.getPosition?.(), [
            'x',
            'y',
            'z'
        ]),
        rotation: entity.getRotation ? vector(entity.getRotation(), [
            'x',
            'y',
            'z',
            'w'
        ]) : null,
        localScale: entity.getLocalScale ? vector(entity.getLocalScale(), [
            'x',
            'y',
            'z'
        ]) : null,
        enabled: entity.enabled
    });
const unsupported = (path)=>Object.assign(operationError('LEGACY_SNAPSHOT_UNSUPPORTED'), {
        path
    });
/** Legacy snapshots can contain optional undefined object fields. JSON omits those
 * fields, so omit them at the checkpoint boundary. Refuse every other non-JSON
 * value with its path instead of losing config or accepting an ambiguous source.
 */ function normalizeLegacyData(value, path, ancestors = new Set()) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number') {
        if (Number.isFinite(value)) return value;
        throw unsupported(path);
    }
    if (!value || typeof value !== 'object' || ancestors.has(value)) throw unsupported(path);
    ancestors.add(value);
    try {
        if (Array.isArray(value)) return Array.from({
            length: value.length
        }, (_, index)=>{
            if (!Object.hasOwn(value, index)) throw unsupported(`${path}[${index}]`);
            return normalizeLegacyData(value[index], `${path}[${index}]`, ancestors);
        });
        if (!isRecord(value)) throw unsupported(path);
        const output = {};
        for (const [key, item] of Object.entries(value)){
            if ([
                '__proto__',
                'prototype',
                'constructor'
            ].includes(key)) throw unsupported(`${path}.${key}`);
            if (item !== undefined) output[key] = normalizeLegacyData(item, `${path}.${key}`, ancestors);
        }
        return output;
    } finally{
        ancestors.delete(value);
    }
}
/** Read-only checkpoint, NOT a catalog mapper or manufacturing validation.
 * World positions already include SpatialOffsetM: never add that offset a second time.
 * The serializable input is separate from private entity/store ownership checks.
 */ function captureLegacySceneCheckpoint({ app, manager = app?.compositionManager } = {}) {
    const store = manager?.getActiveComposition?.();
    if (!store) throw operationError('COMPOSITION_NOT_FOUND');
    const products = (data)=>Object.fromEntries(Object.entries(data).map(([id, snapshot])=>[
                id,
                normalizeLegacyData(typeof snapshot?.getAll === 'function' ? snapshot.getAll() : snapshot, `products.${id}`)
            ]));
    const read = ()=>{
        const data = store.serialize();
        return {
            serialized: normalizeLegacyData({
                ...data,
                products: products(data.products)
            }, 'serialized'),
            products: products(store.getAllProducts())
        };
    };
    const state = read(), entities = Object.keys(state.products).sort().map((id)=>{
        const entity = app.root.findByName?.(id);
        if (!entity) throw operationError('LEGACY_ENTITY_NOT_FOUND');
        return {
            id,
            entity,
            parent: entity.parent,
            pose: pose(entity)
        };
    });
    const originalKey = canonicalKey(state);
    return Object.freeze({
        source: cloneData({
            compositionId: store.compositionId,
            ...state,
            entities: entities.map(({ id, pose: p })=>({
                    id,
                    ...p
                }))
        }),
        assertUnchanged () {
            if (manager.getActiveComposition() !== store || canonicalKey(read()) !== originalKey || entities.some((r)=>app.root.findByName(r.id) !== r.entity || r.entity.parent !== r.parent || canonicalKey(pose(r.entity)) !== canonicalKey(r.pose))) throw operationError('STALE_DEPENDENCIES');
        }
    });
}

export { captureLegacySceneCheckpoint, normalizeLegacyData };
