import { BoundingBox, app } from '../../../../../playcanvas-stable.min.mjs';
import { DividerDebugLogger } from '../drawer-divider/diagnostics/DividerDebugLogger.mjs';

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
class AutoPlacementService {
    /**
   * @param {"x" | "y" | "z"} value
   * @returns {AutoPlacementService} this
   */ setAxis(value) {
        this._axis = value;
        return this;
    }
    /**
   * Set gap between modules
   * @param {number} value
   */ setGap(value) {
        this._defaultGap = value;
        return this;
    }
    /**
   * Встановити список нод для ігнорування в AABB розрахунку
   * @param {string[]} nodeNames - Імена нод (перевіряються через includes)
   * @returns {AutoPlacementService} this
   */ setIgnoreNodes(nodeNames) {
        this._ignoreNodes = nodeNames || [];
        return this;
    }
    /**
   * Main method to calculate position relative to a reference entity.
   * @param {Entity} referenceEntity - Entity to align against
   * @param {Entity} newModel - Entity of the new object
   * @param {"left" | "right"} side - Side to place
   * @param {number} [gap] - Optional gap override
   * @returns {Vec3} position - New center position
   */ getPosition(referenceEntity, newModel, side, gap = this._defaultGap) {
        const traceId = DividerDebugLogger.nextTraceId('cabinet-layout-placement');
        const debugEnabled = DividerDebugLogger.isEnabled();
        // 1. Get dimensions of reference entity (on scene)
        const refAABB = this._getEntityAABB(referenceEntity, this._ignoreNodes);
        const refSize = this._getSizeOnAxis(refAABB, this._axis);
        const refHalfSize = refSize / 2;
        // 2. Get dimensions of new entity
        const newModelAABB = this._getEntityAABB(newModel, this._ignoreNodes);
        const newModelSize = this._getSizeOnAxis(newModelAABB, this._axis);
        const newHalfSize = newModelSize / 2;
        // 3. Calculate offset
        const offsetDistance = refHalfSize + gap + newHalfSize;
        // 4. Determine direction
        const direction = side === "right" ? 1 : -1;
        // 5. Get current position of reference
        const currentPos = referenceEntity.getPosition().clone();
        // 6. Modify specific axis
        if (this._axis === "x") {
            currentPos.x += offsetDistance * direction;
        } else if (this._axis === "y") {
            currentPos.y += offsetDistance * direction;
        } else if (this._axis === "z") {
            currentPos.z += offsetDistance * direction;
        }
        if (debugEnabled) {
            DividerDebugLogger.log('CabinetLayout.AutoPlacement.getPosition', 'Calculated cabinet placement offset from AABB', {
                traceId,
                referenceEntity: referenceEntity?.name,
                newModel: newModel?.name,
                side,
                axis: this._axis,
                gap,
                ignoredNodePatterns: this._ignoreNodes,
                direction,
                refSize: DividerDebugLogger._round(refSize),
                newModelSize: DividerDebugLogger._round(newModelSize),
                offsetDistance: DividerDebugLogger._round(offsetDistance),
                referencePosition: this._summarizeVec3(referenceEntity?.getPosition?.()),
                resultPosition: this._summarizeVec3(currentPos),
                refAabb: this._summarizeAabb(refAABB),
                newModelAabb: this._summarizeAabb(newModelAABB),
                refRawAabb: this._summarizeAabb(this._getEntityAABB(referenceEntity, [])),
                newModelRawAabb: this._summarizeAabb(this._getEntityAABB(newModel, [])),
                refAabbContributors: this._summarizeAabbContributors(referenceEntity, this._ignoreNodes),
                newModelAabbContributors: this._summarizeAabbContributors(newModel, this._ignoreNodes)
            });
        }
        return currentPos;
    }
    /**
   * Helper method to measure entity size on a specific axis.
   * Useful for external builders like PositionBuilder.
   * @param {Entity} entity
   * @param {"x" | "y" | "z"} axis
   * @returns {number}
   */ measureEntitySize(entity, axis = "x") {
        const aabb = this._getEntityAABB(entity, this._ignoreNodes);
        return this._getSizeOnAxis(aabb, axis);
    }
    // --- INTERNAL HELPERS ---
    /**
   * Get AABB size on specific axis
   * @param {BoundingBox} aabb
   * @param {"x" | "y" | "z"} axis
   * @returns {number}
   */ _getSizeOnAxis(aabb, axis) {
        const fullSize = aabb.halfExtents.clone().mulScalar(2);
        if (axis === "x") return fullSize.x;
        if (axis === "y") return fullSize.y;
        return fullSize.z;
    }
    _summarizeVec3(vec) {
        if (!vec) return null;
        return {
            x: DividerDebugLogger._round(vec.x),
            y: DividerDebugLogger._round(vec.y),
            z: DividerDebugLogger._round(vec.z)
        };
    }
    _summarizeAabb(aabb) {
        if (!aabb) return null;
        const size = aabb.halfExtents?.clone?.().mulScalar?.(2);
        return {
            center: this._summarizeVec3(aabb.center),
            halfExtents: this._summarizeVec3(aabb.halfExtents),
            size: this._summarizeVec3(size)
        };
    }
    _summarizeAabbContributors(entity, ignoreNodes = []) {
        if (!entity) return null;
        const ignoreList = [
            "BotDrawerFramingDD",
            "BotDrawerFramingSD",
            'CabinetHideWall',
            ...ignoreNodes
        ];
        const contributors = [];
        const ignored = [];
        const disabled = [];
        const summarizeMeshGroup = (node, meshInstances, path, state)=>{
            const aabb = new BoundingBox();
            let initialized = false;
            for (const mi of meshInstances){
                if (!mi?.aabb) continue;
                if (!initialized) {
                    aabb.copy(mi.aabb);
                    initialized = true;
                } else {
                    aabb.add(mi.aabb);
                }
            }
            if (!initialized) return null;
            const size = aabb.halfExtents.clone().mulScalar(2);
            const min = aabb.center.clone().sub(aabb.halfExtents);
            const max = aabb.center.clone().add(aabb.halfExtents);
            const smartStretch = node.script?.smartStretch;
            return {
                name: node.name,
                path,
                enabled: Boolean(node.enabled),
                enabledInHierarchy: state.enabledInHierarchy,
                ignored: Boolean(state.ignoredBy),
                ignoredBy: state.ignoredBy,
                meshCount: meshInstances.length,
                center: this._summarizeVec3(aabb.center),
                size: this._summarizeVec3(size),
                min: this._summarizeVec3(min),
                max: this._summarizeVec3(max),
                localPosition: this._summarizeVec3(node.getLocalPosition?.()),
                worldPosition: this._summarizeVec3(node.getPosition?.()),
                stretch: smartStretch?.stretchAmount ? this._summarizeVec3(smartStretch.stretchAmount) : null
            };
        };
        const walk = (node, path, parentState)=>{
            if (!node) return;
            const ignoredBy = parentState.ignoredBy || ignoreList.find((ignoredName)=>node.name.includes(ignoredName)) || null;
            const enabledInHierarchy = parentState.enabledInHierarchy && Boolean(node.enabled);
            const state = {
                ignoredBy,
                enabledInHierarchy
            };
            const meshInstances = [
                ...node.render?.meshInstances || [],
                ...node.model?.meshInstances || []
            ];
            const summary = meshInstances.length > 0 ? summarizeMeshGroup(node, meshInstances, path, state) : null;
            if (summary) {
                if (ignoredBy) {
                    ignored.push(summary);
                } else if (!enabledInHierarchy) {
                    disabled.push(summary);
                } else {
                    contributors.push(summary);
                }
            }
            for (const child of node.children || []){
                walk(child, `${path}/${child.name}`, state);
            }
        };
        walk(entity, entity.name, {
            ignoredBy: null,
            enabledInHierarchy: true
        });
        const byWidth = contributors.slice().sort((a, b)=>(b.size?.x || 0) - (a.size?.x || 0)).slice(0, 12);
        const leftEdge = contributors.slice().sort((a, b)=>(a.min?.x || 0) - (b.min?.x || 0)).slice(0, 6);
        const rightEdge = contributors.slice().sort((a, b)=>(b.max?.x || 0) - (a.max?.x || 0)).slice(0, 6);
        return {
            entity: entity.name,
            ignoredNodePatterns: ignoreList,
            includedMeshNodeCount: contributors.length,
            ignoredMeshNodeCount: ignored.length,
            disabledMeshNodeCount: disabled.length,
            widestIncluded: byWidth,
            leftEdgeIncluded: leftEdge,
            rightEdgeIncluded: rightEdge,
            ignoredByWidth: ignored.slice().sort((a, b)=>(b.size?.x || 0) - (a.size?.x || 0)).slice(0, 8),
            disabledByWidth: disabled.slice().sort((a, b)=>(b.size?.x || 0) - (a.size?.x || 0)).slice(0, 8)
        };
    }
    /**
   * Calculates actual BoundingBox for entity.
   * Accounts for all MeshInstances in hierarchy.
   * @param {Entity} entity
   * @param {string[]} [ignoreNodes] - Імена нод які ігнорувати в AABB розрахунку
   * @returns {BoundingBox}
   */ _getEntityAABB(entity, ignoreNodes = []) {
        const aabb = new BoundingBox();
        const ignoreList = [
            "BotDrawerFramingDD",
            "BotDrawerFramingSD",
            'CabinetHideWall',
            ...ignoreNodes
        ];
        // The node's own flag, not `enabled` (own && enabledInHierarchy): PositionBuilder measures
        // entity.clone()s that are outside the scene graph, where `enabled` is false on every node, so
        // the enabled-only pass found nothing and the fallback measured hidden variants too (a Mako
        // 40 cm cabinet measured 60 cm through its disabled Class drawers - a 10 cm gap in the row).
        const isOwnEnabled = (node)=>(node._enabled ?? node.enabled) !== false;
        const collectMeshes = (node, meshesArray, enabledOnly, isRoot = false)=>{
            if (!node) return;
            if (ignoreList.some((ignored)=>node.name.includes(ignored))) {
                return;
            }
            // Skip disabled nodes when enabledOnly is true (the measured root itself always counts)
            if (enabledOnly && !isRoot && !isOwnEnabled(node)) {
                return;
            }
            if (node.render) {
                meshesArray.push(...node.render.meshInstances);
            }
            if (node.model) {
                meshesArray.push(...node.model.meshInstances);
            }
            for (const child of node.children){
                collectMeshes(child, meshesArray, enabledOnly);
            }
        };
        // Try enabled-only first
        const enabledMeshes = [];
        collectMeshes(entity, enabledMeshes, true, true);
        // Fallback to all meshes if no enabled found (e.g. during initialization)
        const meshes = enabledMeshes.length > 0 ? enabledMeshes : [];
        if (meshes.length === 0) {
            collectMeshes(entity, meshes, false);
        }
        let isInitialized = false;
        meshes.forEach((mi)=>{
            if (!isInitialized) {
                aabb.copy(mi.aabb);
                isInitialized = true;
            } else {
                aabb.add(mi.aabb);
            }
        });
        if (!isInitialized) {
            aabb.center.copy(entity.getPosition());
            aabb.halfExtents.set(0, 0, 0);
        }
        return aabb;
    }
    constructor(){
        _define_property(this, "_disabledNodes", new Set());
        _define_property(this, "_ignoreNodes", []);
        /**
   * @param {"x" | "y" | "z"} axis
   */ _define_property(this, "_axis", "x");
        this.app = app;
        this._defaultGap = 0.0;
    }
}

export { AutoPlacementService };
