import { planCabinetCoverFootprints } from '../../countertop/cover/cover-policy.mjs';
import { planCoverReconciliation } from '../../countertop/cover/cover-reconcile-plan.mjs';
import { measureTopSolid, findTopSolid, prepareTopSolidGeometry } from '../../countertop/cover/adapters/cover-product-port.mjs';

const finite = (value)=>typeof value === 'number' && Number.isFinite(value);
const positive = (value)=>finite(value) && value > 0;
const name = (value)=>typeof value === 'string' && value.trim().length > 0;
const clone = (value)=>structuredClone(value);
const overlap = (a0, a1, b0, b1)=>Math.min(a1, b1) > Math.max(a0, b0);
const validTolerances = (value)=>value && [
        'contactM',
        'adjacencyM',
        'numericalM'
    ].every((key)=>finite(value[key]) && value[key] >= 0);
const diagnostic = (code, sourceIds = [])=>({
        code,
        sourceIds
    });
const unsupported = (code, sourceIds = [])=>({
        status: 'unsupported',
        diagnostics: [
            diagnostic(code, sourceIds)
        ]
    });
const validBasinTop = (item)=>name(item?.productId) && [
        item.xMinM,
        item.xMaxM,
        item.yBottomM,
        item.zMinM,
        item.zMaxM
    ].every(finite) && item.xMaxM > item.xMinM && item.zMaxM > item.zMinM;
