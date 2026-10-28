import { resolveUlHEligibility } from '../profiles/ulh-cover-profile.mjs';
import { coverCompatibilityKey } from '../../countertop-collections.mjs';

const SUPPORT_PLANE_STRATEGY = 'support-plane';
const ORIENTATION_TOLERANCE = 1e-6;

const read = (snapshot, key) => (
    typeof snapshot?.get === 'function' ? snapshot.get(key) : snapshot?.[key]
);

const finiteNumber = value => typeof value === 'number' && Number.isFinite(value);
const materialName = value => {
    const normalized = typeof value === 'string' ? value.trim() : '';
    return normalized && normalized !== 'None' ? normalized : null;
};
const finitePoint = point => Boolean(
    point && ['x', 'y', 'z'].every(axis => finiteNumber(point[axis]))
);

const collectNamed = (root, name) => {
    const output = [];
    const stack = root ? [root] : [];
    const seen = new Set();

    while (stack.length > 0) {
        const current = stack.pop();
        if (!current || seen.has(current)) continue;
        seen.add(current);
        if (current.name === name) output.push(current);
        const children = Array.isArray(current.children) ? current.children : [];
        for (let index = children.length - 1; index >= 0; index -= 1) {
            stack.push(children[index]);
        }
    }

    return output;
};

const worldMatrix = entity => {
    let transform;
    try {
        transform = entity?.getWorldTransform?.() ?? entity?.worldTransform;
    } catch {
        return null;
    }
    const data = transform?.data;
    if (!data || data.length !== 16) return null;
    const values = Array.from(data);
    return values.every(finiteNumber) ? values : null;
};

// PlayCanvas matrices are column-major. Positive scale and translation are
// supported, while cumulative rotation, shear, mirroring and perspective fail
// closed because the cover planner consumes world-axis-aligned rectangles.
const hasUnrotatedWorldOrientation = entity => {
    const values = worldMatrix(entity);
    if (!values) return false;
    const diagonal = [values[0], values[5], values[10]];
    if (diagonal.some(value => value <= ORIENTATION_TOLERANCE)) return false;
    const scale = Math.max(1, ...diagonal.map(Math.abs));
    const nearZero = value => Math.abs(value) <= ORIENTATION_TOLERANCE * scale;
    const nearOne = value => Math.abs(value - 1) <= ORIENTATION_TOLERANCE;
    return [1, 2, 3, 4, 6, 7, 8, 9, 11].every(index => nearZero(values[index])) &&
        nearOne(values[15]);
};

/**
 * Measurement injection contract:
 * `measure(structuralEntity)` returns a world AABB as one of:
 * - `{ minM: {x,y,z}, maxM: {x,y,z} }`
 * - `{ min: {x,y,z}, max: {x,y,z} }`
 * - `{ center: {x,y,z}, halfExtents: {x,y,z} }`
 */
const normalizeWorldBounds = value => {
    let min = value?.minM ?? value?.min;
    let max = value?.maxM ?? value?.max;

    if ((!min || !max) && finitePoint(value?.center) && finitePoint(value?.halfExtents)) {
        if (['x', 'y', 'z'].some(axis => value.halfExtents[axis] <= 0)) return null;
        min = Object.fromEntries(['x', 'y', 'z'].map(axis => [axis,
            value.center[axis] - value.halfExtents[axis]]));
        max = Object.fromEntries(['x', 'y', 'z'].map(axis => [axis,
            value.center[axis] + value.halfExtents[axis]]));
    }

    if (!finitePoint(min) || !finitePoint(max)) return null;
    if (['x', 'y', 'z'].some(axis => min[axis] >= max[axis])) return null;
    return { min, max };
};

const unionWorldBounds = bounds => ({
    min: Object.fromEntries(['x', 'y', 'z'].map(axis => [
        axis,
        Math.min(...bounds.map(value => value.min[axis]))
    ])),
    max: Object.fromEntries(['x', 'y', 'z'].map(axis => [
        axis,
        Math.max(...bounds.map(value => value.max[axis]))
    ]))
});

const diagnosticResult = (code, productId, details) => ({
    status: 'unsupported',
    support: null,
    diagnostics: [{
        code,
        sourceIds: typeof productId === 'string' && productId.length > 0 ? [productId] : [],
        ...(details === undefined ? {} : { details })
    }]
});

const resolveSupportCapability = ({ productType, supportCapability, registry, getCountertopSupport }) => {
    if (supportCapability) return supportCapability;
    if (typeof getCountertopSupport === 'function') return getCountertopSupport(productType);
    return registry?.getCountertopSupport?.(productType) ?? null;
};

