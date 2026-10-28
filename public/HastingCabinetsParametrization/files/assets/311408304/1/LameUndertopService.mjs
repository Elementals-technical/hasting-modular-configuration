import { SceneTransformHelper } from "../../../../helpers/scene-transform-helper.mjs";
import { SceneEntityHelper } from "../../../../helpers/scene-entity-helper.mjs";
import { ProductRegistry_V2 } from "../../registry/product-registry-v2.mjs";
import { MaterialService } from "../../../../services/material/material-service.mjs";
import { LAME_UNDERTOP_PROFILE as PROFILE, isLameCabinet, calculateLameUndertopLayout } from './LameUndertopCalcLayout.mjs';
import { RuleMaterialsUndertopLame } from '../../rules/CabinetLame/RuleMaterialsUndertopLame.mjs';
import { resolveSinkMountLocalY } from '../../rules/RuleSinkMountPosition.mjs';

export class LameUndertopService {
    constructor(app, compositionManager) {
        this.app = app;
        this.cm = compositionManager;

        this.records = new Map();
        this.queue = Promise.resolve();

        this.generation = 0;
        this.disposed = false;
    }

    reconcile(compositionId) {
        const generation = this.generation;

        const task = this.queue.then(async () => {
            if (this.disposed || generation !== this.generation) return;

            try {
                await this._reconcile(compositionId, generation);
            } catch (error) {
                if (this._isCurrent(compositionId, generation)) this._positionAnchors(compositionId, false);
                const record = this.records.get(compositionId);

                if (record) {
                    record.valid = false;
                    record.entity.enabled = false;
                }

                throw error;
            }
        });

        // Помилка одного оновлення не блокує наступні.
        this.queue = task.catch(() => {});
        return task;
    }

    async _reconcile(compositionId, generation) {
        if (!this._isCurrent(compositionId, generation)) return;

        // The rule runs for every collection; without Lame cabinets there is nothing to settle
        // and measure, so the frame wait is skipped.
        if (!this._hasLameCabinets(compositionId)) {
            this._positionAnchors(compositionId, false);
            this._skipPlan(compositionId, { status: "empty" });
            return;
        }

        await SceneTransformHelper.waitForFrames(2);

        if (!this._isCurrent(compositionId, generation)) return;

        let plan = this._readPlan(compositionId);
        this._positionAnchors(compositionId, plan.status === "ready");

        if (plan.status !== "ready") {
            this._skipPlan(compositionId, plan);
            return;
        }

        let record = this.records.get(compositionId);

        if (!record) {
            const asset = await this._loadTemplate();

            if (!this._isCurrent(compositionId, generation)) return;

            const entity = asset.resource.instantiate();
            entity.name = `Lame_Undertop_Runtime_${compositionId}`;

            // Template має бути без productController.
            this.app.root.addChild(entity);
            // Скрипти ініціалізуються, але меші не рендеряться до фінального layout.
            this._setRendersEnabled(entity, false);
            entity.enabled = true;

            record = {
                entity,
                valid: false,
                materialRule: new RuleMaterialsUndertopLame(),
                baseY: entity.getPosition().y,
            };

            record.materialRule.initialize({ app: this.app, entity, productId: entity.name });
            this.records.set(compositionId, record);

            // Даємо скриптам інстанса ініціалізуватися.
            await SceneTransformHelper.waitForFrames(2);
        }

        if (!this._isCurrent(compositionId, generation)) return;

        const { entity } = record;

        const mesh = this._findMesh(entity);

        if (!mesh?.script?.smartStretch) {
            throw new Error("Lame_Undertop must contain its SmartStretch mesh");
        }

        // За час завантаження template параметри могли змінитися.
        plan = this._readPlan(compositionId);
        this._positionAnchors(compositionId, plan.status === "ready");

        if (plan.status !== "ready") {
            this._skipPlan(compositionId, plan);
            return;
        }

        await record.materialRule.execute({ currentState: new Map(Object.entries(plan.owner)) });
        if (!this._isCurrent(compositionId, generation)) return;
        plan = this._readPlan(compositionId);
        this._positionAnchors(compositionId, plan.status === "ready");
        if (plan.status !== "ready") {
            this._skipPlan(compositionId, plan);
            return;
        }
        SceneTransformHelper.setStretch(mesh, { x: plan.stretchX });

        // SmartStretch оновлює меш і AABB синхронно: stretch, depth і центрування
        // йдуть в одному кадрі, без проміжного рендера.
        entity.syncHierarchy();

        const bounds = SceneEntityHelper.traverseAabb(mesh);
        if (!Number.isFinite(bounds?.center?.x)) {
            throw new Error("Lame undertop mesh bounds are not ready");
        }
        const position = entity.getPosition();
        // Same X-centering principle as the countertop: align mesh center, not root pivot.
        // Preserve the authored Y/Z with the specified height adjustment.
        entity.setPosition(
            position.x + plan.centerXM - bounds.center.x,
            record.baseY + plan.moveY,
            position.z,
        );

        record.valid = true;
        this._setRendersEnabled(entity, true);
        this._updateVisibility();
    }

