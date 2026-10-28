import { TestContext } from '../test-runner.mjs';

const wait = TestContext.wait;

function getDimensionState() {
    const dimensionSystem = pc.app.dimensionSystem;
    return {
        dimensionSystem,
        dims: dimensionSystem?._dims || [],
        labels: (dimensionSystem?._dims || []).map((d) => d._labelText),
        heightSegments: (dimensionSystem?._dims || []).filter((d) => d._dimType === 'box:height-segment')
    };
}

function getHeightSegment(label) {
    return getDimensionState().heightSegments.find((segment) => segment._customLabel === label);
}

function getSegmentLineHeight(label) {
    const segment = getHeightSegment(label);
    if (!segment) return 0;
    return Math.abs(segment._endPos.y - segment._startPos.y);
}

function assertHeightSegments(assert, expectedLabels) {
    const { dimensionSystem, labels, heightSegments } = getDimensionState();

    assert.notNull(dimensionSystem, 'DimensionSystem should exist');
    assert.equal(heightSegments.length, expectedLabels.length, 'Should create height segment lines');

    for (const label of expectedLabels) {
        assert.isTrue(labels.includes(label), `Should include manual label ${label}`);
    }

    const cabinetSegment = heightSegments[0];
    const countertopSegment = heightSegments[1];
    const sinkSegment = heightSegments[2] || null;

    assert.greaterThan(cabinetSegment._segmentNodes.length, 0, 'Cabinet segment should be bound to cabinet nodes');
    assert.greaterThan(countertopSegment._segmentNodes.length, 0, 'Countertop segment should be bound to countertop nodes');
    assert.isTrue(
        cabinetSegment._segmentExcludeNodeNames.includes('Sink_Point'),
        'Cabinet segment should ignore Sink_Point subtree'
    );
    assert.isTrue(
        countertopSegment._segmentNodes.some((nodeName) => nodeName.startsWith('Top_Solid')),
        'Countertop segment should resolve Top_Solid node'
    );

    if (sinkSegment) {
        assert.equal(sinkSegment._segmentSource, 'sink', 'Sink/Vessel segment should resolve from Sink_Point');
        assert.greaterThan(sinkSegment._segmentSourceNodes.length, 0, 'Sink/Vessel segment should be bound to cabinet source nodes');
    }

    for (const segment of heightSegments) {
        const lineHeight = Math.abs(segment._endPos.y - segment._startPos.y);
        assert.greaterThan(lineHeight, 0, `Segment ${segment._customLabel} should have positive scene height`);
        assert.equal(segment.labelGap, 0, `Segment ${segment._customLabel} should keep the line visible`);
        assert.equal(segment.labelPosition, 'above', `Segment ${segment._customLabel} should offset label from line`);
        assert.equal(segment._segmentSide, 'camera', `Segment ${segment._customLabel} should follow camera side by default`);
        assert.equal(segment._segmentLinePlacement, 'outside', `Segment ${segment._customLabel} should place line outside by default`);
        assert.equal(segment._segmentLabelPlacement, 'outside', `Segment ${segment._customLabel} should place label outside by default`);
        assert.notNull(segment._labelOffsetDir, `Segment ${segment._customLabel} should resolve screen-aware label offset direction`);
    }
}

/**
 * Тести для Total Dimensions.
 * Покриває ручні labels і розділення висоти на cabinet/countertop сегменти.
 */
