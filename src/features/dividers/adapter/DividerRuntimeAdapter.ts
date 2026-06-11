/**
 * The ONLY place (besides the low-level transport wrappers in
 * src/utils/functions/playcanvas/dividers/*) that is allowed to know about
 * `ConfiguratorAPI.dividers.*` and the private `__activeDrawerCabinetId` /
 * `__activeDrawerType` fields. Everything above this layer speaks the pure
 * domain language from src/features/dividers/model.
 *
 * NOTE on wrapShowTopView/wrapExitTopView: those transport wrappers hold a
 * SINGLE global callback slot. The adapter therefore owns that slot and fans
 * events out to any number of subscribers (controller + page-level camera
 * logic). Callbacks are re-claimed on every new subscription because legacy
 * page effects (prebuilt until T5) may still overwrite them.
 */
import {
  getAvailableDividerTypes,
  getAvailableDividerTypesForDrawer,
  getPlacedDividersForDrawer,
  placeDividerToSlot,
  removeDividerFromSlot,
  setDividerSlotClickHandler,
  setOnAddSlotClick,
  setOnOccupiedSlotClick,
  setVisibleDividerSlotButtons,
  showIconDividerSlots,
  wrapExitTopView,
  wrapShowTopView,
  type DividerSlotInfo,
  type OccupiedSlotInfo,
  type RuntimePlacedDivider,
} from "@/utils/functions/playcanvas/dividers";
import {
  getDividerConfiguratorWindow,
  recordDividerUiDebug,
  warnDividerUiDebug,
} from "@/utils/functions/playcanvas/dividers/dividerUiDebug";
import {
  DIVIDER_RESIZE_RESTORE_EVENT,
  type DividerResizeRestoreEventDetail,
} from "@/utils/functions/playcanvas/dividers/prepareDividersForResize";

import { normalizeDividerTypes, normalizeSlotInfo, sortDividerTypes } from "../model/normalize";
import type {
  DividerAvailability,
  DividerCommand,
  DividerContext,
  DividerPlaceCommand,
  DividerRemoveCommand,
  DividerShowSlotsCommand,
  DividerSlot,
  DividerType,
  DrawerType,
} from "../model/types";
import { resolveActiveContext } from "./resolveActiveContext";

export type DividerSlotClickListener = (slot: DividerSlot) => void;

/**
 * Active-context lifecycle events, fanned out to all subscribers:
 * - "select"          — top view entered (fires BEFORE the drawer opens; camera hooks live here)
 * - "after-select"    — top view fully entered (drawer opened, zoom applied; overlay refresh here)
 * - "exit"            — top view exited
 * - "resize-restore"  — width/depth resize finished; targets describe drawers to restore
 */
export type DividerContextChangeEvent =
  | { phase: "select"; context: DividerContext }
  | { phase: "after-select"; context: DividerContext }
  | { phase: "exit" }
  | { phase: "resize-restore"; targets: readonly DividerContext[]; dimension: "width" | "depth" };

export type DividerContextChangeListener = (event: DividerContextChangeEvent) => void;

export type DividerRuntimeAdapter = {
  /** Whether `ConfiguratorAPI.dividers` is reachable. */
  isReady(): boolean;
  /** Fully-resolved active drawer context (official API first, private fields as fallback). */
  resolveActiveContext(): DividerContext | null;
  /** Executes a domain command. Resolves to false when the command was blocked or failed. */
  execute(command: DividerCommand): Promise<boolean>;
  fetchAvailability(context: DividerContext): Promise<DividerAvailability | null>;
  fetchPlaced(context: DividerContext): Promise<RuntimePlacedDivider[] | null>;
  /** Per-slot availability via the synchronous runtime API (legacy payloads without availableTypes). */
  fetchSlotTypes(slot: DividerSlot): readonly DividerType[];
  /** Mirrors ConfiguratorAPI.setVisibleDividerSlotButtons. */
  setSlotButtonsVisible(visible: boolean): void;
  /** Re-enters top view for the given drawer (used by the resize-restore flow). */
  restoreTopView(context: DividerContext): Promise<boolean>;
  /**
   * Registers ONE shared PlayCanvas bridge (add + occupied + legacy fallback) and fans
   * normalized slots out to listeners. Returns an unsubscribe function.
   */
  onSlotClick(listener: DividerSlotClickListener): () => void;
  /** Subscribes to active-context lifecycle events. Returns an unsubscribe function. */
  onActiveContextChange(listener: DividerContextChangeListener): () => void;
};

type TopViewRestoreApi = {
  showTopView?: (cabinetId: string, drawerType: DrawerType) => unknown;
  __activeDrawerCabinetId?: string;
  __activeDrawerType?: DrawerType;
};

