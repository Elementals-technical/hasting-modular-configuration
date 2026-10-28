import { COLUMN_SLOTS } from '../../cabinet-placement/columns/cabinet-columns.mjs';

const isRecord = (value)=>value !== null && typeof value === 'object' && !Array.isArray(value);
/** A compact document: an object with a non-empty `rows` array. Example: { rows: [{ products: [...] }] } -> true. */ function hasRows(document) {
    return isRecord(document) && Array.isArray(document.rows) && document.rows.length > 0;
}
/**
 * A row item is a column when it has no cabinet name but fills a column slot — the same test as rowItemKind in
 * compact-preset.mjs. Example: { Width: 50, top: { name: 'UD-side-cabinet' } } -> true; { name: 'ULH-side-cabinet' } -> false.
 */ function isColumnItem(item) {
    if (!isRecord(item) || Object.hasOwn(item, 'name')) return false;
    return COLUMN_SLOTS.some((slot)=>item[slot] !== undefined);
}
/** Any row holds a column. Example: { rows: [{ products: [{ Width: 50, top: {...} }] }] } -> true. */ function hasColumnItem(document) {
    return document.rows.some((row)=>Array.isArray(row?.products) && row.products.some(isColumnItem));
}

export { hasColumnItem, hasRows };
