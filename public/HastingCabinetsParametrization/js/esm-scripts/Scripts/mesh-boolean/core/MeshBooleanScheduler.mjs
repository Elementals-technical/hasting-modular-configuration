import { MeshBooleanQueue } from './MeshBooleanQueue.mjs';

class MeshBooleanScheduler {
    static request(meshBoolean, options = {}) {
        MeshBooleanQueue.incrementStat('requested');
        if (options.immediate) {
            MeshBooleanScheduler.cancel(meshBoolean);
            return Promise.resolve().then(()=>{
                meshBoolean.performBoolean();
            });
        }
        const queuedItem = MeshBooleanQueue.dequeue(meshBoolean);
        const debounceMs = Number.isFinite(options.debounceMs) ? Math.max(0, options.debounceMs) : meshBoolean._booleanDebounceMs;
        const delayFrames = Number.isFinite(options.delayFrames) ? Math.max(0, options.delayFrames) : meshBoolean._booleanDelayFrames;
        meshBoolean._pendingBooleanOptions = {
            delayFrames,
            skipWhenNoActiveCutters: MeshBooleanScheduler._mergeSkipWhenNoActiveCutters(meshBoolean, options.skipWhenNoActiveCutters, queuedItem?.options)
        };
        if (!meshBoolean._pendingBooleanPromise) {
            meshBoolean._pendingBooleanPromise = new Promise((resolve, reject)=>{
                meshBoolean._pendingBooleanResolve = resolve;
                meshBoolean._pendingBooleanReject = reject;
            });
            meshBoolean._pendingBooleanPromise.catch(()=>{});
        }
        if (queuedItem) {
            MeshBooleanQueue.chainToPromise(queuedItem, meshBoolean._pendingBooleanPromise);
        }
        // A zero-delay schedule transfers the promise to the queue immediately.
        const pendingPromise = meshBoolean._pendingBooleanPromise;
        MeshBooleanScheduler._schedule(meshBoolean, debounceMs);
        return pendingPromise;
    }
    static cancel(meshBoolean) {
        meshBoolean._booleanScheduleToken++;
        if (meshBoolean._booleanTimer) {
            clearTimeout(meshBoolean._booleanTimer);
            meshBoolean._booleanTimer = null;
        }
        MeshBooleanQueue.cancel(meshBoolean);
        if (meshBoolean._pendingBooleanResolve) {
            meshBoolean._pendingBooleanResolve();
        }
        meshBoolean._pendingBooleanPromise = null;
        meshBoolean._pendingBooleanResolve = null;
        meshBoolean._pendingBooleanReject = null;
        meshBoolean._pendingBooleanOptions = null;
    }
    static _mergeSkipWhenNoActiveCutters(meshBoolean, skipWhenNoActiveCutters, queuedOptions = null) {
        let merged = !!skipWhenNoActiveCutters;
        if (meshBoolean._pendingBooleanOptions) {
            merged = meshBoolean._pendingBooleanOptions.skipWhenNoActiveCutters && merged;
        }
        if (queuedOptions) {
            merged = queuedOptions.skipWhenNoActiveCutters && merged;
        }
        return merged;
    }
    static _schedule(meshBoolean, debounceMs) {
        meshBoolean._booleanScheduleToken++;
        const token = meshBoolean._booleanScheduleToken;
        if (meshBoolean._booleanTimer) {
            clearTimeout(meshBoolean._booleanTimer);
            meshBoolean._booleanTimer = null;
        }
        const startFrameDelay = ()=>{
            if (token !== meshBoolean._booleanScheduleToken) return;
            meshBoolean._booleanTimer = null;
            MeshBooleanScheduler._waitFrames(meshBoolean, meshBoolean._pendingBooleanOptions?.delayFrames ?? 0, token);
        };
        if (debounceMs > 0) {
            meshBoolean._booleanTimer = setTimeout(startFrameDelay, debounceMs);
        } else {
            startFrameDelay();
        }
    }
    static _waitFrames(meshBoolean, delayFrames, token) {
        const frames = Math.max(0, delayFrames);
        if (frames === 0) {
            MeshBooleanScheduler._execute(meshBoolean, token);
            return;
        }
        let remaining = frames;
        const waitFrame = ()=>{
            if (token !== meshBoolean._booleanScheduleToken) return;
            remaining--;
            if (remaining <= 0) {
                MeshBooleanScheduler._execute(meshBoolean, token);
            } else {
                MeshBooleanScheduler._requestFrame(waitFrame);
            }
        };
        MeshBooleanScheduler._requestFrame(waitFrame);
    }
    static _execute(meshBoolean, token) {
        if (token !== meshBoolean._booleanScheduleToken) return;
        const resolve = meshBoolean._pendingBooleanResolve;
        const reject = meshBoolean._pendingBooleanReject;
        const options = meshBoolean._pendingBooleanOptions || {};
        meshBoolean._booleanTimer = null;
        meshBoolean._pendingBooleanPromise = null;
        meshBoolean._pendingBooleanResolve = null;
        meshBoolean._pendingBooleanReject = null;
        meshBoolean._pendingBooleanOptions = null;
        MeshBooleanQueue.enqueue(meshBoolean, options, resolve, reject, token);
    }
    static _requestFrame(callback) {
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(callback);
            return;
        }
        setTimeout(callback, 16);
    }
}

export { MeshBooleanScheduler };
