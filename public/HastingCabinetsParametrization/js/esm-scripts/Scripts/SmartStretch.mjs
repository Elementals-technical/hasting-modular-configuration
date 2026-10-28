import { Script, Mesh, Vec3 } from '../../playcanvas-stable.min.mjs';

function _define_property(obj, key, value) {
    if (key in obj) {
        Object.defineProperty(obj, key, {
            value: value,
            enumerable: true,
            configurable: true,
            writable: true
        });
    } else {
        obj[key] = value;
    }
    return obj;
}
class SmartStretch extends Script {
    initialize() {
        if (this.entity.render || this.entity.model) {
            this._initClone();
        } else {
            this.on('state', this._initClone, this);
        }
    }
    _initClone() {
        if (this._basePositions) return;
        const render = this.entity.render || this.entity.model;
        if (!render || !render.meshInstances || render.meshInstances.length === 0) return;
        this._meshInstance = render.meshInstances[0];
        const originalMesh = this._meshInstance.mesh;
        const newMesh = new Mesh(this.app.graphicsDevice);
        // Expose allocation immediately so an isolated owner can clean up even if
        // copying the source mesh throws before it is assigned to the instance.
        this._ownedMesh = newMesh;
        newMesh.clear(true, false);
        const positions = [];
        const normals = [];
        const uvs = [];
        const indices = [];
        originalMesh.getPositions(positions);
        originalMesh.getNormals(normals);
        originalMesh.getUvs(0, uvs);
        originalMesh.getIndices(indices);
        newMesh.setPositions(positions);
        newMesh.setNormals(normals);
        newMesh.setUvs(0, uvs);
        newMesh.setIndices(indices);
        newMesh.update();
        this._meshInstance.mesh = newMesh;
        this._basePositions = new Float32Array(positions);
        this.updateGeometry();
    }
    refreshSize() {
        this.updateGeometry();
        return this._originalHalfExtents;
    }
    refreshMaterials() {}
    setMuted(state) {
        this._muted = state;
        if (state) {
            this._applyToMesh(new Vec3(0, 0, 0));
        } else {
            this.updateGeometry();
        }
    }
    calculateDeformation(point) {
        point.x = this._processAxis(point.x, this._stretchAmount.x, this._margin.x);
        point.y = this._processAxis(point.y, this._stretchAmount.y, this._margin.y);
        point.z = this._processAxis(point.z, this._stretchAmount.z, this._margin.z);
        return point;
    }
    /**
     * @attribute
     * @title Margin (XYZ)
     * @type {Vec3}
     * @default [0.1, 0.1, 0.1]
     */ get margin() {
        return this._margin;
    }
    set margin(value) {
        if (value && typeof value.copy === 'function') {
            this._margin.copy(value);
            this.updateGeometry();
        }
    }
    /**
     * @attribute
     * @title Stretch Amount (XYZ)
     * @type {Vec3}
     * @default [0, 0, 0]
     */ get stretchAmount() {
        return this._stretchAmount;
    }
    set stretchAmount(value) {
        if (value && typeof value.copy === 'function') {
            this._stretchAmount.copy(value);
            this.updateGeometry();
        }
    }
    updateGeometry() {
        if (this._muted) return;
        this._applyToMesh(this._stretchAmount);
    }
    _applyToMesh(stretchVec) {
        if (!this._basePositions || !this._meshInstance) return;
        const mesh = this._meshInstance.mesh;
        const src = this._basePositions;
        const dst = new Float32Array(src.length);
        const sx = stretchVec.x;
        const sy = stretchVec.y;
        const sz = stretchVec.z;
        const mx = this._margin.x;
        const my = this._margin.y;
        const mz = this._margin.z;
        for(let i = 0; i < src.length; i += 3){
            dst[i] = this._processAxis(src[i], sx, mx);
            dst[i + 1] = this._processAxis(src[i + 1], sy, my);
            dst[i + 2] = this._processAxis(src[i + 2], sz, mz);
        }
        mesh.setPositions(dst);
        mesh.update();
        mesh.aabb.compute(dst);
        this._meshInstance.aabb.copy(mesh.aabb);
        const transform = this.entity.getWorldTransform();
        this._meshInstance.aabb.setFromTransformedAabb(mesh.aabb, transform);
    }
    _processAxis(val, amount, margin) {
        if (Math.abs(amount) < 0.0001) return val;
        const halfStretch = amount * 0.5;
        if (val > margin) {
            return val + halfStretch;
        } else if (val < -margin) {
            return val - halfStretch;
        } else {
            const scale = (margin + halfStretch) / (margin > 0.001 ? margin : 0.001);
            return val * scale;
        }
    }
    constructor(...args){
        super(...args), _define_property(this, "_margin", new Vec3(0.1, 0.1, 0.1)), _define_property(this, "_stretchAmount", new Vec3(0, 0, 0)), _define_property(this, "_originalHalfExtents", new Vec3(0.5, 0.5, 0.5)), _define_property(this, "_basePositions", null), _define_property(this, "_meshInstance", null), _define_property(this, "_muted", false);
    }
}
_define_property(SmartStretch, "scriptName", 'smartStretch');

export { SmartStretch };
