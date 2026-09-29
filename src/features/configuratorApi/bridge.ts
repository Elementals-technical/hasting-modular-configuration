import { runInBatchQueue } from "@/utils/functions/playcanvas/setConfigBatch";

import { ConfiguratorError } from "./types";
import type { ConfiguratorApi, ConfiguratorNamespace, ConfiguratorUnsubscribe, PlacementOverlayFrame } from "./types";

type PlayCanvasHost = {
  containerRef?: { current?: { contentWindow?: unknown } | null };
};

type ApiMethod = (...args: never[]) => unknown;

export type ConfiguratorBridge = {
  callNamespace<T>(namespace: ConfiguratorNamespace, method: string, ...args: unknown[]): Promise<T>;
  callLegacy<T>(method: "presetProducts" | "addProduct", ...args: unknown[]): Promise<T>;
  subscribe(
    namespace: ConfiguratorNamespace,
    event: string,
    callback: (event: unknown) => void,
    options?: unknown,
  ): Promise<ConfiguratorUnsubscribe>;
  /** Draft overlay frames; resolves null when this PlayCanvas build has no `placementOverlay`. */
  subscribePlacementOverlay?(
    callback: (frame: PlacementOverlayFrame | null) => void,
  ): Promise<ConfiguratorUnsubscribe | null>;
  /** Resolves false when the build has no `placementOverlay`. */
  setPlacementOverlayPlaceholders?(enabled: boolean): Promise<boolean>;
};

export type ConfiguratorBridgeOptions = {
  /** Primarily for contract tests. The default resolves the current iframe on every call. */
  getApi?: () => ConfiguratorApi | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const readWindowTarget = (): { api: ConfiguratorApi; parse: (json: string) => unknown } | null => {
  const host = window as unknown as PlayCanvasHost;
  const contentWindow = host.containerRef?.current?.contentWindow;
  if (!isRecord(contentWindow) || !isRecord(contentWindow.ConfiguratorAPI)) return null;
  const json = contentWindow.JSON as JSON | undefined;
  return {
    api: contentWindow.ConfiguratorAPI as unknown as ConfiguratorApi,
    parse: json ? json.parse.bind(json) : JSON.parse,
  };
};

/** Validate before JSON encoding so NaN, undefined, class instances and cycles cannot silently
 * change meaning. Parse in the receiving window: its runtime checks local Object.prototype. */
const encodeData = (value: unknown, ancestors = new Set<object>()): unknown => {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "object" || value === null || ancestors.has(value)) {
    throw new ConfiguratorError("INVALID_INPUT", "Expected finite JSON data for the configurator.");
  }
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== null && Object.getPrototypeOf(prototype) !== null) {
    throw new ConfiguratorError("INVALID_INPUT", "Expected a plain JSON object for the configurator.");
  }
  ancestors.add(value);
  try {
    if (Array.isArray(value)) return Array.from(value, (item) => encodeData(item, ancestors));
    const copy: Record<string, unknown> = Object.create(null);
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string" || ["__proto__", "prototype", "constructor"].includes(key)) {
        throw new ConfiguratorError("INVALID_INPUT", "Unsupported configurator data key.");
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
      if (!descriptor.enumerable) continue;
      if (!("value" in descriptor)) throw new ConfiguratorError("INVALID_INPUT", "Configurator data must not contain accessors.");
      copy[key] = encodeData(descriptor.value, ancestors);
    }
    return copy;
  } finally {
    ancestors.delete(value);
  }
};

const toBridgeError = (error: unknown, operation: string): ConfiguratorError => {
  if (error instanceof ConfiguratorError) return error;

  const detail = isRecord(error) ? error : undefined;
  const code = typeof detail?.code === "string" ? detail.code : "API_UNAVAILABLE";
  const message = typeof detail?.message === "string" ? detail.message : typeof error === "string" ? error : code;

  return new ConfiguratorError(code, message, {
    operation,
    detail,
    retryable: detail?.retryable === true,
    requestId: typeof detail?.requestId === "string" ? detail.requestId : undefined,
    cause: error,
  });
};

