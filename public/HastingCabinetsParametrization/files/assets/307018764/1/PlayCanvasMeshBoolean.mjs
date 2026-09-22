import { Script, Entity } from 'playcanvas';
import { MeshBooleanExecutor } from '../core/MeshBooleanExecutor.mjs';
import { OperationType } from '../core/MeshBooleanOperation.mjs';
import { MeshBooleanScheduler } from '../core/MeshBooleanScheduler.mjs';

export const MESH_BOOLEAN_RESULT_STATUS = Object.freeze({
    SUCCESS: 'success',
    NO_OP: 'no-op',
    CANCELLED: 'cancelled',
    ERROR: 'error'
});

export class MeshBoolean extends Script {
    static scriptName = 'meshBoolean';

    _cutters = [];
    _operation = OperationType.SUBTRACT;
    _runOnStart = true;
    _sourceMesh = null;
    _isUpdating = false;
    _booleanDebounceMs = 120;
    _booleanDelayFrames = 2;
    _booleanTimer = null;
    _booleanScheduleToken = 0;
    _pendingBooleanPromise = null;
    _pendingBooleanResolve = null;
    _pendingBooleanReject = null;
    _pendingBooleanOptions = null;
    _lastBooleanSignature = null;
    // Runtime cut state, independent of script/cutter visibility.
    booleanEnabled = true;
    _generatedMesh = null;
    _geometryRevision = 0;
    _latestRequestedGeometryRevision = 0;
    _scheduledGeometryRevision = null;
    _lastBooleanResult = null;
    _cancelGeneration = 0;
    _destroyed = false;
    _waitFrameCallbacks = new Set();
    _keyboardHandler = null;

    initialize() {
        this._resolveCuttersIfEmpty();
        this.cacheSourceMesh();
        this._hookIntoSmartStretch();

        if (this._runOnStart) {
            // Відкладаємо boolean щоб SmartStretch + visibility rules встигли виконатись
            this._waitFrames(6).then(() => {
                if (this._destroyed) return;
                // Skip if all cutters' parents are disabled (e.g. Sink-Cabinet)
                const allParentsDisabled = this._cutters?.length > 0 &&
                    this._cutters.every(c => !c || (c.parent && !c.parent.enabled));
                if (allParentsDisabled) return;

                this.cacheSourceMesh();
                this.runSafeBoolean();
            });
        }

        this._keyboardHandler = (e) => {
            if (e.key === pc.KEY_SPACE) this.performBoolean();
        };
        this.app.keyboard.on('keydown', this._keyboardHandler);

        this.on('destroy', () => {
            this._destroyed = true;
            this.cancelBoolean('destroyed');
            this._cancelWaitFrames();
            if (this._keyboardHandler) {
                this.app.keyboard.off('keydown', this._keyboardHandler);
                this._keyboardHandler = null;
            }
            this._disposeGeneratedMesh();
        });
    }

    _waitFrames(count) {
        return new Promise(resolve => {
            let remaining = count;
            const entry = { callback: null, resolve };
            const onUpdate = () => {
                if (this._destroyed) {
                    this.app.off('update', onUpdate);
                    this._waitFrameCallbacks.delete(entry);
                    resolve();
                    return;
                }
                remaining--;
                if (remaining <= 0) {
                    this.app.off('update', onUpdate);
                    this._waitFrameCallbacks.delete(entry);
                    resolve();
                }
            };
            entry.callback = onUpdate;
            this._waitFrameCallbacks.add(entry);
            this.app.on('update', onUpdate);
        });
    }

    _cancelWaitFrames() {
        this._waitFrameCallbacks.forEach(entry => {
            this.app.off('update', entry.callback);
            entry.resolve();
        });
        this._waitFrameCallbacks.clear();
    }

    /**
     * Fallback: коли template клонується в runtime, entity references
     * в script attributes (cutters) не перемаплюються. Шукаємо cutter
     * по імені в тому ж hierarchy (entityName + "BoolBox" pattern).
     */
    _resolveCuttersIfEmpty() {
        if (this._cutters && this._cutters.length > 0) return;

        // Шукаємо BoolBox серед siblings/children через parent hierarchy
        const searchRoot = this.entity.parent?.parent || this.entity.parent || this.entity;
        const candidates = searchRoot.find(node =>
            node.name.includes('BoolBox') && node !== this.entity && node.render
        );

        if (candidates.length > 0) {
            this._cutters = candidates;
        }
    }

    /**
     * @attribute
     * @title Cutters
     * @type {Entity[]}
     */
    get cutters() { return this._cutters; }
    set cutters(value) {
        this._cutters = value;
        this._hookIntoSmartStretch();
    }

