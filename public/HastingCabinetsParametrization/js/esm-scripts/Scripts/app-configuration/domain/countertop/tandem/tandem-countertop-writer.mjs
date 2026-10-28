import { COUNTERTOP_GEOMETRY_RESULT_STATUS, createCountertopGeometryAdapter } from '../adapters/countertop-geometry-adapter.mjs';
import { COUNTERTOP_INTRINSIC_LENGTH_M } from '../countertop-layout-policy.mjs';

const finite = (value)=>typeof value === 'number' && Number.isFinite(value);
function createTandemCountertopWriter() {
    const bound = new Map(); // productId -> { root, mesh, geometry }
    const lengths = new Map(); // productId -> the last laid-out length (m), for pricing (countertop getState().tandemTops)
    const pending = new Set(); // lengths and cuts started and not settled yet (whenSettled)
    let destroyed = false;
    const track = (operation)=>{
        const tracked = Promise.resolve(operation).catch(()=>null).finally(()=>pending.delete(tracked));
        pending.add(tracked);
        return operation;
    };
    const release = (productId)=>{
        bound.get(productId)?.geometry?.destroy();
        bound.delete(productId);
        lengths.delete(productId);
    };
    /** The binding of `productId` to this root and mesh (a new entity after a commit gets a new geometry adapter). */ const bindingOf = (productId, root, mesh)=>{
        const current = bound.get(productId);
        if (current && current.root === root && current.mesh === mesh) return current;
        release(productId);
        const binding = {
            root,
            mesh,
            geometry: createCountertopGeometryAdapter({
                entity: mesh,
                intrinsicBaseLengthM: COUNTERTOP_INTRINSIC_LENGTH_M
            })
        };
        bound.set(productId, binding);
        return binding;
    };
    return {
        get size () {
            return bound.size;
        },
        has: (productId)=>bound.has(productId),
        /** Length (m) the tandem top was last laid out with, or null. */ lengthOf: (productId)=>lengths.get(productId) ?? null,
        layout ({ productId, root, mesh, basePositionM, lengthM }) {
            if (destroyed || !productId || !root || !mesh) return null;
            const binding = bindingOf(productId, root, mesh);
            if (finite(lengthM) && lengthM > 0) lengths.set(productId, lengthM);
            const local = root.getLocalPosition?.();
            if (finite(basePositionM?.x) && finite(basePositionM?.y)) {
                root.setLocalPosition(basePositionM.x, basePositionM.y, finite(basePositionM.z) ? basePositionM.z : Number(local?.z) || 0);
                root.syncHierarchy?.();
            }
            // A composition layout is one event: no quiet period to coalesce (as the basin top's layout).
            return track(binding.geometry.setLengthM(lengthM, {
                booleanOptions: {
                    reason: 'tandem-countertop-layout',
                    debounceMs: 0
                }
            }));
        },
        cut ({ productId, root, mesh, cutters = [] }) {
            if (destroyed || !productId || !root || !mesh) return null;
            bindingOf(productId, root, mesh);
            const meshBoolean = mesh.script?.meshBoolean;
            if (!meshBoolean || typeof meshBoolean.requestBoolean !== 'function') {
                return Promise.resolve({
                    status: COUNTERTOP_GEOMETRY_RESULT_STATUS.ERROR,
                    code: 'COUNTERTOP_MESH_BOOLEAN_MISSING',
                    reason: 'target MeshBoolean requestBoolean() is unavailable'
                });
            }
            cutters.forEach((cutter)=>{
                cutter.enabled = true;
            });
            meshBoolean.cutters = cutters;
            root.syncHierarchy?.();
            return track(meshBoolean.requestBoolean({
                reason: 'tandem-countertop-cutters',
                skipWhenNoActiveCutters: false
            }));
        },
        prune (liveIds) {
            const live = liveIds instanceof Set ? liveIds : new Set(liveIds ?? []);
            for (const productId of [
                ...bound.keys()
            ])if (!live.has(productId)) release(productId);
        },
        async whenSettled () {
            while(pending.size)await Promise.allSettled([
                ...pending
            ]);
            return {
                status: 'settled'
            };
        },
        destroy () {
            destroyed = true;
            for (const productId of [
                ...bound.keys()
            ])release(productId);
            pending.clear();
        }
    };
}

export { createTandemCountertopWriter };
