import {Vec3} from 'playcanvas';
import {SmartStretch} from '../../../../SmartStretch.mjs';
import {readTemplateGeometry} from './template-geometry-metadata.mjs';

const fail=(code,cause)=>Object.assign(new Error(code,{cause}),{code});
const meshInstances=node=>node.render?.meshInstances??node.model?.meshInstances??[];

/** Geometry resources for uncut SC/OS engineering previews. Uses the existing SmartStretch
 * class, kept disabled and initialized explicitly on the detached subtree. No keyboard,
 * app update, global CSG queue, production controller or material singleton is started.
 * Enabled cuts are deliberately unsupported; this is not the SB geometry provider.
 */
export function createIsolatedTemplateGeometry({app,SmartStretchType=SmartStretch}={}){
    if(!app?.graphicsDevice)throw fail('GRAPHICS_DEVICE_REQUIRED');
    const owned=new WeakSet();
    return {async prepare(root,{signal,uncutTargetNames=[]}={}){
        if(!root||root.parent||root.enabled!==false)throw fail('ISOLATED_ROOT_REQUIRED');
        if(signal?.aborted)throw fail('CANCELLED');
        if(owned.has(root))throw fail('GEOMETRY_ALREADY_OWNED');
        const entries=[],uncut=new Set(uncutTargetNames);
        const visit=node=>{const data=readTemplateGeometry(node);if(data&&(data.stretch||data.boolean||uncut.has(node.name)))
            entries.push({node,data:{...data,boolean:data.boolean||uncut.has(node.name)}});
            for(const child of node.children??[])visit(child);};
        visit(root);
        if(!entries.length)throw fail('TEMPLATE_GEOMETRY_METADATA_MISSING');
        for(const {node}of entries){
            if(node.script)throw fail('ISOLATED_SCRIPTS_REQUIRED');
            // SmartStretch currently deforms exactly one mesh instance; never silently ignore others.
            if(meshInstances(node).length!==1||!meshInstances(node)[0]?.mesh)throw fail('TEMPLATE_MESH_UNSUPPORTED');
        }
        owned.add(root);const resources=[];let disposal=null,closed=false;
        const dispose=()=>{
            if(disposal)return disposal;closed=true;
            disposal=(async()=>{
                const errors=[];
                for(const resource of [...resources].reverse()){
                    const {node,original,mi}=resource;
                    const generated=resource.ownedMesh??resource.stretch?._ownedMesh;
                    try{mi.mesh=original;}catch(error){errors.push(error);}
                    try{node.removeComponent('script');}catch(error){errors.push(error);}
                    if(generated&&generated!==original)try{generated.destroy();}catch(error){errors.push(error);}
                }
                if(errors.length)throw fail('RECOVERY_REQUIRED',new AggregateError(errors,'Geometry cleanup failed'));
                owned.delete(root);
            })();return disposal;
        };
        try{
            for(const {node,data}of entries){
                if(signal?.aborted)throw fail('CANCELLED');
                const mi=meshInstances(node)[0],record={node,mi,original:mi.mesh,stretch:null};resources.push(record);
                node.addComponent('script',{enabled:false});
                if(data.stretch){
                    const stretch=node.script.create(SmartStretchType,{enabled:false,preloading:true});
                    if(!stretch)throw fail('STRETCH_CREATION_FAILED');record.stretch=stretch;
                    stretch.margin=new Vec3(data.stretch.margin.x,data.stretch.margin.y,data.stretch.margin.z);
                    stretch.stretchAmount=new Vec3(data.stretch.stretchAmount.x,data.stretch.stretchAmount.y,data.stretch.stretchAmount.z);
                    stretch.initialize();
                    if(!stretch._basePositions?.length||mi.mesh===record.original)throw fail('STRETCH_GEOMETRY_PENDING');
                    record.ownedMesh=mi.mesh;
                }
                if(data.boolean){
                    // Compatibility surface for SC's explicit no-cut rule, not a scheduled CSG script.
                    const source=mi.mesh;
                    const assertUncut=()=>{if(closed)throw fail('GEOMETRY_DISPOSED');if(signal?.aborted)throw fail('CANCELLED');
                        if(mi.mesh!==source)throw fail('UNCUT_GEOMETRY_CHANGED');return{status:'success',generated:false};};
                    node.script.meshBoolean={runOnStart:false,_sourceMesh:source,
                        get booleanEnabled(){return false;},set booleanEnabled(value){if(value!==false)throw fail('ISOLATED_CSG_UNSUPPORTED');},
                        get cutters(){return[];},set cutters(value){if(value?.length)throw fail('ISOLATED_CSG_UNSUPPORTED');},
                        cacheSourceMesh:()=>source,performBoolean:assertUncut,
                        requestBoolean:()=>{try{return Promise.resolve(assertUncut());}catch(error){
                            const rejected=Promise.reject(error);rejected.catch(()=>{});return rejected;
                        }}};
                }
            }
            const verify=async()=>{
                if(closed)throw fail('GEOMETRY_DISPOSED');if(signal?.aborted)throw fail('CANCELLED');
                for(const {node,mi,stretch,ownedMesh,original}of resources){
                    if(!node.script||node.script.enabled!==false||!mi.mesh||
                        mi.mesh!==(ownedMesh??original)||
                        (stretch&&!stretch._basePositions?.length))throw fail('GEOMETRY_NOT_READY');
                }
                return{status:'ready',mode:'uncut-only',parts:resources.length};
            };
            await verify();return Object.freeze({verify,dispose});
        }catch(error){await dispose();throw error;}
    }};
}