    /**
     * @attribute
     * @title Operation
     * @type {OperationType}
     * @default 0
     */
    get operation() { return this._operation; }
    set operation(value) {
        this._operation = value;
        if (this._sourceMesh) this.performBoolean();
    }

    /**
     * @attribute
     * @title Run On Start
     * @type {boolean}
     */
    get runOnStart() { return this._runOnStart; }
    set runOnStart(value) { this._runOnStart = value; }

    _hookIntoSmartStretch() {
        const wrapSetter = (ss) => (propName) => {
            if (Object.prototype.hasOwnProperty.call(ss, propName)) return;

            const proto = Object.getPrototypeOf(ss);
            const desc = Object.getOwnPropertyDescriptor(proto, propName);
            if (desc && desc.set) {
                Object.defineProperty(ss, propName, {
                    set: (val) => {
                        desc.set.call(ss, val);
                        if (!this._isUpdating) {
                            this.requestBoolean({
                                reason: 'smartStretch',
                                skipWhenNoActiveCutters: this._cutters?.length > 0
                            });
                        }
                    },
                    get: desc.get,
                    configurable: true
                });
            }
        };

        if (this.entity.script && this.entity.script.smartStretch) {
            const ss = this.entity.script.smartStretch;
            ['stretchAmount', 'margin'].forEach(wrapSetter(ss));
        }

        if (this._cutters && this._cutters.length > 0) {
            this._cutters.forEach(cutter => {
                if (cutter && cutter.script && cutter.script.smartStretch) {
                    const ss = cutter.script.smartStretch;
                    ['stretchAmount', 'margin'].forEach(wrapSetter(ss));
                }
            });
        }
    }

    cacheSourceMesh() {
        const mi = MeshBooleanExecutor.getFirstMeshInstance(this.entity);
        const candidate = mi?.mesh || null;
        if (candidate && candidate !== this._generatedMesh &&
            (!this._sourceMesh || (!this._generatedMesh && candidate !== this._sourceMesh))) {
            this._sourceMesh = mi.mesh;
            this._lastBooleanSignature = null;
        }
        return this._sourceMesh;
    }

    runSafeBoolean() {
        const checkAsset = (comp) => {
            if (comp && comp.asset) {
                const asset = this.app.assets.get(comp.asset);
                if(!asset) return false;
                if (asset.loaded) this.performBoolean();
                else asset.once('load', () => {
                    if (this._destroyed) return;
                    this.cacheSourceMesh();
                    this.performBoolean();
                });
                return true;
            }
            return false;
        };

        if (checkAsset(this.entity.model)) return;
        if (checkAsset(this.entity.render)) return;

        this.cacheSourceMesh();
        this.performBoolean();
    }

    /**
     * Coalesces expensive CSG work while transforms are still changing.
     *
     * Use this from interactive/update paths. Keep performBoolean() for explicit
     * synchronous debug or one-off rebuilds.
     *
     * @param {object} [options]
     * @param {boolean} [options.immediate=false] Run synchronously and cancel pending work.
     * @param {number} [options.debounceMs=120] Quiet period before the run starts.
     * @param {number} [options.delayFrames=2] Frames to wait after the quiet period.
     * @param {boolean} [options.skipWhenNoActiveCutters=false] Avoid CSG if every cutter parent is disabled.
     * @returns {Promise<object>} Revisioned success/no-op/cancelled/error result.
     */
    requestBoolean(options = {}) {
        if (this._destroyed) {
            return Promise.resolve(this._createBooleanResult(
                MESH_BOOLEAN_RESULT_STATUS.CANCELLED,
                this._geometryRevision,
                { reason: 'destroyed' }
            ));
        }

        const revision = ++this._geometryRevision;
        const cancelGeneration = this._cancelGeneration;
        this._latestRequestedGeometryRevision = revision;
        this._scheduledGeometryRevision = revision;

        let scheduledPromise;
        try {
            scheduledPromise = MeshBooleanScheduler.request(this, options);
        } catch (error) {
            return Promise.resolve(this._recordBooleanError(revision, error));
        }

        return Promise.resolve(scheduledPromise).then(
            () => {
                if (this._destroyed || cancelGeneration !== this._cancelGeneration) {
                    return this._createBooleanResult(
                        MESH_BOOLEAN_RESULT_STATUS.CANCELLED,
                        revision,
                        { reason: this._destroyed ? 'destroyed' : 'cancelled' }
                    );
                }

                if (revision !== this._latestRequestedGeometryRevision) {
                    return this._createBooleanResult(
                        MESH_BOOLEAN_RESULT_STATUS.CANCELLED,
                        revision,
                        { reason: 'superseded' }
                    );
                }

                if (this._lastBooleanResult?.revision === revision) {
                    this._scheduledGeometryRevision = null;
                    return this._lastBooleanResult;
                }

                this._scheduledGeometryRevision = null;
                return this._createBooleanResult(
                    MESH_BOOLEAN_RESULT_STATUS.NO_OP,
                    revision,
                    { reason: 'inputs-current' }
                );
            },
            (error) => {
                if (revision !== this._latestRequestedGeometryRevision || this._destroyed) {
                    return this._createBooleanResult(
                        MESH_BOOLEAN_RESULT_STATUS.CANCELLED,
                        revision,
                        { reason: this._destroyed ? 'destroyed' : 'superseded' }
                    );
                }

                this._scheduledGeometryRevision = null;
                if (this._lastBooleanResult?.revision === revision &&
                    this._lastBooleanResult.status === MESH_BOOLEAN_RESULT_STATUS.ERROR) {
                    return this._lastBooleanResult;
                }
                return this._recordBooleanError(revision, error);
            }
        );
    }

