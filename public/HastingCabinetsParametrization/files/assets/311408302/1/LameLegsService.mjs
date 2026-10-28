import { Entity } from 'playcanvas';
import { SceneTransformHelper } from '../../../../helpers/scene-transform-helper.mjs';
import { SceneEntityHelper } from '../../../../helpers/scene-entity-helper.mjs';
import { MaterialService } from '../../../../services/material/material-service.mjs';
import { isLameCabinet } from './LameUndertopCalcLayout.mjs';
import { LAME_LEGS_PROFILE as PROFILE, calculateLameLegsLayout } from './LameLegsCalcLayout.mjs';

// LAME ONLY: composition-owned pair; no cabinet/template/global scene mutations.
export class LameLegsService {
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
        let plan = this._readPlan(compositionId);
        if (plan.status !== 'ready') { this._skipPlan(compositionId, plan); return; }
        let record = this.records.get(compositionId);
        if (!record) {
            const asset = await this._loadTemplate();
            if (!this._isCurrent(compositionId, generation)) return;
            const entity = new Entity();
            entity.name = 'Lame_Legs_Runtime_' + compositionId;
            entity.enabled = false;
            this.app.root.addChild(entity);
            record = { entity, valid: false, legs: {} };
            this.records.set(compositionId, record);
            const left = asset.resource.instantiate();
            left.name = 'Lame_Legs_Left';
            left.enabled = false;
            entity.addChild(left);
            // The right template's authored geometry is the baseline for 60 cm.
            // Place both instances under an identity container without duplicating its meshes.
            const right = asset.resource.instantiate();
            right.name = 'Lame_Legs_Right';
            right.enabled = false;
            entity.addChild(right);
            for (const [side,node] of Object.entries({ left,right })) {
                record.legs[side] = { entity: node, position: node.getLocalPosition().clone(), scale: node.getLocalScale().clone() };
            }
            entity.enabled = true;
            await SceneTransformHelper.waitForFrames(2);
        }
        if (!this._isCurrent(compositionId, generation)) return;
        plan = this._readPlan(compositionId);
        if (plan.status !== 'ready') { this._skipPlan(compositionId, plan); return; }
        // Hide both until both positions, height variants and materials are ready.
        for (const leg of Object.values(record.legs)) leg.entity.enabled = false;
        for (const side of ['left','right']) {
            const leg = record.legs[side];
            const nodes = SceneEntityHelper.collectByNames(leg.entity,
                ['Lame_Leg_Long','Lame_Leg_Long_Cap','Lame_Leg_Short','Lame_Leg_Short_Cap']);
            if (new Set(nodes.map(node => node.name)).size !== 4) throw new Error('Lame_Legs must contain both leg heights and caps');
            const finish = this._materialName(plan[side].config.CabinetColor);
            const cap = this._materialName(plan[side].config.LegCapColor) ?? this._materialName(plan[side].config.HandleColor);
            if (finish) await MaterialService.applyMaterialByName(finish,nodes.filter(node => !node.name.endsWith('_Cap')));
            if (!this._isCurrent(compositionId, generation)) return;
            if (cap) await MaterialService.applyMaterialByName(cap,nodes.filter(node => node.name.endsWith('_Cap')));
            if (!this._isCurrent(compositionId, generation)) return;
        }
        // Loading materials can overlap another config command; always use the latest geometry.
        plan = this._readPlan(compositionId);
        if (plan.status !== 'ready') { this._skipPlan(compositionId, plan); return; }
        for (const side of ['left','right']) {
            const leg = record.legs[side], values = plan[side];
            leg.entity.setLocalScale(values.scaleX * Math.abs(leg.scale.x),leg.scale.y,leg.scale.z);
            leg.entity.setLocalPosition(values.x,leg.position.y,leg.position.z + values.z);
            for (const node of SceneEntityHelper.collectByNames(leg.entity,
                ['Lame_Leg_Long','Lame_Leg_Long_Cap','Lame_Leg_Short','Lame_Leg_Short_Cap'])) {
                node.enabled = node.name.startsWith('Lame_Leg_Long') ? plan.height === 26 : plan.height === 52;
            }
            leg.entity.enabled = true;
            leg.entity.syncHierarchy?.();
            // Table is authoritative: no extra AABB correction or vertical movement.

        }
        record.valid = true;
        this._updateVisibility();
    }

    _materialName(value) {
        const name = String(value ?? '').trim();
        return !name || name === 'None' ? null : name;
    }

    _skipPlan(compositionId, plan) {
        if (plan.status === 'empty') { this._removeEntity(compositionId); return; }
        const record = this.records.get(compositionId);
        if (record) { record.valid = false; record.entity.enabled = false; }
        console.warn('[LameLegs]', plan.reason);
    }

    _readPlan(compositionId) {
        const composition = this.cm.getComposition(compositionId);
        if (!composition) return { status: 'empty' };
        const products = Object.entries(composition.getAllProducts());
        const cabinets = products.filter(([,config]) => isLameCabinet(config));
        // Do not read geometry, load assets or touch entities for other collections/off state.
        if (!cabinets.some(([,config]) => config.ShowLegs === 'Enable' || config.ShowLegs === true)) return { status: 'empty' };
        const panels = {};
        for (const [id,config] of products) {
            const type = String(config.productType || id);
            if (!type.includes('SidePanel') || config.SidePanelType === 'None') continue;
            const node = this.app.root.findByName(id);
            if (!node?.enabled) continue;
            if (config.side === 'left' || type.endsWith('SidePanel_Left')) panels.left = true;
            if (config.side === 'right' || type.endsWith('SidePanel_Right')) panels.right = true;
        }
        const items = products.map(([id,config]) => {
            if (!isLameCabinet(config)) return config;
            const root = this.app.root.findByName(id);
            root?.syncHierarchy();
            const wall = root && SceneEntityHelper.collectByNames(root,['Lame_Cabinet_Walls'])[0];
            const bounds = wall && SceneEntityHelper.traverseAabb(wall);
            return { ...config, minX: bounds ? bounds.center.x - bounds.halfExtents.x : NaN,
                maxX: bounds ? bounds.center.x + bounds.halfExtents.x : NaN };
        });
        return calculateLameLegsLayout(items,panels);
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
