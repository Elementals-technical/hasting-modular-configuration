import { isTandemCountertopProduct } from '../countertop-role.mjs';

const TANDEM_COUNTERTOP_ROLE = 'tandemTop';
/** The sink base a tandem top was made for (its row's group is the tandem top's SupportGroupId). */ const TANDEM_SINK_BASE_KEY = 'TandemSinkBaseId';
/** A top thinner than this is thin (inches, the unit of `Thickness`): Standard only, no Position menu in the UI. */ const THIN_COUNTERTOP_MAX_IN = 1;
/** Two sink bases whose tops differ by no more than this stand at one level (the placement pack's levelM). */ const SINK_BASE_LEVEL_TOLERANCE_M = 0.005;
const DEFAULT_GROUP = 'group-1';
const read = (snapshot, key)=>typeof snapshot?.get === 'function' ? snapshot.get(key) : snapshot?.[key];
const groupOf = (config)=>read(config, 'SupportGroupId') || DEFAULT_GROUP;
const finite = (value)=>typeof value === 'number' && Number.isFinite(value);
/**
 * Keys of the basin top a tandem top does NOT copy: its pose and length (laid out on its own row), a sink the basin
 * top hosts (HR-CT-02, lifted top) and the identity of the product.
 */ const NOT_COPIED = new Set([
    'SpatialOffsetM',
    'CountertopLengthM',
    'CountertopSinkShiftM',
    'CountertopSinkType',
    'CountertopSinkLocalM',
    'positionX',
    'positionY',
    'positionZ',
    'entityName',
    'CountertopRole',
    'SupportGroupId',
    TANDEM_SINK_BASE_KEY
]);
/**
 * Thin top: `Thickness` (inches) below 1″. Example: { Thickness: '0.5' } -> true; { Thickness: 5.125 } -> false.
 * Unknown thickness -> false (the thick behaviour: one top, nothing is cloned).
 */ function isThinCountertop(snapshot) {
    const raw = read(snapshot, 'Thickness');
    const inches = raw === null || raw === undefined || raw === '' ? NaN : Number(raw);
    return finite(inches) && inches > 0 && inches < THIN_COUNTERTOP_MAX_IN;
}
/** The basin top's config a tandem top takes: everything but NOT_COPIED. */ function tandemConfigFrom(basinConfig) {
    return Object.fromEntries(Object.entries(basinConfig ?? {}).filter(([key])=>!NOT_COPIED.has(key)));
}
const isAttached = (offset)=>!offset || Math.abs(Number(offset.x) || 0) <= 1e-6 && Math.abs(Number(offset.y) || 0) <= 1e-6;
const isBasinTopSource = (source)=>{
    const config = source?.payload?.config;
    if (!config || isTandemCountertopProduct(config) || config.CountertopRole === 'cabinetCover' || config.generatedBy) return false;
    return config.CountertopRole === 'basinTop' || config.CountertopRole === undefined && source.payload.productType === 'Top_Solid';
};
/**
 * Tandem tops of a CompositionDocument brought in line with its sink bases (in place).
 *
 * Wanted: with a thin basin top, one tandem top per support group that holds a sink base but not the basin top.
 * An existing tandem top of such a group is kept (same id) and takes the basin top's config again (a finish changed
 * since); a new one gets `makeId()`. Tandem tops of other groups (the SB came back, was deleted, became an SC, the
 * top is thick) are removed. Every kept tandem top references the cabinets of its group.
 *
 * @param {object} document CompositionDocument: { cabinets: [{ id, definitionId, selection, positionM }], primarySources }
 * @param {{ isSinkCabinet: (snapshot) => boolean, makeId: (productType: string) => string }} options
 *   isSinkCabinet gets { ...selection, productType: definitionId }.
 * @returns {{ added: string[], removed: string[], kept: string[] }}
 */ function reconcileTandemCountertops(document, { isSinkCabinet, makeId } = {}) {
    const sources = document?.primarySources ?? [];
    const result = {
        added: [],
        removed: [],
        kept: []
    };
    const basin = basinTopSourceOf(document);
    const basinConfig = basin?.payload?.config ?? null;
    // 1. Groups that want a tandem top: a sink base in them, the basin top not on them, the basin top thin.
    const sinkBasesByGroup = new Map();
    if (basin && isThinCountertop(basinConfig) && typeof isSinkCabinet === 'function') {
        for (const cabinet of document.cabinets ?? []){
            if (!isSinkCabinet({
                ...cabinet.selection,
                productType: cabinet.definitionId
            })) continue;
            const group = groupOf(cabinet.selection);
            if (group === groupOf(basinConfig)) continue;
            if (!sinkBasesByGroup.has(group)) sinkBasesByGroup.set(group, []);
            sinkBasesByGroup.get(group).push(cabinet);
        }
    }
    // 2. Existing tandem tops: one per wanted group is kept, the rest go.
    const keptByGroup = new Map();
    const next = [];
    for (const source of sources){
        if (!isTandemCountertopProduct(source?.payload?.config)) {
            next.push(source);
            continue;
        }
        const group = groupOf(source.payload.config);
        if (!sinkBasesByGroup.has(group) || keptByGroup.has(group)) {
            result.removed.push(source.id);
            continue;
        }
        keptByGroup.set(group, source);
        next.push(source);
    }
    // 3. Each wanted group: its tandem top takes the basin top's config; a missing one is created.
    for (const [group, sinkBases] of sinkBasesByGroup){
        const sinkBase = sinkBases[0];
        const config = {
            ...tandemConfigFrom(basinConfig),
            CountertopRole: TANDEM_COUNTERTOP_ROLE,
            SupportGroupId: group,
            [TANDEM_SINK_BASE_KEY]: sinkBase.id
        };
        const existing = keptByGroup.get(group);
        // The layout rule places it on its row; until then it stands at its sink base, at the basin top's height.
        const basinPositionM = basin.payload.positionM ?? {};
        const positionM = existing?.payload?.positionM ?? {
            x: sinkBase.positionM?.x ?? 0,
            y: finite(basinPositionM.y) ? basinPositionM.y - Number(basinConfig.SpatialOffsetM?.y ?? 0) : sinkBase.positionM?.y ?? 0,
            z: finite(basinPositionM.z) ? basinPositionM.z : sinkBase.positionM?.z ?? 0
        };
        if (existing) {
            existing.payload = {
                ...existing.payload,
                productType: basin.payload.productType,
                config,
                positionM
            };
            result.kept.push(existing.id);
        } else {
            const id = makeId(basin.payload.productType);
            next.push({
                id,
                subsystem: basin.subsystem ?? 'runtime-product',
                schemaVersion: basin.schemaVersion ?? 1,
                cabinetReferences: [],
                payload: {
                    productType: basin.payload.productType,
                    config,
                    positionM
                }
            });
            result.added.push(id);
        }
    }
    // 4. Every tandem top references the cabinets of its group.
    for (const source of next){
        if (!isTandemCountertopProduct(source.payload?.config)) continue;
        const group = groupOf(source.payload.config);
        source.cabinetReferences = (document.cabinets ?? []).filter((c)=>groupOf(c.selection) === group).map((c)=>c.id);
    }
    if (document) document.primarySources = next;
    return result;
}
/**
 * The tandem tops of a composition for the UI (countertop getState().tandemTops, priced like the basin top by length):
 * [{ productId, lengthM, sinkBaseId, cabinetIds }] in product order; lengthM null until laid out.
 * @param {object} products productId -> snapshot
 * @param {(productId) => number|null} lengthOf
 */ function describeTandemCountertops(products, lengthOf = ()=>null) {
    const entries = Object.entries(products ?? {});
    return entries.filter(([, snapshot])=>isTandemCountertopProduct(snapshot)).map(([productId, snapshot])=>Object.freeze({
            productId,
            lengthM: lengthOf(productId) ?? null,
            sinkBaseId: read(snapshot, TANDEM_SINK_BASE_KEY) ?? null,
            cabinetIds: Object.freeze(entries.filter(([, other])=>read(other, 'category') === 'cabinets' && groupOf(other) === groupOf(snapshot)).map(([id])=>id))
        }));
}
/** The one basin top source of a document, or null (none, or more than one). */ function basinTopSourceOf(document) {
    const tops = (document?.primarySources ?? []).filter(isBasinTopSource);
    return tops.length === 1 ? tops[0] : null;
}
/**
 * A sink base dropped on its own row under a THICK standard top, within SINK_BASE_LEVEL_TOLERANCE_M of the other sink
 * bases' tops, is put exactly at their level (in place: its pivot Y and its row's bottomM), so the one top lies on both
 * (the support plane needs coplanar tops). Farther off is HR-PL-11 (the draft refuses it); a join already stands on its
 * row's level.
 * @param {object} document CompositionDocument (cabinets at their dropped poses)
 * @param {{ orderedCabinetIds: string[], bottomM: number }[]} rows the rows the drop was planned into
 * @param {string} id the dropped cabinet
 * @param {{ isSinkCabinet: (snapshot) => boolean, heightOf: (cabinet) => number }} options heightOf: cm
 * @returns {boolean} snapped
 */ function snapSinkBaseToThickTop(document, rows, id, { isSinkCabinet, heightOf } = {}) {
    const basin = basinTopSourceOf(document), config = basin?.payload?.config;
    if (!config || isThinCountertop(config) || !isAttached(config.SpatialOffsetM)) return false;
    const isSink = (c)=>isSinkCabinet({
            ...c.selection,
            productType: c.definitionId
        });
    const moved = (document.cabinets ?? []).find((c)=>c.id === id);
    if (!moved || !isSink(moved)) return false;
    const topOf = (c)=>{
        const heightCm = Number(heightOf(c)), y = Number(c.positionM?.y);
        return finite(heightCm) && heightCm > 0 && finite(y) ? y + heightCm / 100 : null;
    };
    // The level of the top: the sink bases of its group first.
    const others = (document.cabinets ?? []).filter((c)=>c.id !== id && isSink(c)).sort((a, b)=>Number(groupOf(b.selection) === groupOf(config)) - Number(groupOf(a.selection) === groupOf(config)));
    const levelM = others.length ? topOf(others[0]) : null, ownM = topOf(moved);
    if (levelM === null || ownM === null) return false;
    const deltaM = levelM - ownM;
    if (Math.abs(deltaM) <= 1e-9 || Math.abs(deltaM) > SINK_BASE_LEVEL_TOLERANCE_M) return false;
    const row = (rows ?? []).find((candidate)=>candidate.orderedCabinetIds?.includes(id));
    if (!row || row.orderedCabinetIds.length !== 1) return false;
    moved.positionM = {
        ...moved.positionM,
        y: moved.positionM.y + deltaM
    };
    if (finite(row.bottomM)) row.bottomM += deltaM;
    return true;
}

export { SINK_BASE_LEVEL_TOLERANCE_M, TANDEM_COUNTERTOP_ROLE, describeTandemCountertops, isThinCountertop, reconcileTandemCountertops, snapSinkBaseToThickTop, tandemConfigFrom };
