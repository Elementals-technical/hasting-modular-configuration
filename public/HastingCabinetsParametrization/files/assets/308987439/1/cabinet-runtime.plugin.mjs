import {cloneData,reason} from '../../domain/cabinet-placement/cabinet-contracts.mjs';
import {createCabinetApplicationService} from '../../domain/cabinet-placement/cabinet-application-service.mjs';
import {createCabinetPlacementSession} from '../../domain/cabinet-placement/cabinet-placement-session.mjs';
import {createCabinetSceneAdapter} from '../../domain/cabinet-placement/adapters/placement-spatial-adapter.mjs';
import {createCompositionOperationCoordinator,operationError} from '../../domain/composition/operations/composition-operation-coordinator.mjs';
import {resolveConnectionGroups} from '../../domain/cabinet-placement/connection-resolver.mjs';
import {createCabinetFacades} from './cabinets.plugin.mjs';
import {captureLegacySceneCheckpoint} from '../../domain/composition/operations/legacy-scene-checkpoint.mjs';
import {createCabinetDraftDragAdapter} from '../../domain/cabinet-placement/adapters/cabinet-draft-drag-adapter.mjs';
import {isCabinetCoverProduct} from '../../domain/countertop/countertop-role.mjs';

const owners = new WeakMap();
let nextIdentity = 0;
const required = (object,names) => names.every(name => typeof object?.[name] === 'function');
/** Application-owned bootstrap, optional for legacy scenes. Configuration is trusted scene
 * wiring, never a public setter. Without complete reviewed geometry/catalog/lifecycle ports
 * only getCapabilities is available; no default-valid adapters or catalog rows are supplied.
 */
