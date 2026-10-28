import { cloneData, isRecord } from './cabinet-contracts.mjs';

const validId = (value)=>typeof value === 'string' && value.trim().length > 0 && ![
        '__proto__',
        'prototype',
        'constructor'
    ].includes(value);
const fail = (code)=>{
    const error = new Error(code);
    error.code = code;
    throw error;
};
const vec = (value)=>isRecord(value) && [
        'x',
        'y',
        'z'
    ].every((axis)=>Number.isFinite(value[axis]));
const diff = (a, b)=>({
        x: a.x - b.x,
        y: a.y - b.y,
        z: a.z - b.z
    });
const sum = (a, b)=>({
        x: a.x + b.x,
        y: a.y + b.y,
        z: a.z + b.z
    });
const sameCollection = (a, b)=>a?.id === b?.id && a?.catalogVersion === b?.catalogVersion && a?.policyVersion === b?.policyVersion;
function checkChoice(cabinet, catalog, isPortableChoice) {
    if (!validId(cabinet?.definitionId) || !isRecord(cabinet.selection) || cabinet.definitionId.startsWith('LEGACY-') || isPortableChoice?.(cabinet) !== true) {
        fail('PRESET_CHOICE_NOT_PORTABLE');
    }
    if (catalog?.resolveChoice(cabinet)?.status !== 'valid') fail('PRESET_CHOICE_NOT_PORTABLE');
}
function sourceAdapter(adapters, subsystem, direction) {
    const adapter = adapters?.[subsystem];
    if (typeof adapter?.[direction] !== 'function') fail('PRESET_SOURCE_NOT_PORTABLE');
    return adapter[direction];
}
/** Capture only committed, catalog-backed composition state. Keys are preset-local,
 * never borrowed runtime IDs. Subsystem adapters must export self-contained JSON. */ function captureExactPreset({ document, anchorCabinetId, catalog, sourceAdapters = {}, isPortableChoice, serializeChoice }) {
    const d = cloneData(document);
    if (d?.schemaVersion !== 1 || !Array.isArray(d.cabinets) || !d.cabinets.length || !Array.isArray(d.frames) || !Array.isArray(d.connections) || !Array.isArray(d.localLayouts) || !Array.isArray(d.primarySources) || !isRecord(d.featureSettings)) fail('PRESET_INVALID_DOCUMENT');
    const byId = new Map(d.cabinets.map((cabinet, index)=>[
            cabinet.id,
            {
                cabinet,
                key: `cabinet${index}`
            }
        ]));
    if (byId.size !== d.cabinets.length) fail('PRESET_INVALID_DOCUMENT');
    const anchor = byId.get(anchorCabinetId)?.cabinet;
    if (!anchor || !vec(anchor.positionM)) fail('PRESET_INVALID_ANCHOR');
    const portableChoices = new Map();
    for (const cabinet of d.cabinets){
        if (!vec(cabinet.positionM) || !d.frames.some((frame)=>frame.id === cabinet.frameId)) fail('PRESET_INVALID_DOCUMENT');
        const resolved = catalog?.resolveChoice(cabinet);
        if (resolved?.status !== 'valid') fail('PRESET_CHOICE_NOT_PORTABLE');
        const choice = typeof serializeChoice === 'function' ? cloneData(serializeChoice(cloneData(cabinet), cloneData(resolved))) : {
            definitionId: cabinet.definitionId,
            selection: cabinet.selection
        };
        if (!validId(choice?.definitionId) || !isRecord(choice.selection) || choice.definitionId.startsWith('LEGACY-') || isPortableChoice?.(choice) !== true) {
            fail('PRESET_CHOICE_NOT_PORTABLE');
        }
        portableChoices.set(cabinet.id, choice);
    }
    const keyOf = (runtimeId)=>{
        const key = byId.get(runtimeId)?.key;
        if (!key) fail('PRESET_INVALID_REFERENCE');
        return key;
    };
    const mapEdge = (edge)=>({
            key: `connection${d.connections.indexOf(edge)}`,
            a: {
                key: keyOf(edge.a.cabinetId),
                surfaceId: edge.a.surfaceId
            },
            b: {
                key: keyOf(edge.b.cabinetId),
                surfaceId: edge.b.surfaceId
            },
            kind: edge.kind,
            ruleId: edge.ruleId
        });
    const mapLayout = (layout, index)=>({
            key: `layout${index}`,
            kind: layout.kind,
            frameId: layout.frameId,
            anchorPositionM: cloneData(layout.anchorPositionM),
            orderedKeys: layout.orderedCabinetIds.map(keyOf),
            policyId: layout.policyId
        });
    const mapSource = (source, index)=>({
            key: `source${index}`,
            subsystem: source.subsystem,
            schemaVersion: source.schemaVersion,
            cabinetKeys: source.cabinetReferences.map(keyOf),
            payload: cloneData(sourceAdapter(sourceAdapters, source.subsystem, 'export')(cloneData(source), keyOf))
        });
    return {
        presetSchemaVersion: 2,
        collection: cloneData(d.collection),
        presetProducts: d.cabinets.map((cabinet)=>({
                ...cloneData(portableChoices.get(cabinet.id)),
                key: keyOf(cabinet.id),
                roleId: cabinet.roleId,
                placementMode: cabinet.placementMode,
                frameId: cabinet.frameId
            })),
        presetLayout: {
            layoutMode: 'exact',
            frames: cloneData(d.frames),
            anchor: {
                key: keyOf(anchorCabinetId),
                positionM: cloneData(anchor.positionM)
            },
            placements: d.cabinets.filter((cabinet)=>cabinet.id !== anchorCabinetId).map((cabinet)=>({
                    key: keyOf(cabinet.id),
                    relativeTo: {
                        key: keyOf(anchorCabinetId),
                        anchor: {
                            kind: 'origin'
                        },
                        own: {
                            kind: 'origin'
                        }
                    },
                    offsetM: diff(cabinet.positionM, anchor.positionM)
                })),
            connections: d.connections.map(mapEdge),
            localLayouts: d.localLayouts.map(mapLayout),
            primarySources: d.primarySources.map(mapSource),
            featureSettings: cloneData(d.featureSettings)
        }
    };
}
/** Materialize a fresh CompositionDocument for the target composition. This is a
 * pure conversion: the caller must validate it and commit via a scene transaction. */ function instantiateExactPreset({ preset, targetDocument, catalog, sourceAdapters = {}, isPortableChoice, makeId, anchorPositionM }) {
    const p = cloneData(preset), target = cloneData(targetDocument);
    if (p?.presetSchemaVersion !== 2 || p.presetLayout?.layoutMode !== 'exact' || !Array.isArray(p.presetProducts) || !p.presetProducts.length || !Array.isArray(p.presetLayout.placements) || !Array.isArray(p.presetLayout.frames) || !Array.isArray(p.presetLayout.connections) || !Array.isArray(p.presetLayout.localLayouts) || !Array.isArray(p.presetLayout.primarySources) || !isRecord(p.presetLayout.featureSettings) || typeof makeId !== 'function') fail('PRESET_INVALID_DOCUMENT');
    if (!sameCollection(p.collection, target?.collection)) fail('PRESET_COLLECTION_MISMATCH');
    const rootKey = p.presetLayout.anchor?.key;
    const rootPosition = anchorPositionM ?? p.presetLayout.anchor?.positionM;
    if (!validId(rootKey) || !vec(rootPosition) || !vec(p.presetLayout.anchor?.positionM)) fail('PRESET_INVALID_ANCHOR');
    const translationM = diff(rootPosition, p.presetLayout.anchor.positionM);
    const keys = new Set(), keyToProductId = {};
    for (const product of p.presetProducts){
        if (!validId(product?.key) || keys.has(product.key)) fail('PRESET_INVALID_REFERENCE');
        keys.add(product.key);
        checkChoice(product, catalog, isPortableChoice);
        const newId = makeId('cabinet', product.key);
        if (!validId(newId) || Object.values(keyToProductId).includes(newId)) fail('PRESET_INVALID_ID');
        keyToProductId[product.key] = newId;
    }
    if (!keys.has(rootKey) || p.presetLayout.placements.length !== keys.size - 1) fail('PRESET_INVALID_REFERENCE');
    const position = {
        [rootKey]: rootPosition
    };
    for (const placement of p.presetLayout.placements){
        if (!keys.has(placement?.key) || placement.key === rootKey || position[placement.key] || placement.relativeTo?.key !== rootKey || placement.relativeTo?.anchor?.kind !== 'origin' || placement.relativeTo?.own?.kind !== 'origin' || !vec(placement.offsetM)) fail('PRESET_INVALID_REFERENCE');
        position[placement.key] = sum(rootPosition, placement.offsetM);
    }
    const ref = (key)=>{
        if (!Object.hasOwn(keyToProductId, key)) fail('PRESET_INVALID_REFERENCE');
        return keyToProductId[key];
    };
    if (p.presetLayout.connections.some((edge)=>!validId(edge?.key) || !validId(edge.a?.surfaceId) || !validId(edge.b?.surfaceId) || !validId(edge.kind) || !validId(edge.ruleId)) || p.presetLayout.localLayouts.some((layout)=>!validId(layout?.key) || !Array.isArray(layout.orderedKeys) || !vec(layout.anchorPositionM)) || p.presetLayout.primarySources.some((source)=>!validId(source?.key) || !validId(source.subsystem) || !Array.isArray(source.cabinetKeys) || !isRecord(source.payload))) fail('PRESET_INVALID_DOCUMENT');
    const nextId = (kind, key)=>{
        const value = makeId(kind, key);
        if (!validId(value)) fail('PRESET_INVALID_ID');
        return value;
    };
    const document = {
        schemaVersion: 1,
        id: target.id,
        collection: cloneData(target.collection),
        frames: cloneData(p.presetLayout.frames),
        cabinets: p.presetProducts.map((product)=>({
                id: ref(product.key),
                definitionId: product.definitionId,
                selection: cloneData(product.selection),
                roleId: product.roleId,
                placementMode: product.placementMode,
                frameId: product.frameId,
                positionM: cloneData(position[product.key])
            })),
        connections: p.presetLayout.connections.map((edge)=>({
                id: nextId('connection', edge.key),
                a: {
                    cabinetId: ref(edge.a?.key),
                    surfaceId: edge.a?.surfaceId
                },
                b: {
                    cabinetId: ref(edge.b?.key),
                    surfaceId: edge.b?.surfaceId
                },
                kind: edge.kind,
                ruleId: edge.ruleId
            })),
        localLayouts: p.presetLayout.localLayouts.map((layout)=>({
                id: nextId('layout', layout.key),
                kind: layout.kind,
                frameId: layout.frameId,
                anchorPositionM: sum(layout.anchorPositionM, translationM),
                orderedCabinetIds: layout.orderedKeys.map(ref),
                policyId: layout.policyId
            })),
        primarySources: p.presetLayout.primarySources.map((source)=>({
                id: nextId('source', source.key),
                subsystem: source.subsystem,
                schemaVersion: source.schemaVersion,
                cabinetReferences: source.cabinetKeys.map(ref),
                payload: cloneData(sourceAdapter(sourceAdapters, source.subsystem, 'import')(cloneData(source), cloneData(keyToProductId), {
                    translationM: cloneData(translationM)
                }))
            })),
        featureSettings: cloneData(p.presetLayout.featureSettings)
    };
    return {
        document,
        keyToProductId
    };
}

export { captureExactPreset, instantiateExactPreset };
