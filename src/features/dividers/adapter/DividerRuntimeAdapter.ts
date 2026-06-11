/**
 * The ONLY place (besides the low-level transport wrappers in
 * src/utils/functions/playcanvas/dividers/*) that is allowed to know about
 * `ConfiguratorAPI.dividers.*` and the private `__activeDrawerCabinetId` /
 * `__activeDrawerType` fields. Everything above this layer speaks the pure
 * domain language from src/features/dividers/model.
 */
import {
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

import { normalizeSlotInfo, sortDividerTypes } from "../model/normalize";
import type {
  DividerAvailability,
  DividerCommand,
  DividerContext,
  DividerPlaceCommand,
  DividerRemoveCommand,
  DividerShowSlotsCommand,
  DividerSlot,
} from "../model/types";
import { resolveActiveContext } from "./resolveActiveContext";

export type DividerSlotClickListener = (slot: DividerSlot) => void;

export type DividerActiveContextListener = (context: DividerContext | null) => void;

export type DividerRuntimeAdapter = {
  /** Whether `ConfiguratorAPI.dividers` is reachable. */
  isReady(): boolean;
  /** Fully-resolved active drawer context (official API first, private fields as fallback). */
  resolveActiveContext(): DividerContext | null;
  /** Executes a domain command. Resolves to false when the command was blocked or failed. */
  execute(command: DividerCommand): Promise<boolean>;
  fetchAvailability(context: DividerContext): Promise<DividerAvailability | null>;
  fetchPlaced(context: DividerContext): Promise<RuntimePlacedDivider[] | null>;
  /**
   * Registers ONE shared PlayCanvas bridge (add + occupied + legacy fallback) and fans
   * normalized slots out to listeners. Returns an unsubscribe function.
   */
  onSlotClick(listener: DividerSlotClickListener): () => void;
  /** Fires when the active drawer context changes (top view enter/exit, resize restore). */
  onActiveContextChange(listener: DividerActiveContextListener): () => void;
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
  const contextListeners = new Set<DividerActiveContextListener>();
  let slotBridgeRegistered = false;
  let contextBridgeRegistered = false;

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

  const dispatchContext = (context: DividerContext | null) => {
    contextListeners.forEach((listener) => listener(context));
  };

  const registerSlotBridge = () => {
    if (slotBridgeRegistered) return;

    const addHandle = setOnAddSlotClick(dispatchSlot);
    const occupiedHandle = setOnOccupiedSlotClick(dispatchSlot);

    if (!addHandle && !occupiedHandle) {
      warnDividerUiDebug("Adapter.onSlotClick", "Falling back to legacy divider slot click handler");
      const legacyHandle = setDividerSlotClickHandler(dispatchSlot);
      if (!legacyHandle) return; // PlayCanvas not ready — retry on next subscribe
    }

    slotBridgeRegistered = true;
    recordDividerUiDebug("Adapter.onSlotClick", "Slot bridge registered", {
      viaExplicitCallbacks: Boolean(addHandle || occupiedHandle),
    });
  };

  const handleResizeRestore = (event: Event) => {
    const detail = (event as CustomEvent<DividerResizeRestoreEventDetail>).detail;
    if (!detail) return;

    detail.targets.forEach((target) => {
      dispatchContext({ cabinetId: target.cabinetId, drawerType: target.drawerType });
    });
  };

  const registerContextBridge = () => {
    if (contextBridgeRegistered) return;

    const wrappedShow = wrapShowTopView({
      onSelect: (cabinetId, drawerType) => {
        dispatchContext({ cabinetId, drawerType });
      },
    });
    const wrappedExit = wrapExitTopView({
      onExit: () => {
        dispatchContext(null);
      },
    });

    window.addEventListener(DIVIDER_RESIZE_RESTORE_EVENT, handleResizeRestore);

    contextBridgeRegistered = true;
    recordDividerUiDebug("Adapter.onActiveContextChange", "Context bridge registered", {
      wrappedShow: Boolean(wrappedShow),
      wrappedExit: Boolean(wrappedExit),
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
        if (contextListeners.size === 0 && contextBridgeRegistered) {
          window.removeEventListener(DIVIDER_RESIZE_RESTORE_EVENT, handleResizeRestore);
          contextBridgeRegistered = false;
        }
      };
    },
  };
};

export { getActiveDrawerRuntimeContext, resolveActiveContext } from "./resolveActiveContext";
export type { ActiveDrawerRuntimeContext } from "./resolveActiveContext";
