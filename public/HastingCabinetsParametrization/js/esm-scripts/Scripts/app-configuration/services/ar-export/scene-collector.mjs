import { CompositionManager } from '../../domain/composition/composition-manager.mjs';

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
class SceneCollector {
    collectAllGeometry() {
        const compositionManager = CompositionManager.instance;
        const composition = compositionManager?.getActiveComposition();
        if (!composition) {
            console.warn('[SceneCollector] No active composition found');
            return [];
        }
        const allGeometry = [];
        const allProducts = composition.getAllProducts();
        this._analyzeSceneForExclusions(this.app.root);
        Object.entries(allProducts).forEach(([productId, snapshot])=>{
            const entity = this.app.root.findByName(productId);
            if (!entity) return;
            const geometry = this.collectProductGeometry(entity, snapshot);
            if (geometry.meshes.length > 0) {
                allGeometry.push({
                    productId: productId,
                    productType: snapshot.entityName || snapshot.productType,
                    category: snapshot.category,
                    config: snapshot,
                    transform: this.getWorldTransform(entity),
                    meshes: geometry.meshes,
                    bounds: geometry.bounds
                });
            }
        });
        this.excludedGuids.clear();
        return allGeometry;
    }
    collectGeometryFromEntity(rootEntity) {
        const allGeometry = [];
        this._debugLogged = false;
        this._analyzeSceneForExclusions(rootEntity);
        rootEntity.children.forEach((productEntity)=>{
            const geometry = this.collectProductGeometry(productEntity, {});
            if (geometry.meshes.length > 0) {
                allGeometry.push({
                    productId: productEntity.name,
                    productType: productEntity.name.replace('_clone', ''),
                    category: 'product',
                    config: {},
                    transform: this.getWorldTransform(productEntity),
                    meshes: geometry.meshes,
                    bounds: geometry.bounds
                });
            }
        });
        this.excludedGuids.clear();
        return allGeometry;
    }
    _analyzeSceneForExclusions(rootNode) {
        if (!rootNode) return;
        this.excludedGuids.clear();
        const findCutters = (node)=>{
            if (node.script && node.script.meshBoolean) {
                const cutters = node.script.meshBoolean.cutters;
                if (cutters && Array.isArray(cutters)) {
                    cutters.forEach((cutterEntity)=>{
                        if (cutterEntity) {
                            this.excludedGuids.add(cutterEntity.getGuid());
                            this._markChildrenAsExcluded(cutterEntity);
                        }
                    });
                }
            }
            const isCutterName = [
                '_cutter',
                'cutter_'
            ].some((p)=>node.name.toLowerCase().includes(p));
            if (isCutterName) {
                this.excludedGuids.add(node.getGuid());
                this._markChildrenAsExcluded(node);
            }
            if (node.children) node.children.forEach((child)=>findCutters(child));
        };
        findCutters(rootNode);
    }
    _markChildrenAsExcluded(entity) {
        entity.children.forEach((child)=>{
            this.excludedGuids.add(child.getGuid());
            this._markChildrenAsExcluded(child);
        });
    }
    collectProductGeometry(productEntity, productSnapshot) {
        const meshes = [];
        let bounds = null;
        const traverse = (entity, depth = 0)=>{
            if (!this.isExportable(entity)) return;
            const meshData = this.extractMeshData(entity, depth);
            if (meshData) {
                meshes.push(meshData);
                if (meshData.aabb) {
                    if (!bounds) bounds = meshData.aabb.clone();
                    else bounds.add(meshData.aabb);
                }
            }
            entity.children.forEach((child)=>traverse(child, depth + 1));
        };
        traverse(productEntity);
        return {
            meshes,
            bounds
        };
    }
    isExportable(entity) {
        if (!entity) return false;
        if (this.excludedGuids.has(entity.getGuid())) return false;
        if (!entity.enabled) return false;
        if (entity.camera || entity.light) return false;
        const nameLower = entity.name.toLowerCase();
        const hasExcludedName = SceneCollector.EXCLUDE_PATTERNS.some((pattern)=>nameLower.includes(pattern.toLowerCase()));
        if (hasExcludedName) return false;
        return true;
    }
    extractMeshData(entity, depth) {
        const meshInstances = entity.render?.meshInstances || entity.model?.meshInstances;
        if (!meshInstances || meshInstances.length === 0) return null;
        const result = {
            entityName: entity.name,
            transform: this.getWorldTransform(entity),
            meshes: [],
            depth: depth
        };
        const isTriplanar = entity.script && entity.script.triPlanarMapping;
        let tilingFactor = 1.0;
        if (isTriplanar) {
            if (entity.script.triPlanarMapping.tiling) tilingFactor = entity.script.triPlanarMapping.tiling;
            if (tilingFactor === 0) tilingFactor = 1.0;
        }
        meshInstances.forEach((mi, index)=>{
            const mesh = mi.mesh;
            if (!mesh) return;
            const positions = [];
            const normals = [];
            let uvs = [];
            const indices = [];
            try {
                mesh.getPositions(positions);
                mesh.getNormals(normals);
                mesh.getUvs(0, uvs);
                mesh.getIndices(indices);
                if (isTriplanar || uvs.length === 0) {
                    uvs = this._generateBoxUVs(positions, normals, tilingFactor);
                }
                const materialData = this.extractMaterialData(mi.material);
                result.meshes.push({
                    name: `${entity.name}_mesh_${index}`,
                    positions: positions,
                    normals: normals,
                    uvs: uvs,
                    indices: indices,
                    material: materialData,
                    aabb: mi.aabb ? mi.aabb.clone() : null,
                    vertexCount: positions.length / 3,
                    indexCount: indices.length
                });
                if (!result.aabb && mi.aabb) {
                    result.aabb = mi.aabb.clone();
                } else if (result.aabb && mi.aabb) {
                    result.aabb.add(mi.aabb);
                }
            } catch (error) {}
        });
        return result.meshes.length > 0 ? result : null;
    }
    /**
     * Generates simple UV coordinates based on normals (Box Projection)
     */ _generateBoxUVs(positions, normals, tiling = 1.0) {
        const uvs = [];
        const numVertices = positions.length / 3;
        for(let i = 0; i < numVertices; i++){
            const x = positions[i * 3];
            const y = positions[i * 3 + 1];
            const z = positions[i * 3 + 2];
            const nx = Math.abs(normals[i * 3]);
            const ny = Math.abs(normals[i * 3 + 1]);
            const nz = Math.abs(normals[i * 3 + 2]);
            let u = 0;
            let v = 0;
            if (nx >= ny && nx >= nz) {
                u = z;
                v = y;
            } else if (ny >= nx && ny >= nz) {
                u = x;
                v = z;
            } else {
                u = x;
                v = y;
            }
            uvs.push(u * tiling);
            uvs.push(v * tiling);
        }
        return uvs;
    }
    extractMaterialData(material) {
        if (!material) {
            return this._getDefaultMaterial();
        }
        const resolveTexture = (source)=>{
            if (!source) return null;
            if (source.device && source.width) return source;
            if (typeof source === 'number') {
                const asset = this.app.assets.get(source);
                if (asset && asset.resource) return asset.resource;
                return null;
            }
            if (source.data) return resolveTexture(source.data);
            return null;
        };
        let diffuseTexture = resolveTexture(material.diffuseMap);
        if (!diffuseTexture && material._assetReferences && material._assetReferences.diffuseMap) {
            const assetRef = material._assetReferences.diffuseMap;
            const assetId = assetRef.id || assetRef;
            const asset = this.app.assets.get(assetId);
            if (asset && asset.resource) {
                diffuseTexture = asset.resource;
            }
        }
        if (!diffuseTexture && material.parameters) {
            const paramNames = [
                'texture_diffuseMap',
                'tri_diffuseTex',
                'texture_0'
            ];
            for (const name of paramNames){
                if (material.parameters[name]) {
                    const tex = resolveTexture(material.parameters[name]);
                    if (tex) {
                        diffuseTexture = tex;
                        break;
                    }
                }
            }
        }
        let normalTexture = resolveTexture(material.normalMap);
        if (!normalTexture && material.parameters) {
            const paramNames = [
                'texture_normalMap',
                'tri_normalTex'
            ];
            for (const name of paramNames){
                if (material.parameters[name]) {
                    normalTexture = resolveTexture(material.parameters[name]);
                    if (normalTexture) break;
                }
            }
        }
        let roughnessTexture = resolveTexture(material.glossMap || material.metalnessMap);
        let baseColor = material.diffuse ? [
            material.diffuse.r,
            material.diffuse.g,
            material.diffuse.b
        ] : [
            1,
            1,
            1
        ];
        const opacity = material.opacity !== undefined ? material.opacity : 1.0;
        let roughness = 0.5;
        if (material.gloss !== undefined) roughness = 1.0 - material.gloss;
        else if (material.shininess !== undefined) roughness = 1.0 - material.shininess / 100;
        if (material.parameters && material.parameters['tri_glossiness']) {
            const val = material.parameters['tri_glossiness'].data;
            if (typeof val === 'number') roughness = 1.0 - (val > 1 ? val / 100 : val);
        }
        const metallic = material.metalness !== undefined ? material.metalness : 0.0;
        let emissive = [
            0,
            0,
            0
        ];
        if (material.emissive) {
            emissive = [
                material.emissive.r,
                material.emissive.g,
                material.emissive.b
            ];
        }
        return {
            name: material.name || `mat_${Math.floor(Math.random() * 1000)}`,
            baseColor: [
                ...baseColor,
                opacity
            ],
            metallic: metallic,
            roughness: roughness,
            emissive: emissive,
            diffuseMap: diffuseTexture,
            normalMap: normalTexture,
            roughnessMap: roughnessTexture,
            metallicMap: roughnessTexture
        };
    }
    _getDefaultMaterial() {
        return {
            name: 'default',
            baseColor: [
                1,
                1,
                1,
                1
            ],
            metallic: 0.0,
            roughness: 0.5
        };
    }
    getWorldTransform(entity) {
        const worldTransform = entity.getWorldTransform();
        const position = entity.getPosition();
        const rotation = entity.getRotation();
        const scale = entity.getLocalScale();
        return {
            position: [
                position.x,
                position.y,
                position.z
            ],
            rotation: [
                rotation.x,
                rotation.y,
                rotation.z,
                rotation.w
            ],
            scale: [
                scale.x,
                scale.y,
                scale.z
            ],
            matrix: worldTransform.data
        };
    }
    getStatistics(geometryData) {
        let totalVertices = 0, totalIndices = 0, totalMeshes = 0;
        const materials = new Set();
        geometryData.forEach((product)=>{
            product.meshes.forEach((meshData)=>{
                meshData.meshes.forEach((mesh)=>{
                    totalVertices += mesh.vertexCount;
                    totalIndices += mesh.indexCount;
                    totalMeshes++;
                    materials.add(mesh.material.name);
                });
            });
        });
        return {
            productCount: geometryData.length,
            totalMeshes: totalMeshes,
            totalVertices: totalVertices,
            totalIndices: totalIndices,
            totalTriangles: Math.floor(totalIndices / 3),
            uniqueMaterials: materials.size
        };
    }
    constructor(app){
        this.app = app;
        this.excludedGuids = new Set();
        this._debugLogged = false;
    }
}
_define_property(SceneCollector, "EXCLUDE_PATTERNS", [
    'UI',
    'Debug',
    'Helper',
    'Gizmo',
    'Tool',
    'Label',
    'Button',
    'DimensionTool',
    'SelectTool',
    '_cutter',
    'cutter_',
    'CSG_Tool'
]);

export { SceneCollector };
