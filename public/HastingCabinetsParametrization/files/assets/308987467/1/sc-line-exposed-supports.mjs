const finite=value=>typeof value==='number'&&Number.isFinite(value);
const name=value=>typeof value==='string'&&value.trim().length>0;
const span=(min,max)=>finite(min)&&finite(max)&&max>min;
const overlap=(aMin,aMax,bMin,bMax)=>Math.min(aMax,bMax)-Math.max(aMin,bMin);
const diagnostic=(code,sourceIds=[])=>({code,sourceIds:[...new Set(sourceIds)].sort()});
const result=(status,diagnostics)=>({status,supports:[],diagnostics});

/** Remove only the X footprint physically occluded by a contacting cabinet above.
 * The cover planner consumes one full-depth rectangular support per exposed piece;
 * partial-depth masks cannot be represented by that contract and fail closed.
 */
export function exposeSCLineSupports({supports,cabinetBoxes,tolerances}={}){
    if(!Array.isArray(supports)||!Array.isArray(cabinetBoxes)||!tolerances||
        !['contactM','adjacencyM','numericalM'].every(k=>finite(tolerances[k])&&tolerances[k]>=0))
        return result('unsupported',[diagnostic('EXPOSED_SUPPORT_INPUT_REQUIRED')]);
    const supportIds=new Set(),boxIds=new Set();
    for(const item of supports){
        if(!name(item?.supportId)||supportIds.has(item.supportId)||!name(item.cabinetId)||
            !name(item.productType)||!name(item.compatibilityKey)||!name(item.materialId)||
            !['direct','extension','none'].includes(item.eligibility)||
            !span(item.xMinM,item.xMaxM)||!span(item.zMinM,item.zMaxM)||!finite(item.yTopM))
            return result('unsupported',[diagnostic('EXPOSED_SUPPORT_INPUT_REQUIRED',[item?.supportId].filter(Boolean))]);
        supportIds.add(item.supportId);
    }
    for(const item of cabinetBoxes){
        const min=item?.min,max=item?.max;
        if(!name(item?.id)||boxIds.has(item.id)||
            !['x','y','z'].every(k=>span(min?.[k],max?.[k])))
            return result('unsupported',[diagnostic('CABINET_BOX_INPUT_REQUIRED',[item?.id].filter(Boolean))]);
        boxIds.add(item.id);
    }
    const output=[];
    for(const support of [...supports].sort((a,b)=>a.supportId.localeCompare(b.supportId))){
        const masks=[];
        for(const box of cabinetBoxes){
            if(box.id===support.cabinetId)continue;
            const xOverlap=overlap(support.xMinM,support.xMaxM,box.min.x,box.max.x);
            const zOverlap=overlap(support.zMinM,support.zMaxM,box.min.z,box.max.z);
            if(xOverlap<=tolerances.numericalM||zOverlap<=tolerances.numericalM)continue;
            if(box.min.y<support.yTopM-tolerances.numericalM&&
                box.max.y>support.yTopM+tolerances.numericalM)
                return result('invalid',[diagnostic('CABINET_PENETRATION',[support.cabinetId,box.id])]);
            if(Math.abs(box.min.y-support.yTopM)>tolerances.contactM)continue;
            if(box.min.z>support.zMinM+tolerances.numericalM||
                box.max.z<support.zMaxM-tolerances.numericalM)
                return result('unsupported',[diagnostic('PARTIAL_DEPTH_OCCLUSION',[support.cabinetId,box.id])]);
            masks.push([Math.max(support.xMinM,box.min.x),Math.min(support.xMaxM,box.max.x)]);
        }
        if(!masks.length){output.push(structuredClone(support));continue;}
        masks.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
        const merged=[];
        for(const mask of masks){
            const previous=merged.at(-1);
            if(previous&&mask[0]<=previous[1]+tolerances.numericalM)
                previous[1]=Math.max(previous[1],mask[1]);
            else merged.push([...mask]);
        }
        let cursor=support.xMinM,index=0;
        const piece=end=>{
            if(end-cursor>tolerances.numericalM)output.push({...structuredClone(support),
                supportId:`${support.supportId}:part:${index++}`,xMinM:cursor,xMaxM:end});
        };
        for(const [min,max] of merged){piece(min);cursor=Math.max(cursor,max);}
        piece(support.xMaxM);
    }
    const ids=output.map(item=>item.supportId);
    if(new Set(ids).size!==ids.length)return result('unsupported',[diagnostic('EXPOSED_SUPPORT_ID_CONFLICT')]);
    return{status:'ready',supports:output,diagnostics:[]};
}
