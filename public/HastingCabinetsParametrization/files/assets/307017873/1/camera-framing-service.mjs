import * as pc from 'playcanvas';

export class CameraFramingService {
    /**
     * @param {pc.Application} app
     * @param {object} [store] - CameraStore для синхронізації (опціонально)
     */
    constructor(app, store = null) {
        if (!app) console.error("CameraFramingService: App instance missing!");
        
        this.app = app;
        this.store = store; // Опціональний стор для координації
        this.debugEntity = null;

        // Internal configuration
        this.config = {
            paddingTall: 1.5,    // Fallback default for tall objects
            paddingWide: 1.25,   // Fallback default for wide objects
            minDistance: 0.5,
            maxDistance: 1000,
            debug: false
        };
    }

    /**
     * Updates configuration. 
     * Accepts { padding, minDistance, maxDistance, debug }
     * @param {Object} newConfig 
     */
    configure(newConfig) {
        Object.assign(this.config, newConfig);
    }

    /**
     * Centers and zooms the camera on the provided entities
     * @param {pc.Entity[]} entities
     * @param {pc.Entity} cameraEntity
     * @returns {boolean} True якщо успішно
     */
    focusOnEntities(entities, cameraEntity) {
        if (!this.app || !entities?.length) return false;
        if (!cameraEntity?.script?.orbitCamera) return false;

        // 1. Prepare geometry
        entities.forEach(e => e.syncHierarchy());
        const aabb = this._calculateCombinedAABB(entities);

        if (!aabb) return false;

        // 2. Visual Debug
        this._handleDebugVisuals(aabb);

        // 3. Calculate framing
        const orbit = cameraEntity.script.orbitCamera;
        
        orbit.pivotPoint.copy(aabb.center);

        const idealDistance = this._calculateIdealDistance(aabb, cameraEntity.camera);

        // 4. Apply settings
        this._applyCameraSettings(orbit, idealDistance);
        
        // 5. Оновити стор якщо він є
        if (this.store) {
            this.store.setPivotPoint(aabb.center);
            this.store.setDistance(idealDistance, 'auto-frame');
        }
        
        return true;
    }

    /**
     * Applies distance and updates camera limits
     * @private
     */
    _applyCameraSettings(orbit, distance) {
        // Expand limits if necessary
        if (distance < orbit.distanceMin) orbit.distanceMin = distance * 0.5;
        if (distance > orbit.distanceMax) orbit.distanceMax = distance * 1.5;

        // Reset inertia for instant transition
        orbit.inertiaFactor = 0;
        orbit.distance = distance;

        // Force update
        if (typeof orbit.update === 'function') {
            orbit.update(0);
        }
    }

    /**
     * Calculates ideal distance based on object proportions
     * @private
     */
    _calculateIdealDistance(aabb, camera) {
        const hx = aabb.halfExtents.x;
        const hy = aabb.halfExtents.y;
        const hz = aabb.halfExtents.z;

        const fov = (camera.fov || 45) * pc.math.DEG_TO_RAD;
        const aspect = (camera.aspectRatio > 0.1) ? camera.aspectRatio : (window.innerWidth / window.innerHeight);

        const distV = hy / Math.tan(fov / 2);
        const distH = hx / (Math.tan(fov / 2) * aspect);

        // Smart Padding: decide which padding to use based on object shape
        const isWide = distH > distV;
        const padding = isWide ? this.config.paddingWide : this.config.paddingTall;

        let distance = (Math.max(distV, distH) + hz) * padding;

        return pc.math.clamp(distance, this.config.minDistance, this.config.maxDistance);
    }

    /**
     * Recursively calculates AABB for enabled meshes only
     * @private
     */
    _calculateCombinedAABB(entities) {
        let aabb = null;

        const traverse = (node) => {
            // Ignore disabled nodes
            if (node.enabled === false) return;

            const meshInstances = node.render?.meshInstances || node.model?.meshInstances;

            if (meshInstances) {
                for (const mi of meshInstances) {
                    if (!mi.visible) continue;
                    
                    if (!aabb) {
                        aabb = new pc.BoundingBox();
                        aabb.copy(mi.aabb);
                    } else {
                        aabb.add(mi.aabb);
                    }
                }
            }

            for (const child of node.children) {
                traverse(child);
            }
        };

        entities.forEach(traverse);
        return aabb;
    }

    /**
     * @private
     */
    _handleDebugVisuals(aabb) {
        if (this.debugEntity) {
            this.debugEntity.destroy();
            this.debugEntity = null;
        }

        if (!this.config.debug) return;
        
        try {
            const material = new pc.StandardMaterial();
            material.diffuse = new pc.Color(1, 0, 0);
            material.opacity = 0.3;
            material.blendType = pc.BLEND_NORMAL;
            material.update();

            const box = new pc.Entity("DebugFramingBox");
            box.addComponent("render", { type: "box", material: material });
            
            box.setPosition(aabb.center);
            box.setLocalScale(aabb.halfExtents.clone().mulScalar(2));

            this.app.root.addChild(box);
            this.debugEntity = box;
        } catch (e) {
            console.warn(e);
        }
    }
}