import { cloneData, isRecord, isFiniteVec3, outcome, reason } from '../../cabinet-placement/cabinet-contracts.mjs';
import { isCabinetCoverProduct } from '../../countertop/countertop-role.mjs';

const fail = (code, status = 'unsupported') => { throw { code, status }; };
const dot = (a,b) => a.x*b.x+a.y*b.y+a.z*b.z;
/**
 * One serialized CompositionStore, not the multi-composition transport envelope.
 * mapProduct/resolveLayouts/mapFeatureSettings are trusted version-specific adapters.
 * No name-based SKU inference or layout reconstruction from insertion order.
 * Legacy exporter stores world minus XY offset; new document stores local frame pose.
 */
export function migrateLegacyComposition(input, { codec, frame, collection, mapProduct,
    resolveLayouts, mapFeatureSettings } = {}) {
    try {
        const legacy=cloneData(input);
        if (!isRecord(legacy) || !codec?.validate) fail('INVALID_LEGACY_DOCUMENT','invalid');
        if (legacy.schemaVersion !== undefined) {
            const checked=codec.validate(legacy);
            return checked.status === 'valid' ? { ...checked, migrated:false } : checked;
        }
        if (typeof legacy.compositionId !== 'string' || !legacy.compositionId.trim() || !isRecord(legacy.products) ||
            !isRecord(legacy.orderProductIds ?? {}) || typeof mapProduct !== 'function' ||
            typeof resolveLayouts !== 'function' || typeof mapFeatureSettings !== 'function') fail('LEGACY_MAPPING_REQUIRED');
        if (!frame || !['originM','xAxis','yAxis','zAxis'].every(k=>isFiniteVec3(frame[k]))) fail('LEGACY_FRAME_REQUIRED');
        const cabinets=[],primarySources=[];
        for (const [productId,snapshot] of Object.entries(legacy.products).sort(([a],[b])=>a.localeCompare(b))) {
            if (!isRecord(snapshot)) fail('INVALID_LEGACY_PRODUCT','invalid');
            if (isCabinetCoverProduct(snapshot)) continue;
            const mapped=mapProduct(productId,cloneData(snapshot));
            if (!isRecord(mapped)) fail('LEGACY_PRODUCT_MAPPING_REQUIRED');
            if (mapped.kind === 'primary') {
                if (!isRecord(mapped.source) || mapped.source.id !== productId) fail('INVALID_LEGACY_SOURCE','invalid');
                primarySources.push(cloneData(mapped.source)); continue;
            }
            if (mapped.kind !== 'cabinet') fail('LEGACY_PRODUCT_MAPPING_REQUIRED');
            if (!['positionX','positionY','positionZ'].every(k=>Number.isFinite(snapshot[k]))) fail('LEGACY_POSITION_REQUIRED','invalid');
            const offset=snapshot.SpatialOffsetM ?? {x:0,y:0};
            if (!isRecord(offset) || Object.keys(offset).some(k=>!['x','y'].includes(k)) ||
                !Number.isFinite(offset.x) || !Number.isFinite(offset.y)) fail('INVALID_LEGACY_OFFSET','invalid');
            const world={x:snapshot.positionX+offset.x,y:snapshot.positionY+offset.y,z:snapshot.positionZ};
            const relative={x:world.x-frame.originM.x,y:world.y-frame.originM.y,z:world.z-frame.originM.z};
            cabinets.push({id:productId,definitionId:mapped.definitionId,selection:cloneData(mapped.selection),
                roleId:mapped.roleId,placementMode:mapped.placementMode,frameId:frame.id,
                positionM:{x:dot(relative,frame.xAxis),y:dot(relative,frame.yAxis),z:dot(relative,frame.zAxis)}});
        }
        const localLayouts=resolveLayouts(cloneData(cabinets),cloneData(legacy.orderProductIds ?? {}));
        if (!Array.isArray(localLayouts)) fail('LEGACY_LAYOUT_MAPPING_REQUIRED');
        const featureSettings=mapFeatureSettings(cloneData(legacy.features ?? {}));
        if (!isRecord(featureSettings)) fail('LEGACY_FEATURE_MAPPING_REQUIRED');
        const document={schemaVersion:1,id:legacy.compositionId,collection:cloneData(collection),frames:[cloneData(frame)],
            cabinets,connections:[],localLayouts,primarySources,featureSettings};
        const checked=codec.validate(document);
        return checked.status === 'valid' ? {...checked,migrated:true} : checked;
    } catch(error) {
        return outcome(error?.status ?? 'invalid',[reason(error?.code ?? 'INVALID_LEGACY_DOCUMENT')]);
    }
}
