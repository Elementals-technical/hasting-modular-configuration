import { Entity } from '../../../../../playcanvas-stable.min.mjs';
import { measureDetachedEngineeringRoot } from '../../domain/cabinet-placement/engineering/engineering-measurement.mjs';
import { createSCLineEngineeringProfile, createSCLineEngineeringPlacement } from '../../domain/cabinet-placement/engineering/ulh-line-engineering-profile.mjs';
import { createSCLineSpatialProfile } from '../../domain/cabinet-placement/engineering/sc-line-spatial-profile.mjs';
import { translateEngineeringBox, engineeringBoxesOverlap } from '../../domain/cabinet-placement/engineering/ulh-engineering-profile.mjs';
import { createIsolatedTemplateGeometry } from '../../domain/cabinet-placement/adapters/isolated-template-geometry.mjs';
import { createIsolatedProductConfigurator } from '../../domain/cabinet-placement/adapters/isolated-product-configurator.mjs';
import { createProductPreviewAdapter } from '../../domain/cabinet-placement/adapters/product-preview-adapter.mjs';
import { createCabinetPreviewValidationVisual } from '../../domain/cabinet-placement/adapters/cabinet-preview-validation-visual.mjs';
import { ProductFactory } from '../../domain/product/factory/product-factory.mjs';
import { cloneData, canonicalKey } from '../../domain/cabinet-placement/cabinet-contracts.mjs';
import { RuleVisibleULHSideCabinet } from '../../domain/product/rules/UrbanLowHeight/RuleVisibleULHSideCabinet.mjs';
import { RuleWidthULHCabinet } from '../../domain/product/rules/UrbanLowHeight/RuleWidthULHCabinet.mjs';
import { RuleHeightULHCabinet } from '../../domain/product/rules/UrbanLowHeight/RuleHeightULHCabinet.mjs';
import { RuleDepthULHCabinet } from '../../domain/product/rules/UrbanLowHeight/RuleDepthULHCabinet.mjs';
import { RuleHandleULHCabinet } from '../../domain/product/rules/UrbanLowHeight/RuleHandleULHCabinet.mjs';
import { resolveBasinTopProduct, isCabinetCoverProduct } from '../../domain/countertop/countertop-role.mjs';
import { createUlHSupportDescriptor } from '../../domain/countertop/cover/adapters/cover-support-adapter.mjs';
import { measureEntityBoundsM } from '../../domain/spatial-manipulation/playcanvas/scene-measure.mjs';
import { ProductRegistry_V2 } from '../../domain/product/registry/product-registry-v2.mjs';
import { measureSCLineBasinTop, measureSCLineTopSupportCabinetIds, planSCLineTopSurface, planSCLineCoverSurfaces, materializeSCLineCoverDescriptors, configureSCLineCoverRoot } from '../../domain/cabinet-placement/engineering/sc-line-surfaces.mjs';
import { exposeSCLineSupports } from '../../domain/cabinet-placement/engineering/sc-line-exposed-supports.mjs';
import { findTopSolid, measureTopSolid, prepareTopSolidGeometry } from '../../domain/countertop/cover/adapters/cover-product-port.mjs';

const fail = (code)=>Object.assign(new Error(code), {
        code
    });
const rules = [
    RuleVisibleULHSideCabinet,
    RuleWidthULHCabinet,
    RuleHeightULHCabinet,
    RuleDepthULHCabinet,
    RuleHandleULHCabinet
];
const orientation = (frame)=>({
        xAxis: frame.xAxis,
        yAxis: frame.yAxis,
        zAxis: frame.zAxis
    });
const shifted = (box, p)=>translateEngineeringBox(box, {
        x: -p.x,
        y: -p.y,
        z: -p.z
    });
const vec3Data = (value)=>({
        x: value.x,
        y: value.y,
        z: value.z
    });
