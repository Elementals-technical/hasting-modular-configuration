import { LoggerService } from '../../services/logger/logger-service.mjs';
import { sidePanelProfileOf, groupPanelProfileForTags } from './side-panel-profiles.mjs';
import { ProductRegistry_V2 } from '../product/registry/product-registry-v2.mjs';
import { AddonStateMachine } from './addon-state-machine.mjs';
import { ProductFactory } from '../product/factory/product-factory.mjs';
import { SceneTransformHelper } from '../../helpers/scene-transform-helper.mjs';
import { measureGroupSidePanels } from './side-panel-group-measurement.mjs';

const panelEntries = composition => Object.entries(composition?.getAllProducts?.() || {}).filter(([, config]) =>
    config.category === 'addons' && /SidePanel_(Left|Right)$/.test(config.productType || ''));
const panelSide = config => config.side || (config.productType.endsWith('_Left') ? 'left' : 'right');

/**
 * SidePanel Addon — State Machine для бічних панелей.
 *
 * Особливості:
 * - Sync Depth/Height/CabinetColor/GrainDirection з reference кабінетом
 * - calculateCountertopOffset() — зміщення стільниці залежно від наявності панелей
 * - Collection-specific registered products (legacy variants or dedicated ULH / UF products)
 * - Grain overlay на панелях
 * - ULH / UF (group profiles): shared side selection, separate products for each exposed edge
 * - Legacy: one product per side, positioned on the composition AABB
 */
export class SidePanelAddon extends AddonStateMachine {

    /**
     * Константа зміщення стільниці при наявності side panel (в метрах)
     */
    static COUNTERTOP_OFFSET_VALUE = 0.5 / 100;

    constructor(app, compositionManager) {
        super(app, compositionManager, {
            name: 'SidePanel',
            products: ['SidePanel_Left', 'SidePanel_Right']
        });
    }

    /**
     * True when every cabinet of the composition belongs to one group-panel collection (ULH or UF).
     * @example addon.usesGroupPanels(ufComposition) // true
     */
    usesGroupPanels(composition = this.cm.getActiveComposition()) {
        const cabinets = Object.values(composition?.getAllProducts?.() || {}).filter(p => p.category === 'cabinets');
        const cabinetTagLists = cabinets.map(cabinet =>
            ProductRegistry_V2.instance.getProductConfig(cabinet.productType)?.tags || []);
        return groupPanelProfileForTags(cabinetTagLists) !== null;
    }

    _usesGroupLifecycle(composition) {
        return this.usesGroupPanels(composition) || (
            composition?.getSidePanelSelection?.() != null &&
            !Object.values(composition.getAllProducts()).some(p => p.category === 'cabinets')
        );
    }

    getGroupSelection(composition = this.cm.getActiveComposition()) {
        return composition?.getSidePanelSelection?.() || this.getGlobalTypes();
    }

    async setType(type, side = 'both') {
        const composition = this.cm.getActiveComposition();
        if (!this._usesGroupLifecycle(composition)) return super.setType(type, side);
        composition?.assertMutable?.();
        if (!this._validateType(type)) return false;
        const sides = side === 'both' ? ['left', 'right'] : [side];
        if (sides.some(s => !this._sides[s])) return false;
        const selection = { ...this.getGroupSelection(composition) };
        for (const s of sides) { selection[s] = type; this._sides[s].type = type; }
        composition.setSidePanelSelection(selection);
        await this.cm.aggregator.onCompositionStructureChanged(this.cm._activeCompositionId, this.cm.getAllCompositions());
        return true;
    }

    async ensureExists(composition) {
        if (!this._usesGroupLifecycle(composition)) return super.ensureExists(composition);
        composition?.assertMutable?.();
        if (!composition.getSidePanelSelection?.()) composition.setSidePanelSelection(this.getGlobalTypes());
        // The composition rule measures all rows after cabinet geometry and layout have settled.
    }

    setGlobalTypes(types) {
        super.setGlobalTypes(types);
        const composition = this.cm.getActiveComposition?.();
        if (this._usesGroupLifecycle(composition)) {
            composition.setSidePanelSelection({ ...this.getGroupSelection(composition), ...types });
        }
    }

