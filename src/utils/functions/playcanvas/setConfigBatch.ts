import { installConfiguratorApiLogger } from "@/utils/functions/playcanvas/apiLogger";
import { restoreSteppedSceneHeights, touchesSteppedHeight } from "@/utils/functions/playcanvas/steppedSceneProducts";
import { updateDimensionDataForProduct } from "@/utils/functions/playcanvas/updateDimensionData";

type ConfigBatchFilter = (productId: string, config: Record<string, unknown>) => boolean;
type ConfigBatchSelector = {
  productType?: string;
  productIds?: string[];
  cabinetId?: string;
  filter?: ConfigBatchFilter;
};
type ConfigBatchIds = string[] | ConfigBatchSelector;

// When multiple products are available, the first batch grows, the second one may appear earlier, and conflicts arise, forcing you to select options twice. This is serialized setConfigBatch so that the batches are executed strictly in sequence.
let batchQueue: Promise<unknown> = Promise.resolve();

/**
 * Runs a scene command after every batch queued before it. Shared with the runtime
 * adapter (sceneBridge.ts), so its commands and these calls never overtake each other.
 */
export const runInBatchQueue = <T>(task: () => Promise<T>): Promise<T> => {
  const queued = batchQueue.then(task, task);
  batchQueue = queued.then(
    () => undefined,
    () => undefined,
  );

  return queued;
};

export async function setConfigBatch(ids: ConfigBatchIds, config: any) {
  // @ts-ignore
  const containerRef = window.containerRef;
  const canvasIframe = containerRef?.current?.contentWindow as any;

  installConfiguratorApiLogger();

  const setConfigBatchApi = canvasIframe?.ConfiguratorAPI?.setConfigBatch;

  console.log("call setConfigBatch", setConfigBatchApi);
  console.log("ids", ids);
  console.log("config", config);

  if (!setConfigBatchApi) {
    console.warn("[PlayCanvas] ConfiguratorAPI.setConfigBatch not ready");
    return null;
  }

  const run = async () => {
    try {
      const payload = Array.isArray(ids) ? { productIds: ids } : ids;

      const result = await setConfigBatchApi(payload, config);

      const productIds = Array.isArray(payload.productIds) ? payload.productIds : [];

      const idsToUpdate = Array.isArray(result) ? result : productIds;

      idsToUpdate.forEach((productId) => updateDimensionDataForProduct(productId, config ?? {}));

      // A product with a height of its own does not keep the composition's (steppedSceneProducts).
      if (touchesSteppedHeight(config)) {
        const updatedIds = (result as { updatedIds?: unknown } | null)?.updatedIds;
        const reached = Array.isArray(updatedIds) ? updatedIds.filter((id) => typeof id === "string") : idsToUpdate;
        await restoreSteppedSceneHeights(canvasIframe?.ConfiguratorAPI, reached);
      }

      return result;
    } catch (error) {
      console.error("[PlayCanvas] Failed to setConfigBatch", error);
      return null;
    }
  };

  return runInBatchQueue(run);
}
