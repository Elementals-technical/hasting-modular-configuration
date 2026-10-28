/** Engine-free data guards and diagnostics shared by cabinet policies. */
// Plain objects only; one created in another realm (e.g. the UI page calling the iframe API) has its own
// Object.prototype, so it is accepted when its prototype is a root prototype (whose own prototype is null).
export const isRecord = value => {
    if (value === null || typeof value !== 'object' || Object.prototype.toString.call(value) !== '[object Object]') return false;
    const proto = Object.getPrototypeOf(value);
    return proto === null || proto === Object.prototype || Object.getPrototypeOf(proto) === null;
};
export const isFiniteVec3 = value => isRecord(value) &&
    ['x', 'y', 'z'].every(key => Number.isFinite(value[key]));
export const reason = (code, decisionIds = [], params = {}) => ({
    code, messageKey: 'cabinet.' + code.toLowerCase(), params,
    affectedProductIds: [], decisionIds: [...decisionIds]
});
export const outcome = (status, reasons = [], data = {}) => ({ status, reasons, ...data });
export function cloneData(value) {
    if (value === null || ['string', 'boolean'].includes(typeof value)) return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (Array.isArray(value)) return Array.from(value, item => cloneData(item)); // local-realm array
    if (isRecord(value)) {
        const copy = {};
        for (const [key, child] of Object.entries(value)) {
            if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new TypeError('Unsafe data key');
            copy[key] = cloneData(child);
        }
        return copy;
    }
    throw new TypeError('Expected finite JSON data');
}
export function freezeData(value) {
    if (value && typeof value === 'object') {
        for (const child of Object.values(value)) freezeData(child);
        Object.freeze(value);
    }
    return value;
}
export function canonicalKey(value) {
    const data = cloneData(value);
    const encode = v => Array.isArray(v) ? '[' + v.map(encode).join(',') + ']' :
        isRecord(v) ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + encode(v[k])).join(',') + '}' :
            JSON.stringify(v);
    return encode(data);
}
