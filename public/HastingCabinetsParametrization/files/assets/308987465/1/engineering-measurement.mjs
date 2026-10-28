import {Vec3} from 'playcanvas';
const fail=code=>Object.assign(new Error(code),{code});
/** Engine adapter pinned to the Launch engine's local GraphNode._enabled flag.
 * Public enabled includes disabled ancestors and cannot measure an isolated preview.
 * Refuse unknown engine shapes; never toggle a root on merely to measure it.
 */
export function measureDetachedEngineeringRoot(root){
    const min={x:Infinity,y:Infinity,z:Infinity},max={x:-Infinity,y:-Infinity,z:-Infinity};let count=0;
    const visit=(node,first=false)=>{
        if(!first){if(typeof node._enabled!=='boolean')throw fail('LOCAL_VISIBILITY_UNSUPPORTED');if(!node._enabled)return;}
        const component=node.render??node.model;
        if(component&&component.enabled!==false)for(const mi of component.meshInstances??[]){
            if(mi.visible===false)continue;
            const b=mi.mesh?.aabb;if(!b)throw fail('MESH_BOUNDS_MISSING');
            for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]){
                const p=node.getWorldTransform().transformPoint(new Vec3(b.center.x+x*b.halfExtents.x,b.center.y+y*b.halfExtents.y,b.center.z+z*b.halfExtents.z));
                for(const axis of ['x','y','z']){if(!Number.isFinite(p[axis]))throw fail('INVALID_MESH_BOUNDS');min[axis]=Math.min(min[axis],p[axis]);max[axis]=Math.max(max[axis],p[axis]);}
            }count++;
        }
        for(const child of node.children??[])visit(child);
    };visit(root,true);
    if(!count||['x','y','z'].some(k=>max[k]<=min[k]))throw fail('GEOMETRY_PENDING');
    return{min,max};
}
