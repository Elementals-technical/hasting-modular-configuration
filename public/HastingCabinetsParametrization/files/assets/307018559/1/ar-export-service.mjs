import { SceneCollector } from './scene-collector.mjs';
import { GLBExporter } from './glb-exporter.mjs';
import { USDZExporter } from './usdz-exporter.mjs';
import { DownloadHelper } from '../../helpers/download-helper.mjs';
import { CompositionManager } from '../../domain/composition/composition-manager.mjs';

/**
 * @class ARExportService
 * @classdesc Main service for orchestrating AR export workflow
 */
export class ARExportService {
    constructor(app) {
        this.app = app;
        this.sceneCollector = new SceneCollector(app);
    }

    /**
     * Creates a temporary root entity with all products for export
     */
    async _createExportEntity() {
        const compositionManager = CompositionManager.instance;
        const composition = compositionManager?.getActiveComposition();
        if (!composition) throw new Error('No active composition');

        const pc = window.pc || this.app.constructor;
        const rootEntity = new pc.Entity('AR_ExportRoot');
        this.app.root.addChild(rootEntity);

        const allProducts = composition.getAllProducts();
        const movedEntities = [];

        for (const productId of Object.keys(allProducts)) {
            const productEntity = this.app.root.findByName(productId);

            if (productEntity && productEntity.enabled) {
                const originalParent = productEntity.parent;
                const originalLocalPosition = productEntity.getLocalPosition().clone();
                const originalLocalRotation = productEntity.getLocalRotation().clone();
                const originalLocalScale = productEntity.getLocalScale().clone();

                movedEntities.push({
                    entity: productEntity,
                    originalParent: originalParent,
                    originalLocalPosition: originalLocalPosition,
                    originalLocalRotation: originalLocalRotation,
                    originalLocalScale: originalLocalScale
                });

                rootEntity.addChild(productEntity);
            }
        }
        return { rootEntity, movedEntities };
    }

    /**
     * Reconstructs a clean PC Entity hierarchy from raw Geometry Data.
     * Used specifically for generating the USDZ file via PlayCanvas UsdzExporter.
     */
    _createCleanHierarchyFromData(geometryData) {
        const pc = window.pc || this.app.constructor;
        const cleanRoot = new pc.Entity('USDZ_Clean_Root');
        this.app.root.addChild(cleanRoot);

        geometryData.forEach(productData => {
            productData.meshes.forEach(meshData => {
                meshData.meshes.forEach(meshInfo => {
                    const mesh = new pc.Mesh(this.app.graphicsDevice);
                    mesh.setPositions(meshInfo.positions);
                    mesh.setNormals(meshInfo.normals);
                    if (meshInfo.uvs && meshInfo.uvs.length > 0) {
                        mesh.setUvs(0, meshInfo.uvs);
                    }
                    mesh.setIndices(meshInfo.indices);
                    mesh.update();

                    const matData = meshInfo.material;
                    const material = new pc.StandardMaterial();
                    material.name = matData.name;

                    const col = matData.baseColor;
                    material.diffuse.set(col[0], col[1], col[2]);
                    material.opacity = col[3];

                    if (col[3] < 1.0) {
                        material.blendType = pc.BLEND_NORMAL;
                    }

                    if (matData.diffuseMap) {
                        material.diffuseMap = matData.diffuseMap;
                        material.diffuse.set(1, 1, 1);
                    }

                    if (matData.normalMap) {
                        material.normalMap = matData.normalMap;
                    }

                    if (matData.roughnessMap) {
                        material.glossMap = matData.roughnessMap;
                        material.metalnessMap = matData.roughnessMap;
                    } else if (matData.metallicMap) {
                        material.metalnessMap = matData.metallicMap;
                        material.glossMap = matData.metallicMap;
                    }

                    material.useMetalness = true;
                    material.metalness = matData.metallic;
                    material.gloss = 1.0 - matData.roughness;

                    if (matData.emissive && (matData.emissive[0] > 0 || matData.emissive[1] > 0)) {
                        material.emissive.set(matData.emissive[0], matData.emissive[1], matData.emissive[2]);
                    }

                    material.update();

                    const entity = new pc.Entity(meshInfo.name);
                    entity.addComponent('render', {
                        meshInstances: [new pc.MeshInstance(mesh, material)]
                    });

                    entity.setPosition(
                        meshData.transform.position[0],
                        meshData.transform.position[1],
                        meshData.transform.position[2]
                    );
                    entity.setRotation(
                        meshData.transform.rotation[0],
                        meshData.transform.rotation[1],
                        meshData.transform.rotation[2],
                        meshData.transform.rotation[3]
                    );
                    entity.setLocalScale(
                        meshData.transform.scale[0],
                        meshData.transform.scale[1],
                        meshData.transform.scale[2]
                    );

                    cleanRoot.addChild(entity);
                });
            });
        });

        return cleanRoot;
    }

    async exportToAR(format = 'both', options = {}) {
        let exportData = null;
        let usdzTempRoot = null;

        try {
            const exportOptions = {
                scaleToMeters: options.scaleToMeters || 1,
                metersPerUnit: options.metersPerUnit || 1,
                upAxis: options.upAxis || 'Y',
                maxTextureSize: options.maxTextureSize || 1024,
                filename: options.filename
            };

            exportData = await this._createExportEntity();
            const { rootEntity } = exportData;

            const geometryData = this.sceneCollector.collectGeometryFromEntity(rootEntity);

            const result = {};

            if (format === 'glb' || format === 'both') {
                const glbData = await GLBExporter.export(geometryData, exportOptions);
                result.glb = DownloadHelper.createBlob(glbData, 'model/gltf-binary');
            }

            if (format === 'usdz' || format === 'both') {
                usdzTempRoot = this._createCleanHierarchyFromData(geometryData);

                const scale = exportOptions.scaleToMeters;
                usdzTempRoot.setLocalScale(scale, scale, scale);

                const usdzData = await USDZExporter.export(this.app, usdzTempRoot, exportOptions);

                result.usdz = DownloadHelper.createBlob(usdzData, 'model/vnd.usdz+zip');
            }

            return result;

        } catch (error) {
            throw error;
        } finally {
            if (usdzTempRoot) {
                usdzTempRoot.destroy();
            }

            if (exportData && exportData.movedEntities) {
                exportData.movedEntities.forEach(({ entity, originalParent, originalLocalPosition, originalLocalRotation, originalLocalScale }) => {
                    originalParent.addChild(entity);
                    entity.setLocalPosition(originalLocalPosition);
                    entity.setLocalRotation(originalLocalRotation);
                    entity.setLocalScale(originalLocalScale);
                });
            }

            if (exportData && exportData.rootEntity) {
                exportData.rootEntity.destroy();
            }
        }
    }

    async downloadARFiles(format = 'both', options = {}) {
        try {
            const result = await this.exportToAR(format, options);
            const timestamp = Date.now();
            const baseName = options.filename || `composition_${timestamp}`;

            if (result.glb) {
                const glbData = await result.glb.arrayBuffer();
                DownloadHelper.downloadGLB(glbData, `${baseName}.glb`);
            }
            if (result.usdz) {
                const usdzData = await result.usdz.arrayBuffer();
                DownloadHelper.download(usdzData, `${baseName}.usdz`, 'model/vnd.usdz+zip');
            }
            return true;
        } catch (error) {
            return false;
        }
    }
    
    getExportPreview() {
        return this.sceneCollector.getExportPreview ? this.sceneCollector.getExportPreview() : {};
    }

    validate() {
        return this.sceneCollector.validate ? this.sceneCollector.validate() : { valid: true };
    }
}