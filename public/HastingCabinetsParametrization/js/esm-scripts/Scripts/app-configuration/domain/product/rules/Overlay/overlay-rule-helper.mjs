import { LoggerService } from '../../../../services/logger/logger-service.mjs';
import { SceneEntityHelper } from '../../../../helpers/scene-entity-helper.mjs';

class OverlayRuleHelper {
    /**
   * Clone overlay group from scene template and attach to product
   *
   * @param {string} templateGroupName - e.g., 'CabinetUniBox_Overlay'
   * @param {Entity} productEntity - Product root entity
   * @param {Application} app
   * @returns {Entity|null} Cloned overlay root or null if template not found
   */ static cloneAndAttachOverlays(templateGroupName, productEntity, app) {
        const template = app.root.findByName(templateGroupName);
        if (!template) {
            LoggerService.log(this, `[OverlayRuleHelper] Template not found: ${templateGroupName}`);
            return null;
        }
        // Clone the entire overlay template
        const clone = template.clone();
        clone.name = `${templateGroupName}_${productEntity.name}`;
        clone.enabled = false; // Start disabled, rules will enable
        // Attach overlay children to matching _Point parents in product
        this._attachOverlayChildren(clone, productEntity);
        LoggerService.log(this, `[OverlayRuleHelper] Cloned and attached overlays`, {
            template: templateGroupName,
            product: productEntity.name
        });
        return clone;
    }
    /**
   * Recursively attach overlay children to matching parent points in product
   * Maps overlay point names to original point names by removing '_Overlay' suffix
   *
   * e.g., 'CabinetMove_Overlay_Point' children → 'CabinetMove_Point' in product
   *
   * @param {Entity} overlayGroup - Cloned overlay group
   * @param {Entity} productEntity - Product root entity
   * @private
   */ static _attachOverlayChildren(overlayGroup, productEntity) {
        // Find all entities ending with _Overlay_Point
        const overlayPoints = this._collectOverlayPoints(overlayGroup);
        overlayPoints.forEach((overlayPoint)=>{
            // Convert 'CabinetMove_Overlay_Point' → 'CabinetMove_Point'
            const originalPointName = overlayPoint.name.replace("_Overlay_Point", "_Point");
            const originalPoint = productEntity.findByName(originalPointName);
            if (originalPoint) {
                // Move all children from overlay point to original point
                const children = [
                    ...overlayPoint.children
                ];
                children.forEach((child)=>{
                    // Reparent the child to original point
                    overlayPoint.removeChild(child);
                    originalPoint.addChild(child);
                    child.enabled = false; // Start disabled
                    LoggerService.log(this, `[OverlayRuleHelper] Attached overlay child`, {
                        child: child.name,
                        to: originalPoint.name
                    });
                });
            } else {
                LoggerService.log(this, `[OverlayRuleHelper] Original point not found for overlay`, {
                    overlayPoint: overlayPoint.name,
                    expected: originalPointName
                });
            }
        });
    }
    /**
   * Collect all entities ending with _Overlay_Point
   *
   * @param {Entity} rootEntity - Root to search from
   * @returns {Entity[]} Array of overlay point entities
   * @private
   */ static _collectOverlayPoints(rootEntity) {
        return SceneEntityHelper.collectByPredicate(rootEntity, (entity)=>entity.name.endsWith("_Overlay_Point"));
    }
    /**
   * Check if overlays have already been cloned for this product
   *
   * @param {Entity} productEntity - Product entity to check
   * @param {string[]} overlayNames - List of overlay entity names to look for
   * @returns {boolean} True if overlays exist
   */ static hasOverlays(productEntity, overlayNames) {
        const found = SceneEntityHelper.collectByNames(productEntity, overlayNames);
        return found.length > 0;
    }
    /**
   * Apply texture config to all triPlanarMapping scripts on overlay entities
   *
   * @param {Entity} productEntity - Product entity containing overlays
   * @param {string[]} overlayNames - List of overlay entity names
   * @param {Object} textureConfig - Texture configuration object
   * @param {string} textureConfig.normal - Normal texture asset name
   * @param {string} textureConfig.ao - AO texture asset name
   * @param {number} textureConfig.tiling - Detail tiling value
   * @param {number} textureConfig.bumpiness - Detail bumpiness value
   * @param {number} textureConfig.intensity - AO intensity value
   * @param {Application} app - PlayCanvas application
   * @returns {Promise<void>}
   */ static async applyTextureConfig(productEntity, overlayNames, textureConfig, app) {
        const { normal, ao, tiling, bumpiness, intensity } = textureConfig;
        // Load textures in parallel
        const [normalTexture, aoTexture] = await Promise.all([
            this._loadTexture(normal, app),
            this._loadTexture(ao, app)
        ]);
        // Find overlay entities
        const overlays = SceneEntityHelper.collectByNames(productEntity, overlayNames);
        let appliedCount = 0;
        overlays.forEach((entity)=>{
            const triPlanar = entity.script?.triPlanarMapping;
            if (!triPlanar) {
                LoggerService.log(this, `[OverlayRuleHelper] No triPlanarMapping script on entity`, {
                    entity: entity.name
                });
                return;
            }
            // Set texture attributes
            if (normalTexture) {
                triPlanar.detailNormalMap = normalTexture;
            }
            if (aoTexture) {
                triPlanar.aoMap = aoTexture;
            }
            triPlanar.detailTiling = tiling;
            triPlanar.detailBumpiness = bumpiness;
            triPlanar.aoIntensity = intensity;
            triPlanar.makeUnique = true; // Ensure unique material instance
            if (entity.script.triPlanarMapping && typeof entity.script.triPlanarMapping.refreshMaterials === "function") {
                entity.script.triPlanarMapping.refreshMaterials();
            }
            // SmartStretch
            if (entity.script.smartStretch && typeof entity.script.smartStretch.refreshMaterials === "function") {
                entity.script.smartStretch.refreshMaterials();
            }
            // MeshBoolean
            if (entity.script.meshBoolean && typeof entity.script.meshBoolean.performBoolean === "function") {
                entity.script.meshBoolean.performBoolean();
            }
            appliedCount++;
        });
        LoggerService.log(this, `[OverlayRuleHelper] Applied texture config`, {
            product: productEntity.name,
            overlayCount: appliedCount,
            normal,
            ao,
            tiling
        });
    }
    /**
   * Load texture asset by name
   *
   * @param {string} textureName - Texture asset name
   * @param {Application} app - PlayCanvas application
   * @returns {Promise<Asset|null>} Loaded texture asset or null
   * @private
   */ static _loadTexture(textureName, app) {
        return new Promise((resolve)=>{
            const asset = app.assets.find(`${textureName}.jpg`, "texture");
            if (!asset) {
                LoggerService.log(this, `[OverlayRuleHelper] Texture not found: ${textureName}`);
                resolve(null);
                return;
            }
            // If already loaded, resolve immediately
            if (asset.resource) {
                resolve(asset);
                return;
            }
            // Load and wait for ready
            app.assets.load(asset);
            asset.ready(()=>resolve(asset));
        });
    }
    /**
   * Enable or disable overlay entities
   *
   * @param {Entity} productEntity - Product entity containing overlays
   * @param {string[]} overlayNames - List of overlay entity names
   * @param {boolean} enabled - Enable/disable state
   */ static setOverlaysEnabled(productEntity, overlayNames, enabled) {
        const overlays = SceneEntityHelper.collectByNames(productEntity, overlayNames);
        overlays.forEach((entity)=>{
            entity.enabled = enabled;
        });
        LoggerService.log(this, `[OverlayRuleHelper] Set overlays enabled: ${enabled}`, {
            product: productEntity.name,
            count: overlays.length,
            names: overlays.map((e)=>e.name)
        });
    }
    /**
   * Destroy (remove) overlay entities from product
   *
   * @param {Entity} productEntity - Product entity containing overlays
   * @param {string[]} overlayNames - List of overlay entity names to destroy
   */ static destroyOverlays(productEntity, overlayNames) {
        const overlays = SceneEntityHelper.collectByNames(productEntity, overlayNames);
        overlays.forEach((entity)=>{
            entity.destroy();
        });
        LoggerService.log(this, `[OverlayRuleHelper] Destroyed overlays`, {
            product: productEntity.name,
            count: overlays.length
        });
    }
    /**
   * Get triPlanarMapping script from entity
   *
   * @param {Entity} entity - Entity to get script from
   * @returns {Script|null} triPlanarMapping script or null
   */ static getTriPlanarScript(entity) {
        return entity.script?.triPlanarMapping || null;
    }
    /**
     * Applies a base material (e.g. CabinetColor) to overlay entities.
     * Uses fuzzy search (includes) to find cloned entities with suffixes.
     *
     * @param {Entity} productEntity - The root product entity
     * @param {string[]} overlayPartialNames - List of names to look for (e.g. ['CabinetUniBody_Overlay'])
     * @param {Material} materialResource - The material to apply
     */ static applyBaseMaterial(productEntity, overlayPartialNames, materialResource) {
        if (!materialResource) return;
        // 1. Helper to collect all children recursively
        const collectAll = (node, list)=>{
            if (node !== productEntity) list.push(node);
            for (const child of node.children){
                collectAll(child, list);
            }
        };
        const allChildren = [];
        collectAll(productEntity, allChildren);
        // 2. Filter entities that match the overlay names
        const targets = allChildren.filter((child)=>{
            return overlayPartialNames.some((name)=>child.name.includes(name));
        });
        // 3. Apply material
        let count = 0;
        targets.forEach((mesh)=>{
            let changed = false;
            // Render Component
            if (mesh.render && mesh.render.meshInstances) {
                mesh.render.meshInstances.forEach((mi)=>{
                    mi.material = materialResource;
                    changed = true;
                });
            }
            // Model Component (Legacy)
            if (mesh.model && mesh.model.meshInstances) {
                mesh.model.meshInstances.forEach((mi)=>{
                    mi.material = materialResource;
                    changed = true;
                });
            }
            if (changed) {
                count++;
                // Refresh Triplanar logic to pick up new base material
                if (mesh.script?.triPlanarMapping?.onValidate) {
                    mesh.script.triPlanarMapping.onValidate();
                }
            }
        });
        LoggerService.log(this, `[OverlayRuleHelper] Applied base material to ${count} overlays`);
    }
}

export { OverlayRuleHelper };