export function createCabinetRuntimePlugin({app,configuration = null,buildId = 'cabinet-runtime-v1'} = {}) {
    if (!app || typeof app !== 'object') throw operationError('INVALID_APPLICATION');
    const existing = owners.get(app);
    if (existing) {
        if (existing.configuration !== configuration) throw operationError('RUNTIME_CONFIGURATION_CHANGED');
        return existing.plugin;
    }
    const manager = app.compositionManager;
    const nonce=globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    const scope = {apiInstanceId:`cabinet-${nonce}-${++nextIdentity}`,compositionId:configuration?.initialDocument?.id ??
        manager?.getActiveComposition?.()?.compositionId ?? 'unavailable'};
    const configured = typeof configuration?.collectionId === 'string' && !!configuration.collectionId.trim() &&
        configuration.initialDocument?.collection?.id === configuration.collectionId && manager &&
        required(configuration,['verifyReadiness','quiesceLegacy','readGeometryRevision']) && typeof configuration.codec?.validate === 'function' &&
        required(configuration.catalog,['resolveChoice','getCatalog','getDefinition','getConfigurationOptions']) &&
        required(configuration.preview,['create','setPose','dispose','destroy']) &&
        required(configuration.placement,['enumerate','evaluate','buildStandardDocument','buildDraftDocument']) &&
        required(configuration.scene,['configure','validateProspective','whenGeometrySettled','getSelection','setSelection']) &&
        typeof configuration.scene.factory?.createProductEntity === 'function';
    let readiness = configured ? 'initializing' : 'unsupported';
    let startJob = null,destroyJob = null,closed = false,legacy = null,service = null,scene = null,session = null;
    let inputAdapter=null;
    let legacyCommandSequence=0;
    let cleanupJob = Promise.resolve(),activationCommitted = false;
    const pending = new Set();
    const initial = configured ? cloneData(configuration.initialDocument) : null;
    const initialStore = manager?.getComposition?.(scope.compositionId);
    let coordinator;
    const readSource = () => {
        const store = manager.getComposition(scope.compositionId),saved = store?.getCabinetDocument?.();
        if (!store) throw operationError('COMPOSITION_NOT_FOUND');
        const fallback=Object.keys(store.getAllProducts()).length ? initial : {...initial,cabinets:[],connections:[],localLayouts:[],primarySources:[],featureSettings:{}};
        return {store,document:saved?.document ?? cloneData(fallback),revision:saved?.revision ?? 0};
    };
    const readDependencies = () => ({compositionRevision:readSource().revision,
        geometryRevision:configuration.readGeometryRevision(),
        catalogVersion:initial.collection.catalogVersion,policyVersion:initial.collection.policyVersion});
    const track = promise => {
        pending.add(promise);promise.then(()=>pending.delete(promise),()=>pending.delete(promise));return promise;
    };
    const releaseRetired = () => {
        cleanupJob=cleanupJob.then(()=>scene.releaseRetired()).catch(error=>{
            coordinator.markRecoveryRequired();try{configuration.onError?.(error);}catch{/* diagnostics only */}
        });
    };
    const readModel = () => {
        const {document} = readSource();
        const grouped = resolveConnectionGroups({cabinetIds:document.cabinets.map(c=>c.id),connections:document.connections,
            allowedRules:configuration.allowedConnectionRules ?? []});
        if (grouped.status !== 'valid') throw operationError('CONNECTION_RULE_UNSUPPORTED');
        return {document,view:{cabinets:document.cabinets.map(c => {
            const group=grouped.groups.find(g=>g.cabinetIds.includes(c.id));
            return {...c,actions:[],groupId:group.id,connectionState:group.cabinetIds.length>1?'connected':'separate'};
        }),connections:document.connections,groups:grouped.groups,localLayouts:document.localLayouts,
        selectedCabinetId:configuration.scene.getSelection()}};
    };
    if (configured) {
        coordinator=createCompositionOperationCoordinator({scope,readDependencies});
        scene=createCabinetSceneAdapter({...configuration.scene,scope,coordinator,root:app.root,collectionId:configuration.collectionId,
            catalog:configuration.catalog,codec:configuration.codec,readSource,
            publishSource:(store,_revision,context)=>{
                coordinator.assertTransactionContext(context);
                manager._compositions.set(scope.compositionId,store);
            }});
        const moveReady=typeof configuration.resolveExisting==='function'&&
            typeof configuration.placement.buildMoveDocument==='function'&&
            typeof configuration.codec.validateMove==='function';
        session=createCabinetPlacementSession({scope,coordinator,catalog:configuration.catalog,readDependencies,
            preview:configuration.preview,evaluate:(candidate,context)=>configuration.placement.evaluate(candidate,{...context,
                model:readModel(),resolveOption:(id,choice)=>service.resolvePlacementOption(id,choice)}),
            resolveExisting:moveReady?id=>configuration.resolveExisting(id,readModel()):undefined,
            createTransaction:context=>{
                const moving=context.kind==='move',model=readModel();
                const plan=moving?configuration.placement.buildMoveDocument(context.candidate,model):
                    configuration.placement.buildDraftDocument(context.candidate,model);
                const validator=moving?document=>configuration.codec.validateMove(document,{
                    before:model.document,productId:context.candidate.productId,expected:plan.document}):undefined;
                const ports=scene.createTransaction({...plan,kind:moving?'move':'add',
                    validateDocument:validator,sessionId:context.request.sessionId,requestId:context.request.requestId});
                return {...ports,prepare:(_draft,before,options)=>ports.prepare(before,options),
                    ...(moving?{
                        // Coordinator calls this both before materialization and again before publication.
                        assertCurrent(){ports.assertCurrent?.();configuration.move?.assertCurrent?.(context);},
                        async materialize(stage,before,options){
                            configuration.move?.allowStagedPose?.(context.candidate.productId,
                                plan.document.cabinets.find(item=>item.id===context.candidate.productId).positionM);
                            return ports.materialize(stage,before,options);
                        },
                        publish(stage,before,options){try{return ports.publish(stage,before,options);}
                            finally{configuration.move?.clearStagedPose?.();}},
                        async rollback(before,stage,options){try{return await ports.rollback(before,stage,options);}
                            finally{configuration.move?.clearStagedPose?.();}}
                    }: {})};
            }});
        const raw=createCabinetApplicationService({scope,coordinator,session,catalog:configuration.catalog,readDependencies,readModel,
            enumeratePlacements:(request,context)=>configuration.placement.enumerate(request,context),
            createStandardTransaction:context=>scene.createTransaction({
                ...configuration.placement.buildStandardDocument(context,readModel()),kind:'add',requestId:context.request.requestId}),
            createRestoreTransaction:({request,document})=>scene.createTransaction({document,requestId:request.requestId,kind:'restore'}),
            createPresetTransaction:configuration.compatibility?({request,document})=>scene.createTransaction({
                document,requestId:request.requestId,kind:'preset',
                validateDocument:configuration.codec.validatePreset}):undefined,
            validatePresetDocument:configuration.codec.validatePreset,
            migrateDocument:configuration.migrateDocument,validateDocument:document=>configuration.codec.validate(document),
            portablePreset:configuration.portablePreset?{
                ...configuration.portablePreset,
                createTransaction:({request,document})=>scene.createTransaction({
                    document,requestId:request.requestId,kind:'preset'
                })
            }:null,
            settlePhysicalInput:configuration.input?.readFrame?()=>inputAdapter?.settle():undefined,
            selectCabinet:id=>configuration.scene.setSelection(id),onCommitted:releaseRetired,onObservationError:configuration.onError});
        service={...raw};
        for (const key of ['addStandard','beginAdd','beginMove','updateDraft','apply','cancel','settleInput','restoreSnapshot','replacePreset','importPreset','importCompactPreset']) {
            if(typeof raw[key]!=='function')continue;
            service[key]=(...args)=>{
                if (closed) return Promise.reject(operationError('API_DESTROYED'));
                return track(Promise.resolve().then(()=>{
                    if(closed)throw operationError('API_DESTROYED');
                    return raw[key](...args);
                }));
            };
        }
    }
    const facade=createCabinetFacades({service,scope,collectionId:configuration?.collectionId ?? null,buildId,enabled:!!configured,
        inputEnabled:!!configuration?.input?.readFrame,
        readDependencies:configured?readDependencies:undefined,getReadiness:()=>readiness});
    if(configured&&configuration.input?.readFrame){
        const createInput=configuration.input.createAdapter??createCabinetDraftDragAdapter;
        inputAdapter=createInput({app,api:facade.api,preview:configuration.preview,
            readFrame:configuration.input.readFrame,
            readSpatialProfile:configuration.input.readSpatialProfile,
            readBodies:configuration.input.readBodies,
            onError:(stage,error)=>configuration.onError?.(error,stage)});
        if(!required(inputAdapter,['start','settle','stop','destroy']))throw operationError('INVALID_INPUT_ADAPTER');
    }
    const inputFailure=(error,requestId=null)=>{
        const code=error?.code??'INPUT_SETTLE_FAILED';
        return{ok:false,context:null,error:{code,reasons:[reason(code)],requestId,retryable:false}};
    };
    const publicPlacement=inputAdapter?Object.freeze({...facade.api.cabinetPlacement,
        ...Object.fromEntries(['updateDraft','apply','cancel'].map(method=>[method,async(...args)=>{
            const input=args[0],sessionId=method==='cancel'?args[1]:input?.sessionId;
            try{
                // Scope and session ownership are checked before touching the current gesture.
                const state=service.getCompositionState(input);
                if(state.activeSessionId===sessionId){
                    service.getPlacementState(input,sessionId);
                    if(method==='cancel')await inputAdapter.stop();
                    else{
                        await inputAdapter.settle();
                        if(!closed&&service.getCompositionState(input).activeSessionId===sessionId)
                            await inputAdapter.stop();
                    }
                }
            }catch(error){return inputFailure(error,input?.requestId??null);}
            return facade.api.cabinetPlacement[method](...args);
        }]))}):facade.api.cabinetPlacement;
    const publicApi=inputAdapter?Object.freeze({...facade.api,cabinetPlacement:publicPlacement}):facade.api;
    const nextRequest=()=>`${scope.apiInstanceId}-legacy-${++legacyCommandSequence}`;
    const requireCompatibility=()=>{
        if(closed)throw operationError('API_DESTROYED');
        if(readiness!=='ready'||!configuration?.compatibility||!service?.replacePreset)throw operationError('NOT_READY');
        coordinator.assertWritable();
    };
    const compatibility=configuration?.compatibility?Object.freeze({
        get active(){return !closed&&readiness==='ready';},
        async addProduct(type,config){
            requireCompatibility();
            const choice=configuration.compatibility.mapChoice(type,config);
            const options=await service.getPlacementOptions({...scope,...choice,operation:'add'});
            const available=options.filter(option=>option.availability==='available'&&
                (option.kind==='right'||option.kind==='seed'));
            available.sort((a,b)=>b.positionM.x-a.positionM.x||String(a.anchorCabinetId).localeCompare(String(b.anchorCabinetId)));
            if(!available.length)throw operationError('LINE_APPEND_UNAVAILABLE');
            const receipt=await service.addStandard({...scope,...choice,optionId:available[0].id,
                requestId:nextRequest(),expectedCompositionRevision:readDependencies().compositionRevision});
            if(!receipt.selectedCabinetId||!receipt.addedProductIds.includes(receipt.selectedCabinetId))
                throw operationError('INVALID_LINE_RECEIPT');
            return receipt.selectedCabinetId;
        },
        async presetProducts(items,globalConfig=null){
            requireCompatibility();
            const dependencies=readDependencies();
            const plan=await configuration.compatibility.buildPresetDocument(items,globalConfig,readModel().document);
            const receipt=await service.replacePreset({...scope,requestId:nextRequest(),
                expectedCompositionRevision:dependencies.compositionRevision,document:plan.document});
            const cabinetIds=new Set(plan.document.cabinets.map(item=>item.id));
            return receipt.addedProductIds.filter(id=>cabinetIds.has(id));
        }
    }):null;
    const plugin=Object.freeze({api:publicApi,compatibility,
        start() {
            if (closed) return Promise.reject(operationError('API_DESTROYED'));
            if (startJob) return startJob;
            if (!configured) return Promise.resolve({status:'unsupported'});
            startJob=(async()=>{
                try {
                    if (manager.getActiveComposition() !== initialStore || !initialStore) throw operationError('SCOPE_MISMATCH');
                    const checkpoint=captureLegacySceneCheckpoint({app,manager});
                    const assertOriginal=()=>checkpoint.assertUnchanged();
                    const ids=Object.keys(initialStore.getAllProducts());
                    const records=configuration.scene.initialRecords??[],adopted=new Set(records.map(r=>r.id));
                    const sourceIds=new Set([...initial.cabinets,...initial.primarySources].map(record=>record.id));
                    const products=initialStore.getAllProducts();
                    if (adopted.size!==records.length || ids.some(id=>!adopted.has(id)) ||
                        records.some(r=>!ids.includes(r.id) ||
                            (r.derived?!isCabinetCoverProduct(products[r.id]):!sourceIds.has(r.id)) ||
                            app.root.findByName?.(r.id)!==r.entity)) {
                        throw operationError('LEGACY_ADOPTION_MANIFEST_REQUIRED');
                    }
                    const verified=await configuration.verifyReadiness();
                    if (verified?.status !== 'ready') throw operationError('RUNTIME_NOT_READY');
                    if (closed) throw operationError('API_DESTROYED');
                    assertOriginal();
                    // UI/manager writers stop before the await; quiesce must drain and unbind
                    // raw legacy participants and provide resume for a failed activation.
                    manager._ulhActivationCompositionId=scope.compositionId;
                    legacy=await configuration.quiesceLegacy({app,manager,compositionId:scope.compositionId});
                    if (!required(legacy,['resume','dispose'])) throw operationError('INVALID_QUIESCENCE_PORT');
                    if (closed) throw operationError('API_DESTROYED');
                    assertOriginal();
                    const dependencies=readDependencies();
                    await coordinator.run({request:{...scope,requestId:'bootstrap',expectedCompositionRevision:dependencies.compositionRevision},
                        kind:'restore',payload:initial,expectedDependencies:dependencies,
                        ports:scene.createTransaction({document:initial,requestId:'bootstrap',kind:'restore'})});
                    activationCommitted=true;
                    try{await legacy.dispose();legacy=null;}
                    catch(cause){coordinator.markRecoveryRequired();throw operationError('RECOVERY_REQUIRED',cause);}
                    releaseRetired();
                    readiness='ready';
                    try{inputAdapter?.start();}
                    catch(cause){coordinator.markRecoveryRequired();throw operationError('RECOVERY_REQUIRED',cause);}
                    return {status:'ready',...scope};
                } catch(error) {
                    readiness='error';
                    // A failed partial handoff may not have returned its lease yet.
                    // Do not clear the writer fence when that handoff could not resume.
                    if (error?.code === 'LEGACY_HANDOFF_RECOVERY_REQUIRED') {
                        coordinator.markRecoveryRequired();
                        throw operationError('RECOVERY_REQUIRED',error);
                    }
                    if (legacy && coordinator.getState().phase !== 'recovery-required') {
                        try{await legacy.resume();legacy=null;}
                        catch(cause){coordinator.markRecoveryRequired();throw operationError('RECOVERY_REQUIRED',cause);}
                    }
                    throw error;
                } finally {
                    if (coordinator.getState().phase !== 'recovery-required') delete manager._ulhActivationCompositionId;
                }
            })();
            startJob.catch(()=>{});return startJob;
        },
        destroy() {
            if (destroyJob) return destroyJob;
            closed=true;facade.destroy();
            destroyJob=(async()=>{
                if(startJob)await startJob.catch(()=>{});
                if(service){
                    const errors=[];
                    const attempt=async operation=>{try{await operation();}catch(error){errors.push(error);}};
                    const cancelDraft=async()=>{
                        const active=service.getCompositionState(scope).activeSessionId;
                        if(active)await session.cancel(scope,active);
                    };
                    await attempt(()=>inputAdapter?.destroy());
                    await attempt(cancelDraft);
                    await Promise.allSettled([...pending]);
                    await attempt(cancelDraft);
                    await attempt(()=>cleanupJob);
                    await attempt(()=>configuration.preview.destroy());
                    await attempt(()=>scene.destroy({preserveEntities:activationCommitted?[]:(configuration.scene.initialRecords??[]).map(r=>r.entity)}));
                    await attempt(()=>legacy?.dispose());
                    await attempt(()=>service.dispose());
                    if(errors.length){coordinator.markRecoveryRequired();throw operationError('RECOVERY_REQUIRED',errors[0]);}
                }
                owners.delete(app);
            })();
            return destroyJob;
        }
    });
    owners.set(app,{configuration,plugin});return plugin;
}
