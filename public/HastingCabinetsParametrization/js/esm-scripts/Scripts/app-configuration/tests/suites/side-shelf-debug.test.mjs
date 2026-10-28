import { app } from '../../../../../playcanvas-stable.min.mjs';
import { TestContext } from '../test-runner.mjs';
import { ProductRegistry_V2 } from '../../domain/product/registry/product-registry-v2.mjs';

const wait = TestContext.wait;
// Handle entities що ігноруються в AABB для layout (з registry)
const AABB_IGNORE = ProductRegistry_V2.instance?.getAabbIgnoreNodes('Sink-Base') || [
    'HandleBotCut_Top',
    'HandleNoCut_Top',
    'HandleTopCut_Top',
    'HandleNoCut_Bot',
    'HandleTopCut_Bot'
];
/**
 * Обчислює AABB gap між двома сусідніми entities (без handle overlays)
 */ function measureGap(entityA, entityB) {
    const getEdgeX = (entity, side)=>{
        entity.syncHierarchy();
        const mis = [];
        entity.findComponents('render').forEach((r)=>mis.push(...r.meshInstances));
        let result = side === 'max' ? -Infinity : Infinity;
        mis.forEach((mi)=>{
            if (!mi.visible) return;
            // Ігноруємо handle entities
            const node = mi.node;
            if (node && AABB_IGNORE.some((name)=>node.name.includes(name))) return;
            const edge = side === 'max' ? mi.aabb.center.x + mi.aabb.halfExtents.x : mi.aabb.center.x - mi.aabb.halfExtents.x;
            result = side === 'max' ? Math.max(result, edge) : Math.min(result, edge);
        });
        return result;
    };
    const aMaxX = getEdgeX(entityA, 'max');
    const bMinX = getEdgeX(entityB, 'min');
    return bMinX - aMaxX;
}
/**
 * Повертає відсортовані кабінети по orderIndex
 */ function getSortedCabinets() {
    const cm = app.compositionManager;
    const cabinets = cm.getProductEntitiesByCategory('cabinets');
    const orderIds = cm.getActiveComposition()?.getOrderProductIds() || {};
    return [
        ...cabinets
    ].sort((a, b)=>(orderIds[a.name] ?? 0) - (orderIds[b.name] ?? 0));
}
function registerSideShelfDebugTests(runner) {
    runner.suite('SideShelf-Debug', async (ctx)=>{
        await ctx.it('SEQ: послідовне додавання — стики без зазорів', async (assert)=>{
            await ctx.reset();
            await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 60,
                    Height: 50,
                    Depth: 50.5,
                    CabinetColor: 'Pulpis Chiaro TKH'
                }
            ]);
            await wait(500);
            await ConfiguratorAPI.addProductByLeft('Side-Shelf', {
                Height: 50,
                Depth: 50.5
            });
            await wait(500);
            await ConfiguratorAPI.addProductByRight('Side-Shelf', {
                Height: 50,
                Depth: 50.5
            });
            await wait(1500);
            const sorted = getSortedCabinets();
            assert.equal(sorted.length, 3, 'Should have 3 cabinets');
            const sinkBase = sorted.find((e)=>e.name.includes('Sink-Base'));
            assert.closeTo(sinkBase.getPosition().x, 0, 0.01, 'Sink-Base at center');
            const leftShelf = sorted.find((e)=>e.name.includes('Side-Shelf') && e.getPosition().x < 0);
            const rightShelf = sorted.find((e)=>e.name.includes('Side-Shelf') && e.getPosition().x > 0);
            if (leftShelf && sinkBase) {
                const gap = measureGap(leftShelf, sinkBase);
                assert.closeTo(gap, 0, 0.02, 'Left gap should be ~0');
            }
            if (sinkBase && rightShelf) {
                const gap = measureGap(sinkBase, rightShelf);
                assert.closeTo(gap, 0, 0.02, 'Right gap should be ~0');
            }
            if (leftShelf) assert.equal(leftShelf.getLocalScale().x, -1, 'Left shelf mirrored');
            if (rightShelf) assert.equal(rightShelf.getLocalScale().x, 1, 'Right shelf not mirrored');
        });
        await ctx.it('NOPAUSE: додавання без пауз', async (assert)=>{
            await ctx.reset();
            await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 60,
                    Height: 50,
                    Depth: 50.5,
                    CabinetColor: 'Pulpis Chiaro TKH'
                }
            ]);
            await ConfiguratorAPI.addProductByLeft('Side-Shelf', {
                Height: 50,
                Depth: 50.5
            });
            await ConfiguratorAPI.addProductByRight('Side-Shelf', {
                Height: 50,
                Depth: 50.5
            });
            await wait(1500);
            const sorted = getSortedCabinets();
            const sinkBase = sorted.find((e)=>e.name.includes('Sink-Base'));
            assert.closeTo(sinkBase.getPosition().x, 0, 0.01, 'Sink-Base at center');
            const leftShelf = sorted.find((e)=>e.name.includes('Side-Shelf') && e.getPosition().x < 0);
            const rightShelf = sorted.find((e)=>e.name.includes('Side-Shelf') && e.getPosition().x > 0);
            if (leftShelf && sinkBase) {
                assert.closeTo(measureGap(leftShelf, sinkBase), 0, 0.02, 'Left gap');
            }
            if (sinkBase && rightShelf) {
                assert.closeTo(measureGap(sinkBase, rightShelf), 0, 0.02, 'Right gap');
            }
        });
        await ctx.it('SINGLE-LEFT: один Side-Shelf зліва', async (assert)=>{
            await ctx.reset();
            await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 60,
                    Height: 50,
                    Depth: 50.5,
                    CabinetColor: 'Pulpis Chiaro TKH'
                }
            ]);
            await wait(300);
            await ConfiguratorAPI.addProductByLeft('Side-Shelf', {
                Height: 50,
                Depth: 50.5
            });
            await wait(1500);
            const sorted = getSortedCabinets();
            assert.equal(sorted.length, 2, 'Should have 2 cabinets');
            assert.closeTo(measureGap(sorted[0], sorted[1]), 0, 0.02, 'Gap should be ~0');
        });
        await ctx.it('SINGLE-RIGHT: один Side-Shelf справа', async (assert)=>{
            await ctx.reset();
            await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 60,
                    Height: 50,
                    Depth: 50.5,
                    CabinetColor: 'Pulpis Chiaro TKH'
                }
            ]);
            await wait(300);
            await ConfiguratorAPI.addProduct('Side-Shelf', {
                Height: 50,
                Depth: 50.5
            });
            await wait(1500);
            const sorted = getSortedCabinets();
            assert.equal(sorted.length, 2, 'Should have 2 cabinets');
            assert.closeTo(measureGap(sorted[0], sorted[1]), 0, 0.02, 'Gap should be ~0');
        });
        await ctx.it('REMOVE: видалення Side-Shelf — стільниця центрується', async (assert)=>{
            await ctx.reset();
            await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 60,
                    Height: 50,
                    Depth: 50.5,
                    CabinetColor: 'Pulpis Chiaro TKH'
                }
            ]);
            await wait(300);
            const shelfId = await ConfiguratorAPI.addProduct('Side-Shelf', {
                Height: 50,
                Depth: 50.5
            });
            await wait(1000);
            ConfiguratorAPI.removeProduct(shelfId);
            await wait(1500);
            const countertop = app.root.find((e)=>e.name.includes('Top_Solid-'))[0];
            if (countertop) {
                assert.closeTo(countertop.getPosition().x, 0, 0.02, 'Countertop should be centered after remove');
            }
            const sinkBase = app.root.find((e)=>e.name.includes('Sink-Base'))[0];
            if (sinkBase) {
                assert.closeTo(sinkBase.getPosition().x, 0, 0.01, 'Sink-Base at center after remove');
            }
        });
        await ctx.it('COMPARE: sequential vs nopause — позиції однакові', async (assert)=>{
            await ctx.reset();
            await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 60,
                    Height: 50,
                    Depth: 50.5,
                    CabinetColor: 'Pulpis Chiaro TKH'
                }
            ]);
            await wait(500);
            await ConfiguratorAPI.addProductByLeft('Side-Shelf', {
                Height: 50,
                Depth: 50.5
            });
            await wait(500);
            await ConfiguratorAPI.addProductByRight('Side-Shelf', {
                Height: 50,
                Depth: 50.5
            });
            await wait(1500);
            const seqX = app.root.find((e)=>e.name.includes('Sink-Base'))[0]?.getPosition().x || 0;
            await ctx.reset();
            await ConfiguratorAPI.presetProducts([
                {
                    name: 'Sink-Base',
                    Width: 60,
                    Height: 50,
                    Depth: 50.5,
                    CabinetColor: 'Pulpis Chiaro TKH'
                }
            ]);
            await ConfiguratorAPI.addProductByLeft('Side-Shelf', {
                Height: 50,
                Depth: 50.5
            });
            await ConfiguratorAPI.addProductByRight('Side-Shelf', {
                Height: 50,
                Depth: 50.5
            });
            await wait(1500);
            const nopX = app.root.find((e)=>e.name.includes('Sink-Base'))[0]?.getPosition().x || 0;
            assert.closeTo(seqX, nopX, 0.01, 'Positions should be identical regardless of timing');
        });
    });
}

export { registerSideShelfDebugTests };
