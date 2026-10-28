import { TestContext } from '../test-runner.mjs';

const wait = TestContext.wait;

/**
 * Helper: перевіряє чи drawer має occupied dividers в store
 */
function hasOccupiedDividers(cabinetId, drawerType) {
    const cm = pc.app.compositionManager;
    const config = cm?.getActiveComposition()?.getProduct(cabinetId);
    if (!config) return false;

    const dividerKey = drawerType === 'Bot' ? 'BotDrawerDividers' : 'TopDrawerDividers';
    const dividers = config[dividerKey];
    if (!dividers?.zones) return false;

    for (const zone of Object.values(dividers.zones)) {
        if (zone.slots?.some(s => s.other?.type === 'occupied')) return true;
    }
    return false;
}

/**
 * Helper: знаходить перший ghost слот для drawer
 */
function findFirstGhostSlot(cabinetId, drawerType) {
    const cm = pc.app.compositionManager;
    const config = cm?.getActiveComposition()?.getProduct(cabinetId);
    if (!config) return null;

    const dividerKey = drawerType === 'Bot' ? 'BotDrawerDividers' : 'TopDrawerDividers';
    const dividers = config[dividerKey];
    if (!dividers?.zones) return null;

    for (const [zoneName, zone] of Object.entries(dividers.zones)) {
        const ghost = zone.slots?.find(s => s.other?.type === 'ghost');
        if (ghost) return { key: ghost.key, zone: zoneName };
    }
    return null;
}

/**
 * Helper: рахує divider indicator іконки на сторінці
 */
function countIndicators() {
    return document.querySelectorAll('.divider-indicator').length;
}

/**
 * Helper: знаходить open widget для конкретного drawer (містить indicator якщо є dividers)
 */
function findOpenWidgetForDrawer(cabinetId, drawerType) {
    const groupId = `${cabinetId}_${drawerType}`;
    const widgets = pc.app.drawerOverlaySystem?._widgets || [];
    return widgets.find(w => w.data?.type === 'open' && w.data?.groupId === groupId);
}

/**
 * Helper: перевіряє чи drawer має indicator іконку (✓)
 */
function findIndicatorForDrawer(cabinetId, drawerType) {
    const widget = findOpenWidgetForDrawer(cabinetId, drawerType);
    if (!widget) return null;

    // Indicator є в widget.data і в DOM
    if (!widget.data?.hasOccupiedDividers) return null;

    // Перевіряємо DOM елемент
    const indicatorEl = widget.element?.querySelector('.divider-indicator');
    if (!indicatorEl) return null;

    return widget;
}

