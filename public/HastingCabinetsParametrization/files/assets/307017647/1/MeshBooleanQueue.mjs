import { MeshBooleanSignature } from './MeshBooleanSignature.mjs';

export class MeshBooleanQueue {
    static _queue = [];
    static _queuedItems = new Map();
    static _running = false;
    static runsPerFrame = 1;

    static incrementStat(name) {
        const stats = MeshBooleanQueue._getStats();
        if (!stats) return;

        stats[name] = (stats[name] || 0) + 1;
    }

    static enqueue(instance, options, resolve, reject, token) {
        const existing = MeshBooleanQueue._queuedItems.get(instance);

        if (existing) {
            existing.options = MeshBooleanQueue._mergeOptions(existing.options, options);
            existing.token = token;
            if (resolve) existing.resolves.push(resolve);
            if (reject) existing.rejects.push(reject);
            MeshBooleanQueue.incrementStat('coalesced');
            return;
        }

        const item = {
            instance,
            options: { ...options },
            token,
            resolves: resolve ? [resolve] : [],
            rejects: reject ? [reject] : []
        };

        MeshBooleanQueue._queue.push(item);
        MeshBooleanQueue._queuedItems.set(instance, item);
        MeshBooleanQueue.incrementStat('enqueued');
        MeshBooleanQueue._recordLength();
        MeshBooleanQueue._scheduleDrain();
    }

    static dequeue(instance) {
        const item = MeshBooleanQueue._queuedItems.get(instance);
        if (!item) return null;

        MeshBooleanQueue._queuedItems.delete(instance);
        const index = MeshBooleanQueue._queue.indexOf(item);
        if (index >= 0) {
            MeshBooleanQueue._queue.splice(index, 1);
        }

        return item;
    }

    static cancel(instance) {
        const item = MeshBooleanQueue.dequeue(instance);
        if (item) {
            MeshBooleanQueue.incrementStat('skipped');
            MeshBooleanQueue._resolve(item);
        }
    }

    static chainToPromise(item, promise) {
        if (!item) return;

        promise.then(
            () => MeshBooleanQueue._resolve(item),
            (error) => MeshBooleanQueue._reject(item, error)
        );
    }

    static _mergeOptions(current = {}, next = {}) {
        return {
            ...current,
            ...next,
            skipWhenNoActiveCutters: !!current.skipWhenNoActiveCutters && !!next.skipWhenNoActiveCutters
        };
    }

    static _scheduleDrain() {
        if (MeshBooleanQueue._running) return;

        MeshBooleanQueue._running = true;
        MeshBooleanQueue._requestFrame(() => {
            MeshBooleanQueue._drain();
        });
    }

    static _drain() {
        const runsPerFrame = Math.max(1, MeshBooleanQueue.runsPerFrame);
        let runs = 0;

        while (runs < runsPerFrame && MeshBooleanQueue._queue.length > 0) {
            const item = MeshBooleanQueue._queue.shift();
            if (!item) continue;

            MeshBooleanQueue._queuedItems.delete(item.instance);
            MeshBooleanQueue._run(item);
            runs++;
        }

        if (MeshBooleanQueue._queue.length > 0) {
            MeshBooleanQueue._requestFrame(() => {
                MeshBooleanQueue._drain();
            });
            return;
        }

        MeshBooleanQueue._running = false;
    }

    static _run(item) {
        const { instance, options, token } = item;

        try {
            if (!instance || token !== instance._booleanScheduleToken) {
                MeshBooleanQueue.incrementStat('skipped');
                MeshBooleanQueue._resolve(item);
                return;
            }

            if (options.skipWhenNoActiveCutters && !instance._hasActiveCutterParents()) {
                MeshBooleanQueue.incrementStat('skipped');
                MeshBooleanQueue._resolve(item);
                return;
            }

            if (MeshBooleanSignature.isCurrent(instance)) {
                MeshBooleanQueue._hideActiveCutters(instance);
                MeshBooleanQueue.incrementStat('skipped');
                MeshBooleanQueue.incrementStat('noopSkipped');
                MeshBooleanQueue._resolve(item);
                return;
            }

            const didRun = instance.performBoolean();
            if (didRun === false) {
                MeshBooleanQueue.incrementStat('skipped');
                MeshBooleanQueue._resolve(item);
                return;
            }

            MeshBooleanQueue.incrementStat('run');
            MeshBooleanQueue._resolve(item);
        } catch (error) {
            MeshBooleanQueue._reject(item, error);
        }
    }

    /**
     * A no-op skip still has to leave the cutters hidden, as a real run does: callers re-enable
     * the cutters before requesting a boolean, and an unchanged signature (e.g. a vessel swap that
     * reuses the same cutter clone) would otherwise leave them visible.
     */
    static _hideActiveCutters(instance) {
        if (instance.booleanEnabled === false) return;

        instance._cutters?.forEach(cutter => {
            if (!cutter) return;
            if (cutter.parent && !cutter.parent.enabled) return;
            cutter.enabled = false;
        });
    }

    static _resolve(item) {
        item.resolves.forEach(resolve => resolve());
    }

    static _reject(item, error) {
        if (item.rejects.length === 0) {
            setTimeout(() => { throw error; }, 0);
            return;
        }

        item.rejects.forEach(reject => reject(error));
    }

    static _requestFrame(callback) {
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(callback);
            return;
        }

        setTimeout(callback, 16);
    }

    static _recordLength() {
        const stats = MeshBooleanQueue._getStats();
        if (!stats) return;

        stats.maxQueueLength = Math.max(stats.maxQueueLength || 0, MeshBooleanQueue._queue.length);
    }

    static _getStats() {
        if (typeof window === 'undefined') return null;

        if (!window.__meshBooleanQueueStats) {
            window.__meshBooleanQueueStats = {
                requested: 0,
                enqueued: 0,
                coalesced: 0,
                run: 0,
                skipped: 0,
                noopSkipped: 0,
                maxQueueLength: 0
            };
        }

        return window.__meshBooleanQueueStats;
    }
}
