export * from "./model";

export {
  applyDividerZones,
  clearDividerZones,
  createDividerRuntimeAdapter,
  getActiveDrawerRuntimeContext,
  getSharedDividerRuntimeAdapter,
  resolveActiveContext,
} from "./adapter";
export type {
  ActiveDrawerRuntimeContext,
  DividerDrawer,
  DividerZones,
  DividerContextChangeEvent,
  DividerContextChangeListener,
  DividerRuntimeAdapter,
  DividerSlotClickListener,
} from "./adapter";

export { useDividerController } from "./controller/useDividerController";
export type {
  DividerControllerApi,
  DividerControllerState,
  DividerControllerStatus,
  UseDividerControllerOptions,
} from "./controller/useDividerController";
export { settle } from "./controller/settle";
export type { SettleDeps } from "./controller/settle";
