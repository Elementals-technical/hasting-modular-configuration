import { MaterialService } from '../../../services/material/material-service.mjs';
import { BaseCompositionRule } from './base-composition-rule.mjs';
import { ProductRegistry_V2 } from '../../product/registry/product-registry-v2.mjs';
import { isHostedSinkConfig, COUNTERTOP_SINK_TYPE_KEY } from '../../countertop/countertop-hosted-sink.mjs';
import { resolveCountertopAssembly, isVesselSinkId } from '../../countertop/spatial/countertop-assembly-resolver.mjs';

/**
 * Правило зміни матеріалу умивальника.
 *
 * Застосовує CountertopColor (VesselColor для vessel) до basin_sink мешів кожної раковини з `sinks`
 * resolver-а (шафа з sink mount або стільниця з Countertop_SinkPoint) — без власного пошуку хоста.
 * Цілі — лише в піддереві якоря раковини: раковина — sub-product (`configKey: 'sinkType'` /
 * `CountertopSinkType`), прикріплений саме до цього якоря (`attachPoint` === `sinkMount.anchorName`).
 */ class RuleSlinkMaterial extends BaseCompositionRule {
    /**
     * Агрегує дані про продукти з умивальниками
     */ aggregateFn(compositions) {
        const allProducts = [];
        Object.values(compositions).forEach((comp)=>{
            const products = comp.getAllProducts();
            Object.entries(products).forEach(([id, config])=>{
                allProducts.push({
                    ...config,
                    _productId: id
                });
            });
        });
        const productsWithSinks = allProducts.filter((p)=>p.sinkType || isHostedSinkConfig(p));
        return {
            totalProducts: allProducts.length,
            productsWithSinks,
            compositions
        };
    }
    /**
     * Застосовує матеріал до basin_sink мешів.
     * Для Vessel sinks використовує VesselColor (з fallback на CountertopColor).
     */ async applyFn(result, context) {
        const { shared } = context;
        if (!result.productsWithSinks || result.productsWithSinks.length === 0) return;
        // Лише активна композиція: shared.entities (і так лише її сутності) — саме те, що бачить resolver.
        const registry = ProductRegistry_V2.instance;
        const { sinks } = resolveCountertopAssembly({
            composition: shared?.composition,
            entities: {
                countertops: shared?.entities?.countertops || [],
                cabinets: shared?.entities?.cabinets || []
            },
            getSinkAnchorName: (productType, entityName)=>registry.getSinkAnchorName(productType) || registry.getSinkAnchorName(entityName)
        });
        if (sinks.length === 0) return;
        const configs = new Map(result.productsWithSinks.map((product)=>[
                product._productId,
                product
            ]));
        // Колір per-sink (vessel може мати окремий колір) з конфігу хост-продукту.
        for (const sink of sinks){
            const product = configs.get(sink.host.id);
            const color = product ? this._sinkColor(product, sink) : null;
            if (!color) continue;
            const targets = this._findBasinMaterialTargets(sink.anchor);
            if (targets.length > 0) await MaterialService.applyMaterialByName(color, targets);
        }
    }
    /** Колір раковини з конфігу її хоста: VesselColor (fallback CountertopColor) для vessel, інакше CountertopColor. */ _sinkColor(product, sink) {
        return isVesselSinkId(sink.sinkId) ? product.VesselColor || product.CountertopColor : product.CountertopColor;
    }
    /**
     * Finds basin material targets under a sink anchor.
     *
     * Normal templates mark basin meshes with the `basin_sink` tag. Some imported
     * vessel templates, like Vessel_Aquarius, only place render meshes under
     * the sink mount without copying that tag. In that case we fall back to the
     * active mount child and collect renderable descendants so VesselColor still
     * applies to the visible basin geometry.
     */ _findBasinMaterialTargets(anchor) {
        const taggedEntities = anchor.findByTag('basin_sink').filter((entity)=>!this._isSinkHelperEntity(entity));
        if (taggedEntities.length > 0) return taggedEntities;
        const activeSink = anchor.children?.[0];
        if (!activeSink) return [];
        return this._collectRenderableSinkEntities(activeSink);
    }
    _collectRenderableSinkEntities(root) {
        const targets = [];
        const walk = (entity)=>{
            if (!entity || !entity.enabled) return;
            const hasRenderMeshes = entity.render?.meshInstances?.length > 0;
            const hasModelMeshes = entity.model?.meshInstances?.length > 0;
            if ((hasRenderMeshes || hasModelMeshes) && !this._isSinkHelperEntity(entity)) {
                targets.push(entity);
            }
            entity.children?.forEach(walk);
        };
        walk(root);
        return targets;
    }
    _isSinkHelperEntity(entity) {
        return !!entity?._ssaoLocalMaskProxy || !!entity?.render?._ssaoLocalMaskProxy || !!entity?._ssaoNormalPrepassProxy || !!entity?.render?._ssaoNormalPrepassProxy || /^__ssao_(local_mask|normal_prepass)_proxy__/i.test(entity?.name || '') || /bool|cut|cutter|point|cap/i.test(entity?.name || '');
    }
    constructor(){
        super({
            name: 'SlinkMaterial',
            watchCompositions: [
                'cabinets'
            ],
            watchParams: [
                'sinkType',
                COUNTERTOP_SINK_TYPE_KEY,
                'CountertopColor',
                'VesselColor'
            ]
        });
    }
}

export { RuleSlinkMaterial };
