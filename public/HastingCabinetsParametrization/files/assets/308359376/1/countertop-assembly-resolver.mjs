/**
 * What the countertop is made of and what moves with it, for one composition.
 *
 * - countertop: the product root, its `TopSolid` mesh and the `Top_Solid_Point` anchor;
 * - sinks: every resolved sink host, the single place a sink is found (see `SinkHost` below):
 *   one entry per cabinet with exactly one node named its configured sink mount
 *   (`getSinkAnchorName`, e.g. `Sink_Point`) and, last, the countertop with exactly one
 *   `Countertop_SinkPoint`; an anchor without one live child (a 'Vessel' placeholder, not built
 *   yet) is still an entry with `entity: null`. Order: cabinets in resolver order, then the top;
 * - cutters: boolean helpers the countertop mesh is cut with — `BoolB_*` meshes under each sink
 *   anchor and the vessel clones under the countertop (`Vessel_BoolCut_Clone_<i>` = the i-th
 *   cabinet sink whose configured `sinkType` is a vessel, `Vessel_BoolCut_Clone_Countertop` =
 *   the countertop-hosted sink); each cutter is also listed (same object) in its sink's `cutters`;
 * - transformTargets: the top-level entities a countertop move carries — the countertop, the
 *   live sink under each cabinet's configured sink mount and the cutters (a descendant of another
 *   target is dropped: it moves with its ancestor).
 *
 * Composition rules (RuleCountertopBooleanCutouts, RuleChangeBasinStyleMaterial) read `sinks` by
 * calling the resolver directly with the rules-pass shared context — no own host discovery:
 *
 *   const registry = ProductRegistry_V2.instance;
 *   const { sinks } = resolveCountertopAssembly({
 *       composition: shared.composition,                      // active CompositionStore
 *       entities: { countertops: shared.entities.countertops,  // the CSG rule passes its
 *                   cabinets: cabinetEntities },               //   support-group-filtered cabinets
 *       getSinkAnchorName: (productType, entityName) =>        // same lookup as the adapter
 *           registry.getSinkAnchorName(productType) || registry.getSinkAnchorName(entityName)
 *   });
 *
 * Read-only: never searches app.root, reparents, transforms or rebuilds anything. The caller
 * scopes the injected entities to the composition.
 *
 * @typedef {object} SinkHost
 * @property {string|null} sinkId configured sink type (cabinet `sinkType` / top `CountertopSinkType`), else the child's name
 * @property {object|null} entity the live sink sub-product (single live child of `anchor`); null for a placeholder / not built
 * @property {object} anchor the cabinet's sink mount or the top's `Countertop_SinkPoint`
 * @property {{ kind: 'cabinet'|'countertop', id: string|null, root: object }} host the hosting product
 * @property {ReadonlyArray<object>} cutters the `assembly.cutters` objects that belong to this sink
 */
import { getCountertopRole, resolveBasinTopProduct } from '../countertop-role.mjs';
import { COUNTERTOP_SINK_POINT_NAME, COUNTERTOP_SINK_TYPE_KEY } from '../countertop-hosted-sink.mjs';

const TOP_SOLID_NAME = 'TopSolid';
const TOP_SOLID_ANCHOR_NAME = 'Top_Solid_Point';
const LEGACY_SINK_POINT_NAME = 'Sink_Point';
const VESSEL_PLACEHOLDER_ID = 'Vessel';
const VESSEL_CUTTER_CLONE_PREFIX = 'Vessel_BoolCut_Clone_';
/** The countertop-hosted vessel's cutter clone (RuleCountertopBooleanCutouts); never one of the cabinets' `_<i>` clones. */
export const HOSTED_VESSEL_CUTTER_CLONE_NAME = `${VESSEL_CUTTER_CLONE_PREFIX}Countertop`;

/**
 * @param {object} input
 * @param {object} input.composition CompositionStore-like (`getAllProducts()` or `products`)
 * @param {{ countertops?: Array|Map|object, cabinets?: Array|Map|object }} input.entities
 * @param {string} [input.compositionId]
 * @param {(productType: string|null, entityName: string|null) => string|null} [input.getSinkAnchorName]
 * @param {string} [input.countertopId] resolve THIS top (a tandem top, tandem/tandem-countertops.mjs) instead of the
 *   composition's one basin top
 */
