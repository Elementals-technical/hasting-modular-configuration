import { planCoverReconciliation } from './cover-reconcile-plan.mjs';

const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const validDiagnostic = item => item !== null && typeof item === 'object' &&
    !Array.isArray(item) && nonempty(item.code) && Array.isArray(item.sourceIds) &&
    item.sourceIds.every(nonempty);
const cloneSerializable = value => Array.isArray(value)
    ? value.map(cloneSerializable)
    : value !== null && typeof value === 'object'
        ? Object.fromEntries(Object.entries(value).map(([key, part]) => [key, cloneSerializable(part)]))
        : value;
const cloneSegment = segment => ({
    ...segment, supportIds: [...segment.supportIds], cabinetIds: [...segment.cabinetIds]
});
const cloneDiagnostic = item => cloneSerializable(item);
const cloneResult = result => ({ ...result, diagnostics: result.diagnostics.map(cloneDiagnostic) });
const errorData = (code, error) => ({ code, message: String(error?.message ?? error) });
const errorDiagnostic = error => ({ code: 'cover-service-error', sourceIds: [], details: error });

/** Owns one composition's derived cover products and their detached preparation queue. */
export function createCabinetCoverService({ port, onChange } = {}) {
    if (!port || ['allocateProductId', 'prepare', 'publish', 'dispose']
        .some(method => typeof port[method] !== 'function')) {
        throw new TypeError('Cabinet cover service requires allocateProductId, prepare, publish, and dispose');
    }

    let compositionId = null;
    let generation = 0;
    let requestedRevision = null;
    let appliedRevision = null;
    let appliedToken = null;
    let phase = 'idle';
    let stale = false;
    let lastError = null;
    let entries = [];
    let destroyed = false;
    let active = null;
    let pending = null;
    let awaitingPlan = false;
    let draining = false;
    let token = 0;
    let publishing = false;
    let lastResult = { status: 'unchanged', revision: null, compositionId: null, diagnostics: [] };
    let waiters = [];
    let failedCleanup = [];
    let ownershipLeased = false;

    function getState() {
        return {
            compositionId, generation, requestedRevision, appliedRevision, phase, stale,
            lastError: lastError && { ...lastError },
            entries: entries.map(entry => ({ productId: entry.productId, segment: cloneSegment(entry.segment) }))
        };
    }

    function emit() {
        if (typeof onChange !== 'function') return;
        try { onChange(getState()); } catch { /* Observers never own publication. */ }
    }

    function makeResult(status, revision = requestedRevision, id = compositionId, diagnostics = []) {
        return { status, revision, compositionId: id, diagnostics: diagnostics.map(cloneDiagnostic) };
    }

    function cancelled(job) {
        return makeResult('cancelled', job?.plan?.revision ?? null, job?.plan?.compositionId ?? null);
    }

    function current(job) {
        return !destroyed && !ownershipLeased && job.token === token && job.generation === generation &&
            job.plan.compositionId === compositionId && job.plan.revision === requestedRevision;
    }

    function disposeHandles(handles) {
        const errors = [];
        for (const handle of handles) {
            try { port.dispose(handle); }
            catch (error) {
                const data = errorData('dispose-failed', error);
                failedCleanup.push(handle);
                errors.push(data);
            }
        }
        return errors;
    }

    function retryFailedCleanup() {
        if (!failedCleanup.length) return [];
        const handles = failedCleanup;
        failedCleanup = [];
        return disposeHandles(handles);
    }

    function markError(code, error, revision = requestedRevision, id = compositionId) {
        lastError = errorData(code, error);
        phase = destroyed ? 'disposed' : 'error';
        stale = appliedToken !== token;
        const result = makeResult('error', revision, id, [errorDiagnostic(lastError)]);
        emit();
        return result;
    }

    function effectiveResult() {
        if (!failedCleanup.length) return cloneResult(lastResult);
        const data = lastError?.code === 'dispose-failed'
            ? lastError : { code: 'dispose-failed', message: 'One or more cover handles require cleanup' };
        return makeResult('error', requestedRevision, compositionId, [errorDiagnostic(data)]);
    }

    function settleWaiters() {
        if (draining || active || pending || awaitingPlan) return;
        const resolved = waiters;
        waiters = [];
        const result = effectiveResult();
        for (const resolve of resolved) resolve(cloneResult(result));
    }

    async function apply(job) {
        if (!current(job)) return cancelled(job);
        const previous = entries;
        const diff = planCoverReconciliation({ previous, plan: job.plan });
        if (diff.status !== 'ready') {
            if (current(job)) {
                lastError = { code: 'invalid-plan', message: 'Cover plan cannot be reconciled' };
                phase = 'error';
                stale = true;
                emit();
            }
            return makeResult(diff.status, job.plan.revision, job.plan.compositionId);
        }
        const changed = diff.remove.length > 0 || diff.next.some(item => item.action !== 'reuse');
        if (!changed) {
            if (!current(job)) return cancelled(job);
            appliedRevision = job.plan.revision;
            appliedToken = job.token;
            stale = false;
            phase = failedCleanup.length ? 'error' : 'idle';
            lastError = failedCleanup.length ? { code: 'dispose-failed', message: 'Pending cover cleanup' } : null;
            emit();
            if (!current(job)) return cancelled(job);
            return makeResult(failedCleanup.length ? 'error' : 'unchanged', job.plan.revision, job.plan.compositionId,
                failedCleanup.length ? [...job.plan.diagnostics, errorDiagnostic(lastError)] : job.plan.diagnostics);
        }

        const oldById = new Map(previous.map(entry => [entry.productId, entry]));
        const usedIds = new Set(oldById.keys());
        const nextEntries = [];
        const staged = [];
        try {
            for (const choice of diff.next) {
                if (!current(job)) {
                    const errors = disposeHandles(staged);
                    if (errors.length) markError('dispose-failed', errors[0], job.plan.revision, job.plan.compositionId);
                    return cancelled(job);
                }
                if (choice.action === 'reuse') {
                    const old = oldById.get(choice.productId);
                    nextEntries.push({ productId: old.productId, segment: cloneSegment(choice.segment), handle: old.handle });
                    continue;
                }
                let productId = choice.productId;
                if (choice.action === 'create') {
                    productId = port.allocateProductId({ compositionId: job.plan.compositionId });
                    if (!nonempty(productId) || usedIds.has(productId)) {
                        throw new Error('allocateProductId returned missing or duplicate ID');
                    }
                    usedIds.add(productId);
                }
                const handle = await port.prepare({
                    compositionId: job.plan.compositionId, revision: job.plan.revision,
                    productId, segment: cloneSegment(choice.segment)
                });
                if (handle === null || handle === undefined) throw new Error('prepare returned no handle');
                staged.push(handle);
                nextEntries.push({ productId, segment: cloneSegment(choice.segment), handle });
            }
            if (!current(job)) {
                const errors = disposeHandles(staged);
                if (errors.length) markError('dispose-failed', errors[0], job.plan.revision, job.plan.compositionId);
                return cancelled(job);
            }
            // Publication is one synchronous, rollbackable port operation. No await separates this
            // revision check from publish, and published handles are not disposed before success.
            publishing = true;
            try { port.publish({ compositionId: job.plan.compositionId, previousEntries: previous, nextEntries }); }
            finally { publishing = false; }
        } catch (error) {
            const cleanupErrors = disposeHandles(staged);
            if (!current(job)) {
                if (cleanupErrors.length) markError('dispose-failed', cleanupErrors[0], job.plan.revision, job.plan.compositionId);
                return cancelled(job);
            }
            const result = markError('publication-failed', error, job.plan.revision, job.plan.compositionId);
            if (cleanupErrors.length) {
                lastError = errorData('dispose-failed', cleanupErrors[0]);
                result.diagnostics.push(errorDiagnostic(lastError));
                emit();
            }
            return result;
        }

        entries = nextEntries;
        appliedRevision = job.plan.revision;
        appliedToken = job.token;
        stale = !current(job);
        const retained = new Set(diff.next.filter(item => item.action === 'reuse').map(item => item.productId));
        const cleanupErrors = disposeHandles(previous.filter(entry => !retained.has(entry.productId)).map(entry => entry.handle));
        if (cleanupErrors.length || failedCleanup.length) {
            return markError('dispose-failed', cleanupErrors[0] ?? 'Pending cover cleanup',
                job.plan.revision, job.plan.compositionId);
        }
        if (current(job)) {
            lastError = null;
            phase = 'idle';
        }
        emit();
        if (!current(job)) return cancelled(job);
        return makeResult('applied', job.plan.revision, job.plan.compositionId, job.plan.diagnostics);
    }

    async function drain() {
        try {
            while (pending) {
                const job = pending;
                pending = null;
                active = job;
                if (current(job)) {
                    phase = 'preparing';
                    emit();
                }
                let result;
                try { result = await apply(job); }
                catch (error) {
                    result = current(job) ? markError('service-failed', error, job.plan.revision, job.plan.compositionId)
                        : cancelled(job);
                }
                active = null;
                job.resolve(result);
                if (job.token === token) lastResult = cloneResult(result);
            }
        } finally {
            draining = false;
            if (pending) startDrain();
            else settleWaiters();
        }
    }

    function startDrain() {
        if (draining) return;
        draining = true;
        queueMicrotask(drain);
    }

    function cancelPending() {
        if (!pending) return;
        pending.resolve(cancelled(pending));
        pending = null;
    }

    /** Reserve a newer geometry revision before asynchronous extraction produces its plan. */
    function supersede(envelope) {
        const id = envelope?.compositionId;
        const revision = envelope?.revision;
        if (destroyed || !nonempty(id) || !Number.isSafeInteger(revision) || revision < 0 ||
            (compositionId !== null && id !== compositionId) ||
            (requestedRevision !== null && revision < requestedRevision)) return false;
        // Repeated notices for the same revision must not cancel a plan already received.
        if (requestedRevision === revision) return true;
        if (compositionId === null) compositionId = id;
        requestedRevision = revision;
        token++;
        cancelPending();
        awaitingPlan = true;
        stale = true;
        phase = 'preparing';
        lastError = null;
        emit();
        return true;
    }

    function rejectMalformedPlan(id, revision, field, matchingReservation) {
        const result = makeResult('invalid', revision, id, [
            { code: 'invalid-input', sourceIds: [], details: { field } }
        ]);
        if (matchingReservation) {
            awaitingPlan = false;
            lastError = { code: 'invalid', message: `Malformed cover plan: ${field}` };
            phase = 'error';
            stale = true;
            lastResult = cloneResult(result);
            emit();
            settleWaiters();
        }
        return Promise.resolve(result);
    }

    function request(plan) {
        const id = plan?.compositionId ?? null;
        const revision = plan?.revision ?? null;
        const matchingReservation = awaitingPlan && id === compositionId && revision === requestedRevision;
        if (destroyed || ownershipLeased) return Promise.resolve(makeResult('cancelled', revision, id));
        if (!nonempty(id) || !Number.isSafeInteger(revision) || revision < 0 ||
            !['ready', 'invalid', 'unsupported'].includes(plan?.status)) {
            return rejectMalformedPlan(id, revision, 'plan', matchingReservation);
        }
        if (compositionId !== null && id !== compositionId) {
            return Promise.resolve(makeResult('invalid', revision, id, [
                { code: 'invalid-input', sourceIds: [], details: { field: 'compositionId', reason: 'Reset before switching composition' } }
            ]));
        }
        if (requestedRevision !== null && revision < requestedRevision) {
            return Promise.resolve(makeResult('invalid', revision, id, [
                { code: 'invalid-input', sourceIds: [], details: { field: 'revision', reason: 'Older revision' } }
            ]));
        }
        if (plan.diagnostics !== undefined &&
            (!Array.isArray(plan.diagnostics) || !plan.diagnostics.every(validDiagnostic))) {
            return rejectMalformedPlan(id, revision, 'diagnostics', matchingReservation);
        }
        if (plan.status === 'ready' && (!Array.isArray(plan.segments) ||
            planCoverReconciliation({ previous: entries, plan }).status !== 'ready')) {
            return rejectMalformedPlan(id, revision, 'segments', matchingReservation);
        }

        if (compositionId === null) compositionId = id;
        requestedRevision = revision;
        if (matchingReservation) awaitingPlan = false;
        else {
            awaitingPlan = false;
            token++;
            cancelPending();
        }
        stale = appliedRevision !== revision || phase === 'error';
        if (plan.status !== 'ready') {
            lastError = { code: plan.status, message: `Cover plan ${plan.status}` };
            phase = 'error';
            stale = true;
            const result = makeResult(plan.status, revision, id, plan.diagnostics ?? []);
            lastResult = result;
            emit();
            settleWaiters();
            return Promise.resolve(cloneResult(result));
        }
        lastError = null;
        phase = 'preparing';
        stale = true;
        const acceptedPlan = {
            ...plan,
            segments: plan.segments.map(cloneSegment),
            diagnostics: (plan.diagnostics ?? []).map(cloneDiagnostic)
        };
        return new Promise(resolve => {
            pending = { plan: acceptedPlan, generation, token, resolve };
            emit();
            if (pending) startDrain();
        });
    }

    function clear(destroying, alreadyInvalidated = false) {
        if (destroying) destroyed = true;
        if (destroyed && !destroying) return Promise.resolve(makeResult('cancelled'));
        if (publishing) {
            token++;
            generation++;
            cancelPending();
            awaitingPlan = false;
            stale = true;
            if (destroying) phase = 'disposed';
            // The port may invoke application callbacks before its synchronous swap returns.
            // Clear after the swap has become the owned set, so those handles are not revived.
            return new Promise(resolve => {
                queueMicrotask(() => { clear(destroying, true).then(resolve); });
            });
        }
        if (!alreadyInvalidated) {
            token++;
            generation++;
            cancelPending();
        }
        awaitingPlan = false;
        const old = entries;
        const oldId = compositionId;
        const oldRevision = requestedRevision;
        if (old.length) {
            try {
                publishing = true;
                try { port.publish({ compositionId: oldId, previousEntries: old, nextEntries: [] }); }
                finally { publishing = false; }
            }
            catch (error) {
                lastResult = markError('reset-publish-failed', error, oldRevision, oldId);
                stale = true;
                if (destroying) phase = 'disposed';
                emit();
                settleWaiters();
                return whenSettled();
            }
            entries = [];
        }
        const cleanupErrors = [...retryFailedCleanup(), ...disposeHandles(old.map(entry => entry.handle))];
        compositionId = null;
        requestedRevision = null;
        appliedRevision = null;
        appliedToken = token;
        stale = false;
        phase = destroying ? 'disposed' : 'idle';
        lastError = null;
        lastResult = makeResult('applied', oldRevision, oldId);
        if (cleanupErrors.length || failedCleanup.length) {
            lastResult = markError('dispose-failed', cleanupErrors[0] ?? 'Pending cover cleanup', oldRevision, oldId);
        } else emit();
        settleWaiters();
        return whenSettled();
    }

    function whenSettled() {
        if (!draining && !active && !pending && !awaitingPlan) return Promise.resolve(effectiveResult());
        return new Promise(resolve => { waiters.push(resolve); });
    }

    function leasePublished(id) {
        if (destroyed || ownershipLeased || compositionId !== id || draining || active || pending || awaitingPlan ||
            publishing || failedCleanup.length || typeof port.leasePublished !== 'function') {
            throw Object.assign(new Error('Published cover ownership is not settled'), {code:'LEGACY_WRITERS_BUSY'});
        }
        const transferred=entries;
        const portLease=port.leasePublished(transferred);
        if (!portLease || typeof portLease.resume!=='function' || typeof portLease.dispose!=='function')
            throw new TypeError('Invalid cover port ownership lease');
        entries=[];ownershipLeased=true;emit();
        let closed=false;
        return Object.freeze({entries:transferred.map(entry=>({...entry,segment:cloneSegment(entry.segment)})),
            resume(){if(closed)return;portLease.resume();entries=transferred;ownershipLeased=false;closed=true;emit();},
            dispose(){if(closed)return;portLease.dispose();ownershipLeased=false;closed=true;emit();}});
    }

    return {
        request, supersede, getState, whenSettled, leasePublished,
        reset: () => clear(false),
        destroy: () => clear(true)
    };
}