    rehydrate(composition) {
        const entries = panelEntries(composition);
        if (!this._usesGroupLifecycle(composition) && !entries.some(([, p]) => p.SidePanelLayout === 'group-edge')) {
            return super.rehydrate(composition);
        }
        const saved = composition.getSidePanelSelection?.();
        const selection = saved || { left: null, right: null };
        const next = {};
        for (const side of ['left', 'right']) {
            if (selection[side] != null && (typeof selection[side] !== 'string' || !this._validateType(selection[side]))) {
                throw Object.assign(new Error(`Invalid restored side-panel selection: ${side}`),
                    { code: 'ADDON_REHYDRATE_INVALID', addon: this.name, side });
            }
            const owned = entries.filter(([, p]) => panelSide(p) === side);
            if (!saved && owned.length) {
                const types = new Set(owned.map(([, p]) => p.SidePanelRequestedType ?? p.SidePanelType));
                if (types.size !== 1 || typeof [...types][0] !== 'string' || ![...types][0]) {
                    throw Object.assign(new Error(`Conflicting restored side-panel selection: ${side}`),
                        { code: 'ADDON_REHYDRATE_INVALID', addon: this.name, side });
                }
                const type = [...types][0];
                if (!this._validateType(type)) {
                    throw Object.assign(new Error(`Invalid restored side-panel type: ${side}`),
                        { code: 'ADDON_REHYDRATE_INVALID', addon: this.name, side });
                }
                selection[side] = type;
            }
            next[side] = { ...this._sides[side], type: selection[side] ?? null,
                state: owned.length ? AddonStateMachine.STATES.ACTIVE : AddonStateMachine.STATES.IDLE,
                entityName: owned[0]?.[0] ?? null, entityNames: owned.map(([id]) => id) };
        }
        this._sides = next;
        return Object.fromEntries(Object.entries(next).map(([side, state]) => [side, { ...state }]));
    }

    removeAll(composition) {
        if (!this._usesGroupLifecycle(composition) && !panelEntries(composition).some(([, p]) => p.SidePanelLayout === 'group-edge')) {
            return super.removeAll(composition);
        }
        composition?.assertMutable?.();
        for (const [id] of panelEntries(composition)) this._removeGroupPanel(id, composition);
        this._refreshGroupState(composition);
    }

    _removeGroupPanel(id, composition) {
        composition.removeProduct(id);
        this.app.root.findByName(id)?.destroy();
    }

    _refreshGroupState(composition) {
        const selection = this.getGroupSelection(composition), entries = panelEntries(composition);
        for (const side of ['left', 'right']) {
            const ids = entries.filter(([, p]) => panelSide(p) === side).map(([id]) => id);
            Object.assign(this._sides[side], { type: selection[side] ?? null,
                state: ids.length ? AddonStateMachine.STATES.ACTIVE : AddonStateMachine.STATES.IDLE,
                entityName: ids[0] ?? null, entityNames: ids });
        }
    }

    async prepareGroupPlan(shared = {}) {
        if (shared.sidePanelGroupPlan) return shared.sidePanelGroupPlan;
        const composition = shared.composition || this.cm.getActiveComposition();
        await SceneTransformHelper.waitForFrames(2);
        const plan = measureGroupSidePanels({ composition,
            entities: shared.entities?.cabinets || this.cm.getProductEntitiesByCategory('cabinets'),
            registry: ProductRegistry_V2.instance, selection: this.getGroupSelection(composition) });
        shared.sidePanelGroupPlan = plan;
        return plan;
    }

    async materializeGroupPlan(shared, plan) {
        if (shared.sidePanelGroupTargets) return shared.sidePanelGroupTargets;
        const composition = shared.composition || this.cm.getActiveComposition();
        const targets = await this.reconcileGroupPanels(plan, composition);
        shared.sidePanelGroupTargets = targets;
        shared.allProducts = composition.getAllProducts();
        if (shared.entities) shared.entities.addons = this.cm.getProductEntitiesByCategory('addons');
        return targets;
    }

    /** Materialize a complete row plan without recursively entering composition aggregation. */
    async reconcileGroupPanels(plan, composition = this.cm.getActiveComposition()) {
        composition.assertMutable?.();
        if (plan.status !== 'ready') return [];
        if (!composition.getSidePanelSelection?.()) composition.setSidePanelSelection(this.getGlobalTypes());
        const existing = panelEntries(composition), claimed = new Set(), targets = [], created = [];
        try {
            for (const panel of plan.panels) {
                // Legacy SidePanel_Left/Right never matches a group product type, so it is removed below.
                let match = existing.find(([id, p]) => !claimed.has(id) && p.SidePanelEdgeKey === panel.key &&
                    p.productType === panel.config.productType && this.app.root.findByName(id));
                // Migrate old ULH panels onto the physical outer edge, keeping their public product IDs.
                if (!match) {
                    const outer = plan.panels.filter(p => p.side === panel.side).sort((a, b) => panel.side === 'left'
                        ? a.boxM.minM.x - b.boxM.minM.x : b.boxM.maxM.x - a.boxM.maxM.x)[0];
                    if (outer === panel) match = existing.find(([id, p]) => !claimed.has(id) && !p.SidePanelEdgeKey &&
                        p.productType === panel.config.productType && panelSide(p) === panel.side && this.app.root.findByName(id));
                }
                let entity;
                if (match) {
                    claimed.add(match[0]);
                    entity = this.app.root.findByName(match[0]);
                } else {
                    entity = await new ProductFactory({ app: this.app }).createProductEntity(panel.config.productType, panel.config);
                    if (!entity) throw new Error(`Cannot create panel ${panel.key}`);
                    created.push(entity);
                    if (!this._hasRequiredPanelNodes(entity, panel.config.SidePanelProfile)) {
                        throw Object.assign(new Error(`Group side-panel asset is incomplete: ${panel.key}`),
                            { code: 'SIDE_PANEL_ASSET_UNAVAILABLE' });
                    }
                    // Attaching initializes ProductController, as in the existing addon lifecycle.
                    // Products are published only after all new entities have been prepared.
                    this.app.root.addChild(entity);
                    await this.cm._executeProductRules(entity, { ...panel.config, entityName: entity.name });
                }
                targets.push({ panel, entity });
            }
        } catch (error) {
            for (const entity of created) entity.destroy();
            throw error;
        }
        for (const { panel, entity } of targets) {
            const config = { ...composition.getProduct(entity.name), ...panel.config, entityName: entity.name };
            composition.addProduct(entity.name, config);
        }
        for (const [id] of existing) if (!claimed.has(id)) this._removeGroupPanel(id, composition);
        this._refreshGroupState(composition);
        return targets;
    }

