import { CABINET_LAYOUT_GAP_METERS } from '../composition/layout-constants.mjs';
import { CABINET_COLUMNS_POLICY_ID, boxFromPivot, columnRowFromBoxes, cabinetsOfRow, COLUMN_SLOTS, bottomOffsetOf, columnPlace, layoutColumnRow, cabinetsOfPlace } from './columns/cabinet-columns.mjs';

const COMPACT_PRESET_FORMAT = 'ulh-compact-v1';
/** Compact format with columns: a row item may be { top, bottom } instead of one cabinet. */ // Which reader/writer handles a document is decided in domain/presets (one record per format, resolve() picks one);
// this module keeps the row geometry both compact formats share. Split the v1/v2 writers physically only when a
// third rows format or one row engine for rows and columns arrives (see columns/README "Future refactor").
const COLUMNS_PRESET_FORMAT = 'urban-compact-v2';
const COMPACT_FORMATS = [
    COMPACT_PRESET_FORMAT,
    COLUMNS_PRESET_FORMAT
];
const CENTIMETRES_PER_METRE = 100;
/** Fields that stay on each cabinet of a column: a column is as tall as both cabinets together, so Height is never a place field. */ const SLOT_ONLY_FIELDS = [
    'name',
    'Height'
];
/** Row anchor Z when the first cabinet has no Depth: the middle of a 46 cm deep cabinet. */ const DEFAULT_ROW_ANCHOR_Z_M = 0.23;
const DEFAULT_GAP_M = CABINET_LAYOUT_GAP_METERS;
const TOP_SUBSYSTEM = 'runtime-product';
const DROPPED_SELECTION = [
    'productType',
    'category',
    'SpatialOffsetM',
    'SupportGroupId',
    'positionX',
    'positionY',
    'positionZ',
    'entityName',
    'productId'
];
const DEFAULT_TOP_GROUP = 'group-1'; // DEFAULT_COUNTERTOP_SUPPORT_GROUP_ID: the sink row takes the top's group
const DROPPED_TOP = [
    'productType',
    'category',
    'SupportGroupId',
    'CountertopLengthM',
    'CountertopSinkShiftM',
    'SpatialOffsetM',
    'positionX',
    'positionY',
    'positionZ',
    'entityName',
    'productId'
];
const fail = (code, detail)=>{
    const e = new Error(detail ? `${code}: ${detail}` : code);
    e.code = code;
    throw e;
};
const isRecord = (v)=>v !== null && typeof v === 'object' && !Array.isArray(v);
const validId = (v)=>typeof v === 'string' && v.trim().length > 0 && ![
        '__proto__',
        'prototype',
        'constructor'
    ].includes(v);
const clone = (v)=>v === undefined ? v : structuredClone(v);
const m9 = (v)=>Math.round(v * 1e9) / 1e9 || 0;
const cm2 = (v)=>Math.round(v * 100) / 100 || 0;
const vecM = (v)=>({
        x: m9(v.x),
        y: m9(v.y),
        z: m9(v.z)
    });
const isVec = (v)=>isRecord(v) && [
        'x',
        'y',
        'z'
    ].every((a)=>Number.isFinite(v[a]));
const widthM = (sel)=>Number.isFinite(sel?.Width) ? sel.Width / 100 : NaN;
const hasSink = (sel)=>typeof sel?.sinkType === 'string' && sel.sinkType.trim() !== '' && sel.sinkType !== 'None';
const heightM = (sel)=>Number.isFinite(sel?.Height) ? sel.Height / CENTIMETRES_PER_METRE : NaN;
/** A cabinet top this close to the row plane carries the countertop: the default toleranceM of the countertop support
 * resolver (countertop-support-resolver.mjs). */ const COUNTERTOP_PLANE_TOLERANCE_M = 0.001;
