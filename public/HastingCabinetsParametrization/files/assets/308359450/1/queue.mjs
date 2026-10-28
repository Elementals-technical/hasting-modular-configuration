import { deepFreeze } from '../core/contracts/immutable.mjs';

export const createAsyncCommandQueueV1 = () => {
  let tail = Promise.resolve();
  let acceptedWatermark = 0;
  let settledWatermark = 0;
  const waiters = new Set();

  const notifyWaiters = () => {
    for (const waiter of [...waiters]) {
      if (settledWatermark >= waiter.watermark) {
        waiters.delete(waiter);
        waiter.resolve();
      }
    }
  };

  const enqueue = (sequence, executor) => {
    acceptedWatermark = Math.max(acceptedWatermark, sequence);
    const run = tail.catch(() => {}).then(async () => {
      try {
        return await executor();
      } finally {
        settledWatermark = Math.max(settledWatermark, sequence);
        notifyWaiters();
      }
    });
    tail = run;
    return run;
  };

  const whenSettled = (watermark = acceptedWatermark) => {
    if (settledWatermark >= watermark) {
      return Promise.resolve();
    }
    return new Promise(resolve => {
      waiters.add({ watermark, resolve });
    });
  };

  const snapshot = () => deepFreeze({
    acceptedWatermark,
    settledWatermark,
    pending: acceptedWatermark - settledWatermark
  });

  return Object.freeze({
    enqueue,
    whenSettled,
    snapshot,
    get acceptedWatermark() {
      return acceptedWatermark;
    },
    get settledWatermark() {
      return settledWatermark;
    }
  });
};
