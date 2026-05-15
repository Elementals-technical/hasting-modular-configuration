type ApiLogEntry = {
  t: number;
  method: string;
  args: unknown;
  result?: unknown;
  error?: string;
  durationMs?: number;
};

declare global {
  interface Window {
    __configuratorApiLogs?: ApiLogEntry[];
    __configuratorApiLoggerInstalled?: boolean;
    __clearConfiguratorApiLogs?: () => void;
  }
}

export const clearConfiguratorApiLogs = () => {
  window.__configuratorApiLogs = [];
};

const MAX_LOG_ENTRIES = 1000;

// Noisy read-only / high-frequency methods that flood the log without adding
// signal about what the app is sending to PlayCanvas.
const SKIPPED_METHOD_PATTERNS: RegExp[] = [
  /(^|\.)get[A-Z]/,                       // getConfig, getDimensionTool, camera.getZoom, ...
  /^config\.compositionManager\./,        // compositionManager.* (polling reads)
  /^camera\.setFramingConfig$/,           // spammed each frame
];

const shouldSkipLogging = (method: string): boolean =>
  SKIPPED_METHOD_PATTERNS.some((pattern) => pattern.test(method));

const safeSerialize = (value: unknown): unknown => {
  try {
    return JSON.parse(
      JSON.stringify(value, (_key, val) => {
        if (typeof val === "function") return "[fn]";
        if (val instanceof HTMLElement) return `[HTMLElement:${val.tagName}]`;
        return val;
      }),
    );
  } catch {
    return "[unserializable]";
  }
};

const pushLog = (entry: ApiLogEntry) => {
  const bucket = (window.__configuratorApiLogs ??= []);
  bucket.push(entry);
  if (bucket.length > MAX_LOG_ENTRIES) bucket.splice(0, bucket.length - MAX_LOG_ENTRIES);
};

const wrapFunction = (fn: Function, target: unknown, method: string) => {
  const skip = shouldSkipLogging(method);
  return function (this: unknown, ...args: unknown[]) {
    if (skip) return (fn as (...a: unknown[]) => unknown).apply(target, args);

    const started = Date.now();
    const entry: ApiLogEntry = { t: started, method, args: safeSerialize(args) };
    pushLog(entry);

    let result: unknown;
    try {
      result = (fn as (...a: unknown[]) => unknown).apply(target, args);
    } catch (err) {
      entry.error = err instanceof Error ? err.message : String(err);
      entry.durationMs = Date.now() - started;
      throw err;
    }

    if (result && typeof (result as Promise<unknown>).then === "function") {
      return (result as Promise<unknown>).then(
        (value) => {
          entry.result = safeSerialize(value);
          entry.durationMs = Date.now() - started;
          return value;
        },
        (err) => {
          entry.error = err instanceof Error ? err.message : String(err);
          entry.durationMs = Date.now() - started;
          throw err;
        },
      );
    }

    entry.result = safeSerialize(result);
    entry.durationMs = Date.now() - started;
    return result;
  };
};

const wrapObject = (obj: Record<string, unknown>, prefix: string): Record<string, unknown> => {
  return new Proxy(obj, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof prop !== "string") return value;

      const qualified = prefix ? `${prefix}.${prop}` : prop;

      if (typeof value === "function") {
        return wrapFunction(value, target, qualified);
      }
      if (value && typeof value === "object" && !Array.isArray(value)) {
        return wrapObject(value as Record<string, unknown>, qualified);
      }
      return value;
    },
  });
};

export const installConfiguratorApiLogger = (): boolean => {
  if (typeof window === "undefined") return false;
  if (window.__configuratorApiLoggerInstalled) return true;

  const containerRef = (window as unknown as { containerRef?: { current?: HTMLIFrameElement } }).containerRef;
  const canvasIframe = containerRef?.current?.contentWindow as unknown as {
    ConfiguratorAPI?: Record<string, unknown>;
  } | null;
  const api = canvasIframe?.ConfiguratorAPI;
  if (!api) return false;

  canvasIframe!.ConfiguratorAPI = wrapObject(api, "") as Record<string, unknown>;
  window.__configuratorApiLoggerInstalled = true;
  window.__configuratorApiLogs ??= [];
  window.__clearConfiguratorApiLogs = clearConfiguratorApiLogs;
  return true;
};
