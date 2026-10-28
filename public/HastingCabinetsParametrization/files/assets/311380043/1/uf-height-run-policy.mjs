/**
 * Urban Freestanding row rule (Andriy, 15.10.2026): all tall cabinets stand in one block,
 * short ones only to the left or to the right of it (a short cabinet never stands between two tall ones).
 *
 * The class of a cabinet comes from its height (uf-cabinet-height-policy.mjs, NEW sheet A26:A29): tall 88 / 91, short 53 / 56.
 * Read by SceneManager: the "+" buttons of a UF row (_applyButtonRules), the insert guard (addProductByParams)
 * and the swap guard (swapProducts); by ProductConfigPlugin.setConfigBatch (configForShortUFCabinet).
 */
import { isShortCabinet, resolveUFHeight } from '../product/logic/uf-cabinet-height-policy.mjs';

export const UF_CABINET_CLASS = Object.freeze({
    tall: 'tall',
    short: 'short'
});

/** The UF products that stand in the cabinet row (the side panels are addons, not row cabinets). */
export const UF_ROW_PRODUCT_TYPES = Object.freeze([
    'UF-side-cabinet',
    'UF-sink-cabinet',
    'UF-open-shelves',
    'UF-open-shelves-side'
]);

/** @example isUFRowProduct({ productType: 'UF-sink-cabinet' }) // → true */
export const isUFRowProduct = config => UF_ROW_PRODUCT_TYPES.includes(config?.productType);

/**
 * The class of a UF cabinet from its config Height, as the UI sends it.
 * @example ufCabinetClassOf({ Height: 91 }) // → 'tall'
 * @example ufCabinetClassOf({ Height: 53 }) // → 'short'
 * @example ufCabinetClassOf({ Height: 70 }) // → null (not a UF height)
 * @param {{ Height?: number|string }} config
 * @returns {'tall'|'short'|null} null when the height policy has no UF height for this config
 */
export function ufCabinetClassOf(config) {
    const height = resolveUFHeight(config?.Height);

    // Unknown height: the caller decides (the row rule does not block on it).
    if (height === null) return null;

    return isShortCabinet(height) ? UF_CABINET_CLASS.short : UF_CABINET_CLASS.tall;
}

/**
 * Whether a cabinet of draftClass may be inserted at insertIndex of the row, keeping the tall cabinets in one block.
 * Positions: 0 = left of the first cabinet, rowClasses.length = right of the last one.
 * A null class (a height the policy does not know) neither blocks nor is blocked.
 * @example ufInsertAllowed(['tall', 'tall', 'short'], 3, 'tall')  // → false (a short one would be between)
 * @example ufInsertAllowed(['tall', 'tall', 'short'], 1, 'short') // → false (inside the tall block)
 * @example ufInsertAllowed(['short', 'short'], 1, 'tall')         // → true
 * @param {('tall'|'short'|null)[]} rowClasses the row cabinets left to right
 * @param {number} insertIndex
 * @param {'tall'|'short'|null} draftClass the class of the new cabinet
 * @returns {boolean}
 */
export function ufInsertAllowed(rowClasses, insertIndex, draftClass) {
    const rowAfterInsert = [...rowClasses];
    rowAfterInsert.splice(insertIndex, 0, draftClass);
    return tallCabinetsInOneBlock(rowAfterInsert);
}

/**
 * Whether swapping two row cabinets keeps the tall cabinets in one block.
 * @example ufSwapAllowed(['tall', 'tall', 'short'], 1, 2)  // → false (tall, short, tall)
 * @example ufSwapAllowed(['short', 'tall', 'tall'], 0, 2)  // → true  (tall, tall, short)
 * @param {('tall'|'short'|null)[]} rowClasses the row cabinets left to right
 * @param {number} indexA
 * @param {number} indexB
 * @returns {boolean}
 */
export function ufSwapAllowed(rowClasses, indexA, indexB) {
    const rowAfterSwap = [...rowClasses];
    rowAfterSwap[indexA] = rowClasses[indexB];
    rowAfterSwap[indexB] = rowClasses[indexA];
    return tallCabinetsInOneBlock(rowAfterSwap);
}

/**
 * The part of a batch config one cabinet takes: a short UF cabinet keeps its own Height.
 * The batch Height is the composition (tall) height; given to a short cabinet it would grow it to a tall
 * one for a few frames until the UI set its height back (visible blinking on Handle / Depth changes).
 * The UI sends the short cabinet's own height (UG / CG 56, PTO 53) and Handle does not move it, so every other key passes through.
 * @example configForShortUFCabinet({ productType: 'UF-side-cabinet', Height: 56, Handle: 'UG' }, { Height: 88, Handle: 'PTO' })
 *          // → { Handle: 'PTO' } (the cabinet keeps its Height)
 * @example configForShortUFCabinet({ productType: 'UF-sink-cabinet', Height: 91, Handle: 'UG' }, { Height: 88 })
 *          // → { Height: 88 } (a tall cabinet takes the batch as it is)
 * @param {object} currentConfig the cabinet's config in the composition (productType, Height, Handle)
 * @param {object} batchConfig the keys the batch sets on every product
 * @returns {object} batchConfig itself, or a copy without Height for a short UF cabinet
 */
export function configForShortUFCabinet(currentConfig, batchConfig) {
    const isShortUFCabinet = isUFRowProduct(currentConfig) && ufCabinetClassOf(currentConfig) === UF_CABINET_CLASS.short;

    // Not a short UF cabinet, or no Height in the batch: nothing to keep.
    if (!isShortUFCabinet || !('Height' in batchConfig)) return batchConfig;

    const { Height: compositionHeight, ...configWithoutHeight } = batchConfig;
    return configWithoutHeight;
}

/**
 * True when no short cabinet stands between the first and the last tall one; a null class is left out.
 * @example tallCabinetsInOneBlock(['short', 'tall', 'tall', 'short']) // → true
 * @example tallCabinetsInOneBlock(['tall', 'short', 'tall'])          // → false
 */
function tallCabinetsInOneBlock(rowClasses) {
    // Only cabinets with a known class take part in the rule.
    const knownClasses = rowClasses.filter(cabinetClass => cabinetClass !== null);

    const firstTallIndex = knownClasses.indexOf(UF_CABINET_CLASS.tall);
    const lastTallIndex = knownClasses.lastIndexOf(UF_CABINET_CLASS.tall);

    // No tall cabinets at all: nothing to keep together.
    if (firstTallIndex === -1) return true;

    const tallBlock = knownClasses.slice(firstTallIndex, lastTallIndex + 1);
    return !tallBlock.includes(UF_CABINET_CLASS.short);
}
