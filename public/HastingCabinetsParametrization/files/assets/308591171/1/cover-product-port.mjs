/** PlayCanvas boundary for composition-owned Cabinet_Cover products. */
const PRODUCT_TYPE = 'Cabinet_Cover';
const GENERATED_BY = 'cabinet-cover-v1';
let nextPortSequence = 0;

const finite = value => typeof value === 'number' && Number.isFinite(value);
const positive = value => finite(value) && value > 0;

function validateSegment(segment) {
    if (!segment || !positive(segment.xMaxM - segment.xMinM) ||
        !positive(segment.zMaxM - segment.zMinM) || !positive(segment.thicknessM) ||
        !finite(segment.yBottomM) || !finite(segment.xMinM) || !finite(segment.xMaxM) ||
        !finite(segment.zMinM) || !finite(segment.zMaxM) ||
        typeof segment.materialId !== 'string' || !segment.materialId.trim()) {
        throw new Error('Invalid cover geometry or material');
    }
}

function tree(root) {
    const nodes = [];
    const stack = [root];
    while (stack.length) {
        const node = stack.pop();
        if (!node) continue;
        nodes.push(node);
        for (const child of node.children || []) stack.push(child);
    }
    return nodes;
}

function meshInstances(entity) {
    const instances = entity?.render?.meshInstances || entity?.model?.meshInstances;
    return Array.isArray(instances) ? instances : [];
}

export function findTopSolid(root) {
    const matches = tree(root).filter(node => node.name === 'TopSolid' && meshInstances(node).length > 0);
    if (matches.length !== 1) throw new Error('Cabinet_Cover template must contain exactly one real TopSolid mesh; ProductFactory placeholder rejected');
    return matches[0];
}

/** AABB of the actual cloned render instances, in world metres. */
export function measureTopSolid({ root, meshEntity }) {
    root.syncHierarchy?.();
    let xMinM = Infinity, xMaxM = -Infinity, yMinM = Infinity, yMaxM = -Infinity, zMinM = Infinity, zMaxM = -Infinity;
    for (const instance of meshInstances(meshEntity)) {
        const center = instance?.aabb?.center;
        const half = instance?.aabb?.halfExtents;
        if (![center?.x, center?.y, center?.z, half?.x, half?.y, half?.z].every(finite)) {
            throw new Error('Cabinet_Cover TopSolid measurement unavailable');
        }
        xMinM = Math.min(xMinM, center.x - half.x);
        xMaxM = Math.max(xMaxM, center.x + half.x);
        yMinM = Math.min(yMinM, center.y - half.y);
        yMaxM = Math.max(yMaxM, center.y + half.y);
        zMinM = Math.min(zMinM, center.z - half.z);
        zMaxM = Math.max(zMaxM, center.z + half.z);
    }
    if (!positive(xMaxM - xMinM) || !positive(yMaxM - yMinM) || !positive(zMaxM - zMinM)) {
        throw new Error('Cabinet_Cover TopSolid has invalid measured geometry');
    }
    return { xMinM, xMaxM, yMinM, yMaxM, zMinM, zMaxM };
}

function axisAligned(meshEntity) {
    const data = meshEntity.getWorldTransform?.().data;
    if (!data || data.length !== 16) throw new Error('Cabinet_Cover TopSolid transform unavailable');
    if ([1, 2, 4, 6, 8, 9].some(index => Math.abs(data[index]) > 1e-6)) {
        throw new Error('Cabinet_Cover TopSolid rotated geometry is unsupported');
    }
}

function nearly(actual, desired) {
    return positive(actual) && Math.abs(actual - desired) <= Math.max(1e-9, desired * 1e-5);
}

