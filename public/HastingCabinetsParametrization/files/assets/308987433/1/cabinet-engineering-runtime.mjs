import {measureDetachedEngineeringRoot as measureDetached} from '../../domain/cabinet-placement/engineering/engineering-measurement.mjs';
import {createCabinetRuntimePlugin} from './cabinet-runtime.plugin.mjs';
import {CompositionStore} from '../../domain/composition/composition-store.mjs';
import {ProductFactory} from '../../domain/product/factory/product-factory.mjs';
import {createULHEngineeringProfile,translateEngineeringBox,engineeringBoxesOverlap} from '../../domain/cabinet-placement/engineering/ulh-engineering-profile.mjs';
import {createEngineeringPlacement} from '../../domain/cabinet-placement/engineering/ulh-engineering-profile.mjs';
import {createIsolatedTemplateGeometry} from '../../domain/cabinet-placement/adapters/isolated-template-geometry.mjs';
import {createIsolatedProductConfigurator} from '../../domain/cabinet-placement/adapters/isolated-product-configurator.mjs';
import {createProductPreviewAdapter} from '../../domain/cabinet-placement/adapters/product-preview-adapter.mjs';
import {canonicalKey,cloneData} from '../../domain/cabinet-placement/cabinet-contracts.mjs';
import {RuleVisibleULHSideCabinet} from '../../domain/product/rules/UrbanLowHeight/RuleVisibleULHSideCabinet.mjs';
import {RuleWidthULHCabinet} from '../../domain/product/rules/UrbanLowHeight/RuleWidthULHCabinet.mjs';
import {RuleHeightULHCabinet} from '../../domain/product/rules/UrbanLowHeight/RuleHeightULHCabinet.mjs';
import {RuleDepthULHCabinet} from '../../domain/product/rules/UrbanLowHeight/RuleDepthULHCabinet.mjs';
import {RuleHandleULHCabinet} from '../../domain/product/rules/UrbanLowHeight/RuleHandleULHCabinet.mjs';
import {RuleVisibleULHOpenShelves} from '../../domain/product/rules/UrbanLowHeight/OpenShelves/RuleVisibleULHOpenShelves.mjs';
import {RuleWidthULHOpenShelves} from '../../domain/product/rules/UrbanLowHeight/OpenShelves/RuleWidthULHOpenShelves.mjs';
import {RuleHeightULHOpenShelves} from '../../domain/product/rules/UrbanLowHeight/OpenShelves/RuleHeightULHOpenShelves.mjs';
import {RuleDepthULHOpenShelves} from '../../domain/product/rules/UrbanLowHeight/OpenShelves/RuleDepthULHOpenShelves.mjs';

const fail=code=>Object.assign(new Error(code),{code});
const manifest={
    'ULH-side-cabinet':[RuleVisibleULHSideCabinet,RuleWidthULHCabinet,RuleHeightULHCabinet,RuleDepthULHCabinet,RuleHandleULHCabinet],
    'ULH-Open-Shelf':[RuleVisibleULHOpenShelves,RuleWidthULHOpenShelves,RuleHeightULHOpenShelves,RuleDepthULHOpenShelves]
};
/** Explicit engineering sandbox. A private manager owns only a new, empty lab root.
 * Never adopts, pauses, writes, exports or clears the user's legacy composition.
 * No production orders/material mapping/CSG/derived elements are available here.
 */
