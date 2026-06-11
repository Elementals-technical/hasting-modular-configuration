import {
  getDividerConfiguratorWindow,
  recordDividerUiDebug,
} from "@/utils/functions/playcanvas/dividers/dividerUiDebug";

import type { DividerContext, DrawerType } from "../model/types";

type TopViewRuntimeApi = {
  /** Official API (planned in §T7) — preferred when the runtime provides it. */
  getActiveTopViewContext?: () => unknown;
  isTopViewActive?: () => unknown;
  /** Private fields written by wrapShowTopView / cleared by wrapExitTopView. */
  __activeDrawerCabinetId?: string;
  __activeDrawerType?: DrawerType;
};

export type ActiveDrawerRuntimeContext = {
  cabinetId: string | null;
  drawerType: DrawerType | null;
  source: "official" | "private" | "none";
};

const DRAWER_TYPES: readonly DrawerType[] = ["Top", "TopFull", "Bot"];

const isDrawerType = (value: unknown): value is DrawerType => DRAWER_TYPES.some((type) => type === value);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getTopViewRuntimeApi = (): TopViewRuntimeApi | null =>
  (getDividerConfiguratorWindow()?.ConfiguratorAPI as TopViewRuntimeApi | undefined) ?? null;

const readOfficialContext = (api: TopViewRuntimeApi): DividerContext | null => {
  if (typeof api.getActiveTopViewContext !== "function") return null;

  try {
    const raw = api.getActiveTopViewContext();
    if (!isRecord(raw)) return null;

    const cabinetId = typeof raw.cabinetId === "string" && raw.cabinetId ? raw.cabinetId : null;
    const drawerType = isDrawerType(raw.drawerType) ? raw.drawerType : null;
    if (!cabinetId || !drawerType) return null;

    return { cabinetId, drawerType };
  } catch {
    return null;
  }
};

// Only log when the resolved value actually changes — this runs in render paths
// and must not flood the divider debug buffer.
let lastLoggedSignature: string | null = null;

const logResolvedContext = (resolved: ActiveDrawerRuntimeContext) => {
  const signature = `${resolved.source}|${resolved.cabinetId ?? ""}|${resolved.drawerType ?? ""}`;
  if (signature === lastLoggedSignature) return;

  lastLoggedSignature = signature;
  recordDividerUiDebug("Adapter.resolveActiveContext", "Resolved active drawer context", resolved);
};

/**
 * Raw runtime fields (each may be null independently). Pages combine these with
 * their own state fallbacks; the controller (T4) uses `resolveActiveContext` instead.
 */
export const getActiveDrawerRuntimeContext = (): ActiveDrawerRuntimeContext => {
  const api = getTopViewRuntimeApi();

  if (!api) {
    const resolved: ActiveDrawerRuntimeContext = { cabinetId: null, drawerType: null, source: "none" };
    logResolvedContext(resolved);
    return resolved;
  }

  const official = readOfficialContext(api);
  if (official) {
    const resolved: ActiveDrawerRuntimeContext = { ...official, source: "official" };
    logResolvedContext(resolved);
    return resolved;
  }

  const cabinetId = api.__activeDrawerCabinetId || null;
  const drawerType = isDrawerType(api.__activeDrawerType) ? api.__activeDrawerType : null;
  const resolved: ActiveDrawerRuntimeContext = {
    cabinetId,
    drawerType,
    source: cabinetId || drawerType ? "private" : "none",
  };
  logResolvedContext(resolved);
  return resolved;
};

/** Fully-resolved active drawer context, or null when no drawer is active. */
export const resolveActiveContext = (): DividerContext | null => {
  const { cabinetId, drawerType } = getActiveDrawerRuntimeContext();
  if (!cabinetId || !drawerType) return null;

  return { cabinetId, drawerType };
};
