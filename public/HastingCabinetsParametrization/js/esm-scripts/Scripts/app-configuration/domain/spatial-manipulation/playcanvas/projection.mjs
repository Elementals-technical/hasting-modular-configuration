import { Vec3 } from '../../../../../../playcanvas-stable.min.mjs';
import '../spec/selectors.mjs';
import '../runtime/world.mjs';
import { SPATIAL_MANIPULATION_SCHEMA_VERSION } from '../core/contracts/constants.mjs';
import { throwSpatialInvalidInput } from '../core/contracts/errors.mjs';
import '../core/contracts/validators.mjs';
import { intersectRayPlaneV1 } from '../core/motion/ray-plane.mjs';
import '../core/motion/planner.mjs';
import '../core/snapping/candidates.mjs';
import '../core/snapping/latch.mjs';
import '../runtime/instance-support.mjs';
import '../core/collision/observation.mjs';
import '../runtime/events.mjs';

const DEFAULT_PROJECTION_PARALLEL_EPSILON = 1e-8;
const PROJECTION_BASIS_STEP_PX = 1;
const RAY_LENGTH_EPSILON = 1e-12;
// Relative conditioning threshold of the 2x2 world-per-px Jacobian: below it the inverse is
// replaced by the Moore–Penrose pseudo-inverse (best effort, flagged `basisValid:false`).
const BASIS_CONDITION_EPSILON = 1e-9;
/** Minimal vector the engine's `screenToWorld` can write into when `pc.Vec3` is unavailable. */ class ScratchVec3 {
    set(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
        return this;
    }
    copy(other) {
        return this.set(other.x, other.y, other.z);
    }
    clone() {
        return new ScratchVec3(this.x, this.y, this.z);
    }
    add(other) {
        return this.set(this.x + other.x, this.y + other.y, this.z + other.z);
    }
    sub(other) {
        return this.set(this.x - other.x, this.y - other.y, this.z - other.z);
    }
    sub2(left, right) {
        return this.set(left.x - right.x, left.y - right.y, left.z - right.z);
    }
    mulScalar(scalar) {
        return this.set(this.x * scalar, this.y * scalar, this.z * scalar);
    }
    length() {
        return Math.hypot(this.x, this.y, this.z);
    }
    normalize() {
        const length = this.length();
        return length > 0 ? this.mulScalar(1 / length) : this;
    }
    constructor(x = 0, y = 0, z = 0){
        this.x = x;
        this.y = y;
        this.z = z;
    }
}
const resolveVec3Factory = (createVec3)=>{
    if (typeof createVec3 === 'function') return createVec3;
    const EngineVec3 = Vec3 ?? globalThis.pc?.Vec3 ?? null;
    if (typeof EngineVec3 === 'function') return ()=>new EngineVec3();
    return ()=>new ScratchVec3();
};
const isFiniteNumber = (value)=>typeof value === 'number' && Number.isFinite(value);
const finitePoint2 = (value)=>Boolean(value && isFiniteNumber(value.x) && isFiniteNumber(value.y));
const finiteVec3 = (value)=>Boolean(value && isFiniteNumber(value.x) && isFiniteNumber(value.y) && isFiniteNumber(value.z));
const plainVec3 = (value)=>({
        x: value.x,
        y: value.y,
        z: value.z
    });
const dot3 = (left, right)=>left.x * right.x + left.y * right.y + left.z * right.z;
const assertFrame = (frame)=>{
    if (!frame || !finiteVec3(frame.originM) || !finiteVec3(frame.uAxis) || !finiteVec3(frame.vAxis) || !finiteVec3(frame.normal)) {
        throwSpatialInvalidInput('frame');
    }
    return frame;
};
const invalidSample = (reason, projectionRevision, screenPointPx = null)=>Object.freeze({
        valid: false,
        reason,
        screenPointPx,
        pointWorldM: null,
        uv: null,
        tM: null,
        projectionRevision
    });
