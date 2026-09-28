import { resolveCabinetTypeOfSceneId } from "@/entities/collection";
import type { ConfiguratorCatalog, TypeCabinetRuleConfig } from "@/shared/config/configurator/typeCabinetCatalog";

/**
 * The catalog rule of a placed product, from its runtime id.
 *
 * Read as the rest of the configurator reads a runtime id (`resolveCabinetTypeOfRuntimeId`): the
 * id names the scene product that placed the cabinet ("Mako-sink-cabinet-3"), and the catalog
 * carries the scene product of each type from the runtime bindings. A catalog built without them
 * falls back to the cabinet type the id starts with ("Sink-Base-3").
 */
export const findPlacedCabinetRule = (
  catalog: ConfiguratorCatalog,
  runtimeId: string,
): TypeCabinetRuleConfig | null => {
  const rules = catalog.typeCabinetRules;
  const productTypes = Object.fromEntries(
    rules.flatMap(({ code, sceneProductType }) => (sceneProductType ? [[code, sceneProductType] as const] : [])),
  );
  const cabinetType = resolveCabinetTypeOfSceneId(
    rules.map(({ code }) => code),
    productTypes,
    runtimeId,
  );

  return rules.find(({ code }) => code === cabinetType) ?? null;
};
