import { isStateOnlyResolution, resolveProductConfig, resolveRuntimeBinding } from "@/entities/collection";
import type { RuntimeBindingSet, ScenePatch } from "@/entities/collection";
import type {
  ConfigurationCompositionPort,
  ConfigurationSceneReader,
  SceneCompositionProduct,
  SceneCompositionReplaceRequest,
  SceneCompositionResult,
  SceneRestoreIssue,
} from "@/entities/configuration";
import {
  addSceneProduct,
  clearSceneProducts,
  insertSceneProduct,
  isSceneReady,
  presetSceneProducts,
  removeSceneProduct,
  setSceneProductConfig,
  swapSceneProducts,
} from "@/utils/functions/playcanvas/sceneBridge";
import type {
  SceneAddProductResult,
  SceneOperationResult,
  ScenePresetProduct,
  ScenePresetResult,
} from "@/utils/functions/playcanvas/sceneBridge";

import { createSceneReader } from "./createSceneReader";
import { resolveSceneProductType } from "./createSceneRestorer";

/**
 * Places, removes and reorders products for C's composition commands (C06, I).
 *
 * 1. Everything the runtime can know without the scene is checked first: a scene type for every
 *    product type and a translation for every shared value. Any issue, or a scene that is not
 *    ready, leaves the scene untouched. Each product's own config is translated as it is placed
 *    (resolveProductConfig).
 * 2. One scene operation per step, through the typed bridge and its queue, so the steps and the
 *    remaining direct calls run strictly in sequence.
 * 3. Once the scene changed, a failure is "partial", never "failed": C must know it changed.
 * 4. The scene is read afterwards, so C records the order the scene actually holds.
 */

/** The scene side of the port. Tests pass a fake; the app uses sceneBridge. */
export type SceneCompositionBridge = {
  isReady(): boolean;
  clear(): Promise<SceneOperationResult>;
  presetProducts(products: readonly ScenePresetProduct[], globalConfig?: ScenePatch): Promise<ScenePresetResult>;
  addProduct(productType: string, config: Record<string, unknown>): Promise<SceneAddProductResult>;
  insertProduct(
    productType: string,
    anchorRuntimeId: string | null,
    side: "left" | "right",
  ): Promise<SceneAddProductResult>;
  setProductConfig(runtimeId: string, config: Record<string, unknown>): Promise<SceneOperationResult>;
  removeProduct(runtimeId: string): Promise<SceneOperationResult>;
  swapProducts(runtimeIdA: string, runtimeIdB: string): Promise<SceneOperationResult>;
};

export type CompositionPortDeps = {
  /** Bindings of the active collection: their product types and value translations. */
  getBindings: () => RuntimeBindingSet | null;
  scene?: SceneCompositionBridge;
  reader?: ConfigurationSceneReader;
};

const defaultScene: SceneCompositionBridge = {
  isReady: isSceneReady,
  clear: clearSceneProducts,
  presetProducts: presetSceneProducts,
  addProduct: addSceneProduct,
  insertProduct: insertSceneProduct,
  setProductConfig: setSceneProductConfig,
  removeProduct: removeSceneProduct,
  swapProducts: swapSceneProducts,
};

const failureMessage = (result: { status: string; message?: string }, fallback: string): string =>
  result.status === "failed" && result.message ? result.message : fallback;

const unknownTypeIssue = (productType: string): SceneRestoreIssue => ({
  code: "unknown-product-type",
  message: `The collection has no scene type for "${productType}".`,
});

