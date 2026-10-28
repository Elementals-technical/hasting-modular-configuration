/**
 * Urban Duplex test presets — the manufacturer cases as compact presets (urban-compact-v2), one click each
 * in the "Test presets" group of sections/urban-duplex.mjs (Load = removeAllProduct → importCompactPreset).
 *
 * Why a data file: the cases are project data that change with the manufacturer's measurements; the
 * section only lists them. Each entry is { id, label, inches, preset }, e.g.
 *   { id: 'case2', label: 'Case 2 · shifted column', inches: '70.7″', preset: v2({}, [ … ]) }.
 * Low (28) cabinets take Drawers '1D' and HandleStyle 'Duplex', or 'Default' when Width ≤ 40 (handleOf, same rule as the section's handleStyleFor).
 */
// No import from sections/urban-duplex.mjs: the section imports this file, a cycle would leave these constants
// in the TDZ when the section loads first.

const SIDE = 'UD-side-cabinet';
const SINK = 'UD-sink-cabinet';
const OPEN_SHELVES = 'UD-open-shelves';
const SINK_TYPE = 'Top_HPLPrisma';
const FULL_HEIGHT = 56;
const LOW_HEIGHT = 28;
const FULL_DRAWERS = '2D';
const LOW_DRAWERS = '1D';
const HANDLE_DUPLEX = 'Duplex';
const HANDLE_DEFAULT = 'Default';
/** Same rule as handleStyleFor of the section: Width ≤ 40 → 'Default'. handleOf(35) → 'Default'; handleOf(50) → 'Duplex'. */
const handleOf = width => (width <= 40 ? HANDLE_DEFAULT : HANDLE_DUPLEX);

/** The sample preset of the section's Example button (moved here from sections/urban-duplex.mjs): 56 sink · 28 column · 56 side. */
export const EXAMPLE_COMPACT_PRESET = Object.freeze({
    format: 'urban-compact-v2',
    collection: 'UD',
    shared: { Depth: 46, CabinetColor: 'Rox Black TKQ', CountertopColor: 'Pietra Di Savoia Antracite TQ6' },
    rows: [{ products: [
        { name: SINK, Width: 70, Height: FULL_HEIGHT, Drawers: FULL_DRAWERS, HandleStyle: HANDLE_DUPLEX, sinkType: SINK_TYPE },
        { Width: 50, Drawers: LOW_DRAWERS, HandleStyle: HANDLE_DUPLEX,
            top: { name: SIDE, Height: LOW_HEIGHT }, bottom: { name: SIDE, Height: LOW_HEIGHT } },
        { name: SIDE, Width: 60, Height: FULL_HEIGHT, Drawers: FULL_DRAWERS, HandleStyle: HANDLE_DUPLEX }] }],
    top: { productType: 'Top_Solid' }
});

/** Fields every UD test preset shares (cm and catalog colour names). */
export const UD_SHARED = Object.freeze({ Depth: 50.5, CabinetColor: 'Rox Black TKQ', CountertopColor: 'Pietra Di Savoia Antracite TQ6' });

/**
 * One-row compact preset of the columns format. `shared` overrides UD_SHARED.
 * v2({}, [{ name: 'UD-side-cabinet', Width: 60, Height: 56 }]) → { format: 'urban-compact-v2', collection: 'UD', … }.
 */
export function v2(shared, products) {
    return { format: 'urban-compact-v2', collection: 'UD', shared: { ...UD_SHARED, ...shared }, rows: [{ products }],
        top: { productType: 'Top_Solid' } };
}

/** A cabinet of the given height / drawers; the handle follows the width. cabinet(SINK, 70) → sink cabinet 70 × 28 with sinkType. */
function cabinet(name, Width, { Height = LOW_HEIGHT, Drawers = LOW_DRAWERS } = {}) {
    const item = { name, Width, Height, Drawers, HandleStyle: handleOf(Width) };
    if (name === SINK) item.sinkType = SINK_TYPE;
    return item;
}

/** A column place: `top` hangs from the plane, `bottom` stands on the floor shifted by offsetX cm (left edge vs the top's). */
function column(top, bottom, offsetX) {
    const place = {};
    if (top) place.top = top;
    if (bottom) place.bottom = offsetX === undefined ? bottom : { ...bottom, offsetX };
    return place;
}

export const UD_TEST_PRESETS = Object.freeze([
    { id: 'example', label: 'Example (56 · column · 56)', inches: '', preset: EXAMPLE_COMPACT_PRESET },
    { id: 'case1', label: 'Case 1 · shifted column + lone bottom', inches: '59″',
        preset: v2({}, [column(cabinet(SINK, 70), cabinet(SIDE, 70), 45), column(null, cabinet(SIDE, 35))]) },
    { id: 'case2', label: 'Case 2 · wide bottom under a sink', inches: '70.7″',
        preset: v2({}, [column(cabinet(SINK, 90), cabinet(SIDE, 105), 75)]) },
    // All four hang at the plane: lone tops of one row.
    { id: 'case3', label: 'Case 3 · hanging row of 28', inches: '96.5″',
        preset: v2({}, [cabinet(SINK, 105), cabinet(SIDE, 35), cabinet(SIDE, 35), cabinet(SIDE, 70)].map(top => column(top))) },
    { id: 'case4', label: 'Case 4 · 56 sink · side · sink', inches: '76.8″',
        preset: v2({}, [cabinet(SINK, 80, { Height: FULL_HEIGHT, Drawers: FULL_DRAWERS }), cabinet(SIDE, 35, { Height: FULL_HEIGHT, Drawers: FULL_DRAWERS }),
            cabinet(SINK, 80, { Height: FULL_HEIGHT, Drawers: FULL_DRAWERS })]) },
    { id: 'case5', label: 'Case 5 · 38 high', inches: '67″',
        preset: v2({}, [cabinet(SIDE, 50, { Height: 38 }), cabinet(SIDE, 50, { Height: 38 }), cabinet(SINK, 70, { Height: 38 })]) },
    // 55: the render is 145.3 cm wide = 55 + 90 (the bottom side cabinet ends at 145).
    { id: 'case6', label: 'Case 6 · shifted column', inches: '57.2″',
        preset: v2({}, [column(cabinet(SINK, 70), cabinet(SIDE, 90), 55)]) },
    // UI preset 34 (Multi-Level 61″) with its offset fixed (47 → 45): a shifted column and a 28 open shelf beside it.
    { id: 'multiLevel61OpenShelf', label: 'Multi-Level 61″ · column + open shelf', inches: '61″',
        preset: v2({}, [
            column({ ...cabinet(SINK, 70), HandleSide: 'Right', sinkType: 'Top_HPLStrip' },
                { ...cabinet(SIDE, 70), HandleSide: 'Left' }, 45),
            column(null, { name: OPEN_SHELVES, Width: 35, Height: LOW_HEIGHT })]) }
]);