const resolveSupportWorldY = ({ root, capability, bounds, productId }) => {
    if (!capability.anchorName) return { value: bounds.max.y, diagnostic: null };

    const anchors = collectNamed(root, capability.anchorName);
    if (anchors.length === 0) return { value: bounds.max.y, diagnostic: null };
    if (anchors.length !== 1) {
        return {
            value: null,
            diagnostic: diagnosticResult('invalid-ulh-support-plane', productId, {
                anchorName: capability.anchorName,
                matches: anchors.length
            })
        };
    }

    let position;
    try {
        position = anchors[0]?.getPosition?.();
    } catch {
        position = null;
    }
    return finiteNumber(position?.y)
        ? { value: position.y, diagnostic: null }
        : { value: bounds.max.y, diagnostic: null };
};

/**
 * Adapt one live phase-2 ULH cabinet into the pure cover-planner support DTO.
 *
 * The current ProductRegistry `countertopSupport` capability is the geometry
 * source of truth. Its collection support anchor supplies world Y and only its
 * declared fallback mesh names supply the X/Z footprint. If an authored anchor
 * is unavailable, the verified structural AABB top is the existing phase-2
 * fallback. No product rule or entity-name capability is duplicated here.
 */
export function createUlHSupportDescriptor({
    productId,
    snapshot,
    root,
    measure,
    registry,
    getCountertopSupport,
    supportCapability
} = {}) {
    const productType = read(snapshot, 'productType');
    // null = this cabinet type is not connected to covers (countertop-collections.mjs).
    const compatibilityKey = coverCompatibilityKey(productType);
    if (typeof productId !== 'string' || productId.trim().length === 0 ||
        !snapshot || !root || typeof measure !== 'function' ||
        !compatibilityKey) {
        return diagnosticResult('invalid-ulh-source', productId, {
            productType: productType ?? null
        });
    }

    const materialId = materialName(read(snapshot, 'CabinetColor'));
    if (!materialId) {
        return diagnosticResult('missing-ulh-cabinet-color', productId, {
            field: 'CabinetColor'
        });
    }

    const capability = resolveSupportCapability({
        productType,
        supportCapability,
        registry,
        getCountertopSupport
    });
    if (capability?.strategy !== SUPPORT_PLANE_STRATEGY) {
        return diagnosticResult('missing-ulh-support-capability', productId, {
            productType,
            strategy: capability?.strategy ?? null
        });
    }

    const eligibility = resolveUlHEligibility({
        role: read(snapshot, 'CabinetRole'),
        mode: read(snapshot, 'eligibilityMode'),
        adjacentRoles: read(snapshot, 'adjacentRoles')
    });
    if (eligibility === 'unknown') {
        return diagnosticResult('unknown-ulh-eligibility', productId, {
            role: read(snapshot, 'CabinetRole') ?? null,
            mode: read(snapshot, 'eligibilityMode') ?? null
        });
    }

    const fallbackNames = Array.isArray(capability.fallbackMeshNames)
        ? [...new Set(capability.fallbackMeshNames.filter(name =>
            typeof name === 'string' && name.length > 0))]
        : [];
    const structuralEntities = [];
    for (const name of fallbackNames) {
        const matches = collectNamed(root, name);
        if (matches.length !== 1) {
            return diagnosticResult('missing-ulh-structural-support', productId, {
                expectedName: name,
                matches: matches.length
            });
        }
        structuralEntities.push(matches[0]);
    }
    if (structuralEntities.length === 0) {
        return diagnosticResult('missing-ulh-structural-support', productId, {
            expectedNames: fallbackNames
        });
    }

    if (!hasUnrotatedWorldOrientation(root) ||
        structuralEntities.some(entity => !hasUnrotatedWorldOrientation(entity))) {
        return diagnosticResult('unsupported-ulh-orientation', productId, {
            expected: 'unrotated-world-axis-aligned'
        });
    }

    const measuredBounds = [];
    for (const structuralEntity of structuralEntities) {
        let measured;
        try {
            measured = measure(structuralEntity);
        } catch (error) {
            return diagnosticResult('invalid-ulh-measurement', productId, {
                reason: 'measurement-threw',
                message: typeof error?.message === 'string' ? error.message : String(error)
            });
        }
        const bounds = normalizeWorldBounds(measured);
        if (!bounds) {
            return diagnosticResult('invalid-ulh-measurement', productId, {
                reason: 'missing-or-degenerate-world-aabb',
                entityName: structuralEntity.name ?? null
            });
        }
        measuredBounds.push(bounds);
    }

    const bounds = unionWorldBounds(measuredBounds);
    const supportWorldY = resolveSupportWorldY({ root, capability, bounds, productId });
    if (supportWorldY.diagnostic) return supportWorldY.diagnostic;

    return {
        status: 'supported',
        support: {
            supportId: `${productId}:top`,
            cabinetId: productId,
            productType,
            xMinM: bounds.min.x,
            xMaxM: bounds.max.x,
            yTopM: supportWorldY.value,
            // Bottom of the structural box: lets the policy see a cabinet standing on another one.
            yBottomM: bounds.min.y,
            zMinM: bounds.min.z,
            zMaxM: bounds.max.z,
            eligibility,
            compatibilityKey,
            materialId
        },
        diagnostics: []
    };
}
