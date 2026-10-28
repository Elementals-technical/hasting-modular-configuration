import { cloneData, reason, canonicalKey } from '../../domain/cabinet-placement/cabinet-contracts.mjs';
import { operationError } from '../../domain/composition/operations/composition-operation-coordinator.mjs';
import { createCabinetPlacementNamespace } from './cabinet-placement.plugin.mjs';
import { createCompositionNamespace } from './composition.plugin.mjs';

const retryableCodes = new Set([
    'NOT_READY',
    'COMPOSITION_BUSY',
    'STALE_COMPOSITION',
    'STALE_CANDIDATE',
    'STALE_DEPENDENCIES',
    'STALE_OPTION',
    'APPLY_FAILED',
    'PREVIEW_LOAD_FAILED'
]);
/** Optional boundary, pinned to ONE service/API identity. Does not attach to window.
 * Scene bootstrap must supply readiness only after writer guards, strict geometry,
 * derived adapters and rollback are wired. Default is deliberately unsupported.
 * Destroy removes only facade subscriptions, not service-owned scene resources.
 * cabinets.moveSink({ apiInstanceId, compositionId, requestId, expectedCompositionRevision, fromCabinetId, toCabinetId })
 *   commits a pending sink landing (countertop getState().sink.pending): swaps the two cabinets' types with
 *   new ids, moves the sink config, lowers the countertop → receipt + { idMap: { [oldId]: newId }, sinkHostId }.
 * cabinets.liftSink({ …scope, fromCabinetId, sinkLocalM }) — lifted top takes the sink: SB → SC (new id), the top hosts it → + { idMap, sideCabinetId }.
 * cabinets.landSink({ …scope, toCabinetId }) — hosting top lands: SC → SB (new id, selected), the top lowered → + { idMap, sinkHostId }.
 */ function createCabinetFacades({ service = null, scope = service?.scope, buildId = 'unknown', collectionId = null, enabled = collectionId === 'ULH', inputEnabled = false, readDependencies, getReadiness = ()=>'unsupported' } = {}) {
    if (!scope || ![
        'apiInstanceId',
        'compositionId'
    ].every((key)=>typeof scope[key] === 'string' && scope[key])) {
        throw operationError('INVALID_SCOPE');
    }
    const identity = cloneData(scope), subscriptions = new Set();
    let destroyed = false;
    const context = ()=>{
        if (!service || typeof readDependencies !== 'function') return null;
        const dependencies = cloneData(readDependencies());
        if (!dependencies || ![
            'compositionRevision',
            'geometryRevision'
        ].every((key)=>Number.isSafeInteger(dependencies[key]) && dependencies[key] >= 0) || ![
            'catalogVersion',
            'policyVersion'
        ].every((key)=>typeof dependencies[key] === 'string' && dependencies[key])) {
            throw operationError('INVALID_DEPENDENCIES');
        }
        return {
            ...identity,
            dependencies
        };
    };
    const safeContext = ()=>{
        try {
            return context();
        } catch  {
            return null;
        }
    };
    const alive = ()=>{
        if (destroyed) throw operationError('API_DESTROYED');
    };
    const readiness = ()=>{
        if (!enabled || !service || typeof readDependencies !== 'function') return 'unsupported';
        if ([
            'apiInstanceId',
            'compositionId'
        ].some((key)=>service.scope?.[key] !== identity[key]) || !safeContext()) return 'error';
        const value = getReadiness();
        return [
            'initializing',
            'ready',
            'unsupported',
            'error'
        ].includes(value) ? value : 'error';
    };
    const requireReady = ()=>{
        alive();
        if (!enabled) throw operationError('UNSUPPORTED_COLLECTION');
        if (!service || [
            'apiInstanceId',
            'compositionId'
        ].some((key)=>service.scope?.[key] !== identity[key])) {
            throw operationError(service ? 'SCOPE_MISMATCH' : 'UNSUPPORTED');
        }
        const status = readiness();
        if (status !== 'ready') throw operationError(status === 'unsupported' ? 'UNSUPPORTED' : 'NOT_READY');
    };
    const checkScope = (input)=>{
        if (!input || [
            'apiInstanceId',
            'compositionId'
        ].some((key)=>input[key] !== identity[key])) {
            throw operationError('SCOPE_MISMATCH');
        }
    };
    function failure(error, requestId = null) {
        const code = typeof error?.code === 'string' ? error.code : 'INTERNAL_ERROR';
        // An uncoded error is a bug, not a domain refusal: keep its stack visible in the console.
        if (code === 'INTERNAL_ERROR') console.error('[cabinets] INTERNAL_ERROR', error);
        let reasons;
        try {
            reasons = cloneData(error?.reasons ?? [
                reason(code)
            ]);
        } catch  {
            reasons = [
                reason(code)
            ];
        }
        return {
            ok: false,
            error: {
                code,
                reasons,
                retryable: retryableCodes.has(code),
                requestId: typeof requestId === 'string' ? requestId : null
            },
            context: safeContext()
        };
    }
    const invoke = (method, kind)=>async (...args)=>{
            let before;
            try {
                requireReady();
                checkScope(args[0]);
                before = context();
                // Copy at entry so a caller cannot mutate a queued command or selection.
                const copied = args.map((value)=>value === undefined ? undefined : cloneData(value));
                const data = cloneData(await service[method](...copied));
                if (kind === 'query') {
                    alive();
                    if (canonicalKey(before) !== canonicalKey(context())) throw operationError('STALE_DEPENDENCIES');
                }
                // A completed mutation retains its receipt even if the facade was torn down
                // during await. Its pinned identity lets UI discard responses from an old iframe.
                return {
                    ok: true,
                    data,
                    context: safeContext() ?? before
                };
            } catch (error) {
                return failure(error, kind === 'command' ? args[0]?.requestId : null);
            }
        };
    function subscribe(mapping, event, callback, options = {}) {
        requireReady();
        if (!Object.hasOwn(mapping, event) || typeof callback !== 'function' || !options || Object.keys(options).some((key)=>key !== 'emitCurrent') || options.emitCurrent !== undefined && typeof options.emitCurrent !== 'boolean') {
            throw operationError('INVALID_SUBSCRIPTION');
        }
        const internalEvent = mapping[event];
        for (const record of subscriptions){
            if (record.event === internalEvent && record.callback === callback) return record.dispose;
        }
        const record = {
            event: internalEvent,
            callback,
            unsubscribe: null,
            lastSequence: -1,
            dispose: null
        };
        record.dispose = ()=>{
            if (!subscriptions.delete(record)) return;
            record.unsubscribe?.();
        };
        subscriptions.add(record);
        try {
            record.unsubscribe = service.on(internalEvent, (payload)=>{
                if (destroyed || !subscriptions.has(record) || !payload || payload.apiInstanceId !== identity.apiInstanceId || payload.compositionId !== identity.compositionId || !Number.isSafeInteger(payload.eventSequence) || payload.eventSequence <= record.lastSequence) return;
                record.lastSequence = payload.eventSequence;
                try {
                    callback(cloneData(payload));
                } catch  {}
            }, cloneData(options));
            // emitCurrent can synchronously destroy the boundary before on() returns.
            if (!subscriptions.has(record)) record.unsubscribe?.();
        } catch (error) {
            record.dispose();
            throw error;
        }
        return record.dispose;
    }
    function namespace(methods, mapping) {
        const api = {};
        for (const [name, [method, kind]] of Object.entries(methods)){
            if (typeof service?.[method] === 'function') api[name] = invoke(method, kind);
        }
        if (typeof service?.on === 'function') api.on = (event, callback, options)=>subscribe(mapping, event, callback, options);
        return api;
    }
    const boundary = {
        namespace,
        inputEnabled
    };
    const cabinets = namespace({
        getCatalog: [
            'getCatalog',
            'query'
        ],
        getConfigurationOptions: [
            'getConfigurationOptions',
            'query'
        ],
        getPlacementOptions: [
            'getPlacementOptions',
            'query'
        ],
        getState: [
            'getCabinetsState',
            'query'
        ],
        select: [
            'select',
            'operation'
        ],
        addStandard: [
            'addStandard',
            'command'
        ],
        moveSink: [
            'moveSink',
            'command'
        ],
        liftSink: [
            'liftSink',
            'command'
        ],
        landSink: [
            'landSink',
            'command'
        ]
    }, {
        change: 'cabinetsChange',
        selection: 'selection'
    });
    const api = {
        cabinets,
        cabinetPlacement: createCabinetPlacementNamespace(boundary),
        composition: createCompositionNamespace(boundary)
    };
    cabinets.getCapabilities = async ()=>{
        try {
            alive();
            const status = readiness(), dependencies = safeContext()?.dependencies;
            const supportedMethods = status === 'ready' ? Object.entries(api).flatMap(([name, ns])=>Object.keys(ns).map((method)=>`${name}.${method}`)) : [
                'cabinets.getCapabilities'
            ];
            return {
                ok: true,
                context: safeContext(),
                data: {
                    contractVersion: '1.0',
                    ...{
                        apiInstanceId: identity.apiInstanceId
                    },
                    buildId,
                    activeCompositionId: identity.compositionId,
                    collectionId,
                    readiness: status,
                    catalogVersion: dependencies?.catalogVersion ?? null,
                    policyVersion: dependencies?.policyVersion ?? null,
                    supportedMethods,
                    actions: [
                        [
                            'add-standard',
                            'cabinets.addStandard'
                        ],
                        [
                            'add-drag',
                            'cabinetPlacement.beginAdd'
                        ]
                    ].map(([id, method])=>({
                            id,
                            availability: supportedMethods.includes(method) ? 'available' : 'unsupported',
                            reasons: supportedMethods.includes(method) ? [] : [
                                reason('UNSUPPORTED')
                            ]
                        }))
                }
            };
        } catch (error) {
            return failure(error);
        }
    };
    for (const value of Object.values(api))Object.freeze(value);
    return Object.freeze({
        api: Object.freeze(api),
        destroy () {
            if (destroyed) return;
            destroyed = true;
            let firstError;
            for (const record of [
                ...subscriptions
            ]){
                try {
                    record.dispose();
                } catch (error) {
                    firstError ?? (firstError = error);
                }
            }
            if (firstError) throw firstError;
        }
    });
}

export { createCabinetFacades };
