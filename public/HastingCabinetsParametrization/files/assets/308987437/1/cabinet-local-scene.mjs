import { Vec3 } from 'playcanvas';
import { ProductFactory } from '../../domain/product/factory/product-factory.mjs';
import { ProductRegistry_V2 } from '../../domain/product/registry/product-registry-v2.mjs';
import { RuleExecutor } from '../../domain/product/rules/rule-executor.mjs';
import { SnapshotProductAttribute } from '../../services/product/snapshot-product-attribute.mjs';
import { readTemplateGeometry } from '../../domain/cabinet-placement/adapters/template-geometry-metadata.mjs';
import { findModularCollection } from '../../domain/cabinet-placement/modular-collections.mjs';
import { measureDetachedEngineeringRoot } from '../../domain/cabinet-placement/engineering/engineering-measurement.mjs';
import { measureEntityBoundsM } from '../../domain/spatial-manipulation/playcanvas/scene-measure.mjs';
import { findTopSolid, measureTopSolid } from '../../domain/countertop/cover/adapters/cover-product-port.mjs';
import { SmartStretch } from '../../../SmartStretch.mjs';
import { MeshBoolean } from '../../../mesh-boolean/adapters/PlayCanvasMeshBoolean.mjs';

const fail = (code, message = code) => Object.assign(new Error(message), { code });
const clone = value => globalThis.structuredClone
    ? globalThis.structuredClone(value)
    : JSON.parse(JSON.stringify(value));
const finitePoint = point => point && ['x', 'y', 'z'].every(axis => Number.isFinite(point[axis]));
let nextPreviewId = 0;

const managerFor = app => {
    const manager = app?.compositionManager;
    if (!manager?.exportAllCompositions || !manager?.importCompositions) {
        throw fail('ULH_LOCAL_SCENE_NOT_READY');
    }
    return manager;
};

const meshInstances = node => node?.render?.meshInstances ?? node?.model?.meshInstances ?? [];

/** Restore only the authored geometry scripts stripped by ProductFactory's preview path. */
async function preparePreviewGeometry(root, app, uncutTargetNames) {
    const entries = [];
    const visit = node => {
        const metadata = readTemplateGeometry(node);
        // A solid SC template need not author a Boolean script. Its explicit
        // no-cut rule still needs an owned component to confirm the source mesh.
        const uncut = uncutTargetNames.has(node.name);
        if (metadata?.stretch || metadata?.boolean || uncut) {
            entries.push({ node, metadata: { ...metadata, boolean: metadata?.boolean || uncut } });
        }
        for (const child of node.children ?? []) visit(child);
    };
    visit(root);

    const resources = [];
    let disposed = false;
    const dispose = async () => {
        if (disposed) return;
        disposed = true;
        const errors = [];
        for (const resource of [...resources].reverse()) {
            const { node, meshInstance, originalMesh, ownedMesh } = resource;
            try { if (node.script) node.removeComponent('script'); } catch (error) { errors.push(error); }
            try { if (meshInstance && originalMesh) meshInstance.mesh = originalMesh; } catch (error) { errors.push(error); }
            if (ownedMesh && ownedMesh !== originalMesh) {
                try { ownedMesh.destroy(); } catch (error) { errors.push(error); }
            }
        }
        if (errors.length) throw Object.assign(new AggregateError(errors, 'Preview geometry cleanup failed'), {
            code: 'ULH_PREVIEW_RECOVERY_REQUIRED'
        });
    };

    try {
        for (const { node, metadata } of entries) {
            if (node.script) throw fail('ULH_PREVIEW_NOT_ISOLATED');
            const instances = meshInstances(node);
            if (metadata.stretch && (instances.length !== 1 || !instances[0]?.mesh)) {
                throw fail('ULH_PREVIEW_TEMPLATE_UNSUPPORTED');
            }
            const resource = {
                node,
                meshInstance: instances[0] ?? null,
                originalMesh: instances[0]?.mesh ?? null,
                ownedMesh: null
            };
            resources.push(resource);
            node.addComponent('script', { enabled: false });
            if (metadata.stretch) {
                const stretch = node.script.create(SmartStretch, { enabled: false, preloading: true });
                if (!stretch) throw fail('ULH_PREVIEW_STRETCH_UNAVAILABLE');
                stretch.margin = new Vec3(
                    metadata.stretch.margin.x,
                    metadata.stretch.margin.y,
                    metadata.stretch.margin.z
                );
                stretch.stretchAmount = new Vec3(
                    metadata.stretch.stretchAmount.x,
                    metadata.stretch.stretchAmount.y,
                    metadata.stretch.stretchAmount.z
                );
                stretch.initialize();
                if (!stretch._basePositions?.length || resource.meshInstance.mesh === resource.originalMesh) {
                    throw fail('ULH_PREVIEW_GEOMETRY_PENDING');
                }
                resource.ownedMesh = resource.meshInstance.mesh;
            }
            if (metadata.boolean) {
                const meshBoolean = node.script.create(MeshBoolean, { enabled: false, preloading: true });
                if (!meshBoolean) throw fail('ULH_PREVIEW_BOOLEAN_UNAVAILABLE');
                meshBoolean.runOnStart = false;
                meshBoolean.initialize();
            }
        }
        return { dispose };
    } catch (error) {
        try { await dispose(); } catch (cleanupError) {
            throw Object.assign(new AggregateError([error, cleanupError], 'Preview preparation cleanup failed'), {
                code: 'ULH_PREVIEW_RECOVERY_REQUIRED'
            });
        }
        throw error;
    }
}

