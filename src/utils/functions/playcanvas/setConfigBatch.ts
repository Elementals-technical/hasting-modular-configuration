import { updateDimensionDataForProduct } from "@/utils/functions/playcanvas/updateDimensionData";

type ConfigBatchIds = string[] | { productType?: string; productIds?: string[]; cabinetId?: string };

// When multiple products are available, the first batch grows, the second one may appear earlier, and conflicts arise, forcing you to select options twice. This is serialized setConfigBatch so that the batches are executed strictly in sequence.
let batchQueue: Promise<unknown> = Promise.resolve();

export async function setConfigBatch(ids: ConfigBatchIds, config: any) {
  // @ts-ignore
  const containerRef = window.containerRef;
  const canvasIframe = containerRef?.current?.contentWindow as any;

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

      return result;
    } catch (error) {
      console.error("[PlayCanvas] Failed to setConfigBatch", error);
      return null;
    }
  };

  const queued = batchQueue.then(run, run);
  batchQueue = queued.then(
    () => undefined,
    () => undefined,
  );

  return queued;
}
