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

/**
 * The catalog rule of a selected cabinet. Its runtime id names what the cabinet is now. A sink lift or landing
 * re-creates the cabinet under a new id but keeps the `ProductType` of what it was in its scene config (a Sink Base
 * turned Side Cabinet still says sink), so the config is read only for an id the catalog does not know, `productType` first.
 */
export const findSelectedCabinetRule = (
  catalog: ConfiguratorCatalog,
  runtimeId: string,
  config: Readonly<Record<string, unknown>>,
  placedDrawers?: string | null,
): TypeCabinetRuleConfig | null => {
  const configType = [config.productType, config.ProductType, config.type].find(
    (value): value is string => typeof value === "string" && value !== "",
  );

  return (
    findPlacedCabinetRule(catalog, runtimeId, placedDrawers) ??
    (configType ? findPlacedCabinetRule(catalog, configType, placedDrawers) : null)
  );
};
