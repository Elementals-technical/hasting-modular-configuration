type DividerUiDebugLevel = "log" | "warn" | "error";

export type DividerUiDebugEvent = {
  id: number;
  ts: number;
  iso: string;
  elapsedMs: number;
  level: DividerUiDebugLevel;
  stage: string;
  message: string;
  data?: unknown;
};

export type DividerUiDebugDump = {
  enabled: boolean;
  createdAt: string;
  dumpedAt: string;
  eventCount: number;
  events: DividerUiDebugEvent[];
  playCanvasSnapshot?: unknown;
};

export type DividerUiDebugApi = {
  enabled: boolean;
  maxEvents: number;
  createdAt: string;
  events: DividerUiDebugEvent[];
  log: (stage: string, message: string, data?: unknown) => DividerUiDebugEvent | null;
  warn: (stage: string, message: string, data?: unknown) => DividerUiDebugEvent | null;
  error: (stage: string, message: string, data?: unknown) => DividerUiDebugEvent | null;
  clear: () => void;
  dump: () => DividerUiDebugDump;
  setMaxEvents: (maxEvents: number) => number;
  setEnabled: (enabled: boolean, options?: { persist?: boolean }) => boolean;
};

export type DividerConfiguratorWindow = Window & {
  ConfiguratorAPI?: {
    dividers?: {
      getDebugSnapshot?: () => unknown;
      getDebugLogging?: () => boolean;
      getDebugEvents?: (options?: { limit?: number; level?: string; stageIncludes?: string }) => unknown;
      clearDebugEvents?: () => unknown;
      setDebugLogging?: (enabled: boolean, options?: { persist?: boolean }) => unknown;
      getAvailableDividerTypes?: (slot: unknown) => unknown;
      placeDividerToSlot?: (slotInfo: unknown, type: "A" | "B" | "C") => Promise<unknown> | unknown;
      removeDividerFromSlot?: (options: unknown) => Promise<unknown> | unknown;
      setOnAddSlotClick?: (callback: (slotInfo: unknown) => void) => unknown;
      setOnOccupiedSlotClick?: (callback: (slotInfo: unknown) => void) => unknown;
      showIconDividerSlots?: (
        cabinetId: string,
        drawerType: "Top" | "TopFull" | "Bot",
        options?: boolean | { show?: boolean; selectedDividerType?: "A" | "B" | "C" | null; debugRequestId?: string },
      ) => unknown;
    };
  };
};

type WindowWithDividerDebug = typeof globalThis & {
  __HASTING_DIVIDER_UI_DEBUG__?: DividerUiDebugApi;
  dumpDividerUiDebug?: () => DividerUiDebugDump | null;
  clearDividerUiDebug?: () => void;
  containerRef?: {
    current?: {
      contentWindow?: DividerConfiguratorWindow | null;
    } | null;
  };
};

const STORAGE_KEY = "hasting:dividerUiDebug";
const GLOBAL_KEY = "__HASTING_DIVIDER_UI_DEBUG__";
const DEFAULT_ENABLED = true;
const DEFAULT_MAX_EVENTS = 2000;

let eventSequence = 0;
let traceSequence = 0;

declare global {
  interface Window {
    __HASTING_DIVIDER_UI_DEBUG__?: DividerUiDebugApi;
    dumpDividerUiDebug?: () => DividerUiDebugDump | null;
    clearDividerUiDebug?: () => void;
  }
}

export function getDividerConfiguratorWindow() {
  return (globalThis as WindowWithDividerDebug).containerRef?.current?.contentWindow ?? null;
}