const isDividersApiReady = (): boolean =>
  Boolean(getDividerConfiguratorWindow()?.ConfiguratorAPI?.dividers);

const buildPlacePayload = (command: DividerPlaceCommand): DividerSlotInfo => {
  const { slot } = command;

  // Explicit field-by-field payload — never blind-spread a raw slotInfo.
  const payload: DividerSlotInfo = {
    cabinetId: slot.context.cabinetId,
    drawerType: slot.context.drawerType,
    zone: slot.zone,
    key: slot.key,
    availableTypes: [...slot.availableTypes],
    placementType: slot.placementType,
    canPlace: slot.canPlace,
    disabledReason: slot.disabledReason,
    debugRequestId: command.traceId,
  };

  if (slot.zoneIndex !== null) payload.zoneIndex = slot.zoneIndex;
  if (slot.position) payload.position = { ...slot.position };

  return payload;
};

const executePlace = async (command: DividerPlaceCommand): Promise<boolean> => {
  const { slot, type, traceId } = command;

  if (slot.placementType && type !== slot.placementType) {
    warnDividerUiDebug("Adapter.execute", "Type/placement mismatch blocked", {
      traceId,
      type,
      placementType: slot.placementType,
      key: slot.key,
      zone: slot.zone,
      cabinetId: slot.context.cabinetId,
      drawerType: slot.context.drawerType,
    });
    return false;
  }

  const result = await placeDividerToSlot(buildPlacePayload(command), type);
  return result !== null;
};

const executeRemove = async (command: DividerRemoveCommand): Promise<boolean> => {
  const { slot, traceId } = command;

  if (!slot.stateId || !slot.occupiedType) {
    warnDividerUiDebug("Adapter.execute", "Remove blocked: slot has no stateId/occupiedType", {
      traceId,
      key: slot.key,
      zone: slot.zone,
      stateId: slot.stateId,
      occupiedType: slot.occupiedType,
    });
    return false;
  }

  const payload: OccupiedSlotInfo = {
    cabinetId: slot.context.cabinetId,
    drawerType: slot.context.drawerType,
    zone: slot.zone,
    key: slot.key,
    isOccupied: true,
    stateId: slot.stateId,
    dividerType: slot.occupiedType,
    zoneIndex: slot.zoneIndex ?? 0,
    debugRequestId: traceId,
  };

  if (slot.position) payload.position = { ...slot.position };

  const result = await removeDividerFromSlot(payload);
  return result !== null;
};

const executeShowSlots = (command: DividerShowSlotsCommand): boolean => {
  const result = showIconDividerSlots(command.context.cabinetId, command.context.drawerType, {
    show: true,
    selectedDividerType: command.selectedType,
    debugRequestId: command.traceId,
  });

  return result !== null;
};

