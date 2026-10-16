import type { SteppedSceneProduct } from "@/entities/collection";

import { updateDimensionDataForProduct } from "./updateDimensionData";

/**
 * Scene products that keep a height of their own beside the taller products of the composition
 * (Urban Freestanding: the Short-Cabinet).
 *
 * The composition has one height and every path that changes it sends that height to every
 * product at once: a handle with its forced height, the sidebar's size, the height check after a
 * drawer style switch. A stepped product must not take it. Rather than teach each of those paths
 * about it, the scene bridge — the one place every scene command passes — keeps the stepped
 * product at its own height: it places it with it, and after a command that carries a height or a
 * handle it sends the stepped product its height again, by the handle it now has.
 *
 * CollectionStateBridge hands the active collection's here, built from its cabinet catalog
 * (buildSteppedSceneProducts: the table's heights of the stepped style). Without any, nothing here
 * changes a command.
 */

type SceneConfig = Readonly<Record<string, unknown>>;

let steppedProducts: readonly SteppedSceneProduct[] = [];

/** Declared by the active collection; an empty list turns the correction off. */
export const setSteppedSceneProducts = (products: readonly SteppedSceneProduct[] | null | undefined) => {
  steppedProducts = products ?? [];
};

export const hasSteppedSceneProducts = () => steppedProducts.length > 0;

/** The scene names a product's type in its config; a preset product carries it as `name`. */
const productTypeOf = (config: SceneConfig): string | null => {
  const type = config.productType ?? config.ProductType ?? config.name;
  return typeof type === "string" && type ? type : null;
};

/**
 * The stepped product a scene config is, or null. `productType` names the type when the config does
 * not. A page passes the products of the bindings it reads from the store; the bridge uses its own.
 */
export const findSteppedSceneProduct = (
  config: SceneConfig | null | undefined,
  productType?: string | null,
  products: readonly SteppedSceneProduct[] = steppedProducts,
): SteppedSceneProduct | null => {
  if (!config || products.length === 0) return null;

  const type = productType ?? productTypeOf(config);
  return (
    products.find(
      (product) =>
        product.productType === type && Object.entries(product.match).every(([key, value]) => config[key] === value),
    ) ?? null
  );
};

/** Whether a scene config is that of a product with a height of its own. */
export const isSteppedSceneConfig = (
  config: SceneConfig | null | undefined,
  products?: readonly SteppedSceneProduct[] | null,
): boolean => findSteppedSceneProduct(config, null, products ?? steppedProducts) !== null;

/** The height a stepped product takes with its handle; null when it is not stepped or the handle is unknown. */
export const steppedSceneHeightOf = (
  config: SceneConfig | null | undefined,
  productType?: string | null,
): number | null => {
  const product = findSteppedSceneProduct(config, productType);
  if (!product) return null;

  const handle = config?.Handle;
  return typeof handle === "string" ? (product.heightByHandle[handle] ?? null) : null;
};

/** A product's config to place it with: a stepped product takes its own height, whatever it was given. */
export const withSteppedSceneHeight = <T extends Record<string, unknown>>(
  config: T,
  productType?: string | null,
): T => {
  const height = steppedSceneHeightOf(config, productType);
  return height === null || config.Height === height ? config : { ...config, Height: height };
};

/** A command changes what a stepped product's height follows when it carries a height or a handle. */
export const touchesSteppedHeight = (patch: SceneConfig | null | undefined): boolean =>
  steppedProducts.length > 0 && patch !== null && patch !== undefined && ("Height" in patch || "Handle" in patch);

/**
 * The stepped products a command left at another height than their own, with the height each
 * must get back. `configs` are the products' configs as the scene holds them after the command.
 */
export const resolveSteppedHeightCorrections = (
  configs: Readonly<Record<string, SceneConfig>>,
): { productId: string; height: number }[] =>
  Object.entries(configs).flatMap(([productId, config]) => {
    const height = steppedSceneHeightOf(config);
    return height !== null && config.Height !== height ? [{ productId, height }] : [];
  });

type SceneApi = Record<string, unknown>;

/** A product's config as values: getConfig answers a plain object or a snapshot behind `getAll()`. */
const configValuesOf = (config: unknown): Record<string, unknown> | null => {
  if (typeof config !== "object" || config === null || Array.isArray(config)) return null;
  const getAll = (config as { getAll?: unknown }).getAll;
  if (typeof getAll !== "function") return config as Record<string, unknown>;

  const values: unknown = getAll.call(config);
  return typeof values === "object" && values !== null ? { ...(values as Record<string, unknown>) } : null;
};

/**
 * Sends each stepped product a command reached its own height again. Called by the scene bridge
 * inside the queued command, right after the command, with the ConfiguratorAPI it used; it calls
 * the API directly, as a call through the queue would wait for the command that is running it.
 */
export const restoreSteppedSceneHeights = async (api: SceneApi | null | undefined, productIds: readonly string[]) => {
  if (!api || steppedProducts.length === 0 || productIds.length === 0) return;

  const getConfig = api.getConfig;
  const setConfig = api.setConfig;
  if (typeof getConfig !== "function" || typeof setConfig !== "function") return;

  const configs: Record<string, Record<string, unknown>> = {};
  for (const productId of productIds) {
    try {
      const config = configValuesOf(await getConfig.call(api, productId));
      if (config) configs[productId] = config;
    } catch {
      // A product the scene cannot answer for is left as it is.
    }
  }

  for (const { productId, height } of resolveSteppedHeightCorrections(configs)) {
    try {
      await setConfig.call(api, productId, { Height: height });
      updateDimensionDataForProduct(productId, { Height: height });
    } catch (error) {
      console.warn("[steppedSceneProducts] The stepped product did not take its height", productId, error);
    }
  }
};
