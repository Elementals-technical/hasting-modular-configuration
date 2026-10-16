import { resolveProductConfig } from "@/entities/collection";
import type { RuntimeBindingSet, ScenePatch, SteppedSceneProduct } from "@/entities/collection";
import type { ConfiguratorCatalog } from "@/shared/config/configurator/typeCabinetCatalog";

/**
 * The scene products that keep a height of their own beside the taller ones, for the scene bridge
 * (utils/functions/playcanvas/steppedSceneProducts). Nothing here is written twice:
 * - which drawer style is short: the profile's `ruleData.steppedModules` (catalog `steppedDrawers`);
 * - its heights by handle: the cabinet table's forced heights of that style (catalog `steppedHeightByHandle`);
 * - how the scene knows it: the type's scene product, with the style and the handle as the runtime
 *   bindings translate them.
 *
 * Example (Urban Freestanding, table 590 `UG/1DW:56|PTO/1DW:53|CG/1DW:56`):
 *   Sink-Cabinet → { productType: "UF-side-cabinet", match: { Drawers: "1D" }, heightByHandle: { UG: 56, PTO: 53, CG: 56 } }
 *
 * Empty without a catalog or bindings, and for a collection with no stepped style.
 */
export const buildSteppedSceneProducts = (
  catalog: ConfiguratorCatalog | null | undefined,
  bindings: RuntimeBindingSet | null | undefined,
): SteppedSceneProduct[] => {
  if (!catalog || !bindings) return [];

  return catalog.typeCabinetRules.flatMap((rule) => {
    // A series variant repeats the styles of its type; the collection's own rule names them once.
    const sceneType = rule.sceneProductType;
    if (rule.series !== undefined || !sceneType) return [];

    return (rule.steppedDrawers ?? []).flatMap((drawers) => {
      // 1. The scene values that make the product short: its style as the scene spells it ("1" → "1D").
      const match = resolveProductConfig(bindings, { Drawers: drawers }, undefined, sceneType) as ScenePatch;

      // 2. The style's heights by the handle as the scene holds it (the bridge reads config.Handle).
      const heightByHandle: Record<string, number> = {};
      for (const [handle, heightCm] of Object.entries(rule.steppedHeightByHandle?.[drawers] ?? {})) {
        const sceneHandle = resolveProductConfig(bindings, { Handle: handle }, undefined, sceneType).Handle;
        if (typeof sceneHandle === "string" && sceneHandle) heightByHandle[sceneHandle] = heightCm;
      }

      // A style the table gives no height keeps the composition's: nothing to correct.
      if (Object.keys(match).length === 0 || Object.keys(heightByHandle).length === 0) return [];
      return [{ productType: sceneType, match, heightByHandle }];
    });
  });
};