    _cancelScheduledBoolean() {
        this.cancelBoolean('cancelled');
    }

    cancelBoolean(reason = 'cancelled') {
        this._cancelGeneration++;
        MeshBooleanScheduler.cancel(this);
        this._scheduledGeometryRevision = null;
        return this._createBooleanResult(
            MESH_BOOLEAN_RESULT_STATUS.CANCELLED,
            this._latestRequestedGeometryRevision,
            { reason }
        );
    }

    _hasActiveCutterParents() {
        return this._cutters?.some(cutter => cutter && (!cutter.parent || cutter.parent.enabled)) || false;
    }

    performBoolean() {
        const revision = this._scheduledGeometryRevision ?? ++this._geometryRevision;
        if (revision > this._latestRequestedGeometryRevision) {
            this._latestRequestedGeometryRevision = revision;
        }

        try {
            this.cacheSourceMesh();
            const result = MeshBooleanExecutor.perform(this, revision);
            this._lastBooleanResult = Object.freeze({ ...result });
            return result.status === MESH_BOOLEAN_RESULT_STATUS.SUCCESS;
        } catch (error) {
            this._recordBooleanError(revision, error);
            throw error;
        }
    }

    onMeshReplaced(callback, scope = this) {
        if (typeof callback !== 'function') return () => {};
        this.on('mesh:replaced', callback, scope);
        let active = true;
        return () => {
            if (!active) return;
            active = false;
            this.off('mesh:replaced', callback, scope);
        };
    }

    _replaceTargetMesh(targetMI, mesh, options = {}) {
        if (this._destroyed || !targetMI || !mesh) return false;

        const previousMesh = options.previousMesh ?? targetMI.mesh;
        if (!options.alreadyAssigned) {
            targetMI.mesh = mesh;
        }

        const previousGeneratedMesh = this._generatedMesh;
        this._generatedMesh = options.generated ? mesh : null;

        if (previousGeneratedMesh && previousGeneratedMesh !== mesh &&
            previousGeneratedMesh !== this._sourceMesh) {
            this._destroyMesh(previousGeneratedMesh);
        }

        const replaced = previousMesh !== mesh;
        if (replaced) {
            try {
                this.fire('mesh:replaced', Object.freeze({
                    revision: options.revision ?? this._geometryRevision,
                    mesh,
                    generated: Boolean(options.generated)
                }));
            } catch (error) {
                console.error('[MeshBoolean] mesh:replaced refresh hook failed', error);
            }
        }

        return replaced;
    }

    _recordBooleanError(revision, error) {
        const result = this._createBooleanResult(
            MESH_BOOLEAN_RESULT_STATUS.ERROR,
            revision,
            {
                code: error?.code || 'MESH_BOOLEAN_FAILED',
                reason: error?.message || String(error)
            }
        );
        this._lastBooleanResult = result;
        return result;
    }

    _createBooleanResult(status, revision, details = {}) {
        return Object.freeze({
            status,
            revision,
            meshReplaced: false,
            ...details
        });
    }

    _disposeGeneratedMesh() {
        const generatedMesh = this._generatedMesh;
        this._generatedMesh = null;
        if (generatedMesh && generatedMesh !== this._sourceMesh) {
            this._destroyMesh(generatedMesh);
        }
    }

    _destroyMesh(mesh) {
        if (mesh && typeof mesh.destroy === 'function') {
            try {
                mesh.destroy();
            } catch (error) {
                console.warn('[MeshBoolean] Failed to destroy owned generated mesh', error);
            }
        }
    }
}
