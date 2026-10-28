import { BaseCompositionRule } from './base-composition-rule.mjs';

const COUNTERTOP_COLLISION_GEOMETRY_PARAMS = Object.freeze([
    'Width',
    'Depth',
    'Height',
    'Thickness',
    'ShowUndertop',
    'CountertopLengthM',
    'SpatialOffsetM',
    'SidePanel',
    'SidePanelType',
    'SupportGroupId',
    'sinkType',
    'productType',
    'variant',
    'Variant',
    'Boolean',
    'boolean',
    'cutters',
    'mesh',
    'model',
    'enabled'
]);
const GEOMETRY_PARAM_SET = new Set(COUNTERTOP_COLLISION_GEOMETRY_PARAMS);
const isCountertopCollisionGeometryChange = (changes)=>Boolean(changes && typeof changes === 'object' && Object.keys(changes).some((key)=>GEOMETRY_PARAM_SET.has(key)));
/**
 * A queued aggregation returns before SceneAggregator drains it. Release a
 * caller-owned settle only after that drain; never await this helper from the
 * currently executing handler, because that would deadlock the queue.
 */ const releaseSpatialSettleWhenIdle = async ({ aggregator, spatial } = {})=>{
    if (!spatial?.settling) return null;
    const idle = typeof aggregator?.whenIdle === 'function' ? await aggregator.whenIdle() : !aggregator?._isExecuting && !aggregator?._batchMode;
    if (idle === false || !spatial?.settling) return null;
    return spatial.endSettle() ?? null;
};
const scheduleSpatialSettleRelease = (options)=>{
    return Promise.resolve().then(()=>releaseSpatialSettleWhenIdle(options)).catch(()=>null);
};
/**
 * Last project composition rule. Earlier rules own all transforms and mesh
 * rebuilds; this rule only opens the deferred collision refresh after their
 * SidePanels/SmartStretch/Boolean work has settled.
 */ class RuleCountertopCollisionRefresh extends BaseCompositionRule {
    aggregateFn(_compositions, context = {}) {
        return {
            reason: context.structureChanged ? 'composition-structure-settled' : 'composition-geometry-settled'
        };
    }
    async applyFn(result, context) {
        const spatial = context?.app?.compositionManager?.spatial;
        return spatial?.requestRefresh(result?.reason) ?? null;
    }
    constructor(){
        super({
            name: 'CountertopCollisionRefresh',
            watchCompositions: [
                'cabinets',
                'addons',
                'countertops'
            ],
            watchParams: COUNTERTOP_COLLISION_GEOMETRY_PARAMS
        });
    }
}

export { COUNTERTOP_COLLISION_GEOMETRY_PARAMS, RuleCountertopCollisionRefresh, isCountertopCollisionGeometryChange, releaseSpatialSettleWhenIdle, scheduleSpatialSettleRelease };
