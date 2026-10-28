import { SceneEntityHelper } from '../../helpers/scene-entity-helper.mjs';
import { planGroupSidePanels } from './side-panel-group-policy.mjs';
import { sidePanelProfileOf } from './side-panel-profiles.mjs';

function cabinetFootprintIgnoreNodes(registry, snapshot, entityName) {
    const ignoreNodes = registry.getAabbIgnoreNodesByEntity(entityName) || [];
    const sinkMount = registry.getSinkAnchorName?.(snapshot.productType) || registry.getSinkAnchorName?.(entityName);
    return typeof sinkMount === 'string' && sinkMount ? [
        ...ignoreNodes,
        sinkMount
    ] : ignoreNodes;
}
/**
 * Name markers of the boolean cutters in the cabinet templates. A cutter is hidden only while it cuts,
 * so an unused one stays enabled, and several stick out of the cabinet back (archive v72, cabinet space):
 * `*_SBBoolBox` / `UD_Cabinet_BoolBox` (ULH, Tricot, Mako, UD) down to z −0.114 m,
 * `*_Top/Bot_Drawer_BoolB` (Tricot, Class, Lame) down to z −0.079 m.
 * 'BoolB' also matches every `*BoolBox`. Read by cabinetDepthIgnoreNodes (side panels) and RuleTowelBars
 * (`traverseAabb` matches by substring); a new cutter needs no entry while its name contains 'BoolB'.
 */ const BOOLEAN_CUTTER_NODE_MARKERS = Object.freeze([
    'BoolB'
]);
/**
 * AABB ignore nodes of a cabinet's depth (Z) for side panels: the sink under the sink mount and the boolean cutters.
 * Handles and fronts stay in: the panel covers the whole cabinet depth, fronts included.
 * Read by measureGroupSidePanels (group panels) and RuleSidePanels._aggregateCabinetsAabb (legacy panels).
 * @example cabinetDepthIgnoreNodes(registry, { productType: 'Tricot-sink-cabinet' }, id) // → ['Tricot_Sink_Point', 'BoolB']
 * @example cabinetDepthIgnoreNodes(registry, { productType: 'Tricot-side-cabinet' }, id) // → ['BoolB']
 */ function cabinetDepthIgnoreNodes(registry, snapshot, entityName) {
    const sinkMount = registry.getSinkAnchorName?.(snapshot.productType) || registry.getSinkAnchorName?.(entityName);
    const sinkNodes = typeof sinkMount === 'string' && sinkMount ? [
        sinkMount
    ] : [];
    return [
        ...sinkNodes,
        ...BOOLEAN_CUTTER_NODE_MARKERS
    ];
}
/**
 * Cabinet body height in m. The side panel profile knows it (UF: the config Height as is); other cabinets use Height.
 * @example cabinetBodyHeightM(registry, { productType: 'UF-side-cabinet', Handle: 'PTO', Height: 88 }) // → 0.88
 */ function cabinetBodyHeightM(registry, config) {
    const support = registry.getSidePanelSupport?.(config?.productType);
    const profileHeight = sidePanelProfileOf(support?.profile)?.bodyHeightOf(config);
    return (profileHeight ?? Number(config?.Height)) / 100;
}
const boxOf = (bounds)=>bounds ? {
        minM: Object.fromEntries([
            'x',
            'y',
            'z'
        ].map((axis)=>[
                axis,
                bounds.center[axis] - bounds.halfExtents[axis]
            ])),
        maxM: Object.fromEntries([
            'x',
            'y',
            'z'
        ].map((axis)=>[
                axis,
                bounds.center[axis] + bounds.halfExtents[axis]
            ]))
    } : null;
function measureGroupSidePanels({ composition, entities, registry, selection }) {
    const products = composition.getAllProducts();
    const rows = composition.getCabinetRows?.() || [];
    const byId = new Map(entities.map((entity)=>[
            entity.name,
            entity
        ]));
    const cabinets = Object.entries(products).filter(([, config])=>config.category === 'cabinets').flatMap(([id, config])=>{
        const entity = byId.get(id);
        if (!entity) return [
            {
                id,
                config,
                boxM: null
            }
        ];
        if (entity.enabled === false) return []; // Disabled cabinets do not occlude exposed sides.
        entity.syncHierarchy?.();
        const body = boxOf(SceneEntityHelper.traverseAabb(entity, cabinetFootprintIgnoreNodes(registry, config, id)));
        const depth = boxOf(SceneEntityHelper.traverseAabb(entity, cabinetDepthIgnoreNodes(registry, config, id)));
        const bottomM = entity.getPosition().y, heightM = cabinetBodyHeightM(registry, config);
        // Row levels are cabinet pivots. Sink bowls/handles must not change a side's vertical face;
        // the depth keeps fronts and handles but not the sink or the hidden cutters behind the back.
        const boxM = body && depth ? {
            minM: {
                x: body.minM.x,
                y: bottomM,
                z: depth.minM.z
            },
            maxM: {
                x: body.maxM.x,
                y: bottomM + heightM,
                z: depth.maxM.z
            }
        } : null;
        return [
            {
                id,
                config,
                boxM,
                depthBoxM: depth,
                rowId: rows.find((row)=>row.orderedCabinetIds?.includes(id))?.id,
                support: registry.getSidePanelSupport(config.productType)
            }
        ];
    });
    return planGroupSidePanels(cabinets, selection);
}

export { BOOLEAN_CUTTER_NODE_MARKERS, cabinetBodyHeightM, cabinetDepthIgnoreNodes, cabinetFootprintIgnoreNodes, measureGroupSidePanels };
