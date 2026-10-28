import { TestContext } from '../test-runner.mjs';

const wait = TestContext.wait;

/**
 * Тест suite для TowelBar функціоналу
 */
export function registerTowelBarTests(runner) {
    runner.suite('TowelBar', async (ctx) => {

        // ====== СТВОРЕННЯ ======

        await ctx.it('TB-1: створення лівого towel bar', async (assert) => {
            await ctx.reset();
            await ConfiguratorAPI.presetProducts([
                { name: 'Sink-Base', Width: 60, Height: 56, Depth: 50.5 }
            ]);

            await ConfiguratorAPI.setConfigBatch({}, { TowelBar: 'TowelBar40_R', TowelBarSide: 'left' });
            await wait(300);

            assert.entityCount('TowelBar_Left', 1);
            assert.entityCount('TowelBar_Right', 0);
        });

        await ctx.it('TB-2: обидві сторони', async (assert) => {
            await ctx.reset();
            await ConfiguratorAPI.presetProducts([
                { name: 'Sink-Base', Width: 60, Height: 56, Depth: 50.5 }
            ]);

            await ConfiguratorAPI.setConfigBatch({}, { TowelBar: 'TowelBar40_R' });
            await wait(300);

            assert.entityCount('TowelBar_Left', 1);
            assert.entityCount('TowelBar_Right', 1);
        });

        await ctx.it('TB-3: позиціювання — left лівіше кабінету, right правіше', async (assert) => {
            await ctx.reset();
            await ConfiguratorAPI.presetProducts([
                { name: 'Sink-Base', Width: 60, Height: 56, Depth: 50.5 }
            ]);

            await ConfiguratorAPI.setConfigBatch({}, { TowelBar: 'TowelBar40_R' });
            await wait(300);

            const cabinet = assert.findEntity('Sink-Base');
            const leftBar = assert.findEntity('TowelBar_Left');
            const rightBar = assert.findEntity('TowelBar_Right');

            assert.lessThan(leftBar.getPosition().x, cabinet.getPosition().x, 'Left bar should be left of cabinet');
            assert.greaterThan(rightBar.getPosition().x, cabinet.getPosition().x, 'Right bar should be right of cabinet');
        });

        // ====== ЗМІНА КОЛЬОРУ ======

        await ctx.it('TB-4: зміна кольору', async (assert) => {
            await ctx.reset();
            await ConfiguratorAPI.presetProducts([
                { name: 'Sink-Base', Width: 60, Height: 56, Depth: 50.5 }
            ]);

            await ConfiguratorAPI.setConfigBatch({}, { TowelBar: 'TowelBar40_R' });
            await wait(200);

            await ConfiguratorAPI.setConfigBatch({}, { TowelBarColor: 'Chrome' });
            await wait(200);

            const barName = assert.findEntity('TowelBar_Left').name;
            const config = ConfiguratorAPI.getConfig(barName);
            assert.equal(config.TowelBarColor, 'Chrome', 'Color should be Chrome');
        });

        // ====== ВИДАЛЕННЯ ======

        await ctx.it('TB-5: видалення однієї сторони', async (assert) => {
            await ctx.reset();
            await ConfiguratorAPI.presetProducts([
                { name: 'Sink-Base', Width: 60, Height: 56, Depth: 50.5 }
            ]);

            await ConfiguratorAPI.setConfigBatch({}, { TowelBar: 'TowelBar40_R' });
            await wait(300);

            assert.entityCount('TowelBar_Left', 1);
            assert.entityCount('TowelBar_Right', 1);

            // None + side='left' видаляє тільки лівий
            await ConfiguratorAPI.setConfigBatch({}, { TowelBar: 'None', TowelBarSide: 'left' });
            await wait(300);

            assert.entityCount('TowelBar_Left', 0);
            assert.entityCount('TowelBar_Right', 1);
        });

        await ctx.it('TB-6: видалення обох', async (assert) => {
            await ctx.reset();
            await ConfiguratorAPI.presetProducts([
                { name: 'Sink-Base', Width: 60, Height: 56, Depth: 50.5 }
            ]);

            await ConfiguratorAPI.setConfigBatch({}, { TowelBar: 'TowelBar40_R' });
            await wait(200);

            await ConfiguratorAPI.setConfigBatch({}, { TowelBar: 'None' });
            await wait(200);

            assert.entityCount('TowelBar_Left', 0);
            assert.entityCount('TowelBar_Right', 0);
        });

        // ====== АВТОМАТИЧНЕ УПРАВЛІННЯ ======

        await ctx.it('TB-7: автовидалення при видаленні кабінетів', async (assert) => {
            await ctx.reset();
            await ConfiguratorAPI.presetProducts([
                { name: 'Sink-Base', Width: 60, Height: 56, Depth: 50.5 }
            ]);
            await ConfiguratorAPI.setConfigBatch({}, { TowelBar: 'TowelBar40_R' });
            await wait(200);

            const cabinetName = assert.findEntity('Sink-Base').name;
            await ConfiguratorAPI.removeProduct(cabinetName);
            await wait(300);

            assert.entityCount('TowelBar_Left', 0);
            assert.entityCount('TowelBar_Right', 0);
        });

        await ctx.it('TB-8: persistence + color після re-add', async (assert) => {
            await ctx.reset();
            await ConfiguratorAPI.presetProducts([
                { name: 'Sink-Base', Width: 60, Height: 56, Depth: 50.5 }
            ]);
            await ConfiguratorAPI.setConfigBatch({}, { TowelBar: 'TowelBar40_R' });
            await ConfiguratorAPI.setConfigBatch({}, { TowelBarColor: 'Chrome' });
            await wait(200);

            ConfiguratorAPI.removeAllProduct();
            await wait(200);

            assert.entityCount('TowelBar_Left', 0);

            await ConfiguratorAPI.addProduct('Sink-Base', { Width: 80, Height: 53, Depth: 46 });
            await wait(400);

            assert.entityCount('TowelBar_Left', 1);
            assert.entityCount('TowelBar_Right', 1);

            const barName = assert.findEntity('TowelBar_Left').name;
            const config = ConfiguratorAPI.getConfig(barName);
            assert.equal(config.TowelBarColor, 'Chrome', 'Color should persist after re-add');
        });

        // ====== ВЗАЄМОДІЯ З SIDEPANEL ======

        await ctx.it('TB-9: позиція стабільна при додаванні SidePanel', async (assert) => {
            await ctx.reset();
            await ConfiguratorAPI.presetProducts([
                { name: 'Sink-Base', Width: 60, Height: 56, Depth: 50.5 }
            ]);

            // Без panels
            await ConfiguratorAPI.setConfigBatch({}, { TowelBar: 'TowelBar40_R' });
            await wait(400);

            const barWithout = assert.findEntity('TowelBar_Left');
            const posXWithout = barWithout.getPosition().x;

            // Додаємо SidePanel
            await ConfiguratorAPI.setConfigBatch({}, { SidePanel: 'UpperG' });
            await wait(400);

            const barWith = assert.findEntity('TowelBar_Left');
            const posXWith = barWith.getPosition().x;

            // Поточна поведінка: позиція TowelBar не змінюється при додаванні SidePanel
            assert.closeTo(posXWith, posXWithout, 0.01, 'TowelBar position should remain stable');
        });

        // ====== ROTATION ======

        await ctx.it('TB-10: left bar має rotation Y=180, right Y=0', async (assert) => {
            await ctx.reset();
            await ConfiguratorAPI.presetProducts([
                { name: 'Sink-Base', Width: 60, Height: 56, Depth: 50.5 }
            ]);

            await ConfiguratorAPI.setConfigBatch({}, { TowelBar: 'TowelBar40_R' });
            // Composition rules async (waitForFrames + aggregator) — збільшений wait
            await wait(800);

            const leftBar = assert.findEntity('TowelBar_Left');
            const rightBar = assert.findEntity('TowelBar_Right');

            assert.closeTo(leftBar.getLocalEulerAngles().y, 180, 1, 'Left bar rotation Y');
            assert.closeTo(rightBar.getLocalEulerAngles().y, 0, 1, 'Right bar rotation Y');
        });

        // ====== HEIGHT ======

        await ctx.it('TB-11: Y позиція стабільна при різних висотах кабінету', async (assert) => {
            await ctx.reset();
            await ConfiguratorAPI.presetProducts([
                { name: 'Sink-Base', Width: 60, Height: 56, Depth: 50.5 }
            ]);
            await ConfiguratorAPI.setConfigBatch({}, { TowelBar: 'TowelBar40_R' });
            await wait(400);

            const posY_56 = assert.findEntity('TowelBar_Left').getPosition().y;

            await ctx.reset();
            await ConfiguratorAPI.presetProducts([
                { name: 'Sink-Base', Width: 60, Height: 50, Depth: 50.5 }
            ]);
            await ConfiguratorAPI.setConfigBatch({}, { TowelBar: 'TowelBar40_R' });
            await wait(400);

            const posY_50 = assert.findEntity('TowelBar_Left').getPosition().y;

            // Y не має змінюватись (висота ручки в mesh)
            assert.closeTo(posY_56, posY_50, 0.02, 'TowelBar Y should be stable across heights');
        });

        // ====== MULTI-CABINET ======

        await ctx.it('TB-12: towel bars з 3 кабінетами', async (assert) => {
            await ctx.reset();
            await ConfiguratorAPI.presetProducts([
                { name: 'Sink-Base', Width: 60, Height: 56, Depth: 50.5 },
                { name: 'Sink-Cabinet', Width: 25, Height: 56, Depth: 50.5 },
                { name: 'Sink-Base', Width: 60, Height: 56, Depth: 50.5 }
            ]);

            await ConfiguratorAPI.setConfigBatch({}, { TowelBar: 'TowelBar40_R' });
            await wait(400);

            assert.entityCount('TowelBar_Left', 1);
            assert.entityCount('TowelBar_Right', 1);

            // Bars на зовнішніх краях композиції
            const leftBar = assert.findEntity('TowelBar_Left');
            const rightBar = assert.findEntity('TowelBar_Right');
            assert.lessThan(leftBar.getPosition().x, rightBar.getPosition().x, 'Left should be left of right');
        });
    });
}
