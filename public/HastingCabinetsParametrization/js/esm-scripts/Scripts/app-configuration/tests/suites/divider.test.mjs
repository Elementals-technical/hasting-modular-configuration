import { TestContext } from '../test-runner.mjs';
import { DividerPlacementCandidateEngine } from '../../services/drawer-divider/core/DividerPlacementCandidateEngine.mjs';

const wait = TestContext.wait;
const candidateEngine = new DividerPlacementCandidateEngine();
const flattenCandidateSlots = (drawerConfig)=>Object.values(drawerConfig?.zones || {}).flatMap((zone)=>zone.slots || []);
/**
 * Тест suite для Divider функціоналу
 * Покриває: default state, add/remove divider, resize, overlay, store consistency
 */ function registerDividerTests(runner) {
    runner.suite('Divider', async (ctx)=>{
        // ====== DEFAULT STATE ======
        await ctx.it('DIV-1: Sink-Base має TopDrawerDividers з siphon zones', async (assert)=>{
            await ctx.reset();
            const ids = await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 60,
                    Height: 56,
                    Depth: 50.5,
                    sinkType: 'Top_HPLPrisma'
                }
            ]);
            await wait(400);
            const config = ConfiguratorAPI.getConfig(ids[0]);
            assert.notNull(config.TopDrawerDividers, 'TopDrawerDividers should exist');
            assert.notNull(config.TopDrawerDividers.zones, 'zones should exist');
            assert.notNull(config.TopDrawerDividers.zones.siphon_left, 'siphon_left zone should exist');
            assert.notNull(config.TopDrawerDividers.zones.siphon_right, 'siphon_right zone should exist');
        });
        await ctx.it('DIV-2: Sink-Base має BotDrawerDividers з main zone', async (assert)=>{
            await ctx.reset();
            const ids = await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 60,
                    Height: 56,
                    Depth: 50.5
                }
            ]);
            await wait(400);
            const config = ConfiguratorAPI.getConfig(ids[0]);
            assert.notNull(config.BotDrawerDividers, 'BotDrawerDividers should exist');
            assert.notNull(config.BotDrawerDividers.zones, 'zones should exist');
            assert.notNull(config.BotDrawerDividers.zones.main, 'main zone should exist');
        });
        await ctx.it('DIV-3: Sink-Cabinet має TopDrawerDividers з main zone (TopFull)', async (assert)=>{
            await ctx.reset();
            const ids = await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Cabinet',
                    Width: 60,
                    Height: 56,
                    Depth: 50.5
                }
            ]);
            await wait(400);
            const config = ConfiguratorAPI.getConfig(ids[0]);
            assert.notNull(config.TopDrawerDividers, 'TopDrawerDividers should exist');
            assert.notNull(config.TopDrawerDividers.zones.main, 'main zone should exist (TopFull)');
            assert.equal(config.topDrawerType, 'TopFull', 'topDrawerType should be TopFull');
        });
        await ctx.it('DIV-4: всі слоти початково ghost', async (assert)=>{
            await ctx.reset();
            const ids = await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 60,
                    Height: 56,
                    Depth: 50.5
                }
            ]);
            await wait(400);
            const config = ConfiguratorAPI.getConfig(ids[0]);
            const mainSlots = config.BotDrawerDividers.zones.main.slots;
            assert.greaterThan(mainSlots.length, 0, 'Should have slots');
            const occupiedSlots = mainSlots.filter((s)=>s.other?.type === 'occupied');
            assert.equal(occupiedSlots.length, 0, 'No occupied slots initially');
            const ghostSlots = mainSlots.filter((s)=>s.other?.type === 'ghost');
            assert.greaterThan(ghostSlots.length, 0, 'Should have ghost slots');
        });
        await ctx.it('DIV-5: кількість ghost слотів залежить від Width', async (assert)=>{
            await ctx.reset();
            const ids60 = await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 60,
                    Height: 56,
                    Depth: 50.5
                }
            ]);
            await wait(400);
            const config60 = ConfiguratorAPI.getConfig(ids60[0]);
            const slots60 = config60.BotDrawerDividers.zones.main.slots.length;
            await ctx.reset();
            const ids120 = await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 120,
                    Height: 56,
                    Depth: 50.5
                }
            ]);
            await wait(400);
            const config120 = ConfiguratorAPI.getConfig(ids120[0]);
            const slots120 = config120.BotDrawerDividers.zones.main.slots.length;
            assert.greaterThan(slots120, slots60, 'Width 120 should have more slots than Width 60');
        });
        // ====== ДОДАВАННЯ DIVIDER ======
        await ctx.it('DIV-6: placeDividerToSlot додає type A в Bot main', async (assert)=>{
            await ctx.reset();
            const ids = await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 60,
                    Height: 56,
                    Depth: 50.5
                }
            ]);
            await wait(400);
            // Знаходимо перший ghost слот
            const config = ConfiguratorAPI.getConfig(ids[0]);
            const firstGhost = config.BotDrawerDividers.zones.main.slots.find((s)=>s.other?.type === 'ghost');
            assert.notNull(firstGhost, 'Should have ghost slot');
            await ConfiguratorAPI.dividers.placeDividerToSlot({
                cabinetId: ids[0],
                drawerType: 'Bot',
                key: firstGhost.key,
                zone: 'main'
            }, 'A');
            await wait(400);
            // Перевіряємо store
            const updatedConfig = ConfiguratorAPI.getConfig(ids[0]);
            const occupiedSlots = updatedConfig.BotDrawerDividers.zones.main.slots.filter((s)=>s.other?.type === 'occupied');
            assert.greaterThan(occupiedSlots.length, 0, 'Should have occupied slot after add');
            const addedSlot = occupiedSlots.find((s)=>s.value === 'A');
            assert.notNull(addedSlot, 'Should have slot with value A');
        });
        await ctx.it('DIV-7: placeDividerToSlot додає type B', async (assert)=>{
            await ctx.reset();
            const ids = await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 60,
                    Height: 56,
                    Depth: 50.5
                }
            ]);
            await wait(400);
            const config = ConfiguratorAPI.getConfig(ids[0]);
            const firstGhost = config.BotDrawerDividers.zones.main.slots.find((s)=>s.other?.type === 'ghost');
            // Перевіряємо що B доступний
            const available = firstGhost.other?.availableTypes || [];
            if (!available.includes('B')) {
                // Якщо B не вміщується — пропускаємо
                return;
            }
            await ConfiguratorAPI.dividers.placeDividerToSlot({
                cabinetId: ids[0],
                drawerType: 'Bot',
                key: firstGhost.key,
                zone: 'main'
            }, 'B');
            await wait(400);
            const updatedConfig = ConfiguratorAPI.getConfig(ids[0]);
            const occupiedSlots = updatedConfig.BotDrawerDividers.zones.main.slots.filter((s)=>s.other?.type === 'occupied');
            const addedSlot = occupiedSlots.find((s)=>s.value === 'B');
            assert.notNull(addedSlot, 'Should have slot with value B');
        });
        await ctx.it('DIV-8: getValueDivider повертає дані після додавання', async (assert)=>{
            await ctx.reset();
            const ids = await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 60,
                    Height: 56,
                    Depth: 50.5
                }
            ]);
            await wait(400);
            const config = ConfiguratorAPI.getConfig(ids[0]);
            const firstGhost = config.BotDrawerDividers.zones.main.slots.find((s)=>s.other?.type === 'ghost');
            await ConfiguratorAPI.dividers.placeDividerToSlot({
                cabinetId: ids[0],
                drawerType: 'Bot',
                key: firstGhost.key,
                zone: 'main'
            }, 'A');
            await wait(400);
            // getValueDivider для доданого слоту
            const slotData = ConfiguratorAPI.dividers.getValueDivider(ids[0], 'Bot', 'main', firstGhost.key);
            assert.notNull(slotData, 'Slot data should exist');
            assert.equal(slotData.value, 'A', 'Value should be A');
            assert.notNull(slotData.other?.stateId, 'Should have stateId');
        });
        await ctx.it('DIV-8b: placeDividerToSlot додає divider коли stored zones empty', async (assert)=>{
            await ctx.reset();
            const ids = await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 60,
                    Height: 56,
                    Depth: 50.5
                }
            ]);
            await wait(400);
            await ConfiguratorAPI.setConfig(ids[0], {
                BotDrawerDividers: {
                    zones: {}
                }
            });
            await wait(300);
            const clearedConfig = ConfiguratorAPI.getConfig(ids[0]);
            assert.equal(Object.keys(clearedConfig.BotDrawerDividers?.zones || {}).length, 0, 'Stored BotDrawerDividers should have empty zones before add');
            const result = await ConfiguratorAPI.dividers.placeDividerToSlot({
                cabinetId: ids[0],
                drawerType: 'Bot',
                key: 'slot_0',
                zone: 'main'
            }, 'A');
            await wait(400);
            assert.isTrue(result, 'placeDividerToSlot should report success');
            const updatedConfig = ConfiguratorAPI.getConfig(ids[0]);
            const occupiedSlots = updatedConfig.BotDrawerDividers.zones.main.slots.filter((s)=>s.other?.type === 'occupied');
            assert.greaterThan(occupiedSlots.length, 0, 'Should have occupied slot after add from empty zones');
            const addedSlot = occupiedSlots.find((s)=>s.value === 'A');
            assert.notNull(addedSlot, 'Should have slot with value A');
        });
        await ctx.it('DIV-8c: Bot drawer підтримує C справа, потім C у лівий ghost', async (assert)=>{
            await ctx.reset();
            const ids = await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 70,
                    Height: 56,
                    Depth: 50.5
                }
            ]);
            await wait(400);
            const initialConfig = ConfiguratorAPI.getConfig(ids[0]);
            const initialGhosts = initialConfig.BotDrawerDividers.zones.main.slots.filter((s)=>s.other?.type === 'ghost');
            const rightGhost = initialGhosts[initialGhosts.length - 1];
            assert.notNull(rightGhost, 'Should have right ghost slot');
            assert.isTrue(rightGhost.other?.availableTypes?.includes('C'), 'Right ghost should allow C');
            const firstResult = await ConfiguratorAPI.dividers.placeDividerToSlot({
                cabinetId: ids[0],
                drawerType: 'Bot',
                key: rightGhost.key,
                zone: 'main'
            }, 'C');
            await wait(400);
            assert.isTrue(firstResult, 'First C placement should succeed');
            const afterFirstConfig = ConfiguratorAPI.getConfig(ids[0]);
            const leftGhost = afterFirstConfig.BotDrawerDividers.zones.main.slots.find((s)=>s.other?.type === 'ghost');
            assert.notNull(leftGhost, 'Should have left ghost after right C placement');
            assert.isTrue(leftGhost.other?.availableTypes?.includes('C'), 'Left ghost should allow C');
            const secondResult = await ConfiguratorAPI.dividers.placeDividerToSlot({
                cabinetId: ids[0],
                drawerType: 'Bot',
                key: leftGhost.key,
                zone: 'main'
            }, 'C');
            await wait(400);
            assert.isTrue(secondResult, 'Second C placement should succeed');
            const updatedConfig = ConfiguratorAPI.getConfig(ids[0]);
            const occupiedCSlots = updatedConfig.BotDrawerDividers.zones.main.slots.filter((s)=>s.other?.type === 'occupied' && s.value === 'C');
            assert.equal(occupiedCSlots.length, 2, 'Should keep both C dividers');
        });
        await ctx.it('DIV-9: додавання в Top siphon_left zone', async (assert)=>{
            await ctx.reset();
            const ids = await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 60,
                    Height: 56,
                    Depth: 50.5,
                    sinkType: 'Top_HPLPrisma'
                }
            ]);
            await wait(400);
            const config = ConfiguratorAPI.getConfig(ids[0]);
            const leftZone = config.TopDrawerDividers?.zones?.siphon_left;
            if (!leftZone || !leftZone.slots || leftZone.slots.length === 0) return;
            const firstGhost = leftZone.slots.find((s)=>s.other?.type === 'ghost');
            if (!firstGhost) return;
            await ConfiguratorAPI.dividers.placeDividerToSlot({
                cabinetId: ids[0],
                drawerType: 'Top',
                key: firstGhost.key,
                zone: 'siphon_left'
            }, 'A');
            await wait(400);
            const updatedConfig = ConfiguratorAPI.getConfig(ids[0]);
            const occupiedSlots = updatedConfig.TopDrawerDividers.zones.siphon_left.slots.filter((s)=>s.other?.type === 'occupied');
            assert.greaterThan(occupiedSlots.length, 0, 'Should have occupied slot in siphon_left');
        });
        await ctx.it('DIV-10: додавання в Top siphon_right zone', async (assert)=>{
            await ctx.reset();
            const ids = await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 60,
                    Height: 56,
                    Depth: 50.5,
                    sinkType: 'Top_HPLPrisma'
                }
            ]);
            await wait(400);
            const config = ConfiguratorAPI.getConfig(ids[0]);
            const rightZone = config.TopDrawerDividers?.zones?.siphon_right;
            if (!rightZone || !rightZone.slots || rightZone.slots.length === 0) return;
            const firstGhost = rightZone.slots.find((s)=>s.other?.type === 'ghost');
            if (!firstGhost) return;
            await ConfiguratorAPI.dividers.placeDividerToSlot({
                cabinetId: ids[0],
                drawerType: 'Top',
                key: firstGhost.key,
                zone: 'siphon_right'
            }, 'A');
            await wait(400);
            const updatedConfig = ConfiguratorAPI.getConfig(ids[0]);
            const occupiedSlots = updatedConfig.TopDrawerDividers.zones.siphon_right.slots.filter((s)=>s.other?.type === 'occupied');
            assert.greaterThan(occupiedSlots.length, 0, 'Should have occupied slot in siphon_right');
        });
        await ctx.it('DIV-10b: Top siphon_left дозволяє A зліва + C справа у 3-slot зоні', async (assert)=>{
            await ctx.reset();
            const ids = await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 120,
                    Height: 56,
                    Depth: 50.5,
                    sinkType: 'Top_HPLPrisma'
                }
            ]);
            await wait(400);
            const config = ConfiguratorAPI.getConfig(ids[0]);
            const leftZone = config.TopDrawerDividers?.zones?.siphon_left;
            assert.notNull(leftZone, 'siphon_left zone should exist');
            const leftEdgeGhost = leftZone.slots.find((s)=>s.other?.type === 'ghost' && s.other?.zoneIndex === 0);
            assert.notNull(leftEdgeGhost, 'Left edge ghost should exist');
            const firstResult = await ConfiguratorAPI.dividers.placeDividerToSlot({
                cabinetId: ids[0],
                drawerType: 'Top',
                key: leftEdgeGhost.key,
                zone: 'siphon_left'
            }, 'A');
            await wait(400);
            assert.isTrue(firstResult, 'A placement at left edge should succeed');
            const afterA = ConfiguratorAPI.getConfig(ids[0]);
            const rightEdgeGhost = afterA.TopDrawerDividers.zones.siphon_left.slots.find((s)=>s.other?.type === 'ghost' && s.other?.zoneIndex === 2);
            assert.notNull(rightEdgeGhost, 'Right edge ghost should exist after A placement');
            assert.isTrue(rightEdgeGhost.other?.availableTypes?.includes('C'), 'Right edge ghost should allow C after left A placement');
            const secondResult = await ConfiguratorAPI.dividers.placeDividerToSlot({
                cabinetId: ids[0],
                drawerType: 'Top',
                key: rightEdgeGhost.key,
                zone: 'siphon_left'
            }, 'C');
            await wait(400);
            assert.isTrue(secondResult, 'C placement at right edge should succeed');
            const updatedConfig = ConfiguratorAPI.getConfig(ids[0]);
            const occupiedSlots = updatedConfig.TopDrawerDividers.zones.siphon_left.slots.filter((s)=>s.other?.type === 'occupied');
            assert.equal(occupiedSlots.length, 2, 'siphon_left should keep A and C occupied');
        });
        await ctx.it('DIV-10c: Top siphon_right дозволяє C зліва + A справа у 3-slot зоні', async (assert)=>{
            await ctx.reset();
            const ids = await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 120,
                    Height: 56,
                    Depth: 50.5,
                    sinkType: 'Top_HPLPrisma'
                }
            ]);
            await wait(400);
            const config = ConfiguratorAPI.getConfig(ids[0]);
            const rightZone = config.TopDrawerDividers?.zones?.siphon_right;
            assert.notNull(rightZone, 'siphon_right zone should exist');
            const rightEdgeGhost = rightZone.slots.find((s)=>s.other?.type === 'ghost' && s.other?.zoneIndex === 2);
            assert.notNull(rightEdgeGhost, 'Right edge ghost should exist');
            const firstResult = await ConfiguratorAPI.dividers.placeDividerToSlot({
                cabinetId: ids[0],
                drawerType: 'Top',
                key: rightEdgeGhost.key,
                zone: 'siphon_right'
            }, 'A');
            await wait(400);
            assert.isTrue(firstResult, 'A placement at right edge should succeed');
            const afterA = ConfiguratorAPI.getConfig(ids[0]);
            const leftEdgeGhost = afterA.TopDrawerDividers.zones.siphon_right.slots.find((s)=>s.other?.type === 'ghost' && s.other?.zoneIndex === 0);
            assert.notNull(leftEdgeGhost, 'Left edge ghost should exist after A placement');
            assert.isTrue(leftEdgeGhost.other?.availableTypes?.includes('C'), 'Left edge ghost should allow C after right A placement');
            const secondResult = await ConfiguratorAPI.dividers.placeDividerToSlot({
                cabinetId: ids[0],
                drawerType: 'Top',
                key: leftEdgeGhost.key,
                zone: 'siphon_right'
            }, 'C');
            await wait(400);
            assert.isTrue(secondResult, 'C placement at left edge should succeed');
            const updatedConfig = ConfiguratorAPI.getConfig(ids[0]);
            const occupiedSlots = updatedConfig.TopDrawerDividers.zones.siphon_right.slots.filter((s)=>s.other?.type === 'occupied');
            assert.equal(occupiedSlots.length, 2, 'siphon_right should keep C and A occupied');
        });
        await ctx.it('DIV-10d: Top siphon_left дозволяє B зліва + C справа у 3-slot зоні', async (assert)=>{
            await ctx.reset();
            const ids = await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 120,
                    Height: 56,
                    Depth: 50.5,
                    sinkType: 'Top_HPLPrisma'
                }
            ]);
            await wait(400);
            const config = ConfiguratorAPI.getConfig(ids[0]);
            const leftZone = config.TopDrawerDividers?.zones?.siphon_left;
            assert.notNull(leftZone, 'siphon_left zone should exist');
            const leftEdgeGhost = leftZone.slots.find((s)=>s.other?.type === 'ghost' && s.other?.zoneIndex === 0);
            assert.notNull(leftEdgeGhost, 'Left edge ghost should exist');
            const firstResult = await ConfiguratorAPI.dividers.placeDividerToSlot({
                cabinetId: ids[0],
                drawerType: 'Top',
                key: leftEdgeGhost.key,
                zone: 'siphon_left'
            }, 'B');
            await wait(400);
            assert.isTrue(firstResult, 'B placement at left edge should succeed');
            const afterB = ConfiguratorAPI.getConfig(ids[0]);
            const rightEdgeGhost = afterB.TopDrawerDividers.zones.siphon_left.slots.find((s)=>s.other?.type === 'ghost' && s.other?.zoneIndex === 2);
            assert.notNull(rightEdgeGhost, 'Right edge ghost should exist after B placement');
            assert.isTrue(rightEdgeGhost.other?.availableTypes?.includes('C'), 'Right edge ghost should allow C after left B placement');
            const secondResult = await ConfiguratorAPI.dividers.placeDividerToSlot({
                cabinetId: ids[0],
                drawerType: 'Top',
                key: rightEdgeGhost.key,
                zone: 'siphon_left'
            }, 'C');
            await wait(400);
            assert.isTrue(secondResult, 'C placement at right edge should succeed');
            const updatedConfig = ConfiguratorAPI.getConfig(ids[0]);
            const occupiedSlots = updatedConfig.TopDrawerDividers.zones.siphon_left.slots.filter((s)=>s.other?.type === 'occupied');
            assert.equal(occupiedSlots.length, 2, 'siphon_left should keep B and C occupied');
        });
        await ctx.it('DIV-10e: Top siphon_right дозволяє C зліва + B справа у 3-slot зоні', async (assert)=>{
            await ctx.reset();
            const ids = await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 120,
                    Height: 56,
                    Depth: 50.5,
                    sinkType: 'Top_HPLPrisma'
                }
            ]);
            await wait(400);
            const config = ConfiguratorAPI.getConfig(ids[0]);
            const rightZone = config.TopDrawerDividers?.zones?.siphon_right;
            assert.notNull(rightZone, 'siphon_right zone should exist');
            const rightEdgeGhost = rightZone.slots.find((s)=>s.other?.type === 'ghost' && s.other?.zoneIndex === 2);
            assert.notNull(rightEdgeGhost, 'Right edge ghost should exist');
            const firstResult = await ConfiguratorAPI.dividers.placeDividerToSlot({
                cabinetId: ids[0],
                drawerType: 'Top',
                key: rightEdgeGhost.key,
                zone: 'siphon_right'
            }, 'B');
            await wait(400);
            assert.isTrue(firstResult, 'B placement at right edge should succeed');
            const afterB = ConfiguratorAPI.getConfig(ids[0]);
            const leftEdgeGhost = afterB.TopDrawerDividers.zones.siphon_right.slots.find((s)=>s.other?.type === 'ghost' && s.other?.zoneIndex === 0);
            assert.notNull(leftEdgeGhost, 'Left edge ghost should exist after B placement');
            assert.isTrue(leftEdgeGhost.other?.availableTypes?.includes('C'), 'Left edge ghost should allow C after right B placement');
            const secondResult = await ConfiguratorAPI.dividers.placeDividerToSlot({
                cabinetId: ids[0],
                drawerType: 'Top',
                key: leftEdgeGhost.key,
                zone: 'siphon_right'
            }, 'C');
            await wait(400);
            assert.isTrue(secondResult, 'C placement at left edge should succeed');
            const updatedConfig = ConfiguratorAPI.getConfig(ids[0]);
            const occupiedSlots = updatedConfig.TopDrawerDividers.zones.siphon_right.slots.filter((s)=>s.other?.type === 'occupied');
            assert.equal(occupiedSlots.length, 2, 'siphon_right should keep C and B occupied');
        });
        // ====== RESIZE ======
        await ctx.it('DIV-11: Width збільшення зберігає dividers', async (assert)=>{
            await ctx.reset();
            const ids = await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 60,
                    Height: 56,
                    Depth: 50.5
                }
            ]);
            await wait(400);
            // Додаємо divider
            const config = ConfiguratorAPI.getConfig(ids[0]);
            const firstGhost = config.BotDrawerDividers.zones.main.slots.find((s)=>s.other?.type === 'ghost');
            assert.notNull(firstGhost, 'Should have ghost slot');
            await ConfiguratorAPI.dividers.placeDividerToSlot({
                cabinetId: ids[0],
                drawerType: 'Bot',
                key: firstGhost.key,
                zone: 'main'
            }, 'A');
            await wait(400);
            // Збільшуємо Width
            await ConfiguratorAPI.setConfig(ids[0], {
                Width: 90
            });
            await wait(500);
            // Перевіряємо що divider збережений
            const updatedConfig = ConfiguratorAPI.getConfig(ids[0]);
            const occupiedSlots = updatedConfig.BotDrawerDividers.zones.main.slots.filter((s)=>s.other?.type === 'occupied');
            assert.greaterThan(occupiedSlots.length, 0, 'Divider should be preserved after width increase');
        });
        await ctx.it('DIV-12: Width збільшення додає ghost слоти', async (assert)=>{
            await ctx.reset();
            const ids = await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 60,
                    Height: 56,
                    Depth: 50.5
                }
            ]);
            await wait(400);
            const config60 = ConfiguratorAPI.getConfig(ids[0]);
            const ghostCount60 = config60.BotDrawerDividers.zones.main.slots.filter((s)=>s.other?.type === 'ghost').length;
            await ConfiguratorAPI.setConfig(ids[0], {
                Width: 90
            });
            await wait(500);
            const config90 = ConfiguratorAPI.getConfig(ids[0]);
            const ghostCount90 = config90.BotDrawerDividers.zones.main.slots.filter((s)=>s.other?.type === 'ghost').length;
            assert.greaterThan(ghostCount90, ghostCount60, 'More ghost slots after width increase');
        });
        await ctx.it('DIV-13: Width зменшення — конфлікти для великих dividers', async (assert)=>{
            await ctx.reset();
            const ids = await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 90,
                    Height: 56,
                    Depth: 50.5
                }
            ]);
            await wait(400);
            // Додаємо кілька dividers щоб заповнити простір
            const config = ConfiguratorAPI.getConfig(ids[0]);
            const ghosts = config.BotDrawerDividers.zones.main.slots.filter((s)=>s.other?.type === 'ghost');
            // Додаємо 3 dividers type A
            for(let i = 0; i < Math.min(3, ghosts.length); i++){
                await ConfiguratorAPI.dividers.placeDividerToSlot({
                    cabinetId: ids[0],
                    drawerType: 'Bot',
                    key: ghosts[i].key,
                    zone: 'main'
                }, 'A');
                await wait(300);
            }
            // Зменшуємо Width до 25 — деякі dividers не вміщуються
            await ConfiguratorAPI.setConfig(ids[0], {
                Width: 25
            });
            await wait(500);
            // Перевіряємо що dividers перераховані
            const updatedConfig = ConfiguratorAPI.getConfig(ids[0]);
            assert.notNull(updatedConfig.BotDrawerDividers, 'BotDrawerDividers should exist');
            const totalSlots = updatedConfig.BotDrawerDividers.zones.main.slots.length;
            assert.greaterThan(totalSlots, 0, 'Should still have slots');
        });
        // ====== OVERLAY ======
        await ctx.it('DIV-14: showIconDividerSlots створює DOM елементи', async (assert)=>{
            await ctx.reset();
            const ids = await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 60,
                    Height: 56,
                    Depth: 50.5
                }
            ]);
            await wait(400);
            ConfiguratorAPI.dividers.showIconDividerSlots(ids[0], 'Bot', true);
            await wait(300);
            const buttons = document.querySelectorAll('.divider-slot-btn');
            assert.greaterThan(buttons.length, 0, 'Should create overlay buttons');
        });
        await ctx.it('DIV-15: ghost слот має клас divider-slot-add', async (assert)=>{
            await ctx.reset();
            const ids = await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 60,
                    Height: 56,
                    Depth: 50.5
                }
            ]);
            await wait(400);
            ConfiguratorAPI.dividers.showIconDividerSlots(ids[0], 'Bot', true);
            await wait(300);
            const addButtons = document.querySelectorAll('.divider-slot-add');
            assert.greaterThan(addButtons.length, 0, 'Should have add (+) buttons');
        });
        await ctx.it('DIV-16: occupied слот має клас divider-slot-occupied', async (assert)=>{
            await ctx.reset();
            const ids = await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 60,
                    Height: 56,
                    Depth: 50.5
                }
            ]);
            await wait(400);
            // Додаємо divider
            const config = ConfiguratorAPI.getConfig(ids[0]);
            const firstGhost = config.BotDrawerDividers.zones.main.slots.find((s)=>s.other?.type === 'ghost');
            await ConfiguratorAPI.dividers.placeDividerToSlot({
                cabinetId: ids[0],
                drawerType: 'Bot',
                key: firstGhost.key,
                zone: 'main'
            }, 'A');
            await wait(400);
            // Показуємо overlay
            ConfiguratorAPI.dividers.showIconDividerSlots(ids[0], 'Bot', true);
            await wait(300);
            const occupiedButtons = document.querySelectorAll('.divider-slot-occupied');
            assert.greaterThan(occupiedButtons.length, 0, 'Should have occupied (✓) buttons');
        });
        await ctx.it('DIV-17: show=false ховає overlay', async (assert)=>{
            await ctx.reset();
            const ids = await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 60,
                    Height: 56,
                    Depth: 50.5
                }
            ]);
            await wait(400);
            ConfiguratorAPI.dividers.showIconDividerSlots(ids[0], 'Bot', true);
            await wait(200);
            assert.greaterThan(document.querySelectorAll('.divider-slot-btn').length, 0, 'Buttons visible');
            ConfiguratorAPI.dividers.showIconDividerSlots(ids[0], 'Bot', false);
            await wait(200);
            // Overlay деактивована
            const layer = document.getElementById('divider-slot-overlay-layer');
            const isHidden = !layer || layer.style.display === 'none';
            assert.isTrue(isHidden, 'Overlay should be hidden');
        });
        // ====== STORE CONSISTENCY ======
        await ctx.it('DIV-18: dividers зберігаються після setConfig Height', async (assert)=>{
            await ctx.reset();
            const ids = await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 60,
                    Height: 56,
                    Depth: 50.5
                }
            ]);
            await wait(400);
            // Додаємо divider
            const config = ConfiguratorAPI.getConfig(ids[0]);
            const firstGhost = config.BotDrawerDividers.zones.main.slots.find((s)=>s.other?.type === 'ghost');
            await ConfiguratorAPI.dividers.placeDividerToSlot({
                cabinetId: ids[0],
                drawerType: 'Bot',
                key: firstGhost.key,
                zone: 'main'
            }, 'A');
            await wait(400);
            // Змінюємо Height (не Width — dividers не мають перераховуватись)
            await ConfiguratorAPI.setConfig(ids[0], {
                Height: 53
            });
            await wait(400);
            const updatedConfig = ConfiguratorAPI.getConfig(ids[0]);
            const occupiedSlots = updatedConfig.BotDrawerDividers.zones.main.slots.filter((s)=>s.other?.type === 'occupied');
            assert.greaterThan(occupiedSlots.length, 0, 'Dividers should persist after Height change');
        });
        await ctx.it('DIV-19: dividers зберігаються після setConfig Depth', async (assert)=>{
            await ctx.reset();
            const ids = await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 60,
                    Height: 56,
                    Depth: 50.5
                }
            ]);
            await wait(400);
            const config = ConfiguratorAPI.getConfig(ids[0]);
            const firstGhost = config.BotDrawerDividers.zones.main.slots.find((s)=>s.other?.type === 'ghost');
            await ConfiguratorAPI.dividers.placeDividerToSlot({
                cabinetId: ids[0],
                drawerType: 'Bot',
                key: firstGhost.key,
                zone: 'main'
            }, 'A');
            await wait(400);
            await ConfiguratorAPI.setConfig(ids[0], {
                Depth: 46
            });
            await wait(400);
            const updatedConfig = ConfiguratorAPI.getConfig(ids[0]);
            const occupiedSlots = updatedConfig.BotDrawerDividers.zones.main.slots.filter((s)=>s.other?.type === 'occupied');
            assert.greaterThan(occupiedSlots.length, 0, 'Dividers should persist after Depth change');
        });
        await ctx.it('DIV-20: dividers зберігаються після setConfig CabinetColor', async (assert)=>{
            await ctx.reset();
            const ids = await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 60,
                    Height: 56,
                    Depth: 50.5,
                    CabinetColor: 'Pulpis Chiaro TKH'
                }
            ]);
            await wait(400);
            const config = ConfiguratorAPI.getConfig(ids[0]);
            const firstGhost = config.BotDrawerDividers.zones.main.slots.find((s)=>s.other?.type === 'ghost');
            await ConfiguratorAPI.dividers.placeDividerToSlot({
                cabinetId: ids[0],
                drawerType: 'Bot',
                key: firstGhost.key,
                zone: 'main'
            }, 'A');
            await wait(400);
            await ConfiguratorAPI.setConfig(ids[0], {
                CabinetColor: 'White Matt'
            });
            await wait(400);
            const updatedConfig = ConfiguratorAPI.getConfig(ids[0]);
            const occupiedSlots = updatedConfig.BotDrawerDividers.zones.main.slots.filter((s)=>s.other?.type === 'occupied');
            assert.greaterThan(occupiedSlots.length, 0, 'Dividers should persist after color change');
        });
        // ====== AVAILABLE TYPES ======
        await ctx.it('DIV-21: getAvailableDividerTypes повертає масив', async (assert)=>{
            await ctx.reset();
            const ids = await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 60,
                    Height: 56,
                    Depth: 50.5
                }
            ]);
            await wait(400);
            const config = ConfiguratorAPI.getConfig(ids[0]);
            const firstGhost = config.BotDrawerDividers.zones.main.slots.find((s)=>s.other?.type === 'ghost');
            assert.notNull(firstGhost, 'Should have ghost slot');
            const types = ConfiguratorAPI.dividers.getAvailableDividerTypes({
                cabinetId: ids[0],
                drawerType: 'Bot',
                zone: 'main',
                slotKey: firstGhost.key
            });
            assert.isTrue(Array.isArray(types), 'Should return array');
            assert.greaterThan(types.length, 0, 'Should have available types');
            assert.isTrue(types.includes('A'), 'Type A should be available (smallest)');
        });
        // ====== MULTI-CABINET ======
        await ctx.it('DIV-22: кожен кабінет має свої dividers', async (assert)=>{
            await ctx.reset();
            const ids = await ConfiguratorAPI.presetProducts([
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
            await wait(400);
            const config1 = ConfiguratorAPI.getConfig(ids[0]);
            const config2 = ConfiguratorAPI.getConfig(ids[1]);
            assert.notNull(config1.BotDrawerDividers, 'First cabinet has BotDrawerDividers');
            assert.notNull(config2.BotDrawerDividers, 'Second cabinet has BotDrawerDividers');
            // Додаємо divider тільки в перший
            const firstGhost = config1.BotDrawerDividers.zones.main.slots.find((s)=>s.other?.type === 'ghost');
            await ConfiguratorAPI.dividers.placeDividerToSlot({
                cabinetId: ids[0],
                drawerType: 'Bot',
                key: firstGhost.key,
                zone: 'main'
            }, 'A');
            await wait(400);
            // Перший має occupied, другий — ні
            const updated1 = ConfiguratorAPI.getConfig(ids[0]);
            const updated2 = ConfiguratorAPI.getConfig(ids[1]);
            const occupied1 = updated1.BotDrawerDividers.zones.main.slots.filter((s)=>s.other?.type === 'occupied');
            const occupied2 = updated2.BotDrawerDividers.zones.main.slots.filter((s)=>s.other?.type === 'occupied');
            assert.greaterThan(occupied1.length, 0, 'First cabinet should have divider');
            assert.equal(occupied2.length, 0, 'Second cabinet should NOT have divider');
        });
        // ====== DYNAMIC PLACEMENT CANDIDATES ======
        await ctx.it('DIV-23: candidate engine рахує candidates для A/B/C у Top та Bot zones', async (assert)=>{
            for (const selectedType of [
                'A',
                'B',
                'C'
            ]){
                const top = candidateEngine.getPlacementSlots(70, 'Top', {
                    zones: {}
                }, selectedType);
                const leftCandidates = top.zones.siphon_left.slots.filter((s)=>s.other?.type === 'candidate');
                const rightCandidates = top.zones.siphon_right.slots.filter((s)=>s.other?.type === 'candidate');
                assert.greaterThan(leftCandidates.length, 0, `Top siphon_left should have ${selectedType} candidates`);
                assert.greaterThan(rightCandidates.length, 0, `Top siphon_right should have ${selectedType} candidates`);
                assert.isTrue(leftCandidates.every((s)=>s.other.placementType === selectedType), 'Left candidates keep selected type');
                assert.isTrue(rightCandidates.every((s)=>s.other.placementType === selectedType), 'Right candidates keep selected type');
                const bot = candidateEngine.getPlacementSlots(70, 'Bot', {
                    zones: {}
                }, selectedType);
                const botCandidates = bot.zones.main.slots.filter((s)=>s.other?.type === 'candidate');
                assert.greaterThan(botCandidates.length, 0, `Bot main should have ${selectedType} candidates`);
                assert.isTrue(botCandidates.every((s)=>s.other.placementType === selectedType), 'Bot candidates keep selected type');
            }
        });
        await ctx.it('DIV-24: selected C candidate має ширину 22.1cm', async (assert)=>{
            const top = candidateEngine.getPlacementSlots(70, 'Top', {
                zones: {}
            }, 'C');
            const cCandidate = flattenCandidateSlots(top).find((s)=>s.other?.type === 'candidate' && s.other?.canPlace);
            assert.notNull(cCandidate, 'Should have an active C candidate');
            assert.closeTo(cCandidate.width, 22.1, 0.01, 'C candidate should use C width');
        });
        await ctx.it('DIV-24b: Top siphon selected C рахується від зовнішніх країв і ховає leftover біля сифона', async (assert)=>{
            const top = candidateEngine.getPlacementSlots(120, 'Top', {
                zones: {}
            }, 'C');
            const leftCandidates = top.zones.siphon_left.slots.filter((s)=>s.other?.type === 'candidate');
            const rightCandidates = top.zones.siphon_right.slots.filter((s)=>s.other?.type === 'candidate');
            const leftIndexes = leftCandidates.map((s)=>s.other.zoneIndex);
            const rightIndexes = rightCandidates.map((s)=>s.other.zoneIndex);
            assert.equal(leftCandidates.length, 2, 'Left siphon should expose only two C candidates');
            assert.equal(rightCandidates.length, 2, 'Right siphon should expose only two C candidates');
            assert.isTrue(leftIndexes.includes(0), 'Left outer candidate should be visible');
            assert.isTrue(leftIndexes.includes(1), 'Left second candidate should be visible');
            assert.isFalse(leftIndexes.includes(2), 'Left cutout-side leftover should be hidden');
            assert.isTrue(rightIndexes.includes(2), 'Right outer candidate should be visible');
            assert.isTrue(rightIndexes.includes(1), 'Right second candidate should be visible');
            assert.isFalse(rightIndexes.includes(0), 'Right cutout-side leftover should be hidden');
            assert.isTrue(leftCandidates.every((s)=>Math.abs(s.width - 22.1) < 0.01), 'Left C candidates use C width');
            assert.isTrue(rightCandidates.every((s)=>Math.abs(s.width - 22.1) < 0.01), 'Right C candidates use C width');
        });
        await ctx.it('DIV-24c: Top siphon selected C після зовнішнього A дає наступний inward candidate', async (assert)=>{
            const top = candidateEngine.getPlacementSlots(120, 'Top', {
                zones: {
                    siphon_left: {
                        slots: [
                            {
                                zoneIndex: 0,
                                value: 'A',
                                stateId: 'left-a'
                            }
                        ]
                    },
                    siphon_right: {
                        slots: [
                            {
                                zoneIndex: 2,
                                value: 'A',
                                stateId: 'right-a'
                            }
                        ]
                    }
                }
            }, 'C');
            const leftCandidates = top.zones.siphon_left.slots.filter((s)=>s.other?.type === 'candidate' && s.other?.canPlace);
            const rightCandidates = top.zones.siphon_right.slots.filter((s)=>s.other?.type === 'candidate' && s.other?.canPlace);
            assert.equal(leftCandidates.length, 1, 'Left side should have one remaining C candidate');
            assert.equal(rightCandidates.length, 1, 'Right side should have one remaining C candidate');
            assert.equal(leftCandidates[0].other.zoneIndex, 1, 'Left candidate should move inward from outer A');
            assert.equal(rightCandidates[0].other.zoneIndex, 1, 'Right candidate should move inward from outer A');
        });
        await ctx.it('DIV-25: Customize без option створює disabled candidates з select-divider', async (assert)=>{
            const bot = candidateEngine.getPlacementSlots(70, 'Bot', {
                zones: {}
            }, null);
            const candidates = flattenCandidateSlots(bot).filter((s)=>s.other?.type === 'candidate');
            assert.greaterThan(candidates.length, 0, 'Should have disabled candidates');
            assert.isTrue(candidates.every((s)=>s.other.canPlace === false), 'Candidates should be disabled');
            assert.isTrue(candidates.every((s)=>s.other.disabledReason === 'select-divider'), 'Reason should be select-divider');
        });
        await ctx.it('DIV-26: A+C та B+C валідні у 47.2 inch under drawer', async (assert)=>{
            for (const existingType of [
                'A',
                'B'
            ]){
                const bot = candidateEngine.getPlacementSlots(120, 'Bot', {
                    zones: {
                        main: {
                            slots: [
                                {
                                    zoneIndex: 0,
                                    value: existingType,
                                    stateId: `test-${existingType}`
                                }
                            ]
                        }
                    }
                }, 'C');
                const activeC = flattenCandidateSlots(bot).filter((s)=>s.other?.type === 'candidate' && s.other?.placementType === 'C' && s.other?.canPlace);
                assert.greaterThan(activeC.length, 0, `${existingType}+C should have at least one active C candidate`);
                assert.isTrue(activeC.every((s)=>Math.abs(s.width - 22.1) < 0.01), `${existingType}+C candidates should use C width`);
            }
        });
        await ctx.it('DIV-27: selected type що не влазить створює disabled does-not-fit candidate', async (assert)=>{
            const top = candidateEngine.getPlacementSlots(80, 'Top', {
                zones: {
                    siphon_left: {
                        slots: [
                            {
                                zoneIndex: 0,
                                value: 'A',
                                stateId: 'test-a'
                            }
                        ]
                    }
                }
            }, 'C');
            const disabledC = top.zones.siphon_left.slots.find((s)=>s.other?.type === 'candidate' && s.other?.placementType === 'C' && s.other?.canPlace === false);
            assert.notNull(disabledC, 'Should have disabled C candidate');
            assert.equal(disabledC.other.disabledReason, 'does-not-fit', 'Disabled reason should be does-not-fit');
            assert.isTrue(disabledC.other.availableTypes.includes('A'), 'Disabled candidate should expose available types');
        });
        await ctx.it('DIV-28: placeDividerToSlot використовує zoneIndex коли key є candidate key', async (assert)=>{
            await ctx.reset();
            const ids = await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 70,
                    Height: 56,
                    Depth: 50.5
                }
            ]);
            await wait(400);
            const result = await ConfiguratorAPI.dividers.placeDividerToSlot({
                cabinetId: ids[0],
                drawerType: 'Bot',
                key: 'candidate:Bot:main:2:C',
                zone: 'main',
                zoneIndex: 2,
                placementType: 'C',
                availableTypes: [
                    'A',
                    'B',
                    'C'
                ],
                canPlace: true
            }, 'C');
            await wait(400);
            assert.isTrue(result, 'Candidate-key placement should succeed');
            const updatedConfig = ConfiguratorAPI.getConfig(ids[0]);
            const placed = updatedConfig.BotDrawerDividers.zones.main.slots.find((s)=>s.other?.type === 'occupied' && s.other?.zoneIndex === 2);
            assert.notNull(placed, 'Divider should be saved at zoneIndex 2');
            assert.equal(placed.value, 'C', 'Saved divider should be C');
        });
        await ctx.it('DIV-29: showIconDividerSlots options object показує disabled candidates', async (assert)=>{
            await ctx.reset();
            const ids = await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 70,
                    Height: 56,
                    Depth: 50.5
                }
            ]);
            await wait(400);
            ConfiguratorAPI.dividers.showIconDividerSlots(ids[0], 'Bot', {
                show: true,
                selectedDividerType: null
            });
            await wait(300);
            const disabledButtons = document.querySelectorAll('.divider-slot-disabled');
            assert.greaterThan(disabledButtons.length, 0, 'Should render disabled candidate buttons');
        });
        await ctx.it('DIV-30: disabled candidate не викликає placement у state', async (assert)=>{
            await ctx.reset();
            const ids = await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 70,
                    Height: 56,
                    Depth: 50.5
                }
            ]);
            await wait(400);
            const result = await ConfiguratorAPI.dividers.placeDividerToSlot({
                cabinetId: ids[0],
                drawerType: 'Bot',
                key: 'candidate:Bot:main:0:C',
                zone: 'main',
                zoneIndex: 0,
                placementType: 'C',
                availableTypes: [
                    'A',
                    'B'
                ],
                canPlace: false,
                disabledReason: 'does-not-fit'
            }, 'C');
            await wait(300);
            assert.isFalse(result, 'Disabled candidate placement should be rejected');
            const updatedConfig = ConfiguratorAPI.getConfig(ids[0]);
            const occupied = updatedConfig.BotDrawerDividers.zones.main.slots.filter((s)=>s.other?.type === 'occupied');
            assert.equal(occupied.length, 0, 'No divider should be added for disabled candidate');
        });
        await ctx.it('DIV-31: stale Top siphon cutout-side C candidate не зберігається', async (assert)=>{
            await ctx.reset();
            const ids = await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 120,
                    Height: 56,
                    Depth: 50.5
                }
            ]);
            await wait(400);
            const result = await ConfiguratorAPI.dividers.placeDividerToSlot({
                cabinetId: ids[0],
                drawerType: 'Top',
                key: 'candidate:Top:siphon_right:0:C',
                zone: 'siphon_right',
                zoneIndex: 0,
                placementType: 'C',
                availableTypes: [
                    'A',
                    'B',
                    'C'
                ],
                canPlace: true
            }, 'C');
            await wait(300);
            assert.isFalse(result, 'Cutout-side stale C placement should be rejected');
            const updatedConfig = ConfiguratorAPI.getConfig(ids[0]);
            const occupied = updatedConfig.TopDrawerDividers.zones.siphon_right.slots.filter((s)=>s.other?.type === 'occupied');
            assert.equal(occupied.length, 0, 'No top siphon divider should be saved for stale candidate');
        });
    });
}

export { registerDividerTests };