export const createCompositionPort = ({
  getBindings,
  scene = defaultScene,
  reader = createSceneReader(),
}: CompositionPortDeps): ConfigurationCompositionPort => {
  /**
   * The product as the scene places it: its scene type, and its config translated for that scene
   * and naming that type. A Mako handle, for one, reaches the Mako cabinet as HandleStyle.
   */
  const toSceneProduct = (bindings: RuntimeBindingSet, { productType, config }: SceneCompositionProduct) => {
    const sceneType = resolveSceneProductType(bindings, productType);
    if (!sceneType) return null;

    return {
      sceneType,
      config: { ...resolveProductConfig(bindings, config), ProductType: sceneType, productType: sceneType },
    };
  };

  /** What the scene holds after a change: its order, and the sizes of the given products. */
  const readAfter = (placed: string[]) => reader.read(placed);

  const replace = async ({
    products,
    shared = {},
    flow,
  }: SceneCompositionReplaceRequest): Promise<SceneCompositionResult> => {
    if (!scene.isReady()) return { status: "not-ready" };

    const bindings = getBindings();
    if (!bindings) {
      return {
        status: "rejected",
        issues: [{ code: "bindings-unavailable", message: "Runtime bindings of the collection are not loaded." }],
      };
    }

    const issues: SceneRestoreIssue[] = [];
    if (products.length === 0) issues.push({ code: "empty-composition", message: "The composition has no products." });

    const presetProducts: ScenePresetProduct[] = products.flatMap((product) => {
      const placed = toSceneProduct(bindings, product);
      if (!placed) {
        issues.push(unknownTypeIssue(product.productType));
        return [];
      }
      return [{ ...placed.config, name: placed.sceneType }];
    });

    const globalConfig: ScenePatch = {};
    for (const [attributeId, value] of Object.entries(shared)) {
      const resolution = resolveRuntimeBinding(bindings, attributeId, value, flow);

      if (!resolution.ok) {
        issues.push({ code: "unknown-value", message: `No scene translation for ${attributeId} "${String(value)}".` });
        continue;
      }

      if (!isStateOnlyResolution(resolution)) Object.assign(globalConfig, resolution.patch);
    }

    if (issues.length > 0) return { status: "rejected", issues };

    const result = await scene.presetProducts(
      presetProducts,
      Object.keys(globalConfig).length > 0 ? globalConfig : undefined,
    );
    if (result.status === "not-ready") return { status: "not-ready" };

    // The scene clears the composition before placing, so a failure has already changed it.
    if (result.status === "failed") {
      return { status: "partial", placed: [], message: result.message, scene: await readAfter([]) };
    }

    // The preset API does not promise the created ids; the scene's own order is the fallback,
    // used only when it holds exactly one id per product.
    let placed = result.runtimeIds;
    if (placed.length !== products.length) {
      const state = await readAfter([]);
      placed = state.status === "ready" && state.order.length === products.length ? [...state.order] : [];
    }

    if (placed.length !== products.length) {
      return {
        status: "partial",
        placed,
        message: `The scene placed ${placed.length} of ${products.length} products.`,
        scene: await readAfter(placed),
      };
    }

    return { status: "applied", placed, scene: await readAfter(placed) };
  };

  const add: ConfigurationCompositionPort["add"] = async (product, placement) => {
    if (!scene.isReady()) return { status: "not-ready" };

    const bindings = getBindings();
    const placed = bindings ? toSceneProduct(bindings, product) : null;
    if (!placed) {
      return {
        status: "rejected",
        issues: [
          bindings
            ? unknownTypeIssue(product.productType)
            : { code: "bindings-unavailable", message: "Runtime bindings of the collection are not loaded." },
        ],
      };
    }

    if (placement.kind === "end") {
      const created = await scene.addProduct(placed.sceneType, placed.config);
      if (created.status === "not-ready") return { status: "not-ready" };
      if (created.status === "failed") return { status: "failed", message: created.message };

      return { status: "applied", placed: [created.runtimeId], scene: await readAfter([created.runtimeId]) };
    }

    const created = await scene.insertProduct(placed.sceneType, placement.anchorRuntimeId, placement.side);
    if (created.status === "not-ready") return { status: "not-ready" };
    if (created.status === "failed") return { status: "failed", message: created.message };

    // The scene places a product beside another with its defaults; its own config follows.
    const configured = await scene.setProductConfig(created.runtimeId, placed.config);
    const sceneState = await readAfter([created.runtimeId]);

    return configured.status === "applied"
      ? { status: "applied", placed: [created.runtimeId], scene: sceneState }
      : {
          status: "partial",
          placed: [created.runtimeId],
          message: failureMessage(configured, "The scene stopped being ready."),
          scene: sceneState,
        };
  };

  const remove: ConfigurationCompositionPort["remove"] = async (runtimeIds) => {
    if (!scene.isReady()) return { status: "not-ready" };

    let removed = 0;

    for (const runtimeId of runtimeIds) {
      const result = await scene.removeProduct(runtimeId);

      if (result.status !== "applied") {
        if (removed === 0) {
          return result.status === "not-ready"
            ? { status: "not-ready" }
            : { status: "failed", message: result.message };
        }

        return {
          status: "partial",
          placed: [],
          message: failureMessage(result, "The scene stopped being ready."),
          scene: await readAfter([]),
        };
      }

      removed += 1;
    }

    return { status: "applied", placed: [], scene: await readAfter([]) };
  };

  const swap: ConfigurationCompositionPort["swap"] = async (runtimeIdA, runtimeIdB) => {
    if (!scene.isReady()) return { status: "not-ready" };

    const result = await scene.swapProducts(runtimeIdA, runtimeIdB);
    if (result.status === "not-ready") return { status: "not-ready" };
    if (result.status === "failed") return { status: "failed", message: result.message };

    return { status: "applied", placed: [], scene: await readAfter([]) };
  };

  const clear: ConfigurationCompositionPort["clear"] = async () => {
    if (!scene.isReady()) return { status: "not-ready" };

    const result = await scene.clear();
    if (result.status === "not-ready") return { status: "not-ready" };
    if (result.status === "failed") return { status: "failed", message: result.message };

    return { status: "applied", placed: [], scene: await readAfter([]) };
  };

  return { isReady: () => scene.isReady(), replace, add, remove, swap, clear };
};
