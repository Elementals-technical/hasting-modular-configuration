import { app } from '../../../../../playcanvas-stable.min.mjs';
import { TestContext } from '../test-runner.mjs';

const wait = TestContext.wait;
/**
 * Тест suite для Cabinet функціоналу
 * Покриває: preset, add, remove, swap, setConfig, setConfigBatch
 */ function registerCabinetTests(runner) {
    runner.suite('Cabinet', async (ctx)=>{
        // ====== PRESET ======
        await ctx.it('CAB-1: presetProducts створює кабінети', async (assert)=>{
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
                    Width: 25,
                    Height: 56,
                    Depth: 50.5
                }
            ]);
            await wait(300);
            assert.equal(ids.length, 2, 'Should return 2 IDs');
            assert.entityExists(ids[0]);
            assert.entityExists(ids[1]);
        });
        await ctx.it('CAB-2: presetProducts створює стільницю автоматично', async (assert)=>{
            await ctx.reset();
            await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 60,
                    Height: 56,
                    Depth: 50.5
                }
            ]);
            await wait(300);
            // Перевіряємо через store — countertop має бути в композиції
            const cm = app.compositionManager;
            const composition = cm.getActiveComposition();
            const allProducts = composition.getAllProducts();
            const countertops = Object.values(allProducts).filter((p)=>p.category === 'countertops');
            assert.equal(countertops.length, 1, 'Should have 1 countertop in store');
        });
        await ctx.it('CAB-3: presetProducts з globalConfig', async (assert)=>{
            await ctx.reset();
            const ids = await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base'
                },
                {
                    name: 'Sink-Cabinet'
                }
            ], {
                Height: 53,
                Depth: 46
            });
            await wait(300);
            const config1 = ConfiguratorAPI.getConfig(ids[0]);
            const config2 = ConfiguratorAPI.getConfig(ids[1]);
            assert.equal(config1.Height, 53, 'First cabinet Height');
            assert.equal(config1.Depth, 46, 'First cabinet Depth');
            assert.equal(config2.Height, 53, 'Second cabinet Height');
        });
        await ctx.it('CAB-4: presetProducts очищає попередню сцену', async (assert)=>{
            await ctx.reset();
            await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 60
                }
            ]);
            await wait(200);
            assert.entityCount('Sink-Base', 1);
            await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Cabinet',
                    Width: 25
                }
            ]);
            await wait(300);
            assert.entityCount('Sink-Base', 0);
            assert.entityCount('Sink-Cabinet', 1);
        });
        // ====== ADD PRODUCT ======
        await ctx.it('CAB-5: addProduct додає кабінет справа', async (assert)=>{
            await ctx.reset();
            const ids = await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 60,
                    Height: 56,
                    Depth: 50.5
                }
            ]);
            await wait(200);
            const newId = await ConfiguratorAPI.addProduct('Sink-Cabinet', {
                Width: 25,
                Height: 56,
                Depth: 50.5
            });
            await wait(300);
            assert.notNull(newId, 'Should return new ID');
            assert.entityExists(newId);
            // Новий кабінет правіше першого
            const first = assert.entityExists(ids[0]);
            const second = assert.entityExists(newId);
            assert.greaterThan(second.getPosition().x, first.getPosition().x, 'New cabinet should be right');
        });
        await ctx.it('CAB-6: addProductByLeft додає кабінет зліва', async (assert)=>{
            await ctx.reset();
            const ids = await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 60,
                    Height: 56,
                    Depth: 50.5
                }
            ]);
            await wait(200);
            const newId = await ConfiguratorAPI.addProductByLeft('Sink-Cabinet', {
                Width: 25,
                Height: 56,
                Depth: 50.5
            });
            await wait(300);
            assert.notNull(newId, 'Should return new ID');
            const original = assert.entityExists(ids[0]);
            const added = assert.entityExists(newId);
            assert.lessThan(added.getPosition().x, original.getPosition().x, 'Left cabinet should be left');
        });
        await ctx.it('CAB-7: addProductByRight додає кабінет справа', async (assert)=>{
            await ctx.reset();
            const ids = await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 60,
                    Height: 56,
                    Depth: 50.5
                }
            ]);
            await wait(200);
            const newId = await ConfiguratorAPI.addProductByRight('Sink-Cabinet', {
                Width: 25,
                Height: 56,
                Depth: 50.5
            });
            await wait(300);
            const original = assert.entityExists(ids[0]);
            const added = assert.entityExists(newId);
            assert.greaterThan(added.getPosition().x, original.getPosition().x, 'Right cabinet should be right');
        });
        await ctx.it('CAB-8: addProductByLeft з config', async (assert)=>{
            await ctx.reset();
            await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 60,
                    Height: 56,
                    Depth: 50.5
                }
            ]);
            await wait(200);
            const newId = await ConfiguratorAPI.addProductByLeft('Sink-Cabinet', {
                Width: 25,
                Height: 53,
                Depth: 46
            });
            await wait(300);
            const config = ConfiguratorAPI.getConfig(newId);
            assert.equal(config.Height, 53, 'Height from config');
            assert.equal(config.Depth, 46, 'Depth from config');
        });
        // ====== REMOVE ======
        await ctx.it('CAB-9: removeProduct видаляє кабінет', async (assert)=>{
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
                    Width: 25,
                    Height: 56,
                    Depth: 50.5
                }
            ]);
            await wait(200);
            ConfiguratorAPI.removeProduct(ids[1]);
            await wait(300);
            assert.entityExists(ids[0]);
            assert.entityNotExists(ids[1]);
        });
        await ctx.it('CAB-10: removeProduct останнього видаляє стільницю', async (assert)=>{
            await ctx.reset();
            const ids = await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 60,
                    Height: 56,
                    Depth: 50.5
                }
            ]);
            await wait(300);
            // Стільниця є в store
            const cm = app.compositionManager;
            let allProducts = cm.getActiveComposition().getAllProducts();
            let countertops = Object.values(allProducts).filter((p)=>p.category === 'countertops');
            assert.equal(countertops.length, 1, 'Should have countertop before remove');
            ConfiguratorAPI.removeProduct(ids[0]);
            await wait(400);
            // Стільниця видалена зі store
            allProducts = cm.getActiveComposition().getAllProducts();
            countertops = Object.values(allProducts).filter((p)=>p.category === 'countertops');
            assert.equal(countertops.length, 0, 'Countertop should be removed after last cabinet');
        });
        await ctx.it('CAB-11: removeAllProduct очищає сцену', async (assert)=>{
            await ctx.reset();
            await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 60
                },
                {
                    name: 'Sink-Cabinet',
                    Width: 25
                },
                {
                    name: 'Sink-Base',
                    Width: 60
                }
            ]);
            await wait(200);
            ConfiguratorAPI.removeAllProduct();
            await wait(400);
            // Перевіряємо через store — всі продукти видалені
            const cm = app.compositionManager;
            const allProducts = cm.getActiveComposition().getAllProducts();
            const cabinets = Object.values(allProducts).filter((p)=>p.category === 'cabinets');
            const countertops = Object.values(allProducts).filter((p)=>p.category === 'countertops');
            assert.equal(cabinets.length, 0, 'No cabinets in store');
            assert.equal(countertops.length, 0, 'No countertops in store');
        });
        // ====== SWAP ======
        await ctx.it('CAB-12: swapProducts міняє позиції', async (assert)=>{
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
                    Width: 25,
                    Height: 56,
                    Depth: 50.5
                }
            ]);
            await wait(300);
            const posA_before = assert.entityExists(ids[0]).getPosition().x;
            const posB_before = assert.entityExists(ids[1]).getPosition().x;
            ConfiguratorAPI.swapProducts(ids[0], ids[1]);
            await wait(400);
            const posA_after = assert.entityExists(ids[0]).getPosition().x;
            const posB_after = assert.entityExists(ids[1]).getPosition().x;
            // Після swap: A має бути правіше, B лівіше
            assert.greaterThan(posA_after, posA_before, 'A should move right');
            assert.lessThan(posB_after, posB_before, 'B should move left');
        });
        // ====== SET CONFIG ======
        await ctx.it('CAB-13: setConfig змінює параметри', async (assert)=>{
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
            await wait(300);
            const result = await ConfiguratorAPI.setConfig(ids[0], {
                Width: 80
            });
            await wait(400);
            assert.isTrue(result.success, 'setConfig should succeed');
            const config = ConfiguratorAPI.getConfig(ids[0]);
            assert.equal(config.Width, 80, 'Width should be updated');
        });
        await ctx.it('CAB-14: setConfig — Height', async (assert)=>{
            await ctx.reset();
            const ids = await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 60,
                    Height: 56,
                    Depth: 50.5
                }
            ]);
            await wait(300);
            await ConfiguratorAPI.setConfig(ids[0], {
                Height: 53
            });
            await wait(400);
            const config = ConfiguratorAPI.getConfig(ids[0]);
            assert.equal(config.Height, 53, 'Height should be 53');
        });
        await ctx.it('CAB-15: setConfig — Depth', async (assert)=>{
            await ctx.reset();
            const ids = await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 60,
                    Height: 56,
                    Depth: 50.5
                }
            ]);
            await wait(300);
            await ConfiguratorAPI.setConfig(ids[0], {
                Depth: 46
            });
            await wait(400);
            const config = ConfiguratorAPI.getConfig(ids[0]);
            assert.equal(config.Depth, 46, 'Depth should be 46');
        });
        await ctx.it('CAB-16: setConfig — CabinetColor', async (assert)=>{
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
            await wait(300);
            await ConfiguratorAPI.setConfig(ids[0], {
                CabinetColor: 'White Matt'
            });
            await wait(400);
            const config = ConfiguratorAPI.getConfig(ids[0]);
            assert.equal(config.CabinetColor, 'White Matt', 'CabinetColor should be updated');
        });
        // ====== SET CONFIG BATCH ======
        await ctx.it('CAB-17: setConfigBatch оновлює всі кабінети', async (assert)=>{
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
                    Width: 25,
                    Height: 56,
                    Depth: 50.5
                }
            ]);
            await wait(300);
            const result = await ConfiguratorAPI.setConfigBatch({}, {
                Depth: 46
            });
            await wait(400);
            assert.notNull(result.updatedIds, 'Should return updatedIds');
            assert.greaterThan(result.updatedIds.length, 0, 'Should update at least 1');
            const config1 = ConfiguratorAPI.getConfig(ids[0]);
            const config2 = ConfiguratorAPI.getConfig(ids[1]);
            assert.equal(config1.Depth, 46, 'First cabinet Depth');
            assert.equal(config2.Depth, 46, 'Second cabinet Depth');
        });
        await ctx.it('CAB-18: setConfigBatch з productIds фільтром', async (assert)=>{
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
                    Width: 25,
                    Height: 56,
                    Depth: 50.5
                }
            ]);
            await wait(300);
            await ConfiguratorAPI.setConfigBatch({
                productIds: [
                    ids[0]
                ]
            }, {
                Depth: 46
            });
            await wait(400);
            const config1 = ConfiguratorAPI.getConfig(ids[0]);
            const config2 = ConfiguratorAPI.getConfig(ids[1]);
            assert.equal(config1.Depth, 46, 'First should be updated');
            assert.equal(config2.Depth, 50.5, 'Second should NOT be updated');
        });
        // ====== GET CONFIG ======
        await ctx.it('CAB-19: getConfig повертає конфігурацію', async (assert)=>{
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
            await wait(200);
            const config = ConfiguratorAPI.getConfig(ids[0]);
            assert.notNull(config, 'Config should exist');
            assert.equal(config.Width, 60, 'Width');
            assert.equal(config.Height, 56, 'Height');
            assert.equal(config.Depth, 50.5, 'Depth');
            assert.equal(config.CabinetColor, 'Pulpis Chiaro TKH', 'CabinetColor');
        });
        await ctx.it('CAB-20: getConfig для неіснуючого продукту', async (assert)=>{
            await ctx.reset();
            const config = ConfiguratorAPI.getConfig('NonExistent_999');
            assert.isNull(config, 'Should return null');
        });
        // ====== EDGE CABINETS ======
        await ctx.it('CAB-21: getEdgeCabinets з 1 кабінетом', async (assert)=>{
            await ctx.reset();
            const ids = await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 60,
                    Height: 56,
                    Depth: 50.5
                }
            ]);
            await wait(200);
            const edges = ConfiguratorAPI.getEdgeCabinets();
            assert.equal(edges.leftCabinetId, ids[0], 'Left should be first');
            assert.equal(edges.rightCabinetId, ids[0], 'Right should be same (1 cabinet)');
        });
        await ctx.it('CAB-22: getEdgeCabinets з 3 кабінетами', async (assert)=>{
            await ctx.reset();
            const ids = await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 60
                },
                {
                    name: 'Sink-Cabinet',
                    Width: 25
                },
                {
                    name: 'Sink-Base',
                    Width: 60
                }
            ]);
            await wait(200);
            const edges = ConfiguratorAPI.getEdgeCabinets();
            assert.equal(edges.leftCabinetId, ids[0], 'Left should be first');
            assert.equal(edges.rightCabinetId, ids[2], 'Right should be last');
        });
        // ====== LAYOUT ======
        await ctx.it('CAB-23: кабінети позиціюються в ряд по X', async (assert)=>{
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
            await wait(300);
            const pos0 = assert.entityExists(ids[0]).getPosition().x;
            const pos1 = assert.entityExists(ids[1]).getPosition().x;
            const pos2 = assert.entityExists(ids[2]).getPosition().x;
            assert.lessThan(pos0, pos1, 'First should be left of second');
            assert.lessThan(pos1, pos2, 'Second should be left of third');
        });
        await ctx.it('CAB-24: layout перераховується після setConfig Width', async (assert)=>{
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
                    Width: 25,
                    Height: 56,
                    Depth: 50.5
                }
            ]);
            await wait(300);
            const pos1_before = assert.entityExists(ids[1]).getPosition().x;
            await ConfiguratorAPI.setConfig(ids[0], {
                Width: 120
            });
            await wait(400);
            const pos1_after = assert.entityExists(ids[1]).getPosition().x;
            // Другий кабінет має зміститись правіше (перший став ширше)
            assert.greaterThan(pos1_after, pos1_before, 'Second cabinet should shift right after first widened');
        });
        // ====== SIDE-SHELF ======
        await ctx.it('CAB-25: Side-Shelf на правому краю', async (assert)=>{
            await ctx.reset();
            const ids = await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 60,
                    Height: 56,
                    Depth: 50.5
                }
            ]);
            await wait(200);
            const shelfId = await ConfiguratorAPI.addProduct('Side-Shelf', {
                Height: 56,
                Depth: 50.5
            });
            await wait(300);
            assert.notNull(shelfId, 'Should return shelf ID');
            const cabinet = assert.entityExists(ids[0]);
            const shelf = assert.entityExists(shelfId);
            assert.greaterThan(shelf.getPosition().x, cabinet.getPosition().x, 'Shelf should be right of cabinet');
        });
        await ctx.it('CAB-26: Side-Shelf на лівому краю дзеркалиться', async (assert)=>{
            await ctx.reset();
            await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 60,
                    Height: 56,
                    Depth: 50.5
                }
            ]);
            await wait(200);
            const shelfId = await ConfiguratorAPI.addProductByLeft('Side-Shelf', {
                Height: 56,
                Depth: 50.5
            });
            await wait(300);
            const shelf = assert.entityExists(shelfId);
            const scaleX = shelf.getLocalScale().x;
            assert.equal(scaleX, -1, 'Left Side-Shelf should be mirrored (scaleX = -1)');
        });
    });
}

export { registerCabinetTests };