export function registerDimensionsTests(runner) {
    runner.suite('Dimensions', async (ctx) => {

        await ctx.it('DIM-1: small cabinet shows separate cabinet and countertop height labels', async (assert) => {
            await ctx.reset();
            const ids = await ConfiguratorAPI.presetProducts([
                { name: 'Sink-Base', Width: 60, Height: 50, Depth: 46, sinkType: 'Vessel_Aquarius' }
            ]);
            await wait(400);

            ConfiguratorAPI.showDimensions({
                box: {
                    nodes: ids,
                    width: { label: '23.6"' },
                    height: { label: '22.4"' },
                    depth: { label: '18.1"' },
                    heightSegments: {
                        cabinet: { label: '22"', color: '#E53935' },
                        countertop: { label: '0.4"', color: '#E53935' },
                        vessel: { label: '5"', color: '#E53935' }
                    }
                },
                labelSettings: { offset: 0.05, labelGap: 'auto', labelPosition: 'center' }
            });
            await wait(100);

            assertHeightSegments(assert, ['22"', '0.4"', '5"']);
            assert.isTrue(
                pc.app.dimensionSystem._boxExcludeNodeNames.includes('Sink_Point'),
                'Total box should ignore Sink_Point subtree'
            );
            ConfiguratorAPI.hideDimensions();
        });

        await ctx.it('DIM-2: large composition keeps manual total and segmented height labels', async (assert) => {
            await ctx.reset();
            const ids = await ConfiguratorAPI.presetProducts([
                { name: 'Sink-Base', Width: 120, Height: 56, Depth: 50.5 },
                { name: 'CabinetUniBox', Width: 120, Height: 56, Depth: 50.5 }
            ]);
            await wait(500);

            ConfiguratorAPI.showDimensions({
                box: {
                    nodes: ids,
                    width: { label: '94.5"' },
                    height: { label: '26"' },
                    depth: { label: '19.9"' },
                    heightSegments: {
                        cabinet: { label: '22"', color: '#E53935' },
                        countertop: { label: '4"', color: '#E53935' },
                        vessel: { label: '5"', color: '#E53935' }
                    }
                },
                labelSettings: { offset: 0.05, labelGap: 'auto', labelPosition: 'center' }
            });
            await wait(100);

            const { dimensionSystem, labels } = getDimensionState();
            assert.isTrue(labels.includes('26"'), 'Should keep manual total height label');
            assert.isTrue(
                dimensionSystem._boxNodes.some((nodeName) => nodeName.startsWith('Top_Solid')),
                'Total box should include global countertop node'
            );

            assertHeightSegments(assert, ['22"', '4"', '5"']);
            ConfiguratorAPI.hideDimensions();
        });

        await ctx.it('DIM-3: height segments react to cabinet Height and countertop Thickness changes', async (assert) => {
            await ctx.reset();
            const ids = await ConfiguratorAPI.presetProducts([
                { name: 'Sink-Base', Width: 60, Height: 56, Depth: 50.5, sinkType: 'Vessel_Aquarius' }
            ]);
            await wait(500);

            ConfiguratorAPI.showDimensions({
                box: {
                    nodes: ids,
                    width: { label: '23.6"' },
                    depth: { label: '19.9"' },
                    heightSegments: {
                        cabinet: { label: '22"', labelPlacement: 'outside' },
                        countertop: { label: '2"', labelPlacement: 'outside' },
                        vessel: { label: '5"', labelPlacement: 'outside' }
                    }
                },
                labelSettings: { offset: 0.05, labelGap: 'auto', labelPosition: 'center' }
            });
            await wait(150);

            const cabinetBefore = getSegmentLineHeight('22"');
            const countertopBefore = getSegmentLineHeight('2"');
            assert.greaterThan(cabinetBefore, 0, 'Cabinet segment should be visible before resize');
            assert.greaterThan(countertopBefore, 0, 'Countertop segment should be visible before resize');

            const heightResult = await ConfiguratorAPI.setConfig(ids[0], { Height: 50 });
            await wait(600);

            const cabinetAfter = getSegmentLineHeight('22"');
            assert.isTrue(heightResult.success, 'Cabinet Height update should succeed');
            assert.lessThan(cabinetAfter, cabinetBefore, 'Cabinet segment should shrink after lowering cabinet height');

            const countertop = pc.app.compositionManager?.getProductEntitiesByCategory('countertops')?.[0];
            assert.notNull(countertop, 'Countertop entity should exist');

            const thicknessResult = await ConfiguratorAPI.setConfig(countertop.name, { Thickness: 4 });
            await wait(700);

            const countertopAfter = getSegmentLineHeight('2"');
            assert.isTrue(thicknessResult.success, 'Countertop Thickness update should succeed');
            assert.greaterThan(countertopAfter, countertopBefore, 'Countertop segment should grow after increasing countertop thickness');

            ConfiguratorAPI.hideDimensions();
        });
    });
}