/**
 * Selection of one cabinet: catalog defaults, then each field layer (a later layer wins), then the fixed cabinet fields.
 * Example: cabinetSelection('UD-side-cabinet', [{ Depth: 46 }, { Width: 40 }, { Height: 28 }], defaultsOf)
 *   -> { ...defaults, Depth: 46, Width: 40, Height: 28, productType: 'UD-side-cabinet', category: 'cabinets', SpatialOffsetM: { x: 0, y: 0 } }.
 */ function cabinetSelection(name, fieldLayers, defaultsOf) {
    const merged = fieldLayers.reduce((selection, fields)=>({
            ...selection,
            ...clone(fields)
        }), clone(defaultsOf(name) ?? {}));
    return {
        ...merged,
        productType: name,
        category: 'cabinets',
        SpatialOffsetM: {
            x: 0,
            y: 0
        }
    };
}
/** Row anchor Z: the middle of the first cabinet's depth. Example: Depth 46 (cm) -> 0.23 (m). */ function rowAnchorZM(selection) {
    // No Depth to measure: use the usual cabinet depth.
    if (!Number.isFinite(selection.Depth)) return DEFAULT_ROW_ANCHOR_Z_M;
    return selection.Depth / CENTIMETRES_PER_METRE / 2;
}
/**
 * What a compact row item is: 'cabinet' when it has a name, 'column' when it has a top and/or a bottom instead.
 * Example: { name: 'UD-side-cabinet' } -> 'cabinet'; { Width: 40, top: { name: 'UD-sink-cabinet' } } -> 'column'.
 */ function rowItemKind(item, rowIndex) {
    // Not an object: there is nothing to read a cabinet from.
    if (!isRecord(item)) fail('PRESET_INVALID', `row ${rowIndex} product`);
    if (Object.hasOwn(item, 'name')) return 'cabinet';
    const hasSlot = COLUMN_SLOTS.some((slot)=>item[slot] !== undefined);
    // Neither a cabinet name nor a column slot: nothing to place.
    if (!hasSlot) fail('PRESET_INVALID', `row ${rowIndex} product`);
    return 'column';
}
/**
 * The collection's tier height (m) as a number: 0 when there is none.
 * Example: 0.56 -> 0.56; undefined -> 0; -1 -> throws PRESET_INVALID.
 */ function tierHeightOrZero(tierHeightM) {
    // No tier height given: the plane comes from the cabinets alone.
    if (tierHeightM === undefined || tierHeightM === null) return 0;
    if (!Number.isFinite(tierHeightM) || tierHeightM < 0) fail('PRESET_INVALID', 'tierHeightM');
    return tierHeightM;
}
/**
 * The shift of a column's bottom cabinet in metres: its compact `bottom.offsetX` (cm, any sign) / 100; 0 without it.
 * Example: { top: {…}, bottom: { name: 'UD-side-cabinet', offsetX: 45 } } -> 0.45; { bottom: { name: 'UD-side-cabinet' } } -> 0.
 */ function bottomOffsetMOfItem(item, rowIndex) {
    const offsetCentimetres = isRecord(item.bottom) ? item.bottom.offsetX : undefined;
    // No offsetX: the bottom is aligned with the top.
    if (offsetCentimetres === undefined) return 0;
    if (!Number.isFinite(offsetCentimetres)) fail('PRESET_INVALID', `row ${rowIndex} bottom offsetX`);
    return m9(offsetCentimetres / CENTIMETRES_PER_METRE);
}
/**
 * The cabinet item of one column slot without its placement field: the bottom's offsetX places the cabinet, it is not
 * part of the cabinet's selection. Example: bottom { name: 'UD-side-cabinet', Height: 28, offsetX: 45 } -> { name, Height: 28 }.
 */ function slotCabinetItem(item, slot) {
    const cabinetItem = item[slot];
    // Only the bottom carries offsetX; a non-object is left for addCabinet to reject.
    if (slot !== 'bottom' || !isRecord(cabinetItem)) return cabinetItem;
    const { offsetX: _placementOnly, ...selectionFields } = cabinetItem;
    return selectionFields;
}
/**
 * Cabinets of a row that has at least one column (cm in, m out).
 * 1. Every row item becomes a place: a cabinet is { full }, a column is { top, bottom } (a slot may be empty).
 *    Column cabinet selection = defaults <- shared <- place fields <- the cabinet's own fields.
 *    A column with both cabinets and bottom.offsetX ≠ 0 is shifted: place.bottomOffsetM = offsetX / 100.
 * 2. The row plane (topM) = row level + the higher of its tallest place and tierHeightM; a column is as tall as its
 *    cabinets together.
 * 3. layoutColumnRow gives every cabinet its pivot; cabinets expand at z = 0, like plain rows.
 * Example: [{ name: 'UD-side-cabinet', Width: 60, Height: 56 }, { Width: 40, top: { name: 'UD-sink-cabinet', Height: 28 },
 *   bottom: { name: 'UD-side-cabinet', Height: 28 } }] at leftM 0 -> topM 0.56; top at { x: 0.8005, y: 0.28 }, bottom at { x: 0.8005, y: 0 }.
 * Shifted example: [{ Width: 70, top: { name: 'UD-sink-cabinet', Height: 28 }, bottom: { name: 'UD-side-cabinet', Height: 28, offsetX: 45 } }]
 *   at leftM 0 -> top at { x: 0.35, y: 0.28 }, bottom at { x: 0.80, y: 0 }, rightM 1.15.
 * Tier example: [{ Width: 40, top: { name: 'UD-sink-cabinet', Height: 28 } }] with tierHeightM 0.56 -> topM 0.56, top at y 0.28
 *   (without tierHeightM: topM 0.28, top at y 0).
 * Returns { products, positions, keys, rightM, topM, countertop, anchorZM }; countertop = { keys, leftM, rightM } of the
 * cabinets that reach the plane (null when none does).
 */ function expandColumnRow(row, rowIndex, { leftM, bottomM, gapM, tierHeightM, shared, defaultsOf, nextKey }) {
    const products = [], places = [], sizes = new Map();
    const addCabinet = (cabinetItem, placeFields)=>{
        // No catalog name: the cabinet cannot be built.
        if (!isRecord(cabinetItem) || !validId(cabinetItem.name)) fail('PRESET_INVALID', `row ${rowIndex} product name`);
        const { name, ...ownFields } = cabinetItem;
        const selection = cabinetSelection(name, [
            shared,
            placeFields,
            ownFields
        ], defaultsOf);
        const cabinetWidthM = widthM(selection);
        const cabinetHeightM = heightM(selection);
        // A cabinet without a size takes no space in the row.
        if (!(cabinetWidthM > 0)) fail('PRESET_INVALID', `row ${rowIndex} ${name} Width`);
        if (!(cabinetHeightM > 0)) fail('PRESET_INVALID', `row ${rowIndex} ${name} Height`);
        const key = nextKey();
        products.push({
            key,
            definitionId: name,
            selection,
            roleId: 'cabinet',
            placementMode: 'remote',
            frameId: 'wall'
        });
        sizes.set(key, {
            widthM: cabinetWidthM,
            heightM: cabinetHeightM
        });
        return key;
    };
    // 1. Places, left -> right; the top cabinet of a column is added before its bottom.
    for (const item of row.products){
        if (rowItemKind(item, rowIndex) === 'cabinet') {
            places.push({
                full: addCabinet(item, {})
            });
            continue;
        }
        const placeFields = Object.fromEntries(Object.entries(item).filter(([field])=>!COLUMN_SLOTS.includes(field)));
        const slotKeys = {};
        for (const slot of COLUMN_SLOTS){
            // An empty slot: the column holds only its other cabinet.
            if (item[slot] === undefined) continue;
            slotKeys[slot] = addCabinet(slotCabinetItem(item, slot), placeFields);
        }
        // The stored form of the column: a shift only with both cabinets (one cabinet is never shifted).
        places.push(columnPlace({
            ...slotKeys,
            bottomOffsetM: bottomOffsetMOfItem(item, rowIndex)
        }));
    }
    // 2. The plane: the tallest place, or the tier height when it is higher (a lone 28 top still hangs from 0.56).
    const placeHeightM = (place)=>cabinetsOfPlace(place).reduce((sum, key)=>sum + sizes.get(key).heightM, 0);
    const tallestPlaceM = Math.max(...places.map(placeHeightM));
    const topM = m9(bottomM + Math.max(tallestPlaceM, tierHeightM));
    // 3. Pivots.
    const columnRow = {
        leftM,
        bottomM,
        topM,
        zM: 0,
        places
    };
    const pivots = layoutColumnRow(columnRow, sizes, {
        gapM
    });
    const positions = products.map(({ key })=>{
        const pivot = pivots.get(key);
        return {
            key,
            positionM: vecM({
                x: pivot.pivotXM,
                y: pivot.pivotYM,
                z: pivot.zM
            })
        };
    });
    const rightM = Math.max(...products.map(({ key })=>pivots.get(key).pivotXM + sizes.get(key).widthM / 2));
    // 4. What the basin top covers: the cabinets whose top reaches the plane (column tops, full places), not a column
    //    bottom or a lone low cabinet. Multi-Level 70″: [top shelf 15][top sink 70 / bottom 35][bottom 90] -> shelf, sink.
    const reachesPlane = (key)=>Math.abs(pivots.get(key).pivotYM + sizes.get(key).heightM - topM) <= COUNTERTOP_PLANE_TOLERANCE_M;
    const countertopKeys = cabinetsOfRow(columnRow).filter(reachesPlane);
    const leftEdgeM = (key)=>pivots.get(key).pivotXM - sizes.get(key).widthM / 2;
    const rightEdgeM = (key)=>pivots.get(key).pivotXM + sizes.get(key).widthM / 2;
    const countertop = countertopKeys.length === 0 ? null : {
        keys: countertopKeys,
        leftM: Math.min(...countertopKeys.map(leftEdgeM)),
        rightM: Math.max(...countertopKeys.map(rightEdgeM))
    };
    return {
        products,
        positions,
        keys: cabinetsOfRow(columnRow),
        rightM,
        topM,
        countertop,
        anchorZM: rowAnchorZM(products[0].selection)
    };
}
/**
 * Countertop Y of a top attached to a row (no positionM in the preset).
 * Example: a column row with plane 0.56 -> 0.56; a plain row at 0 whose sink cabinet is 85 high -> 0.85.
 */ function countertopLevelM(row, sinkSelection) {
    // A column row has its plane: the sink cabinet may be a low one inside a column.
    if (row.topM !== undefined) return row.topM;
    const sinkHeightM = Number.isFinite(sinkSelection.Height) ? sinkSelection.Height / CENTIMETRES_PER_METRE : 0;
    return row.bottomM + sinkHeightM;
}
/** Throws unless the row layout has an anchor and lists cabinets that the preset places. */ function assertRowLayout(rowLayout, byKey, abs) {
    const hasAnchor = isVec(rowLayout?.anchorPositionM);
    const hasCabinets = Array.isArray(rowLayout?.orderedKeys) && rowLayout.orderedKeys.length > 0;
    const allPlaced = hasCabinets && rowLayout.orderedKeys.every((key)=>byKey.has(key) && abs.has(key));
    if (!hasAnchor || !allPlaced) fail('PRESET_INVALID', 'localLayout');
}
/**
 * A column-policy layout read back as a row: { keys, leftM, bottomM, rightM, places }.
 * 1. Each cabinet's box comes from its pivot (bottom centre) and its Width/Height.
 * 2. columnRowFromBoxes finds the places: one cabinet on the floor, or a column (top over bottom, with its shift).
 *    The row floor is the layout anchor's Y (not the lowest box: a lone hanging top is above the floor), and
 *    tierHeightM (when > 0) fixes the plane at floor + tierHeightM.
 * Example: a 60x56 at x 0.3 and two 40x28 at x 0.8005 (y 0.28 and 0) -> places [{ full }, { top, bottom }].
 * Floor example: only a 40x28 at y 0.28 (anchor y 0), tierHeightM 0.56 -> places [{ top, bottom: null }].
 */ function columnRowFromLayout(columnLayout, byKey, abs, tierHeightM) {
    assertRowLayout(columnLayout, byKey, abs);
    // 1. Boxes.
    const boxes = new Map(columnLayout.orderedKeys.map((key)=>{
        const box = boxFromPivot(abs.get(key), byKey.get(key).selection);
        // Without Width and Height there is no box to find the cabinet's place from.
        if (!box) fail('PRESET_INVALID', `cabinet ${key} size`);
        return [
            key,
            box
        ];
    }));
    // 2. Places.
    const columnRow = columnRowFromBoxes(columnLayout.key, boxes, {
        tierHeightM,
        floorM: columnLayout.anchorPositionM.y
    });
    const rightM = Math.max(...[
        ...boxes.values()
    ].map((box)=>box.maxM.x));
    return {
        keys: cabinetsOfRow(columnRow),
        leftM: columnLayout.anchorPositionM.x,
        bottomM: columnRow.bottomM,
        rightM,
        places: columnRow.places
    };
}
/**
 * A place as a compact row item. Full: the cabinet's item. Column: { ...fields both cabinets share, top?, bottom? }.
 * Height and name stay on each cabinet (SLOT_ONLY_FIELDS).
 * Example: top { name: 'UD-sink-cabinet', Width: 40, Height: 28 }, bottom { name: 'UD-side-cabinet', Width: 40, Height: 28 }
 *   -> { Width: 40, top: { name: 'UD-sink-cabinet', Height: 28 }, bottom: { name: 'UD-side-cabinet', Height: 28 } }.
 * Shifted example: the same column with bottomOffsetM 0.45 -> bottom { name: 'UD-side-cabinet', Height: 28, offsetX: 45 }
 *   (an aligned column writes no offsetX).
 */ function compactPlaceOf(place, itemsByKey) {
    // A full place is one cabinet on the floor: its item as is.
    if (Object.hasOwn(place, 'full')) return itemsByKey.get(place.full);
    const slotItems = COLUMN_SLOTS.filter((slot)=>place[slot] != null).map((slot)=>[
            slot,
            itemsByKey.get(place[slot])
        ]);
    const placeFields = {};
    // 1. With both slots taken, the fields equal in both cabinets move up to the place.
    if (slotItems.length === COLUMN_SLOTS.length) {
        const [[, topItem], [, bottomItem]] = slotItems;
        for (const [field, value] of Object.entries(topItem)){
            // Name and Height describe one cabinet, never the whole column.
            if (SLOT_ONLY_FIELDS.includes(field)) continue;
            const sameInBoth = Object.hasOwn(bottomItem, field) && deepEqual(bottomItem[field], value);
            if (sameInBoth) placeFields[field] = clone(value);
        }
    }
    // 2. Each cabinet keeps only the fields the place does not carry.
    const item = {
        ...placeFields
    };
    for (const [slot, slotItem] of slotItems){
        item[slot] = Object.fromEntries(Object.entries(slotItem).filter(([field])=>!Object.hasOwn(placeFields, field)));
    }
    // 3. A shifted column: the bottom carries its shift in cm (bottomOffsetOf is 0 for an aligned or half-empty column).
    const bottomOffsetM = bottomOffsetOf(place);
    if (bottomOffsetM !== 0) item.bottom = {
        ...item.bottom,
        offsetX: cm2(bottomOffsetM * CENTIMETRES_PER_METRE)
    };
    return item;
}
function deepEqual(a, b) {
    if (Object.is(a, b)) return true;
    if (typeof a === 'number' && typeof b === 'number') return a === b;
    if (Array.isArray(a) || Array.isArray(b)) {
        return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i)=>deepEqual(v, b[i]));
    }
    if (!isRecord(a) || !isRecord(b)) return false;
    const ka = Object.keys(a), kb = Object.keys(b);
    return ka.length === kb.length && ka.every((k)=>Object.hasOwn(b, k) && deepEqual(a[k], b[k]));
}
function diffVsDefaults(source, defaults, dropped) {
    const out = {};
    for (const [key, value] of Object.entries(source ?? {})){
        if (dropped.includes(key)) continue;
        if (isRecord(defaults) && Object.hasOwn(defaults, key) && deepEqual(defaults[key], value)) continue;
        out[key] = clone(value);
    }
    return out;
}
function isCompactPreset(value) {
    return isRecord(value) && COMPACT_FORMATS.includes(value.format) && Array.isArray(value.rows);
}
/**
 * compact (cm) -> portable preset v2 'exact' (m), accepted by instantiateExactPreset.
 * tierHeightM (m, optional): the collection's tier height; a column row's plane is at least row level + tierHeightM.
 * Example: a row with a lone { top: { name: 'UD-sink-cabinet', Width: 40, Height: 28 } } and tierHeightM 0.56
 *   -> the top's pivot at y 0.28, the countertop at y 0.56.
 */ function expandCompactPreset(compact, { collection, defaultsOf = ()=>({}), gapM = DEFAULT_GAP_M, tierHeightM, categoryOf = ()=>undefined, isSinkCabinet = (sel)=>hasSink(sel), topDefaults = ()=>({}) } = {}) {
    if (!isRecord(collection) || !validId(collection.id)) fail('PRESET_COLLECTION_REQUIRED');
    if (!isRecord(compact) || compact.format !== undefined && !COMPACT_FORMATS.includes(compact.format) || !Array.isArray(compact.rows) || !compact.rows.length) fail('PRESET_INVALID', 'rows');
    if (compact.collection !== undefined && compact.collection !== collection.id) fail('PRESET_COLLECTION_MISMATCH');
    if (compact.shared !== undefined && !isRecord(compact.shared)) fail('PRESET_INVALID', 'shared');
    if (compact.featureSettings !== undefined && !isRecord(compact.featureSettings)) fail('PRESET_INVALID', 'featureSettings');
    const shared = compact.shared ?? {};
    const tierHeightOfRowsM = tierHeightOrZero(tierHeightM);
    const products = [], layouts = [], positions = [], rowInfo = [];
    let cursor = 0, i = 0;
    compact.rows.forEach((row, r)=>{
        if (!isRecord(row) || !Array.isArray(row.products) || !row.products.length) fail('PRESET_INVALID', `row ${r}`);
        for (const f of [
            'elevation',
            'offsetX'
        ]){
            if (row[f] !== undefined && !Number.isFinite(row[f])) fail('PRESET_INVALID', `row ${r} ${f}`);
        }
        // Negative elevation is valid: ULH lowers the room (floor at -0.6 m), cabinets hang above it.
        const leftM = m9(row.offsetX !== undefined ? row.offsetX / 100 : r === 0 ? 0 : cursor + gapM);
        const bottomM = m9((row.elevation ?? 0) / 100);
        const itemKinds = row.products.map((item)=>rowItemKind(item, r));
        if (itemKinds.includes('column')) {
            const columnRow = expandColumnRow(row, r, {
                leftM,
                bottomM,
                gapM,
                tierHeightM: tierHeightOfRowsM,
                shared,
                defaultsOf,
                nextKey: ()=>`cabinet${i++}`
            });
            products.push(...columnRow.products);
            positions.push(...columnRow.positions);
            cursor = columnRow.rightM;
            rowInfo.push({
                keys: columnRow.keys,
                leftM,
                rightM: cursor,
                bottomM,
                topM: columnRow.topM,
                countertop: columnRow.countertop
            });
            layouts.push({
                key: `layout${r}`,
                kind: 'cabinet-row',
                frameId: 'wall',
                anchorPositionM: vecM({
                    x: leftM,
                    y: bottomM,
                    z: columnRow.anchorZM
                }),
                orderedKeys: columnRow.keys,
                policyId: CABINET_COLUMNS_POLICY_ID
            });
            // The column row is done; the code below lays out a plain row (one cabinet per place).
            return;
        }
        let x = leftM, zM = null;
        const keys = [];
        for (const item of row.products){
            if (!isRecord(item) || !validId(item.name)) fail('PRESET_INVALID', `row ${r} product name`);
            const { name, ...own } = item;
            const selection = cabinetSelection(name, [
                shared,
                own
            ], defaultsOf);
            const w = widthM(selection);
            if (!(w > 0)) fail('PRESET_INVALID', `row ${r} ${name} Width`);
            const key = `cabinet${i++}`;
            products.push({
                key,
                definitionId: name,
                selection,
                roleId: 'cabinet',
                placementMode: 'remote',
                frameId: 'wall'
            });
            positions.push({
                key,
                positionM: vecM({
                    x: x + w / 2,
                    y: bottomM,
                    z: 0
                })
            });
            zM ?? (zM = rowAnchorZM(selection));
            keys.push(key);
            x += w + gapM;
        }
        cursor = x - gapM;
        rowInfo.push({
            keys,
            leftM,
            rightM: cursor,
            bottomM
        });
        layouts.push({
            key: `layout${r}`,
            kind: 'cabinet-row',
            frameId: 'wall',
            anchorPositionM: vecM({
                x: leftM,
                y: bottomM,
                z: zM
            }),
            orderedKeys: keys,
            policyId: 'cabinet-rows-v1'
        });
    });
    layouts.sort((a, b)=>a.anchorPositionM.y - b.anchorPositionM.y || a.anchorPositionM.x - b.anchorPositionM.x);
    const primarySources = [];
    if (compact.top !== undefined) {
        const top = compact.top;
        if (!isRecord(top) || !validId(top.productType)) fail('PRESET_INVALID', 'top.productType');
        if (top.positionM !== undefined && !isVec(top.positionM)) fail('PRESET_INVALID', 'top.positionM');
        const byKey = new Map(products.map((p)=>[
                p.key,
                p
            ]));
        const isSink = (k)=>!!isSinkCabinet(byKey.get(k).selection, byKey.get(k).definitionId);
        const sinkRow = rowInfo.find((row)=>row.keys.some(isSink)) ?? rowInfo[0];
        const sinkSel = byKey.get(sinkRow.keys.find(isSink) ?? sinkRow.keys[0]).selection;
        const { productType, positionM, ...ownFields } = top;
        // Defaults (e.g. CountertopPositioning a normally created top gets) sit under the preset's own fields.
        const extra = topDefaults(clone(sinkSel), products.map((p)=>clone(p.selection)));
        const fields = {
            ...isRecord(extra) ? clone(extra) : {},
            ...ownFields
        };
        // A column row's top covers only the cabinets in its plane (expandColumnRow); a plain row, its whole row.
        const covered = sinkRow.countertop ?? sinkRow;
        let pos = positionM;
        if (!pos) pos = {
            x: (covered.leftM + covered.rightM) / 2,
            y: countertopLevelM(sinkRow, sinkSel),
            z: 0
        };
        primarySources.push({
            key: 'source0',
            subsystem: TOP_SUBSYSTEM,
            schemaVersion: 1,
            cabinetKeys: [
                ...covered.keys
            ],
            payload: {
                productType,
                config: {
                    ...clone(defaultsOf(productType) ?? {}),
                    ...clone(fields),
                    SupportGroupId: validId(fields.SupportGroupId) ? fields.SupportGroupId : DEFAULT_TOP_GROUP,
                    ...fields.category ?? categoryOf(productType) ? {
                        category: fields.category ?? categoryOf(productType)
                    } : {}
                },
                positionM: vecM(pos)
            }
        });
    }
    const anchor = positions[0];
    return {
        presetSchemaVersion: 2,
        collection: clone(collection),
        presetProducts: products,
        presetLayout: {
            layoutMode: 'exact',
            frames: [
                {
                    id: 'wall',
                    originM: {
                        x: 0,
                        y: 0,
                        z: 0
                    },
                    xAxis: {
                        x: 1,
                        y: 0,
                        z: 0
                    },
                    yAxis: {
                        x: 0,
                        y: 1,
                        z: 0
                    },
                    zAxis: {
                        x: 0,
                        y: 0,
                        z: 1
                    }
                }
            ],
            anchor: {
                key: anchor.key,
                positionM: clone(anchor.positionM)
            },
            placements: positions.slice(1).map((p)=>({
                    key: p.key,
                    relativeTo: {
                        key: anchor.key,
                        anchor: {
                            kind: 'origin'
                        },
                        own: {
                            kind: 'origin'
                        }
                    },
                    offsetM: vecM({
                        x: p.positionM.x - anchor.positionM.x,
                        y: p.positionM.y - anchor.positionM.y,
                        z: p.positionM.z - anchor.positionM.z
                    })
                })),
            connections: [],
            localLayouts: layouts,
            primarySources,
            featureSettings: clone(compact.featureSettings ?? {})
        }
    };
}
/**
 * portable preset v2 'exact' (m) -> compact (cm). Inverse of expandCompactPreset.
 * tierHeightM (m, optional): pass the same value as to expandCompactPreset, so a lone hanging top reads back as { top }.
 */ function compactFromExactPreset(exact, { defaultsOf = ()=>({}), gapM = DEFAULT_GAP_M, tierHeightM } = {}) {
    var _row;
    const tierHeightOfRowsM = tierHeightOrZero(tierHeightM);
    const layout = exact?.presetLayout;
    if (exact?.presetSchemaVersion !== 2 || layout?.layoutMode !== 'exact' || !Array.isArray(exact.presetProducts) || !exact.presetProducts.length || !isVec(layout.anchor?.positionM) || !Array.isArray(layout.placements)) fail('PRESET_INVALID', 'exact');
    const anchorPos = layout.anchor.positionM;
    const abs = new Map([
        [
            layout.anchor.key,
            {
                ...anchorPos
            }
        ]
    ]);
    for (const p of layout.placements){
        if (!isVec(p?.offsetM)) fail('PRESET_INVALID', 'placement');
        abs.set(p.key, {
            x: anchorPos.x + p.offsetM.x,
            y: anchorPos.y + p.offsetM.y,
            z: anchorPos.z + p.offsetM.z
        });
    }
    const byKey = new Map(exact.presetProducts.map((p)=>[
            p.key,
            p
        ]));
    const leftOf = (key)=>abs.get(key).x - widthM(byKey.get(key).selection) / 2;
    const rightOf = (key)=>abs.get(key).x + widthM(byKey.get(key).selection) / 2;
    // Only cabinet rows (the runtime's layoutsToRows filter); cabinets outside them are grouped by level + X gaps.
    const rowLayouts = (Array.isArray(layout.localLayouts) ? layout.localLayouts : []).filter((l)=>(l?.kind ?? 'cabinet-row') === 'cabinet-row' && (l?.policyId ?? 'cabinet-rows-v1') === 'cabinet-rows-v1');
    let rows = [];
    if (rowLayouts.length) {
        rows = rowLayouts.map((l)=>{
            assertRowLayout(l, byKey, abs);
            // Row height = the cabinets' pivot Y (import places the pivot there), not the box bottom:
            // a sink cabinet's box reaches below its pivot, which would sink the row on import.
            return {
                keys: [
                    ...l.orderedKeys
                ],
                leftM: l.anchorPositionM.x,
                bottomM: abs.get(l.orderedKeys[0]).y
            };
        });
    }
    // Column rows: the places (which cabinet is a column top or bottom) are read back from the cabinet boxes.
    const columnLayouts = (Array.isArray(layout.localLayouts) ? layout.localLayouts : []).filter((l)=>l?.policyId === CABINET_COLUMNS_POLICY_ID);
    for (const columnLayout of columnLayouts)rows.push(columnRowFromLayout(columnLayout, byKey, abs, tierHeightOfRowsM));
    const inRows = new Set(rows.flatMap((r)=>r.keys));
    if (inRows.size !== rows.reduce((n, r)=>n + r.keys.length, 0)) fail('PRESET_INVALID', 'cabinet in two rows');
    const loose = exact.presetProducts.filter((p)=>!inRows.has(p.key));
    if (loose.length) {
        // Fallback: group by bottom Y, order by X, a new row at every X gap.
        const groups = new Map();
        for (const p of loose){
            const y = m9(abs.get(p.key)?.y ?? NaN);
            if (!Number.isFinite(y)) fail('PRESET_INVALID', 'position');
            groups.set(y, [
                ...groups.get(y) ?? [],
                p.key
            ]);
        }
        for (const [y, keys] of groups){
            keys.sort((a, b)=>abs.get(a).x - abs.get(b).x);
            let run = null;
            for (const key of keys){
                if (!run || leftOf(key) - rightOf(run.keys.at(-1)) > gapM + 0.001) rows.push(run = {
                    keys: [],
                    leftM: leftOf(key),
                    bottomM: y
                });
                run.keys.push(key);
            }
        }
    }
    // A column row already knows its right end (a column's top may be wider than its bottom).
    for (const row of rows)(_row = row).rightM ?? (_row.rightM = rightOf(row.keys[row.keys.length - 1]));
    rows.sort((a, b)=>a.leftM - b.leftM || a.bottomM - b.bottomM);
    const shiftX = Math.min(...rows.map((r)=>r.leftM));
    const cabinetItemOf = (key)=>{
        const product = byKey.get(key);
        return {
            name: product.definitionId,
            ...diffVsDefaults(product.selection, defaultsOf(product.definitionId), DROPPED_SELECTION)
        };
    };
    const itemsByKey = new Map(rows.flatMap((row)=>row.keys).map((key)=>[
            key,
            cabinetItemOf(key)
        ]));
    const all = [
        ...itemsByKey.values()
    ];
    const shared = {};
    if (all.length >= 2) {
        for (const [key, value] of Object.entries(all[0])){
            if (key === 'name') continue;
            if (all.every((p)=>Object.hasOwn(p, key) && deepEqual(p[key], value))) shared[key] = clone(value);
        }
        for (const p of all)for (const key of Object.keys(shared))delete p[key];
    }
    const productRows = rows.map((row)=>{
        // A plain row lists its cabinets; a column row lists its places.
        if (!row.places) return row.keys.map((key)=>itemsByKey.get(key));
        return row.places.map((place)=>compactPlaceOf(place, itemsByKey));
    });
    const hasColumn = rows.some((row)=>(row.places ?? []).some((place)=>!Object.hasOwn(place, 'full')));
    const outRows = rows.map((row, r)=>{
        const out = {};
        const elevation = cm2(row.bottomM * 100);
        if (elevation !== 0) out.elevation = elevation;
        const touching = r > 0 && Math.abs(row.leftM - (rows[r - 1].rightM + gapM)) <= 0.001;
        if (r > 0 && !touching) out.offsetX = cm2((row.leftM - shiftX) * 100);
        out.products = productRows[r];
        return out;
    });
    // Columns need the v2 format; without them the preset stays v1 (a ULH export does not change).
    const format = hasColumn ? COLUMNS_PRESET_FORMAT : COMPACT_PRESET_FORMAT;
    const compact = {
        format,
        collection: exact.collection?.id
    };
    if (Object.keys(shared).length) compact.shared = shared;
    compact.rows = outRows;
    // The basin top; tandem tops are derived from it on import (countertop/tandem/tandem-countertops.mjs).
    const source = (layout.primarySources ?? []).find((s)=>isRecord(s?.payload) && validId(s.payload.productType) && s.payload.config?.CountertopRole !== 'tandemTop');
    if (source) {
        const { productType, config = {}, positionM } = source.payload;
        const top = {
            productType,
            ...diffVsDefaults(config, defaultsOf(productType), DROPPED_TOP)
        };
        const off = config.SpatialOffsetM;
        const offset = isRecord(off) && (Math.abs(off.x ?? 0) > 1e-9 || Math.abs(off.y ?? 0) > 1e-9);
        if (offset) {
            if (Number.isFinite(config.CountertopLengthM)) top.CountertopLengthM = m9(config.CountertopLengthM);
            if (Number.isFinite(config.CountertopSinkShiftM)) top.CountertopSinkShiftM = m9(config.CountertopSinkShiftM);
            top.SpatialOffsetM = {
                x: m9(off.x ?? 0),
                y: m9(off.y ?? 0)
            };
            // Cabinets expand at z = 0: keep the top's depth relative to the cabinets.
            const shiftZ = Math.min(...[
                ...abs.values()
            ].map((p)=>p.z));
            if (isVec(positionM)) top.positionM = vecM({
                x: positionM.x - shiftX,
                y: positionM.y,
                z: positionM.z - shiftZ
            });
        }
        compact.top = top;
    }
    if (isRecord(layout.featureSettings) && Object.keys(layout.featureSettings).length) compact.featureSettings = clone(layout.featureSettings);
    return compact;
}

export { COLUMNS_PRESET_FORMAT, COMPACT_PRESET_FORMAT, compactFromExactPreset, expandCompactPreset, isCompactPreset };
