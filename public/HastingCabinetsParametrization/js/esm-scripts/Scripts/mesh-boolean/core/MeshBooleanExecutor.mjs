import { Vec3, Mesh } from '../../../../playcanvas-stable.min.mjs';
import { Polygon, CSG, Vertex, Vector } from '../../math/CSG.mjs';
import { MeshBooleanSignature } from './MeshBooleanSignature.mjs';
import { OperationType } from './MeshBooleanOperation.mjs';

class MeshBooleanExecutor {
    static perform(meshBoolean, revision = null) {
        if (meshBoolean._destroyed) {
            return MeshBooleanExecutor._result('cancelled', revision, {
                reason: 'destroyed'
            });
        }
        if (meshBoolean._isUpdating) {
            return MeshBooleanExecutor._result('no-op', revision, {
                reason: 'already-updating'
            });
        }
        meshBoolean._isUpdating = true;
        let completed = false;
        let generatedMesh = null;
        let previousVisibleMesh = null;
        let targetMI = null;
        let sourceMesh = null;
        let targetStretcher = null;
        try {
            targetMI = MeshBooleanExecutor.getFirstMeshInstance(meshBoolean.entity);
            if (!targetMI) {
                return MeshBooleanExecutor._result('error', revision, {
                    code: 'MESH_BOOLEAN_TARGET_MISSING',
                    reason: 'target-mesh-instance-missing'
                });
            }
            if (!meshBoolean._sourceMesh) {
                meshBoolean._sourceMesh = targetMI.mesh;
            }
            sourceMesh = meshBoolean._sourceMesh;
            if (!sourceMesh || sourceMesh === meshBoolean._generatedMesh) {
                return MeshBooleanExecutor._result('error', revision, {
                    code: 'MESH_BOOLEAN_SOURCE_MISSING',
                    reason: 'pristine-source-mesh-missing'
                });
            }
            previousVisibleMesh = targetMI.mesh;
            targetStretcher = MeshBooleanExecutor._getTargetStretcher(meshBoolean.entity);
            if (meshBoolean.booleanEnabled === false) {
                targetMI.mesh = meshBoolean._sourceMesh;
                meshBoolean.entity.script?.smartStretch?.setMuted?.(false);
                completed = true;
                return true;
            }
            if (!meshBoolean._cutters || meshBoolean._cutters.length === 0) {
                const replaced = MeshBooleanExecutor._restoreSourceMesh(meshBoolean, targetMI, sourceMesh, targetStretcher, previousVisibleMesh, revision);
                completed = true;
                return MeshBooleanExecutor._result('success', revision, {
                    meshReplaced: replaced,
                    generated: false,
                    reason: replaced ? 'source-restored' : 'source-refreshed'
                });
            }
            // SmartStretch owns the pristine vertex baseline. Point its mesh
            // instance back at the source before muting so reset-to-base never
            // writes into a previously generated CSG mesh.
            targetMI.mesh = sourceMesh;
            MeshBooleanExecutor._setTargetStretcherMuted(targetStretcher, true);
            const targetTransform = meshBoolean.entity.getWorldTransform();
            let finalCSG = MeshBooleanExecutor.meshToCSG(sourceMesh, targetTransform, targetStretcher);
            let opCount = 0;
            meshBoolean._cutters.forEach((cutter)=>{
                if (!cutter) return;
                if (cutter.parent && !cutter.parent.enabled) return;
                const cutterMI = MeshBooleanExecutor.getFirstMeshInstance(cutter);
                if (!cutterMI) return;
                const cutterStretcher = cutter.script?.smartStretch || null;
                if (cutterStretcher && typeof cutterStretcher.refreshSize === 'function') {
                    cutterStretcher.refreshSize();
                }
                const cutterCSG = MeshBooleanExecutor.meshToCSG(cutterMI.mesh, cutter.getWorldTransform(), cutterStretcher);
                switch(meshBoolean._operation){
                    case OperationType.SUBTRACT:
                        finalCSG = finalCSG.subtract(cutterCSG);
                        break;
                    case OperationType.UNION:
                        finalCSG = finalCSG.union(cutterCSG);
                        break;
                    case OperationType.INTERSECT:
                        finalCSG = finalCSG.intersect(cutterCSG);
                        break;
                }
                cutter.enabled = false;
                opCount++;
            });
            if (opCount === 0) {
                const replaced = MeshBooleanExecutor._restoreSourceMesh(meshBoolean, targetMI, sourceMesh, targetStretcher, previousVisibleMesh, revision);
                completed = true;
                return MeshBooleanExecutor._result('success', revision, {
                    meshReplaced: replaced,
                    generated: false,
                    reason: replaced ? 'source-restored' : 'no-active-cutters'
                });
            }
            const inverseTrans = targetTransform.clone().invert();
            generatedMesh = MeshBooleanExecutor.csgToMesh(finalCSG, inverseTrans, meshBoolean.app.graphicsDevice);
            const replaced = MeshBooleanExecutor._replaceTargetMesh(meshBoolean, targetMI, generatedMesh, {
                generated: true,
                previousMesh: previousVisibleMesh,
                revision
            });
            generatedMesh = null;
            completed = true;
            return MeshBooleanExecutor._result('success', revision, {
                meshReplaced: replaced,
                generated: true,
                operationCount: opCount,
                reason: 'boolean-completed'
            });
        } catch (error) {
            if (targetMI && previousVisibleMesh) {
                targetMI.mesh = previousVisibleMesh;
                if (previousVisibleMesh === sourceMesh) {
                    MeshBooleanExecutor._setTargetStretcherMuted(targetStretcher, false);
                }
            }
            throw error;
        } finally{
            try {
                if (generatedMesh && typeof generatedMesh.destroy === 'function') {
                    generatedMesh.destroy();
                }
                if (completed) {
                    MeshBooleanSignature.markCurrent(meshBoolean);
                }
            } finally{
                meshBoolean._isUpdating = false;
            }
        }
    }
    static getFirstMeshInstance(entity) {
        if (entity?.render?.meshInstances?.length > 0) return entity.render.meshInstances[0];
        if (entity?.model?.meshInstances?.length > 0) return entity.model.meshInstances[0];
        return null;
    }
    static meshToCSG(mesh, transform, stretcherComponent) {
        const positions = [];
        const normals = [];
        const uvs = [];
        const indices = [];
        mesh.getPositions(positions);
        mesh.getNormals(normals);
        mesh.getUvs(0, uvs);
        mesh.getIndices(indices);
        const polygons = [];
        const getV = (i)=>{
            const idx = i * 3;
            const uvIdx = i * 2;
            const vec = new Vec3(positions[idx], positions[idx + 1], positions[idx + 2]);
            if (stretcherComponent) {
                stretcherComponent.calculateDeformation(vec);
            }
            transform.transformPoint(vec, vec);
            const norm = new Vec3(normals[idx], normals[idx + 1], normals[idx + 2]);
            transform.transformVector(norm, norm).normalize();
            const u = uvs.length > 0 ? uvs[uvIdx] || 0 : 0;
            const v = uvs.length > 0 ? uvs[uvIdx + 1] || 0 : 0;
            return new Vertex(new Vector(vec.x, vec.y, vec.z), new Vector(norm.x, norm.y, norm.z), new Vector(u, v, 0));
        };
        for(let i = 0; i < indices.length; i += 3){
            polygons.push(new Polygon([
                getV(indices[i]),
                getV(indices[i + 1]),
                getV(indices[i + 2])
            ], null));
        }
        return CSG.fromPolygons(polygons);
    }
    static csgToMesh(csg, inverseTransform, device) {
        const polygons = csg.toPolygons();
        const positions = [];
        const normals = [];
        const uvs = [];
        const indices = [];
        let idxCounter = 0;
        for(let i = 0; i < polygons.length; i++){
            const p = polygons[i];
            for(let j = 2; j < p.vertices.length; j++){
                const verts = [
                    p.vertices[0],
                    p.vertices[j - 1],
                    p.vertices[j]
                ];
                for (const v of verts){
                    const vec = new Vec3(v.pos.x, v.pos.y, v.pos.z);
                    inverseTransform.transformPoint(vec, vec);
                    const norm = new Vec3(v.normal.x, v.normal.y, v.normal.z);
                    inverseTransform.transformVector(norm, norm).normalize();
                    positions.push(vec.x, vec.y, vec.z);
                    normals.push(norm.x, norm.y, norm.z);
                    uvs.push(v.uv.x, v.uv.y);
                    indices.push(idxCounter++);
                }
            }
        }
        const mesh = new Mesh(device);
        mesh.setPositions(positions);
        mesh.setNormals(normals);
        mesh.setUvs(0, uvs);
        mesh.setIndices(indices);
        mesh.update();
        return mesh;
    }
    static _getTargetStretcher(entity) {
        return entity?.script?.smartStretch || null;
    }
    static _setTargetStretcherMuted(targetStretcher, muted) {
        if (targetStretcher && typeof targetStretcher.setMuted === 'function') {
            targetStretcher.setMuted(muted);
        }
    }
    static _restoreSourceMesh(meshBoolean, targetMI, sourceMesh, targetStretcher, previousMesh, revision) {
        targetMI.mesh = sourceMesh;
        MeshBooleanExecutor._setTargetStretcherMuted(targetStretcher, false);
        return MeshBooleanExecutor._replaceTargetMesh(meshBoolean, targetMI, sourceMesh, {
            generated: false,
            previousMesh,
            alreadyAssigned: true,
            revision
        });
    }
    static _replaceTargetMesh(meshBoolean, targetMI, mesh, options) {
        if (typeof meshBoolean._replaceTargetMesh === 'function') {
            return meshBoolean._replaceTargetMesh(targetMI, mesh, options);
        }
        const previousMesh = options?.previousMesh ?? targetMI.mesh;
        targetMI.mesh = mesh;
        return previousMesh !== mesh;
    }
    static _result(status, revision, details = {}) {
        return {
            status,
            revision,
            meshReplaced: false,
            ...details
        };
    }
}

export { MeshBooleanExecutor };
