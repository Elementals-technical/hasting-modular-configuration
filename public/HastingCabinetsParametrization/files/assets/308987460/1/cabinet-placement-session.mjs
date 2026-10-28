import { canonicalKey, cloneData, isRecord, isFiniteVec3, reason } from './cabinet-contracts.mjs';
import { operationError } from '../composition/operations/composition-operation-coordinator.mjs';

const emptyImpact = () => ({ added: [], updatedProductIds: [], removedProductIds: [], derivedChanges: [],
    requiresAcknowledgement: false, token: null });
const id = value => typeof value === 'string' && value.trim().length > 0;
const revision = value => Number.isSafeInteger(value) && value >= 0;
const keys = (value, allowed) => {
    if (!isRecord(value) || Object.keys(value).some(k => !allowed.includes(k))) throw operationError('INVALID_INPUT');
};
const placementInput = value => {
    keys(value, value?.kind === 'free' ? ['kind', 'frameId', 'positionM'] : ['kind', 'optionId']);
    if (value.kind === 'free') {
        keys(value.positionM, ['x', 'y', 'z']);
        if (!id(value.frameId) || !isFiniteVec3(value.positionM)) throw operationError('INVALID_INPUT');
    } else if (value.kind !== 'option' || !id(value.optionId)) throw operationError('INVALID_INPUT');
};
const metaKeys = ['apiInstanceId', 'compositionId', 'requestId', 'expectedCompositionRevision', 'sessionId'];

/** Internal Add flow. All renderer/state operations are injected; no engine globals.
 * evaluate receives a detached candidate and measured preview, and must derive all
 * applicability from trusted source/geometry adapters. createTransaction returns
 * coordinator ports; prepare sees { candidate, validation, handle } as its first arg.
 */
