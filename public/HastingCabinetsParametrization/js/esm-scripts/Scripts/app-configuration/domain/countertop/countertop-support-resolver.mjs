/**
 * Pure policy for choosing and resolving a countertop support plane.
 *
 * Scene traversal stays in the composition rule. This module only consumes measured facts and
 * never mutates PlayCanvas entities, which keeps positioning decisions deterministic and
 * independently testable.
 */ const COUNTERTOP_POSITIONING = Object.freeze({
    LEGACY: 'legacy',
    SUPPORT_PLANE: 'support-plane'
});
const COUNTERTOP_PLACEMENT = Object.freeze({
    SUPPORTED: 'supported',
    INDEPENDENT: 'independent'
});
const DEFAULT_COUNTERTOP_SUPPORT_GROUP_ID = 'group-1';
const finite = (value)=>typeof value === 'number' && Number.isFinite(value);
const finiteNumberOrNull = (value)=>{
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return finite(number) ? number : null;
};
const read = (snapshot, key)=>typeof snapshot?.get === 'function' ? snapshot.get(key) : snapshot?.[key];
// Existing SupportGroupId is also the horizontal/assembly scope in free-layout dev mode.
function selectCountertopSupportGroup(entities, products, countertopId) {
    const group = read(products[countertopId], 'SupportGroupId') || DEFAULT_COUNTERTOP_SUPPORT_GROUP_ID;
    return entities.filter((entity)=>(read(products[entity.name], 'SupportGroupId') || DEFAULT_COUNTERTOP_SUPPORT_GROUP_ID) === group);
}
/**
 * Resolve the composition-level strategy from explicit product metadata.
 * A mixed or incomplete set deliberately falls back to legacy; entity names are never used as
 * product capabilities.
 */ function resolveCountertopPositioningProfile({ cabinets = [], getProductConfig } = {}) {
    if (cabinets.length === 0 || typeof getProductConfig !== 'function') {
        return Object.freeze({
            strategy: COUNTERTOP_POSITIONING.LEGACY,
            compatible: false,
            reason: 'profile-unavailable'
        });
    }
    const strategies = cabinets.map((snapshot)=>{
        const productType = read(snapshot, 'productType');
        return productType ? getProductConfig(productType)?.countertopSupport?.strategy ?? null : null;
    });
    const first = strategies[0];
    const compatible = Boolean(first) && strategies.every((strategy)=>strategy === first);
    return Object.freeze({
        strategy: compatible ? first : COUNTERTOP_POSITIONING.LEGACY,
        compatible,
        reason: compatible ? 'compatible-profile' : 'mixed-or-unsupported-profile'
    });
}
/**
 * Resolve the root world-Y which aligns a countertop mount plane to coplanar cabinet supports.
 *
 * @param {object} input
 * @param {'legacy'|'support-plane'} input.positioning
 * @param {'supported'|'independent'} input.placement
 * @param {number} input.currentRootWorldY
 * @param {number} input.mountWorldY
 * @param {{ id?: string, worldY: number }[]} input.supports
 * @param {number} [input.toleranceM=0.001]
 */ function resolveCountertopSupportBase(input = {}) {
    const positioning = input.positioning ?? COUNTERTOP_POSITIONING.LEGACY;
    const placement = input.placement ?? COUNTERTOP_PLACEMENT.SUPPORTED;
    const currentRootWorldY = finiteNumberOrNull(input.currentRootWorldY);
    if (positioning !== COUNTERTOP_POSITIONING.SUPPORT_PLANE) {
        return result('passthrough', 'legacy-positioning', currentRootWorldY);
    }
    if (placement === COUNTERTOP_PLACEMENT.INDEPENDENT) {
        return result('passthrough', 'independent-placement', currentRootWorldY);
    }
    if (placement !== COUNTERTOP_PLACEMENT.SUPPORTED) {
        return result('unresolved', 'unsupported-placement', currentRootWorldY);
    }
    const mountWorldY = finiteNumberOrNull(input.mountWorldY);
    if (!finite(currentRootWorldY) || !finite(mountWorldY)) {
        return result('unresolved', 'mount-plane-unavailable', currentRootWorldY);
    }
    const supports = Array.isArray(input.supports) ? input.supports : [];
    const supportYs = supports.map((support)=>finiteNumberOrNull(support?.worldY));
    if (supportYs.length === 0 || supportYs.some((value)=>!finite(value))) {
        return result('unresolved', 'support-plane-unavailable', currentRootWorldY);
    }
    const minY = Math.min(...supportYs);
    const maxY = Math.max(...supportYs);
    const parsedToleranceM = finiteNumberOrNull(input.toleranceM);
    const toleranceM = parsedToleranceM !== null ? Math.max(0, parsedToleranceM) : 0.001;
    if (maxY - minY > toleranceM) {
        return Object.freeze({
            ...result('unresolved', 'non-coplanar-supports', currentRootWorldY),
            minSupportWorldY: minY,
            maxSupportWorldY: maxY
        });
    }
    const supportWorldY = supportYs.reduce((sum, value)=>sum + value, 0) / supportYs.length;
    const mountOffsetFromRootM = mountWorldY - currentRootWorldY;
    return Object.freeze({
        status: 'resolved',
        reason: 'support-plane-resolved',
        rootWorldY: supportWorldY - mountOffsetFromRootM,
        supportWorldY,
        mountOffsetFromRootM
    });
}
function result(status, reason, rootWorldY) {
    return Object.freeze({
        status,
        reason,
        rootWorldY: finite(rootWorldY) ? rootWorldY : null
    });
}

export { COUNTERTOP_PLACEMENT, COUNTERTOP_POSITIONING, DEFAULT_COUNTERTOP_SUPPORT_GROUP_ID, resolveCountertopPositioningProfile, resolveCountertopSupportBase, selectCountertopSupportGroup };