/** Scale only the cloned slab entity; no SmartStretch initialization is required. */
export function prepareTopSolidGeometry({ root, meshEntity, segment, measure }) {
    axisAligned(meshEntity);
    const before = measure({ root, meshEntity });
    const current = meshEntity.getLocalScale?.();
    if (![current?.x, current?.y, current?.z].every(positive) || typeof meshEntity.setLocalScale !== 'function') {
        throw new Error('Cabinet_Cover TopSolid scale unavailable');
    }
    const desired = {
        x: segment.xMaxM - segment.xMinM,
        y: segment.thicknessM,
        z: segment.zMaxM - segment.zMinM
    };
    meshEntity.setLocalScale(
        current.x * desired.x / (before.xMaxM - before.xMinM),
        current.y * desired.y / (before.yMaxM - before.yMinM),
        current.z * desired.z / (before.zMaxM - before.zMinM)
    );
    const scaled = measure({ root, meshEntity });
    const position = root.getPosition?.();
    if (![position?.x, position?.y, position?.z].every(finite) || typeof root.setPosition !== 'function') {
        throw new Error('Cabinet_Cover root positioning unavailable');
    }
    root.setPosition(
        position.x + (segment.xMinM + segment.xMaxM - scaled.xMinM - scaled.xMaxM) / 2,
        position.y + segment.yBottomM - scaled.yMinM,
        position.z + (segment.zMinM + segment.zMaxM - scaled.zMinM - scaled.zMaxM) / 2
    );
    const after = measure({ root, meshEntity });
    if (!nearly(after.xMaxM - after.xMinM, desired.x) ||
        !nearly(after.yMaxM - after.yMinM, desired.y) ||
        !nearly(after.zMaxM - after.zMinM, desired.z) ||
        Math.abs(after.yMinM - segment.yBottomM) > Math.max(1e-9, desired.y * 1e-5) ||
        Math.abs(after.xMinM - segment.xMinM) > Math.max(1e-9, desired.x * 1e-5) ||
        Math.abs(after.zMinM - segment.zMinM) > Math.max(1e-9, desired.z * 1e-5)) {
        throw new Error('Cabinet_Cover measured geometry did not reach requested bounds');
    }
}

function snapshotFor(productType, segment) {
    return {
        category: 'countertops', productType, CountertopRole: 'cabinetCover', generatedBy: GENERATED_BY,
        materialId: segment.materialId, thicknessM: segment.thicknessM,
        coverSegment: structuredClone(segment)
    };
}

/**
 * Injected collaborators are optional in the app: ProductFactory, MaterialService and
 * measured TopSolid scaling are the defaults. getComposition(id) must return a
 * CompositionStore with its transactional `_products` Map.
 */
