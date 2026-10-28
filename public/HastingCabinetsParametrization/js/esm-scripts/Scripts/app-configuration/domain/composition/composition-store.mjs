import { isCabinetCoverProduct } from '../countertop/countertop-role.mjs';

const clone = (value)=>value === undefined ? undefined : structuredClone(value);
const guards = new WeakMap();
const cabinetDocuments = new WeakMap();
const guardedValue = (store, value)=>guards.has(store) ? clone(typeof value?.getAll === 'function' ? value.getAll() : value) : value;
/**
 * Store для однієї композиції продуктів
 * 
 * ⚠️ ЩО ТАКЕ "КОМПОЗИЦІЯ" (COMPOSITION):
 * Композиція = технічна група продуктів з СПІЛЬНОЮ ЛОГІКОЮ в рамках 1 конфігурації
 * 
 * ТЕРМІНОЛОГІЯ:
 * - Колекція (Collection) = набір продуктів клієнта (каталог, 1 стиль)
 * - Композиція (Composition) = products розміщені на сцені зі спільною логікою
 * 
 * Приклади композицій:
 * 1. Composition "kitchen-wall-1" = всі шафи на одній стіні + їх фартух + підсвітка
 * 2. Composition "kitchen-island" = острівні тумби + окрема стільниця
 * 3. Composition "bathroom" = умивальник + шафи для ванної + дзеркало
 * 
 * Якщо всі продукти працюють за однією логікою → 1 композиція достатньо
 * Якщо потрібна інша логіка (інший острів, інша кімната) → окрема композиція
 */ class CompositionStore {
    // ====== ПРОДУКТИ ======
    setMutationGuard(guard) {
        if (guards.has(this) && guards.get(this) === guard) return;
        if (guards.has(this) || guard?.compositionId !== this.compositionId || typeof guard.assertWrite !== 'function' || typeof guard.assertCanSave !== 'function') {
            throw Object.assign(new Error('Invalid composition write guard'), {
                code: 'INVALID_WRITE_GUARD'
            });
        }
        // Opt in while constructing a NEW isolated store. Existing live sources must be
        // migrated/restored transactionally, not switched while legacy work is in flight.
        if (this._products.size || this._sceneEntities.size || Object.keys(this._orderProductIds).length || Object.keys(this._features).length) {
            throw Object.assign(new Error('ULH activation requires an empty staged store'), {
                code: 'ULH_ACTIVATION_REQUIRES_STAGING'
            });
        }
        guards.set(this, guard);
    }
    hasMutationGuard() {
        return guards.has(this);
    }
    assertMutable(context) {
        guards.get(this)?.assertWrite(context);
    }
    getCabinetDocument() {
        return clone(cabinetDocuments.get(this) ?? null);
    }
    setCabinetDocument(document, revision, context) {
        this.assertMutable(context);
        if (!guards.has(this) || document?.id !== this.compositionId || !Number.isSafeInteger(revision) || revision < 0) {
            throw Object.assign(new Error('Invalid guarded source document'), {
                code: 'INVALID_SOURCE_DOCUMENT'
            });
        }
        cabinetDocuments.set(this, clone({
            document,
            revision
        }));
        this._touch();
    }
    addProduct(productId, snapshot, context) {
        this.assertMutable(context);
        this._products.set(productId, guardedValue(this, snapshot));
        this._touch();
    }
    removeProduct(productId, context) {
        this.assertMutable(context);
        const deleted = this._products.delete(productId);
        delete this._orderProductIds[productId];
        this._touch();
        return deleted;
    }
    getProduct(productId) {
        return guardedValue(this, this._products.get(productId));
    }
    getAllProducts() {
        return Object.fromEntries([
            ...this._products
        ].map(([key, value])=>[
                key,
                guardedValue(this, value)
            ]));
    }
    hasProduct(productId) {
        return this._products.has(productId);
    }
    getProductCount() {
        return this._products.size;
    }
    // ====== SCENE ENTITIES ======
    addSceneEntity(entityId, entityData, context) {
        this.assertMutable(context);
        this._sceneEntities.set(entityId, guardedValue(this, entityData));
        this._touch();
    }
    removeSceneEntity(entityId, context) {
        this.assertMutable(context);
        const deleted = this._sceneEntities.delete(entityId);
        this._touch();
        return deleted;
    }
    getSceneEntity(entityId) {
        return guardedValue(this, this._sceneEntities.get(entityId));
    }
    getAllSceneEntities() {
        return guardedValue(this, Object.fromEntries(this._sceneEntities));
    }
    // ====== ПОРЯДОК ======
    setOrderProductIds(orderMap, context) {
        this.assertMutable(context);
        this._orderProductIds = guardedValue(this, orderMap);
        this._touch();
    }
    setOrderProductId(productId, index, context) {
        this.assertMutable(context);
        this._orderProductIds[productId] = index;
        this._touch();
    }
    getOrderProductIds() {
        return guardedValue(this, this._orderProductIds);
    }
    getOrderProductId(productId) {
        return this._orderProductIds[productId];
    }
    setCabinetCoverSettings(settings, context) {
        this.assertMutable(context);
        if (settings === null || settings === undefined) delete this._features.cabinetCover;
        else this._features.cabinetCover = clone(settings);
        this._touch();
    }
    getCabinetCoverSettings() {
        return this._features.cabinetCover === undefined ? null : clone(this._features.cabinetCover);
    }
    /** Modular cabinet rows (domain/cabinet-placement/adapters/cabinet-rows-layout.mjs). Plain JSON
     * persisted in features next to the positions; null = never laid out (derived on first use). */ setCabinetRows(rows, context) {
        this.assertMutable(context);
        if (rows === null || rows === undefined) delete this._features.localCabinetRows;
        else this._features.localCabinetRows = clone(rows);
        this._touch();
    }
    getCabinetRows() {
        return this._features.localCabinetRows === undefined ? null : clone(this._features.localCabinetRows);
    }
    setSidePanelSelection(selection, context) {
        this.assertMutable(context);
        this._features.sidePanelSelection = clone(selection);
        this._touch();
    }
    getSidePanelSelection() {
        return this._features.sidePanelSelection === undefined ? null : clone(this._features.sidePanelSelection);
    }
    // ====== АГРЕГАЦІЯ ДАНИХ ======
    /**
     * Агрегує дані продуктів (наприклад, сумарна ширина)
     */ aggregateProducts(aggregatorFn) {
        const products = [
            ...this._products.values()
        ].map((value)=>guardedValue(this, value));
        return aggregatorFn(products);
    }
    /**
     * Отримує агреговані метрики композиції
     */ getMetrics() {
        const products = Array.from(this._products.values());
        return {
            totalWidth: products.reduce((sum, p)=>sum + (p.Width || 0), 0),
            maxHeight: Math.max(...products.map((p)=>p.Height || 0), 0),
            maxDepth: Math.max(...products.map((p)=>p.Depth || 0), 0),
            productCount: products.length
        };
    }
    // ====== УТИЛІТИ ======
    _touch() {
        this.meta.lastModified = Date.now();
    }
    /**
     * Повертає стан композиції для збереження/експорту
     */ serialize(context) {
        guards.get(this)?.assertCanSave(context);
        const primaryProducts = [
            ...this._products.entries()
        ].filter(([, snapshot])=>!isCabinetCoverProduct(snapshot));
        const primaryIds = new Set(primaryProducts.map(([productId])=>productId));
        return {
            compositionId: this.compositionId,
            compositionType: this.compositionType,
            products: guardedValue(this, Object.fromEntries(primaryProducts)),
            sceneEntities: guardedValue(this, Object.fromEntries(this._sceneEntities)),
            orderProductIds: Object.fromEntries(Object.entries(this._orderProductIds).filter(([productId])=>primaryIds.has(productId))),
            features: clone(this._features),
            ...cabinetDocuments.has(this) ? {
                cabinetDocument: this.getCabinetDocument()
            } : {},
            meta: {
                ...this.meta
            }
        };
    }
    /**
     * Відновлює стан композиції
     */ static deserialize(data) {
        if (data.cabinetDocument) throw Object.assign(new Error('ULH source requires transactional restore'), {
            code: 'ULH_RESTORE_REQUIRED'
        });
        const composition = new CompositionStore(data.compositionId, data.compositionType);
        Object.entries(data.products || {}).forEach(([id, snapshot])=>{
            if (!isCabinetCoverProduct(snapshot)) composition.addProduct(id, snapshot);
        });
        Object.entries(data.sceneEntities || {}).forEach(([id, entity])=>{
            composition.addSceneEntity(id, entity);
        });
        composition._orderProductIds = Object.fromEntries(Object.entries(data.orderProductIds || {}).filter(([productId])=>composition._products.has(productId)));
        composition._features = data.features && typeof data.features === 'object' && !Array.isArray(data.features) ? clone(data.features) : {};
        composition.meta = {
            ...composition.meta,
            ...data.meta
        };
        return composition;
    }
    /**
     * @param {string} compositionId - Унікальний ID композиції (напр: "kitchen-wall-1", "bathroom")
     * @param {string} compositionType - Тип конфігурації (напр: "kitchen", "bathroom")
     */ constructor(compositionId, compositionType){
        this.compositionId = compositionId;
        this.compositionType = compositionType;
        // Продукти цієї композиції
        // Включає ВСІ products: шафи, стільниці (10 варіацій), умивальники (10 варіацій)
        this._products = new Map(); // Map<productId, snapshot>
        // Scene entities (залежні технічні об'єкти) цієї композиції
        // Включає тільки автоматичні сутності: фартух, підсвітка, труби
        // НЕ включає стільниці/умивальники - вони є products!
        this._sceneEntities = new Map(); // Map<entityId, entityData>
        // Порядок продуктів (для позиціювання)
        this._orderProductIds = {};
        // Serializable feature configuration. Derived cover products are regenerated
        // from primary products after restore and are not persisted as primary state.
        this._features = {};
        // Метадані
        this.meta = {
            createdAt: Date.now(),
            lastModified: Date.now(),
            isActive: true
        };
    }
}

export { CompositionStore };
