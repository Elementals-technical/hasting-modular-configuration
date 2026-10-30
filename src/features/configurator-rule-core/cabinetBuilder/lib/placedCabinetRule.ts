import { resolveCabinetTypeOfSceneId } from "@/entities/collection";
import {
  isSteppedDrawers,
  type ConfiguratorCatalog,
  type TypeCabinetRuleConfig,
} from "@/shared/config/configurator/typeCabinetCatalog";

/**
 * The catalog rule of a placed product, from its runtime id.
 *
 * Read as the rest of the configurator reads a runtime id (`resolveCabinetTypeOfRuntimeId`): the
 * id names the scene product that placed the cabinet ("Mako-sink-cabinet-3"), and the catalog
 * carries the scene product of each type from the runtime bindings. A catalog built without them
 * falls back to the cabinet type the id starts with ("Sink-Base-3"). `placedDrawers`, the cabinet's
 * drawer style (`placedCabinetStyles`), tells a short cabinet from a tall type with its scene product.
 */
export const findPlacedCabinetRule = (
  catalog: ConfiguratorCatalog,
  runtimeId: string,
  placedDrawers?: string | null,
): TypeCabinetRuleConfig | null => {
  const rules = catalog.typeCabinetRules;
  const productTypes = Object.fromEntries(
    rules.flatMap(({ code, sceneProductType }) => (sceneProductType ? [[code, sceneProductType] as const] : [])),
  );
  const cabinetType = resolveCabinetTypeOfSceneId(
    rules.map(({ code }) => code),
    productTypes,
    runtimeId,
    rules.filter((rule) => isSteppedDrawers(rule, placedDrawers)).map(({ code }) => code),
  );

  return rules.find(({ code }) => code === cabinetType) ?? null;
};