export function createCoverProductPort({
    app, getComposition, productFactory = null, createEntity = null,
    loadMaterial = null, measure = measureTopSolid, prepareGeometry = prepareTopSolidGeometry,
    productType = PRODUCT_TYPE
} = {}) {
    if (!app?.root?.addChild || !app.root.findByName || typeof getComposition !== 'function') {
        throw new Error('Cabinet_Cover port needs an app root and getComposition');
    }
    let factory = productFactory;
    const owned = new WeakSet();
    let published = new Map();
    let counter = 0;
    const namespace = `${globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}-${++nextPortSequence}`;

    const compositionFor = compositionId => {
        const composition = getComposition(compositionId);
        if (!composition || composition.compositionId !== compositionId || !(composition._products instanceof Map)) {
            throw new Error(`Cabinet_Cover composition ${compositionId} is unavailable or lacks transactional product storage`);
        }
        return composition;
    };
    const sceneEntity = id => app.root.findByName(id) ?? null;

    async function makeEntity(input) {
        if (createEntity) return createEntity(input);
        if (!factory) {
            const { ProductFactory } = await import('../../../product/factory/product-factory.mjs');
            factory = new ProductFactory();
            factory.app = app;
        }
        return factory.createProductEntity(productType, {
            CountertopRole: 'cabinetCover', generatedBy: GENERATED_BY,
            materialId: input.segment.materialId, thicknessM: input.segment.thicknessM
        });
    }

    async function materialFor(materialId) {
        if (loadMaterial) return loadMaterial(materialId);
        const { MaterialService } = await import('../../../../services/material/material-service.mjs');
        if (MaterialService._getApp() !== app) MaterialService.init(app);
        return MaterialService.loadMaterial(materialId);
    }

    return {
        leasePublished(entries) {
            if (!Array.isArray(entries) || entries.length !== published.size ||
                entries.some(entry=>published.get(entry.productId)!==entry.handle)) {
                throw new Error('Cabinet_Cover lease does not match published ownership');
            }
            const transferred=published;
            published=new Map();
            let closed=false;
            return Object.freeze({
                resume(){
                    if(closed)return;
                    if(published.size)throw new Error('Cabinet_Cover ownership changed during lease');
                    published=transferred;closed=true;
                },
                dispose(){
                    if(closed)return;
                    if(published.size)throw new Error('Cabinet_Cover ownership changed during lease');
                    for(const handle of transferred.values())owned.delete(handle);
                    closed=true;
                }
            });
        },
        allocateProductId({ compositionId }) {
            const composition = compositionFor(compositionId);
            let id;
            do {
                id = `${productType}-${namespace}-${++counter}`;
            } while (composition._products.has(id) || sceneEntity(id));
            return id;
        },

        async prepare({ compositionId, revision, productId, segment }) {
            const composition = compositionFor(compositionId);
            validateSegment(segment);
            if (typeof productId !== 'string' || !productId ||
                (composition._products.has(productId) && published.get(productId)?.compositionId !== compositionId) ||
                (sceneEntity(productId) && published.get(productId)?.compositionId !== compositionId)) {
                throw new Error(`Cabinet_Cover product ID ${productId} is foreign or occupied`);
            }
            let root = null;
            try {
                root = await makeEntity({ app, productType, productId, compositionId, revision, segment });
                if (!root || root.parent != null || typeof root.destroy !== 'function') {
                    throw new Error('Cabinet_Cover factory must return a detached entity');
                }
                root.enabled = false;
                root.name = productId;
                const meshEntity = findTopSolid(root);
                // Derived slabs have no interactive product controller, stretch, or Boolean lifecycle.
                const slabPath = new Set();
                for (let node = meshEntity; node; node = node.parent) slabPath.add(node);
                for (const node of tree(root)) {
                    if (node.script) node.script.enabled = false;
                    if (!slabPath.has(node)) node.enabled = false;
                }
                await prepareGeometry({ root, meshEntity, segment, measure });
                const material = await materialFor(segment.materialId);
                if (!material) throw new Error(`Cabinet_Cover material ${segment.materialId} unavailable`);
                // The cloned render component still carries the template's material
                // asset reference. PlayCanvas reapplies it when the clone is enabled;
                // remove that binding on this clone before assigning the cover finish.
                if (meshEntity.render) meshEntity.render.materialAssets = [];
                if (meshEntity.model && 'materialAsset' in meshEntity.model) meshEntity.model.materialAsset = null;
                for (const instance of meshInstances(meshEntity)) instance.material = material;
                const handle = {
                    entity: root, productId, compositionId, revision,
                    segment: structuredClone(segment), snapshot: snapshotFor(productType, segment),
                    meshEntity, material,
                    disposed: false
                };
                owned.add(handle);
                return handle;
            } catch (error) {
                if (root && root.parent == null) {
                    try { root.destroy(); } catch (cleanupError) { throw new AggregateError([error, cleanupError], 'Cabinet_Cover prepare and cleanup failed'); }
                }
                throw error;
            }
        },

        publish({ compositionId, previousEntries = [], nextEntries = [] }) {
            const composition = compositionFor(compositionId);
            if (!Array.isArray(previousEntries) || !Array.isArray(nextEntries)) throw new Error('Cabinet_Cover publication entries must be arrays');
            if ([...published.values()].some(handle => handle.compositionId !== compositionId ||
                composition._products.get(handle.productId) !== handle.snapshot ||
                sceneEntity(handle.productId) !== handle.entity || handle.entity.parent !== app.root)) {
                throw new Error('Cabinet_Cover published ownership changed outside the port');
            }
            const previous = new Map(previousEntries.map(entry => [entry.productId, entry.handle]));
            if (previous.size !== previousEntries.length || previous.size !== published.size ||
                [...published].some(([id, handle]) => previous.get(id) !== handle)) {
                throw new Error('Cabinet_Cover publication previous entries differ from owned state');
            }
            const next = new Map();
            for (const entry of nextEntries) {
                const { productId, handle, segment } = entry;
                if (next.has(productId) || !owned.has(handle) || handle.disposed ||
                    handle.productId !== productId || handle.compositionId !== compositionId ||
                    JSON.stringify(handle.segment) !== JSON.stringify(segment)) {
                    throw new Error('Cabinet_Cover publication has invalid or duplicate owned handles');
                }
                if (composition._products.has(productId) && !published.has(productId)) {
                    throw new Error(`Cabinet_Cover cannot replace foreign product ${productId}`);
                }
                const existing = sceneEntity(productId);
                if (existing && existing !== published.get(productId)?.entity) {
                    throw new Error(`Cabinet_Cover cannot replace foreign entity ${productId}`);
                }
                if (!published.has(productId) && (handle.entity.parent != null || handle.entity.enabled)) {
                    throw new Error('Cabinet_Cover prepared entity must be detached and disabled');
                }
                next.set(productId, handle);
            }

            const oldMap = composition._products;
            const oldModified = composition.meta?.lastModified;
            const nextMap = new Map(oldMap);
            for (const id of published.keys()) nextMap.delete(id);
            for (const [id, handle] of next) {
                nextMap.set(id, published.get(id) === handle ? oldMap.get(id) : handle.snapshot);
            }
            const retired = [...published.values()].filter(handle => ![...next.values()].includes(handle));
            const staged = [...next.values()].filter(handle => ![...published.values()].includes(handle));
            const oldStates = retired.map(handle => ({ handle, parent: handle.entity.parent, enabled: handle.entity.enabled }));
            const materialStates = [];
            try {
                for (const handle of staged) app.root.addChild(handle.entity);
                for (const handle of retired) handle.entity.enabled = false;
                for (const handle of staged) handle.entity.enabled = true;
                // Activation can replace mesh instances or restore template finishes.
                // Assign after enabling, while publication is still synchronous.
                for (const handle of next.values()) {
                    const instances = meshInstances(handle.meshEntity);
                    if (!instances.length) throw new Error('Cabinet_Cover TopSolid mesh disappeared during publication');
                    for (const instance of instances) {
                        materialStates.push({ instance, material: instance.material });
                        instance.material = handle.material;
                    }
                }
                composition._products = nextMap;
                for (const handle of retired) handle.entity.parent?.removeChild(handle.entity);
                if (composition.meta) composition.meta.lastModified = Date.now();
                published = next;
            } catch (error) {
                const rollbackErrors = [];
                try { composition._products = oldMap; } catch (failure) { rollbackErrors.push(failure); }
                try { if (composition.meta) composition.meta.lastModified = oldModified; } catch (failure) { rollbackErrors.push(failure); }
                for (const state of materialStates.reverse()) {
                    try { state.instance.material = state.material; } catch (failure) { rollbackErrors.push(failure); }
                }
                for (const handle of staged) {
                    try { handle.entity.parent?.removeChild(handle.entity); handle.entity.enabled = false; }
                    catch (failure) { rollbackErrors.push(failure); }
                }
                for (const state of oldStates) {
                    try {
                        if (state.parent && state.handle.entity.parent !== state.parent) state.parent.addChild(state.handle.entity);
                        state.handle.entity.enabled = state.enabled;
                    } catch (failure) { rollbackErrors.push(failure); }
                }
                if (rollbackErrors.length) throw new AggregateError([error, ...rollbackErrors], 'Cabinet_Cover publication rollback failed');
                throw error;
            }
        },

        dispose(handle) {
            if (!owned.has(handle)) throw new Error('Cabinet_Cover cannot dispose a foreign handle');
            if (handle.disposed) return;
            if ([...published.values()].includes(handle)) throw new Error('Cabinet_Cover cannot dispose a published handle');
            handle.entity.parent?.removeChild(handle.entity);
            handle.entity.destroy();
            handle.disposed = true;
        }
    };
}