export function createCabinetEngineeringRuntime({app}){
    const profile=createULHEngineeringProfile(),id=profile.initialDocument.id;
    const lab=new pc.Entity('ULH ENGINEERING — NOT FOR ORDER'),drafts=new pc.Entity('Engineering previews');
    app.root.addChild(lab);lab.addChild(drafts);
    const manager={_compositions:new Map([[id,new CompositionStore(id,'engineering')]]),
        getActiveComposition(){return this._compositions.get(id);},getComposition(key){return this._compositions.get(key);}};
    const host={root:lab,compositionManager:manager},factory=new ProductFactory({app});
    const geometry=createIsolatedTemplateGeometry({app}),handles=new WeakMap(),bounds=new WeakMap(),cache=new Map();
    const key=(type,config)=>canonicalKey({type,config});
    let selected=null,probeId=0,portableId=0,closed=false;
    const configure=createIsolatedProductConfigurator({
        resolvePlan:({productType})=>manifest[productType]?{status:'ready',rules:manifest[productType].map((rule,i)=>({rule,priority:(i+1)*10}))}:{status:'unsupported'},
        prepareGeometry:async(entity,options)=>{
            const handle=await geometry.prepare(entity,{...options,uncutTargetNames:options.productType==='ULH-side-cabinet'
                ?['ULH_Drawer_Floor','ULH_Drawer_BWall','ULH_Cabinet_Walls']:[]});handles.set(entity,handle);
            return{verify:handle.verify,dispose:async()=>{await handle.dispose();handles.delete(entity);bounds.delete(entity);}};},
        verifyGeometry:({entity,productType,config})=>{
            const box=measureDetached(entity),offset={x:(box.min.x+box.max.x)/2,y:box.min.y,z:box.min.z};
            for(const child of entity.children){const p=child.getLocalPosition();child.setLocalPosition(p.x-offset.x,p.y-offset.y,p.z-offset.z);}
            const normalized=translateEngineeringBox(box,{x:-offset.x,y:-offset.y,z:-offset.z});
            bounds.set(entity,normalized);cache.set(key(productType,config),normalized);return{status:'ready'};
        }
    });
    const getBounds=choice=>{const r=profile.catalog.resolveChoice(choice);return r.status==='valid'?cache.get(key(r.runtime.productType,r.runtime.config)):null;};
    const probes=new Set();
    const measureChoice=async choice=>{
        if(closed)throw fail('API_DESTROYED');
        const cached=getBounds(choice);if(cached)return cloneData(cached);
        const r=profile.catalog.resolveChoice(choice);if(r.status!=='valid')throw fail('INVALID_CONFIGURATION');
        const job=(async()=>{
            const entity=await factory.createProductEntity(r.runtime.productType,r.runtime.config,{purpose:'preview',productId:`engineering-probe-${++probeId}`});
            let release;try{release=await configure(entity,r.runtime.config,{productType:r.runtime.productType});return cloneData(bounds.get(entity));}
            finally{try{await release?.();}finally{entity.destroy();}}
        })();probes.add(job);try{return await job;}finally{probes.delete(job);}
    };
    const preview=createProductPreviewAdapter({factory,previewRoot:drafts,configure,measure:entity=>({status:'ready',bounds:bounds.get(entity)}),
        // Option handles are resolved by the application service during evaluate below.
        resolvePlacement:p=>p.kind==='free'?p.positionM:{x:0,y:0,z:0},applyPose:(entity,p)=>entity.setPosition(p.x,p.y,p.z)});
    const placement=createEngineeringPlacement({catalog:profile.catalog,getBounds,measureChoice});
    const evaluate=placement.evaluate;
    placement.evaluate=async(candidate,context)=>{
        const result=await evaluate(candidate,context);
        if(result.effectivePlacement)await preview.setPose(context.handle,{kind:'free',...result.effectivePlacement});
        return result;
    };
    const validateProspective=async({document,records})=>{
        if(document.frames.length!==1||canonicalKey(document.frames[0])!==canonicalKey(profile.initialDocument.frames[0])||
            document.connections.length||document.primarySources.length)return{status:'unsupported'};
        if(document.cabinets.length&&!document.cabinets.some(c=>c.roleId==='SC'))return{status:'invalid'};
        const boxes=[];
        for(const r of records){
            await handles.get(r.entity)?.verify();const b=bounds.get(r.entity);if(!b)return{status:'pending'};
            const box=translateEngineeringBox(b,r.positionM);if(boxes.some(other=>engineeringBoxesOverlap(box,other)))return{status:'invalid'};boxes.push(box);
        }
        return{status:'valid',derived:[]}; // Explicit engineering exclusion, never production cover approval.
    };
    const configuration={...profile,readGeometryRevision:()=>0,
        // The isolated SC/OS laboratory can round-trip its own buildable rows.
        // This does not enable production SB, source countertops or covers.
        portablePreset:{isPortableChoice:choice=>['TEST-SC','TEST-OS'].includes(choice.definitionId) &&
            profile.catalog.resolveChoice(choice).status==='valid',sourceAdapters:{},
            makeId:kind=>`engineering-portable-${kind}-${++portableId}`},
        verifyReadiness:async()=>({status:['ULH_Cabinet','UniOpenShelves'].every(name=>app.assets.find(name,'template'))?'ready':'pending'}),
        // This private manager has no legacy writer or input subscriptions by construction.
        quiesceLegacy:async()=>({resume:async()=>{},dispose:async()=>{}}),preview,placement,
        scene:{factory,configure,validateProspective,getSelection:()=>selected,setSelection:value=>{selected=value;},
            whenGeometrySettled:async({records})=>{for(const r of records){const handle=handles.get(r.entity);if(!handle)return{status:'pending'};await handle.verify();}return{status:'ready'};}},
        onError:error=>console.error('[ULH ENGINEERING]',error)};
    const plugin=createCabinetRuntimePlugin({app:host,configuration,buildId:'ulh-engineering-v1'});
    let destruction;
    return{api:plugin.api,start:()=>plugin.start(),destroy(){
        if(!destruction){closed=true;destruction=(async()=>{await Promise.allSettled([...probes]);await plugin.destroy();lab.destroy();})();}
        return destruction;
    }};
}