export function getDividerUiDebug() {
  const win = globalThis as WindowWithDividerDebug;
  if (win[GLOBAL_KEY]) return win[GLOBAL_KEY];

  const createdAt = new Date().toISOString();
  const startedAt = Date.now();
  const api: DividerUiDebugApi = {
    enabled: readEnabledFlag(),
    maxEvents: DEFAULT_MAX_EVENTS,
    createdAt,
    events: [],
    log: (stage, message, data) => pushEvent(api, startedAt, "log", stage, message, data),
    warn: (stage, message, data) => pushEvent(api, startedAt, "warn", stage, message, data),
    error: (stage, message, data) => pushEvent(api, startedAt, "error", stage, message, data),
    clear: () => {
      api.events.splice(0, api.events.length);
      tryClearPlayCanvasDebugEvents();
      api.log("Debug", "Divider UI debug buffer cleared");
    },
    dump: () => ({
      enabled: api.enabled,
      createdAt: api.createdAt,
      dumpedAt: new Date().toISOString(),
      eventCount: api.events.length,
      events: api.events.slice(),
      playCanvasSnapshot: getPlayCanvasDebugSnapshot(),
    }),
    setMaxEvents: (maxEvents) => {
      api.maxEvents = Math.max(100, Math.floor(maxEvents));
      if (api.events.length > api.maxEvents) {
        api.events.splice(0, api.events.length - api.maxEvents);
      }
      pushEvent(api, startedAt, "log", "Debug", "Divider UI debug max event count updated", {
        maxEvents: api.maxEvents,
      });
      return api.maxEvents;
    },
    setEnabled: (enabled, options = {}) => {
      api.enabled = Boolean(enabled);
      if (options.persist !== false) {
        writeEnabledFlag(api.enabled);
      }
      pushEvent(api, startedAt, "log", "Debug", `Divider UI debug ${api.enabled ? "enabled" : "disabled"}`, {
        enabled: api.enabled,
        persist: options.persist !== false,
      });
      trySetPlayCanvasDebug(api.enabled);
      return api.enabled;
    },
  };

  win[GLOBAL_KEY] = api;
  win.dumpDividerUiDebug = () => api.dump();
  win.clearDividerUiDebug = () => api.clear();

  api.log("Debug", "Divider UI debug buffer initialized", {
    global: `window.${GLOBAL_KEY}`,
    dump: "window.__HASTING_DIVIDER_UI_DEBUG__.dump()",
    shortcut: "window.dumpDividerUiDebug()",
  });
  trySetPlayCanvasDebug(api.enabled);

  return api;
}

export function recordDividerUiDebug(stage: string, message: string, data?: unknown) {
  return getDividerUiDebug().log(stage, message, data);
}

export function warnDividerUiDebug(stage: string, message: string, data?: unknown) {
  return getDividerUiDebug().warn(stage, message, data);
}

export function errorDividerUiDebug(stage: string, message: string, data?: unknown) {
  return getDividerUiDebug().error(stage, message, data);
}

export function captureDividerPlayCanvasSnapshot() {
  return getPlayCanvasDebugSnapshot({ includeEvents: false });
}

export function createDividerUiTraceId(prefix = "ui-divider") {
  traceSequence += 1;
  return `${prefix}-${Date.now().toString(36)}-${traceSequence}`;
}

export function summarizeDividerSlotInfo(slotInfo: unknown) {
  const info = slotInfo as Record<string, any> | null | undefined;
  if (!info || typeof info !== "object") return info;

  return {
    cabinetId: info.cabinetId,
    drawerType: info.drawerType,
    zone: info.zone,
    key: info.key,
    zoneIndex: info.zoneIndex,
    placementType: info.placementType,
    canPlace: info.canPlace,
    disabledReason: info.disabledReason,
    availableTypes: info.availableTypes,
    stateId: info.stateId,
    dividerType: info.dividerType,
    isOccupied: info.isOccupied,
    position: summarizePosition(info.position),
    slot: summarizeDividerSlot(info.slot),
  };
}

function pushEvent(
  api: DividerUiDebugApi,
  startedAt: number,
  level: DividerUiDebugLevel,
  stage: string,
  message: string,
  data?: unknown,
) {
  if (!api.enabled && level === "log") return null;

  eventSequence += 1;
  const ts = Date.now();
  const event: DividerUiDebugEvent = {
    id: eventSequence,
    ts,
    iso: new Date(ts).toISOString(),
    elapsedMs: ts - startedAt,
    level,
    stage,
    message,
    data: sanitizeForDebug(data),
  };

  api.events.push(event);
  if (api.events.length > api.maxEvents) {
    api.events.splice(0, api.events.length - api.maxEvents);
  }

  const consoleMethod = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  consoleMethod(`[DividerUI][${stage}] ${message}`, event.data ?? "");

  return event;
}

