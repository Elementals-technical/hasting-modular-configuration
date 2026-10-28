import { cloneData, reason } from '../../domain/cabinet-placement/cabinet-contracts.mjs';
import { operationError } from '../../domain/composition/operations/composition-operation-coordinator.mjs';
import { captureLegacySceneCheckpoint } from '../../domain/composition/operations/legacy-scene-checkpoint.mjs';
import { createCabinetRuntimePlugin } from './cabinet-runtime.plugin.mjs';

const methods = {
    cabinets: [
        'getCatalog',
        'getConfigurationOptions',
        'getPlacementOptions',
        'getState',
        'select',
        'addStandard'
    ],
    cabinetPlacement: [
        'beginAdd',
        'beginMove',
        'updateDraft',
        'getState',
        'settleInput',
        'apply',
        'cancel'
    ],
    composition: [
        'getState',
        'exportSnapshot',
        'restoreSnapshot',
        'getCommandResult'
    ]
};
const failure = (error)=>({
        ok: false,
        context: null,
        error: {
            code: error?.code ?? 'INTERNAL_ERROR',
            reasons: cloneData(error?.reasons?.length ? error.reasons : [
                reason(error?.code ?? 'INTERNAL_ERROR')
            ]),
            requestId: null,
            retryable: [
                'NOT_READY',
                'COMPOSITION_MANAGER_NOT_READY',
                'STALE_DEPENDENCIES',
                'COMPOSITION_BUSY'
            ].includes(error?.code)
        }
    });
