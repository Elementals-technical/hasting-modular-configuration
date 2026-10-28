import { createCabinetRowsLayoutPolicy } from './adapters/cabinet-rows-layout.mjs';
import { createColumnRowsLayoutPolicy } from './adapters/cabinet-columns-layout.mjs';
import { ULH_PACK, UD_PACK } from './collections/urban.pack.mjs';

/**
 * Every modular collection is laid out in ROWS of places. A collection may declare `columns: true`: its rows then
 * may hold a column in a place — a `top` hanging from the countertop plane over a `bottom` on the floor (Urban
 * Duplex; domain/cabinet-placement/columns/). Without it a place is always one cabinet (ULH).
 * Today the two cases run on two row engines and two layout policies (cabinet-rows-layout.mjs vs
 * cabinet-columns-layout.mjs); see columns/README.md "Future refactor" for the planned single row engine.
 */
const rowPolicyFor = ({ columns, pack }) => options => (columns ? createColumnRowsLayoutPolicy : createCabinetRowsLayoutPolicy)(
    // The pack's tier height is the countertop plane of a row with columns (plain rows ignore it).
    { ...options, tierHeightM: pack?.geometry?.tierHeightM ?? null });

// A modular collection: only the id, the type prefix, the pack and whether its rows may hold columns differ.
const rowsCollection = ({ id, typePrefix, pack, columns = false }) => Object.freeze({
    id, catalogVersion: 'local-registry-v1', policyVersion: 'free-layout-v1', columns,
    matches: productType => typeof productType === 'string' && productType.startsWith(typePrefix),
    createLayoutPolicy: rowPolicyFor({ columns, pack }),
    pack
});

/**
 * Modular (free-layout) cabinet collections.
 *
 * The local modular runtime owns the active composition only while EVERY cabinet in it
 * belongs to ONE of these collections (or the composition has no cabinets yet and the
 * incoming command adds a modular cabinet). Everything else — Urban, Class, Mako, mixed
 * compositions — keeps the legacy line layout untouched.
 *
 * Add a ULH-like collection with one line: rowsCollection({ id, typePrefix, pack }); rows that may hold columns:
 * rowsCollection({ …, columns: true }). A collection with another layout altogether: append the full entry
 *   { id, catalogVersion, policyVersion, matches(productType) -> boolean, pack?,
 *     createLayoutPolicy?({ app, collection, compositionId, matches, getProductConfig }) -> FreeLayoutPolicy | null }
 * (FreeLayoutPolicy contract: see cabinet-local-runtime.mjs.)
 * `pack` is the collection's placement data (roles, traits, tolerances, rules, messages — see
 * collections/*.pack.mjs); the placement kernel validates drafts with it. No pack = collision only.
 */
export const MODULAR_COLLECTIONS = Object.freeze([
    rowsCollection({ id: 'ULH', typePrefix: 'ULH-', pack: ULH_PACK }),
    // Urban Duplex: same placement rules as ULH; its rows may hold columns (28 over 28 next to a 56).
    rowsCollection({ id: 'UD', typePrefix: 'UD-', pack: UD_PACK, columns: true })
]);

/** Whether the rows of a collection may hold columns; false for a plain rows collection or an unknown one.
 *   usesColumns('UD') -> true; usesColumns('ULH') -> false; usesColumns('Mako') -> false */
export function usesColumns(collectionId, collections = MODULAR_COLLECTIONS) {
    return collections.find(candidate => candidate.id === collectionId)?.columns === true;
}

const read = (snapshot, key) => typeof snapshot?.get === 'function' ? snapshot.get(key) : snapshot?.[key];

export function findModularCollection(productType, collections = MODULAR_COLLECTIONS) {
    return collections.find(collection => collection.matches(productType)) ?? null;
}

export function findModularCollectionById(id, collections = MODULAR_COLLECTIONS) {
    return collections.find(collection => collection.id === id) ?? null;
}

/** Role of a cabinet type in its collection's pack: 'SB' (sink base), 'SC', 'OS', 'OSS'; null if none. */
export function roleOfType(productType, collections = MODULAR_COLLECTIONS) {
    return findModularCollection(productType, collections)?.pack?.roles?.[productType] ?? null;
}

/**
 * The cabinet type with `role` in the same collection as `productType`, or null.
 *   ('ULH-sink-cabinet', 'SC') -> 'ULH-side-cabinet'
 */
export function typeWithRoleBeside(productType, role, collections = MODULAR_COLLECTIONS) {
    const roles = findModularCollection(productType, collections)?.pack?.roles ?? {};
    const match = Object.entries(roles).find(([, candidateRole]) => candidateRole === role);
    return match ? match[0] : null;
}

/** Public, serializable identity of a collection (document/preset `collection`). */
export const collectionDescriptor = collection => collection
    ? { id: collection.id, catalogVersion: collection.catalogVersion, policyVersion: collection.policyVersion } : null;

/** Cabinet product types -> 'empty' (none), 'modular' (all in one collection) or 'legacy'. */
export function classifyCabinetTypes(productTypes, collections = MODULAR_COLLECTIONS) {
    const owners = new Set();
    for (const type of productTypes) {
        const owner = findModularCollection(type, collections);
        if (!owner) return { status: 'legacy', collection: null };
        owners.add(owner);
    }
    if (owners.size > 1) return { status: 'legacy', collection: null };
    return owners.size ? { status: 'modular', collection: [...owners][0] } : { status: 'empty', collection: null };
}

/** Classify composition products (legacy snapshot map). Only category 'cabinets' counts. */
export function classifyCompositionProducts(products, collections = MODULAR_COLLECTIONS) {
    const types = Object.values(products ?? {}).filter(snapshot => read(snapshot, 'category') === 'cabinets')
        .map(snapshot => read(snapshot, 'productType'));
    return classifyCabinetTypes(types, collections);
}
