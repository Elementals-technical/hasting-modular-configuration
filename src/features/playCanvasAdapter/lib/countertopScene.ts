import { applySceneConfig, setSceneProductConfig } from "@/utils/functions/playcanvas/sceneBridge";
import type { SceneCallResult, SceneOperationResult } from "@/utils/functions/playcanvas/sceneBridge";

/**
 * The countertop products of the scene (C06, I).
 *
 * The scene places a countertop with the cabinets; its size follows the composition and its saved
 * config comes back on restore. Neither is a configuration value, so these operations take scene
 * values as they are.
 */

export type CountertopSize = { Width?: number; Height?: number; Depth?: number };

/** Fits one countertop to the composition. */
export const fitCountertop = (countertopId: string, size: CountertopSize): Promise<SceneOperationResult> =>
  setSceneProductConfig(countertopId, size);

/** Puts saved countertop configs back, each on the countertops of its product type. */
export const restoreCountertopConfigs = async (
  configs: readonly { productType: string; config: Record<string, unknown> }[],
): Promise<SceneCallResult[]> => {
  const results: SceneCallResult[] = [];

  for (const { productType, config } of configs) {
    results.push(await applySceneConfig({ productType }, config));
  }

  return results;
};