export function resolveCountertopAssembly(input = {}) {
    const composition = input?.composition || null;
    const compositionId = input?.compositionId ?? composition?.compositionId ?? null;
    const products = readProducts(composition);
    const countertop = resolveCountertop(products, liveRoots(input?.entities?.countertops), input?.countertopId ?? null);
    const cabinets = resolveCabinets(
        products,
        liveRoots(input?.entities?.cabinets),
        input?.getSinkAnchorName
    );

    const cutters = [];
    const targets = [];
    const sinks = [];
    const isSinkCutter = node => String(node.name || '').includes('BoolB_') && hasMesh(node);
    if (countertop.root) targets.push({ entity: countertop.root, kind: 'countertop', ownerId: countertop.productId });
    for (const cabinet of cabinets) {
        const sink = resolveSink(cabinet);
        if (sink.transformRoot) targets.push({ entity: sink.transformRoot, kind: 'sink', ownerId: cabinet.cabinetId, cabinetRoot: cabinet.root });
        if (!cabinet.sinkPoint) continue;
        cabinet.sink = sinkHost(sink.sinkId, sink.transformRoot, cabinet.sinkPoint, 'cabinet', cabinet.cabinetId, cabinet.root);
        sinks.push(cabinet.sink);
        // Only the sink mount's cutters belong to the top (as in RuleCountertopBooleanCutouts): drawer and other
        // cabinet BoolB_* helpers must not move with the top nor count as basin cut-outs.
        for (const entity of collectTree(cabinet.sinkPoint).filter(isSinkCutter)) {
            addCutter(cutters, cabinet.sink, { source: 'cabinet', cabinetId: cabinet.cabinetId, cabinetRoot: cabinet.root, sinkId: sink.sinkId, mesh: entity, transformRoot: entity });
        }
    }
    const hosted = resolveHostedSink(countertop, products);
    const hostedEntry = hosted.sinkPoint
        ? sinkHost(hosted.sinkId, hosted.entity, hosted.sinkPoint, 'countertop', countertop.productId, countertop.root)
        : null;
    if (hostedEntry) {
        sinks.push(hostedEntry);
        for (const mesh of collectTree(hostedEntry.anchor).filter(isSinkCutter)) {
            addCutter(cutters, hostedEntry, { source: 'countertop', cabinetId: null, cabinetRoot: null, sinkId: hostedEntry.sinkId, mesh, transformRoot: mesh });
        }
    }
    if (countertop.root) resolveVesselCutters(countertop.root, cabinets, hostedEntry, cutters);
    for (const cutter of cutters) targets.push({ entity: cutter.transformRoot, kind: 'cutter', ownerId: cutter.cabinetId });

    const frozenSinks = Object.freeze(sinks.map(entry => Object.freeze({
        ...entry,
        host: Object.freeze(entry.host),
        cutters: Object.freeze(entry.cutters.map(cutter => Object.freeze(cutter)))
    })));
    return Object.freeze({
        compositionId,
        productId: countertop.productId,
        basinResolution: countertop.resolution,
        countertop: countertop.root ? Object.freeze({ ...countertop }) : null,
        sinks: frozenSinks,
        cutters: Object.freeze(cutters.map(cutter => Object.freeze(cutter))),
        transformTargets: Object.freeze(topLevel(targets).map(target => Object.freeze(target)))
    });
}

/** A mutable sink entry while resolving; frozen into a `SinkHost` on return. */
function sinkHost(sinkId, entity, anchor, kind, id, root) {
    return { sinkId: sinkId ?? null, entity: entity || null, anchor, host: { kind, id: id ?? null, root: root || null }, cutters: [] };
}

/** The cutter goes to `assembly.cutters` and, the same object, to its sink (if it has one). */
function addCutter(cutters, sink, cutter) {
    cutters.push(cutter);
    sink?.cutters.push(cutter);
}

/** A scene entity is current only while attached (PlayCanvas clears parent on destroy()). */
const isAlive = entity => Boolean(entity && typeof entity === 'object' && entity.parent != null);

