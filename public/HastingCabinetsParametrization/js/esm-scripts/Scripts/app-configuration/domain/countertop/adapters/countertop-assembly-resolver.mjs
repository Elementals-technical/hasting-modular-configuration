/**
 * Read-only resolver for the countertop logical assembly.
 *
 * The caller owns composition scoping. This module never searches app.root,
 * reparents entities, changes transforms, rebuilds CSG, or loads resources.
 */ const ASSEMBLY_DIAGNOSTIC_CODES = Object.freeze({
    COMPOSITION_MISSING: 'ASSEMBLY_COMPOSITION_MISSING',
    COMPOSITION_ID_MISSING: 'ASSEMBLY_COMPOSITION_ID_MISSING',
    COMPOSITION_PRODUCTS_UNAVAILABLE: 'ASSEMBLY_COMPOSITION_PRODUCTS_UNAVAILABLE',
    COUNTERTOP_OWNER_MISSING: 'ASSEMBLY_COUNTERTOP_OWNER_MISSING',
    COUNTERTOP_OWNER_AMBIGUOUS: 'ASSEMBLY_COUNTERTOP_OWNER_AMBIGUOUS',
    COUNTERTOP_ENTITY_MISSING: 'ASSEMBLY_COUNTERTOP_ENTITY_MISSING',
    COUNTERTOP_ENTITY_STALE: 'ASSEMBLY_COUNTERTOP_ENTITY_STALE',
    TOP_SOLID_MISSING: 'ASSEMBLY_TOP_SOLID_MISSING',
    TOP_SOLID_AMBIGUOUS: 'ASSEMBLY_TOP_SOLID_AMBIGUOUS',
    TOP_SOLID_MESH_MISSING: 'ASSEMBLY_TOP_SOLID_MESH_MISSING',
    TOP_SOLID_ANCHOR_MISSING: 'ASSEMBLY_TOP_SOLID_ANCHOR_MISSING',
    TOP_SOLID_ANCHOR_AMBIGUOUS: 'ASSEMBLY_TOP_SOLID_ANCHOR_AMBIGUOUS',
    CABINET_OWNER_MISSING: 'ASSEMBLY_CABINET_OWNER_MISSING',
    CABINET_OWNER_AMBIGUOUS: 'ASSEMBLY_CABINET_OWNER_AMBIGUOUS',
    CABINET_ENTITY_MISSING: 'ASSEMBLY_CABINET_ENTITY_MISSING',
    CABINET_ENTITY_STALE: 'ASSEMBLY_CABINET_ENTITY_STALE',
    SINK_POINT_MISSING: 'ASSEMBLY_SINK_POINT_MISSING',
    SINK_POINT_AMBIGUOUS: 'ASSEMBLY_SINK_POINT_AMBIGUOUS',
    SINK_ENTITY_MISSING: 'ASSEMBLY_SINK_ENTITY_MISSING',
    SINK_ENTITY_AMBIGUOUS: 'ASSEMBLY_SINK_ENTITY_AMBIGUOUS',
    SINK_VISIBLE_MESH_MISSING: 'ASSEMBLY_SINK_VISIBLE_MESH_MISSING',
    VESSEL_PLACEHOLDER_HAS_ENTITY: 'ASSEMBLY_VESSEL_PLACEHOLDER_HAS_ENTITY',
    CUTTER_MESH_MISSING: 'ASSEMBLY_CUTTER_MESH_MISSING',
    CUTTER_OWNER_MISSING: 'ASSEMBLY_CUTTER_OWNER_MISSING',
    CUTTER_OWNER_AMBIGUOUS: 'ASSEMBLY_CUTTER_OWNER_AMBIGUOUS'
});
const TOP_SOLID_NAME = 'TopSolid';
const TOP_SOLID_ANCHOR_NAME = 'Top_Solid_Point';
const SINK_POINT_NAME = 'Sink_Point';
const VESSEL_PLACEHOLDER_ID = 'Vessel';
const VESSEL_CUTTER_TEMPLATE_NAME = 'Vessel_BoolCut';
const VESSEL_CUTTER_CLONE_PREFIX = 'Vessel_BoolCut_Clone_';
/**
 * Resolve current PlayCanvas entity references for one composition.
 *
 * @param {object} input
 * @param {object} input.composition CompositionStore-like value. It must expose
 * `getAllProducts()` or a plain `products` collection.
 * @param {{countertops?: Array|Map|object, cabinets?: Array|Map|object}} input.entities
 * Entity roots already scoped by the caller to this composition.
 * @param {string} [input.compositionId] Explicit identity override.
 * @returns {object} A shallow-read-only AssemblyBinding. Referenced PlayCanvas
 * entities intentionally remain mutable and owned by the scene.
 */ function resolveCountertopAssembly(input = {}) {
    const diagnostics = [];
    const composition = input?.composition || null;
    const compositionId = input?.compositionId ?? composition?.compositionId ?? null;
    const products = readCompositionProducts(composition, diagnostics);
    const countertopEntities = normalizeEntityCollection(input?.entities?.countertops);
    const cabinetEntities = normalizeEntityCollection(input?.entities?.cabinets);
    if (!compositionId) {
        addDiagnostic(diagnostics, ASSEMBLY_DIAGNOSTIC_CODES.COMPOSITION_ID_MISSING, 'The injected composition has no compositionId.', {
            blocking: true
        });
    }
    const countertop = resolveCountertop(products, countertopEntities, diagnostics);
    const cabinetContexts = resolveCabinetContexts(products, cabinetEntities, diagnostics);
    const sinks = [];
    const cutters = [];
    for (const cabinet of cabinetContexts){
        const sink = resolveCabinetSink(cabinet, diagnostics);
        cabinet.sink = sink;
        if (sink) sinks.push(sink);
        resolveCabinetCutters(cabinet, sink, cutters, diagnostics);
    }
    if (countertop.root) {
        resolveVesselCutters(countertop.root, cabinetContexts, cutters, diagnostics);
    }
    const targetCandidates = [];
    if (countertop.root) {
        targetCandidates.push({
            entity: countertop.root,
            kind: 'countertop',
            ownerId: countertop.productId
        });
    }
    for (const sink of sinks){
        if (sink.transformRoot) {
            targetCandidates.push({
                entity: sink.transformRoot,
                kind: 'sink',
                ownerId: sink.cabinetId
            });
        }
    }
    for (const cutter of cutters){
        targetCandidates.push({
            entity: cutter.transformRoot,
            kind: 'cutter',
            ownerId: cutter.cabinetId
        });
    }
    const transformTargets = selectTopLevelTargets(targetCandidates);
    const countertopBinding = finishCountertopBinding(countertop, transformTargets);
    const sinkBindings = sinks.map((sink)=>finishSinkBinding(sink, transformTargets));
    const cutterBindings = cutters.map((cutter)=>finishCutterBinding(cutter, transformTargets));
    const frozenDiagnostics = Object.freeze(diagnostics.map((item)=>Object.freeze(item)));
    const blockingDiagnostics = frozenDiagnostics.filter((item)=>item.blocking);
    return Object.freeze({
        kind: 'AssemblyBinding',
        compositionId,
        productId: countertop.productId,
        readiness: blockingDiagnostics.length === 0 ? 'ready' : 'waiting',
        ready: blockingDiagnostics.length === 0,
        countertop: countertopBinding,
        sinks: Object.freeze(sinkBindings),
        cutters: Object.freeze(cutterBindings),
        // CT-04 deliberately does not infer physical collision proxies.
        collisionProxies: Object.freeze([]),
        transformTargets: Object.freeze(transformTargets.map((target)=>Object.freeze(target))),
        diagnostics: frozenDiagnostics
    });
}
/**
 * A scene entity is current only while it is still attached to a hierarchy.
 * PlayCanvas clears parent when destroy() removes an entity.
 */ function isAssemblyEntityAlive(entity) {
    return Boolean(entity && typeof entity === 'object' && entity.parent != null);
}
function readCompositionProducts(composition, diagnostics) {
    if (!composition) {
        addDiagnostic(diagnostics, ASSEMBLY_DIAGNOSTIC_CODES.COMPOSITION_MISSING, 'A composition must be injected into the resolver.', {
            blocking: true
        });
        return new Map();
    }
    let products;
    try {
        products = typeof composition.getAllProducts === 'function' ? composition.getAllProducts() : composition.products;
    } catch (error) {
        addDiagnostic(diagnostics, ASSEMBLY_DIAGNOSTIC_CODES.COMPOSITION_PRODUCTS_UNAVAILABLE, 'The injected composition could not provide its products.', {
            blocking: true,
            reason: error?.message || String(error)
        });
        return new Map();
    }
    if (products instanceof Map) return new Map(products);
    if (products && typeof products === 'object') return new Map(Object.entries(products));
    addDiagnostic(diagnostics, ASSEMBLY_DIAGNOSTIC_CODES.COMPOSITION_PRODUCTS_UNAVAILABLE, 'The injected composition has no readable product collection.', {
        blocking: true
    });
    return new Map();
}
function resolveCountertop(products, injectedEntities, diagnostics) {
    const productEntries = [
        ...products.entries()
    ].filter(([, snapshot])=>snapshot?.category === 'countertops');
    const liveEntities = filterLiveRoots(injectedEntities, 'countertop', diagnostics);
    let productId = null;
    let root = null;
    if (productEntries.length > 1) {
        addDiagnostic(diagnostics, ASSEMBLY_DIAGNOSTIC_CODES.COUNTERTOP_OWNER_AMBIGUOUS, 'The composition contains more than one countertop owner.', {
            blocking: true,
            ownerIds: productEntries.map(([id])=>id)
        });
    } else if (productEntries.length === 1) {
        productId = productEntries[0][0];
        const matches = liveEntities.filter((entity)=>entity.name === productId);
        if (matches.length === 1) root = matches[0];
        else if (matches.length > 1) {
            addDiagnostic(diagnostics, ASSEMBLY_DIAGNOSTIC_CODES.COUNTERTOP_OWNER_AMBIGUOUS, `More than one injected countertop entity matches owner "${productId}".`, {
                blocking: true,
                ownerId: productId
            });
        } else {
            addDiagnostic(diagnostics, ASSEMBLY_DIAGNOSTIC_CODES.COUNTERTOP_ENTITY_MISSING, `No live injected countertop entity matches owner "${productId}".`, {
                blocking: true,
                ownerId: productId
            });
        }
    } else if (liveEntities.length === 1) {
        // The reference is explicit, but missing composition ownership remains visible.
        root = liveEntities[0];
        productId = root.name || null;
        addDiagnostic(diagnostics, ASSEMBLY_DIAGNOSTIC_CODES.COUNTERTOP_OWNER_MISSING, 'The injected countertop entity is not registered as a countertop product.', {
            blocking: true,
            ownerId: productId
        });
    } else if (liveEntities.length > 1) {
        addDiagnostic(diagnostics, ASSEMBLY_DIAGNOSTIC_CODES.COUNTERTOP_OWNER_AMBIGUOUS, 'Multiple countertop entities were injected without an unambiguous composition owner.', {
            blocking: true,
            entityNames: liveEntities.map((entity)=>entity.name || null)
        });
    } else {
        addDiagnostic(diagnostics, ASSEMBLY_DIAGNOSTIC_CODES.COUNTERTOP_OWNER_MISSING, 'The composition has no countertop product owner.', {
            blocking: true
        });
    }
    const topSolid = resolveUniqueNamedDescendant(root, TOP_SOLID_NAME, ASSEMBLY_DIAGNOSTIC_CODES.TOP_SOLID_MISSING, ASSEMBLY_DIAGNOSTIC_CODES.TOP_SOLID_AMBIGUOUS, diagnostics, productId);
    const anchor = resolveUniqueNamedDescendant(root, TOP_SOLID_ANCHOR_NAME, ASSEMBLY_DIAGNOSTIC_CODES.TOP_SOLID_ANCHOR_MISSING, ASSEMBLY_DIAGNOSTIC_CODES.TOP_SOLID_ANCHOR_AMBIGUOUS, diagnostics, productId);
    if (topSolid && !hasMesh(topSolid)) {
        addDiagnostic(diagnostics, ASSEMBLY_DIAGNOSTIC_CODES.TOP_SOLID_MESH_MISSING, `Countertop mesh entity "${TOP_SOLID_NAME}" has no render/model mesh instances.`, {
            blocking: true,
            ownerId: productId
        });
    }
    return {
        productId,
        root,
        mesh: topSolid,
        anchor
    };
}
function resolveCabinetContexts(products, injectedEntities, diagnostics) {
    const productEntries = [
        ...products.entries()
    ].filter(([, snapshot])=>snapshot?.category === 'cabinets');
    const cabinetProducts = new Map(productEntries);
    const liveEntities = filterLiveRoots(injectedEntities, 'cabinet', diagnostics);
    const nameCounts = countNames(liveEntities);
    const contexts = [];
    for (const entity of liveEntities){
        const cabinetId = entity.name || null;
        if (!cabinetId || nameCounts.get(cabinetId) > 1) {
            addDiagnostic(diagnostics, ASSEMBLY_DIAGNOSTIC_CODES.CABINET_OWNER_AMBIGUOUS, 'An injected cabinet entity has no unique product owner id.', {
                blocking: true,
                ownerId: cabinetId
            });
            continue;
        }
        const snapshot = cabinetProducts.get(cabinetId) || null;
        if (!snapshot) {
            addDiagnostic(diagnostics, ASSEMBLY_DIAGNOSTIC_CODES.CABINET_OWNER_MISSING, `Injected cabinet "${cabinetId}" is not registered in this composition.`, {
                blocking: false,
                severity: 'warning',
                ownerId: cabinetId
            });
        }
        contexts.push({
            cabinetId,
            root: entity,
            snapshot,
            sink: null,
            sinkPoint: null
        });
    }
    const liveIds = new Set(contexts.map((item)=>item.cabinetId));
    for (const [cabinetId, snapshot] of productEntries){
        if (!liveIds.has(cabinetId)) {
            addDiagnostic(diagnostics, ASSEMBLY_DIAGNOSTIC_CODES.CABINET_ENTITY_MISSING, `Composition cabinet "${cabinetId}" has no live injected entity.`, {
                blocking: Boolean(snapshot?.sinkType),
                severity: snapshot?.sinkType ? 'error' : 'warning',
                ownerId: cabinetId
            });
        }
    }
    return contexts;
}
function resolveCabinetSink(cabinet, diagnostics) {
    const sinkIdFromConfig = cabinet.snapshot?.sinkType ?? null;
    const sinkPoints = findNamedDescendants(cabinet.root, SINK_POINT_NAME);
    if (sinkPoints.length === 0) {
        if (sinkIdFromConfig) {
            addDiagnostic(diagnostics, ASSEMBLY_DIAGNOSTIC_CODES.SINK_POINT_MISSING, `Cabinet "${cabinet.cabinetId}" has sinkType but no Sink_Point.`, {
                blocking: true,
                cabinetId: cabinet.cabinetId,
                sinkId: sinkIdFromConfig
            });
        }
        return null;
    }
    if (sinkPoints.length > 1) {
        addDiagnostic(diagnostics, ASSEMBLY_DIAGNOSTIC_CODES.SINK_POINT_AMBIGUOUS, `Cabinet "${cabinet.cabinetId}" has multiple Sink_Point anchors.`, {
            blocking: true,
            cabinetId: cabinet.cabinetId,
            sinkId: sinkIdFromConfig
        });
        return null;
    }
    const anchor = sinkPoints[0];
    cabinet.sinkPoint = anchor;
    const childRoots = (anchor.children || []).filter((child)=>isAssemblyEntityAlive(child));
    const isPlaceholder = sinkIdFromConfig === VESSEL_PLACEHOLDER_ID;
    if (isPlaceholder) {
        if (childRoots.length > 0) {
            addDiagnostic(diagnostics, ASSEMBLY_DIAGNOSTIC_CODES.VESSEL_PLACEHOLDER_HAS_ENTITY, `Vessel placeholder on cabinet "${cabinet.cabinetId}" still has a sink entity; it is not treated as an active sink.`, {
                blocking: false,
                severity: 'warning',
                cabinetId: cabinet.cabinetId,
                sinkId: sinkIdFromConfig
            });
        }
        return {
            bindingId: cabinet.cabinetId,
            cabinetId: cabinet.cabinetId,
            sinkId: sinkIdFromConfig,
            cabinetRoot: cabinet.root,
            anchor,
            root: null,
            visibleMeshes: [],
            isPlaceholder: true,
            siphon: null,
            transformRoot: null
        };
    }
    if (childRoots.length > 1) {
        addDiagnostic(diagnostics, ASSEMBLY_DIAGNOSTIC_CODES.SINK_ENTITY_AMBIGUOUS, `Cabinet "${cabinet.cabinetId}" has multiple live sink roots under Sink_Point.`, {
            blocking: true,
            cabinetId: cabinet.cabinetId,
            sinkId: sinkIdFromConfig,
            entityNames: childRoots.map((entity)=>entity.name || null)
        });
        return null;
    }
    const root = childRoots[0] || null;
    if (!root) {
        if (sinkIdFromConfig) {
            addDiagnostic(diagnostics, ASSEMBLY_DIAGNOSTIC_CODES.SINK_ENTITY_MISSING, `Configured sink "${sinkIdFromConfig}" has no live entity under cabinet "${cabinet.cabinetId}".`, {
                blocking: true,
                cabinetId: cabinet.cabinetId,
                sinkId: sinkIdFromConfig
            });
            return {
                bindingId: cabinet.cabinetId,
                cabinetId: cabinet.cabinetId,
                sinkId: sinkIdFromConfig,
                cabinetRoot: cabinet.root,
                anchor,
                root: null,
                visibleMeshes: [],
                isPlaceholder: false,
                siphon: null,
                transformRoot: null
            };
        }
        return null;
    }
    const visibleMeshes = collectTree(root).filter((node)=>hasMesh(node) && isEffectivelyEnabled(node, root) && !isBooleanHelper(node));
    const sinkId = sinkIdFromConfig || root.name || null;
    if (visibleMeshes.length === 0) {
        addDiagnostic(diagnostics, ASSEMBLY_DIAGNOSTIC_CODES.SINK_VISIBLE_MESH_MISSING, `Sink "${sinkId || '(unknown)'}" has no enabled visible mesh.`, {
            blocking: true,
            cabinetId: cabinet.cabinetId,
            sinkId
        });
    }
    return {
        bindingId: cabinet.cabinetId,
        cabinetId: cabinet.cabinetId,
        sinkId,
        cabinetRoot: cabinet.root,
        anchor,
        root,
        visibleMeshes,
        isPlaceholder: false,
        siphon: null,
        transformRoot: root
    };
}
function resolveCabinetCutters(cabinet, sink, output, diagnostics) {
    const candidates = collectTree(cabinet.root).filter((node)=>String(node.name || '').includes('BoolB_'));
    const sinkId = sink?.sinkId ?? cabinet.snapshot?.sinkType ?? null;
    for (const entity of candidates){
        if (!hasMesh(entity)) {
            addDiagnostic(diagnostics, ASSEMBLY_DIAGNOSTIC_CODES.CUTTER_MESH_MISSING, `Boolean helper "${entity.name || '(unnamed)'}" has no render/model mesh instances.`, {
                blocking: true,
                cabinetId: cabinet.cabinetId,
                sinkId
            });
            continue;
        }
        if (!sinkId) {
            addDiagnostic(diagnostics, ASSEMBLY_DIAGNOSTIC_CODES.CUTTER_OWNER_MISSING, `Boolean helper "${entity.name || '(unnamed)'}" has no sink owner id.`, {
                blocking: true,
                cabinetId: cabinet.cabinetId,
                sinkId: null
            });
        }
        output.push({
            kind: 'boolean-cutter',
            source: 'cabinet',
            cabinetId: cabinet.cabinetId,
            sinkId,
            root: entity,
            mesh: entity,
            transformRoot: entity
        });
    }
}
function resolveVesselCutters(countertopRoot, cabinets, output, diagnostics) {
    const cloneRoots = collectTree(countertopRoot).filter((node)=>node !== countertopRoot && String(node.name || '').startsWith(VESSEL_CUTTER_CLONE_PREFIX));
    const vesselOwners = cabinets.filter((cabinet)=>cabinet.sinkPoint && isVesselSinkId(cabinet.snapshot?.sinkType));
    const cloneCounts = countNames(cloneRoots);
    for (const root of cloneRoots){
        const name = String(root.name || '');
        const indexText = name.slice(VESSEL_CUTTER_CLONE_PREFIX.length);
        const index = /^\d+$/.test(indexText) ? Number(indexText) : null;
        const owner = index == null ? null : vesselOwners[index] || null;
        if (cloneCounts.get(name) > 1 || !owner) {
            addDiagnostic(diagnostics, cloneCounts.get(name) > 1 ? ASSEMBLY_DIAGNOSTIC_CODES.CUTTER_OWNER_AMBIGUOUS : ASSEMBLY_DIAGNOSTIC_CODES.CUTTER_OWNER_MISSING, `Vessel cutter "${name || '(unnamed)'}" has no unambiguous cabinet owner.`, {
                blocking: true,
                entityName: name || null
            });
        }
        const meshes = collectTree(root).filter(hasMesh);
        if (meshes.length === 0) {
            addDiagnostic(diagnostics, ASSEMBLY_DIAGNOSTIC_CODES.CUTTER_MESH_MISSING, `Vessel cutter "${name || '(unnamed)'}" has no render/model mesh instances.`, {
                blocking: true,
                cabinetId: owner?.cabinetId ?? null,
                sinkId: owner?.snapshot?.sinkType ?? null
            });
            continue;
        }
        for (const mesh of meshes){
            output.push({
                kind: 'boolean-cutter',
                source: 'vessel-clone',
                cabinetId: owner?.cabinetId ?? null,
                sinkId: owner?.snapshot?.sinkType ?? null,
                root,
                mesh,
                transformRoot: root
            });
        }
    }
}
function finishCountertopBinding(countertop, targets) {
    if (!countertop.root) return null;
    const moveTarget = findOwningTarget(countertop.root, targets);
    return Object.freeze({
        productId: countertop.productId,
        root: countertop.root,
        mesh: countertop.mesh,
        anchor: countertop.anchor,
        transformRoot: countertop.root,
        moveTarget,
        ancestorAlreadyMoves: moveTarget !== countertop.root
    });
}
function finishSinkBinding(sink, targets) {
    const moveTarget = sink.transformRoot ? findOwningTarget(sink.transformRoot, targets) : null;
    return Object.freeze({
        ...sink,
        visibleMeshes: Object.freeze([
            ...sink.visibleMeshes
        ]),
        moveTarget,
        ancestorAlreadyMoves: Boolean(moveTarget && moveTarget !== sink.transformRoot)
    });
}
function finishCutterBinding(cutter, targets) {
    const moveTarget = findOwningTarget(cutter.transformRoot, targets);
    return Object.freeze({
        ...cutter,
        moveTarget,
        ancestorAlreadyMoves: moveTarget !== cutter.transformRoot
    });
}
function filterLiveRoots(entities, kind, diagnostics) {
    const seen = new Set();
    const live = [];
    for (const entity of entities){
        if (!entity || seen.has(entity)) continue;
        seen.add(entity);
        if (isAssemblyEntityAlive(entity)) {
            live.push(entity);
            continue;
        }
        addDiagnostic(diagnostics, kind === 'countertop' ? ASSEMBLY_DIAGNOSTIC_CODES.COUNTERTOP_ENTITY_STALE : ASSEMBLY_DIAGNOSTIC_CODES.CABINET_ENTITY_STALE, `A destroyed or detached ${kind} reference was ignored.`, {
            blocking: true,
            entityName: entity.name || null
        });
    }
    return live;
}
function resolveUniqueNamedDescendant(root, name, missingCode, ambiguousCode, diagnostics, ownerId) {
    if (!root) return null;
    const matches = findNamedDescendants(root, name);
    if (matches.length === 1) return matches[0];
    addDiagnostic(diagnostics, matches.length === 0 ? missingCode : ambiguousCode, matches.length === 0 ? `Required entity "${name}" was not found under countertop "${ownerId || '(unknown)'}".` : `More than one entity named "${name}" exists under countertop "${ownerId || '(unknown)'}".`, {
        blocking: true,
        ownerId
    });
    return null;
}
function normalizeEntityCollection(value) {
    if (Array.isArray(value)) return value;
    if (value instanceof Map) return [
        ...value.values()
    ];
    if (value && typeof value === 'object') return Object.values(value);
    return [];
}
function collectTree(root) {
    if (!root) return [];
    const result = [];
    const stack = [
        root
    ];
    const visited = new Set();
    while(stack.length > 0){
        const node = stack.pop();
        if (!node || visited.has(node)) continue;
        visited.add(node);
        result.push(node);
        const children = node.children || [];
        for(let index = children.length - 1; index >= 0; index -= 1){
            stack.push(children[index]);
        }
    }
    return result;
}
function findNamedDescendants(root, name) {
    return collectTree(root).filter((node)=>node.name === name);
}
function hasMesh(entity) {
    const meshInstances = entity?.render?.meshInstances || entity?.model?.meshInstances;
    return Array.isArray(meshInstances) && meshInstances.length > 0;
}
function isEffectivelyEnabled(entity, boundaryRoot) {
    let current = entity;
    while(current){
        if (current.enabled === false) return false;
        if (current === boundaryRoot) return true;
        current = current.parent;
    }
    return false;
}
function isBooleanHelper(entity) {
    let current = entity;
    while(current){
        const name = String(current.name || '');
        if (name.includes('BoolB_') || name === VESSEL_CUTTER_TEMPLATE_NAME || name.startsWith(VESSEL_CUTTER_CLONE_PREFIX)) {
            return true;
        }
        current = current.parent;
    }
    return false;
}
function isVesselSinkId(sinkId) {
    return sinkId === VESSEL_PLACEHOLDER_ID || typeof sinkId === 'string' && sinkId.startsWith('Vessel_');
}
function countNames(entities) {
    const counts = new Map();
    for (const entity of entities){
        const name = entity?.name || null;
        counts.set(name, (counts.get(name) || 0) + 1);
    }
    return counts;
}
function selectTopLevelTargets(candidates) {
    const unique = [];
    const seen = new Set();
    for (const candidate of candidates){
        if (!candidate.entity || seen.has(candidate.entity)) continue;
        seen.add(candidate.entity);
        unique.push(candidate);
    }
    return unique.filter((candidate)=>!unique.some((other)=>other !== candidate && isStrictAncestor(other.entity, candidate.entity)));
}
function findOwningTarget(entity, targets) {
    return targets.find((target)=>target.entity === entity || isStrictAncestor(target.entity, entity))?.entity || null;
}
function isStrictAncestor(ancestor, entity) {
    let current = entity?.parent || null;
    while(current){
        if (current === ancestor) return true;
        current = current.parent;
    }
    return false;
}
function addDiagnostic(diagnostics, code, message, details = {}) {
    diagnostics.push({
        code,
        severity: details.severity || (details.blocking ? 'error' : 'info'),
        blocking: Boolean(details.blocking),
        message,
        ...details
    });
}

export { ASSEMBLY_DIAGNOSTIC_CODES, isAssemblyEntityAlive, resolveCountertopAssembly };