export function registerDrawerIndicatorTests(runner) {
    runner.suite('DrawerIndicator', async (ctx) => {

        // ====== SINK-BASE ======

        await ctx.it('DDI-1: Sink-Base порожній — без іконки', async (assert) => {
            await ctx.reset();
            const ids = await ConfiguratorAPI.presetProducts([
                { name: 'Sink-Base', Width: 60, Height: 56, Depth: 50.5, CabinetColor: 'Pulpis Chiaro TKH', sinkType: 'Top_HPLPrisma' }
            ]);
            await wait(500);

            ConfiguratorAPI.setVisibleDrawerButtons(true);
            await wait(300);

            assert.isFalse(hasOccupiedDividers(ids[0], 'Top'), 'Top should have no dividers');
            assert.isFalse(hasOccupiedDividers(ids[0], 'Bot'), 'Bot should have no dividers');
            assert.equal(countIndicators(), 0, 'No indicators should be visible');
        });

        await ctx.it('DDI-2: Sink-Base Bot з divider — іконка на Bot', async (assert) => {
            await ctx.reset();
            const ids = await ConfiguratorAPI.presetProducts([
                { name: 'Sink-Base', Width: 60, Height: 56, Depth: 50.5, CabinetColor: 'Pulpis Chiaro TKH', sinkType: 'Top_HPLPrisma' }
            ]);
            await wait(500);

            // Додаємо divider в Bot
            const ghost = findFirstGhostSlot(ids[0], 'Bot');
            assert.notNull(ghost, 'Should find ghost slot');

            await ConfiguratorAPI.dividers.placeDividerToSlot({
                cabinetId: ids[0], drawerType: 'Bot', key: ghost.key, zone: ghost.zone
            }, 'A');
            await wait(500);

            ConfiguratorAPI.setVisibleDrawerButtons(true);
            await wait(300);

            assert.isTrue(hasOccupiedDividers(ids[0], 'Bot'), 'Bot should have dividers');
            assert.isFalse(hasOccupiedDividers(ids[0], 'Top'), 'Top should have no dividers');

            // Indicator для Bot має існувати
            const botIndicator = findIndicatorForDrawer(ids[0], 'Bot');
            assert.notNull(botIndicator, 'Bot indicator should exist');

            // Indicator для Top не має існувати
            const topIndicator = findIndicatorForDrawer(ids[0], 'Top');
            assert.isNull(topIndicator, 'Top indicator should not exist');
        });

        await ctx.it('DDI-3: Sink-Base Top з divider — іконка на Top', async (assert) => {
            await ctx.reset();
            const ids = await ConfiguratorAPI.presetProducts([
                { name: 'Sink-Base', Width: 60, Height: 56, Depth: 50.5, CabinetColor: 'Pulpis Chiaro TKH', sinkType: 'Top_HPLPrisma' }
            ]);
            await wait(500);

            const ghost = findFirstGhostSlot(ids[0], 'Top');
            if (!ghost) return; // Skip якщо немає ghost слотів

            await ConfiguratorAPI.dividers.placeDividerToSlot({
                cabinetId: ids[0], drawerType: 'Top', key: ghost.key, zone: ghost.zone
            }, 'A');
            await wait(500);

            ConfiguratorAPI.setVisibleDrawerButtons(true);
            await wait(300);

            assert.isTrue(hasOccupiedDividers(ids[0], 'Top'), 'Top should have dividers');

            const topIndicator = findIndicatorForDrawer(ids[0], 'Top');
            assert.notNull(topIndicator, 'Top indicator should exist');
        });

        await ctx.it('DDI-4: Sink-Base обидва drawer з dividers — обидві іконки', async (assert) => {
            await ctx.reset();
            const ids = await ConfiguratorAPI.presetProducts([
                { name: 'Sink-Base', Width: 60, Height: 56, Depth: 50.5, CabinetColor: 'Pulpis Chiaro TKH', sinkType: 'Top_HPLPrisma' }
            ]);
            await wait(500);

            // Bot divider
            const ghostBot = findFirstGhostSlot(ids[0], 'Bot');
            if (ghostBot) {
                await ConfiguratorAPI.dividers.placeDividerToSlot({
                    cabinetId: ids[0], drawerType: 'Bot', key: ghostBot.key, zone: ghostBot.zone
                }, 'A');
                await wait(300);
            }

            // Top divider
            const ghostTop = findFirstGhostSlot(ids[0], 'Top');
            if (ghostTop) {
                await ConfiguratorAPI.dividers.placeDividerToSlot({
                    cabinetId: ids[0], drawerType: 'Top', key: ghostTop.key, zone: ghostTop.zone
                }, 'A');
                await wait(300);
            }

            ConfiguratorAPI.setVisibleDrawerButtons(true);
            await wait(300);

            if (ghostBot) {
                assert.notNull(findIndicatorForDrawer(ids[0], 'Bot'), 'Bot indicator');
            }
            if (ghostTop) {
                assert.notNull(findIndicatorForDrawer(ids[0], 'Top'), 'Top indicator');
            }
        });

        // ====== SINK-CABINET (TopFull) ======

        await ctx.it('DDI-5: Sink-Cabinet порожній — без іконки', async (assert) => {
            await ctx.reset();
            const ids = await ConfiguratorAPI.presetProducts([
                { name: 'Sink-Cabinet', Width: 60, Height: 56, Depth: 50.5, CabinetColor: 'Pulpis Chiaro TKH' }
            ]);
            await wait(500);

            ConfiguratorAPI.setVisibleDrawerButtons(true);
            await wait(300);

            assert.isFalse(hasOccupiedDividers(ids[0], 'TopFull'), 'TopFull should have no dividers');
            assert.isFalse(hasOccupiedDividers(ids[0], 'Bot'), 'Bot should have no dividers');
            assert.equal(countIndicators(), 0, 'No indicators');
        });

        await ctx.it('DDI-6: Sink-Cabinet Bot з divider — іконка', async (assert) => {
            await ctx.reset();
            const ids = await ConfiguratorAPI.presetProducts([
                { name: 'Sink-Cabinet', Width: 60, Height: 56, Depth: 50.5, CabinetColor: 'Pulpis Chiaro TKH' }
            ]);
            await wait(500);

            const ghost = findFirstGhostSlot(ids[0], 'Bot');
            assert.notNull(ghost, 'Should find ghost slot');

            await ConfiguratorAPI.dividers.placeDividerToSlot({
                cabinetId: ids[0], drawerType: 'Bot', key: ghost.key, zone: ghost.zone
            }, 'A');
            await wait(500);

            ConfiguratorAPI.setVisibleDrawerButtons(true);
            await wait(300);

            assert.notNull(findIndicatorForDrawer(ids[0], 'Bot'), 'Bot indicator should exist');
        });

        await ctx.it('DDI-7: Sink-Cabinet TopFull з divider — іконка', async (assert) => {
            await ctx.reset();
            const ids = await ConfiguratorAPI.presetProducts([
                { name: 'Sink-Cabinet', Width: 60, Height: 56, Depth: 50.5, CabinetColor: 'Pulpis Chiaro TKH' }
            ]);
            await wait(500);

            // TopFull використовує TopDrawerDividers але zone 'main'
            const ghost = findFirstGhostSlot(ids[0], 'TopFull');
            if (!ghost) return;

            await ConfiguratorAPI.dividers.placeDividerToSlot({
                cabinetId: ids[0], drawerType: 'TopFull', key: ghost.key, zone: ghost.zone
            }, 'A');
            await wait(500);

            ConfiguratorAPI.setVisibleDrawerButtons(true);
            await wait(300);

            // TopFull maps to TopDrawer_Point → type from config
            const config = ConfiguratorAPI.getConfig(ids[0]);
            const type = config?.topDrawerType || 'TopFull';
            assert.notNull(findIndicatorForDrawer(ids[0], type), 'TopFull indicator should exist');
        });

        // ====== MULTI-CABINET ======

        await ctx.it('DDI-8: два кабінети — незалежні іконки', async (assert) => {
            await ctx.reset();
            const ids = await ConfiguratorAPI.presetProducts([
                { name: 'Sink-Base', Width: 60, Height: 56, Depth: 50.5, CabinetColor: 'Pulpis Chiaro TKH', sinkType: 'Top_HPLPrisma' },
                { name: 'Sink-Cabinet', Width: 60, Height: 56, Depth: 50.5, CabinetColor: 'Pulpis Chiaro TKH' }
            ]);
            await wait(500);

            // Divider тільки в першому кабінеті
            const ghost = findFirstGhostSlot(ids[0], 'Bot');
            if (ghost) {
                await ConfiguratorAPI.dividers.placeDividerToSlot({
                    cabinetId: ids[0], drawerType: 'Bot', key: ghost.key, zone: ghost.zone
                }, 'A');
                await wait(500);
            }

            ConfiguratorAPI.setVisibleDrawerButtons(true);
            await wait(300);

            assert.isTrue(hasOccupiedDividers(ids[0], 'Bot'), 'First cabinet Bot has dividers');
            assert.isFalse(hasOccupiedDividers(ids[1], 'Bot'), 'Second cabinet Bot empty');

            assert.notNull(findIndicatorForDrawer(ids[0], 'Bot'), 'First cabinet indicator');
            assert.isNull(findIndicatorForDrawer(ids[1], 'Bot'), 'Second cabinet no indicator');
        });

        // ====== EDIT MODE ======

        await ctx.it('DDI-9: edit mode — іконка ховається', async (assert) => {
            await ctx.reset();
            const ids = await ConfiguratorAPI.presetProducts([
                { name: 'Sink-Base', Width: 60, Height: 56, Depth: 50.5, CabinetColor: 'Pulpis Chiaro TKH', sinkType: 'Top_HPLPrisma' }
            ]);
            await wait(500);

            const ghost = findFirstGhostSlot(ids[0], 'Bot');
            if (ghost) {
                await ConfiguratorAPI.dividers.placeDividerToSlot({
                    cabinetId: ids[0], drawerType: 'Bot', key: ghost.key, zone: ghost.zone
                }, 'A');
                await wait(500);
            }

            ConfiguratorAPI.setVisibleDrawerButtons(true);
            await wait(300);

            // Indicator видимий
            const indicator = findIndicatorForDrawer(ids[0], 'Bot');
            assert.notNull(indicator, 'Indicator before edit mode');
            assert.isTrue(indicator?.visible !== false, 'Should be visible');

            // Enter edit mode
            ConfiguratorAPI.showTopView(ids[0], 'Bot');
            await wait(500);

            // Indicator має бути прихований
            const indicatorAfter = findIndicatorForDrawer(ids[0], 'Bot');
            if (indicatorAfter) {
                assert.isFalse(indicatorAfter.visible, 'Should be hidden in edit mode');
            }

            ConfiguratorAPI.exitTopView();
            await wait(500);
        });

        // ====== DIVIDER DATA ======

        await ctx.it('DDI-10: widget data містить divider info', async (assert) => {
            await ctx.reset();
            const ids = await ConfiguratorAPI.presetProducts([
                { name: 'Sink-Base', Width: 60, Height: 56, Depth: 50.5, CabinetColor: 'Pulpis Chiaro TKH', sinkType: 'Top_HPLPrisma' }
            ]);
            await wait(500);

            // Додаємо 2 dividers різних типів
            const config = ConfiguratorAPI.getConfig(ids[0]);
            const slots = config?.BotDrawerDividers?.zones?.main?.slots?.filter(s => s.other?.type === 'ghost') || [];

            assert.greaterThan(slots.length, 1, 'Should have at least 2 ghost slots');

            await ConfiguratorAPI.dividers.placeDividerToSlot({
                cabinetId: ids[0], drawerType: 'Bot', key: slots[0].key, zone: 'main'
            }, 'A');
            await wait(300);

            await ConfiguratorAPI.dividers.placeDividerToSlot({
                cabinetId: ids[0], drawerType: 'Bot', key: slots[1].key, zone: 'main'
            }, 'B');
            await wait(500);

            ConfiguratorAPI.setVisibleDrawerButtons(true);
            await wait(300);

            const indicator = findIndicatorForDrawer(ids[0], 'Bot');
            assert.notNull(indicator, 'Indicator should exist');
            assert.isTrue(indicator.data.hasOccupiedDividers === true, 'hasOccupiedDividers should be true');
            assert.equal(indicator.data.dividerCount, 2, 'dividerCount should be 2');
            assert.isTrue(Array.isArray(indicator.data.dividerTypes), 'dividerTypes should be array');
            assert.isTrue(indicator.data.dividerTypes.includes('A'), 'Should contain type A');
            assert.isTrue(indicator.data.dividerTypes.includes('B'), 'Should contain type B');
        });

        // ====== RESIZE ======

        await ctx.it('DDI-11: resize зберігає іконку', async (assert) => {
            await ctx.reset();
            const ids = await ConfiguratorAPI.presetProducts([
                { name: 'Sink-Base', Width: 60, Height: 56, Depth: 50.5, CabinetColor: 'Pulpis Chiaro TKH' }
            ]);
            await wait(500);

            const ghost = findFirstGhostSlot(ids[0], 'Bot');
            if (ghost) {
                await ConfiguratorAPI.dividers.placeDividerToSlot({
                    cabinetId: ids[0], drawerType: 'Bot', key: ghost.key, zone: ghost.zone
                }, 'A');
                await wait(500);
            }

            // Resize
            await ConfiguratorAPI.setConfig(ids[0], { Width: 90 });
            await wait(800);

            ConfiguratorAPI.setVisibleDrawerButtons(true);
            await wait(300);

            assert.isTrue(hasOccupiedDividers(ids[0], 'Bot'), 'Dividers should persist after resize');
            assert.notNull(findIndicatorForDrawer(ids[0], 'Bot'), 'Indicator should persist');
        });

        // ====== CALLBACK RENDERER ======

        await ctx.it('DDI-12: onDrawerWidgetRender — callback отримує drawerInfo', async (assert) => {
            await ctx.reset();

            const receivedCalls = [];

            // Встановлюємо кастомний renderer
            ConfiguratorAPI.onDrawerWidgetRender((drawerInfo, parentEl) => {
                receivedCalls.push(drawerInfo);

                // Фронтенд рендерить свій DOM
                parentEl.innerHTML = `
                    <div class="custom-indicator" data-cabinet="${drawerInfo.cabinetId}" data-drawer="${drawerInfo.drawerType}">
                        ${drawerInfo.hasOccupiedDividers ? '✓' : ''}
                    </div>
                    <button class="custom-open-btn">My Open</button>
                `;

                parentEl.querySelector('.custom-open-btn')?.addEventListener('click', () => {
                    ConfiguratorAPI.showTopView(drawerInfo.cabinetId, drawerInfo.drawerType);
                });
            });

            const ids = await ConfiguratorAPI.presetProducts([
                { name: 'Sink-Base', Width: 60, Height: 56, Depth: 50.5, CabinetColor: 'Pulpis Chiaro TKH', sinkType: 'Top_HPLPrisma' }
            ]);
            await wait(500);

            ConfiguratorAPI.setVisibleDrawerButtons(true);
            await wait(300);

            // Callback має бути викликаний для кожного drawer (Top + Bot)
            assert.greaterThan(receivedCalls.length, 0, 'Callback should be called');

            // Перевіряємо структуру drawerInfo
            const firstCall = receivedCalls[0];
            assert.notNull(firstCall.cabinetId, 'drawerInfo.cabinetId');
            assert.notNull(firstCall.drawerType, 'drawerInfo.drawerType');
            assert.isTrue('hasOccupiedDividers' in firstCall, 'drawerInfo.hasOccupiedDividers exists');
            assert.isTrue('dividerCount' in firstCall, 'drawerInfo.dividerCount exists');
            assert.isTrue('dividerTypes' in firstCall, 'drawerInfo.dividerTypes exists');

            // Перевіряємо що кастомний DOM створився
            const customBtns = document.querySelectorAll('.custom-open-btn');
            assert.greaterThan(customBtns.length, 0, 'Custom DOM should be rendered');

            // Скидаємо renderer
            ConfiguratorAPI.onDrawerWidgetRender(null);
        });

        await ctx.it('DDI-13: onDrawerWidgetRender — з dividers передає коректні дані', async (assert) => {
            await ctx.reset();

            let capturedInfo = null;

            ConfiguratorAPI.onDrawerWidgetRender((drawerInfo, parentEl) => {
                if (drawerInfo.drawerType === 'Bot' && drawerInfo.hasOccupiedDividers) {
                    capturedInfo = drawerInfo;
                }
                // Мінімальний рендер
                parentEl.innerHTML = `<button class="custom-btn">Open</button>`;
            });

            const ids = await ConfiguratorAPI.presetProducts([
                { name: 'Sink-Base', Width: 60, Height: 56, Depth: 50.5, CabinetColor: 'Pulpis Chiaro TKH' }
            ]);
            await wait(500);

            // Додаємо divider
            const ghost = findFirstGhostSlot(ids[0], 'Bot');
            if (ghost) {
                await ConfiguratorAPI.dividers.placeDividerToSlot({
                    cabinetId: ids[0], drawerType: 'Bot', key: ghost.key, zone: ghost.zone
                }, 'A');
                await wait(500);
            }

            ConfiguratorAPI.setVisibleDrawerButtons(true);
            await wait(300);

            assert.notNull(capturedInfo, 'Should capture Bot drawer with dividers');
            assert.isTrue(capturedInfo.hasOccupiedDividers, 'hasOccupiedDividers should be true');
            assert.equal(capturedInfo.dividerCount, 1, 'dividerCount should be 1');
            assert.isTrue(capturedInfo.dividerTypes.includes('A'), 'Should contain type A');

            ConfiguratorAPI.onDrawerWidgetRender(null);
        });

        await ctx.it('DDI-14: 3 кабінети — всі drawer заповнені dividers', async (assert) => {
            await ctx.reset();

            const ids = await ConfiguratorAPI.presetProducts([
                { name: 'Sink-Base', Width: 60, Height: 56, Depth: 50.5, CabinetColor: 'Pulpis Chiaro TKH', sinkType: 'Top_HPLPrisma' },
                { name: 'Sink-Cabinet', Width: 60, Height: 56, Depth: 50.5, CabinetColor: 'Pulpis Chiaro TKH' },
                { name: 'Sink-Base', Width: 90, Height: 56, Depth: 50.5, CabinetColor: 'Pulpis Chiaro TKH', sinkType: 'Top_HPLPrisma' }
            ]);
            await wait(800);

            // Заповнюємо ВСІ drawer кожного кабінету
            for (const cabinetId of ids) {
                const config = ConfiguratorAPI.getConfig(cabinetId);
                if (!config) continue;

                // Bot drawer
                const botSlots = config.BotDrawerDividers?.zones?.main?.slots?.filter(s => s.other?.type === 'ghost') || [];
                for (const slot of botSlots) {
                    const types = slot.other?.availableTypes || ['A'];
                    await ConfiguratorAPI.dividers.placeDividerToSlot({
                        cabinetId, drawerType: 'Bot', key: slot.key, zone: 'main'
                    }, types[0]);
                    await wait(200);
                }

                // Top drawer (siphon zones для Sink-Base, main для Sink-Cabinet)
                const topType = config.topDrawerType || 'Top';
                const topDividers = config.TopDrawerDividers;
                if (topDividers?.zones) {
                    for (const [zoneName, zone] of Object.entries(topDividers.zones)) {
                        const ghostSlots = zone.slots?.filter(s => s.other?.type === 'ghost') || [];
                        for (const slot of ghostSlots) {
                            const types = slot.other?.availableTypes || ['A'];
                            await ConfiguratorAPI.dividers.placeDividerToSlot({
                                cabinetId, drawerType: topType, key: slot.key, zone: zoneName
                            }, types[0]);
                            await wait(200);
                        }
                    }
                }
            }

            await wait(500);
            ConfiguratorAPI.setVisibleDrawerButtons(true);
            await wait(500);

            // Перевіряємо кожен кабінет
            for (const cabinetId of ids) {
                const config = ConfiguratorAPI.getConfig(cabinetId);
                const topType = config?.topDrawerType || 'Top';

                // Bot має dividers
                assert.isTrue(hasOccupiedDividers(cabinetId, 'Bot'), `${cabinetId} Bot should have dividers`);
                const botWidget = findIndicatorForDrawer(cabinetId, 'Bot');
                assert.notNull(botWidget, `${cabinetId} Bot indicator`);

                // Top/TopFull має dividers
                assert.isTrue(hasOccupiedDividers(cabinetId, topType), `${cabinetId} ${topType} should have dividers`);
                const topWidget = findIndicatorForDrawer(cabinetId, topType);
                assert.notNull(topWidget, `${cabinetId} ${topType} indicator`);

                // Перевіряємо data
                if (botWidget) {
                    assert.greaterThan(botWidget.data.dividerCount, 0, `${cabinetId} Bot dividerCount > 0`);
                }
                if (topWidget) {
                    assert.greaterThan(topWidget.data.dividerCount, 0, `${cabinetId} ${topType} dividerCount > 0`);
                }
            }

            // Загальна кількість indicators
            const allWidgets = pc.app.drawerOverlaySystem?._widgets || [];
            const indicators = allWidgets.filter(w => w.data?.hasOccupiedDividers === true);
            assert.equal(indicators.length, 6, 'Should have 6 indicators (3 cabinets × 2 drawers)');
        });

        await ctx.it('DDI-16: onDrawerWidgetRender(null) — повертає дефолтний рендер', async (assert) => {
            await ctx.reset();

            // Спочатку кастомний
            ConfiguratorAPI.onDrawerWidgetRender((info, el) => {
                el.innerHTML = '<div class="custom-test-marker">custom</div>';
            });

            const ids = await ConfiguratorAPI.presetProducts([
                { name: 'Sink-Base', Width: 60, Height: 56, Depth: 50.5, CabinetColor: 'Pulpis Chiaro TKH' }
            ]);
            await wait(500);
            ConfiguratorAPI.setVisibleDrawerButtons(true);
            await wait(300);

            assert.greaterThan(document.querySelectorAll('.custom-test-marker').length, 0, 'Custom render active');

            // Скидаємо на дефолтний
            ConfiguratorAPI.onDrawerWidgetRender(null);
            await wait(300);

            // Після rescan — дефолтні кнопки
            assert.equal(document.querySelectorAll('.custom-test-marker').length, 0, 'Custom render removed');

            const defaultBtns = document.querySelectorAll('.divider-open');
            assert.greaterThan(defaultBtns.length, 0, 'Default buttons restored');
        });
    });
}