export function createCabinetPlacementSession({ scope, coordinator, catalog, readDependencies,
    preview, evaluate, createTransaction, resolveExisting } = {}) {
    if (!scope || !coordinator || !catalog || typeof readDependencies !== 'function' ||
        typeof evaluate !== 'function' || typeof createTransaction !== 'function' ||
        !['create', 'dispose', 'setPose'].every(k => typeof preview?.[k] === 'function') ||
        (resolveExisting !== undefined && typeof resolveExisting !== 'function')) throw operationError('INVALID_SESSION_PORTS');
    const identity = cloneData(scope), records = new Map(), requests = new Map(), listeners = new Set();
    const checkScope = request => {
        if (request?.apiInstanceId !== identity.apiInstanceId || request?.compositionId !== identity.compositionId) throw operationError('SCOPE_MISMATCH');
    };
    const find = sessionId => {
        const r = records.get(sessionId);
        if (!r) throw operationError('SESSION_NOT_FOUND');
        return r;
    };
    function stateOf(r) {
        const state = cloneData(r.state);
        const phase = coordinator.getState();
        const healthy = phase.phase !== 'recovery-required';
        state.canCancel = healthy && !r.cancelled && ['loading-draft', 'preview', 'applying'].includes(state.lifecycle) &&
            phase.canCancel;
        state.canApply = healthy && !r.cancelled && state.lifecycle === 'preview' && state.validation.status === 'valid' &&
            state.validation.candidateRevision === state.candidateRevision &&
            canonicalKey(state.validation.validatedDependencies) === canonicalKey(readDependencies());
        return state;
    }
    function emit(r) {
        for (const listener of [...listeners]) {
            try { listener(stateOf(r)); } catch { /* Listener failure cannot change domain state. */ }
        }
    }
    function pending(r) {
        r.state.validation = { status: 'pending', reasons: [], requiredDecisionIds: [],
            validatedDependencies: null, candidateRevision: r.state.candidateRevision };
        emit(r);
    }
    const current = (r, rev) => !r.cancelled && !r.closed && r.state.candidateRevision === rev;
    const cancelled = r => { if (r.cancelled) throw operationError('CANCELLED'); };
    async function disposeHandle(r, handle) {
        if (!handle || r.disposed.has(handle)) return;
        r.disposed.add(handle);
        try { await preview.dispose(handle); r.owned.delete(handle); }
        catch (cause) { coordinator.markRecoveryRequired(); throw operationError('RECOVERY_REQUIRED', cause); }
    }
    async function disposeAll(r) {
        for (const handle of r.owned) await disposeHandle(r, handle);
        r.handle = null;
    }
    const track = (r, promise) => {
        const tracked = promise.catch(error => {
            // create may fail cleanup before a handle exists; stale/cancelled work still owns resources.
            if (error?.code === 'RECOVERY_REQUIRED') coordinator.markRecoveryRequired();
            throw error;
        });
        r.work.add(tracked); tracked.then(() => r.work.delete(tracked), () => r.work.delete(tracked));
        return tracked;
    };
    async function validate(r, rev) {
        const dependencies = cloneData(readDependencies()), candidate = cloneData(r.state.candidate);
        const choice = r.state.kind === 'move' ? r.existingChoice : catalog.resolveChoice(candidate);
        let result = choice.status === 'valid'
            ? await evaluate(candidate, { handle: r.handle, dependencies, signal: r.abort.signal,
                kind: r.state.kind, productId: candidate.productId })
            : { ...choice, requiredDecisionIds: (choice.reasons ?? []).flatMap(x => x.decisionIds ?? []), effectivePlacement: null };
        if (!current(r, rev)) return;
        if (canonicalKey(dependencies) !== canonicalKey(readDependencies())) { pending(r); return; }
        if (!['valid', 'invalid', 'unsupported', 'pending'].includes(result?.status)) throw operationError('INVALID_POLICY_RESULT');
        if (result.status === 'valid' && (!result.effectivePlacement ||
            !['standard', 'remote'].includes(result.effectivePlacement.mode) ||
            !id(result.effectivePlacement.frameId) || !isFiniteVec3(result.effectivePlacement.positionM))) {
            throw operationError('INVALID_POLICY_RESULT');
        }
        const impact = result.impact ?? emptyImpact();
        if (impact.requiresAcknowledgement !== false || impact.token !== null) throw operationError('INVALID_POLICY_RESULT');
        r.state.validation = cloneData({ status: result.status, reasons: result.reasons ?? [],
            requiredDecisionIds: result.requiredDecisionIds ?? [], validatedDependencies: dependencies, candidateRevision: rev });
        r.state.candidate.effectivePlacement = cloneData(result.effectivePlacement ?? null);
        r.state.impact = cloneData(impact);
        emit(r);
        if (typeof preview.setValidation === 'function' && r.handle) {
            r.visualTail = r.visualTail.catch(() => {}).then(async () => {
                if (current(r, rev)) await preview.setValidation(r.handle, cloneData(r.state.validation));
            });
            await r.visualTail;
        }
    }
    async function refreshPreview(r, rev) {
        const candidate = cloneData(r.state.candidate);
        const choice = r.state.kind === 'move' ? r.existingChoice : catalog.resolveChoice(candidate);
        if (choice.status === 'valid') {
            const key = canonicalKey({ definitionId: candidate.definitionId, selection: candidate.selection,
                productId: candidate.productId });
            if (!r.handle || key !== r.handleKey) {
                const handle = await preview.create({ definitionId: candidate.definitionId, selection: candidate.selection },
                    { signal: r.abort.signal, runtime: choice.runtime, kind: r.state.kind, productId: candidate.productId });
                if (!handle || typeof handle !== 'object') throw operationError('PREVIEW_LOAD_FAILED');
                r.owned.add(handle);
                if (!current(r, rev)) { await disposeHandle(r, handle); return; }
                const old = r.handle; r.handle = handle; r.handleKey = key;
                if (old) await disposeHandle(r, old);
            }
            r.poseTail = r.poseTail.catch(() => {}).then(async () => {
                if (current(r, rev) && candidate.placement) await preview.setPose(r.handle, candidate.placement);
            });
            await r.poseTail;
        }
        if (!current(r, rev)) return;
        r.state.lifecycle = 'preview';
        await validate(r, rev);
        cancelled(r);
    }
    function remember(kind, input, operation) {
        try {
            checkScope(input);
            const request = cloneData(input);
            if (!id(request.requestId) || !id(request.sessionId) || !revision(request.expectedCompositionRevision)) throw operationError('INVALID_INPUT');
            const fingerprint = canonicalKey({ kind, request }), old = requests.get(request.requestId);
            if (old) {
                if (old.fingerprint !== fingerprint) throw operationError('REQUEST_ID_REUSED');
                return old.promise.then(cloneData);
            }
            const entry = { fingerprint, promise: null };
            requests.set(request.requestId, entry);
            try { entry.promise = Promise.resolve(operation(request)); }
            catch (error) { entry.promise = Promise.reject(error); }
            entry.promise.catch(() => {});
            return entry.promise.then(cloneData);
        } catch (error) { return Promise.reject(error); }
    }
    function beginAdd(input) {
        try { keys(input, [...metaKeys, 'definitionId', 'selection', 'initialPlacement']); }
        catch (error) { return Promise.reject(error); }
        return remember('beginAdd', input, request => {
            if (records.has(request.sessionId)) throw operationError('SESSION_ID_REUSED');
            if (request.expectedCompositionRevision !== readDependencies().compositionRevision) throw operationError('STALE_COMPOSITION');
            if (request.initialPlacement !== undefined) placementInput(request.initialPlacement);
            const choice = catalog.resolveChoice(request);
            if (choice.status !== 'valid') throw operationError('CATALOG_' + choice.status.toUpperCase());
            const token = coordinator.reserve(request.sessionId);
            const r = { token, handle: null, handleKey: null, owned: new Set(), disposed: new WeakSet(), work: new Set(),
                poseTail: Promise.resolve(), visualTail: Promise.resolve(), abort: new AbortController(), cancelled: false, closed: false, applyJob: null,
                state: { sessionId: request.sessionId, kind: 'add', lifecycle: 'loading-draft',
                    baseCompositionRevision: request.expectedCompositionRevision, candidateRevision: 0,
                    candidate: { definitionId: request.definitionId, selection: cloneData(request.selection),
                        productId: null, placement: cloneData(request.initialPlacement ?? null), effectivePlacement: null },
                    validation: { status: 'pending', reasons: [], requiredDecisionIds: [],
                        validatedDependencies: null, candidateRevision: 0 }, impact: emptyImpact(), canApply: false, canCancel: true } };
            records.set(request.sessionId, r); emit(r);
            return track(r, refreshPreview(r, 0)).then(() => { cancelled(r); return stateOf(r); }, async error => {
                if (coordinator.getState().phase === 'recovery-required') {
                    await disposeAll(r); r.closed = true; r.state.lifecycle = 'error'; emit(r); throw error;
                }
                if (r.cancelled) throw operationError('CANCELLED', error);
                if (!current(r, 0)) return stateOf(r);
                await disposeAll(r); r.closed = true; r.state.lifecycle = 'error';
                coordinator.release(token); emit(r); throw error;
            });
        });
    }
    function beginMove(input) {
        try { keys(input, [...metaKeys, 'productId']); }
        catch (error) { return Promise.reject(error); }
        return remember('beginMove', input, request => {
            if (typeof resolveExisting !== 'function') throw operationError('UNSUPPORTED_OPERATION');
            if (!id(request.productId)) throw operationError('INVALID_INPUT');
            if (records.has(request.sessionId)) throw operationError('SESSION_ID_REUSED');
            if (request.expectedCompositionRevision !== readDependencies().compositionRevision) throw operationError('STALE_COMPOSITION');
            const existing = resolveExisting(request.productId);
            if (existing?.then) throw operationError('INVALID_SESSION_PORTS');
            if (existing == null) throw operationError('UNKNOWN_CABINET');
            if (existing.id !== request.productId || !id(existing.definitionId) || !isRecord(existing.selection) ||
                existing.placement?.kind !== 'free') throw operationError('INVALID_EXISTING_CABINET');
            placementInput(existing.placement);
            const token = coordinator.reserve(request.sessionId);
            const r = { token, handle: null, handleKey: null, owned: new Set(), disposed: new WeakSet(), work: new Set(),
                poseTail: Promise.resolve(), visualTail: Promise.resolve(), abort: new AbortController(), cancelled: false,
                closed: false, applyJob: null, existingChoice: { status: 'valid', runtime: existing.runtime },
                state: { sessionId: request.sessionId, kind: 'move', lifecycle: 'loading-draft',
                    baseCompositionRevision: request.expectedCompositionRevision, candidateRevision: 0,
                    candidate: { definitionId: existing.definitionId, selection: cloneData(existing.selection),
                        productId: existing.id, placement: cloneData(existing.placement), effectivePlacement: null },
                    validation: { status: 'pending', reasons: [], requiredDecisionIds: [],
                        validatedDependencies: null, candidateRevision: 0 }, impact: emptyImpact(), canApply: false, canCancel: true } };
            records.set(request.sessionId, r); emit(r);
            return track(r, refreshPreview(r, 0)).then(() => { cancelled(r); return stateOf(r); }, async error => {
                if (coordinator.getState().phase === 'recovery-required') {
                    await disposeAll(r); r.closed = true; r.state.lifecycle = 'error'; emit(r); throw error;
                }
                if (r.cancelled) throw operationError('CANCELLED', error);
                if (!current(r, 0)) return stateOf(r);
                await disposeAll(r); r.closed = true; r.state.lifecycle = 'error';
                coordinator.release(token); emit(r); throw error;
            });
        });
    }
    async function updateDraft(input) {
        keys(input, ['apiInstanceId', 'compositionId', 'sessionId', 'expectedCandidateRevision', 'selectionPatch', 'placement']);
        checkScope(input);
        const request = cloneData(input), r = find(request.sessionId);
        coordinator.assertWritable(r.token);
        if (r.cancelled || r.closed || !['preview', 'loading-draft'].includes(r.state.lifecycle)) throw operationError('SESSION_BUSY');
        if (!revision(request.expectedCandidateRevision) || request.expectedCandidateRevision !== r.state.candidateRevision) throw operationError('STALE_CANDIDATE');
        if (request.placement !== undefined) placementInput(request.placement);
        if (r.state.kind === 'move' && (request.selectionPatch !== undefined ||
            (request.placement !== undefined && request.placement.kind !== 'free'))) throw operationError('UNSUPPORTED_OPERATION');
        if (request.selectionPatch !== undefined) {
            const definition = catalog.getDefinition(r.state.candidate.definitionId);
            keys(request.selectionPatch, definition.fields);
            r.state.candidate.selection = { ...r.state.candidate.selection, ...request.selectionPatch };
        }
        if (request.placement !== undefined) r.state.candidate.placement = request.placement;
        r.state.candidateRevision++; r.state.candidate.effectivePlacement = null;
        const candidateRevision = r.state.candidateRevision;
        pending(r);
        try { await track(r, refreshPreview(r, candidateRevision)); }
        catch (error) {
            if (coordinator.getState().phase === 'recovery-required') {
                r.state.lifecycle = 'error'; emit(r); throw error;
            }
            if (current(r, candidateRevision)) {
                r.state.validation = { status: 'pending', reasons: [reason('PREVIEW_FAILED')], requiredDecisionIds: [],
                    validatedDependencies: null, candidateRevision: r.state.candidateRevision };
                emit(r);
            }
            throw error;
        }
        return stateOf(r);
    }
    function apply(input) {
        try {
            keys(input, [...metaKeys, 'expectedCandidateRevision', 'acceptedImpactToken']);
            if (input.acceptedImpactToken != null) throw operationError('UNSUPPORTED_CONFIRMATION');
        } catch (error) { return Promise.reject(error); }
        return remember('apply', input, request => {
            const r = find(request.sessionId);
            coordinator.assertWritable(r.token);
            if (r.cancelled || r.closed || r.state.lifecycle !== 'preview') throw operationError('SESSION_BUSY');
            if (request.expectedCompositionRevision !== readDependencies().compositionRevision ||
                request.expectedCompositionRevision !== r.state.baseCompositionRevision) throw operationError('STALE_COMPOSITION');
            if (!revision(request.expectedCandidateRevision) || request.expectedCandidateRevision !== r.state.candidateRevision) throw operationError('STALE_CANDIDATE');
            r.state.lifecycle = 'applying'; pending(r);
            r.applyJob = Promise.resolve().then(async () => {
                await r.poseTail; cancelled(r);
                await validate(r, request.expectedCandidateRevision); cancelled(r);
                if (r.state.validation.status !== 'valid') throw operationError('PLACEMENT_' + r.state.validation.status.toUpperCase());
                const dependencies = cloneData(r.state.validation.validatedDependencies);
                const context = { kind: r.state.kind, request: cloneData(request), candidate: cloneData(r.state.candidate),
                    validation: cloneData(r.state.validation), handle: r.handle };
                const ports = createTransaction(context);
                const result = await coordinator.run({
                    request, kind: r.state.kind, payload: context.candidate, expectedDependencies: dependencies, lease: r.token,
                    ports: { ...ports,
                        prepare: (before, options) => ports.prepare(context, before, options),
                        materialize: (staging, before, metadata) => { emit(r); return ports.materialize(staging, before, metadata); },
                        assertCurrent: () => {
                            if (r.state.candidateRevision !== request.expectedCandidateRevision) throw operationError('STALE_CANDIDATE');
                            ports.assertCurrent?.();
                        },
                        // Preview is independent of the committed model. Clean it before source publication.
                        dispose: async staging => { await ports.dispose(staging); await disposeAll(r); }
                    }
                });
                r.closed = true; r.state.lifecycle = 'committed'; coordinator.release(r.token); emit(r);
                return result;
            }).catch(async error => {
                if (!r.cancelled && !r.closed) {
                    const recovery = coordinator.getState().phase === 'recovery-required';
                    r.state.lifecycle = recovery ? 'error' : 'preview';
                    // A transaction may have disposed the preview before discovering stale dependencies.
                    if (!recovery && !r.handle) {
                        try { await track(r, refreshPreview(r, r.state.candidateRevision)); }
                        catch { r.state.lifecycle = 'error'; r.closed = true; coordinator.release(r.token); }
                    }
                    emit(r);
                }
                throw error;
            }).finally(() => { r.applyJob = null; });
            return r.applyJob;
        });
    }
    async function cancel(scopeInput, sessionId) {
        checkScope(scopeInput); const r = find(sessionId);
        if (r.closed || ['committed', 'cancelled'].includes(r.state.lifecycle)) return stateOf(r);
        if (r.cancelJob) return r.cancelJob;
        const phase = coordinator.getState();
        if (!phase.canCancel) return stateOf(r);
        r.cancelled = true; r.abort.abort(); emit(r);
        r.cancelJob = (async () => {
            try {
                const result = await coordinator.cancel(r.token);
                if (!result.cancelled) { r.cancelled = false; return stateOf(r); }
                if (r.applyJob) { try { await r.applyJob; } catch { /* cleanup below */ } }
                await Promise.allSettled([...r.work]);
                await disposeAll(r);
                coordinator.release(r.token); r.closed = true; r.state.lifecycle = 'cancelled'; emit(r);
                return stateOf(r);
            } catch (error) {
                r.state.lifecycle = 'error'; coordinator.markRecoveryRequired(); emit(r); throw error;
            }
        })();
        return r.cancelJob;
    }
    return { beginAdd, beginMove, supportsMove: typeof resolveExisting === 'function', updateDraft, apply, cancel,
        getState: sessionId => stateOf(find(sessionId)),
        onChange(listener) {
            if (typeof listener !== 'function') throw operationError('INVALID_LISTENER');
            listeners.add(listener); return () => listeners.delete(listener);
        }
    };
}
