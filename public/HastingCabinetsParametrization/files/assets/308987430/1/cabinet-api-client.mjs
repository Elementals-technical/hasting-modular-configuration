/** Public-API-only consumer. No app, entities, policies, engine or DOM dependencies.
 * A client UI may reuse this adapter or call the same ConfiguratorAPI contract directly.
 * Never retries mutations automatically: unknown transport outcomes need getCommandResult.
 */
const copy = value => JSON.parse(JSON.stringify(value));
const failure = (code, detail = {}) => Object.assign(new Error(code), {code, ...detail});
const errorData = error => ({code:error?.code ?? 'CLIENT_ERROR', message:String(error?.message ?? error),
    reasons:error?.reasons ?? [], requestId:error?.requestId ?? null});
const initial = () => ({status:'missing',capabilities:null,context:null,catalog:[],cabinets:null,composition:null,
    session:null,pending:[],error:null});

export function createCabinetAPIClient({getAPI, onChange = () => {}, maxEntries = 200} = {}) {
    if (typeof getAPI !== 'function' || !Number.isSafeInteger(maxEntries) || maxEntries < 1) throw failure('INVALID_CLIENT_OPTIONS');
    let api=null,epoch=0,closed=false,connecting=null,state=initial(),nextId=0;
    const subscriptions=[],pending=new Set(),entries=[],startedAt=new Date().toISOString();
    const nonce=globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const id = kind => `cabinet-client-${nonce}-${kind}-${++nextId}`;
    const record = entry => { entries.push({at:new Date().toISOString(),...copy(entry)});if(entries.length>maxEntries)entries.shift(); };
    const emit = () => { if(!closed){state.pending=[...pending].map(p=>p.method);try{onChange(copy(state));}catch{/* observer only */}}; };
    const assertCurrent = (owner=api,generation=epoch) => {
        if(closed)throw failure('CLIENT_DESTROYED');
        if(generation!==epoch || owner!==api || getAPI()!==owner)throw failure('API_REPLACED');
    };
    const unsubscribe = () => {
        for(const dispose of subscriptions.splice(0))try{dispose();}catch(error){record({kind:'cleanup-error',error:errorData(error)});}
    };
    const acceptsContext = context => context && state.context &&
        context.apiInstanceId===state.context.apiInstanceId && context.compositionId===state.context.compositionId;
    const acceptContext = context => {
        if(!context)return;
        if(state.context && !acceptsContext(context))throw failure('SCOPE_MISMATCH');
        if(!state.context || context.dependencies.compositionRevision >= state.context.dependencies.compositionRevision)state.context=copy(context);
    };
    const scope = () => {
        assertCurrent();
        if(state.status!=='ready' || state.capabilities?.readiness!=='ready' || !state.context)throw failure('NOT_READY');
        return {apiInstanceId:state.context.apiInstanceId,compositionId:state.context.compositionId};
    };
    const command = () => ({...scope(),requestId:id('request'),expectedCompositionRevision:state.context.dependencies.compositionRevision});
    const supports = method => state.capabilities?.supportedMethods?.includes(method)===true;
    async function call(method,args,capability = true) {
        const owner=api,generation=epoch;assertCurrent(owner,generation);
        if(capability && !supports(method))throw failure('UNSUPPORTED_METHOD',{method});
        const [ns,name]=method.split('.');
        if(typeof owner?.[ns]?.[name]!=='function')throw failure('UNSUPPORTED_METHOD',{method});
        const request=copy(args);record({kind:'request',method,args:request});
        let result;
        try{result=await owner[ns][name](...request);}
        catch(error){record({kind:'transport-error',method,error:errorData(error),requestId:request[0]?.requestId??null});throw error;}
        record({kind:'response',method,result});
        assertCurrent(owner,generation);
        if(!result || typeof result.ok!=='boolean')throw failure('INVALID_API_RESULT');
        acceptContext(result.context);
        if(!result.ok)throw failure(result.error?.code ?? 'API_ERROR',result.error);
        return copy(result.data);
    }
    async function action(method,operation,{concurrent=false}={}) {
        const generation=epoch,token={method};
        try{
            scope();
            if([...pending].some(p=>!concurrent || p.method===method))throw failure('CLIENT_BUSY');
            pending.add(token);state.error=null;emit();
            return await operation();
        }catch(error){if(!closed && generation===epoch && getAPI()===api){state.error=errorData(error);}throw error;}
        finally{pending.delete(token);emit();}
    }
    const session = () => {scope();if(!state.session?.sessionId)throw failure('NO_ACTIVE_SESSION');return copy(state.session);};
    const updateSession = data => {
        if(data?.sessionId && (!state.session || data.sessionId!==state.session.sessionId ||
            data.candidateRevision>=state.session.candidateRevision))state.session=copy(data);
    };
    function subscribe(namespace,event,receive) {
        if(!supports(namespace+'.on'))return;
        const owner=api,generation=epoch;let sequence=-1;
        const dispose=owner[namespace].on(event,envelope=>{
            if(closed || generation!==epoch || getAPI()!==owner || !acceptsContext(envelope) || envelope.eventSequence<=sequence)return;
            sequence=envelope.eventSequence;
            if(envelope.compositionRevision < state.context.dependencies.compositionRevision)return;
            state.context.dependencies.compositionRevision=envelope.compositionRevision;
            receive(copy(envelope.data));emit();
        },{emitCurrent:true});
        subscriptions.push(dispose);
    }
    async function connect() {
        if(closed)throw failure('CLIENT_DESTROYED');
        const next=getAPI();
        if(connecting && next===api)return connecting;
        if(pending.size && next===api)throw failure('CLIENT_BUSY');
        const changed=next!==api;
        unsubscribe();epoch++;api=next;pending.clear();
        state=changed?initial():{...state,error:null};state.status='connecting';state.context=null;emit();
        const generation=epoch;
        const job=(async()=>{
            try{
                if(typeof api?.cabinets?.getCapabilities!=='function'){state=initial();emit();return copy(state);}
                state.capabilities=await call('cabinets.getCapabilities',[],false);
                state.status=state.capabilities.readiness;
                if(state.status==='ready'){
                    scope();
                    subscribe('cabinets','change',data=>{state.cabinets=data;});
                    subscribe('cabinets','selection',data=>{if(state.cabinets)state.cabinets.selectedCabinetId=data.selectedCabinetId;});
                    subscribe('composition','change',data=>{state.composition=data;acceptContext({...state.context,dependencies:data.dependencies});});
                    subscribe('cabinetPlacement','change',data=>{if(data===null)state.session=null;else updateSession(data);});
                    if(supports('cabinets.getCatalog'))state.catalog=await call('cabinets.getCatalog',[scope()]);
                    if(supports('cabinets.getState'))state.cabinets=await call('cabinets.getState',[scope()]);
                    if(supports('composition.getState'))state.composition=await call('composition.getState',[scope()]);
                    const active=state.composition?.activeSessionId;
                    if(active && supports('cabinetPlacement.getState'))updateSession(await call('cabinetPlacement.getState',[scope(),active]));
                }
                emit();return copy(state);
            }catch(error){
                if(generation===epoch && !closed){state.status='error';state.error=errorData(error);unsubscribe();emit();}
                throw error;
            }
        })();
        connecting=job;
        try{return await job;}finally{if(connecting===job)connecting=null;}
    }
    return Object.freeze({
        connect,
        getState:()=>copy(state),
        supports,
        getReport:()=>copy({schemaVersion:1,startedAt,capturedAt:new Date().toISOString(),state,entries}),
        getConfigurationOptions:choice=>action('configuration',()=>call('cabinets.getConfigurationOptions',[
            {...scope(),...copy(choice),context:{operation:'add'}}])),
        getPlacementOptions:(choice,anchorCabinetId)=>action('positions',()=>call('cabinets.getPlacementOptions',[
            {...scope(),...copy(choice),operation:'add',...(anchorCabinetId?{anchorCabinetId}:{})}])),
        addStandard:(choice,optionId)=>action('addStandard',()=>call('cabinets.addStandard',[
            {...copy(choice),...command(),optionId}])),
        beginAdd:(choice,initialPlacement)=>action('beginAdd',async()=>{
            const result=await call('cabinetPlacement.beginAdd',[{...copy(choice),...command(),sessionId:id('session'),
                ...(initialPlacement?{initialPlacement:copy(initialPlacement)}:{})}]);updateSession(result);return result;
        }),
        beginMove:productId=>action('beginMove',async()=>{
            if(!supports('cabinetPlacement.beginMove'))throw failure('UNSUPPORTED_METHOD',{method:'cabinetPlacement.beginMove'});
            if(typeof productId!=='string' || !productId.trim())throw failure('INVALID_PRODUCT_ID');
            if(state.composition?.activeSessionId || ['loading-draft','preview','applying'].includes(state.session?.lifecycle))
                throw failure('CLIENT_BUSY');
            const result=await call('cabinetPlacement.beginMove',[{...command(),sessionId:id('session'),productId}]);
            updateSession(result);return result;
        }),
        updateDraft:patch=>action('updateDraft',async()=>{
            const draft=session();const result=await call('cabinetPlacement.updateDraft',[
                {...copy(patch),...scope(),sessionId:draft.sessionId,expectedCandidateRevision:draft.candidateRevision}]);
            updateSession(result);return result;
        }),
        apply:()=>action('apply',async()=>{
            let draft=session();
            if(supports('cabinetPlacement.settleInput')){
                const settled=await call('cabinetPlacement.settleInput',[scope(),draft.sessionId]);
                if(settled?.sessionId!==draft.sessionId || !Number.isSafeInteger(settled.candidateRevision) ||
                    settled.candidateRevision<draft.candidateRevision)throw failure('INVALID_SETTLED_SESSION');
                updateSession(settled);draft=session();
            }
            if(!draft.canApply)throw failure('APPLY_UNAVAILABLE');
            return call('cabinetPlacement.apply',[{...command(),sessionId:draft.sessionId,expectedCandidateRevision:draft.candidateRevision}]);
        }),
        cancel:()=>action('cancel',async()=>{
            const draft=session();if(!draft.canCancel)throw failure('CANCEL_UNAVAILABLE');
            const result=await call('cabinetPlacement.cancel',[scope(),draft.sessionId]);updateSession(result);return result;
        },{concurrent:true}),
        select:productId=>action('select',()=>call('cabinets.select',[scope(),productId])),
        exportSnapshot:()=>action('exportSnapshot',()=>call('composition.exportSnapshot',[scope()])),
        exportPreset:(anchorCabinetId,format)=>action('exportPreset',()=>call('composition.exportPreset',[
            {...scope(),anchorCabinetId,...(format?{format}:{})}])),
        restoreSnapshot:document=>action('restoreSnapshot',()=>call('composition.restoreSnapshot',[
            {...command(),mode:'replace',document:copy(document)}])),
        importPreset:(preset,anchorPositionM)=>action('importPreset',()=>call('composition.importPreset',[
            {...command(),preset:copy(preset),...(anchorPositionM?{anchorPositionM:copy(anchorPositionM)}:{})}])),
        exportCompactPreset:anchorCabinetId=>action('exportCompactPreset',()=>call('composition.exportCompactPreset',[
            {...scope(),...(anchorCabinetId?{anchorCabinetId}:{})}])),
        importCompactPreset:(preset,anchorPositionM)=>action('importCompactPreset',()=>call('composition.importCompactPreset',[
            {...command(),preset:copy(preset),...(anchorPositionM?{anchorPositionM:copy(anchorPositionM)}:{})}])),
        getCommandResult:requestId=>action('getCommandResult',()=>call('composition.getCommandResult',[scope(),requestId]),{concurrent:true}),
        destroy(){if(closed)return;closed=true;epoch++;unsubscribe();pending.clear();}
    });
}