function createSCConfigurator({ app, geometry, measure, bounds, cache }) {
    return createIsolatedProductConfigurator({
        resolvePlan: ({ productType })=>productType === 'ULH-side-cabinet' ? {
                status: 'ready',
                rules: rules.map((rule, i)=>({
                        rule,
                        priority: (i + 1) * 10
                    }))
            } : {
                status: 'unsupported'
            },
        prepareGeometry: async (entity, options)=>{
            const handle = await geometry.prepare(entity, {
                ...options,
                uncutTargetNames: [
                    'ULH_Drawer_Floor',
                    'ULH_Drawer_BWall',
                    'ULH_Cabinet_Walls'
                ]
            });
            return {
                verify: handle.verify,
                dispose: handle.dispose
            };
        },
        verifyGeometry: ({ entity, productType, config })=>{
            const box = measure(entity), offset = {
                x: (box.min.x + box.max.x) / 2,
                y: box.min.y,
                z: box.min.z
            };
            for (const child of entity.children){
                const p = child.getLocalPosition();
                child.setLocalPosition(p.x - offset.x, p.y - offset.y, p.z - offset.z);
            }
            const normalized = shifted(box, offset);
            bounds.set(entity, normalized);
            cache.set(canonicalKey({
                type: productType,
                config
            }), normalized);
            return {
                status: 'ready'
            };
        }
    });
}
/** Trusted engineering provider for an already-live, SC-only line composition.
 * Prepare borrows roots without reconfiguring or reparenting them. New geometry is
 * isolated and its temporary resources belong to release()/runtime cleanup.
 */ function createCabinetLineEngineeringProvider({ app, createHandoff = null, factory = null, geometry = null, createConfigureNew = null, measureRoot = measureDetachedEngineeringRoot, createPreviewRoot = null, measureBasinTop = measureSCLineBasinTop, createSupport = createUlHSupportDescriptor, measureSurface = measureEntityBoundsM, loadMaterial = null, defaultCoverSettings = null, surfaceTolerances = {
    contactM: .001,
    adjacencyM: .001,
    numericalM: 1e-6
}, geometryFingerprintToleranceM = 1e-6 } = {}) {
    if (!app?.root) throw fail('INVALID_APPLICATION');
    if (!Number.isFinite(geometryFingerprintToleranceM) || geometryFingerprintToleranceM < 0) throw fail('INVALID_APPLICATION');
    return async function prepareFromLine({ app: requestedApp = app, manager = app.compositionManager, source } = {}) {
        if (requestedApp !== app || !manager || manager !== app.compositionManager) throw fail('INVALID_APPLICATION');
        const basinIdentity = resolveBasinTopProduct(source?.products);
        if (basinIdentity.status === 'ambiguous') throw fail('LINE_CASE_UNSUPPORTED');
        let coverSettings = source?.serialized?.features?.cabinetCover ?? defaultCoverSettings;
        const productFactory = factory ?? new ProductFactory({
            app
        });
        if (coverSettings === null) {
            let probe;
            try {
                probe = await productFactory.createProductEntity('Cabinet_Cover', {}, {
                    purpose: 'preview',
                    productId: 'line-engineering-cover-template-probe'
                });
                const mesh = findTopSolid(probe), measured = measureTopSolid({
                    root: probe,
                    meshEntity: mesh
                });
                const thicknessM = measured.yMaxM - measured.yMinM;
                if (!Number.isFinite(thicknessM) || thicknessM <= 0) throw fail('COVER_TEMPLATE_UNAVAILABLE');
                coverSettings = {
                    enabled: true,
                    profileId: 'ulh-v1',
                    eligibilityMode: 'all',
                    thicknessM,
                    tolerances: cloneData(surfaceTolerances)
                };
                source = {
                    ...source,
                    serialized: {
                        ...source.serialized,
                        features: {
                            ...source.serialized.features,
                            cabinetCover: cloneData(coverSettings)
                        }
                    }
                };
            } catch (error) {
                throw error?.code ? error : fail('COVER_TEMPLATE_UNAVAILABLE');
            } finally{
                probe?.destroy();
            }
        }
        const readCabinetMaterial = (root, snapshot)=>{
            const explicit = snapshot?.CabinetColor;
            if (typeof explicit === 'string' && explicit.trim() && explicit !== 'None') return explicit;
            const walls = root?.findByName?.('ULH_Cabinet_Walls');
            const material = (walls?.render ?? walls?.model)?.meshInstances?.[0]?.material;
            return typeof material?.name === 'string' && material.name.trim() ? material.name : null;
        };
        const supportsFor = (items, resolveRoot)=>items.map(({ id, snapshot })=>{
                const root = resolveRoot(id);
                const measureSupport = (entity)=>entity?.enabled === false ? measureDetachedEngineeringRoot(entity) : measureSurface(entity);
                const result = createSupport({
                    productId: id,
                    snapshot: {
                        ...snapshot,
                        productType: 'ULH-side-cabinet',
                        CabinetRole: 'SC',
                        CabinetColor: readCabinetMaterial(root, snapshot),
                        eligibilityMode: coverSettings?.eligibilityMode ?? 'all'
                    },
                    root,
                    measure: measureSupport,
                    registry: ProductRegistry_V2.instance
                });
                if (result?.status !== 'supported' || !result.support) throw Object.assign(fail('SUPPORT_GEOMETRY_PENDING'), {
                    reasons: cloneData(result?.diagnostics ?? [])
                });
                return result.support;
            });
        let originalBasinTop = null, originalSupports = [];
        if (basinIdentity.status === 'found') {
            const root = app.root.findByName?.(basinIdentity.productId);
            const measured = measureBasinTop({
                productId: basinIdentity.productId,
                root,
                measure: measureSurface
            });
            if (measured?.status !== 'supported') throw fail('BASIN_TOP_GEOMETRY_PENDING');
            originalBasinTop = measured.basinTop;
            originalSupports = supportsFor(source.entities.filter((item)=>source.products[item.id]?.productType === 'ULH-side-cabinet').map((item)=>({
                    id: item.id,
                    snapshot: source.products[item.id]
                })), (id)=>app.root.findByName?.(id));
            const contact = measureSCLineTopSupportCabinetIds({
                basinTop: originalBasinTop,
                supports: originalSupports,
                tolerances: coverSettings?.tolerances ?? surfaceTolerances
            });
            if (contact.status !== 'ready') throw fail('TOP_SUPPORT_UNRESOLVED');
            source = {
                ...source,
                topSupportCabinetIds: contact.cabinetIds
            };
        }
        const profile = createSCLineEngineeringProfile({
            source,
            readCurrentDocument: ()=>manager.getComposition?.(source.compositionId)?.getCabinetDocument?.()?.document ?? null
        });
        const roots = new Map(), knownRoots = new Map(), localBounds = new Map(), bounds = new WeakMap(), cache = new Map(), probes = new Set();
        const frame = profile.initialDocument.frames[0], initialRecords = [];
        let preview = null, previewRoot = null, handoff = null, closed = false, releaseJob = null, probeId = 0, topTemplate = null;
        const topPlans = new Map();
        let nextCoverId = 0;
        const geometryPort = geometry ?? createIsolatedTemplateGeometry({
            app
        });
        const configure = (createConfigureNew ?? createSCConfigurator)({
            app,
            geometry: geometryPort,
            measure: measureRoot,
            bounds,
            cache
        });
        const sceneFactory = {
            createProductEntity: async (type, config, context)=>{
                if (type === 'Top_Solid') {
                    if (!topTemplate?.clone) throw fail('TOP_TEMPLATE_UNAVAILABLE');
                    const entity = topTemplate.clone();
                    entity.name = context.productId;
                    entity.enabled = false;
                    return entity;
                }
                return productFactory.createProductEntity(type, config, context);
            }
        };
        const resolveMaterial = loadMaterial ?? (async (materialId)=>{
            const { MaterialService } = await import('../../services/material/material-service.mjs');
            if (MaterialService._getApp() !== app) MaterialService.init(app);
            return MaterialService.loadMaterial(materialId);
        });
        const configureScene = async (entity, config, options)=>{
            if (options.productType === 'Cabinet_Cover') {
                const material = await resolveMaterial(config.materialId);
                const calibrated = configureSCLineCoverRoot({
                    root: entity,
                    segment: config.coverSegment,
                    material
                });
                return {
                    positionM: calibrated.positionM,
                    afterEnable: calibrated.refreshMaterial,
                    release: null
                };
            }
            if (options.productType === 'Top_Solid') {
                const planned = topPlans.get(canonicalKey(options.document));
                if (!planned) throw fail('TOP_PLAN_REQUIRED');
                if (!planned.changed) {
                    const p = entity.getPosition();
                    return {
                        positionM: {
                            x: p.x,
                            y: p.y,
                            z: p.z
                        },
                        release: null
                    };
                }
                const mesh = findTopSolid(entity), slab = measureTopSolid({
                    root: entity,
                    meshEntity: mesh
                });
                const originalMesh = findTopSolid(app.root.findByName(profile.primarySourceTemplate.id) ?? topTemplate);
                const originalMaterial = (originalMesh.render ?? originalMesh.model)?.meshInstances?.[0]?.material;
                if (!originalMaterial) throw fail('TOP_MATERIAL_UNRESOLVED');
                const stack = [
                    {
                        node: entity,
                        active: true
                    }
                ];
                while(stack.length){
                    const { node, active: parentActive } = stack.pop();
                    const active = parentActive && (node === entity || node._enabled !== false);
                    const component = node.render ?? node.model;
                    if (active && node !== mesh && component?.enabled !== false && component?.meshInstances?.some((instance)=>instance.visible !== false)) throw fail('TOP_DECORATION_UNSUPPORTED');
                    if (node.script) node.script.enabled = false;
                    stack.push(...(node.children ?? []).map((child)=>({
                            node: child,
                            active
                        })));
                }
                const segment = {
                    ...planned.basinTop,
                    thicknessM: slab.yMaxM - slab.yMinM};
                prepareTopSolidGeometry({
                    root: entity,
                    meshEntity: mesh,
                    segment,
                    measure: measureTopSolid
                });
                if (mesh.render) mesh.render.materialAssets = [];
                const afterEnable = ()=>{
                    for (const instance of (mesh.render ?? mesh.model)?.meshInstances ?? [])instance.material = originalMaterial;
                };
                afterEnable();
                const p = entity.getPosition();
                return {
                    positionM: {
                        x: p.x,
                        y: p.y,
                        z: p.z
                    },
                    afterEnable,
                    release: null
                };
            }
            return configure(entity, config, options);
        };
        const choiceKey = (choice)=>{
            const resolved = profile.catalog.resolveChoice(choice);
            if (resolved.status !== 'valid') throw fail('INVALID_CONFIGURATION');
            return {
                resolved,
                key: canonicalKey({
                    type: resolved.runtime.productType,
                    config: resolved.runtime.config
                })
            };
        };
        let fingerprint = null, revision = 0;
        const getBounds = (choice)=>{
            const { key } = choiceKey(choice);
            // Published cabinets have a real, configured scene root. Its measured
            // envelope remains authoritative even when a dependency change clears
            // the disposable template-probe cache (for example, preset replacement
            // retires the last borrowed SC root).
            if (choice.id) {
                const committed = manager.getComposition?.(source.compositionId)?.getCabinetDocument?.()?.document;
                if (committed?.cabinets?.some((c)=>c.id === choice.id && c.definitionId === choice.definitionId && canonicalKey(c.selection) === canonicalKey(choice.selection))) {
                    const entity = app.root.findByName?.(choice.id);
                    if (!entity || entity.enabled !== true) return null;
                    const measured = measureRoot(entity);
                    return measured ? shifted(measured, entity.getPosition()) : null;
                }
            }
            return localBounds.get(choice.definitionId) ?? cache.get(key) ?? null;
        };
        const measureChoice = async (choice)=>{
            if (closed) throw fail('API_DESTROYED');
            const existing = getBounds(choice);
            if (existing) return cloneData(existing);
            const { resolved, key } = choiceKey(choice);
            const job = (async ()=>{
                const entity = await productFactory.createProductEntity(resolved.runtime.productType, resolved.runtime.config, {
                    purpose: 'preview',
                    productId: `line-engineering-probe-${++probeId}`
                });
                let release;
                try {
                    release = await configure(entity, resolved.runtime.config, {
                        productType: resolved.runtime.productType
                    });
                    const measured = bounds.get(entity);
                    if (!measured) throw fail('GEOMETRY_PENDING');
                    cache.set(key, measured);
                    return cloneData(measured);
                } finally{
                    try {
                        await release?.();
                    } finally{
                        entity.destroy();
                    }
                }
            })();
            probes.add(job);
            try {
                return await job;
            } finally{
                probes.delete(job);
            }
        };
        const resourceState = (root)=>{
            const vector = (value, keys)=>value ? Object.fromEntries(keys.map((k)=>[
                        k,
                        Number.isFinite(value[k]) ? value[k] : null
                    ])) : null;
            const color = (value)=>vector(value, [
                    'r',
                    'g',
                    'b',
                    'a'
                ]);
            const nodes = [];
            const visit = (node, isRoot = false)=>{
                const meshes = (node.render ?? node.model)?.meshInstances ?? [];
                nodes.push({
                    name: node.name,
                    enabled: node._enabled ?? node.enabled ?? null,
                    localPosition: isRoot ? null : vector(node.getLocalPosition?.(), [
                        'x',
                        'y',
                        'z'
                    ]),
                    localScale: vector(node.getLocalScale?.(), [
                        'x',
                        'y',
                        'z'
                    ]),
                    localRotation: vector(node.getLocalRotation?.(), [
                        'x',
                        'y',
                        'z',
                        'w'
                    ]),
                    meshes: meshes.map((mi)=>({
                            mesh: objectId(mi.mesh),
                            vertexBuffer: objectId(mi.mesh?.vertexBuffer),
                            aabb: mi.mesh?.aabb ? {
                                center: vector(mi.mesh.aabb.center, [
                                    'x',
                                    'y',
                                    'z'
                                ]),
                                halfExtents: vector(mi.mesh.aabb.halfExtents, [
                                    'x',
                                    'y',
                                    'z'
                                ])
                            } : null,
                            material: objectId(mi.material),
                            materialState: mi.material ? {
                                diffuse: color(mi.material.diffuse),
                                opacity: mi.material.opacity ?? null,
                                emissive: color(mi.material.emissive),
                                metalness: mi.material.metalness ?? null,
                                gloss: mi.material.gloss ?? null
                            } : null
                        }))
                });
                for (const child of node.children ?? [])visit(child);
            };
            visit(root, true);
            return canonicalKey(nodes);
        };
        let stagedPose = null;
        const samePose = (a, b)=>Boolean(a && b && [
                'x',
                'y',
                'z'
            ].every((axis)=>Math.abs(a[axis] - b[axis]) < 1e-7));
        const fingerprintLocalBounds = new Map();
        const stableLocal = (id, box)=>{
            if (!box) {
                fingerprintLocalBounds.delete(id);
                return null;
            }
            const previous = fingerprintLocalBounds.get(id);
            if (previous && [
                'min',
                'max'
            ].every((side)=>[
                    'x',
                    'y',
                    'z'
                ].every((axis)=>Number.isFinite(box[side]?.[axis]) && Math.abs(box[side][axis] - previous[side][axis]) <= geometryFingerprintToleranceM))) return previous;
            const observed = cloneData(box);
            fingerprintLocalBounds.set(id, observed);
            return observed;
        };
        const readGeometryRevision = ()=>{
            // The borrowed roots and the authoring template are external dependencies.
            // A changed mesh envelope or hot-swapped template invalidates options.
            const template = app.assets?.find?.('ULH_Cabinet', 'template');
            const observations = [
                template?.id ?? null,
                template?.resource ?? null
            ];
            const committed = manager.getComposition?.(source.compositionId)?.getCabinetDocument?.()?.document;
            const active = committed?.cabinets ?? profile.initialDocument.cabinets;
            const activeIds = new Set(active.map((item)=>item.id));
            for (const id of fingerprintLocalBounds.keys())if (!activeIds.has(id)) fingerprintLocalBounds.delete(id);
            for (const cabinet of active){
                const id = cabinet.id, entity = app.root.findByName?.(id) ?? knownRoots.get(id) ?? roots.get(id);
                if (!entity || entity.enabled !== true) {
                    observations.push(id, 'missing');
                    continue;
                }
                knownRoots.set(id, entity);
                const box = measureRoot(entity), p = entity.getPosition(), measuredLocal = box && shifted(box, p);
                const local = stableLocal(id, measuredLocal);
                const allowed = stagedPose?.id === id ? stagedPose.positionM : cabinet.positionM;
                observations.push(id, local, resourceState(entity), samePose(p, allowed) ? 'pose-valid' : p);
                if (cabinet.definitionId.startsWith('LEGACY-SC:') && measuredLocal) localBounds.set(cabinet.definitionId, measuredLocal);
            }
            const next = observations.map((v)=>v && typeof v === 'object' ? objectId(v) : canonicalKey(v));
            const key = canonicalKey(next);
            if (fingerprint !== null && key !== fingerprint) {
                revision++;
                cache.clear();
            }
            fingerprint = key;
            return revision;
        };
        const objectIds = new WeakMap();
        let nextObjectId = 0;
        function objectId(value) {
            // Only stable identity is wanted for engine resources. Plain measured boxes
            // are serialized by value below.
            if (value === null || value === undefined) return null;
            if (typeof value !== 'object' && typeof value !== 'function') return value;
            if (Object.hasOwn(value, 'min') && Object.hasOwn(value, 'max')) return canonicalKey(value);
            if (!objectIds.has(value)) objectIds.set(value, ++nextObjectId);
            return objectIds.get(value);
        }
        const readAppliedTopFingerprint = ()=>{
            const products = manager.getComposition?.(source.compositionId)?.getAllProducts?.() ?? {};
            const observations = Object.entries(products).filter(([, snapshot])=>snapshot?.productType === 'Top_Solid').sort(([a], [b])=>a.localeCompare(b)).map(([id])=>{
                const root = app.root.findByName?.(id);
                if (!root?.getPosition) return {
                    id,
                    root: null
                };
                let slab;
                try {
                    slab = measureTopSolid({
                        root,
                        meshEntity: findTopSolid(root)
                    });
                } catch  {
                    return {
                        id,
                        root: objectId(root),
                        pose: vec3Data(root.getPosition()),
                        slab: null,
                        resources: resourceState(root)
                    };
                }
                return {
                    id,
                    root: objectId(root),
                    pose: vec3Data(root.getPosition()),
                    slab: Object.fromEntries(Object.entries(slab).map(([key, value])=>[
                            key,
                            Number.isFinite(value) ? Math.round(value * 1e9) / 1e9 : null
                        ])),
                    resources: resourceState(root)
                };
            });
            return canonicalKey(observations);
        };
        try {
            const primaryIds = new Set([
                ...profile.initialDocument.cabinets,
                ...profile.initialDocument.primarySources
            ].map((item)=>item.id));
            for (const descriptor of source.entities.filter((item)=>primaryIds.has(item.id))){
                const entity = app.root.findByName?.(descriptor.id);
                if (!entity || entity.name !== descriptor.id || !entity.destroy || !entity.getPosition || !entity.setPosition || entity.enabled !== true) throw fail('LEGACY_ENTITY_NOT_FOUND');
                const config = profile.legacyConfigs.get(descriptor.id);
                const cabinet = profile.initialDocument.cabinets.some((item)=>item.id === descriptor.id);
                const box = cabinet ? measureRoot(entity) : originalBasinTop;
                if (!config || !box) throw fail('GEOMETRY_PENDING');
                roots.set(descriptor.id, entity);
                if (cabinet) localBounds.set(`LEGACY-SC:${descriptor.id}`, shifted(box, descriptor.positionM));
                const productType = cabinet ? 'ULH-side-cabinet' : 'Top_Solid';
                initialRecords.push({
                    id: descriptor.id,
                    entity,
                    productType,
                    config,
                    positionM: cloneData(descriptor.positionM),
                    derived: false,
                    signature: canonicalKey({
                        productType,
                        config,
                        derived: false,
                        orientation: orientation(frame)
                    })
                });
            }
            if (profile.primarySourceTemplate) {
                const top = roots.get(profile.primarySourceTemplate.id);
                if (typeof top?.clone === 'function') {
                    topTemplate = top.clone();
                    topTemplate.enabled = false;
                }
            }
            for (const descriptor of source.entities.filter((item)=>isCabinetCoverProduct(source.products[item.id]))){
                const entity = app.root.findByName?.(descriptor.id), saved = source.products[descriptor.id];
                if (!entity || !saved?.coverSegment || !entity.destroy || !entity.getPosition) throw fail('COVER_OWNERSHIP_UNRESOLVED');
                const config = {
                    CountertopRole: 'cabinetCover',
                    generatedBy: 'cabinet-cover-v1',
                    materialId: saved.materialId,
                    thicknessM: saved.thicknessM,
                    coverSegment: cloneData(saved.coverSegment)
                };
                initialRecords.push({
                    id: descriptor.id,
                    entity,
                    productType: 'Cabinet_Cover',
                    config,
                    positionM: cloneData(descriptor.positionM),
                    derived: true,
                    signature: canonicalKey({
                        productType: 'Cabinet_Cover',
                        config,
                        derived: true,
                        orientation: null
                    })
                });
            }
            const baselineY = profile.initialDocument.cabinets[0].positionM.y;
            if (profile.initialDocument.cabinets.some((item)=>Math.abs(item.positionM.y - baselineY) > 1e-6)) throw fail('LINE_CASE_UNSUPPORTED');
            const preparedRevision = readGeometryRevision();
            const handoffFactory = createHandoff ?? (await import('../../domain/cabinet-placement/adapters/legacy-cabinet-handoff.mjs')).createLegacyCabinetHandoff;
            if (typeof handoffFactory !== 'function') throw fail('LEGACY_HANDOFF_REQUIRED');
            handoff = await handoffFactory({
                app,
                manager,
                compositionId: source.compositionId,
                entities: [
                    ...profile.initialDocument.cabinets,
                    ...profile.initialDocument.primarySources
                ].map((item)=>roots.get(item.id))
            });
            if (typeof handoff?.verifyReadiness !== 'function' || typeof handoff?.quiesceLegacy !== 'function') throw fail('INVALID_QUIESCENCE_PORT');
            if (readGeometryRevision() !== preparedRevision) throw fail('STALE_DEPENDENCIES');
            previewRoot = createPreviewRoot ? createPreviewRoot() : new Entity('Line engineering previews');
            app.root.addChild(previewRoot);
            const physicalInputReady = typeof app.selectTool?.getSelectionTargetAt === 'function' && typeof app.selectTool?.setEntitySemanticState === 'function';
            const visual = physicalInputReady ? createCabinetPreviewValidationVisual({
                selectTool: app.selectTool
            }) : null;
            const previewFactory = {
                createProductEntity: async (type, config, context)=>{
                    if (context.kind !== 'move') return productFactory.createProductEntity(type, config, context);
                    const original = app.root.findByName?.(context.sourceProductId);
                    if (!original?.clone || !profile.initialDocument.cabinets.some((item)=>item.id === context.sourceProductId) && !manager.getComposition?.(source.compositionId)?.getCabinetDocument?.()?.document?.cabinets?.some((item)=>item.id === context.sourceProductId)) throw fail('UNKNOWN_CABINET');
                    const clone = original.clone();
                    clone.name = context.productId;
                    const nodes = [
                        clone
                    ];
                    while(nodes.length){
                        const node = nodes.pop();
                        if (node.script) node.script.enabled = false;
                        nodes.push(...node.children ?? []);
                    }
                    return clone;
                }
            };
            const previewAdapter = createProductPreviewAdapter({
                factory: previewFactory,
                previewRoot,
                configure: (entity, config, options)=>options.kind === 'move' ? null : configure(entity, config, options),
                measure: (entity)=>({
                        status: 'ready',
                        bounds: bounds.get(entity) ?? shifted(measureRoot(entity), entity.getPosition())
                    }),
                resolvePlacement: (p)=>p.kind === 'free' ? p.positionM : {
                        x: 0,
                        y: baselineY,
                        z: 0
                    },
                applyPose: (entity, p)=>entity.setPosition(p.x, p.y, p.z),
                setValidation: (entity, value)=>visual?.setValidation(entity, value)
            });
            // Move-only freshness guard. The preview handle retains its applied-top baseline
            // through preview disposal without taking ownership of any scene resource.
            const moveTargets = new WeakMap(), moveTopBaselines = new WeakMap();
            const assertMoveTopCurrent = (handle)=>{
                const baseline = moveTopBaselines.get(handle);
                if (baseline === undefined || readAppliedTopFingerprint() !== baseline) throw fail('STALE_DEPENDENCIES');
            };
            preview = {
                ...previewAdapter,
                create (choice, options) {
                    if (options?.kind !== 'move' && choice?.definitionId !== 'TEST-SC') throw fail('LINE_LEGACY_CHOICE_NOT_ADDABLE');
                    const topBaseline = options?.kind === 'move' ? readAppliedTopFingerprint() : null;
                    return previewAdapter.create(choice, options).then((handle)=>{
                        if (options?.kind === 'move') {
                            moveTargets.set(handle, app.root.findByName?.(options.productId));
                            moveTopBaselines.set(handle, topBaseline);
                        } else previewAdapter.getPickTarget(handle)?.setPosition(0, baselineY, 0);
                        return handle;
                    });
                },
                containsPickTarget (handle, target) {
                    if (previewAdapter.containsPickTarget(handle, target)) return true;
                    const original = moveTargets.get(handle);
                    for(let node = target; node; node = node.parent)if (node === original) return true;
                    return false;
                }
            };
            const placement = createSCLineEngineeringPlacement({
                catalog: profile.catalog,
                getBounds,
                measureChoice,
                baselineY,
                primarySourceTemplate: profile.primarySourceTemplate
            });
            const projectSupports = (records)=>supportsFor(records.map((record)=>({
                        id: record.id,
                        snapshot: record.config
                    })), (id)=>records.find((item)=>item.id === id)?.entity).map((support)=>{
                    const record = records.find((item)=>item.id === support.cabinetId), actual = record.entity.getPosition();
                    const dx = record.positionM.x - actual.x, dy = record.positionM.y - actual.y, dz = record.positionM.z - actual.z;
                    return {
                        ...support,
                        xMinM: support.xMinM + dx,
                        xMaxM: support.xMaxM + dx,
                        yTopM: support.yTopM + dy,
                        zMinM: support.zMinM + dz,
                        zMaxM: support.zMaxM + dz
                    };
                });
            const originalMoveBuilder = placement.buildMoveDocument;
            placement.buildMoveDocument = (candidate, model)=>{
                const plan = originalMoveBuilder(candidate, model);
                if (canonicalKey(plan.document) === canonicalKey(model.document) || !plan.document.primarySources.length) return plan;
                const top = plan.document.primarySources[0], root = app.root.findByName?.(top.id);
                const measured = measureBasinTop({
                    productId: top.id,
                    root,
                    measure: measureSurface
                });
                if (measured.status !== 'supported' || !root?.getPosition) throw fail('BASIN_TOP_GEOMETRY_PENDING');
                const rootPositionM = vec3Data(root.getPosition());
                const fixed = top.payload.stationarySurface ?? {
                    basinTop: measured.basinTop,
                    rootPositionM
                };
                if (canonicalKey(fixed.basinTop) !== canonicalKey(measured.basinTop) || canonicalKey(fixed.rootPositionM) !== canonicalKey(rootPositionM)) throw fail('STALE_DEPENDENCIES');
                const records = plan.document.cabinets.map((item)=>{
                    const choice = profile.catalog.resolveChoice(item), entity = app.root.findByName?.(item.id);
                    if (choice.status !== 'valid') throw fail('INVALID_CONFIGURATION');
                    if (!entity) throw fail('SCENE_MODEL_UNAVAILABLE');
                    return {
                        id: item.id,
                        entity,
                        config: choice.runtime.config,
                        positionM: item.positionM
                    };
                });
                const contact = measureSCLineTopSupportCabinetIds({
                    basinTop: fixed.basinTop,
                    supports: projectSupports(records),
                    tolerances: coverSettings?.tolerances ?? surfaceTolerances
                });
                if (contact.status !== 'ready') throw fail('TOP_SUPPORT_UNRESOLVED');
                top.cabinetReferences = contact.cabinetIds;
                top.payload.stationarySurface = cloneData(fixed);
                return plan;
            };
            const evaluate = placement.evaluate;
            placement.evaluate = async (candidate, context)=>{
                const result = await evaluate(candidate, context);
                if (result.effectivePlacement) await preview.setPose(context.handle, {
                    kind: 'free',
                    ...result.effectivePlacement
                });
                return result;
            };
            const topSource = profile.primarySourceTemplate;
            const originalTopSupports = originalSupports.filter((item)=>topSource?.cabinetReferences.includes(item.cabinetId));
            const livePreviousCovers = ()=>Object.entries(manager.getComposition?.(source.compositionId)?.getAllProducts?.() ?? {}).filter(([, snapshot])=>isCabinetCoverProduct(snapshot)).map(([productId, snapshot])=>({
                        productId,
                        segment: snapshot.coverSegment
                    }));
            const planSurfaces = ({ document, records, allocate = true })=>{
                if (document.frames.length !== 1 || canonicalKey(document.frames[0]) !== canonicalKey(frame) || document.connections.length || canonicalKey(document.featureSettings) !== canonicalKey(profile.initialDocument.featureSettings)) return {
                    status: 'unsupported'
                };
                const cabinetIds = new Set(document.cabinets.map((item)=>item.id));
                if (records.length !== cabinetIds.size || records.some((item)=>!cabinetIds.has(item.id))) return {
                    status: 'pending'
                };
                const boxes = [];
                for (const record of records){
                    const actual = record.entity.getPosition();
                    const local = bounds.get(record.entity) ?? (measureRoot(record.entity) && shifted(measureRoot(record.entity), actual));
                    if (!local) return {
                        status: 'pending'
                    };
                    const box = translateEngineeringBox(local, record.positionM);
                    if (boxes.some((other)=>engineeringBoxesOverlap(box, other.box))) return {
                        status: 'invalid',
                        reasons: [
                            {
                                code: 'CABINET_OVERLAP'
                            }
                        ]
                    };
                    boxes.push({
                        id: record.id,
                        box
                    });
                }
                if (!document.primarySources.length && coverSettings.enabled === false) return {
                    status: 'valid',
                    primary: [],
                    derived: []
                };
                let supports;
                try {
                    supports = projectSupports(records);
                } catch (error) {
                    return {
                        status: 'pending',
                        reasons: error?.reasons?.length ? error.reasons : [
                            {
                                code: 'SUPPORT_GEOMETRY_PENDING'
                            }
                        ]
                    };
                }
                const sourceRecord = document.primarySources.find((item)=>item.subsystem === 'basinTop') ?? null;
                if (document.primarySources.length !== (sourceRecord ? 1 : 0)) return {
                    status: 'unsupported'
                };
                let primary = [], basinTops = [], topVolume = null;
                if (sourceRecord) {
                    const descriptor = profile.resolvePrimarySource(sourceRecord, document);
                    let target = originalBasinTop, changed = false;
                    const fixed = sourceRecord.payload.stationarySurface;
                    if (fixed) {
                        target = fixed.basinTop;
                        descriptor.positionM = cloneData(fixed.rootPositionM);
                        const appliedTop = manager.getComposition?.(source.compositionId)?.getProduct?.(sourceRecord.id);
                        if (Number.isFinite(appliedTop?.CountertopLengthM)) descriptor.config.CountertopLengthM = appliedTop.CountertopLengthM;
                    } else if (sourceRecord.cabinetReferences.length) {
                        const associated = supports.filter((item)=>sourceRecord.cabinetReferences.includes(item.cabinetId));
                        const planned = planSCLineTopSurface({
                            originalBasinTop,
                            originalSupports: originalTopSupports,
                            prospectiveStandardSupports: associated,
                            tolerances: coverSettings?.tolerances ?? surfaceTolerances
                        });
                        if (planned.status !== 'ready') return {
                            status: planned.status,
                            diagnostics: planned.diagnostics
                        };
                        target = planned.basinTop;
                        changed = planned.changed;
                        if (changed) {
                            if (!topTemplate?.clone) return {
                                status: 'unsupported',
                                reasons: [
                                    {
                                        code: 'TOP_TEMPLATE_UNAVAILABLE'
                                    }
                                ]
                            };
                            descriptor.config.CountertopLengthM = planned.lengthM;
                            descriptor.positionM.x += (target.xMinM + target.xMaxM - (originalBasinTop.xMinM + originalBasinTop.xMaxM)) / 2;
                        }
                    }
                    const originalTop = app.root.findByName?.(sourceRecord.id) ?? topTemplate;
                    let topThickness;
                    try {
                        const mesh = findTopSolid(originalTop), measured = measureTopSolid({
                            root: originalTop,
                            meshEntity: mesh
                        });
                        topThickness = measured.yMaxM - measured.yMinM;
                    } catch  {
                        topThickness = null;
                    }
                    if (!Number.isFinite(topThickness) || topThickness <= 0) return {
                        status: 'pending'
                    };
                    const topBox = {
                        min: {
                            x: target.xMinM,
                            y: target.yBottomM,
                            z: target.zMinM
                        },
                        max: {
                            x: target.xMaxM,
                            y: target.yBottomM + topThickness,
                            z: target.zMaxM
                        }
                    };
                    topVolume = topBox;
                    if (boxes.some(({ box })=>engineeringBoxesOverlap(box, topBox))) return {
                        status: 'invalid',
                        reasons: [
                            {
                                code: 'TOP_CABINET_OVERLAP'
                            }
                        ]
                    };
                    primary = [
                        descriptor
                    ];
                    basinTops = [
                        target
                    ];
                    if (allocate) topPlans.set(canonicalKey(document), {
                        basinTop: target,
                        changed
                    });
                }
                const exposed = exposeSCLineSupports({
                    supports,
                    cabinetBoxes: boxes.map(({ id, box })=>({
                            id,
                            ...box
                        })),
                    tolerances: coverSettings?.tolerances ?? surfaceTolerances
                });
                if (exposed.status !== 'ready') return exposed;
                const settings = coverSettings;
                const plan = planSCLineCoverSurfaces({
                    compositionId: source.compositionId,
                    revision: manager.getComposition?.(source.compositionId)?.getCabinetDocument?.()?.revision ?? 0,
                    supports: exposed.supports,
                    basinTops,
                    settings,
                    previous: livePreviousCovers()
                });
                if (plan.status !== 'ready') return {
                    ...plan,
                    diagnostics: plan.diagnostics?.map((item)=>{
                        if (item.code !== 'partial-depth-overlap') return item;
                        const support = supports.find((value)=>value.supportId === item.details?.supportId);
                        const basin = basinTops.find((value)=>value.productId === item.details?.productId);
                        return {
                            ...item,
                            details: {
                                ...item.details,
                                supportZ: support && {
                                    minM: support.zMinM,
                                    maxM: support.zMaxM
                                },
                                basinZ: basin && {
                                    minM: basin.zMinM,
                                    maxM: basin.zMaxM
                                },
                                numericalM: settings.tolerances?.numericalM
                            }
                        };
                    })
                };
                const reservedIds = new Set([
                    ...records.map((item)=>item.id),
                    ...document.primarySources.map((item)=>item.id),
                    ...initialRecords.map((item)=>item.id)
                ]);
                const derived = allocate ? materializeSCLineCoverDescriptors({
                    plan,
                    allocateProductId: ()=>{
                        let id;
                        do {
                            id = `Cabinet_Cover-line-engineering-${++nextCoverId}`;
                        }while (reservedIds.has(id) || app.root.findByName?.(id))
                        reservedIds.add(id);
                        return id;
                    }
                }) : [];
                for (const segment of plan.segments){
                    const coverBox = {
                        min: {
                            x: segment.xMinM,
                            y: segment.yBottomM,
                            z: segment.zMinM
                        },
                        max: {
                            x: segment.xMaxM,
                            y: segment.yBottomM + segment.thicknessM,
                            z: segment.zMaxM
                        }
                    };
                    if (boxes.some(({ id, box })=>!segment.cabinetIds.includes(id) && engineeringBoxesOverlap(box, coverBox))) return {
                        status: 'invalid',
                        reasons: [
                            {
                                code: 'COVER_CABINET_OVERLAP'
                            }
                        ]
                    };
                    if (topVolume && engineeringBoxesOverlap(coverBox, topVolume)) return {
                        status: 'invalid',
                        reasons: [
                            {
                                code: 'COVER_TOP_OVERLAP'
                            }
                        ]
                    };
                }
                return {
                    status: 'valid',
                    primary,
                    derived,
                    coverPlan: plan
                };
            };
            const validateProspective = async ({ document, records })=>planSurfaces({
                    document,
                    records
                });
            const previewAssessment = async (document, { candidateRoot = null, candidateId = null } = {})=>{
                const temporary = [];
                try {
                    const records = [];
                    for (const cabinet of document.cabinets){
                        const resolved = profile.catalog.resolveChoice(cabinet);
                        if (resolved.status !== 'valid') return {
                            status: 'unsupported'
                        };
                        let entity = cabinet.id === candidateId ? candidateRoot : app.root.findByName?.(cabinet.id), release = null;
                        if (!entity && candidateRoot && candidateId === null) {
                            entity = candidateRoot;
                            entity.setPosition(cabinet.positionM.x, cabinet.positionM.y, cabinet.positionM.z);
                        }
                        if (!entity) {
                            entity = await productFactory.createProductEntity(resolved.runtime.productType, resolved.runtime.config, {
                                purpose: 'preview',
                                productId: `line-surface-assessment-${++probeId}`
                            });
                            const temporaryRecord = {
                                entity,
                                release
                            };
                            temporary.push(temporaryRecord);
                            temporaryRecord.release = await configure(entity, resolved.runtime.config, {
                                productType: resolved.runtime.productType
                            });
                            entity.setPosition(cabinet.positionM.x, cabinet.positionM.y, cabinet.positionM.z);
                        }
                        records.push({
                            id: cabinet.id,
                            entity,
                            config: resolved.runtime.config,
                            positionM: cloneData(cabinet.positionM)
                        });
                    }
                    return planSurfaces({
                        document,
                        records,
                        allocate: false
                    });
                } finally{
                    for (const item of temporary.reverse()){
                        try {
                            await item.release?.();
                        } finally{
                            item.entity.destroy();
                        }
                    }
                }
            };
            const enumerate = placement.enumerate;
            placement.enumerate = async (request, context)=>{
                const options = await enumerate(request, context);
                if (options.some((item)=>item.availability === 'available')) {
                    const resolved = profile.catalog.resolveChoice(request);
                    let entity, release;
                    try {
                        entity = await productFactory.createProductEntity(resolved.runtime.productType, resolved.runtime.config, {
                            purpose: 'preview',
                            productId: `line-surface-options-${++probeId}`
                        });
                        release = await configure(entity, resolved.runtime.config, {
                            productType: resolved.runtime.productType
                        });
                        for (const option of options){
                            if (option.availability !== 'available') continue;
                            const next = placement.buildStandardDocument({
                                request,
                                option
                            }, context.model);
                            const checked = await previewAssessment(next.document, {
                                candidateRoot: entity
                            });
                            if (checked.status !== 'valid') {
                                option.availability = checked.status === 'invalid' ? 'invalid' : 'unsupported';
                                option.reasons = checked.reasons ?? checked.diagnostics?.map((item)=>({
                                        code: item.code
                                    })) ?? [
                                    {
                                        code: 'SURFACE_GEOMETRY_PENDING'
                                    }
                                ];
                            }
                        }
                    } finally{
                        try {
                            await release?.();
                        } finally{
                            entity?.destroy();
                        }
                    }
                }
                return options;
            };
            const evaluateWithPose = placement.evaluate;
            placement.evaluate = async (candidate, context)=>{
                if (context.kind === 'move') assertMoveTopCurrent(context.handle);
                const result = await evaluateWithPose(candidate, context);
                if (result.status !== 'valid') return result;
                const moving = context.kind === 'move';
                const next = moving ? placement.buildMoveDocument({
                    ...candidate,
                    effectivePlacement: result.effectivePlacement
                }, context.model) : placement.buildDraftDocument({
                    ...candidate,
                    effectivePlacement: result.effectivePlacement
                }, context.model);
                const checked = await previewAssessment(next.document, {
                    candidateRoot: previewAdapter.getPickTarget(context.handle),
                    candidateId: moving ? candidate.productId : null
                });
                return checked.status === 'valid' ? result : {
                    ...result,
                    status: checked.status,
                    reasons: checked.reasons ?? checked.diagnostics?.map((item)=>({
                            code: item.code
                        })) ?? [
                        {
                            code: 'SURFACE_GEOMETRY_PENDING'
                        }
                    ]
                };
            };
            const spatialProfile = createSCLineSpatialProfile();
            const readBodies = (draft)=>{
                readGeometryRevision();
                const document = manager.getComposition?.(source.compositionId)?.getCabinetDocument?.()?.document ?? profile.initialDocument;
                return document.cabinets.filter((cabinet)=>cabinet.id !== draft?.candidate?.productId).map((cabinet)=>{
                    const local = getBounds(cabinet);
                    if (!local) throw fail('GEOMETRY_PENDING');
                    const world = translateEngineeringBox(local, cabinet.positionM);
                    return {
                        id: cabinet.id,
                        tags: [
                            'cabinet'
                        ],
                        box: {
                            minM: {
                                ...world.min
                            },
                            maxM: {
                                ...world.max
                            }
                        }
                    };
                });
            };
            const resolveExisting = (id, model)=>{
                const cabinet = model.document.cabinets.find((item)=>item.id === id);
                if (!cabinet || !app.root.findByName?.(id)) return null;
                const resolved = profile.catalog.resolveChoice(cabinet);
                if (resolved.status !== 'valid') return null;
                return {
                    id,
                    definitionId: cabinet.definitionId,
                    selection: cloneData(cabinet.selection),
                    placement: {
                        kind: 'free',
                        frameId: cabinet.frameId,
                        positionM: cloneData(cabinet.positionM)
                    },
                    runtime: cloneData(resolved.runtime)
                };
            };
            const configuration = {
                ...profile,
                readGeometryRevision,
                resolveExisting,
                move: {
                    allowStagedPose: (id, positionM)=>{
                        stagedPose = {
                            id,
                            positionM: cloneData(positionM)
                        };
                    },
                    clearStagedPose: ()=>{
                        stagedPose = null;
                    },
                    assertCurrent: (context)=>assertMoveTopCurrent(context?.handle ?? context)
                },
                input: physicalInputReady ? {
                    readFrame: (frameId)=>{
                        const document = manager.getComposition?.(source.compositionId)?.getCabinetDocument?.()?.document ?? profile.initialDocument;
                        return cloneData(document.frames.find((item)=>item.id === (frameId ?? 'world')) ?? null);
                    },
                    readSpatialProfile: (_draft, documentFrame)=>{
                        if (canonicalKey(documentFrame) !== canonicalKey(frame)) throw fail('FRAME_UNSUPPORTED');
                        return spatialProfile;
                    },
                    readBodies
                } : null,
                compatibility: {
                    ...profile.compatibility,
                    buildPresetDocument: (items, globalConfig, current)=>profile.compatibility.buildPresetDocument(items, globalConfig, current, measureChoice)
                },
                verifyReadiness: async ()=>{
                    const template = app.assets?.find?.('ULH_Cabinet', 'template');
                    if (!template || !app.graphicsDevice) return {
                        status: 'pending'
                    };
                    const legacy = await handoff.verifyReadiness();
                    if (legacy?.status !== 'ready') return legacy;
                    await measureChoice({
                        definitionId: 'TEST-SC',
                        selection: {
                            widthCm: 60
                        }
                    });
                    await measureChoice({
                        definitionId: 'TEST-SC',
                        selection: {
                            widthCm: 80
                        }
                    });
                    if (readGeometryRevision() !== preparedRevision) throw fail('STALE_DEPENDENCIES');
                    return {
                        status: 'ready'
                    };
                },
                quiesceLegacy: async (args)=>{
                    if (readGeometryRevision() !== preparedRevision) throw fail('STALE_DEPENDENCIES');
                    const lease = await handoff.quiesceLegacy(args);
                    if (readGeometryRevision() !== preparedRevision) {
                        await lease?.resume?.();
                        throw fail('STALE_DEPENDENCIES');
                    }
                    return lease;
                },
                preview,
                placement,
                scene: {
                    factory: sceneFactory,
                    configure: configureScene,
                    validateProspective,
                    initialRecords,
                    resolvePrimarySource: (sourceRecord, document)=>({
                            ...profile.resolvePrimarySource(sourceRecord, document),
                            defer: true
                        }),
                    getSelection: ()=>selected,
                    setSelection: (value)=>{
                        selected = value;
                    },
                    whenGeometrySettled: async ({ document, records })=>{
                        for (const record of records){
                            if (record.productType === 'Cabinet_Cover') {
                                try {
                                    const slab = measureTopSolid({
                                        root: record.entity,
                                        meshEntity: findTopSolid(record.entity)
                                    });
                                    const segment = record.config.coverSegment;
                                    const expected = {
                                        xMinM: segment.xMinM,
                                        xMaxM: segment.xMaxM,
                                        yMinM: segment.yBottomM,
                                        yMaxM: segment.yBottomM + segment.thicknessM,
                                        zMinM: segment.zMinM,
                                        zMaxM: segment.zMaxM
                                    };
                                    if (Object.keys(expected).some((key)=>Math.abs(slab[key] - expected[key]) > 1e-5)) return {
                                        status: 'pending',
                                        reasons: [
                                            {
                                                code: 'COVER_GEOMETRY_MISMATCH'
                                            }
                                        ]
                                    };
                                } catch  {
                                    return {
                                        status: 'pending',
                                        reasons: [
                                            {
                                                code: 'COVER_GEOMETRY_PENDING'
                                            }
                                        ]
                                    };
                                }
                            } else if (record.productType === 'Top_Solid') {
                                const measured = measureBasinTop({
                                    productId: record.id,
                                    root: record.entity,
                                    measure: measureSurface
                                });
                                if (measured.status !== 'supported') return {
                                    status: 'pending'
                                };
                                const expected = topPlans.get(canonicalKey(document))?.basinTop ?? document.primarySources.find((item)=>item.id === record.id)?.payload?.stationarySurface?.basinTop ?? originalBasinTop;
                                if (!expected || [
                                    'xMinM',
                                    'xMaxM',
                                    'yBottomM',
                                    'zMinM',
                                    'zMaxM'
                                ].some((key)=>Math.abs(measured.basinTop[key] - expected[key]) > 1e-5)) return {
                                    status: 'pending'
                                };
                            } else if (roots.get(record.id) === record.entity) {
                                if (!measureRoot(record.entity)) return {
                                    status: 'pending'
                                };
                            } else if (!bounds.get(record.entity)) return {
                                status: 'pending'
                            };
                        }
                        return {
                            status: 'ready'
                        };
                    }
                },
                onError: (error)=>console.error('[ULH LINE ENGINEERING]', error)
            };
            let selected = null;
            return {
                configuration,
                release () {
                    if (!releaseJob) {
                        closed = true;
                        releaseJob = (async ()=>{
                            await Promise.allSettled([
                                ...probes
                            ]);
                            const result = await Promise.allSettled([
                                preview?.destroy(),
                                handoff?.dispose?.()
                            ]);
                            fingerprintLocalBounds.clear();
                            previewRoot?.destroy();
                            topTemplate?.destroy();
                            const failed = result.find((r)=>r.status === 'rejected');
                            if (failed) throw failed.reason;
                        })();
                    }
                    return releaseJob;
                }
            };
        } catch (error) {
            closed = true;
            await Promise.allSettled([
                ...probes
            ]);
            const cleanup = await Promise.allSettled([
                preview?.destroy(),
                handoff?.dispose?.()
            ]);
            previewRoot?.destroy();
            topTemplate?.destroy();
            const failed = cleanup.find((r)=>r.status === 'rejected');
            if (failed) throw fail('RECOVERY_REQUIRED');
            throw error;
        }
    };
}

export { createCabinetLineEngineeringProvider };