function readProducts(composition) {
    try {
        const products = typeof composition?.getAllProducts === 'function' ? composition.getAllProducts() : composition?.products;
        if (products instanceof Map) return new Map(products);
        if (products && typeof products === 'object') return new Map(Object.entries(products));
    } catch {
        // an unreadable composition resolves nothing
    }
    return new Map();
}

function liveRoots(value) {
    const entities = Array.isArray(value) ? value
        : value instanceof Map ? [...value.values()]
            : value && typeof value === 'object' ? Object.values(value) : [];
    return [...new Set(entities)].filter(isAlive);
}

function readSnapshotValue(snapshot, key) {
    return typeof snapshot?.get === 'function' ? snapshot.get(key) : snapshot?.[key];
}

/** The uniquely resolved basin product (or the top `countertopId`) and its live root (by product ID). */
function resolveCountertop(products, roots, countertopId = null) {
    const resolution = countertopId
        ? (products.has(countertopId)
            ? { status: 'found', productId: countertopId, snapshot: products.get(countertopId), candidateIds: [countertopId] }
            : { status: 'missing', productId: null, snapshot: null, candidateIds: [] })
        : resolveBasinTopProduct(products);
    let productId = null;
    let root = null;
    if (resolution.status === 'found') {
        productId = resolution.productId;
        const matches = roots.filter(entity => entity.name === productId);
        root = matches.length === 1 ? matches[0] : null;
    } else if (resolution.status === 'missing' && roots.length === 1 &&
        ![...products.values()].some(snapshot => readSnapshotValue(snapshot, 'category') === 'countertops' ||
            getCountertopRole(snapshot) !== 'unknown' ||
            readSnapshotValue(snapshot, 'CountertopRole') !== undefined ||
            readSnapshotValue(snapshot, 'generatedBy') !== undefined)) {
        root = roots[0];
        productId = root.name || null;
    }
    const unique = name => {
        const matches = root ? collectTree(root).filter(node => node !== root && node.name === name) : [];
        return matches.length === 1 ? matches[0] : null;
    };
    return { productId, root, mesh: unique(TOP_SOLID_NAME), anchor: unique(TOP_SOLID_ANCHOR_NAME), resolution };
}

/** Live cabinet roots with a unique name, with their composition snapshot (if any). */
function resolveCabinets(products, roots, getSinkAnchorName) {
    const counts = countNames(roots);
    return roots
        .filter(entity => entity.name && counts.get(entity.name) === 1)
        .map(entity => {
            const snapshot = products.get(entity.name);
            const cabinetSnapshot = readSnapshotValue(snapshot, 'category') === 'cabinets' ? snapshot : null;
            const sinkAnchorName = typeof getSinkAnchorName === 'function'
                ? getSinkAnchorName(readSnapshotValue(cabinetSnapshot, 'productType') ?? null, entity.name || null)
                : LEGACY_SINK_POINT_NAME;
            return {
                cabinetId: entity.name,
                root: entity,
                snapshot: cabinetSnapshot,
                sinkAnchorName: typeof sinkAnchorName === 'string' && sinkAnchorName ? sinkAnchorName : null,
                sinkPoint: null,
                sink: null
            };
        });
}

/** The cabinet's sink: the single live child of its configured mount (a Vessel placeholder has none). */
function resolveSink(cabinet) {
    const configured = readSnapshotValue(cabinet.snapshot, 'sinkType') ?? null;
    if (!cabinet.sinkAnchorName) return { sinkId: configured, transformRoot: null };
    const points = collectTree(cabinet.root).filter(node => node.name === cabinet.sinkAnchorName);
    if (points.length !== 1) return { sinkId: configured, transformRoot: null };
    cabinet.sinkPoint = points[0];
    if (configured === VESSEL_PLACEHOLDER_ID) return { sinkId: configured, transformRoot: null };
    const children = (points[0].children || []).filter(isAlive);
    const root = children.length === 1 ? children[0] : null;
    return { sinkId: configured || root?.name || null, transformRoot: root };
}

/**
 * The sink the countertop hosts: the single live child of the single `Countertop_SinkPoint` under the
 * countertop root. sinkId = the top's `CountertopSinkType` (else the child's name). A unique anchor
 * without one live child (e.g. a bare `Vessel` placeholder) still scopes the hosted cutters.
 */
