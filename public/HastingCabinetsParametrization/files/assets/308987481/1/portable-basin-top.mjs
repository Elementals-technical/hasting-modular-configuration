import { cloneData, isRecord, isFiniteVec3 } from './cabinet-contracts.mjs';

const volatileFields = ['entityName', 'productId', 'positionX', 'positionY', 'positionZ'];
const fail = code => { const error = new Error(code); error.code = code; throw error; };

/** Portable adapter for a positioned basin/countertop primary source. The top
 * remains a primary source; derived Cabinet_Cover products are not serialized. */
export function createPortableBasinTopAdapter({ canBuildTop } = {}) {
    if (typeof canBuildTop !== 'function') throw new TypeError('Missing top builder gate');
    const valid = payload => isRecord(payload) && typeof payload.productType === 'string' &&
        !!payload.productType.trim() && isRecord(payload.config) && isFiniteVec3(payload.positionM) &&
        Object.keys(payload).every(key => ['productType', 'config', 'positionM'].includes(key));
    const authorize = payload => {
        if (!valid(payload) || volatileFields.some(key => Object.hasOwn(payload.config, key)) ||
            canBuildTop(cloneData(payload.productType), cloneData(payload.config)) !== true) {
            fail('PRESET_SOURCE_NOT_PORTABLE');
        }
    };
    return Object.freeze({
        export(source) {
            const payload = cloneData(source?.payload);
            if (isRecord(payload?.config)) for (const key of volatileFields) delete payload.config[key];
            authorize(payload);
            return payload;
        },
        import(source, _keyToProductId, { translationM = { x: 0, y: 0, z: 0 } } = {}) {
            const payload = cloneData(source?.payload);
            authorize(payload);
            if (!isFiniteVec3(translationM)) fail('PRESET_INVALID_POSITION');
            payload.positionM = { x: payload.positionM.x + translationM.x,
                y: payload.positionM.y + translationM.y, z: payload.positionM.z + translationM.z };
            return payload;
        }
    });
}
