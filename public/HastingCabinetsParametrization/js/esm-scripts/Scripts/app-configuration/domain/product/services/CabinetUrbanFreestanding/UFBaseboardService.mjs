import { SceneTransformHelper } from '../../../../helpers/scene-transform-helper.mjs';
import { SceneEntityHelper } from '../../../../helpers/scene-entity-helper.mjs';
import { ProductRegistry_V2 } from '../../registry/product-registry-v2.mjs';
import { MaterialService } from '../../../../services/material/material-service.mjs';
import { UF_BASEBOARD_PROFILE, UF_BASEBOARD_PRODUCT_TYPES } from '../../registry/CabinetUrbanFreestanding/UFConfig.mjs';
import { calculateUFBaseboardLayout } from './UFBaseboardCalcLayout.mjs';

// setActiveComposition re-registers the spatial modules (saved offsets) right after activate();
// those moves land over the next frames, so an activation lets them settle before measuring.
const ACTIVATION_SETTLE_FRAMES = 2;
class UFBaseboardService {
    /**
     * Rebuilds the baseboard for the composition.
     * `settleFrames`: frames to wait before measuring the cabinets; 0 when the caller already
     * applied every cabinet change (the aggregator), ACTIVATION_SETTLE_FRAMES from activate().
     */ reconcile(compositionId, { settleFrames = 0 } = {}) {
        const generation = this.generation;
        const task = this.queue.then(async ()=>{
            if (this.disposed || generation !== this.generation) return;
            try {
                await this._reconcile(compositionId, generation, settleFrames);
            } catch (error) {
                const record = this.records.get(compositionId);
                if (record) {
                    record.valid = false;
                    record.entity.enabled = false;
                }
                throw error;
            }
        });
        // Помилка одного оновлення не блокує наступні.
        this.queue = task.catch(()=>{});
        return task;
    }
    async _reconcile(compositionId, generation, settleFrames) {
        if (!this._isCurrent(compositionId, generation)) return;
        // An aggregator call comes after the rules, the layout and SmartStretch ran synchronously,
        // and _readPlan syncs the hierarchy itself: nothing left to wait for.
        if (settleFrames > 0) {
            await SceneTransformHelper.waitForFrames(settleFrames);
            if (!this._isCurrent(compositionId, generation)) return;
        }
        let plan = this._readPlan(compositionId);
        if (plan.status !== "ready") {
            this._skipPlan(compositionId, plan);
            return;
        }
        let record = this.records.get(compositionId);
        if (!record) {
            const asset = await this._loadTemplate();
            if (!this._isCurrent(compositionId, generation)) return;
            const entity = asset.resource.instantiate();
            entity.name = `UF_Baseboard_Runtime_${compositionId}`;
            // Template має бути без productController.
            this.app.root.addChild(entity);
            // Скрипти ініціалізуються, але меші не рендеряться до фінального layout.
            this._setRendersEnabled(entity, false);
            entity.enabled = true;
            record = {
                entity,
                valid: false,
                materialName: null
            };
            this.records.set(compositionId, record);
        // No frame wait: in a running app PlayCanvas runs the instance's script initialize
        // (SmartStretch) synchronously on addChild/enable.
        }
        if (!this._isCurrent(compositionId, generation)) return;
        const { entity } = record;
        const mesh = entity.findByName(UF_BASEBOARD_PROFILE.meshName);
        const point = entity.findByName(UF_BASEBOARD_PROFILE.depthPointName);
        if (!mesh?.script?.smartStretch || !point) {
            throw new Error("UF_M_Leg must contain SmartStretch mesh and depth point");
        }
        // За час завантаження template параметри могли змінитися.
        plan = this._readPlan(compositionId);
        if (plan.status !== "ready") {
            this._skipPlan(compositionId, plan);
            return;
        }
        const materialName = this._materialName(plan.cabinetColor);
        if (materialName !== record.materialName) {
            if (materialName) {
                await MaterialService.applyMaterialByName(materialName, [
                    mesh
                ]);
            }
            if (!this._isCurrent(compositionId, generation)) return;
            record.materialName = materialName;
        }
        // Матеріал застосовуємо перед геометрією:
        // MaterialService також оновлює пов'язані скрипти.
        SceneTransformHelper.setStretch(mesh, {
            x: plan.stretchX,
            z: plan.stretchZ
        });
        SceneTransformHelper.setLocalPosition(point, {
            z: plan.moveZ
        });
        // SmartStretch оновлює меш і AABB синхронно: stretch, depth і центрування
        // йдуть в одному кадрі, без проміжного рендера.
        entity.syncHierarchy();
        const bounds = SceneEntityHelper.traverseAabb(mesh);
        if (!Number.isFinite(bounds?.center?.x)) {
            throw new Error("UF baseboard mesh bounds are not ready");
        }
        const position = entity.getPosition();
        // Same X-centering principle as the countertop: align mesh center, not root pivot.
        // Preserve the authored Y/Z and the separate depth-point adjustment.
        entity.setPosition(position.x + plan.centerXM - bounds.center.x, position.y, position.z);
        record.valid = true;
        this._setRendersEnabled(entity, true);
        this._updateVisibility();
    }
    /** Empty composition removes the leg; unsupported/not-ready plan only hides it. */ _skipPlan(compositionId, plan) {
        if (plan.status === "unsupported") {
            console.warn("[UFBaseboard]", plan.reason);
        }
        const record = this.records.get(compositionId);
        if (plan.status !== "unsupported" || !record) {
            this._removeEntity(compositionId);
            return;
        }
        record.valid = false;
        this._updateVisibility();
    }
    _setRendersEnabled(entity, enabled) {
        for (const render of entity.findComponents?.("render") ?? []){
            render.enabled = enabled;
        }
    }
    _readPlan(compositionId) {
        const composition = this.cm.getComposition(compositionId);
        if (!composition) return {
            status: "empty"
        };
        const items = [];
        let minX = Infinity;
        let maxX = -Infinity;
        for (const [id, config] of Object.entries(composition.getAllProducts())){
            if (!UF_BASEBOARD_PRODUCT_TYPES.has(config.productType)) {
                continue;
            }
            const entity = this.app.root.findByName(id);
            entity?.syncHierarchy();
            const bounds = SceneEntityHelper.traverseAabb(entity, ProductRegistry_V2.instance.getAabbIgnoreNodesByEntity(id));
            if (!Number.isFinite(bounds?.center?.x) || !Number.isFinite(bounds?.halfExtents?.x)) {
                return {
                    status: "unsupported",
                    reason: `UF cabinet bounds are not ready: ${id}`
                };
            }
            minX = Math.min(minX, bounds.center.x - bounds.halfExtents.x);
            maxX = Math.max(maxX, bounds.center.x + bounds.halfExtents.x);
            items.push({
                id,
                widthM: Number(config.Width) / 100,
                depthCm: Number(config.Depth),
                cabinetColor: config.CabinetColor
            });
        }
        const plan = calculateUFBaseboardLayout(items);
        return plan.status === "ready" ? {
            ...plan,
            centerXM: (minX + maxX) / 2
        } : plan;
    }
    _loadTemplate() {
        const asset = this.app.assets.find(UF_BASEBOARD_PROFILE.templateName, "template");
        if (!asset) {
            return Promise.reject(new Error(`Template ${UF_BASEBOARD_PROFILE.templateName} not found`));
        }
        if (asset.resource) return Promise.resolve(asset);
        return new Promise((resolve, reject)=>{
            const cleanup = ()=>{
                asset.off("load", loaded);
                asset.off("error", failed);
            };
            const loaded = ()=>{
                cleanup();
                resolve(asset);
            };
            const failed = (error)=>{
                cleanup();
                reject(error instanceof Error ? error : new Error(String(error)));
            };
            asset.once("load", loaded);
            asset.once("error", failed);
            this.app.assets.load(asset);
        });
    }
    _materialName(value) {
        const name = String(value ?? "").trim();
        return !name || name === "None" ? null : name;
    }
    _isCurrent(compositionId, generation) {
        return !this.disposed && generation === this.generation && !!this.cm.getComposition(compositionId) && !this.cm._compositionTeardowns?.has(compositionId);
    }
    _updateVisibility() {
        const activeId = this.cm.getActiveComposition()?.compositionId;
        for (const [id, record] of this.records){
            record.entity.enabled = record.valid && id === activeId;
        }
    }
    activate(compositionId) {
        this._updateVisibility();
        return compositionId ? this.reconcile(compositionId, {
            settleFrames: ACTIVATION_SETTLE_FRAMES
        }) : Promise.resolve();
    }
    _removeEntity(compositionId) {
        const record = this.records.get(compositionId);
        this.records.delete(compositionId);
        record?.entity.destroy();
    }
    remove(compositionId) {
        // Скасовуємо незавершене створення/оновлення.
        this.generation++;
        this._removeEntity(compositionId);
    }
    reset() {
        this.generation++;
        for (const id of [
            ...this.records.keys()
        ]){
            this._removeEntity(id);
        }
    }
    getEntity(compositionId) {
        return this.records.get(compositionId)?.entity ?? null;
    }
    whenIdle() {
        return this.queue;
    }
    destroy() {
        this.disposed = true;
        this.reset();
    }
    constructor(app, compositionManager){
        this.app = app;
        this.cm = compositionManager;
        this.records = new Map();
        this.queue = Promise.resolve();
        this.generation = 0;
        this.disposed = false;
    }
}

export { UFBaseboardService };