function resolveHostedSink(countertop, products) {
    const none = { entity: null, sinkId: null, sinkPoint: null };
    if (!countertop.root) return none;
    const points = collectTree(countertop.root).filter(node => node !== countertop.root && node.name === COUNTERTOP_SINK_POINT_NAME);
    if (points.length !== 1) return none;
    const configured = readSnapshotValue(products.get(countertop.productId), COUNTERTOP_SINK_TYPE_KEY);
    const children = (points[0].children || []).filter(isAlive);
    const entity = children.length === 1 ? children[0] : null;
    const sinkId = (typeof configured === 'string' && configured) ? configured : entity?.name || null;
    return { entity, sinkId, sinkPoint: points[0] };
}

/**
 * `Vessel_BoolCut_Clone_<i>` under the countertop belongs to the i-th cabinet sink (resolver order) whose
 * configured `sinkType` is a vessel; `Vessel_BoolCut_Clone_Countertop` belongs to the countertop-hosted sink.
 */
function resolveVesselCutters(countertopRoot, cabinets, hostedEntry, cutters) {
    const owners = cabinets.filter(cabinet => cabinet.sink && isVesselSinkId(cabinet.sink.sinkId));
    for (const root of collectTree(countertopRoot)) {
        const name = String(root.name || '');
        if (root === countertopRoot || !name.startsWith(VESSEL_CUTTER_CLONE_PREFIX)) continue;
        if (name === HOSTED_VESSEL_CUTTER_CLONE_NAME) {
            for (const mesh of collectTree(root).filter(hasMesh)) {
                addCutter(cutters, hostedEntry, { source: 'countertop', cabinetId: null, cabinetRoot: null, sinkId: hostedEntry?.sinkId ?? null, mesh, transformRoot: root });
            }
            continue;
        }
        const index = name.slice(VESSEL_CUTTER_CLONE_PREFIX.length);
        const owner = /^\d+$/.test(index) ? owners[Number(index)] ?? null : null;
        for (const mesh of collectTree(root).filter(hasMesh)) {
            addCutter(cutters, owner?.sink, {
                source: 'vessel-clone',
                cabinetId: owner?.cabinetId ?? null,
                cabinetRoot: owner?.root ?? null,
                sinkId: owner?.sink?.sinkId ?? null,
                mesh,
                transformRoot: root
            });
        }
    }
}

function collectTree(root) {
    if (!root) return [];
    const result = [];
    const stack = [root];
    const visited = new Set();
    while (stack.length > 0) {
        const node = stack.pop();
        if (!node || visited.has(node)) continue;
        visited.add(node);
        result.push(node);
        const children = node.children || [];
        for (let index = children.length - 1; index >= 0; index -= 1) stack.push(children[index]);
    }
    return result;
}

function hasMesh(entity) {
    const meshInstances = entity?.render?.meshInstances || entity?.model?.meshInstances;
    return Array.isArray(meshInstances) && meshInstances.length > 0;
}

/** Whether a sink id is a vessel ('Vessel' placeholder or a `Vessel_*` sink); shared with RuleCountertopBooleanCutouts. */
export function isVesselSinkId(sinkId) {
    return sinkId === VESSEL_PLACEHOLDER_ID || (typeof sinkId === 'string' && sinkId.startsWith('Vessel_'));
}

function countNames(entities) {
    const counts = new Map();
    for (const entity of entities) counts.set(entity?.name || null, (counts.get(entity?.name || null) || 0) + 1);
    return counts;
}

/** Unique entities, minus those whose ancestor is already a target. */
function topLevel(candidates) {
    const unique = [];
    const seen = new Set();
    for (const candidate of candidates) {
        if (!candidate.entity || seen.has(candidate.entity)) continue;
        seen.add(candidate.entity);
        unique.push(candidate);
    }
    return unique.filter(candidate => !unique.some(other => other !== candidate && isStrictAncestor(other.entity, candidate.entity)));
}

function isStrictAncestor(ancestor, entity) {
    for (let current = entity?.parent || null; current; current = current.parent) {
        if (current === ancestor) return true;
    }
    return false;
}
