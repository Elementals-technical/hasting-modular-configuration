import { installConfiguratorApiLogger } from "./apiLogger";
import { runInBatchQueue } from "./setConfigBatch";
import { updateDimensionDataForProduct } from "./updateDimensionData";

/**
 * Typed bridge to ConfiguratorAPI.setConfigBatch for the runtime adapter.
 *
 * The legacy wrappers return null both when the scene is not ready and when a call
 * fails, and setConfig drops the scene's own answer ("product not found" becomes
 * success). This bridge keeps those cases apart. It is the only place in the adapter
 * path that touches the iframe, and it reuses the legacy batch queue, so adapter
 * commands and the remaining direct calls run strictly in sequence.
 */

/** Which products a command reaches. An empty selector reaches every product. */
export type SceneSelector = {
  productIds?: string[];
  productType?: string;
};

export type SceneConfigPatch = Record<string, string | number>;

export type SceneCallFailureCode = "product-not-found" | "scene-rejected" | "scene-error";

export type SceneCallResult =
  /** `updatedIds` is null when the scene handled a composition-wide add-on (side panel, towel bar). */
  | { status: "applied"; updatedIds: string[] | null }
  | { status: "not-ready" }
  | { status: "failed"; code: SceneCallFailureCode; message: string };

type SceneBatchApi = (selector: SceneSelector, patch: SceneConfigPatch) => Promise<unknown>;

// The PlayCanvas iframe is untyped; the narrowing stays in this file.
type PlayCanvasHost = {
  containerRef?: { current?: { contentWindow?: unknown } | null };
  playCanvasReady?: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getSceneBatchApi = (): SceneBatchApi | null => {
  const host = window as unknown as PlayCanvasHost;
  const contentWindow = host.containerRef?.current?.contentWindow;
  if (!isRecord(contentWindow)) return null;

  const api = contentWindow.ConfiguratorAPI;
  if (!isRecord(api) || typeof api.setConfigBatch !== "function") return null;

  return api.setConfigBatch as SceneBatchApi;
};

/**
 * Ready once PlayCanvasIntegration has bridged the iframe (playCanvasReady) and the
 * batch API exists. The flag is reset when the iframe reloads.
 */
export const isSceneReady = (): boolean => {
  const host = window as unknown as PlayCanvasHost;
  return host.playCanvasReady === true && getSceneBatchApi() !== null;
};

const toStringArray = (value: unknown): string[] | null =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string") ? value : null;

/**
 * Turns the scene's answer into one status. Answers, from ConfiguratorAPI.setConfigBatch:
 * - `[]`: no composition manager or no active composition, i.e. not ready;
 * - `true`: a composition-wide add-on (side panel, towel bar) was set;
 * - `{ updatedIds }`: products updated, which must include every product addressed.
 */
export const normalizeSceneBatchResult = (result: unknown, selector: SceneSelector): SceneCallResult => {
  if (Array.isArray(result) && result.length === 0) {
    return { status: "not-ready" };
  }

  if (result === true) {
    return { status: "applied", updatedIds: null };
  }

  const updatedIds = isRecord(result) ? toStringArray(result.updatedIds) : null;

  if (!updatedIds) {
    return { status: "failed", code: "scene-rejected", message: "The scene did not confirm the update." };
  }

  const missing = (selector.productIds ?? []).filter((productId) => !updatedIds.includes(productId));

  if (missing.length > 0) {
    return {
      status: "failed",
      code: "product-not-found",
      message: `The scene did not update ${missing.join(", ")}.`,
    };
  }

  return { status: "applied", updatedIds };
};

/**
 * Sends one patch through the shared batch queue. One patch per call on purpose: the
 * scene returns early for SidePanel/TowelBar/TowelBarColor, so keys of two attributes
 * merged into one call would be silently dropped.
 */
export const applySceneConfig = (selector: SceneSelector, patch: SceneConfigPatch): Promise<SceneCallResult> =>
  runInBatchQueue(async (): Promise<SceneCallResult> => {
    // Same order as the legacy wrapper: the logger wraps the API before it is read.
    installConfiguratorApiLogger();

    // Read at run time: the iframe may have reloaded while the command waited in the queue.
    const api = getSceneBatchApi();
    if (!api || !isSceneReady()) return { status: "not-ready" };

    try {
      const result = normalizeSceneBatchResult(await api(selector, patch), selector);

      if (result.status === "applied") {
        result.updatedIds?.forEach((productId) => updateDimensionDataForProduct(productId, patch));
      }

      return result;
    } catch (error) {
      return {
        status: "failed",
        code: "scene-error",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  });
