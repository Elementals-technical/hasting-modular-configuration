import { cloneData, canonicalKey, reason, isRecord } from './cabinet-contracts.mjs';
import { createPlacementOptions } from './placement-options.mjs';
import { operationError } from '../composition/operations/composition-operation-coordinator.mjs';
import { captureExactPreset, instantiateExactPreset } from './portable-preset.mjs';

const id = (value)=>typeof value === 'string' && value.trim().length > 0;
const scopeKeys = [
    'apiInstanceId',
    'compositionId'
];
const commandKeys = [
    ...scopeKeys,
    'requestId',
    'expectedCompositionRevision'
];
const choiceKeys = [
    'definitionId',
    'selection'
];
const events = new Set([
    'cabinetsChange',
    'selection',
    'placementChange',
    'placementAction',
    'compositionChange'
]);
/** Internal throwing service, not the transport ApiResult facade.
 * All scene/source ports are synchronous reads or coordinator transaction ports.
 * enumeratePlacements must validate prospective local-layout/derived geometry;
 * createStandardTransaction must commit the returned plan, never recompute a different location.
 * A single service owns the API-instance request journal (including session commands).
 */ function createCabinetApplicationService({ scope, coordinator, session, catalog, readDependencies, readModel, enumeratePlacements, createStandardTransaction, selectCabinet, validateDocument, createRestoreTransaction, createPresetTransaction, validatePresetDocument, portablePreset = null, migrateDocument, settlePhysicalInput = null, onCommitted = ()=>{}, onObservationError = ()=>{} }) {
    const identity = cloneData(scope), listeners = new Map(), journal = new Map(), cancelledActions = new Set();
    const options = createPlacementOptions({
        readDependencies,
        enumerate: enumeratePlacements
    });
    let eventSequence = 0, activeSessionId = null, latestSession = null, disposed = false, restoring = false;
    function checkScope(input) {
        if (disposed) throw operationError('SERVICE_DISPOSED');
        if (!isRecord(input) || scopeKeys.some((key)=>input[key] !== identity[key])) throw operationError('SCOPE_MISMATCH');
    }
    function keys(input, allowed) {
        if (!isRecord(input) || Object.keys(input).some((key)=>!allowed.includes(key))) throw operationError('INVALID_INPUT');
    }
    function resolveChoice(input) {
        const resolved = catalog.resolveChoice(input);
        if (resolved.status !== 'valid') throw Object.assign(operationError('CATALOG_' + resolved.status.toUpperCase()), {
            reasons: cloneData(resolved.reasons ?? [])
        });
        return resolved;
    }
    function readStable() {
        const dependencies = cloneData(readDependencies()), model = cloneData(readModel());
        if (canonicalKey(dependencies) !== canonicalKey(readDependencies())) throw operationError('STALE_DEPENDENCIES');
        return {
            ...model,
            dependencies
        };
    }
    function getCompositionState(input) {
        checkScope(input);
        const state = coordinator.getState();
        return {
            status: state.phase === 'recovery-required' ? 'recovery-required' : [
                'preparing',
                'publishing'
            ].includes(state.phase) ? restoring ? 'restoring' : 'applying' : 'ready',
            activeSessionId,
            dependencies: cloneData(readDependencies()),
            reasons: state.phase === 'recovery-required' ? [
                reason('RECOVERY_REQUIRED')
            ] : []
        };
    }
    function emit(name, data) {
        const event = {
            ...identity,
            eventSequence: ++eventSequence,
            compositionRevision: readDependencies().compositionRevision,
            data: cloneData(data)
        };
        for (const callback of [
            ...listeners.get(name) ?? []
        ]){
            try {
                callback(cloneData(event));
            } catch  {}
        }
    }
    function emitComposition() {
        emit('compositionChange', getCompositionState(identity));
    }
    function observe(operation) {
        try {
            operation();
        } catch (error) {
            try {
                onObservationError(error);
            } catch  {}
        }
    }
    function committed() {
        // Publication already succeeded: a broken read/observer must not turn its receipt into a failure.
        observe(onCommitted);
        observe(()=>emit('cabinetsChange', readStable().view));
        observe(emitComposition);
    }
    function apiError(error, requestId) {
        return {
            code: error?.code ?? 'OPERATION_FAILED',
            reasons: cloneData(error?.reasons ?? []),
            retryable: error?.code !== 'RECOVERY_REQUIRED',
            requestId
        };
    }
    function remember(kind, input, operation) {
        try {
            checkScope(input);
            const request = cloneData(input);
            if (!id(request.requestId) || !Number.isSafeInteger(request.expectedCompositionRevision) || request.expectedCompositionRevision < 0) throw operationError('INVALID_INPUT');
            const fingerprint = canonicalKey({
                kind,
                request
            }), old = journal.get(request.requestId);
            if (old) {
                if (old.fingerprint !== fingerprint) throw operationError('REQUEST_ID_REUSED');
                return old.promise.then(cloneData);
            }
            const entry = {
                fingerprint,
                status: 'pending',
                promise: null
            };
            journal.set(request.requestId, entry);
            entry.promise = Promise.resolve().then(()=>operation(request)).then((result)=>{
                entry.result = cloneData(result);
                entry.status = 'succeeded';
                return entry.result;
            }).catch((error)=>{
                entry.error = apiError(error, request.requestId);
                entry.status = 'failed';
                throw error;
            });
            entry.promise.catch(()=>{});
            return entry.promise.then(cloneData);
        } catch (error) {
            return Promise.reject(error);
        }
    }
    const unsubscribe = session.onChange((state)=>{
        latestSession = cloneData(state);
        activeSessionId = [
            'loading-draft',
            'preview',
            'applying'
        ].includes(state.lifecycle) ? state.sessionId : null;
        emit('placementChange', state);
        emitComposition();
    });
    const service = {
        scope: Object.freeze(identity),
        getCatalog (input) {
            checkScope(input);
            return catalog.getCatalog();
        },
        getConfigurationOptions (input) {
            checkScope(input);
            keys(input, [
                ...scopeKeys,
                ...choiceKeys,
                'context'
            ]);
            if (input.context?.operation !== 'add') throw operationError('UNSUPPORTED_OPERATION');
            return catalog.getConfigurationOptions(input);
        },
        async getPlacementOptions (input) {
            checkScope(input);
            keys(input, [
                ...scopeKeys,
                ...choiceKeys,
                'operation',
                'anchorCabinetId'
            ]);
            if (input.operation !== 'add') throw operationError('UNSUPPORTED_OPERATION');
            if (input.anchorCabinetId !== undefined && !id(input.anchorCabinetId)) throw operationError('INVALID_INPUT');
            const request = cloneData(input), choice = resolveChoice(request), model = readStable();
            const result = await options.list(request, {
                model,
                resolvedChoice: choice
            });
            checkScope(input);
            return result;
        },
        // Internal resolver shared by the scene's DnD evaluator; never a public bypass.
        resolvePlacementOption (optionId, choice) {
            checkScope(identity);
            return options.resolve(optionId, choice);
        },
        addStandard (input) {
            return remember('addStandard', input, async (request)=>{
                keys(request, [
                    ...commandKeys,
                    ...choiceKeys,
                    'optionId',
                    'acceptedImpactToken'
                ]);
                if (request.acceptedImpactToken != null) throw operationError('UNSUPPORTED_CONFIRMATION');
                const resolvedChoice = resolveChoice(request), record = options.resolve(request.optionId, request);
                if (record.option.mode !== 'standard' || ![
                    'seed',
                    'left',
                    'right'
                ].includes(record.option.kind) || record.option.availability !== 'available') throw operationError('OPTION_UNAVAILABLE');
                const context = {
                    request,
                    ...record,
                    resolvedChoice
                };
                const pending = coordinator.run({
                    request,
                    kind: 'add',
                    payload: context,
                    expectedDependencies: record.dependencies,
                    ports: createStandardTransaction(cloneData(context))
                });
                observe(emitComposition);
                try {
                    const receipt = await pending;
                    committed();
                    return receipt;
                } catch (error) {
                    observe(emitComposition);
                    throw error;
                }
            });
        },
        getCabinetsState (input) {
            checkScope(input);
            return readStable().view;
        },
        select (input, productId) {
            checkScope(input);
            coordinator.assertWritable();
            if (productId !== null && (!id(productId) || !readStable().view.cabinets.some((c)=>c.id === productId))) {
                throw operationError('UNKNOWN_CABINET');
            }
            const result = selectCabinet(productId);
            if (result?.then) throw operationError('ASYNC_SELECTION_NOT_ALLOWED');
            const state = {
                selectedCabinetId: productId
            };
            emit('selection', state);
            return state;
        },
        beginAdd (input) {
            return remember('beginAdd', input, (request)=>session.beginAdd(request));
        },
        ...session.supportsMove === true ? {
            beginMove (input) {
                return remember('beginMove', input, (request)=>session.beginMove(request));
            }
        } : {},
        updateDraft (input) {
            checkScope(input);
            return session.updateDraft(cloneData(input));
        },
        getPlacementState (input, sessionId) {
            checkScope(input);
            return session.getState(sessionId);
        },
        apply (input) {
            return remember('apply', input, async (request)=>{
                try {
                    const receipt = await session.apply(request);
                    committed();
                    observe(()=>emit('placementAction', {
                            status: 'committed',
                            sessionId: request.sessionId,
                            receipt
                        }));
                    return receipt;
                } catch (error) {
                    observe(()=>emit('placementAction', {
                            status: 'failed',
                            sessionId: request.sessionId,
                            error: apiError(error, request.requestId)
                        }));
                    throw error;
                }
            });
        },
        async cancel (input, sessionId) {
            checkScope(input);
            const state = await session.cancel(input, sessionId);
            if (!cancelledActions.has(sessionId) && state.lifecycle === 'cancelled') {
                cancelledActions.add(sessionId);
                emit('placementAction', {
                    status: 'cancelled',
                    sessionId
                });
            }
            return state;
        },
        getCompositionState,
        exportSnapshot (input) {
            checkScope(input);
            coordinator.assertCanSave();
            const { document, dependencies } = readStable(), result = validateDocument(document);
            if (result?.status !== 'valid') throw operationError('DOCUMENT_NOT_READY');
            return {
                document: cloneData(result.document),
                compositionRevision: dependencies.compositionRevision,
                hasUnappliedDraft: coordinator.getState().phase === 'preview'
            };
        },
        getCommandResult (input, requestId) {
            checkScope(input);
            if (!id(requestId)) throw operationError('INVALID_INPUT');
            const entry = journal.get(requestId);
            return cloneData(!entry ? {
                status: 'unknown'
            } : entry.status === 'pending' ? {
                status: 'pending'
            } : entry.status === 'succeeded' ? {
                status: 'succeeded',
                result: entry.result
            } : {
                status: 'failed',
                error: entry.error
            });
        },
        on (event, callback, { emitCurrent = false } = {}) {
            if (disposed) throw operationError('SERVICE_DISPOSED');
            if (!events.has(event) || typeof callback !== 'function') throw operationError('INVALID_SUBSCRIPTION');
            if (!listeners.has(event)) listeners.set(event, new Set());
            listeners.get(event).add(callback);
            if (emitCurrent && [
                'cabinetsChange',
                'placementChange',
                'compositionChange',
                'selection'
            ].includes(event)) {
                const data = event === 'cabinetsChange' ? readStable().view : event === 'placementChange' ? latestSession : event === 'selection' ? {
                    selectedCabinetId: readStable().view.selectedCabinetId
                } : getCompositionState(identity);
                try {
                    callback({
                        ...identity,
                        eventSequence: ++eventSequence,
                        compositionRevision: readDependencies().compositionRevision,
                        data: cloneData(data)
                    });
                } catch  {}
            }
            return ()=>listeners.get(event)?.delete(callback);
        },
        dispose () {
            if (disposed) return;
            if (coordinator.getState().phase !== 'idle' || [
                ...journal.values()
            ].some((entry)=>entry.status === 'pending')) {
                throw operationError('COMPOSITION_BUSY');
            }
            disposed = true;
            unsubscribe();
            listeners.clear();
            options.clear();
            journal.clear();
        }
    };
    if (typeof settlePhysicalInput === 'function') service.settleInput = async (input, sessionId)=>{
        checkScope(input);
        if (!id(sessionId)) throw operationError('INVALID_INPUT');
        session.getState(sessionId);
        if (activeSessionId === sessionId) await settlePhysicalInput();
        checkScope(input);
        return session.getState(sessionId);
    };
    if (typeof createRestoreTransaction === 'function') service.restoreSnapshot = (input)=>remember('restore', input, async (request)=>{
            keys(request, [
                ...commandKeys,
                'document',
                'mode'
            ]);
            if (request.mode !== 'replace') throw operationError(request.mode === 'recover' ? 'UNSUPPORTED_RECOVERY' : 'INVALID_INPUT');
            coordinator.assertWritable();
            let document = request.document;
            if (document?.schemaVersion === undefined && typeof migrateDocument === 'function') {
                const migrated = migrateDocument(cloneData(document));
                if (migrated?.status !== 'valid') throw Object.assign(operationError('LEGACY_MIGRATION_UNSUPPORTED'), {
                    reasons: cloneData(migrated?.reasons ?? [])
                });
                document = migrated.document;
            }
            const validated = validateDocument(document);
            if (validated?.status !== 'valid') throw Object.assign(operationError('DOCUMENT_NOT_READY'), {
                reasons: cloneData(validated?.reasons ?? [])
            });
            if (validated.document.id !== identity.compositionId) throw operationError('SCOPE_MISMATCH');
            const dependencies = cloneData(readDependencies());
            restoring = true;
            try {
                const pending = coordinator.run({
                    request,
                    kind: 'restore',
                    payload: validated.document,
                    expectedDependencies: dependencies,
                    ports: createRestoreTransaction({
                        request,
                        document: cloneData(validated.document)
                    })
                });
                observe(emitComposition);
                const receipt = await pending;
                committed();
                return receipt;
            } finally{
                restoring = false;
                observe(emitComposition);
            }
        });
    // Internal trusted preset route. The caller supplies a command-specific validator
    // and transaction factory; no public document or validator is accepted here.
    if (typeof createPresetTransaction === 'function') service.replacePreset = (input)=>remember('preset', input, async (request)=>{
            keys(request, [
                ...commandKeys,
                'document'
            ]);
            coordinator.assertWritable();
            const validated = validatePresetDocument?.(request.document);
            if (validated?.status !== 'valid') throw Object.assign(operationError('DOCUMENT_NOT_READY'), {
                reasons: cloneData(validated?.reasons ?? [])
            });
            if (validated.document.id !== identity.compositionId) throw operationError('SCOPE_MISMATCH');
            const dependencies = cloneData(readDependencies());
            const pending = coordinator.run({
                request,
                kind: 'preset',
                payload: validated.document,
                expectedDependencies: dependencies,
                ports: createPresetTransaction({
                    request,
                    document: cloneData(validated.document)
                })
            });
            observe(emitComposition);
            try {
                const receipt = await pending;
                committed();
                return receipt;
            } catch (error) {
                observe(emitComposition);
                throw error;
            }
        });
    // Exact portable presets are opt-in: the scene must provide certified catalog
    // choices, source adapters, and a transaction for its production product set.
    if (portablePreset && typeof portablePreset.isPortableChoice === 'function' && typeof portablePreset.makeId === 'function' && typeof portablePreset.createTransaction === 'function') {
        service.exportPreset = (input)=>{
            checkScope(input);
            keys(input, [
                ...scopeKeys,
                'anchorCabinetId'
            ]);
            coordinator.assertCanSave();
            if (coordinator.getState().phase === 'preview' || activeSessionId) throw operationError('UNAPPLIED_DRAFT');
            const { document } = readStable(), checked = validateDocument(document);
            if (checked?.status !== 'valid') throw operationError('DOCUMENT_NOT_READY');
            return captureExactPreset({
                document: checked.document,
                anchorCabinetId: input.anchorCabinetId,
                catalog,
                sourceAdapters: portablePreset.sourceAdapters,
                isPortableChoice: portablePreset.isPortableChoice,
                serializeChoice: portablePreset.serializeChoice
            });
        };
        service.importPreset = (input)=>remember('importPreset', input, async (request)=>{
                keys(request, [
                    ...commandKeys,
                    'preset',
                    'anchorPositionM'
                ]);
                coordinator.assertWritable();
                const release = portablePreset.installChoices?.(cloneData(request.preset));
                let published = false;
                try {
                    const before = readStable(), result = instantiateExactPreset({
                        preset: request.preset,
                        targetDocument: before.document,
                        catalog,
                        sourceAdapters: portablePreset.sourceAdapters,
                        isPortableChoice: portablePreset.isPortableChoice,
                        makeId: portablePreset.makeId,
                        anchorPositionM: request.anchorPositionM
                    });
                    const checked = validateDocument(result.document);
                    if (checked?.status !== 'valid') throw Object.assign(operationError('DOCUMENT_NOT_READY'), {
                        reasons: cloneData(checked?.reasons ?? [])
                    });
                    const pending = coordinator.run({
                        request,
                        kind: 'preset',
                        payload: checked.document,
                        expectedDependencies: before.dependencies,
                        ports: portablePreset.createTransaction({
                            request,
                            document: cloneData(checked.document)
                        })
                    });
                    observe(emitComposition);
                    const receipt = await pending;
                    published = true;
                    committed();
                    return {
                        ...receipt,
                        keyToProductId: result.keyToProductId
                    };
                } catch (error) {
                    observe(emitComposition);
                    throw error;
                } finally{
                    if (!published && typeof release === 'function') observe(release);
                }
            });
    }
    return Object.freeze(service);
}

export { createCabinetApplicationService };