/** Deferred, explicit handoff of the active line composition. No private demo manager.
 * prepareFromLine is trusted application wiring, NEVER a UI-supplied config/mapping.
 * It must prepare without source writes and return {configuration, release}; release
 * owns provider-only resources, not roots transferred to the generic runtime.
 * Missing mapping/geometry/quiescence is unsupported, never replaced with dummy ports.
 */ function createCabinetLineRuntime({ app, prepareFromLine = null, buildId = 'cabinet-line-runtime-v1' } = {}) {
    // PlayCanvas script initialization order does not guarantee a manager at bridge creation.
    if (!app || typeof app !== 'object') throw operationError('INVALID_APPLICATION');
    let runtime = null, prepared = null, activation = null, destruction = null, closed = false, recovery = false, lastError = null;
    let cleanupJob = null, boundCompositionId = null;
    let mode = 'line';
    const alive = ()=>{
        if (closed) throw operationError('API_DESTROYED');
    };
    const requireReady = ()=>{
        alive();
        if (recovery) throw operationError('RECOVERY_REQUIRED');
        if (mode !== 'modular') throw operationError('NOT_READY');
    };
    const markRecovery = ()=>{
        recovery = true;
        if (boundCompositionId) app.compositionManager._ulhActivationCompositionId = boundCompositionId;
    };
    const cleanup = ()=>{
        if (!cleanupJob) cleanupJob = (async ()=>{
            const errors = [];
            try {
                await runtime?.destroy();
            } catch (error) {
                errors.push(error);
            }
            try {
                await prepared?.release?.();
            } catch (error) {
                errors.push(error);
            }
            if (errors.length) {
                markRecovery();
                throw operationError('RECOVERY_REQUIRED', errors[0]);
            }
            runtime = null;
            prepared = null;
        })();
        return cleanupJob;
    };
    const getCapabilities = async ()=>{
        try {
            alive();
            if (mode === 'modular') {
                const result = await runtime.api.cabinets.getCapabilities();
                return result.ok ? {
                    ...result,
                    data: {
                        ...result.data,
                        mode,
                        activation: {
                            availability: 'complete',
                            reason: null
                        },
                        supportedMethods: [
                            ...result.data.supportedMethods,
                            'cabinets.activateFromLine',
                            ...runtime.compatibility?.active ? [
                                'addProduct',
                                'presetProducts'
                            ] : []
                        ]
                    }
                } : result;
            }
            const managerReady = typeof app.compositionManager?.getActiveComposition === 'function';
            const available = managerReady && typeof prepareFromLine === 'function' && !recovery && !activation;
            return {
                ok: true,
                context: null,
                data: {
                    contractVersion: '1.0',
                    buildId,
                    apiInstanceId: null,
                    activeCompositionId: app.compositionManager?.getActiveComposition?.()?.compositionId ?? null,
                    collectionId: null,
                    catalogVersion: null,
                    policyVersion: null,
                    mode,
                    readiness: recovery ? 'error' : activation || !managerReady ? 'initializing' : 'unsupported',
                    supportedMethods: [
                        'cabinets.getCapabilities',
                        ...available ? [
                            'cabinets.activateFromLine'
                        ] : []
                    ],
                    activation: {
                        availability: available ? 'available' : 'unsupported',
                        reason: recovery ? 'RECOVERY_REQUIRED' : !managerReady ? 'COMPOSITION_MANAGER_NOT_READY' : activation ? 'COMPOSITION_BUSY' : typeof prepareFromLine !== 'function' ? 'LINE_ADOPTION_PROVIDER_REQUIRED' : null
                    },
                    lastError,
                    actions: [
                        'add-standard',
                        'add-drag'
                    ].map((id)=>({
                            id,
                            availability: 'unsupported',
                            reasons: [
                                reason('NOT_READY')
                            ]
                        }))
                }
            };
        } catch (error) {
            return failure(error);
        }
    };
    const activateFromLine = (...args)=>{
        try {
            alive();
            if (args.length) throw operationError('INVALID_REQUEST');
            if (recovery) throw operationError('RECOVERY_REQUIRED');
            if (mode === 'modular') return getCapabilities();
            if (activation) return activation;
            if (typeof app.compositionManager?.getActiveComposition !== 'function') throw operationError('COMPOSITION_MANAGER_NOT_READY');
            if (typeof prepareFromLine !== 'function') throw operationError('LINE_ADOPTION_PROVIDER_REQUIRED');
        } catch (error) {
            return Promise.resolve(failure(error));
        }
        cleanupJob = null;
        const job = (async ()=>{
            try {
                const manager = app.compositionManager;
                manager.assertCompositionMutable?.();
                if (manager.getActiveComposition()?.hasMutationGuard?.()) throw operationError('COMPOSITION_ALREADY_MODULAR');
                const checkpoint = captureLegacySceneCheckpoint({
                    app,
                    manager
                });
                boundCompositionId = checkpoint.source.compositionId;
                // No awaits before snapshot: it describes the state at this user command.
                prepared = await prepareFromLine({
                    app,
                    manager,
                    source: cloneData(checkpoint.source)
                });
                alive();
                checkpoint.assertUnchanged();
                if (!prepared?.configuration || typeof prepared.release !== 'function') throw operationError('INVALID_LINE_PROVIDER');
                if (prepared.configuration.initialDocument?.id !== checkpoint.source.compositionId) throw operationError('SCOPE_MISMATCH');
                runtime = createCabinetRuntimePlugin({
                    app,
                    configuration: prepared.configuration,
                    buildId
                });
                const result = await runtime.start();
                if (result.status !== 'ready') throw operationError('RUNTIME_NOT_READY');
                // A committed activation is never reported as a retryable failure just because
                // teardown was requested concurrently; destroy waits for this receipt.
                mode = 'modular';
                lastError = null;
                return getCapabilities();
            } catch (error) {
                lastError = error?.code ?? 'INTERNAL_ERROR';
                if (error?.code === 'RECOVERY_REQUIRED') markRecovery();
                try {
                    await cleanup();
                } catch (cleanupError) {
                    error = cleanupError;
                    lastError = error.code;
                }
                if (recovery) {
                    // Keep legacy writes/Save closed after an uncertain ownership cleanup.
                    markRecovery();
                }
                return failure(error);
            }
        })();
        activation = job;
        job.finally(()=>{
            if (activation === job) activation = null;
        });
        return job;
    };
    const api = {};
    for (const [ns, names] of Object.entries(methods)){
        api[ns] = Object.fromEntries(names.map((name)=>[
                name,
                async (...args)=>{
                    try {
                        requireReady();
                        if (typeof runtime.api[ns]?.[name] !== 'function') throw operationError('UNSUPPORTED_OPERATION');
                        return await runtime.api[ns][name](...args);
                    } catch (error) {
                        return failure(error);
                    }
                }
            ]));
        api[ns].on = (...args)=>{
            requireReady();
            return runtime.api[ns].on(...args);
        };
    }
    Object.assign(api.cabinets, {
        getCapabilities,
        activateFromLine
    });
    for (const ns of Object.values(api))Object.freeze(ns);
    const compatibility = Object.freeze({
        get active () {
            return !closed && !recovery && mode === 'modular' && runtime?.compatibility?.active === true;
        },
        addProduct: (type, config)=>{
            requireReady();
            return runtime.compatibility?.addProduct(type, config) ?? Promise.reject(operationError('LINE_COMMAND_UNSUPPORTED'));
        },
        presetProducts: (items, globalConfig)=>{
            requireReady();
            return runtime.compatibility?.presetProducts(items, globalConfig) ?? Promise.reject(operationError('LINE_COMMAND_UNSUPPORTED'));
        }
    });
    return Object.freeze({
        api: Object.freeze(api),
        compatibility,
        start: async ()=>{
            alive();
            return {
                status: 'deferred'
            };
        },
        destroy () {
            if (!destruction) {
                closed = true;
                destruction = (async ()=>{
                    await activation;
                    await cleanup();
                })();
            }
            return destruction;
        }
    });
}

export { createCabinetLineRuntime };
