import type { ProductProfile } from "../../model/productProfile";
import type { RuntimeBindingSet } from "../../model/runtimeBindings";
import { selectOptionValues } from "../productProfileSelectors";

/**
 * The profile's cabinet type of a placed product, read from its runtime id.
 *
 * The scene names a product after its scene type (`Mako-sink-cabinet-k3j4h5g6f`); the bindings
 * say which cabinet type each scene type places. When several share one scene type (Urban places
 * Side-Cabinet as Sink-Cabinet), the one named like it wins. Without bindings, or for an id that
 * starts with no scene type (test and legacy ids), the longest cabinet type the id starts with.
 */

const longestFirst = (left: string, right: string) => right.length - left.length;

/**
 * The same reading over the cabinet types and the scene type of each (`productTypes`), for a
 * caller that holds them without the profile and the bindings: the cabinet catalog.
 */
export const resolveCabinetTypeOfSceneId = (
  cabinetTypes: readonly string[],
  productTypes: Readonly<Record<string, string>> | null,
  runtimeId: string,
): string | null => {
  if (productTypes) {
    const sceneType = [...new Set(Object.values(productTypes))]
      .filter((type) => runtimeId === type || runtimeId.startsWith(`${type}-`))
      .sort(longestFirst)[0];

    if (sceneType) {
      const placedAs = cabinetTypes.filter((type) => productTypes[type] === sceneType);
      return placedAs.find((type) => type === sceneType) ?? placedAs[0] ?? null;
    }
  }

  return cabinetTypes.filter((type) => runtimeId.startsWith(type)).sort(longestFirst)[0] ?? null;
};

export const resolveCabinetTypeOfRuntimeId = (
  profile: ProductProfile | null,
  bindings: RuntimeBindingSet | null,
  runtimeId: string,
): string | null =>
  resolveCabinetTypeOfSceneId(selectOptionValues(profile, "CabinetType"), bindings?.productTypes ?? null, runtimeId);
