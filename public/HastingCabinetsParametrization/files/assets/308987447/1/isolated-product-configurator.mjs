import {RuleExecutor} from '../../product/rules/rule-executor.mjs';
import {cloneData,freezeData,isRecord} from '../cabinet-contracts.mjs';

const fail = (code, details = {}) => Object.assign(new Error(code), {code,...details});
const checkCancelled = signal => {if(signal?.aborted)throw fail('CANCELLED');};
const statusError = (prefix, result) => fail(`${prefix}_${String(result?.status ?? 'pending').toUpperCase()}`, {
    reasons:cloneData(result?.reasons ?? [])
});
const stateView = config => {
    const data=freezeData(cloneData(config));
    return Object.freeze({get:key=>Object.hasOwn(data,key)?cloneData(data[key]):undefined,
        has:key=>Object.hasOwn(data,key),getAll:()=>cloneData(data)});
};
const identityBasis = frame => ['xAxis','yAxis','zAxis'].every((key,i)=>
    ['x','y','z'].every((axis,j)=>frame?.[key]?.[axis]===(i===j?1:0)));

/** Reuses existing parameter rules on a detached, disabled product root.
 * resolvePlan is trusted profile wiring, never registry-wide automatic rule discovery.
 * It must return an audited rule list (including required configuration fields/parts).
 * verifyGeometry must await actual geometry-only completion and explicitly return ready.
 * No live app/store/controller is injected. This is isolation by ownership/contract,
 * not a sandbox for arbitrary rule code; rules using global singletons still need audit.
 * The caller owns the root; the returned disposer owns only instantiated rule resources.
 */
export function createIsolatedProductConfigurator({resolvePlan,verifyGeometry,configureFrame=null,prepareGeometry=null}={}) {
    if(typeof resolvePlan!=='function'||typeof verifyGeometry!=='function'||
        (configureFrame!==null&&typeof configureFrame!=='function')||
        (prepareGeometry!==null&&typeof prepareGeometry!=='function'))throw fail('INVALID_CONFIGURATION_PORTS');
    const owned=new WeakSet();
    return async function configure(entity,input,{productType,signal,frame=null,...metadata}={}) {
        if(!entity || entity.parent || entity.enabled!==false || typeof entity.name!=='string' || !entity.name)throw fail('ISOLATED_ROOT_REQUIRED');
        if(typeof productType!=='string'||!productType||!isRecord(input))throw fail('INVALID_PRODUCT_CONFIGURATION');
        if(owned.has(entity))throw fail('CONFIGURATION_ALREADY_OWNED');
        checkCancelled(signal);
        const config=freezeData(cloneData(input));
        const normalizedFrame=frame===null?null:freezeData(cloneData(frame));
        owned.add(entity);
        let executor=null,disposal=null,geometryHandle=null;
        const dispose=()=>{
            if(disposal)return disposal;
            // Keep a failed cleanup owned: the same root must not be configured again.
            disposal=(async()=>{
                const errors=[];
                try{await executor?.destroy();}catch(error){errors.push(error);}
                try{await geometryHandle?.dispose();}catch(error){errors.push(error);}
                if(errors.length)throw fail('RECOVERY_REQUIRED',{cause:new AggregateError(errors)});
                owned.delete(entity);
            })();
            return disposal;
        };
        try{
            const plan=await resolvePlan({productType,config:cloneData(config),metadata,signal});
            checkCancelled(signal);
            if(plan?.status!=='ready')throw statusError('CONFIGURATION_PLAN',plan);
            if(!Array.isArray(plan.rules)||plan.rules.some(entry=>typeof entry?.rule!=='function'||!Number.isFinite(entry.priority))||
                new Set(plan.rules.map(entry=>entry.rule)).size!==plan.rules.length)throw fail('INVALID_RULE_PLAN');
            // A rotated basis needs an explicit engine-specific orientation adapter.
            if(normalizedFrame && !configureFrame && !identityBasis(normalizedFrame))throw fail('FRAME_CONFIGURATION_REQUIRED');
            if(configureFrame)await configureFrame(entity,normalizedFrame,{productType,signal});
            checkCancelled(signal);
            if(entity.parent || entity.enabled!==false)throw fail('ISOLATED_ROOT_REQUIRED');
            if(prepareGeometry){
                geometryHandle=await prepareGeometry(entity,{productType,signal});
                if(typeof geometryHandle?.verify!=='function'||typeof geometryHandle?.dispose!=='function')throw fail('INVALID_GEOMETRY_HANDLE');
                checkCancelled(signal);
            }
            const context=Object.freeze({entity,productId:entity.name,productType,signal,executionMode:'isolated',
                productConfig:freezeData(cloneData(plan.productConfig??{}))});
            executor=new RuleExecutor(context,{strict:true});
            const entries=[...plan.rules].sort((a,b)=>a.priority-b.priority);
            for(const {rule:Rule,priority} of entries){
                checkCancelled(signal);
                const instance=new Rule();instance.priority=priority;
                executor.registerRule(instance);
            }
            await executor.executeRules({changes:cloneData(config),currentState:stateView(config),previousState:stateView({})});
            checkCancelled(signal);
            if(geometryHandle){
                const prepared=await geometryHandle.verify();
                if(prepared?.status!=='ready')throw statusError('CONFIGURATION_GEOMETRY',prepared);
                checkCancelled(signal);
            }
            const geometry=await verifyGeometry({entity,productType,config:cloneData(config),frame:normalizedFrame,
                rules:[...executor.rules],signal});
            checkCancelled(signal);
            if(geometry?.status!=='ready')throw statusError('CONFIGURATION_GEOMETRY',geometry);
            if(entity.parent || entity.enabled!==false)throw fail('ISOLATED_ROOT_REQUIRED');
            return dispose;
        }catch(error){
            try{await dispose();}
            catch(cause){throw fail('RECOVERY_REQUIRED',{cause,originalError:error});}
            throw error;
        }
    };
}
