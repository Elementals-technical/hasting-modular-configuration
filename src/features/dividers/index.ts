export * from "./model";

export {
  createDividerRuntimeAdapter,
  getActiveDrawerRuntimeContext,
  getSharedDividerRuntimeAdapter,
  resolveActiveContext,
} from "./adapter";
export type {
  ActiveDrawerRuntimeContext,
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