function getPlayCanvasDebugSnapshot(options: { includeEvents?: boolean } = {}) {
  const { includeEvents = true } = options;
  try {
    const dividersApi = getDividerConfiguratorWindow()?.ConfiguratorAPI?.dividers;
    return {
      playCanvasDebugLogging: dividersApi?.getDebugLogging?.(),
      ...(includeEvents ? { debugEvents: dividersApi?.getDebugEvents?.({ limit: 750 }) } : {}),
      snapshot: dividersApi?.getDebugSnapshot?.(),
    };
  } catch (error) {
    return {
      error: sanitizeForDebug(error),
    };
  }
}

function summarizeDividerSlot(slot: unknown) {
  const item = slot as Record<string, any> | null | undefined;
  if (!item || typeof item !== "object") return item;

  return {
    key: item.key,
    value: item.value,
    width: roundDebugNumber(item.width),
    position: summarizePosition(item.position),
    other: item.other
      ? {
          type: item.other.type,
          zone: item.other.zone,
          zoneIndex: item.other.zoneIndex,
          placementType: item.other.placementType,
          canPlace: item.other.canPlace,
          disabledReason: item.other.disabledReason,
          availableTypes: item.other.availableTypes,
          stateId: item.other.stateId,
          strategy: item.other.strategy,
        }
      : undefined,
  };
}

function summarizePosition(position: unknown) {
  const value = position as Record<string, any> | null | undefined;
  if (!value || typeof value !== "object") return value;

  return {
    start: roundDebugNumber(value.start),
    center: roundDebugNumber(value.center),
    end: roundDebugNumber(value.end),
  };
}

function roundDebugNumber(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return value;
  return Math.round(value * 10000) / 10000;
}

function tryClearPlayCanvasDebugEvents() {
  try {
    getDividerConfiguratorWindow()?.ConfiguratorAPI?.dividers?.clearDebugEvents?.();
  } catch (error) {
    warnDividerUiDebug("Debug", "Failed to clear PlayCanvas divider debug events", { error });
  }
}

function trySetPlayCanvasDebug(enabled: boolean) {
  try {
    getDividerConfiguratorWindow()?.ConfiguratorAPI?.dividers?.setDebugLogging?.(enabled, { persist: false });
  } catch (error) {
    warnDividerUiDebug("Debug", "Failed to sync PlayCanvas divider debug logging", { error });
  }
}

function readEnabledFlag() {
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (stored === "1" || stored === "true" || stored === "on") return true;
    if (stored === "0" || stored === "false" || stored === "off") return false;
  } catch {
    // Storage may be unavailable in embedded browser contexts.
  }
  return DEFAULT_ENABLED;
}

function writeEnabledFlag(enabled: boolean) {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    // Storage may be unavailable in embedded browser contexts.
  }
}

function sanitizeForDebug(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (value == null) return value;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "function") return `[Function ${value.name || "anonymous"}]`;
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }
  if (typeof value !== "object") return String(value);
  if (seen.has(value)) return "[Circular]";
  if (depth >= 5) return "[MaxDepth]";

  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((item) => sanitizeForDebug(item, depth + 1, seen));
    }

    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (key === "slot") {
        result[key] = sanitizeSlot(item, depth + 1, seen);
      } else {
        result[key] = sanitizeForDebug(item, depth + 1, seen);
      }
    }
    return result;
  } finally {
    seen.delete(value);
  }
}

function sanitizeSlot(value: unknown, depth: number, seen: WeakSet<object>) {
  if (!value || typeof value !== "object") return sanitizeForDebug(value, depth, seen);
  const slot = value as {
    key?: unknown;
    value?: unknown;
    width?: unknown;
    position?: unknown;
    other?: unknown;
  };

  return {
    key: sanitizeForDebug(slot.key, depth, seen),
    value: sanitizeForDebug(slot.value, depth, seen),
    width: sanitizeForDebug(slot.width, depth, seen),
    position: sanitizeForDebug(slot.position, depth, seen),
    other: sanitizeForDebug(slot.other, depth, seen),
  };
}
