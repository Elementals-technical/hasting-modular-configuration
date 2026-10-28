import { canonicalKey, cloneData, isRecord } from '../../cabinet-placement/cabinet-contracts.mjs';

export const operationError = (code, cause) => Object.assign(new Error(code, cause ? { cause } : undefined), { code });
const requireId = value => typeof value === 'string' && value.trim().length > 0;
const stampKey = stamp => {
    if (!isRecord(stamp) || !['compositionRevision', 'geometryRevision'].every(k =>
        Number.isSafeInteger(stamp[k]) && stamp[k] >= 0) ||
        !['catalogVersion', 'policyVersion'].every(k => requireId(stamp[k]))) throw operationError('INVALID_DEPENDENCIES');
    return canonicalKey(stamp);
};

/**
 * One instance per live composition/API identity. Tokens are private capabilities.
 * Ports own resources: prepare must clean partial allocation before throwing;
 * materialize may write scene but never sources/history/events; publish is synchronous.
 * dispose releases temporary staging only, retaining anything needed by rollback.
 * readDependencies/publish must be synchronous. Journal lives for this API instance.
 */
export function createCompositionOperationCoordinator({ scope, readDependencies } = {}) {
    if (!isRecord(scope) || !requireId(scope.apiInstanceId) || !requireId(scope.compositionId) ||
        typeof readDependencies !== 'function') throw operationError('INVALID_COORDINATOR');
    const identity = cloneData(scope), journal = new Map(), mutationContexts = new WeakMap();
    let active = null, recovery = false;
    const checkScope = request => {
        if (request?.apiInstanceId !== identity.apiInstanceId || request?.compositionId !== identity.compositionId) {
            throw operationError('SCOPE_MISMATCH');
        }
    };
    const live = () => { if (recovery) throw operationError('RECOVERY_REQUIRED'); };
    const match = token => {
        live();
        if (!active || active.token !== token) throw operationError('STALE_LEASE');
        return active;
    };
    const getState = () => ({
        phase: recovery ? 'recovery-required' : active?.phase ?? 'idle',
        ownerId: active?.ownerId ?? null,
        canCancel: !recovery && !!active && ['preview', 'preparing'].includes(active.phase),
        canSave: !recovery && (!active || active.phase === 'preview')
    });
    const reserve = ownerId => {
        live();
        if (!requireId(ownerId)) throw operationError('INVALID_OWNER');
        if (active) throw operationError('COMPOSITION_BUSY');
        const token = Object.freeze({});
        active = { token, ownerId, phase: 'preview', cancelled: false, job: null, abort: null };
        return token;
    };
    const release = token => {
        const record = match(token);
        if (record.job) throw operationError('COMPOSITION_BUSY');
        active = null;
    };
    function run(command) {
        try {
            const { request, kind, payload, expectedDependencies, ports, lease } = command ?? {};
            checkScope(request);
            if (!requireId(request.requestId) || !requireId(kind) ||
                !Number.isSafeInteger(request.expectedCompositionRevision) || request.expectedCompositionRevision < 0) {
                throw operationError('INVALID_COMMAND');
            }
            const fingerprint = canonicalKey({ request, kind, payload, expectedDependencies });
            const old = journal.get(request.requestId);
            if (old) {
                if (old.fingerprint !== fingerprint) throw operationError('REQUEST_ID_REUSED');
                return old.promise.then(cloneData);
            }
            live();
            if (!ports || !['captureBefore', 'prepare', 'materialize', 'publish', 'rollback', 'dispose']
                .every(k => typeof ports[k] === 'function')) throw operationError('INVALID_TRANSACTION_PORTS');
            const expectedKey = stampKey(expectedDependencies);
            if (expectedDependencies.compositionRevision !== request.expectedCompositionRevision) throw operationError('STALE_COMPOSITION');
            if (stampKey(readDependencies()) !== expectedKey) throw operationError('STALE_DEPENDENCIES');
            const owned = !lease;
            const token = owned ? reserve(request.requestId) : lease;
            const record = match(token);
            if (record.job || record.phase !== 'preview' || record.cancelled) throw operationError('COMPOSITION_BUSY');
            const assertFresh = () => {
                if (stampKey(readDependencies()) !== expectedKey) throw operationError('STALE_DEPENDENCIES');
                ports.assertCurrent?.();
            };
            record.phase = 'preparing';
            record.abort = new AbortController();
            const entry = { fingerprint, status: 'pending', promise: null };
            const cancelled = () => { if (record.cancelled) throw operationError('CANCELLED'); };
            const issueContext = stage => {
                const mutationContext = Object.freeze({});
                const authority = { record, stage, open: true };
                mutationContexts.set(mutationContext, authority);
                return { metadata: { mutationContext }, close: () => { authority.open = false; } };
            };
            const inPhase = async (stage, operation) => {
                const context = issueContext(stage);
                try { return await operation(context.metadata); }
                finally { context.close(); }
            };
            // Schedule after registering the journal and lock, so re-entrant callers see pending.
            entry.promise = Promise.resolve().then(async () => {
                let before, staging, materialized = false, disposed = false;
                const dispose = async () => {
                    if (staging !== undefined && !disposed) {
                        disposed = true; // Exactly one disposal attempt; a failure locks recovery.
                        try { await ports.dispose(staging); }
                        catch (cause) { recovery = true; throw operationError('RECOVERY_REQUIRED', cause); }
                    }
                };
                try {
                    cancelled();
                    before = await inPhase('capture', metadata => ports.captureBefore(metadata));
                    cancelled();
                    staging = await inPhase('prepare', metadata => ports.prepare(before, { signal: record.abort.signal, ...metadata }));
                    cancelled();
                    assertFresh();
                    record.phase = 'publishing'; // Cancel cutoff, synchronous with the last check.
                    materialized = true;
                    await inPhase('materialize', metadata => ports.materialize(staging, before, metadata));
                    await dispose();
                    assertFresh();
                    // No await between final dependency check and source/revision/events publication.
                    const publication = issueContext('publish');
                    let receipt;
                    try { receipt = ports.publish(staging, before, publication.metadata); }
                    finally { publication.close(); }
                    if (receipt?.then) throw operationError('ASYNC_PUBLICATION_NOT_ALLOWED');
                    const result = cloneData(receipt);
                    record.phase = 'committed';
                    entry.status = 'succeeded'; entry.result = result;
                    return result;
                } catch (cause) {
                    // A prepare port can fail its own partial cleanup before returning staging.
                    if (cause?.code === 'RECOVERY_REQUIRED') recovery = true;
                    let failure = cause?.code ? cause : operationError('APPLY_FAILED', cause);
                    if (materialized) {
                        try { await inPhase('rollback', metadata => ports.rollback(before, staging, metadata)); }
                        catch (rollbackError) { recovery = true; failure = operationError('RECOVERY_REQUIRED', rollbackError); }
                    }
                    try { await dispose(); } catch (cleanupError) { failure = cleanupError; }
                    if (recovery) failure = operationError('RECOVERY_REQUIRED', failure);
                    record.phase = record.cancelled ? 'cancelling' : 'preview';
                    entry.status = 'failed'; entry.error = { code: failure.code };
                    throw failure;
                } finally {
                    record.job = null; record.abort = null;
                    if (owned && !recovery && active === record) active = null;
                }
            });
            record.job = entry.promise;
            journal.set(request.requestId, entry);
            // Journal observes rejected operations even if a transport caller disconnects.
            entry.promise.catch(() => {});
            return entry.promise.then(cloneData);
        } catch (error) {
            return Promise.reject(error);
        }
    }
    return {
        scope: Object.freeze(identity),
        reserve, release, run, getState,
        assertTransactionContext(context, { write = true, source = true } = {}) {
            const authority = context && mutationContexts.get(context);
            if (!authority?.open || authority.record !== active) throw operationError('INVALID_MUTATION_CONTEXT');
            // Owned rollback may repair sources even after cleanup raised the recovery lock.
            if (authority.stage !== 'rollback') live();
            const stages = source ? ['publish', 'rollback'] : ['materialize', 'publish', 'rollback'];
            if (write && !stages.includes(authority.stage)) throw operationError('INVALID_MUTATION_PHASE');
        },
        assertWritable(token) {
            live();
            if (active && (active.token !== token || active.cancelled)) throw operationError('COMPOSITION_BUSY');
        },
        assertCanSave() {
            live(); if (!getState().canSave) throw operationError('COMPOSITION_BUSY');
        },
        markRecoveryRequired() { recovery = true; },
        async cancel(token) {
            const record = match(token);
            if (['publishing', 'committed'].includes(record.phase)) return { cancelled: false, phase: record.phase };
            record.cancelled = true;
            record.abort?.abort();
            if (record.job) { try { await record.job; } catch { /* Actual outcome below. */ } }
            live();
            record.phase = 'cancelling';
            return { cancelled: true, phase: 'cancelling' };
        },
        getCommandResult(requestId) {
            const entry = journal.get(requestId);
            if (!entry) return { status: 'unknown' };
            return cloneData(entry.status === 'pending' ? { status: 'pending' } :
                entry.status === 'succeeded' ? { status: 'succeeded', result: entry.result } :
                    { status: 'failed', error: entry.error });
        }
    };
}
