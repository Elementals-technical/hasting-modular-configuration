import { buildCollisionProxies } from '../core/collision/proxies.mjs';

const AXES = Object.freeze([
    'x',
    'y',
    'z'
]);
const IDENTITY_MATRIX = Object.freeze([
    1,
    0,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    0,
    1
]);
const isObject = (value)=>value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = (value)=>typeof value === 'number' && Number.isFinite(value);
const validPoint = (point)=>isObject(point) && AXES.every((axis)=>finite(point[axis]));
const validLocalBox = (box)=>Boolean(isObject(box) && validPoint(box.min) && validPoint(box.max) && AXES.every((axis)=>box.min[axis] < box.max[axis]));
const validWorldBox = (box)=>Boolean(isObject(box) && validPoint(box.minM) && validPoint(box.maxM) && AXES.every((axis)=>box.minM[axis] < box.maxM[axis]));
/**
 * Bring `entity`'s subtree up to date before reading world matrices / mesh AABBs.
 *
 * A bare `entity.syncHierarchy()` multiplies each node by its parent's CACHED world matrix. Called
 * on a descendant while an ancestor is dirty (e.g. a countertop root just moved by a drag, before
 * the frame's sync) it caches a stale matrix and clears the dirty flag, so the subtree stays stale
 * until the ancestor moves again (even `app.root.syncHierarchy()` does not repair it).
 * `getWorldTransform()` syncs the ancestor chain first.
 */ const syncEntityWorld = (entity)=>{
    entity?.getWorldTransform?.();
    entity?.syncHierarchy?.();
};
const entityWorldMatrix = (entity)=>{
    const value = entity?.getWorldTransform?.()?.data ?? entity?.worldTransform?.data;
    if (value && value.length === 16 && [
        ...value
    ].every(finite)) return [
        ...value
    ];
    const position = entity?.getPosition?.();
    if (validPoint(position)) {
        const matrix = [
            ...IDENTITY_MATRIX
        ];
        matrix[12] = position.x;
        matrix[13] = position.y;
        matrix[14] = position.z;
        return matrix;
    }
    return entity ? null : [
        ...IDENTITY_MATRIX
    ];
};
const multiplyMatrices = (left, right)=>{
    const output = new Array(16).fill(0);
    for(let column = 0; column < 4; column += 1){
        for(let row = 0; row < 4; row += 1){
            for(let index = 0; index < 4; index += 1){
                output[column * 4 + row] += left[index * 4 + row] * right[column * 4 + index];
            }
        }
    }
    return output;
};
// Column-major inverse matching PlayCanvas Mat4.data.
const invertMatrix = (matrix)=>{
    const output = new Array(16);
    const a00 = matrix[0], a01 = matrix[1], a02 = matrix[2], a03 = matrix[3];
    const a10 = matrix[4], a11 = matrix[5], a12 = matrix[6], a13 = matrix[7];
    const a20 = matrix[8], a21 = matrix[9], a22 = matrix[10], a23 = matrix[11];
    const a30 = matrix[12], a31 = matrix[13], a32 = matrix[14], a33 = matrix[15];
    const b00 = a00 * a11 - a01 * a10;
    const b01 = a00 * a12 - a02 * a10;
    const b02 = a00 * a13 - a03 * a10;
    const b03 = a01 * a12 - a02 * a11;
    const b04 = a01 * a13 - a03 * a11;
    const b05 = a02 * a13 - a03 * a12;
    const b06 = a20 * a31 - a21 * a30;
    const b07 = a20 * a32 - a22 * a30;
    const b08 = a20 * a33 - a23 * a30;
    const b09 = a21 * a32 - a22 * a31;
    const b10 = a21 * a33 - a23 * a31;
    const b11 = a22 * a33 - a23 * a32;
    const determinant = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!finite(determinant) || Math.abs(determinant) <= Number.EPSILON) return null;
    const inverseDeterminant = 1 / determinant;
    output[0] = (a11 * b11 - a12 * b10 + a13 * b09) * inverseDeterminant;
    output[1] = (a02 * b10 - a01 * b11 - a03 * b09) * inverseDeterminant;
    output[2] = (a31 * b05 - a32 * b04 + a33 * b03) * inverseDeterminant;
    output[3] = (a22 * b04 - a21 * b05 - a23 * b03) * inverseDeterminant;
    output[4] = (a12 * b08 - a10 * b11 - a13 * b07) * inverseDeterminant;
    output[5] = (a00 * b11 - a02 * b08 + a03 * b07) * inverseDeterminant;
    output[6] = (a32 * b02 - a30 * b05 - a33 * b01) * inverseDeterminant;
    output[7] = (a20 * b05 - a22 * b02 + a23 * b01) * inverseDeterminant;
    output[8] = (a10 * b10 - a11 * b08 + a13 * b06) * inverseDeterminant;
    output[9] = (a01 * b08 - a00 * b10 - a03 * b06) * inverseDeterminant;
    output[10] = (a30 * b04 - a31 * b02 + a33 * b00) * inverseDeterminant;
    output[11] = (a21 * b02 - a20 * b04 - a23 * b00) * inverseDeterminant;
    output[12] = (a11 * b07 - a10 * b09 - a12 * b06) * inverseDeterminant;
    output[13] = (a00 * b09 - a01 * b07 + a02 * b06) * inverseDeterminant;
    output[14] = (a31 * b01 - a30 * b03 - a32 * b00) * inverseDeterminant;
    output[15] = (a20 * b03 - a21 * b01 + a22 * b00) * inverseDeterminant;
    return output.every(finite) ? output : null;
};
const transformPoint = (matrix, point)=>{
    const x = point.x;
    const y = point.y;
    const z = point.z;
    const w = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15];
    if (!finite(w) || Math.abs(w) <= Number.EPSILON) return null;
    const transformed = {
        x: (matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12]) / w,
        y: (matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13]) / w,
        z: (matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14]) / w
    };
    return validPoint(transformed) ? transformed : null;
};
const transformBox = (box, matrix)=>{
    if (!validLocalBox(box) || !matrix) return null;
    const points = [];
    for (const x of [
        box.min.x,
        box.max.x
    ]){
        for (const y of [
            box.min.y,
            box.max.y
        ]){
            for (const z of [
                box.min.z,
                box.max.z
            ]){
                const point = transformPoint(matrix, {
                    x,
                    y,
                    z
                });
                if (!point) return null;
                points.push(point);
            }
        }
    }
    const result = {
        min: Object.fromEntries(AXES.map((axis)=>[
                axis,
                Math.min(...points.map((point)=>point[axis]))
            ])),
        max: Object.fromEntries(AXES.map((axis)=>[
                axis,
                Math.max(...points.map((point)=>point[axis]))
            ]))
    };
    return validLocalBox(result) ? result : null;
};
const unionBoxes = (boxes)=>{
    if (boxes.length === 0 || boxes.some((box)=>!validLocalBox(box))) return null;
    return {
        min: Object.fromEntries(AXES.map((axis)=>[
                axis,
                Math.min(...boxes.map((box)=>box.min[axis]))
            ])),
        max: Object.fromEntries(AXES.map((axis)=>[
                axis,
                Math.max(...boxes.map((box)=>box.max[axis]))
            ]))
    };
};
const boxFromAabb = (aabb)=>{
    const center = aabb?.center;
    const half = aabb?.halfExtents;
    if (!validPoint(center) || !validPoint(half) || AXES.some((axis)=>half[axis] <= 0)) return null;
    return {
        min: Object.fromEntries(AXES.map((axis)=>[
                axis,
                center[axis] - half[axis]
            ])),
        max: Object.fromEntries(AXES.map((axis)=>[
                axis,
                center[axis] + half[axis]
            ]))
    };
};
const activeAncestry = (entity)=>{
    let current = entity;
    while(current){
        if (current.enabled === false) return false;
        current = current.parent;
    }
    return true;
};
const collectTree = (root)=>{
    if (!root) return [];
    const output = [];
    const stack = [
        root
    ];
    const seen = new Set();
    while(stack.length > 0){
        const entity = stack.pop();
        if (!entity || seen.has(entity)) continue;
        seen.add(entity);
        output.push(entity);
        const children = Array.isArray(entity.children) ? entity.children : [];
        for(let index = children.length - 1; index >= 0; index -= 1)stack.push(children[index]);
    }
    return output;
};
const readMeshArray = (mesh, method)=>{
    if (typeof mesh?.[method] !== 'function') return null;
    const output = [];
    try {
        const returned = mesh[method](output);
        const value = Array.isArray(returned) || ArrayBuffer.isView(returned) ? returned : output;
        return [
            ...value
        ];
    } catch  {
        return null;
    }
};
const topologyFromMeshInstance = (meshInstance, relativeMatrix)=>{
    const mesh = meshInstance?.mesh;
    const positions = readMeshArray(mesh, 'getPositions');
    const indices = readMeshArray(mesh, 'getIndices');
    if (!positions || !indices || positions.length === 0 || positions.length % 3 !== 0 || indices.length === 0 || indices.length % 3 !== 0) return null;
    const transformed = [];
    for(let index = 0; index < positions.length; index += 3){
        const point = transformPoint(relativeMatrix, {
            x: Number(positions[index]),
            y: Number(positions[index + 1]),
            z: Number(positions[index + 2])
        });
        if (!point) return null;
        transformed.push([
            point.x,
            point.y,
            point.z
        ]);
    }
    if (indices.some((index)=>!Number.isInteger(index) || index < 0 || index >= transformed.length)) return null;
    return {
        positions: transformed,
        indices
    };
};
/** Plain primitives of the subtree under `root`, in `root`'s local space. */ const extractMeshPrimitives = (root)=>{
    const rootWorld = entityWorldMatrix(root);
    const inverseRootWorld = invertMatrix(rootWorld || []);
    if (!root || !rootWorld || !inverseRootWorld) return [];
    root.syncHierarchy?.();
    return collectTree(root).map((entity)=>{
        const components = [
            entity.render,
            entity.model
        ].filter((component, index, values)=>component && values.indexOf(component) === index);
        const meshEntries = [];
        for (const component of components){
            for (const meshInstance of component.meshInstances || []){
                meshEntries.push({
                    component,
                    meshInstance
                });
            }
        }
        if (meshEntries.length === 0) return null;
        const entityWorld = entityWorldMatrix(entity);
        const relativeMatrix = entityWorld ? multiplyMatrices(inverseRootWorld, entityWorld) : null;
        const active = entity.enabled !== false && meshEntries.some(({ component })=>component.enabled !== false);
        const ancestorsActive = activeAncestry(entity?.parent);
        if (!relativeMatrix) {
            return {
                entityName: entity.name ?? '',
                active,
                ancestorsActive
            };
        }
        const topologies = [];
        const boxes = [];
        for (const { component, meshInstance } of meshEntries){
            if (component.enabled === false) continue;
            const topology = topologyFromMeshInstance(meshInstance, relativeMatrix);
            if (topology) topologies.push(topology);
            const localBox = boxFromAabb(meshInstance?.mesh?.aabb);
            const transformedBox = transformBox(localBox, relativeMatrix);
            if (transformedBox) boxes.push(transformedBox);
        }
        const primitive = {
            entityName: entity.name ?? '',
            active,
            ancestorsActive
        };
        if (topologies.length > 0) {
            const positions = [];
            const indices = [];
            for (const topology of topologies){
                const offset = positions.length;
                positions.push(...topology.positions);
                indices.push(...topology.indices.map((index)=>index + offset));
            }
            primitive.topology = {
                positions,
                indices
            };
        }
        const box = unionBoxes(boxes);
        if (box) primitive.box = box;
        return primitive;
    }).filter(Boolean);
};
/** Local box -> world `{ minM, maxM }` through a world matrix (null when degenerate). */ const worldBoxFromLocal = (localBox, worldMatrix)=>{
    const transformed = transformBox(localBox, worldMatrix);
    if (!transformed) return null;
    const box = {
        minM: transformed.min,
        maxM: transformed.max
    };
    return validWorldBox(box) ? box : null;
};
const DEFAULT_EXCLUDED_NODE_FRAGMENTS = Object.freeze([
    'Sink_Point',
    'SinkPoint',
    'BoolCut',
    'Cutter',
    'cutter',
    'Siphon',
    'siphon',
    'collision',
    'Collision',
    'proxy',
    'Proxy',
    'Helper',
    'helper'
]);
/**
 * World AABB `{ minM, maxM }` of the enabled, visible render/model meshes under `entity`,
 * skipping nodes whose name contains any of `excludeNameFragments` (helpers, cutters …).
 * Returns null when nothing measurable is found.
 */ const measureEntityBoundsM = (entity, { excludeNameFragments = DEFAULT_EXCLUDED_NODE_FRAGMENTS } = {})=>{
    const excluded = (node)=>{
        const name = String(node?.name || '');
        return excludeNameFragments.some((part)=>name.includes(part));
    };
    if (!entity?.enabled || excluded(entity)) return null;
    syncEntityWorld(entity);
    const min = {
        x: Infinity,
        y: Infinity,
        z: Infinity
    };
    const max = {
        x: -Infinity,
        y: -Infinity,
        z: -Infinity
    };
    let found = false;
    const visit = (node)=>{
        if (!node?.enabled || excluded(node)) return;
        for (const component of [
            node.render,
            node.model
        ]){
            if (!component || component.enabled === false) continue;
            for (const meshInstance of component.meshInstances || []){
                if (!meshInstance?.aabb || meshInstance.visible === false) continue;
                meshInstance._aabbDirty = true;
                const center = meshInstance.aabb.center;
                const half = meshInstance.aabb.halfExtents;
                if (!validPoint(center) || !validPoint(half) || AXES.some((axis)=>half[axis] < 0)) continue;
                for (const axis of AXES){
                    min[axis] = Math.min(min[axis], center[axis] - half[axis]);
                    max[axis] = Math.max(max[axis], center[axis] + half[axis]);
                }
                found = true;
            }
        }
        for (const child of node.children || [])visit(child);
    };
    visit(entity);
    return found ? Object.freeze({
        minM: Object.freeze(min),
        maxM: Object.freeze(max)
    }) : null;
};
/**
 * Proxy boxes of one body in world space: `{ status, profileId, volumes: [{ role, index, box }],
 * diagnostics }`. `status` is the strategy status (`ready` / `unsupported`); a missing world
 * transform yields `pending`.
 */ /**
 * A body whose profile-relevant primitives are all switched off (a hidden variant, a disabled
 * product) is intentionally absent: `inactive`, not an error.
 */ const intentionallyInactive = (root, profile, primitives)=>{
    if (root && !activeAncestry(root)) return true;
    const strategy = profile?.proxyStrategy;
    if (!strategy) return false;
    const name = (primitive)=>primitive?.entityName ?? primitive?.name ?? '';
    const off = (primitive)=>primitive.active !== true || primitive.ancestorsActive !== true;
    let named = [];
    if (strategy.exactEntityName) named = primitives.filter((primitive)=>name(primitive) === strategy.exactEntityName);
    else if (strategy.type === 'active-member-union') {
        named = primitives.filter((primitive)=>strategy.includeNameSuffixes.some((suffix)=>name(primitive).endsWith(suffix)));
    }
    return named.length > 0 && named.every(off);
};
const measureBodyProxiesM = (root, profile, { primitives = null } = {})=>{
    const input = primitives ?? extractMeshPrimitives(root);
    if (intentionallyInactive(root, profile, input)) return {
        status: 'inactive',
        profileId: profile?.id ?? null,
        volumes: [],
        diagnostics: []
    };
    const built = buildCollisionProxies({
        profile,
        primitives: input
    });
    if (built.status !== 'ready') return {
        status: built.status,
        profileId: built.profileId,
        volumes: [],
        diagnostics: built.diagnostics
    };
    const worldMatrix = entityWorldMatrix(root);
    if (!worldMatrix) return {
        status: 'pending',
        profileId: built.profileId,
        volumes: [],
        diagnostics: []
    };
    const counts = new Map();
    const volumes = [];
    for (const proxy of built.proxies){
        const index = counts.get(proxy.semanticRole) ?? 0;
        counts.set(proxy.semanticRole, index + 1);
        volumes.push({
            role: proxy.semanticRole,
            index,
            box: worldBoxFromLocal(proxy.box, worldMatrix)
        });
    }
    return {
        status: 'ready',
        profileId: built.profileId,
        volumes,
        diagnostics: []
    };
};

export { DEFAULT_EXCLUDED_NODE_FRAGMENTS, IDENTITY_MATRIX, activeAncestry, collectTree, entityWorldMatrix, extractMeshPrimitives, invertMatrix, measureBodyProxiesM, measureEntityBoundsM, multiplyMatrices, syncEntityWorld, transformBox, transformPoint, unionBoxes, worldBoxFromLocal };
