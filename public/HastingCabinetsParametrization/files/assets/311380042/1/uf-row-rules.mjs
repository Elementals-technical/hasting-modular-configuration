/**
 * Urban Freestanding row rules on the composition: all tall cabinets stand in one block, short ones only beside it
 * (the rule itself: cabinet-placement/uf-height-run-policy.mjs). This adapter reads the active composition into
 * plain rows of classes and applies the rule to the "+" buttons, to inserts and to swaps.
 *
 * Read by SceneManager:
 * - _applyButtonRules → applyUFPlusRule: which "+" a new cabinet may use, and at what height they stand;
 * - addProductByParams → assertUFInsert: refuses an insert that breaks the tall block;
 * - swapProducts → assertUFSwap: refuses a swap that breaks the tall block.
 * Only standard rows: free layout (modular collections, preserveCabinetPositions) has its own placement rules.
 */
import { LoggerService } from '../../../services/logger/logger-service.mjs';
import { resolveUFHeight } from '../../product/logic/uf-cabinet-height-policy.mjs';
import { isUFRowProduct, ufCabinetClassOf, ufInsertAllowed, ufSwapAllowed } from '../uf-height-run-policy.mjs';

const LOG_CONTEXT = 'UFRowRules';

/**
 * The "+" a cabinet of draftConfig's height may use in a UF row, at the height of that cabinet.
 * Gap i is the place before row cabinet i: 0 = the left edge, row length = the right edge.
 * Not a UF row, or a height the rule does not know: the anchors stay as they are.
 * @example row tall, tall, short and a tall draft: the "+" of gaps 0, 1, 2 stay, the right edge one goes
 * @param {Array<{entity, left, right, bottomY}>} sortedAnchors the row anchors left to right (AnchorCalculator);
 *   left / right are set to null or moved to the new cabinet's height
 * @param {CompositionManager} compositionManager
 * @param {{Height?, Handle?}} draftConfig the cabinet the UI is about to add, with the row's Height / Handle
 *   where the UI left them out (as addProductByParams fills them)
 */
export function applyUFPlusRule(sortedAnchors, compositionManager, draftConfig) {
    // 1. Not a UF row, or a height the rule does not know: every "+" stays.
    const composition = compositionManager.getActiveComposition();
    if (!composition) return;
    const rowProductIds = sortedAnchors.map(anchor => anchor.entity.name);
    const heightRun = ufHeightRun(rowProductIds, composition.getAllProducts(), draftConfig);
    if (!heightRun) return;

    // 2. One "+" per gap: an inner gap is the left "+" of its right cabinet, the right edge the right "+" of the last
    //    one. PlusButtonManager.excludeDuplicatedByX keeps the same ones; doing it here means a closed right edge
    //    cannot bring back the right "+" of the cabinet before it as a duplicate.
    const lastIndex = sortedAnchors.length - 1;
    sortedAnchors.slice(0, lastIndex).forEach(anchor => { anchor.right = null; });

    // 3. Close every gap where the new cabinet would leave a short cabinet between tall ones.
    for (let gapIndex = 0; gapIndex <= sortedAnchors.length; gapIndex++) {
        if (ufInsertAllowed(heightRun.rowClasses, gapIndex, heightRun.draftClass)) continue;

        const isRightEdge = gapIndex === sortedAnchors.length;
        if (isRightEdge) sortedAnchors[lastIndex].right = null;
        else sortedAnchors[gapIndex].left = null;
    }

    // 4. The "+" left stand at the middle of the new cabinet's height: low for a short one, high for a tall one
    //    (not at the middle of the neighbour, which may be of the other class). The row cabinets share one bottom.
    const rowBottomY = Math.min(...sortedAnchors.map(anchor => anchor.bottomY));
    // Anchors without a measured bottom: the "+" keep the anchor height.
    if (!Number.isFinite(rowBottomY)) return;

    const plusY = rowBottomY + heightRun.draftHeightCm / 100 / 2;
    for (const anchor of sortedAnchors) {
        if (anchor.left) anchor.left.y = plusY;
        if (anchor.right) anchor.right.y = plusY;
    }
}

/**
 * Refuses a UF cabinet that would leave a short cabinet between tall ones. Every add of the API comes here
 * (addProduct, addProductByLeft / Right, setProductByParams → SceneManager.addProductByParams).
 * @param {CompositionManager} compositionManager
 * @param {object} draftConfig the full config of the new product (SceneManager._newProductConfig)
 * @param {string|null} prevEntityId
 * @param {string} side 'left' | 'right'
 * @throws {Error} code UF_HEIGHT_RUN_VIOLATION, operation 'insert'
 */
export function assertUFInsert(compositionManager, draftConfig, prevEntityId, side) {
    // 1. Only a UF cabinet in a standard row.
    if (!isUFRowProduct(draftConfig)) return;
    if (compositionManager.preserveCabinetPositions) return;

    // 2. No composition yet: the first cabinet always fits.
    const composition = compositionManager.getActiveComposition();
    if (!composition) return;

    // 3. Not a UF row, or a height the rule does not know: the add goes on.
    const rowProductIds = rowCabinetIdsInOrder(compositionManager, composition);
    const heightRun = ufHeightRun(rowProductIds, composition.getAllProducts(), draftConfig);
    if (!heightRun) return;

    // 4. The place PositionBuilder will give the cabinet must keep the tall block whole.
    const insertIndex = insertIndexInRow(rowProductIds, prevEntityId, side);
    if (ufInsertAllowed(heightRun.rowClasses, insertIndex, heightRun.draftClass)) return;

    LoggerService.warn(LOG_CONTEXT, `UF insert refused at position ${insertIndex}: ${heightRun.draftClass} cabinet`);
    throw ufHeightRunError(
        `a ${heightRun.draftClass} cabinet at position ${insertIndex}`,
        { operation: 'insert', draftClass: heightRun.draftClass, insertIndex }
    );
}

