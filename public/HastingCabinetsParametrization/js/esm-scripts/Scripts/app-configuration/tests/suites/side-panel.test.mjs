import { app, BoundingBox } from '../../../../../playcanvas-stable.min.mjs';
import { TestContext } from '../test-runner.mjs';
import { SceneEntityHelper } from '../../helpers/scene-entity-helper.mjs';
import { ProductRegistry_V2 } from '../../domain/product/registry/product-registry-v2.mjs';

const wait = TestContext.wait;
/**
 * Тест suite для SidePanel функціоналу
 */ function registerSidePanelTests(runner) {
    runner.suite('SidePanel', async (ctx)=>{
        // ====== СТВОРЕННЯ ======
        await ctx.it('SP-1: створення лівої панелі', async (assert)=>{
            await ctx.reset();
            await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 60,
                    Height: 56,
                    Depth: 50.5,
                    CabinetColor: 'Pulpis Chiaro TKH'
                }
            ]);
            await ConfiguratorAPI.setConfigBatch({}, {
                SidePanel: 'UpperG',
                SidePanelSide: 'left'
            });
            await wait(300);
            assert.entityCount('SidePanel_Left', 1);
            assert.entityCount('SidePanel_Right', 0);
            // Панель ліворуч від кабінету
            const cabinet = assert.findEntity('Sink-Base');
            const panel = assert.findEntity('SidePanel_Left');
            assert.isTrue(panel.getPosition().x < cabinet.getPosition().x, 'Panel should be left of cabinet');
        });
        await ctx.it('SP-2: обидві панелі з 1 кабінетом', async (assert)=>{
            await ctx.reset();
            await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 60,
                    Height: 56,
                    Depth: 50.5
                }
            ]);
            await ConfiguratorAPI.setConfigBatch({}, {
                SidePanel: 'UpperG'
            });
            await wait(300);
            assert.entityCount('SidePanel_Left', 1);
            assert.entityCount('SidePanel_Right', 1);
        });
        await ctx.it('SP-3: різні типи на різних сторонах', async (assert)=>{
            await ctx.reset();
            await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 60,
                    Height: 56,
                    Depth: 50.5
                }
            ]);
            await ConfiguratorAPI.setConfigBatch({}, {
                SidePanel: 'UpperG',
                SidePanelSide: 'left'
            });
            await ConfiguratorAPI.setConfigBatch({}, {
                SidePanel: 'CenterG',
                SidePanelSide: 'right'
            });
            await wait(300);
            const leftPanel = assert.findEntity('SidePanel_Left');
            const rightPanel = assert.findEntity('SidePanel_Right');
            const leftConfig = ConfiguratorAPI.getConfig(leftPanel.name);
            const rightConfig = ConfiguratorAPI.getConfig(rightPanel.name);
            assert.equal(leftConfig.SidePanelType, 'UpperG', 'Left type');
            assert.equal(rightConfig.SidePanelType, 'CenterG', 'Right type');
        });
        await ctx.it('SP-4: створення правої панелі', async (assert)=>{
            await ctx.reset();
            await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 60,
                    Height: 56,
                    Depth: 50.5
                }
            ]);
            await ConfiguratorAPI.setConfigBatch({}, {
                SidePanel: 'NoG',
                SidePanelSide: 'right'
            });
            await wait(300);
            assert.entityCount('SidePanel_Left', 0);
            assert.entityCount('SidePanel_Right', 1);
            const cabinet = assert.findEntity('Sink-Base');
            const panel = assert.findEntity('SidePanel_Right');
            assert.isTrue(panel.getPosition().x > cabinet.getPosition().x, 'Panel should be right of cabinet');
        });
        // ====== ЗМІНА ТИПУ ======
        await ctx.it('SP-5: зміна типу (UpperG → DoubleG)', async (assert)=>{
            await ctx.reset();
            await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 60,
                    Height: 56,
                    Depth: 50.5
                }
            ]);
            await ConfiguratorAPI.setConfigBatch({}, {
                SidePanel: 'UpperG',
                SidePanelSide: 'left'
            });
            await wait(300);
            const panelName = assert.findEntity('SidePanel_Left').name;
            let config = ConfiguratorAPI.getConfig(panelName);
            assert.equal(config.SidePanelType, 'UpperG', 'Initial type');
            await ConfiguratorAPI.setConfigBatch({}, {
                SidePanel: 'DoubleG',
                SidePanelSide: 'left'
            });
            await wait(300);
            config = ConfiguratorAPI.getConfig(panelName);
            assert.equal(config.SidePanelType, 'DoubleG', 'Updated type');
        });
        // ====== ВИДАЛЕННЯ ======
        await ctx.it('SP-6: видалення однієї сторони', async (assert)=>{
            await ctx.reset();
            await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 60,
                    Height: 56,
                    Depth: 50.5
                }
            ]);
            await ConfiguratorAPI.setConfigBatch({}, {
                SidePanel: 'UpperG'
            });
            await wait(300);
            assert.entityCount('SidePanel_Left', 1);
            assert.entityCount('SidePanel_Right', 1);
            await ConfiguratorAPI.setConfigBatch({}, {
                SidePanel: 'None',
                SidePanelSide: 'left'
            });
            await wait(300);
            assert.entityCount('SidePanel_Left', 0);
            assert.entityCount('SidePanel_Right', 1);
        });
        await ctx.it('SP-7: видалення обох', async (assert)=>{
            await ctx.reset();
            await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 60,
                    Height: 56,
                    Depth: 50.5
                }
            ]);
            await ConfiguratorAPI.setConfigBatch({}, {
                SidePanel: 'UpperG'
            });
            await wait(300);
            await ConfiguratorAPI.setConfigBatch({}, {
                SidePanel: 'None'
            });
            await wait(300);
            assert.entityCount('SidePanel_Left', 0);
            assert.entityCount('SidePanel_Right', 0);
        });
        // ====== АВТОМАТИЧНЕ УПРАВЛІННЯ ======
        await ctx.it('SP-8: автовидалення при removeAllProduct', async (assert)=>{
            await ctx.reset();
            await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 60,
                    Height: 56,
                    Depth: 50.5
                }
            ]);
            await ConfiguratorAPI.setConfigBatch({}, {
                SidePanel: 'UpperG'
            });
            await wait(300);
            assert.entityCount('SidePanel_Left', 1);
            ConfiguratorAPI.removeAllProduct();
            await wait(300);
            assert.entityCount('SidePanel_Left', 0);
            assert.entityCount('SidePanel_Right', 0);
        });
        await ctx.it('SP-9: persistence — re-add відновлює панелі', async (assert)=>{
            await ctx.reset();
            await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 60,
                    Height: 56,
                    Depth: 50.5
                }
            ]);
            await ConfiguratorAPI.setConfigBatch({}, {
                SidePanel: 'UpperG'
            });
            await wait(200);
            ConfiguratorAPI.removeAllProduct();
            await wait(200);
            assert.entityCount('SidePanel_Left', 0);
            await ConfiguratorAPI.addProduct('Sink-Base', {
                Width: 80,
                Height: 53,
                Depth: 46
            });
            await wait(400);
            assert.entityCount('SidePanel_Left', 1);
            assert.entityCount('SidePanel_Right', 1);
            // Нові розміри від нового кабінету
            const panel = assert.findEntity('SidePanel_Left');
            const config = ConfiguratorAPI.getConfig(panel.name);
            assert.equal(config.Depth, 46, 'Panel Depth should match new cabinet');
        });
        // ====== SYNC З КАБІНЕТОМ ======
        await ctx.it('SP-10: sync Depth при зміні кабінету', async (assert)=>{
            await ctx.reset();
            await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 60,
                    Height: 56,
                    Depth: 50.5
                }
            ]);
            await ConfiguratorAPI.setConfigBatch({}, {
                SidePanel: 'UpperG'
            });
            await wait(300);
            const panelName = assert.findEntity('SidePanel_Left').name;
            let config = ConfiguratorAPI.getConfig(panelName);
            assert.equal(config.Depth, 50.5, 'Initial Depth');
            const cabinetName = assert.findEntity('Sink-Base').name;
            await ConfiguratorAPI.setConfig(cabinetName, {
                Depth: 46
            });
            await wait(400);
            config = ConfiguratorAPI.getConfig(panelName);
            assert.equal(config.Depth, 46, 'Depth should sync with cabinet');
        });
        // ====== LEGACY API ======
        await ctx.it('SP-11: legacy API з cabinetId (2 кабінети)', async (assert)=>{
            await ctx.reset();
            await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 60,
                    Height: 56,
                    Depth: 50.5
                },
                {
                    name: 'Sink-Cabinet',
                    Width: 60,
                    Height: 56,
                    Depth: 50.5
                }
            ]);
            await wait(200);
            const { leftCabinetId, rightCabinetId } = ConfiguratorAPI.getEdgeCabinets();
            await ConfiguratorAPI.setConfigBatch({
                cabinetId: leftCabinetId
            }, {
                SidePanel: 'UpperG'
            });
            await wait(300);
            assert.entityCount('SidePanel_Left', 1);
        });
        await ctx.it('SP-12: legacy API з 1 кабінетом (fallback both)', async (assert)=>{
            await ctx.reset();
            await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 60,
                    Height: 56,
                    Depth: 50.5
                }
            ]);
            const { leftCabinetId } = ConfiguratorAPI.getEdgeCabinets();
            await ConfiguratorAPI.setConfigBatch({
                cabinetId: leftCabinetId
            }, {
                SidePanel: 'UpperG'
            });
            await wait(300);
            // leftCabinetId === rightCabinetId → fallback 'both'
            assert.entityCount('SidePanel_Left', 1);
            assert.entityCount('SidePanel_Right', 1);
        });
        // ====== MULTI-CABINET ======
        await ctx.it('SP-13: панелі з 3 кабінетами', async (assert)=>{
            await ctx.reset();
            await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 60,
                    Height: 56,
                    Depth: 50.5
                },
                {
                    name: 'Sink-Cabinet',
                    Width: 25,
                    Height: 56,
                    Depth: 50.5
                },
                {
                    name: 'Sink-Base',
                    Width: 60,
                    Height: 56,
                    Depth: 50.5
                }
            ]);
            await ConfiguratorAPI.setConfigBatch({}, {
                SidePanel: 'UpperG'
            });
            await wait(400);
            assert.entityCount('SidePanel_Left', 1);
            assert.entityCount('SidePanel_Right', 1);
            // Ліва панель лівіше лівого кабінету
            const leftPanel = assert.findEntity('SidePanel_Left');
            const cabinets = app.root.find((e)=>e.name.includes('Sink-Base') || e.name.includes('Sink-Cabinet')).filter((e)=>e.parent === app.root);
            const minCabinetX = Math.min(...cabinets.map((c)=>c.getPosition().x));
            assert.lessThan(leftPanel.getPosition().x, minCabinetX, 'Left panel should be left of all cabinets');
        });
        await ctx.it('SP-14: ліва 50D панель не виходить за depth AABB тумб', async (assert)=>{
            await ctx.reset();
            await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    CabinetColor: 'Pulpis Chiaro TKH',
                    CountertopColor: 'Cacao Orinoco FF MT',
                    Handle: 'handle_urban_topcut',
                    Width: 70,
                    Depth: 50.5,
                    Height: 56,
                    Drawers: '2D',
                    sinkType: 'Top_Tekorlux_Rectangular'
                },
                {
                    name: 'Sink-Cabinet',
                    CabinetColor: 'Pulpis Chiaro TKH',
                    CountertopColor: 'Cacao Orinoco FF MT',
                    Handle: 'handle_urban_topcut',
                    Width: 35,
                    Depth: 50.5,
                    Height: 56,
                    Drawers: '2D'
                }
            ]);
            await ConfiguratorAPI.setConfigBatch({}, {
                SidePanel: 'UpperG',
                SidePanelSide: 'left'
            });
            await wait(400);
            const cm = app.compositionManager;
            const cabinets = cm.getProductEntitiesByCategory('cabinets').filter((e)=>e.enabled);
            const panel = assert.findEntity('SidePanel_Left');
            const cabinetsAabb = aggregateCabinetAabb(cabinets, {
                ignoreConfiguredNodes: false
            });
            const panelAabb = SceneEntityHelper.traverseAabb(panel);
            assert.notNull(cabinetsAabb, 'Cabinets AABB');
            assert.notNull(panelAabb, 'Panel AABB');
            assertDepthInsideCabinets(panel.name, panelAabb, cabinetsAabb);
            assertLeftInlaysShiftBack(panel);
        });
    });
}
function aggregateCabinetAabb(cabinets, options = {}) {
    const { ignoreConfiguredNodes = true } = options;
    const total = new BoundingBox();
    let initialized = false;
    cabinets.forEach((cabinet)=>{
        cabinet.syncHierarchy();
        const ignoreNodes = ignoreConfiguredNodes ? ProductRegistry_V2.instance.getAabbIgnoreNodesByEntity(cabinet.name) : [];
        const aabb = SceneEntityHelper.traverseAabb(cabinet, ignoreNodes);
        if (!aabb) return;
        if (!initialized) {
            total.copy(aabb);
            initialized = true;
        } else {
            total.add(aabb);
        }
    });
    return initialized ? total : null;
}
function assertDepthInsideCabinets(panelName, panelAabb, cabinetsAabb, tolerance = 0.002) {
    const cabinetMinZ = cabinetsAabb.center.z - cabinetsAabb.halfExtents.z;
    const cabinetMaxZ = cabinetsAabb.center.z + cabinetsAabb.halfExtents.z;
    const panelMinZ = panelAabb.center.z - panelAabb.halfExtents.z;
    const panelMaxZ = panelAabb.center.z + panelAabb.halfExtents.z;
    if (panelMinZ < cabinetMinZ - tolerance || panelMaxZ > cabinetMaxZ + tolerance) {
        throw new Error(`${panelName} depth AABB outside cabinets: ` + `panel=[${panelMinZ.toFixed(4)}, ${panelMaxZ.toFixed(4)}], ` + `cabinets=[${cabinetMinZ.toFixed(4)}, ${cabinetMaxZ.toFixed(4)}]`);
    }
}
function assertLeftInlaysShiftBack(panel, tolerance = 0.001) {
    const inlays = SceneEntityHelper.collectByPredicate(panel, (entity)=>entity.enabled && entity.name.includes('_Inlay'));
    let checked = 0;
    inlays.forEach((inlay)=>{
        const inlayAabb = SceneEntityHelper.traverseAabb(inlay);
        if (!inlayAabb) return;
        checked++;
        const localZ = inlay.getLocalPosition().z;
        if (localZ <= tolerance) {
            throw new Error(`${inlay.name} should use mirrored local +Z offset on left side panel, got ${localZ.toFixed(4)}`);
        }
    });
    if (checked === 0) {
        throw new Error(`${panel.name} has no active inlay AABB to validate`);
    }
}

export { registerSidePanelTests };
