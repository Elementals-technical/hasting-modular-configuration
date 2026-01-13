import { updateDimensionDataForProduct } from "@/utils/functions/playcanvas/updateDimensionData";

type ConfigBatchIds = string[] | { productType?: string; productIds?: string[] };

export function setConfigBatch(ids: ConfigBatchIds, config: any) {
  // @ts-ignore
  const containerRef = window.containerRef;
  const canvasIframe = containerRef?.current?.contentWindow as any;

  const setConfigBatch = canvasIframe?.ConfiguratorAPI?.setConfigBatch;

  console.log("call setConfigBatch", setConfigBatch);
  console.log("ids", ids);
  console.log("config", config);

  if (!setConfigBatch) {
    console.warn("[PlayCanvas] ConfiguratorAPI.setConfigBatch not ready");
    return null;
  }

  try {
    const payload = Array.isArray(ids) ? { productIds: ids } : ids;

    const result = setConfigBatch(payload, config);

    const productIds = Array.isArray(payload.productIds) ? payload.productIds : [];

    const idsToUpdate = Array.isArray(result) ? result : productIds;

    idsToUpdate.forEach((productId) => updateDimensionDataForProduct(productId, config ?? {}));

    return result;
  } catch (error) {
    console.error("[PlayCanvas] Failed to setConfigBatch", error);
    return null;
  }
}
