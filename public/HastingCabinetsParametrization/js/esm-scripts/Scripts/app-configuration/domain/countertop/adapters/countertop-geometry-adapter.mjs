/**
 * Metric runtime adapter for the countertop X length.
 *
 * [Proposed D-02] SmartStretch applies the X delta symmetrically around the
 * intrinsic mesh centre. This adapter never scales/moves sinks and never
 * changes the target's Y/Z stretch components.
 */ const COUNTERTOP_GEOMETRY_RESULT_STATUS = Object.freeze({
    SUCCESS: 'success',
    NO_OP: 'no-op',
    CANCELLED: 'cancelled',
    ERROR: 'error'
});
const finitePositive = (value)=>{
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : null;
};
class CountertopGeometryAdapter {
    get revision() {
        return this._revision;
    }
    get effectiveLengthM() {
        return this._effectiveLengthM;
    }
    /**
     * Apply effective countertop length in metres and settle the matching CSG
     * rebuild. The result always identifies the adapter geometry revision.
     */ setLengthM(effectiveLengthM, options = {}) {
        if (this._destroyed) {
            return Promise.resolve(this._remember(this._result(COUNTERTOP_GEOMETRY_RESULT_STATUS.CANCELLED, this._revision, {
                reason: 'destroyed'
            })));
        }
        const lengthM = finitePositive(effectiveLengthM);
        if (lengthM === null || this._intrinsicBaseLengthM === null) {
            const revision = ++this._revision;
            return Promise.resolve(this._remember(this._result(COUNTERTOP_GEOMETRY_RESULT_STATUS.ERROR, revision, {
                code: lengthM === null ? 'COUNTERTOP_LENGTH_INVALID' : 'COUNTERTOP_INTRINSIC_LENGTH_INVALID',
                reason: lengthM === null ? 'effectiveLengthM must be a finite number greater than zero' : 'intrinsicBaseLengthM must be a finite number greater than zero'
            })));
        }
        if (Object.is(lengthM, this._effectiveLengthM) && this._pending) {
            return this._pending;
        }
        if (!options.force && Object.is(lengthM, this._settledLengthM)) {
            return Promise.resolve(this._remember(this._result(COUNTERTOP_GEOMETRY_RESULT_STATUS.NO_OP, this._revision, {
                effectiveLengthM: lengthM,
                stretchXM: lengthM - this._intrinsicBaseLengthM,
                reason: 'length-current'
            })));
        }
        const revision = ++this._revision;
        const stretchXM = lengthM - this._intrinsicBaseLengthM;
        const smartStretch = this._entity?.script?.smartStretch || null;
        const meshBoolean = this._entity?.script?.meshBoolean || null;
        if (!smartStretch?.stretchAmount || typeof smartStretch.updateGeometry !== 'function') {
            return Promise.resolve(this._remember(this._result(COUNTERTOP_GEOMETRY_RESULT_STATUS.ERROR, revision, {
                code: 'COUNTERTOP_SMART_STRETCH_MISSING',
                effectiveLengthM: lengthM,
                stretchXM,
                reason: 'target SmartStretch is unavailable'
            })));
        }
        if (!meshBoolean || typeof meshBoolean.requestBoolean !== 'function') {
            return Promise.resolve(this._remember(this._result(COUNTERTOP_GEOMETRY_RESULT_STATUS.ERROR, revision, {
                code: 'COUNTERTOP_MESH_BOOLEAN_MISSING',
                effectiveLengthM: lengthM,
                stretchXM,
                reason: 'target MeshBoolean requestBoolean() is unavailable'
            })));
        }
        const sourceMesh = typeof meshBoolean.cacheSourceMesh === 'function' ? meshBoolean.cacheSourceMesh() : meshBoolean._sourceMesh;
        if (!sourceMesh) {
            return Promise.resolve(this._remember(this._result(COUNTERTOP_GEOMETRY_RESULT_STATUS.ERROR, revision, {
                code: 'COUNTERTOP_SOURCE_MESH_MISSING',
                effectiveLengthM: lengthM,
                stretchXM,
                reason: 'a pristine source mesh could not be cached'
            })));
        }
        // Mutate only X on the existing Vec3. Calling updateGeometry directly
        // avoids the generic SmartStretch setter hook scheduling a duplicate
        // Boolean request; a muted stretcher intentionally defers writes until
        // MeshBoolean restores the pristine source for its next rebuild.
        smartStretch.stretchAmount.x = stretchXM;
        smartStretch.updateGeometry();
        this._effectiveLengthM = lengthM;
        let booleanPromise;
        try {
            booleanPromise = meshBoolean.requestBoolean({
                ...options.booleanOptions || {},
                reason: 'countertop-length',
                // A no-cutter rebuild may need to restore the pristine source
                // after the previous generated cut mesh, so it cannot be skipped.
                skipWhenNoActiveCutters: false
            });
        } catch (error) {
            return Promise.resolve(this._remember(this._errorResult(revision, lengthM, stretchXM, error)));
        }
        const pending = Promise.resolve(booleanPromise).then((booleanResult)=>this._remember(this._finishRevision(revision, lengthM, stretchXM, booleanResult)), (error)=>this._remember(this._errorResult(revision, lengthM, stretchXM, error)));
        const settled = pending.finally(()=>{
            if (this._pending === settled) {
                this._pending = null;
            }
        });
        this._pending = settled;
        return settled;
    }
    /** Wait until the newest geometry revision is no longer pending. */ async whenSettled() {
        let pending = this._pending;
        let result = this._lastResult;
        while(pending){
            result = await pending;
            if (pending === this._pending) break;
            pending = this._pending;
        }
        return result;
    }
    destroy() {
        if (this._destroyed) return;
        this._destroyed = true;
        this._revision++;
        this._lastResult = this._result(COUNTERTOP_GEOMETRY_RESULT_STATUS.CANCELLED, this._revision, {
            reason: 'destroyed'
        });
        if (this._unsubscribeMeshReplaced) {
            this._unsubscribeMeshReplaced();
            this._unsubscribeMeshReplaced = null;
        }
        const meshBoolean = this._entity?.script?.meshBoolean;
        if (meshBoolean && typeof meshBoolean.cancelBoolean === 'function') {
            meshBoolean.cancelBoolean('countertop-geometry-destroyed');
        } else if (meshBoolean && typeof meshBoolean._cancelScheduledBoolean === 'function') {
            meshBoolean._cancelScheduledBoolean();
        }
        this._pending = null;
        this._entity = null;
        this._onMeshReplaced = null;
    }
    /** Detach the legacy observer after ownership transfer without cancelling adopted mesh work. */ retireWithoutMutation() {
        if (this._destroyed) return;
        this._destroyed = true;
        this._revision++;
        this._unsubscribeMeshReplaced?.();
        this._unsubscribeMeshReplaced = null;
        this._pending = null;
        this._entity = null;
        this._onMeshReplaced = null;
    }
    _finishRevision(revision, lengthM, stretchXM, booleanResult = {}) {
        if (this._destroyed) {
            return this._result(COUNTERTOP_GEOMETRY_RESULT_STATUS.CANCELLED, revision, {
                effectiveLengthM: lengthM,
                stretchXM,
                reason: 'destroyed'
            });
        }
        if (revision !== this._revision) {
            return this._result(COUNTERTOP_GEOMETRY_RESULT_STATUS.CANCELLED, revision, {
                effectiveLengthM: lengthM,
                stretchXM,
                reason: 'superseded'
            });
        }
        const status = booleanResult?.status || COUNTERTOP_GEOMETRY_RESULT_STATUS.NO_OP;
        if (status === COUNTERTOP_GEOMETRY_RESULT_STATUS.CANCELLED || status === COUNTERTOP_GEOMETRY_RESULT_STATUS.ERROR) {
            return this._result(status, revision, {
                effectiveLengthM: lengthM,
                stretchXM,
                booleanRevision: booleanResult?.revision ?? null,
                meshReplaced: Boolean(booleanResult?.meshReplaced),
                code: booleanResult?.code,
                reason: booleanResult?.reason || status
            });
        }
        // A meaningful X stretch is successful even when the scheduler reports
        // no-op: with no cutters SmartStretch may have updated the source mesh
        // synchronously and no mesh replacement was necessary.
        this._settledLengthM = lengthM;
        return this._result(COUNTERTOP_GEOMETRY_RESULT_STATUS.SUCCESS, revision, {
            effectiveLengthM: lengthM,
            stretchXM,
            booleanRevision: booleanResult?.revision ?? null,
            booleanStatus: status,
            meshReplaced: Boolean(booleanResult?.meshReplaced),
            reason: booleanResult?.reason || 'geometry-settled'
        });
    }
    _errorResult(revision, lengthM, stretchXM, error) {
        return this._result(COUNTERTOP_GEOMETRY_RESULT_STATUS.ERROR, revision, {
            code: error?.code || 'COUNTERTOP_GEOMETRY_FAILED',
            effectiveLengthM: lengthM,
            stretchXM,
            reason: error?.message || String(error)
        });
    }
    _result(status, revision, details = {}) {
        const result = {
            status,
            revision,
            meshReplaced: false,
            ...details
        };
        if (result.code === undefined) delete result.code;
        return Object.freeze(result);
    }
    _remember(result) {
        if (result?.revision === this._revision) {
            this._lastResult = result;
        }
        return result;
    }
    _subscribeToMeshReplacement() {
        if (!this._onMeshReplaced) return;
        const meshBoolean = this._entity?.script?.meshBoolean;
        if (!meshBoolean) return;
        if (typeof meshBoolean.onMeshReplaced === 'function') {
            this._unsubscribeMeshReplaced = meshBoolean.onMeshReplaced((payload)=>{
                if (!this._destroyed) this._onMeshReplaced(payload);
            }, this);
            return;
        }
        if (typeof meshBoolean.on === 'function' && typeof meshBoolean.off === 'function') {
            const callback = (payload)=>{
                if (!this._destroyed) this._onMeshReplaced(payload);
            };
            meshBoolean.on('mesh:replaced', callback, this);
            this._unsubscribeMeshReplaced = ()=>{
                meshBoolean.off('mesh:replaced', callback, this);
            };
        }
    }
    constructor(options = {}){
        this._entity = options.entity || options.meshEntity || null;
        this._intrinsicBaseLengthM = finitePositive(options.intrinsicBaseLengthM);
        this._onMeshReplaced = typeof options.onMeshReplaced === 'function' ? options.onMeshReplaced : null;
        this._revision = 0;
        this._effectiveLengthM = null;
        this._settledLengthM = null;
        this._pending = null;
        this._destroyed = false;
        this._unsubscribeMeshReplaced = null;
        this._lastResult = this._result(COUNTERTOP_GEOMETRY_RESULT_STATUS.NO_OP, 0, {
            reason: 'not-started'
        });
        this._subscribeToMeshReplacement();
    }
}
function createCountertopGeometryAdapter(options = {}) {
    return new CountertopGeometryAdapter(options);
}

export { COUNTERTOP_GEOMETRY_RESULT_STATUS, CountertopGeometryAdapter, createCountertopGeometryAdapter };
