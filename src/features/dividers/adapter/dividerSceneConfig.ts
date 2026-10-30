import { applySceneConfig, setSceneProductConfig } from "@/utils/functions/playcanvas/sceneBridge";
import type { SceneCallResult } from "@/utils/functions/playcanvas/sceneBridge";

/**
 * Divider zones in the scene (C06, I).
 *
 * The dividers of a drawer live in its product's config as a zone object, not as a bound value
 * (runtime-bindings.json leaves DividersOption and DividersStyle unbound). These are the only
 * operations that write that object; the placed dividers are recorded by their callers.
 */

export type DividerDrawer = "TopDrawerDividers" | "BotDrawerDividers";

/** The zones of a product's drawers, as a saved config carries them. */
export type DividerZones = Partial<Record<DividerDrawer, unknown>>;

/** Empties the dividers of the given drawers of every product, in one call. */
export const clearDividerZones = (
  runtimeIds: readonly string[],
  drawers: readonly DividerDrawer[] = ["TopDrawerDividers", "BotDrawerDividers"],
): Promise<SceneCallResult> =>
  applySceneConfig(
    { productIds: [...runtimeIds] },
    Object.fromEntries(drawers.map((drawer) => [drawer, { zones: {} }])),
  );

/**
 * Puts divider zones back on products, one product at a time. Resolves to whether every product
 * took them; a product without zones is skipped.
 */
export const applyDividerZones = async (
  entries: readonly { runtimeId: string; zones: DividerZones }[],
): Promise<boolean> => {
  let tookAll = true;

  for (const { runtimeId, zones } of entries) {
    if (Object.keys(zones).length === 0) continue;

    const result = await setSceneProductConfig(runtimeId, zones);
    tookAll &&= result.status === "applied";
  }

  return tookAll;
};