const unavailable = (operation: string, code: "API_UNAVAILABLE" | "API_METHOD_UNAVAILABLE", message: string) =>
  new ConfiguratorError(code, message, { operation, retryable: true });

/**
 * Sole iframe boundary for the configurator feature. Calls join the existing PlayCanvas batch
 * queue and resolve ConfiguratorAPI only when their turn starts, so an iframe reload
 * cannot leave a queued command bound to the previous window.
 */
export const createConfiguratorBridge = (
  options: ConfiguratorBridgeOptions = {},
): ConfiguratorBridge => {
  const getTarget = options.getApi
    ? () => { const api = options.getApi!(); return api ? { api, parse: JSON.parse } : null; }
    : readWindowTarget;

  const call = <T>(operation: string, resolveMethod: (api: ConfiguratorApi) => ApiMethod | null, args: unknown[]) =>
    runInBatchQueue(async (): Promise<T> => {
      const target = getTarget();
      if (!target) {
        throw unavailable(operation, "API_UNAVAILABLE", "The PlayCanvas ConfiguratorAPI is not available.");
      }

      const method = resolveMethod(target.api);
      if (!method) {
        throw unavailable(operation, "API_METHOD_UNAVAILABLE", `${operation} is not available in this runtime.`);
      }

      try {
        // Functions are subscription callbacks, undefined preserves optional positional args.
        const runtimeArgs = args.map((value) => value === undefined || typeof value === "function"
          ? value : target.parse(JSON.stringify(encodeData(value))));
        return (await method(...(runtimeArgs as never[]))) as T;
      } catch (error) {
        throw toBridgeError(error, operation);
      }
    });

  return {
    callNamespace<T>(namespace: ConfiguratorNamespace, method: string, ...args: unknown[]): Promise<T> {
      const operation = `${namespace}.${method}`;
      return call<T>(
        operation,
        (api) => {
          const namespaceApi = api[namespace] as unknown;
          if (!isRecord(namespaceApi)) return null;
          const candidate = namespaceApi[method];
          return typeof candidate === "function" ? (candidate.bind(namespaceApi) as ApiMethod) : null;
        },
        args,
      );
    },

    callLegacy<T>(method: "presetProducts" | "addProduct", ...args: unknown[]): Promise<T> {
      return call<T>(
        method,
        (api) => {
          const candidate = api[method];
          return typeof candidate === "function" ? (candidate.bind(api) as ApiMethod) : null;
        },
        args,
      );
    },

    // The overlay is presentation only: it is not scope-bound and never joins the batch queue.
    // It is read from the current iframe at call time, like every other call.
    async subscribePlacementOverlay(callback) {
      const overlay = getTarget()?.api.placementOverlay;
      if (!isRecord(overlay) || typeof overlay.on !== "function") return null;
      try {
        const unsubscribe = overlay.on("change", callback, { emitCurrent: true });
        return typeof unsubscribe === "function" ? unsubscribe : null;
      } catch (error) {
        throw toBridgeError(error, "placementOverlay.on");
      }
    },

    async setPlacementOverlayPlaceholders(enabled) {
      const overlay = getTarget()?.api.placementOverlay;
      if (!isRecord(overlay) || typeof overlay.setPlaceholdersEnabled !== "function") return false;
      try {
        overlay.setPlaceholdersEnabled(enabled);
        return true;
      } catch (error) {
        throw toBridgeError(error, "placementOverlay.setPlaceholdersEnabled");
      }
    },

    subscribe(
      namespace: ConfiguratorNamespace,
      event: string,
      callback: (event: unknown) => void,
      subscribeOptions?: unknown,
    ): Promise<ConfiguratorUnsubscribe> {
      return this.callNamespace<ConfiguratorUnsubscribe>(namespace, "on", event, callback, subscribeOptions).then(
        (unsubscribe) => {
          if (typeof unsubscribe !== "function") {
            throw new ConfiguratorError("API_INVALID_RESPONSE", `${namespace}.on did not return an unsubscribe function.`, {
              operation: `${namespace}.on`,
            });
          }
          return unsubscribe;
        },
      );
    },
  };
};
