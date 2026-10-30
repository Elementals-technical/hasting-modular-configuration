import type { ProductProfile } from "../../model/productProfile";
import type { RuntimeBindingSet } from "../../model/runtimeBindings";
import { normalizeOptionValue, selectOptionValues } from "../productProfileSelectors";

/**
 * The profile's cabinet type of a placed product, read from its runtime id.
 *
 * The scene names a product after its scene type (`Mako-sink-cabinet-k3j4h5g6f`); the bindings
 * say which cabinet type each scene type places. When several share one scene type, a type whose
 * stepped style the cabinet has wins (Urban Freestanding places its Short-Cabinet, one drawer, as
 * the Side Cabinet's UF-side-cabinet), then the one named like it (Urban places Side-Cabinet as
 * Sink-Cabinet), then the first. Without bindings, or for an id that starts with no scene type
 * (test and legacy ids), the longest cabinet type the id starts with.
 */

const longestFirst = (left: string, right: string) => right.length - left.length;

/**
 * The same reading over the cabinet types and the scene type of each (`productTypes`), for a
 * caller that holds them without the profile and the bindings: the cabinet catalog.
 * `steppedTypes` are the types whose stepped style the placed cabinet has.
 */
export const resolveCabinetTypeOfSceneId = (
  cabinetTypes: readonly string[],
  productTypes: Readonly<Record<string, string>> | null,
  runtimeId: string,
  steppedTypes: readonly string[] = [],
): string | null => {
  if (productTypes) {
    const sceneType = [...new Set(Object.values(productTypes))]
      .filter((type) => runtimeId === type || runtimeId.startsWith(`${type}-`))
      .sort(longestFirst)[0];

    if (sceneType) {
      const placedAs = cabinetTypes.filter((type) => productTypes[type] === sceneType);
      return (
        placedAs.find((type) => steppedTypes.includes(type)) ??
        placedAs.find((type) => type === sceneType) ??
        placedAs[0] ??
        null
      );
    }
  }

  return cabinetTypes.filter((type) => runtimeId.startsWith(type)).sort(longestFirst)[0] ?? null;
};

/** `placedDrawers` is the cabinet's drawer style (`placedCabinetStyles`), which tells a short cabinet apart. */
export const resolveCabinetTypeOfRuntimeId = (
  profile: ProductProfile | null,
  bindings: RuntimeBindingSet | null,
  runtimeId: string,
  placedDrawers?: string | null,
): string | null =>
  resolveCabinetTypeOfSceneId(
    selectOptionValues(profile, "CabinetType"),
    bindings?.productTypes ?? null,
    runtimeId,
    (profile?.ruleData.steppedModules ?? [])
      .filter(({ drawers }) => placedDrawers && normalizeOptionValue(profile, "Drawers", drawers) === placedDrawers)
      .map(({ cabinetType }) => cabinetType),
  );

/** Whether a placed product is a Sink Base of the collection, read from its runtime id. */
export const isSinkBaseRuntimeId = (
  profile: ProductProfile | null,
  bindings: RuntimeBindingSet | null,
  runtimeId: string,
): boolean => resolveCabinetTypeOfRuntimeId(profile, bindings, runtimeId) === "Sink-Base";