/**
 * Refuses a swap of two UF row cabinets that would leave a short cabinet between tall ones.
 * Allowed rows: short, tall, short / short, short, tall, tall / short, tall, tall, tall.
 * @param {CompositionManager} compositionManager
 * @param {string} productIdA
 * @param {string} productIdB
 * @throws {Error} code UF_HEIGHT_RUN_VIOLATION, operation 'swap'
 */
export function assertUFSwap(compositionManager, productIdA, productIdB) {
    // 1. Standard rows only.
    if (compositionManager.preserveCabinetPositions) return;
    const composition = compositionManager.getActiveComposition();
    if (!composition) return;

    // 2. Two cabinets of the row; anything else goes to CompositionManager.swapProducts as before.
    const rowProductIds = rowCabinetIdsInOrder(compositionManager, composition);
    const indexA = rowProductIds.indexOf(productIdA);
    const indexB = rowProductIds.indexOf(productIdB);
    if (indexA === -1 || indexB === -1) return;

    // 3. Not a UF row: no rule.
    const rowClasses = ufRowClasses(rowProductIds, composition.getAllProducts());
    if (!rowClasses) return;

    // 4. The row after the swap must keep the tall cabinets in one block.
    if (ufSwapAllowed(rowClasses, indexA, indexB)) return;

    LoggerService.warn(LOG_CONTEXT, `UF swap refused: "${productIdA}" <-> "${productIdB}"`);
    throw ufHeightRunError(
        `swapping "${productIdA}" and "${productIdB}"`,
        { operation: 'swap', productIds: [productIdA, productIdB] }
    );
}

/**
 * The cabinet classes of a UF row and of the cabinet about to join it.
 * @returns {{ rowClasses: ('tall'|'short'|null)[], draftClass: 'tall'|'short', draftHeightCm: number }|null}
 *   null when the rule does not apply: a row cabinet is not UF, or the new cabinet's height is not a UF height
 *   (warned, not blocked)
 */
function ufHeightRun(rowProductIds, products, draftConfig) {
    // 1. The rule is for UF rows only (an empty row has nothing to break).
    const rowClasses = ufRowClasses(rowProductIds, products);
    if (!rowClasses) return null;

    // 2. A height the UF policy does not know: let the cabinet in, but say so.
    const draftClass = ufCabinetClassOf(draftConfig);
    if (draftClass === null) {
        LoggerService.warn(
            LOG_CONTEXT,
            `UF height rule skipped: ${draftConfig?.Height} is not a UF height`
        );
        return null;
    }

    const draftHeightCm = resolveUFHeight(draftConfig.Height);
    return { rowClasses, draftClass, draftHeightCm };
}

/**
 * The classes of the row cabinets, or null when one of them is not UF (the rule is for UF rows only).
 * A cabinet whose height is not a UF height is null: the rule leaves it out (warned).
 * @example ufRowClasses(['a', 'b', 'c'], products) // → ['tall', 'tall', 'short']
 */
function ufRowClasses(rowProductIds, products) {
    const rowConfigs = rowProductIds.map(productId => products[productId]);
    if (!rowConfigs.every(isUFRowProduct)) return null;

    const rowClasses = rowConfigs.map(ufCabinetClassOf);
    if (rowClasses.includes(null)) {
        LoggerService.warn(LOG_CONTEXT, 'UF height rule: a row cabinet has no UF height, it is left out');
    }
    return rowClasses;
}

/** The cabinets of the composition left to right (product ids by order index). */
function rowCabinetIdsInOrder(compositionManager, composition) {
    const orderIds = composition.getOrderProductIds();
    return compositionManager
        .getProductIdsByCategory('cabinets')
        .sort((a, b) => (orderIds[a] ?? 0) - (orderIds[b] ?? 0));
}

/**
 * The row position PositionBuilder.addEntity gives a new cabinet: before prevEntityId for side 'left', after it otherwise.
 * @example insertIndexInRow(['a', 'b', 'c'], 'b', 'left') // → 1
 * @example insertIndexInRow(['a', 'b', 'c'], null, 'left') // → 3
 */
function insertIndexInRow(rowProductIds, prevEntityId, side) {
    const anchorIndex = rowProductIds.indexOf(prevEntityId);

    // No anchor (null, or not in the row): PositionBuilder appends the cabinet at the end.
    if (anchorIndex === -1) return rowProductIds.length;

    return side === 'left' ? anchorIndex : anchorIndex + 1;
}

/**
 * Refusal of an insert or a swap that would leave a short UF cabinet between tall ones.
 * @param {string} change what was asked, for the message
 * @param {object} details the fields the caller can read: operation ('insert' | 'swap') and its arguments
 */
function ufHeightRunError(change, details) {
    return Object.assign(
        new Error(
            `UF row: ${change} would leave a short cabinet between tall ones ` +
            '(tall cabinets stand in one block, short ones only beside it)'
        ),
        { code: 'UF_HEIGHT_RUN_VIOLATION', ...details }
    );
}
