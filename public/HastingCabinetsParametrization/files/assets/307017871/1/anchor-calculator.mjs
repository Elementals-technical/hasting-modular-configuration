import { Vec3, BoundingBox } from "playcanvas";
import { ProductRegistry_V2 } from "../../domain/product/registry/product-registry-v2.mjs";

export class AnchorCalculator {

    static calculateAnchors(entities) {
        const registry = ProductRegistry_V2.instance;
        const result = [];

        entities.forEach(entity => {
            const ignoreNodes = registry.getAabbIgnoreNodesByEntity(entity.name);
            const aabb = this._getFullHierarchyAABB(entity, ignoreNodes);
            if (!aabb) return;

            const center = aabb.center;
            const half = aabb.halfExtents;

            const marginX = 0.0;
            const zFront = center.z + half.z;

            const leftPos = new Vec3(center.x - half.x - marginX, center.y, zFront);
            const rightPos = new Vec3(center.x + half.x + marginX, center.y, zFront);

            result.push({
                entity: entity,
                left: leftPos,
                right: rightPos,
                // The bottom of the cabinet geometry: the UF "+" height is set from it (SceneManager._applyUFHeightRule).
                bottomY: center.y - half.y
            });
        });

        return result;
    }

    static _getFullHierarchyAABB(rootEntity, ignoreNodes = []) {
        const totalAABB = new BoundingBox();
        let isInitialized = false;

        const traverse = (node) => {
            if (!node.enabled) return;
            if (ignoreNodes.length > 0 && ignoreNodes.some(name => node.name.includes(name))) return;

            let meshInstances = [];
            if (node.render) meshInstances = node.render.meshInstances;
            else if (node.model) meshInstances = node.model.meshInstances;

            if (meshInstances && meshInstances.length > 0) {
                meshInstances.forEach(mi => {
                    if (!isInitialized) {
                        totalAABB.copy(mi.aabb);
                        isInitialized = true;
                    } else {
                        totalAABB.add(mi.aabb);
                    }
                });
            }

            for (const child of node.children) {
                traverse(child);
            }
        };

        traverse(rootEntity);

        return isInitialized ? totalAABB : null;
    }
}
