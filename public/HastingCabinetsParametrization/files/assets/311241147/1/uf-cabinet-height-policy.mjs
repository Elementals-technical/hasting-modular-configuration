/**
 * Urban Freestanding height: the cabinet height in cm with its 3 cm plinth, as the config guide and the UI give it.
 *
 * The UI sends the height that goes with the handle (UG / CG 91, PTO 88; short: UG / CG 56, PTO 53),
 * and the v69 models are built for these heights, so the size tables are keyed by them directly.
 */

export const UF_HANDLES = Object.freeze({
    upperGroove: 'UG',
    centralGroove: 'CG',
    pushToOpen: 'PTO'
});

/** Heights the UF size tables have values for (NEW sheet A26:A29). */
export const UF_HEIGHTS = Object.freeze([53, 56, 88, 91]);

const CENTRAL_GROOVE_HEIGHT = 91;

/** Central Groove on the 91 cabinet: the one case where CG differs from UG (own fronts and side-panel column). */
export const isCentralGrooveTall = (height, handle) =>
    height === CENTRAL_GROOVE_HEIGHT && handle === UF_HANDLES.centralGroove;

// Every short height (53 / 56) is below this, every tall one (88 / 91) above it.
const SHORT_CABINET_MAX_HEIGHT = 60;

/**
 * A short UF cabinet: below the 60 cm threshold; tall ones are 88 / 91.
 * Read by the UF row rule (cabinet-placement/uf-height-run-policy.mjs).
 * @example isShortCabinet(56) // → true
 */
export const isShortCabinet = height => Number.isFinite(height) && height < SHORT_CABINET_MAX_HEIGHT;

/**
 * The UF height of a config value, or null when the size tables have no values for it.
 * @example resolveUFHeight('88') // → 88
 * @example resolveUFHeight(85)   // → null
 */
export function resolveUFHeight(height) {
    const requestedHeight = Number(height);
    return UF_HEIGHTS.includes(requestedHeight) ? requestedHeight : null;
}

/**
 * The UF height of a product state (anything with get(key), like a rule's currentState).
 * @example ufHeightOf(currentState) // → 91
 */
export function ufHeightOf(state) {
    return resolveUFHeight(state.get('Height'));
}