const resolveOptional = (value, getter)=>{
    if (typeof getter === 'function') {
        try {
            return getter() ?? null;
        } catch  {
            return null;
        }
    }
    return value ?? null;
};
const matrixData = (matrix)=>{
    const data = matrix?.data;
    if (!data || typeof data.length !== 'number') return [];
    const values = [];
    for(let index = 0; index < data.length; index += 1)values.push(data[index]);
    return values;
};
const readFingerprint = (camera, canvas)=>({
        camera,
        values: [
            ...matrixData(camera?.viewMatrix),
            ...matrixData(camera?.projectionMatrix),
            camera?.nearClip,
            camera?.farClip,
            canvas?.clientWidth,
            canvas?.clientHeight,
            camera?.rect?.x,
            camera?.rect?.y,
            camera?.rect?.z,
            camera?.rect?.w
        ]
    });
const sameFingerprint = (left, right)=>Boolean(left && right && left.camera === right.camera && left.values.length === right.values.length && left.values.every((value, index)=>Object.is(value, right.values[index])));
/**
 * @param {object} options
 * @param {object|null} [options.camera] PlayCanvas `CameraComponent` (or duck-typed fake).
 * @param {() => object|null} [options.getCamera] Lazy camera resolver (wins over `camera`).
 * @param {object|null} [options.canvas] Canvas whose CSS size enters the projection fingerprint.
 * @param {() => object|null} [options.getCanvas] Lazy canvas resolver (wins over `canvas`).
 * @param {() => object} [options.createVec3] Vector factory for `screenToWorld` output.
 * @param {number} [options.parallelEpsilon] `intersectRayPlaneV1` parallel epsilon.
 */ const createPlayCanvasProjectionAdapter = (options = {})=>{
    const { camera = null, getCamera = null, canvas = null, getCanvas = null, createVec3 = null, parallelEpsilon = DEFAULT_PROJECTION_PARALLEL_EPSILON } = options;
    if (!isFiniteNumber(parallelEpsilon) || parallelEpsilon < 0 || parallelEpsilon >= 1) {
        throwSpatialInvalidInput('parallelEpsilon');
    }
    const vec3 = resolveVec3Factory(createVec3);
    const scratch = {
        near: vec3(),
        far: vec3()
    };
    let revision = 0;
    let lastFingerprint = null;
    const resolveCamera = ()=>resolveOptional(camera, getCamera);
    const resolveCanvas = ()=>resolveOptional(canvas, getCanvas);
    const getProjectionRevision = ()=>{
        const fingerprint = readFingerprint(resolveCamera(), resolveCanvas());
        if (lastFingerprint === null) {
            lastFingerprint = fingerprint;
        } else if (!sameFingerprint(lastFingerprint, fingerprint)) {
            lastFingerprint = fingerprint;
            revision += 1;
        }
        return revision;
    };
    /** Normalized ray DTO `{ originM, direction }` in world meters, or null. */ const buildRay = (point)=>{
        const currentCamera = resolveCamera();
        if (!currentCamera || typeof currentCamera.screenToWorld !== 'function' || !finitePoint2(point)) {
            return null;
        }
        const x = Number(point.x);
        const y = Number(point.y);
        let near;
        let far;
        try {
            near = currentCamera.screenToWorld(x, y, currentCamera.nearClip, scratch.near) ?? scratch.near;
            far = currentCamera.screenToWorld(x, y, currentCamera.farClip, scratch.far) ?? scratch.far;
        } catch  {
            return null;
        }
        if (!finiteVec3(near) || !finiteVec3(far)) return null;
        const dx = far.x - near.x;
        const dy = far.y - near.y;
        const dz = far.z - near.z;
        const length = Math.hypot(dx, dy, dz);
        if (!Number.isFinite(length) || length <= RAY_LENGTH_EPSILON) return null;
        return {
            originM: plainVec3(near),
            direction: {
                x: dx / length,
                y: dy / length,
                z: dz / length
            }
        };
    };
    const uvOf = (pointWorldM, frame)=>{
        const delta = {
            x: pointWorldM.x - frame.originM.x,
            y: pointWorldM.y - frame.originM.y,
            z: pointWorldM.z - frame.originM.z
        };
        return {
            u: dot3(delta, frame.uAxis),
            v: dot3(delta, frame.vAxis)
        };
    };
    const projectWithRevision = (point, frame, projectionRevision)=>{
        assertFrame(frame);
        if (!finitePoint2(point)) return invalidSample('invalid-point', projectionRevision);
        const screenPointPx = {
            x: Number(point.x),
            y: Number(point.y)
        };
        const currentCamera = resolveCamera();
        if (!currentCamera || typeof currentCamera.screenToWorld !== 'function') {
            return invalidSample('no-camera', projectionRevision, screenPointPx);
        }
        const ray = buildRay(screenPointPx);
        if (!ray) return invalidSample('invalid-ray', projectionRevision, screenPointPx);
        const hit = intersectRayPlaneV1({
            schemaVersion: SPATIAL_MANIPULATION_SCHEMA_VERSION,
            ray,
            plane: {
                pointM: plainVec3(frame.originM),
                normal: plainVec3(frame.normal)
            },
            parallelEpsilon
        });
        if (hit === null) return invalidSample('parallel', projectionRevision, screenPointPx);
        if (!finiteVec3(hit.pointWorldM) || !isFiniteNumber(hit.tM)) {
            return invalidSample('non-finite', projectionRevision, screenPointPx);
        }
        const uv = uvOf(hit.pointWorldM, frame);
        if (!isFiniteNumber(uv.u) || !isFiniteNumber(uv.v)) {
            return invalidSample('non-finite', projectionRevision, screenPointPx);
        }
        return Object.freeze({
            valid: true,
            reason: null,
            screenPointPx: Object.freeze(screenPointPx),
            pointWorldM: Object.freeze(plainVec3(hit.pointWorldM)),
            uv: Object.freeze(uv),
            tM: hit.tM,
            projectionRevision
        });
    };
    /** Project one screen point onto the frame plane. Never throws for runtime conditions. */ const projectScreenPoint = (point, frame)=>projectWithRevision(point, frame, getProjectionRevision());
    const ZERO_BASIS = Object.freeze({
        u: Object.freeze({
            x: 0,
            y: 0
        }),
        v: Object.freeze({
            x: 0,
            y: 0
        })
    });
    const basisResult = (valid, reason, u, v)=>Object.freeze({
            valid,
            reason,
            u: Object.freeze({
                x: u.x,
                y: u.y
            }),
            v: Object.freeze({
                x: v.x,
                y: v.y
            })
        });
    /**
   * Best-effort basis (`UpdateGestureV1.screenAxisBasis` is required, so a basis is always
   * returned): the inverse of the world-per-px Jacobian when it is well conditioned; the
   * Moore–Penrose pseudo-inverse (Jᵀ/‖J‖²_F, exact for rank-1) when it is degenerate; zeros
   * when no finite Jacobian exists. `valid:false` + `reason` flag the degraded cases so the
   * core can decide (Alt intent rejects a degenerate basis itself; free-axis motion continues).
   */ const basisWithRevision = (point, frame, projectionRevision)=>{
        const origin = projectWithRevision(point, frame, projectionRevision);
        if (!origin.valid) return basisResult(false, origin.reason, ZERO_BASIS.u, ZERO_BASIS.v);
        const stepX = projectWithRevision({
            x: origin.screenPointPx.x + PROJECTION_BASIS_STEP_PX,
            y: origin.screenPointPx.y
        }, frame, projectionRevision);
        const stepY = projectWithRevision({
            x: origin.screenPointPx.x,
            y: origin.screenPointPx.y + PROJECTION_BASIS_STEP_PX
        }, frame, projectionRevision);
        if (!stepX.valid || !stepY.valid) {
            return basisResult(false, stepX.valid ? stepY.reason : stepX.reason, ZERO_BASIS.u, ZERO_BASIS.v);
        }
        // World-per-CSS-pixel Jacobian in frame coordinates, then inverted to CSS px per meter.
        // This uses the same screen space as pointer input (no worldToScreen/device-pixel mixing),
        // exactly like the legacy countertop `_getAxisBasis`.
        const a = (stepX.uv.u - origin.uv.u) / PROJECTION_BASIS_STEP_PX; // du/dx
        const c = (stepX.uv.v - origin.uv.v) / PROJECTION_BASIS_STEP_PX; // dv/dx
        const b = (stepY.uv.u - origin.uv.u) / PROJECTION_BASIS_STEP_PX; // du/dy
        const d = (stepY.uv.v - origin.uv.v) / PROJECTION_BASIS_STEP_PX; // dv/dy
        const frobeniusSq = a * a + b * b + c * c + d * d;
        const determinant = a * d - b * c;
        if (!Number.isFinite(frobeniusSq) || !Number.isFinite(determinant)) {
            return basisResult(false, 'non-finite', ZERO_BASIS.u, ZERO_BASIS.v);
        }
        if (frobeniusSq > 0 && Math.abs(determinant) > BASIS_CONDITION_EPSILON * frobeniusSq) {
            const u = {
                x: d / determinant,
                y: -c / determinant
            };
            const v = {
                x: -b / determinant,
                y: a / determinant
            };
            if (finitePoint2(u) && finitePoint2(v)) return basisResult(true, null, u, v);
            return basisResult(false, 'non-finite', ZERO_BASIS.u, ZERO_BASIS.v);
        }
        if (frobeniusSq === 0) return basisResult(false, 'degenerate-basis', ZERO_BASIS.u, ZERO_BASIS.v);
        // Rank-1 pseudo-inverse: columns of Jᵀ/‖J‖²_F map a unit U/V step to its screen direction.
        const u = {
            x: a / frobeniusSq,
            y: b / frobeniusSq
        };
        const v = {
            x: c / frobeniusSq,
            y: d / frobeniusSq
        };
        if (!finitePoint2(u) || !finitePoint2(v)) return basisResult(false, 'non-finite', ZERO_BASIS.u, ZERO_BASIS.v);
        return basisResult(false, 'degenerate-basis', u, v);
    };
    /** CSS px per meter along the frame U and V axes at `point` (`UpdateGestureV1.screenAxisBasis`). */ const screenAxisBasis = (point, frame)=>basisWithRevision(point, frame, getProjectionRevision());
    /**
   * One pointer sample: hit + best-effort basis + revision, computed against one fingerprint
   * read. `valid` follows the ray hit only (no camera, invalid point/ray, parallel, non-finite);
   * a degraded basis is reported through `basisValid`/`basisReason` and never blocks motion.
   */ const sample = (point, frame)=>{
        const projectionRevision = getProjectionRevision();
        const hit = projectWithRevision(point, frame, projectionRevision);
        if (!hit.valid) {
            return Object.freeze({
                ...hit,
                screenAxisBasis: null,
                basisValid: false,
                basisReason: hit.reason
            });
        }
        const basis = basisWithRevision(point, frame, projectionRevision);
        return Object.freeze({
            ...hit,
            screenAxisBasis: Object.freeze({
                u: basis.u,
                v: basis.v
            }),
            basisValid: basis.valid,
            basisReason: basis.reason
        });
    };
    return Object.freeze({
        getCamera: resolveCamera,
        getCanvas: resolveCanvas,
        getProjectionRevision,
        buildRay,
        projectScreenPoint,
        screenAxisBasis,
        sample
    });
};
/**
 * Convenience wiring for a PlayCanvas `app`: camera from the select tool (or the first camera
 * component) and canvas from the graphics device, resolved lazily on every sample.
 */ const createPlayCanvasProjectionAdapterForApp = (app, options = {})=>createPlayCanvasProjectionAdapter({
        ...options,
        getCamera: options.getCamera ?? (()=>app?.selectTool?.cameraEntity?.camera || app?.root?.findComponent?.('camera')?.entity?.camera || null),
        getCanvas: options.getCanvas ?? (()=>app?.graphicsDevice?.canvas ?? null)
    });

export { DEFAULT_PROJECTION_PARALLEL_EPSILON, PROJECTION_BASIS_STEP_PX, createPlayCanvasProjectionAdapter, createPlayCanvasProjectionAdapterForApp };
