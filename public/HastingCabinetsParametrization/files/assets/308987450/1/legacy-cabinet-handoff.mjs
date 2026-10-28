import { MeshBooleanQueue } from '../../../../mesh-boolean/core/MeshBooleanQueue.mjs';
import { isCabinetCoverProduct, resolveBasinTopProduct } from '../../countertop/countertop-role.mjs';

const failure = (code, reason) => Object.assign(new Error(reason), { code });
const bounded = async (promise, timeoutMs = 5000) => {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise((_, reject) => { timer = setTimeout(() => reject(failure('LEGACY_WRITERS_BUSY', 'Legacy settle timed out')), timeoutMs); })
    ]);
  } finally { clearTimeout(timer); }
};
const descendants = root => {
  const found = [];
  const visit = entity => {
    found.push(entity);
    for (const child of entity.children ?? []) visit(child);
  };
  visit(root);
  return found;
};

/** Reversible ownership transfer for live SC roots. No entity, mesh or material is disposed here. */
export function createLegacyCabinetHandoff({ app, manager, compositionId, entities } = {}) {
  const roots = Array.isArray(entities) ? [...entities] : [];
  const requiredExecutorCount=()=>{
    const products=manager?.getComposition?.(compositionId)?.getAllProducts?.();
    return products?roots.filter(root=>products[root.name]?.productType==='ULH-side-cabinet').length:roots.length;
  };
  const participants = () => {
    const executors = [], booleans = [];
    for (const root of roots) {
      for (const entity of descendants(root)) {
        const executor = entity.script?.productController?.ruleExecutor;
        if (executor) executors.push(executor);
        const boolean = entity.script?.meshBoolean;
        if (boolean) booleans.push(boolean);
      }
    }
    return { executors: [...new Set(executors)], booleans: [...new Set(booleans)] };
  };
  const checkStatic = () => {
    if (!app?.root?.findByName || !manager || !compositionId || !roots.length ||
        manager.getActiveComposition?.()?.compositionId !== compositionId ||
        manager.getComposition?.(compositionId) !== manager.getActiveComposition?.()) return 'scope';
    if (new Set(roots).size !== roots.length ||
        roots.some(root => !root?.name || !root.parent || root.destroyed || app.root.findByName(root.name) !== root)) return 'roots';
    if (!app._legacyLineWriteBarrier || typeof app._legacyLineWriteBarrier.whenIdle !== 'function' ||
        typeof app._legacyLineWriteBarrier.activeCount !== 'number') return 'command-fence';
    if (!manager.aggregator?.whenIdle || !manager.aggregator?.suspendForComposition ||
        !manager.modules?.whenSettled || !manager.modules?.suspendLegacy ||
        !manager.cabinetCoverCompositionAdapter?.whenSettled ||
        !manager.cabinetCoverCompositionAdapter?.suspendForComposition ||
        !manager.spatial || !manager.countertopCompositionAdapter?.suspendLegacy) return 'legacy-participants';
    const products=manager.getComposition(compositionId)?.getAllProducts?.()??{};
    const covers=Object.entries(products).filter(([,snapshot])=>isCabinetCoverProduct(snapshot));
    const basin=resolveBasinTopProduct(products);
    if(basin.status==='ambiguous')return 'ambiguous-basin-top';
    if(covers.length){
      const service=manager.cabinetCoverService;
      const state=service?.getState?.();
      if(typeof service?.leasePublished!=='function'||state?.compositionId!==compositionId||
          state.entries.length!==covers.length||covers.some(([id])=>!state.entries.some(entry=>entry.productId===id)))
        return 'unowned-covers';
    }
    if(manager.countertopCompositionAdapter.binding &&
        (basin.status!=='found'||manager.countertopCompositionAdapter.binding.productId!==basin.productId))
      return 'active-countertop';
    const { executors, booleans } = participants();
    if (executors.length < requiredExecutorCount() || executors.some(item => typeof item.suspendLegacy !== 'function')) return 'product-rules';
    if (booleans.some(item => typeof item.suspendLegacy !== 'function')) return 'mesh-boolean';
    return null;
  };

  async function verifyReadiness() {
    const unsupported = checkStatic();
    if (unsupported) return { status: 'unsupported', reason: unsupported };
    const barrier = app._legacyLineWriteBarrier;
    let commandIdle;
    try { commandIdle = !barrier.activeCount && await bounded(barrier.whenIdle(5000)); }
    catch { commandIdle = false; }
    if (!commandIdle || barrier.activeCount) {
      return { status: 'busy', reason: 'accepted-legacy-command' };
    }
    if (!await manager.aggregator.whenIdle(5000)) return { status: 'busy', reason: 'aggregation' };
    try {
      await bounded(manager.modules.whenSettled());
      if(manager.countertopCompositionAdapter.binding){
        const top=await bounded(manager.countertopCompositionAdapter.whenSettled());
        if(['error','cancelled'].includes(top?.status))
          return{status:'unsupported',reason:'countertop-settle-error'};
      }
      const cover = await bounded(manager.cabinetCoverCompositionAdapter.whenSettled());
      if (cover?.status === 'error') return { status: 'unsupported', reason: 'cover-settle-error' };
    } catch {
      return { status: 'busy', reason: 'legacy-settle-failed' };
    }
    if (manager.spatial.settling || barrier.activeCount) return { status: 'busy', reason: 'spatial-or-command' };
    const { executors, booleans } = participants();
    if (executors.some(item => item.isExecuting || item.executionQueue?.length ||
        item.rules?.some(rule => rule._booleanInFlight))) return { status: 'busy', reason: 'product-rules' };
    if (booleans.some(item => item._isUpdating || item._pendingBooleanPromise || item._booleanTimer ||
        item._waitFrameCallbacks?.size || item._assetLoadWaits?.size || MeshBooleanQueue._queuedItems.has(item))) {
      return { status: 'busy', reason: 'mesh-boolean' };
    }
    return { status: 'ready' };
  }

  async function quiesceLegacy() {
    if (manager?._ulhActivationCompositionId !== compositionId) {
      throw failure('LEGACY_HANDOFF_UNSUPPORTED', 'Legacy command-entry fence is not active');
    }
    const readiness = await verifyReadiness();
    if (readiness.status !== 'ready') {
      throw failure(readiness.status === 'busy' ? 'LEGACY_WRITERS_BUSY' : 'LEGACY_HANDOFF_UNSUPPORTED', readiness.reason);
    }
    const resumes = [],commits=[];
    let finished = false;
    const unwind = async () => {
      const errors = [];
      const failed = [];
      for (const resume of resumes.splice(0).reverse()) {
        try { await resume(); } catch (error) { errors.push(error); failed.push(resume); }
      }
      resumes.push(...failed.reverse());
      if (errors.length) throw new AggregateError(errors, 'Legacy handoff could not resume');
    };
    try {
      resumes.push(manager.aggregator.suspendForComposition(compositionId));
      resumes.push(manager.cabinetCoverCompositionAdapter.suspendForComposition(compositionId));
      const basin=resolveBasinTopProduct(manager.getComposition(compositionId)?.getAllProducts?.()??{});
      resumes.push(manager.countertopCompositionAdapter.suspendLegacy(
          basin.status==='found'?{adoptTopId:basin.productId}:undefined));
      if(basin.status==='found'&&manager.countertopCompositionAdapter.binding)
        commits.push(()=>manager.countertopCompositionAdapter.retireLegacyAdoption(basin.productId));
      const coverState=manager.cabinetCoverService?.getState?.();
      if(coverState?.compositionId===compositionId&&coverState.entries.length){
        const coverLease=manager.cabinetCoverService.leasePublished(compositionId);
        resumes.push(()=>coverLease.resume());commits.push(()=>coverLease.dispose());
      }
      resumes.push(await manager.modules.suspendLegacy());
      const { executors, booleans } = participants();
      for (const executor of executors) resumes.push(executor.suspendLegacy());
      for (const boolean of booleans) resumes.push(boolean.suspendLegacy());
      if (app._legacyLineWriteBarrier.activeCount || manager.spatial.settling) {
        throw failure('LEGACY_WRITERS_BUSY', 'A legacy writer became active during handoff');
      }
    } catch (error) {
      try { await unwind(); } catch (resumeError) {
        manager._ulhHandoffRecoveryRequired = true;
        throw failure('LEGACY_HANDOFF_RECOVERY_REQUIRED', `Legacy handoff rollback failed: ${resumeError.message}`);
      }
      throw error;
    }
    return {
      async resume() {
        if (finished) return;
        await unwind();
        finished = true;
      },
      async dispose() {
        if (finished) return;
        for(const commit of commits)await commit();
        finished = true;
        resumes.length = 0;
      }
    };
  }

  return { verifyReadiness, quiesceLegacy };
}