function axisAligned(entity) {
    const data = entity?.getWorldTransform?.()?.data;
    if (!data || data.length !== 16 || !Array.from(data).every(finite)) return false;
    const scale = Math.max(1, Math.abs(data[0]), Math.abs(data[5]), Math.abs(data[10]));
    return data[0] > 0 && data[5] > 0 && data[10] > 0 && [
        1,
        2,
        3,
        4,
        6,
        7,
        8,
        9,
        11
    ].every((index)=>Math.abs(data[index]) <= 1e-6 * scale) && Math.abs(data[15] - 1) <= 1e-6;
}
function normalizeBounds(value) {
    const min = value?.minM ?? value?.min;
    const max = value?.maxM ?? value?.max;
    if (!min || !max || ![
        'x',
        'y',
        'z'
    ].every((axis)=>finite(min[axis]) && finite(max[axis]) && max[axis] > min[axis])) return null;
    return {
        min,
        max
    };
}
/** Only the actual TopSolid render mesh establishes basin-top coverage. */ function measureSCLineBasinTop({ productId, root, measure } = {}) {
    if (!name(productId) || !root || typeof measure !== 'function') return unsupported('BASIN_TOP_MEASUREMENT_REQUIRED', [
        productId
    ].filter(Boolean));
    let mesh;
    try {
        mesh = findTopSolid(root);
    } catch  {
        return unsupported('BASIN_TOP_MESH_UNAVAILABLE', [
            productId
        ]);
    }
    if (!axisAligned(root) || !axisAligned(mesh)) return unsupported('BASIN_TOP_ORIENTATION_UNSUPPORTED', [
        productId
    ]);
    let bounds;
    try {
        bounds = normalizeBounds(measure(mesh));
    } catch  {
        bounds = null;
    }
    if (!bounds) return unsupported('BASIN_TOP_GEOMETRY_PENDING', [
        productId
    ]);
    return {
        status: 'supported',
        basinTop: {
            productId,
            xMinM: bounds.min.x,
            xMaxM: bounds.max.x,
            yBottomM: bounds.min.y,
            zMinM: bounds.min.z,
            zMaxM: bounds.max.z
        },
        diagnostics: []
    };
}
/** Match initial source references to real vertical and horizontal contact. */ function measureSCLineTopSupportCabinetIds({ basinTop, supports, tolerances } = {}) {
    if (!validBasinTop(basinTop) || !Array.isArray(supports) || !validTolerances(tolerances)) return unsupported('TOP_SUPPORT_INPUT_REQUIRED');
    const ids = [];
    for (const item of supports){
        if (!name(item?.cabinetId) || ![
            item.xMinM,
            item.xMaxM,
            item.yTopM,
            item.zMinM,
            item.zMaxM
        ].every(finite) || item.xMaxM <= item.xMinM || item.zMaxM <= item.zMinM) return unsupported('TOP_SUPPORT_GEOMETRY_PENDING');
        if (Math.abs(item.yTopM - basinTop.yBottomM) <= tolerances.contactM && overlap(item.xMinM, item.xMaxM, basinTop.xMinM, basinTop.xMaxM) && overlap(item.zMinM, item.zMaxM, basinTop.zMinM, basinTop.zMaxM)) ids.push(item.cabinetId);
    }
    return {
        status: 'ready',
        cabinetIds: [
            ...new Set(ids)
        ].sort(),
        diagnostics: []
    };
}
/** Transfer measured original left/right overhang to the future Standard support span. */ function planSCLineTopSurface({ originalBasinTop, originalSupports, prospectiveStandardSupports, tolerances } = {}) {
    if (!validBasinTop(originalBasinTop) || !Array.isArray(originalSupports) || !originalSupports.length || !Array.isArray(prospectiveStandardSupports) || !prospectiveStandardSupports.length || !validTolerances(tolerances)) return unsupported('TOP_LAYOUT_INPUT_REQUIRED');
    const valid = (item)=>item && [
            item.xMinM,
            item.xMaxM,
            item.yTopM,
            item.zMinM,
            item.zMaxM
        ].every(finite) && item.xMaxM > item.xMinM && item.zMaxM > item.zMinM;
    if (![
        ...originalSupports,
        ...prospectiveStandardSupports
    ].every(valid)) return unsupported('TOP_SUPPORT_GEOMETRY_PENDING');
    const originalContact = measureSCLineTopSupportCabinetIds({
        basinTop: originalBasinTop,
        supports: originalSupports,
        tolerances
    });
    if (originalContact.status !== 'ready' || !originalContact.cabinetIds.length || originalContact.cabinetIds.length !== new Set(originalSupports.map((item)=>item.cabinetId)).size) return unsupported('TOP_ORIGINAL_SUPPORT_UNRESOLVED');
    if (prospectiveStandardSupports.some((item)=>Math.abs(item.yTopM - originalBasinTop.yBottomM) > tolerances.contactM)) return unsupported('TOP_SUPPORT_PLANE_UNSUPPORTED');
    const xMin = Math.min(...originalSupports.map((item)=>item.xMinM));
    const xMax = Math.max(...originalSupports.map((item)=>item.xMaxM));
    const nextMin = Math.min(...prospectiveStandardSupports.map((item)=>item.xMinM));
    const nextMax = Math.max(...prospectiveStandardSupports.map((item)=>item.xMaxM));
    const basinTop = {
        ...clone(originalBasinTop),
        xMinM: nextMin + originalBasinTop.xMinM - xMin,
        xMaxM: nextMax + originalBasinTop.xMaxM - xMax
    };
    if (!positive(basinTop.xMaxM - basinTop.xMinM)) return unsupported('TOP_LAYOUT_DEGENERATE');
    return {
        status: 'ready',
        basinTop,
        lengthM: basinTop.xMaxM - basinTop.xMinM,
        changed: basinTop.xMinM !== originalBasinTop.xMinM || basinTop.xMaxM !== originalBasinTop.xMaxM,
        diagnostics: []
    };
}
/** Engineering wrapper around the existing contact policy and identity reconciliation. */ function planSCLineCoverSurfaces({ compositionId, revision, supports, basinTops, settings, previous = [] } = {}) {
    if (!name(compositionId) || !Number.isSafeInteger(revision) || revision < 0 || !Array.isArray(supports) || !Array.isArray(basinTops) || !Array.isArray(previous) || typeof settings?.enabled !== 'boolean' || settings.enabled && !validTolerances(settings.tolerances)) return {
        ...unsupported('COVER_SETTINGS_OR_MEASUREMENTS_REQUIRED'),
        segments: [],
        reconciliation: null
    };
    const footprint = planCabinetCoverFootprints({
        version: 1,
        compositionId,
        revision,
        frame: 'world',
        units: 'm',
        profileId: settings.profileId ?? 'ulh-v1',
        settings: {
            enabled: settings.enabled
        },
        tolerances: settings.tolerances ?? {},
        supports,
        basinTops
    });
    if (footprint.status !== 'ready') return {
        status: footprint.status,
        segments: [],
        reconciliation: null,
        diagnostics: footprint.diagnostics
    };
    if (footprint.segments.length && !positive(settings.thicknessM)) return {
        ...unsupported('COVER_THICKNESS_UNRESOLVED'),
        segments: [],
        reconciliation: null
    };
    const segments = footprint.segments.map((segment)=>({
            ...segment,
            thicknessM: settings.thicknessM
        }));
    const reconciliation = planCoverReconciliation({
        previous,
        plan: {
            ...footprint,
            segments
        }
    });
    if (reconciliation.status !== 'ready') return {
        status: reconciliation.status,
        segments: [],
        reconciliation: null,
        diagnostics: [
            diagnostic('COVER_RECONCILIATION_INVALID')
        ]
    };
    return {
        status: 'ready',
        segments,
        reconciliation,
        diagnostics: footprint.diagnostics
    };
}
/** Assign new IDs only after the complete measured plan is ready. */ function materializeSCLineCoverDescriptors({ plan, allocateProductId } = {}) {
    if (plan?.status !== 'ready' || plan.reconciliation?.status !== 'ready' || typeof allocateProductId !== 'function') throw new TypeError('Ready cover plan and product ID allocator required');
    const ids = new Set();
    return plan.reconciliation.next.map((choice)=>{
        const id = choice.productId ?? allocateProductId(choice.segment);
        if (!name(id) || ids.has(id)) throw new Error('Duplicate or invalid Cabinet_Cover product ID');
        ids.add(id);
        const segment = clone(choice.segment);
        return {
            id,
            productType: 'Cabinet_Cover',
            derived: true,
            config: {
                CountertopRole: 'cabinetCover',
                generatedBy: 'cabinet-cover-v1',
                materialId: segment.materialId,
                thicknessM: segment.thicknessM,
                coverSegment: segment
            },
            // A provisional pose. Isolated configure calibrates the real template pivot.
            positionM: {
                x: (segment.xMinM + segment.xMaxM) / 2,
                y: segment.yBottomM,
                z: (segment.zMinM + segment.zMaxM) / 2
            }
        };
    });
}
/** Calibrate a detached real Cabinet_Cover template to its measured prospective segment. */ function configureSCLineCoverRoot({ root, segment, material, measure = measureTopSolid } = {}) {
    if (!root || !segment || !material || typeof measure !== 'function') throw new TypeError('Cover root, segment and material required');
    if (root.parent != null) throw new Error('Cabinet_Cover template must be detached before calibration');
    const meshEntity = findTopSolid(root);
    const slabPath = new Set();
    for(let node = meshEntity; node; node = node.parent)slabPath.add(node);
    const stack = [
        root
    ];
    while(stack.length){
        const node = stack.pop();
        if (node.script) node.script.enabled = false;
        if (!slabPath.has(node)) node.enabled = false;
        stack.push(...node.children ?? []);
    }
    prepareTopSolidGeometry({
        root,
        meshEntity,
        segment,
        measure
    });
    if (meshEntity.render) meshEntity.render.materialAssets = [];
    if (meshEntity.model && 'materialAsset' in meshEntity.model) meshEntity.model.materialAsset = null;
    const refreshMaterial = ()=>{
        const instances = meshEntity.render?.meshInstances ?? meshEntity.model?.meshInstances ?? [];
        if (!instances.length) throw new Error('Cabinet_Cover TopSolid render instances unavailable');
        for (const instance of instances)instance.material = material;
    };
    refreshMaterial();
    const p = root.getPosition();
    return {
        positionM: {
            x: p.x,
            y: p.y,
            z: p.z
        },
        meshEntity,
        refreshMaterial
    };
}

export { configureSCLineCoverRoot, materializeSCLineCoverDescriptors, measureSCLineBasinTop, measureSCLineTopSupportCabinetIds, planSCLineCoverSurfaces, planSCLineTopSurface };
