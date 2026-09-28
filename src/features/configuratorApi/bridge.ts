import { runInBatchQueue } from "@/utils/functions/playcanvas/setConfigBatch";

import { ConfiguratorError } from "./types";
import type { ConfiguratorApi, ConfiguratorNamespace, ConfiguratorUnsubscribe } from "./types";

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
};

export type ConfiguratorBridgeOptions = {
  /** Primarily for contract tests. The default resolves the current iframe on every call. */
  getApi?: () => ConfiguratorApi | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const readWindowApi = (): ConfiguratorApi | null => {
  const host = window as unknown as PlayCanvasHost;
  const contentWindow = host.containerRef?.current?.contentWindow;
  if (!isRecord(contentWindow) || !isRecord(contentWindow.ConfiguratorAPI)) return null;
  return contentWindow.ConfiguratorAPI as unknown as ConfiguratorApi;
};

const toBridgeError = (error: unknown, operation: string): ConfiguratorError => {
  if (error instanceof ConfiguratorError) return error;

  const detail = isRecord(error) ? error : undefined;
  const code = typeof detail?.code === "string" ? detail.code : "API_UNAVAILABLE";
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : code;

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
  const getApi = options.getApi ?? readWindowApi;

  const call = <T>(operation: string, resolveMethod: (api: ConfiguratorApi) => ApiMethod | null, args: unknown[]) =>
    runInBatchQueue(async (): Promise<T> => {
      const api = getApi();
      if (!api) {
        throw unavailable(operation, "API_UNAVAILABLE", "The PlayCanvas ConfiguratorAPI is not available.");
      }

      const method = resolveMethod(api);
      if (!method) {
        throw unavailable(operation, "API_METHOD_UNAVAILABLE", `${operation} is not available in this runtime.`);
      }

      try {
        return (await method(...(args as never[]))) as T;
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