/** Local PlayCanvas scene port for the exact legacy composition representation. */
export function createCabinetLocalScene({ app } = {}) {
    if (!app?.root?.addChild || !app?.assets || !app?.sceneManager) throw fail('INVALID_APPLICATION');
    const registry = ProductRegistry_V2.instance;
    const factory = new ProductFactory({ app, registry });
    const writerNames = ['addProductByParams', 'presetProducts', 'removeProduct', 'removeAllProducts'];
    if (writerNames.some(name => typeof app.sceneManager[name] !== 'function')) {
        throw fail('ULH_LOCAL_SCENE_NOT_READY');
    }
    const rawWriters = Object.fromEntries(writerNames.map(name => [name, app.sceneManager[name]]));
    // An owned receiver makes nested writer calls (for example preset -> removeAll/add)
    // resolve to the captured originals. The public SceneManager remains guarded throughout.
    const ownedSceneManager = Object.create(app.sceneManager);
    for (const name of writerNames) {
        Object.defineProperty(ownedSceneManager, name, {
            value: (...args) => rawWriters[name].apply(ownedSceneManager, args),
            configurable: false,
            enumerable: false,
            writable: false
        });
    }
    const rawAdd = ownedSceneManager.addProductByParams;
    const rawPreset = ownedSceneManager.presetProducts;
    let activeWriteGuard = null;

    const assertGeometryResult = (kind, result) => {
        if (!['error', 'invalid', 'unsupported', 'cancelled'].includes(result?.status)) return result;
        throw Object.assign(fail(`ULH_${kind}_NOT_READY`, `${kind} geometry did not settle`), {
            result: clone(result)
        });
    };

    async function settle() {
        const manager = managerFor(app);
        await manager.modules?.whenSettled?.();
        if (manager.aggregator?.whenIdle && await manager.aggregator.whenIdle() === false) {
            throw fail('ULH_AGGREGATION_BUSY');
        }
        const top = await manager.countertopCompositionAdapter?.whenSettled?.();
        assertGeometryResult('COUNTERTOP', top);
        const cover = await manager.cabinetCoverCompositionAdapter?.whenSettled?.();
        assertGeometryResult('COVERS', cover);
        return Object.freeze({ top, cover });
    }

    function capture() {
        const exported = managerFor(app).exportAllCompositions();
        const active = exported?.compositions?.[exported.activeCompositionId];
        if (!active) throw fail('ULH_ACTIVE_COMPOSITION_UNAVAILABLE');
        return clone(active);
    }

    async function replace(serialized) {
        if (!serialized || typeof serialized !== 'object' || Array.isArray(serialized)) {
            throw new TypeError('Serialized cabinet composition is required');
        }
        const manager = managerFor(app);
        const result = await manager.importCompositions({
            activeCompositionId: 'cabinets',
            compositions: { cabinets: clone(serialized) }
        }, { replaceCompositionId: 'cabinets' });
        try {
            await settle();
            app.sceneManager.updateButtonsPositions?.();
            app.dimensionSystem?.refresh?.();
        } catch (postCommitError) {
            // The source is already committed; never invite replaying the mutation.
            return { ...result, postCommitError };
        }
        return result;
    }

    /** Captured before guard installation: local-runtime compatibility owns these writes. */
    const add = (productType, config = {}) => rawAdd(productType, null, 'right', config);
    const preset = (items, globalConfig = {}) => rawPreset(items, globalConfig);

    /** Block direct SceneManager writers while a local-runtime draft or commit is active. */
    function guardWrites(assertIdle) {
        if (typeof assertIdle !== 'function') throw new TypeError('assertIdle callback is required');
        if (activeWriteGuard) throw fail('ULH_WRITE_GUARD_ACTIVE');
        const records = writerNames.map(name => {
            const original = app.sceneManager[name];
            const hadOwn = Object.hasOwn(app.sceneManager, name);
            const descriptor = hadOwn ? Object.getOwnPropertyDescriptor(app.sceneManager, name) : null;
            const wrapper = function (...args) {
                assertIdle();
                return original.apply(app.sceneManager, args);
            };
            app.sceneManager[name] = wrapper;
            return { name, wrapper, hadOwn, descriptor };
        });
        let restored = false;
        const restore = () => {
            if (restored) return;
            restored = true;
            for (const { name, wrapper, hadOwn, descriptor } of records) {
                if (app.sceneManager[name] !== wrapper) continue;
                if (hadOwn) Object.defineProperty(app.sceneManager, name, descriptor);
                else delete app.sceneManager[name];
            }
            if (activeWriteGuard === restore) activeWriteGuard = null;
        };
        activeWriteGuard = restore;
        return restore;
    }

    async function makePreview(productType, config = {}, { productId = null } = {}) {
        const productConfig = registry.getProductConfig(productType);
        // A modular cabinet, or the basin top (a tandem top shown on a dragged sink base, countertop-split-preview.mjs).
        const previewable = productConfig && ((productConfig.category === 'cabinets' && findModularCollection(productType)) ||
            productType === 'Top_Solid');
        if (!previewable) {
            throw fail('ULH_UNKNOWN_PRODUCT', `Unregistered modular cabinet: ${productType}`);
        }
        if (!config || typeof config !== 'object' || Array.isArray(config)) {
            throw new TypeError('Preview config must be an object');
        }
        if (productId !== null && (typeof productId !== 'string' || !productId.trim())) {
            throw new TypeError('Preview productId must be a non-empty string');
        }
        // A move preview may describe an existing product. Its scene identity must still be
        // unique so findByName cannot redirect rules or picking to the committed cabinet.
        const id = `ulh-local-preview-${++nextPreviewId}`;

        const finalConfig = { ...registry.getDefaultConfig(productType), ...clone(config) };
        let entity = null;
        let geometry = null;
        let executor = null;
        let disposal = null;
        const sourceEntity = productId ? app.root.findByName(productId) : null;
        const sourceEnabled = sourceEntity?.enabled;
        let sourceHidden = false;
        const dispose = async () => {
            if (disposal) return disposal;
            disposal = (async () => {
                const errors = [];
                try { await executor?.destroy(); } catch (error) { errors.push(error); }
                try { await geometry?.dispose(); } catch (error) { errors.push(error); }
                try { entity?.destroy(); } catch (error) { errors.push(error); }
                if (sourceHidden && !sourceEntity?.destroyed) sourceEntity.enabled = sourceEnabled;
                if (errors.length) throw Object.assign(new AggregateError(errors, 'Preview cleanup failed'), {
                    code: 'ULH_PREVIEW_RECOVERY_REQUIRED'
                });
            })();
            return disposal;
        };

        try {
            entity = await factory.createProductEntity(productType, finalConfig, {
                purpose: 'preview', productId: id, sourceProductId: productId
            });
            if (!entity || entity.parent || entity.enabled !== false) throw fail('ULH_PREVIEW_NOT_ISOLATED');
            const context = Object.freeze({
                app,
                entity,
                productId: id,
                productType,
                productConfig,
                executionMode: 'isolated',
                // Detached preview: Boolean cuts are made by the committed product, not the drag ghost.
                booleanCuts: 'deferred'
            });
            executor = new RuleExecutor(context, { strict: true });
            for (const { rule: Rule, priority } of registry.getRulesForProduct(productType)) {
                const instance = new Rule();
                if (typeof instance.setPriority === 'function') instance.setPriority(priority);
                else instance.priority = priority;
                executor.registerRule(instance);
            }
            const uncutTargetNames = new Set(executor.rules.flatMap(rule =>
                Object.entries(rule.dataRule?.boolean?.values ?? {})
                    .filter(([, values]) => Object.values(values).every(enabled => enabled === false))
                    .map(([name]) => name)
            ));
            geometry = await preparePreviewGeometry(entity, app, uncutTargetNames);
            await executor.executeRules({
                changes: clone(finalConfig),
                currentState: new SnapshotProductAttribute(finalConfig),
                previousState: new SnapshotProductAttribute({})
            });
            measureDetachedEngineeringRoot(entity);
            app.root.addChild(entity);
            entity.enabled = true;
            if (sourceEntity) { sourceEntity.enabled = false; sourceHidden = true; }
            return Object.freeze({ entity, dispose });
        } catch (error) {
            try { await dispose(); } catch (cleanupError) {
                throw Object.assign(new AggregateError([error, cleanupError], 'Preview creation cleanup failed'), {
                    code: 'ULH_PREVIEW_RECOVERY_REQUIRED'
                });
            }
            throw error;
        }
    }

    /** World box `{ minM, maxM }` of one node of a cabinet, as measured (a flat panel mesh has zero thickness and
     * still counts); null when the node has no visible mesh. The drag snap reads the Duplex panel faces from it. */
    function nodeBounds(node) {
        return measureEntityBoundsM(node);
    }

    function bounds(entity) {
        const measured = measureEntityBoundsM(entity);
        if (!measured || !finitePoint(measured.minM) || !finitePoint(measured.maxM) ||
            ['x', 'y', 'z'].some(axis => measured.maxM[axis] <= measured.minM[axis])) {
            throw fail('ULH_PREVIEW_GEOMETRY_PENDING');
        }
        return Object.freeze({ min: Object.freeze(clone(measured.minM)), max: Object.freeze(clone(measured.maxM)) });
    }

    async function defaultCoverSettings() {
        let probe = null;
        try {
            probe = await factory.createProductEntity('Cabinet_Cover', {}, {
                purpose: 'preview', productId: `ulh-local-cover-probe-${++nextPreviewId}`
            });
            const mesh = findTopSolid(probe);
            const measured = measureTopSolid({ root: probe, meshEntity: mesh });
            const thicknessM = measured.yMaxM - measured.yMinM;
            if (!Number.isFinite(thicknessM) || thicknessM <= 0) throw fail('COVER_TEMPLATE_UNAVAILABLE');
            return Object.freeze({
                enabled: true,
                profileId: 'ulh-v1',
                eligibilityMode: 'all',
                thicknessM,
                tolerances: Object.freeze({ contactM: 0.001, adjacencyM: 0.001, numericalM: 1e-6 })
            });
        } catch (error) {
            throw error?.code ? error : Object.assign(fail('COVER_TEMPLATE_UNAVAILABLE'), { cause: error });
        } finally {
            probe?.destroy();
        }
    }

    return Object.freeze({ settle, capture, replace, add, preset, guardWrites,
        makePreview, bounds, nodeBounds, defaultCoverSettings });
}
