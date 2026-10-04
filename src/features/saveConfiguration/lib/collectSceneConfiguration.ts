import { getConfig } from "@/utils/functions/playcanvas/getConfig";
import { getOrderedProductIds } from "@/utils/functions/playcanvas/getOrderedProductIds";

/**
 * Reads the per-product configuration out of the scene.
 *
 * All five save entry points did this by hand, each with its own spelling of the same
 * two steps. Keeping it here means the payload cannot differ between them.
 *
 * The map is keyed by runtime id, matching the existing saved format. Stable identity
 * lives in the metadata fragment; this shape stays as it is so old readers keep working.
 */
export type SceneConfiguration = {
  orderedProductIds: string[];
  configuration: Record<string, unknown>;
};

export const collectSceneConfiguration = async (fallbackIds: string[] = []): Promise<SceneConfiguration> => {
  const orderedProductIds = getOrderedProductIds(fallbackIds);

  if (!orderedProductIds.length) {
    return { orderedProductIds: [], configuration: {} };
  }

  const configs = await Promise.all(orderedProductIds.map((id) => getConfig(id)));

  const configuration = orderedProductIds.reduce<Record<string, unknown>>((acc, id, index) => {
    acc[id] = configs[index];
    return acc;
  }, {});

  return { orderedProductIds, configuration };
};
