import { cloneData, isFiniteVec3 } from '../cabinet-contracts.mjs';

const failure = (code, message) => Object.assign(new Error(message), { code });
let nextPreviewId = 0;

/** Owns only draft entities. No CompositionStore, selection or committed controllers.
 * configure must operate on this detached entity and return an optional disposer for
 * resources it allocates. measure must report actual geometry readiness (not a default).
 * Parent/frame conversion and rendering are injected so core does not depend on pc.
 */
export function createProductPreviewAdapter({
    factory, previewRoot, configure, measure, resolvePlacement, applyPose, setValidation
}) {
    if (!factory?.createProductEntity || !previewRoot?.addChild ||
        [configure, measure, resolvePlacement, applyPose].some(port => typeof port !== 'function')) {
        throw new TypeError('Preview factory, isolated root, configuration and geometry ports are required');
    }
    const owned = new WeakMap();
    const handles = new Set(), work = new Set(), controllers = new Set();
    let closed = false, destruction = null;
    const checkCancelled = signal => {
        if (closed || signal?.aborted) throw failure('CANCELLED', 'Preview cancelled');
    };
    const recordFor = handle => {
        const record = handle && owned.get(handle);
        if (!record) throw failure('INVALID_PREVIEW_HANDLE', 'Preview handle belongs to another adapter');
        return record;
    };
    const active = handle => {
        const record = recordFor(handle);
        if (record.disposed) throw failure('INVALID_PREVIEW_HANDLE', 'Preview is disposed');
        return record;
    };
    async function dispose(handle) {
        const record = recordFor(handle);
        if (record.disposal) return record.disposal;
        record.disposed = true;
        record.disposal = (async () => {
            try {
                try { await setValidation?.(record.entity, null); }
                finally { await record.release?.(); }
            } finally {
                record.entity.destroy();
                handles.delete(handle);
            }
        })();
        return record.disposal;
    }
    async function create(choice, { runtime, signal, kind = 'add', productId = null } = {}) {
            checkCancelled(signal);
            if (!runtime || typeof runtime.productType !== 'string' || !runtime.productType || !runtime.config) {
                throw failure('PREVIEW_MODEL_UNAVAILABLE', 'Verified runtime mapping required');
            }
            const config = cloneData(runtime.config);
            const entity = await factory.createProductEntity(runtime.productType, config, {
                purpose: 'preview', productId: `cabinet-preview-${++nextPreviewId}`,
                sourceProductId: productId, kind, signal
            });
            if (!entity) throw failure('PREVIEW_MODEL_UNAVAILABLE', 'Factory returned no model');
            const handle = Object.freeze({});
            const record = { entity, disposed: false, release: null, disposal: null };
            owned.set(handle, record);
            handles.add(handle);
            try {
                entity.enabled = false;
                checkCancelled(signal);
                record.release = await configure(entity, config, { productType: runtime.productType,
                    choice: cloneData(choice), kind, sourceProductId: productId, signal });
                if (record.release != null && typeof record.release !== 'function') {
                    throw new TypeError('Preview configure must return a disposer or nothing');
                }
                checkCancelled(signal);
                previewRoot.addChild(entity);
                entity.enabled = true;
                return handle;
            } catch (error) {
                // A failed cleanup is surfaced, not hidden behind the original load error.
                await dispose(handle);
                throw error;
            }
    }
    return Object.freeze({
        /** Runtime-only read access for the active pointer adapter. Never serialized to UI. */
        getActiveHandles() { return [...handles].filter(handle => !owned.get(handle)?.disposed); },
        getPickTarget(handle) {
            const record = owned.get(handle);
            return record && !record.disposed ? record.entity : null;
        },
        containsPickTarget(handle, target) {
            const record = owned.get(handle);
            if (!record || record.disposed || !target) return false;
            if (target === previewRoot && handles.size === 1) return true;
            for (let node = target; node; node = node.parent) if (node === record.entity) return true;
            return false;
        },
        create(choice, options = {}) {
            const controller = new AbortController(), signal = options.signal;
            const abort = () => controller.abort();
            if (signal?.aborted || closed) abort();
            else signal?.addEventListener('abort',abort,{once:true});
            controllers.add(controller);
            const promise = create(choice,{...options,signal:controller.signal}).finally(()=>{
                controllers.delete(controller);signal?.removeEventListener('abort',abort);work.delete(promise);
            });
            work.add(promise);return promise;
        },
        async setPose(handle, placement) {
            const record = active(handle);
            const position = await resolvePlacement(cloneData(placement));
            if (!isFiniteVec3(position)) throw failure('INVALID_PLACEMENT', 'Resolved preview position must be finite');
            active(handle);
            await applyPose(record.entity, cloneData(position));
        },
        async measure(handle) {
            const record = active(handle);
            const result = await measure(record.entity);
            active(handle);
            return cloneData(result);
        },
        async setValidation(handle, validation) {
            const record = active(handle);
            await setValidation?.(record.entity, cloneData(validation));
        },
        dispose,
        destroy() {
            if (destruction) return destruction;
            closed = true;
            for (const controller of controllers) controller.abort();
            destruction = (async()=>{
                await Promise.allSettled([...work]);
                const results = await Promise.allSettled([...handles].map(dispose));
                const failed = results.find(result=>result.status==='rejected');
                if(failed)throw failed.reason;
            })();
            return destruction;
        }
    });
}