    /** Empty or disabled composition removes the undertop; unsupported/not-ready plan only hides it. */
    _skipPlan(compositionId, plan) {
        if (plan.status === "unsupported") {
            console.warn("[LameUndertop]", plan.reason);
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
        for (const render of entity.findComponents?.("render") ?? []) {
            render.enabled = enabled;
        }
    }

    _findMesh(entity) {
        return SceneEntityHelper.collectByNames(entity, [PROFILE.meshName])
            .find(node => node.script?.smartStretch);
    }

    _hasLameCabinets(compositionId) {
        const products = this.cm.getComposition(compositionId)?.getAllProducts() || {};
        return Object.values(products).some(isLameCabinet);
    }

    _readPlan(compositionId) {
        const composition = this.cm.getComposition(compositionId);
        if (!composition) return { status: 'empty' };
        const products = Object.entries(composition.getAllProducts());
        const cabinets = products.filter(([,config]) => isLameCabinet(config));
        const hasSidePanels = products.some(([id,config]) =>
            String(config.productType || id).includes('SidePanel') &&
            config.SidePanelType !== 'None' && this.app.root.findByName(id)?.enabled !== false);
        let plan = calculateLameUndertopLayout(cabinets.map(([,config]) => config), hasSidePanels);
        if (plan.status !== 'ready') return plan;
        if (products.some(([,config]) => config.category === 'cabinets' && !isLameCabinet(config)))
            return { status: 'unsupported', reason: 'mixed-collections' };
        let minX = Infinity, maxX = -Infinity;
        for (const [id] of cabinets) {
            const entity = this.app.root.findByName(id);
            entity?.syncHierarchy();
            if (!entity) return { status: "unsupported", reason: "cabinet-entity-not-ready" };
            const wall = SceneEntityHelper.collectByNames(entity, ['Lame_Cabinet_Walls'])[0];
            const bounds = wall && SceneEntityHelper.traverseAabb(wall);
            if (!Number.isFinite(bounds?.center?.x) || !Number.isFinite(bounds?.halfExtents?.x))
                return { status: 'unsupported', reason: 'cabinet-bounds-not-ready' };
            minX = Math.min(minX, bounds.center.x - bounds.halfExtents.x);
            maxX = Math.max(maxX, bounds.center.x + bounds.halfExtents.x);
        }
        return { ...plan, centerXM: (minX + maxX) / 2 };
    }

    /** Absolute positions prevent drift and restore the original support planes on disable. */
    _positionAnchors(compositionId, enabled) {
        const products = this.cm.getComposition(compositionId)?.getAllProducts() || {};
        for (const [id,config] of Object.entries(products)) {
            if (!isLameCabinet(config) || ![26,52].includes(Number(config.Height))) continue;
            const root = this.app.root.findByName(id);
            if (!root) continue;
            const offset = enabled ? PROFILE.heightM : 0;
            const metadata = ProductRegistry_V2.instance.getProductConfig(config.productType);
            const sinkY = resolveSinkMountLocalY({ height: config.Height, thickness: config.Thickness ?? 0.5,
                heightLocalY: metadata?.sinkMount?.heightLocalY,
                thicknessOffsets: metadata?.thicknessOffsets?.sink
            }) ?? (-0.04);
            for (const anchor of SceneEntityHelper.collectByNames(root, ['Lame_Countertop_Point','Lame_Sink_Point'])) {
                SceneTransformHelper.setLocalPosition(anchor, { y:
                    (anchor.name === 'Lame_Countertop_Point' ? 0.52 : sinkY) + offset });
            }
        }
    }

    _loadTemplate() {
        const asset = this.app.assets.find(PROFILE.templateName, "template");

        if (!asset) {
            return Promise.reject(new Error(`Template ${PROFILE.templateName} not found`));
        }

        if (asset.resource) return Promise.resolve(asset);

        return new Promise((resolve, reject) => {
            const cleanup = () => {
                asset.off("load", loaded);
                asset.off("error", failed);
            };

            const loaded = () => {
                cleanup();
                resolve(asset);
            };

            const failed = (error) => {
                cleanup();
                reject(error instanceof Error ? error : new Error(String(error)));
            };

            asset.once("load", loaded);
            asset.once("error", failed);
            this.app.assets.load(asset);
        });
    }

    _isCurrent(compositionId, generation) {
        return (
            !this.disposed &&
            generation === this.generation &&
            !!this.cm.getComposition(compositionId) &&
            !this.cm._compositionTeardowns?.has(compositionId)
        );
    }

    _updateVisibility() {
        const activeId = this.cm.getActiveComposition()?.compositionId;

        for (const [id, record] of this.records) {
            record.entity.enabled = record.valid && id === activeId;
        }
    }

    activate(compositionId) {
        this._updateVisibility();

        return compositionId ? this.reconcile(compositionId) : Promise.resolve();
    }

    _removeEntity(compositionId) {
        const record = this.records.get(compositionId);
        this.records.delete(compositionId);
        record?.materialRule?.destroy();
        record?.entity.destroy();
    }

    remove(compositionId) {
        // Скасовуємо незавершене створення/оновлення.
        this.generation++;
        this._removeEntity(compositionId);
    }

    reset() {
        this.generation++;

        for (const id of [...this.records.keys()]) {
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
}