    _hasRequiredPanelNodes(entity, profileId) {
        const requiredNodes = sidePanelProfileOf(profileId)?.requiredNodes || [];
        return requiredNodes.every(name => entity.findByName(name));
    }

    _resolveProductType(side, type) {
        const referenceCabinet = this._getReferenceCabinet(side);
        const support = ProductRegistry_V2.instance.getSidePanelSupport(referenceCabinet?.productType);
        return support?.productTypes?.[side] || super._resolveProductType(side, type);
    }

    // ====== OVERRIDE: buildConfig ======

    /**
     * Config для SidePanel entity — sync з reference кабінетом
     */
    buildConfig(side, type, composition) {
        const refCabinet = this._getReferenceCabinet(side);
        const profileConfig = this._buildProfileConfig(refCabinet, type);

        return {
            ...profileConfig,
            Depth: refCabinet?.Depth || 46,
            Height: refCabinet?.Height || 56,
            Handle: refCabinet?.Handle,
            CabinetColor: refCabinet?.CabinetColor,
            GrainDirection: refCabinet?.GrainDirection || 'None',
            HandleGrooveColor: refCabinet?.HandleGrooveColor || null
        };
    }

    // ====== UNIQUE: Countertop offset ======

    /**
     * Розраховує зміщення стільниці залежно від side panels
     * @param {Array} listSidePanel - Масив конфігурацій side panels
     * @returns {number} Зміщення по X в метрах
     */
    calculateCountertopOffset(listSidePanel) {
        const hasLeftPanel = listSidePanel.some(p =>
            p.side === 'left' || String(p.productType || '').endsWith('SidePanel_Left')
        );
        const hasRightPanel = listSidePanel.some(p =>
            p.side === 'right' || String(p.productType || '').endsWith('SidePanel_Right')
        );

        if (hasLeftPanel && !hasRightPanel) {
            return -SidePanelAddon.COUNTERTOP_OFFSET_VALUE;
        } else if (!hasLeftPanel && hasRightPanel) {
            return SidePanelAddon.COUNTERTOP_OFFSET_VALUE;
        }

        return 0;
    }

    // ====== UNIQUE: Sync з кабінетом ======

    /**
     * Синхронізує параметри side panel з шафою
     * @param {string} panelId - ID панелі
     * @param {object} cabinetConfig - Конфігурація шафи
     */
    async syncPanelWithCabinet(panelId, cabinetConfig) {
        const currentConfig = this.cm.getActiveComposition()?.getProduct(panelId) || {};
        const requestedType = currentConfig.SidePanelRequestedType || currentConfig.SidePanelType;
        const updates = {
            ...this._buildProfileConfig(cabinetConfig, requestedType),
            Depth: cabinetConfig.Depth,
            Height: cabinetConfig.Height,
            Handle: cabinetConfig.Handle,
            CabinetColor: cabinetConfig.CabinetColor,
            GrainDirection: cabinetConfig.GrainDirection || 'None',
            HandleGrooveColor: cabinetConfig.HandleGrooveColor || null
        };

        await this.cm.updateProductConfig(panelId, updates);
        LoggerService.log(this, `[SidePanel] Synced ${panelId} with cabinet config`);
    }

    _buildProfileConfig(cabinetConfig, requestedType) {
        const support = ProductRegistry_V2.instance.getSidePanelSupport(cabinetConfig?.productType);
        const profile = sidePanelProfileOf(support?.profile);
        if (!profile) {
            return {
                SidePanelType: requestedType,
                SidePanelRequestedType: requestedType,
                SidePanelProfile: 'legacy'
            };
        }

        return {
            SidePanelType: profile.resolveAppearance({ cabinetConfig, requestedType }),
            SidePanelRequestedType: requestedType,
            SidePanelProfile: profile.id
        };
    }
}
