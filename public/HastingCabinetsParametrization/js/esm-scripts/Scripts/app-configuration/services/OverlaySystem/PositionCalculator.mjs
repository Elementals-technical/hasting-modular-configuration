import { BoundingBox } from '../../../../../playcanvas-stable.min.mjs';

const AnchorType = {
    CENTER: 'center',
    FRONT: 'front',
    BACK: 'back',
    TOP: 'top',
    BOTTOM: 'bottom',
    LEFT: 'left',
    RIGHT: 'right'
};
class PositionCalculator {
    static getPosition(rootEntity, orientationEntity, config = {}) {
        const aabb = this.getFullHierarchyAABB(rootEntity);
        const center = aabb.center.clone();
        const half = aabb.halfExtents;
        const forward = orientationEntity.forward.clone().normalize();
        const up = orientationEntity.up.clone().normalize();
        const right = orientationEntity.right.clone().normalize();
        const result = center.clone();
        switch(config.face){
            case AnchorType.FRONT:
                result.sub(forward.mulScalar(half.z));
                break;
            case AnchorType.BACK:
                result.add(forward.mulScalar(half.z));
                break;
            case AnchorType.TOP:
                result.add(up.mulScalar(half.y));
                break;
            case AnchorType.BOTTOM:
                result.sub(up.mulScalar(half.y));
                break;
            case AnchorType.LEFT:
                result.sub(right.mulScalar(half.x));
                break;
            case AnchorType.RIGHT:
                result.add(right.mulScalar(half.x));
                break;
        }
        if (config.offset) {
            if (config.offset.x) result.add(right.clone().mulScalar(config.offset.x));
            if (config.offset.y) result.add(up.clone().mulScalar(config.offset.y));
            if (config.offset.z) result.add(forward.clone().mulScalar(config.offset.z));
        }
        return result;
    }
    static getFullHierarchyAABB(rootEntity) {
        const totalAABB = new BoundingBox();
        let isInitialized = false;
        const traverse = (node)=>{
            if (!node.enabled) return;
            let meshInstances = [];
            if (node.render) meshInstances = node.render.meshInstances;
            else if (node.model) meshInstances = node.model.meshInstances;
            if (meshInstances && meshInstances.length > 0) {
                meshInstances.forEach((mi)=>{
                    if (!isInitialized) {
                        totalAABB.copy(mi.aabb);
                        isInitialized = true;
                    } else {
                        totalAABB.add(mi.aabb);
                    }
                });
            }
            for (const child of node.children)traverse(child);
        };
        traverse(rootEntity);
        if (!isInitialized) {
            totalAABB.center.copy(rootEntity.getPosition());
            totalAABB.halfExtents.set(0.1, 0.1, 0.1);
        }
        return totalAABB;
    }
}

export { AnchorType, PositionCalculator };
