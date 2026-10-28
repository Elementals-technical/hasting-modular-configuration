import { SceneEntityHelper } from '../../../helpers/scene-entity-helper.mjs';
import { DEFAULT_COUNTERTOP_SUPPORT_GROUP_ID, COUNTERTOP_POSITIONING } from '../countertop-support-resolver.mjs';

const finiteNumberOrNull = (value)=>{
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
};
const readSnapshotValue = (snapshot, key)=>typeof snapshot?.get === 'function' ? snapshot.get(key) : snapshot?.[key];
const boundsExtremeY = (bounds, direction)=>{
    const centerY = finiteNumberOrNull(bounds?.center?.y);
    const halfExtentY = finiteNumberOrNull(bounds?.halfExtents?.y);
    if (centerY === null || halfExtentY === null) return null;
    return centerY + direction * halfExtentY;
};
/**
 * Measure one cabinet's countertop support in world space.
 * Exact product anchors win; only registry-declared mesh names may act as AABB fallbacks.
 */ function measureCabinetCountertopSupport({ entity, snapshot, registry, defaultGroupId = DEFAULT_COUNTERTOP_SUPPORT_GROUP_ID } = {}) {
    const productType = readSnapshotValue(snapshot, 'productType');
    const capability = productType ? registry?.getCountertopSupport?.(productType) : null;
    const groupId = readSnapshotValue(snapshot, 'SupportGroupId') || defaultGroupId;
    if (!entity || !capability || capability.strategy !== COUNTERTOP_POSITIONING.SUPPORT_PLANE) {
        return Object.freeze({
            id: entity?.name || null,
            groupId,
            worldY: null,
            source: 'unsupported-product'
        });
    }
    const anchor = capability.anchorName ? SceneEntityHelper.findByName(entity, capability.anchorName) : null;
    const anchorY = finiteNumberOrNull(anchor?.getPosition?.()?.y);
    if (anchorY !== null) {
        return Object.freeze({
            id: entity.name,
            groupId,
            worldY: anchorY,
            source: 'anchor'
        });
    }
    const fallbackYs = (capability.fallbackMeshNames || []).map((name)=>SceneEntityHelper.findByName(entity, name)).filter(Boolean).map((mesh)=>boundsExtremeY(SceneEntityHelper.traverseAabb(mesh), 1)).filter((value)=>value !== null);
    return Object.freeze({
        id: entity.name,
        groupId,
        worldY: fallbackYs.length > 0 ? Math.max(...fallbackYs) : null,
        source: fallbackYs.length > 0 ? 'verified-mesh-bounds' : 'support-unavailable'
    });
}
/** Measure the countertop's installation plane in world space. */ function measureCountertopMountWorldY({ countertop, registry, productType = 'Top_Solid' } = {}) {
    if (!countertop) return null;
    const mount = registry?.getCountertopMount?.(productType);
    const anchor = mount?.anchorName ? SceneEntityHelper.findByName(countertop, mount.anchorName) : null;
    const anchorY = finiteNumberOrNull(anchor?.getPosition?.()?.y);
    if (anchorY !== null) return anchorY;
    const fallbackMesh = mount?.fallbackMeshName ? SceneEntityHelper.findByName(countertop, mount.fallbackMeshName) : null;
    return fallbackMesh ? boundsExtremeY(SceneEntityHelper.traverseAabb(fallbackMesh), -1) : null;
}
/** Convert a resolved root world-Y to the local Y expected by the composition adapter. */ function resolvedRootWorldYToLocalY(countertop, rootWorldY) {
    const targetWorldY = finiteNumberOrNull(rootWorldY);
    const currentWorldY = finiteNumberOrNull(countertop?.getPosition?.()?.y);
    const currentLocalY = finiteNumberOrNull(countertop?.getLocalPosition?.()?.y);
    if (targetWorldY === null || currentWorldY === null || currentLocalY === null) return null;
    return currentLocalY + targetWorldY - currentWorldY;
}

export { measureCabinetCountertopSupport, measureCountertopMountWorldY, resolvedRootWorldYToLocalY };