export const createDividerRuntimeAdapter = (): DividerRuntimeAdapter => {
  const slotListeners = new Set<DividerSlotClickListener>();
  const contextListeners = new Set<DividerContextChangeListener>();
  let slotBridgeViaLegacy = false;
  let resizeListenerRegistered = false;

  const dispatchSlot = (rawSlotInfo: unknown) => {
    const slot = normalizeSlotInfo(rawSlotInfo);
    if (!slot) {
      warnDividerUiDebug("Adapter.onSlotClick", "Dropped malformed slotInfo payload", {
        rawSlotInfo,
      });
      return;
    }

    recordDividerUiDebug("Adapter.onSlotClick", "Dispatch normalized slot", {
      kind: slot.kind,
      key: slot.key,
      zone: slot.zone,
      cabinetId: slot.context.cabinetId,
      drawerType: slot.context.drawerType,
      placementType: slot.placementType,
      occupiedType: slot.occupiedType,
      listenerCount: slotListeners.size,
    });

    slotListeners.forEach((listener) => listener(slot));
  };

  const dispatchContextEvent = (event: DividerContextChangeEvent) => {
    contextListeners.forEach((listener) => listener(event));
  };

  /**
   * (Re-)claims the runtime slot callbacks. Idempotent and safe to call on every
   * subscription: the runtime stores a single callback, so re-claiming protects
   * against legacy page effects that overwrite it.
   */
  const registerSlotBridge = () => {
    const addHandle = setOnAddSlotClick(dispatchSlot);
    const occupiedHandle = setOnOccupiedSlotClick(dispatchSlot);

    if (!addHandle && !occupiedHandle) {
      warnDividerUiDebug("Adapter.onSlotClick", "Falling back to legacy divider slot click handler");
      const legacyHandle = setDividerSlotClickHandler(dispatchSlot);
      slotBridgeViaLegacy = Boolean(legacyHandle);
      return;
    }

    slotBridgeViaLegacy = false;
    recordDividerUiDebug("Adapter.onSlotClick", "Slot bridge registered", {
      viaExplicitCallbacks: true,
      legacyFallbackActive: slotBridgeViaLegacy,
    });
  };

  const handleResizeRestore = (event: Event) => {
    const detail = (event as CustomEvent<DividerResizeRestoreEventDetail>).detail;
    if (!detail) return;

    dispatchContextEvent({
      phase: "resize-restore",
      targets: detail.targets.map((target) => ({
        cabinetId: target.cabinetId,
        drawerType: target.drawerType,
      })),
      dimension: detail.dimension,
    });
  };

  /** (Re-)claims the single-slot top-view wrapper callbacks. Idempotent. */
  const registerContextBridge = () => {
    const wrappedShow = wrapShowTopView({
      onSelect: (cabinetId, drawerType) => {
        dispatchContextEvent({ phase: "select", context: { cabinetId, drawerType } });
      },
      onAfterSelect: (cabinetId, drawerType) => {
        dispatchContextEvent({ phase: "after-select", context: { cabinetId, drawerType } });
      },
    });
    const wrappedExit = wrapExitTopView({
      onExit: () => {
        dispatchContextEvent({ phase: "exit" });
      },
    });

    if (!resizeListenerRegistered) {
      window.addEventListener(DIVIDER_RESIZE_RESTORE_EVENT, handleResizeRestore);
      resizeListenerRegistered = true;
    }

    recordDividerUiDebug("Adapter.onActiveContextChange", "Context bridge (re)registered", {
      wrappedShow: Boolean(wrappedShow),
      wrappedExit: Boolean(wrappedExit),
      listenerCount: contextListeners.size,
    });
  };

  return {
    isReady: isDividersApiReady,

    resolveActiveContext,

    async execute(command) {
      switch (command.kind) {
        case "place":
          return executePlace(command);
        case "remove":
          return executeRemove(command);
        case "showSlots":
          return executeShowSlots(command);
        case "hideSlots":
          return setVisibleDividerSlotButtons(false) !== null;
      }
    },

    async fetchAvailability(context) {
      const types = await getAvailableDividerTypesForDrawer(context.cabinetId, context.drawerType);
      if (!types) return null;

      return {
        context,
        types: sortDividerTypes(types),
        fetchedAt: Date.now(),
      };
    },

    fetchPlaced(context) {
      return getPlacedDividersForDrawer(context.cabinetId, context.drawerType);
    },

    fetchSlotTypes(slot) {
      const raw = getAvailableDividerTypes({
        cabinetId: slot.context.cabinetId,
        drawerType: slot.context.drawerType,
        zone: slot.zone,
        key: slot.key,
      });

      return normalizeDividerTypes(raw);
    },

    setSlotButtonsVisible(visible) {
      setVisibleDividerSlotButtons(visible);
    },

    async restoreTopView(context) {
      const api = getDividerConfiguratorWindow()?.ConfiguratorAPI as TopViewRestoreApi | undefined;

      if (!api?.showTopView) {
        warnDividerUiDebug("Adapter.restoreTopView", "showTopView is not available", {
          cabinetId: context.cabinetId,
          drawerType: context.drawerType,
        });
        return false;
      }

      api.__activeDrawerCabinetId = context.cabinetId;
      api.__activeDrawerType = context.drawerType;

      recordDividerUiDebug("Adapter.restoreTopView", "Reopen drawer top view", {
        cabinetId: context.cabinetId,
        drawerType: context.drawerType,
      });

      await Promise.resolve(api.showTopView(context.cabinetId, context.drawerType));
      return true;
    },

    onSlotClick(listener) {
      slotListeners.add(listener);
      registerSlotBridge();

      return () => {
        slotListeners.delete(listener);
      };
    },

    onActiveContextChange(listener) {
      contextListeners.add(listener);
      registerContextBridge();

      return () => {
        contextListeners.delete(listener);
      };
    },
  };
};

let sharedAdapter: DividerRuntimeAdapter | null = null;

/**
 * Module-level singleton. The single-slot transport wrappers (wrapShowTopView etc.)
 * tolerate only one owner, so the controller AND page-level subscribers must share
 * one adapter instance.
 */
export const getSharedDividerRuntimeAdapter = (): DividerRuntimeAdapter => {
  sharedAdapter ??= createDividerRuntimeAdapter();
  return sharedAdapter;
};

export { getActiveDrawerRuntimeContext, resolveActiveContext } from "./resolveActiveContext";
export type { ActiveDrawerRuntimeContext } from "./resolveActiveContext";
