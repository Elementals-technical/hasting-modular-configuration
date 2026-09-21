import type { ConfigurationSceneReader } from "@/entities/configuration";
import { readSceneProducts, setSceneProductConfig } from "@/utils/functions/playcanvas/sceneBridge";

import { createSceneReader } from "./createSceneReader";

/**
 * Makes each cabinet show the height a command applied (C06, I).
 *
 * In some compositions a batch update leaves a cabinet at its old height until it is configured
 * on its own. The actual height of each cabinet is read; a cabinet the scene left behind gets its
 * own config again, with the height and the values that go with it.
 */

export type CabinetHeightCheck = {
  runtimeIds: readonly string[];
  height: number;
  /** Values sent with the height to a cabinet that did not take it. */
  patch: Record<string, unknown>;
};

export const ensureCabinetHeights = async (
  { runtimeIds, height, patch }: CabinetHeightCheck,
  reader: ConfigurationSceneReader = createSceneReader(),
): Promise<{ resent: string[] }> => {
  if (runtimeIds.length === 0) return { resent: [] };

  const scene = await reader.read(runtimeIds);
  if (scene.status !== "ready") return { resent: [] };

  const actual = new Map(scene.cabinets.map(({ runtimeId, dimensions }) => [runtimeId, dimensions.height]));
  const stale = runtimeIds.filter((runtimeId) => actual.get(runtimeId) !== height);
  if (stale.length === 0) return { resent: [] };

  const current = await readSceneProducts(stale);
  const configs = current.status === "ready" ? current.configs : {};

  for (const runtimeId of stale) {
    await setSceneProductConfig(runtimeId, { ...(configs[runtimeId] ?? {}), ...patch, Height: height });
  }

  return { resent: stale };
};
