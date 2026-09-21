import type { RuntimeBindingSet } from "@/entities/collection";
import type {
  ConfigurationSceneReader,
  ConfigurationSceneRestorer,
  SceneRestoreFailure,
  SceneRestoreIssue,
  SceneRestoreMatch,
  SceneRestoreRequest,
  SceneRestoreResult,
} from "@/entities/configuration";
import { normalizeRuntimeProductType, withRuntimeProductType } from "@/entities/product/lib/resolveRuntimeProductType";
import { clearSceneProducts, isSceneReady, presetSceneProducts } from "@/utils/functions/playcanvas/sceneBridge";
import type {
  SceneOperationResult,
  ScenePresetProduct,
  ScenePresetResult,
} from "@/utils/functions/playcanvas/sceneBridge";

import { createSceneReader } from "./createSceneReader";

/**
 * Rebuilds a composition for restore (I05).
 *
 * 1. Preflight checks everything the runtime can know without the scene: a non-empty
 *    composition, unique source ids, a config per product and a scene type per product
 *    type. Any issue, or a scene that is not ready, leaves the scene untouched.
 * 2. The scene is cleared once, then rebuilt through native presetProducts. This is the
 *    same path used for ordinary model presets and returns the runtime-id mapping.
 * 3. A failed product does not stop the rest. Once the scene was cleared the result is
 *    "partial", never a failure without changes: the scene has changed and C must know it.
 * 4. The actual order is read back and compared with the order of the request.
 */

/** The scene side of the restorer. Tests pass a fake; the app uses sceneBridge. */
export type SceneRestoreBridge = {
  isReady(): boolean;
  clear(): Promise<SceneOperationResult>;
  presetProducts(products: readonly ScenePresetProduct[]): Promise<ScenePresetResult>;
};

export type SceneRestorerDeps = {
  /** Bindings of the active collection; their `productTypes` say what the scene can place. */
  getBindings: () => RuntimeBindingSet | null;
  scene?: SceneRestoreBridge;
  reader?: ConfigurationSceneReader;
};

const defaultScene: SceneRestoreBridge = {
  isReady: isSceneReady,
  clear: clearSceneProducts,
  presetProducts: presetSceneProducts,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * The type the scene places for a saved product type: a CabinetType key of the table, or a
 * scene type the table already names. Saved ids such as "Sink-Base-k24yf6my1" are normalized.
 */
export const resolveSceneProductType = (bindings: RuntimeBindingSet, productType: string): string | null => {
  const candidates = [productType, normalizeRuntimeProductType(productType)];

  for (const candidate of candidates) {
    if (Object.hasOwn(bindings.productTypes, candidate)) return bindings.productTypes[candidate];
  }

  const sceneTypes = new Set(Object.values(bindings.productTypes));
  return candidates.find((candidate) => sceneTypes.has(candidate)) ?? null;
};

const failedMessage = (result: SceneOperationResult | ScenePresetResult, fallback: string): string =>
  result.status === "failed" ? result.message : fallback;

export const createSceneRestorer = ({
  getBindings,
  scene = defaultScene,
  reader = createSceneReader(),
}: SceneRestorerDeps): ConfigurationSceneRestorer => {
  const preflight = (request: SceneRestoreRequest): SceneRestoreIssue[] => {
    const issues: SceneRestoreIssue[] = [];

    if (request.products.length === 0) {
      issues.push({ code: "empty-composition", message: "The composition has no products." });
      return issues;
    }

    const bindings = getBindings();
    if (!bindings) {
      issues.push({ code: "bindings-unavailable", message: "Runtime bindings of the collection are not loaded." });
    }

    const seen = new Set<string>();

    for (const { sourceId, productType, config } of request.products) {
      if (!sourceId.trim() || seen.has(sourceId)) {
        issues.push({ code: "duplicate-source", sourceId, message: `Product id "${sourceId}" is empty or repeated.` });
      }
      seen.add(sourceId);

      if (!isRecord(config)) {
        issues.push({ code: "invalid-config", sourceId, message: `Product ${sourceId} has no config.` });
      }

      if (bindings && !resolveSceneProductType(bindings, productType)) {
        issues.push({
          code: "unknown-product-type",
          sourceId,
          message: `The collection has no scene type for "${productType}".`,
        });
      }
    }

    return issues;
  };

  /** The ids the scene holds after the rebuild, in composition order. */
  const readPlacedIds = async (request: SceneRestoreRequest): Promise<string[]> => {
    const state = await reader.read([]);
    return state.status === "ready" && state.order.length === request.products.length ? [...state.order] : [];
  };

  const restore = async (request: SceneRestoreRequest): Promise<SceneRestoreResult> => {
    if (!scene.isReady()) return { status: "not-ready" };

    const issues = preflight(request);
    const bindings = getBindings();
    if (issues.length > 0 || !bindings) return { status: "rejected", issues };

    const cleared = await scene.clear();
    if (cleared.status === "not-ready") return { status: "not-ready" };

    if (cleared.status === "failed") {
      return {
        status: "partial",
        matches: [],
        failed: request.products.map(({ sourceId }) => ({ sourceId, code: "scene-error", message: cleared.message })),
        scene: await reader.read([]),
      };
    }

    const presetProducts = request.products.flatMap(({ productType, config }) => {
      const sceneType = resolveSceneProductType(bindings, productType);
      return sceneType && isRecord(config) ? [{ ...withRuntimeProductType(config, sceneType), name: sceneType }] : [];
    });
    const rebuilt = await scene.presetProducts(presetProducts);

    if (rebuilt.status !== "applied") {
      return {
        status: "partial",
        matches: [],
        failed: request.products.map(({ sourceId }) => ({
          sourceId,
          code: rebuilt.status === "not-ready" ? "scene-error" : "not-created",
          message: failedMessage(rebuilt, "The scene stopped being ready."),
        })),
        scene: await reader.read([]),
      };
    }

    // The preset API does not promise the created ids, so the scene's own order is the
    // fallback. It is used only when it holds exactly one id per saved product: a shorter
    // order means a product was skipped, and a shifted id would rename another cabinet.
    const placed =
      rebuilt.runtimeIds.length === request.products.length ? rebuilt.runtimeIds : await readPlacedIds(request);

    if (placed.length !== request.products.length) {
      return {
        status: "partial",
        matches: [],
        failed: request.products.map(({ sourceId }) => ({
          sourceId,
          code: "not-created",
          message: `The scene rebuilt ${placed.length} of ${request.products.length} saved products.`,
        })),
        scene: await reader.read(placed),
      };
    }

    const matches: SceneRestoreMatch[] = request.products.map(({ sourceId }, index) => ({
      sourceId,
      runtimeId: placed[index],
    }));
    const failed: SceneRestoreFailure[] = [];

    const runtimeIds = matches.map(({ runtimeId }) => runtimeId);
    const sceneState = await reader.read(runtimeIds);

    if (sceneState.status === "ready") {
      const actualOrder = sceneState.order.filter((runtimeId) => runtimeIds.includes(runtimeId));

      matches.forEach(({ sourceId, runtimeId }, index) => {
        if (actualOrder[index] === runtimeId) return;
        failed.push({ sourceId, code: "order-mismatch", message: `Product ${sourceId} is not at position ${index}.` });
      });
    }

    return failed.length > 0
      ? { status: "partial", matches, failed, scene: sceneState }
      : { status: "restored", matches, scene: sceneState };
  };

  return { preflight, restore };
};
