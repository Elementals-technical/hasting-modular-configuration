import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "react-redux";

import type { RootState } from "@/app/store";
import { replacePlacedDividersForDrawer } from "@/entities/product/model/store/slice";
import { getSelectedDividerType } from "@/entities/product/model/store/selectors";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import {
  createDividerUiTraceId,
  recordDividerUiDebug,
  warnDividerUiDebug,
} from "@/utils/functions/playcanvas/dividers";
import { setVisibleDrawerButtons } from "@/utils/functions/playcanvas/setVisibleDrawerButtons.ts";

import {
  getSharedDividerRuntimeAdapter,
  type DividerContextChangeEvent,
  type DividerRuntimeAdapter,
} from "../adapter";
import { deriveDividerOptions, type DerivedDividerOption, type DividerOptionBase } from "../model/deriveOptions";
import { dividerTypesEqual } from "../model/normalize";
import type { DividerAvailability, DividerContext, DividerSlot, DividerType } from "../model/types";
import { buildUnavailableDividerWarning, validatePlacement } from "../model/validate";
import { settle } from "./settle";

export type DividerControllerStatus = "idle" | "ready" | "busy";

export type DividerControllerState = {
  status: DividerControllerStatus;
  activeContext: DividerContext | null;
  availability: DividerAvailability | null;
  warning: string | null;
};

export type UseDividerControllerOptions<T extends DividerOptionBase> = {
  isPlayCanvasReady: boolean;
  /** Current Dividers accordion selection; the controller is active only for "Customize". */
  dividerSelection: string;
  /** UI mock options (dividersMockData) used to derive grid options with availability. */
  optionsSource: readonly T[];
  /** History snapshot saver — called before every place/remove. Read freshly (may be unstable). */
  saveSnapshot: () => Promise<void> | void;
  /** Page-level cabinet id used to match resize-restore targets (e.g. selectedSceneProduct). */
  fallbackCabinetId?: string | null;
  /** Whether the drawer CTA should be restored after a resize (Dividers accordion open). */
  shouldRestoreDrawerButtons?: boolean;
  /** Test seam — defaults to the shared runtime adapter singleton. */
  adapter?: DividerRuntimeAdapter;
};

export type DividerControllerApi<T extends DividerOptionBase> = {
  state: DividerControllerState;
  /** Grid-ready options derived from optionsSource + context-matched availability. */
  options: DerivedDividerOption<T>[];
  /** Context-matched availability types, or null when unknown/mismatched. */
  availableTypes: readonly DividerType[] | null;
  warning: string | null;
  clearWarning: () => void;
  showWarning: (message: string) => void;
  /** Re-shows the overlay and re-fetches availability for the active context. */
  refresh: () => void;
};

const RESIZE_RESTORE_REFRESH_DELAY_MS = 250;

const sameContext = (a: DividerContext | null, b: DividerContext | null): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.cabinetId === b.cabinetId && a.drawerType === b.drawerType;
};

const summarizeSlot = (slot: DividerSlot) => ({
  kind: slot.kind,
  cabinetId: slot.context.cabinetId,
  drawerType: slot.context.drawerType,
  zone: slot.zone,
  key: slot.key,
  zoneIndex: slot.zoneIndex,
  placementType: slot.placementType,
  occupiedType: slot.occupiedType,
  stateId: slot.stateId,
  availableTypes: slot.availableTypes,
  canPlace: slot.canPlace,
  disabledReason: slot.disabledReason,
});

/**
 * Shared divider controller (migration plan §T4).
 *
 * Critical invariants:
 * 1. PlayCanvas callbacks are registered in ONE effect whose deps are
 *    [isPlayCanvasReady, adapter] (+ the stable handlers). selectedType /
 *    availability are FORBIDDEN in those deps — the dispatcher reads fresh
 *    state via store.getState() and a per-render ref instead.
 * 2. selectedType is never copied into controller state; redux is the SSOT.
 * 3. Anti-double-click via a synchronous busy ref (state updates are async).
 * 4. settle() is the single post-command path — see ./settle.ts.
 */
export function useDividerController<T extends DividerOptionBase>(
  options: UseDividerControllerOptions<T>,
): DividerControllerApi<T> {
  const {
    isPlayCanvasReady,
    dividerSelection,
    optionsSource,
    saveSnapshot,
    fallbackCabinetId = null,
    shouldRestoreDrawerButtons = false,
  } = options;

  const adapter = useMemo(
    () => options.adapter ?? getSharedDividerRuntimeAdapter(),
    [options.adapter],
  );

  const dispatch = useAppDispatch();
  const selectedType = useAppSelector(getSelectedDividerType);
  // Store handle from the Provider (not a module import) — the dispatcher reads the
  // freshest selectedType at click time, and tests can supply a minimal store.
  const reduxStore = useStore();

  const [state, setState] = useState<DividerControllerState>({
    status: "idle",
    activeContext: null,
    availability: null,
    warning: null,
  });

  // Synchronous busy flag — React state updates are async, so the anti-double-click
  // guard cannot rely on `state.status` within the same tick.
  const busyRef = useRef(false);

  // Single per-render ref so the stable dispatcher always sees fresh controller
  // inputs without widening the registration effect's dependency list.
  const latestRef = useRef({
    state,
    dividerSelection,
    isPlayCanvasReady,
    saveSnapshot,
    fallbackCabinetId,
    shouldRestoreDrawerButtons,
  });
  latestRef.current = {
    state,
    dividerSelection,
    isPlayCanvasReady,
    saveSnapshot,
    fallbackCabinetId,
    shouldRestoreDrawerButtons,
  };

  // ── Diagnostic timeline: log every COMMITTED state transition and input change.
  // These effects fire only when the value actually changed (React dep equality),
  // so the debug buffer shows the exact state evolution interleaved with commands.
  useEffect(() => {
    recordDividerUiDebug("Controller.State", "status →", { status: state.status });
  }, [state.status]);

  useEffect(() => {
    recordDividerUiDebug("Controller.State", "activeContext →", { activeContext: state.activeContext });
  }, [state.activeContext]);

  useEffect(() => {
    recordDividerUiDebug("Controller.State", "availability →", {
      availability: state.availability
        ? {
            cabinetId: state.availability.context.cabinetId,
            drawerType: state.availability.context.drawerType,
            types: state.availability.types,
            fetchedAt: state.availability.fetchedAt,
          }
        : null,
    });
  }, [state.availability]);

  useEffect(() => {
    recordDividerUiDebug("Controller.State", "warning →", { warning: state.warning });
  }, [state.warning]);

  useEffect(() => {
    recordDividerUiDebug("Controller.Inputs", "Controller inputs changed", {
      isPlayCanvasReady,
      dividerSelection,
      fallbackCabinetId,
      shouldRestoreDrawerButtons,
    });
  }, [isPlayCanvasReady, dividerSelection, fallbackCabinetId, shouldRestoreDrawerButtons]);

  const readSelectedType = useCallback(
    (): DividerType | null => getSelectedDividerType(reduxStore.getState() as RootState),
    [reduxStore],
  );

  const showWarning = useCallback((message: string) => {
    setState((prev) => (prev.warning === message ? prev : { ...prev, warning: message }));
  }, []);

  const clearWarning = useCallback(() => {
    setState((prev) => (prev.warning === null ? prev : { ...prev, warning: null }));
  }, []);

  const setStatus = useCallback((status: DividerControllerStatus) => {
    setState((prev) => (prev.status === status ? prev : { ...prev, status }));
  }, []);

  const setActiveContext = useCallback((context: DividerContext | null) => {
    setState((prev) => (sameContext(prev.activeContext, context) ? prev : { ...prev, activeContext: context }));
  }, []);

  /** Value-equal availability update — fresh-but-equal arrays must not cause renders/effects. */
  const applyAvailability = useCallback((availability: DividerAvailability | null) => {
    setState((prev) => {
      const previous = prev.availability;
      if (previous === availability) return prev;
      if (!previous && !availability) return prev;
      if (
        previous &&
        availability &&
        sameContext(previous.context, availability.context) &&
        dividerTypesEqual(previous.types, availability.types)
      ) {
        return prev;
      }

      return { ...prev, availability };
    });
  }, []);

  const refreshAvailability = useCallback(
    async (context: DividerContext) => {
      const availability = await adapter.fetchAvailability(context);
      applyAvailability(availability);
    },
    [adapter, applyAvailability],
  );

  const runSettle = useCallback(
    (context: DividerContext, traceId: string) =>
      settle(context, {
        adapter,
        traceId,
        getSelectedType: readSelectedType,
        syncPlaced: (ctx, dividers) =>
          dispatch(
            replacePlacedDividersForDrawer({
              cabinetId: ctx.cabinetId,
              drawerType: ctx.drawerType,
              dividers,
            }),
          ),
        applyAvailability,
      }),
    [adapter, applyAvailability, dispatch, readSelectedType],
  );

  /**
   * Mirrors the legacy refreshDividerOverlay guard: when the selected type is known to be
   * unavailable for the context, warn and skip showSlots entirely.
   */
  const showSlotsGuarded = useCallback(
    (context: DividerContext, traceId: string) => {
      const currentType = readSelectedType();
      const availability = latestRef.current.state.availability;
      const matchedTypes =
        availability && sameContext(availability.context, context) ? availability.types : null;

      if (currentType && matchedTypes && !matchedTypes.includes(currentType)) {
        showWarning(buildUnavailableDividerWarning(currentType, matchedTypes));
        warnDividerUiDebug("Controller.Overlay", "Skip showSlots: selected type unavailable", {
          traceId,
          cabinetId: context.cabinetId,
          drawerType: context.drawerType,
          selectedType: currentType,
          availableTypes: matchedTypes,
        });
        return;
      }

      recordDividerUiDebug("Controller.Overlay", "Refresh divider overlay with selected type", {
        traceId,
        cabinetId: context.cabinetId,
        drawerType: context.drawerType,
        selectedDividerType: currentType,
      });
      void adapter.execute({ kind: "showSlots", context, selectedType: currentType, traceId });
    },
    [adapter, readSelectedType, showWarning],
  );

  /** STABLE slot-click dispatcher — fresh state via store.getState() + latestRef. */
  const handleSlotClick = useCallback(
    async (slot: DividerSlot) => {
      const latest = latestRef.current;
      const traceId = createDividerUiTraceId("controller-slot");

      recordDividerUiDebug("Controller.SlotClick", "Slot click received", {
        traceId,
        slot: summarizeSlot(slot),
        selectedDividerType: readSelectedType(),
        dividerSelection: latest.dividerSelection,
        busy: busyRef.current,
      });

      if (latest.dividerSelection !== "Customize") {
        warnDividerUiDebug("Controller.SlotClick", "Ignored: Customize is not selected", {
          traceId,
          dividerSelection: latest.dividerSelection,
        });
        return;
      }

      const context = slot.context;

      if (slot.kind === "occupied") {
        if (busyRef.current) {
          recordDividerUiDebug("Controller.OccupiedSlot", "Ignored: another command is in flight", {
            traceId,
          });
          return;
        }

        recordDividerUiDebug("Controller.OccupiedSlot", "Remove occupied divider requested", {
          traceId,
          slot: summarizeSlot(slot),
          overlayRefreshDividerType: readSelectedType() ?? slot.occupiedType,
        });

        busyRef.current = true;
        setStatus("busy");
        try {
          await latest.saveSnapshot();
          await adapter.execute({ kind: "remove", slot, traceId });
          await runSettle(context, traceId);
          recordDividerUiDebug("Controller.OccupiedSlot", "Remove occupied divider completed", {
            traceId,
            slot: summarizeSlot(slot),
          });
        } finally {
          busyRef.current = false;
          setStatus("ready");
        }
        return;
      }

      // Candidate slot — legacy payloads may arrive without availableTypes; enrich
      // them via the synchronous runtime API (parity with the old page-level flow).
      const enrichedSlot =
        slot.availableTypes.length > 0 ? slot : { ...slot, availableTypes: adapter.fetchSlotTypes(slot) };

      const decision = validatePlacement(readSelectedType(), enrichedSlot, traceId);

      recordDividerUiDebug("Controller.AddSlot", "Resolved add slot decision", {
        traceId,
        slot: summarizeSlot(enrichedSlot),
        selectedDividerType: readSelectedType(),
        decision: decision.ok ? { ok: true, type: decision.command.type } : decision,
      });

      if (!decision.ok) {
        showWarning(decision.message);
        warnDividerUiDebug("Controller.AddSlot", "Placement rejected", {
          traceId,
          reason: decision.reason,
          userMessage: decision.message,
          slot: summarizeSlot(enrichedSlot),
        });
        return;
      }

      if (busyRef.current) {
        recordDividerUiDebug("Controller.AddSlot", "Ignored: another command is in flight", {
          traceId,
        });
        return;
      }

      busyRef.current = true;
      setStatus("busy");
      clearWarning();
      try {
        await latest.saveSnapshot();
        recordDividerUiDebug("Controller.AddSlot", "Place divider request prepared", {
          traceId,
          cabinetId: context.cabinetId,
          drawerType: context.drawerType,
          zone: enrichedSlot.zone,
          key: enrichedSlot.key,
          zoneIndex: enrichedSlot.zoneIndex,
          placementType: enrichedSlot.placementType,
          selectedType: decision.command.type,
        });
        await adapter.execute(decision.command);
        await runSettle(context, traceId);
        recordDividerUiDebug("Controller.AddSlot", "Add slot flow completed", {
          traceId,
          cabinetId: context.cabinetId,
          drawerType: context.drawerType,
          zone: enrichedSlot.zone,
          key: enrichedSlot.key,
          selectedType: decision.command.type,
        });
      } finally {
        busyRef.current = false;
        setStatus("ready");
      }
    },
    [adapter, clearWarning, readSelectedType, runSettle, setStatus, showWarning],
  );

  /** STABLE active-context handler (select / after-select / exit / resize-restore). */
  const handleContextEvent = useCallback(
    (event: DividerContextChangeEvent) => {
      const latest = latestRef.current;

      if (event.phase === "select") {
        recordDividerUiDebug("Controller.ContextChange", "Top view selected", {
          cabinetId: event.context.cabinetId,
          drawerType: event.context.drawerType,
        });
        setActiveContext(event.context);
        return;
      }

      if (event.phase === "after-select") {
        recordDividerUiDebug("Controller.ContextChange", "Top view after-select", {
          cabinetId: event.context.cabinetId,
          drawerType: event.context.drawerType,
          dividerSelection: latest.dividerSelection,
          selectedDividerType: readSelectedType(),
        });
        setActiveContext(event.context);
        if (latest.dividerSelection !== "Customize") {
          recordDividerUiDebug("Controller.ContextChange", "Skip overlay refresh: Customize is not selected", {
            dividerSelection: latest.dividerSelection,
          });
          return;
        }

        const traceId = createDividerUiTraceId("controller-after-select");
        adapter.setSlotButtonsVisible(true);
        showSlotsGuarded(event.context, traceId);
        void refreshAvailability(event.context);
        return;
      }

      if (event.phase === "exit") {
        recordDividerUiDebug("Controller.ContextChange", "Top view exited", {});
        setActiveContext(null);
        return;
      }

      // resize-restore — absorbed from useDividerResizeOverlayRestore
      recordDividerUiDebug("Controller.ResizeRestore", "Divider resize restore event received", {
        dimension: event.dimension,
        targets: event.targets,
        fallbackCabinetId: latest.fallbackCabinetId,
        activeContext: latest.state.activeContext,
      });

      if (!latest.isPlayCanvasReady || latest.dividerSelection !== "Customize") return;

      const matchCabinetId = latest.state.activeContext?.cabinetId ?? latest.fallbackCabinetId;
      const target = matchCabinetId
        ? event.targets.find((item) => item.cabinetId === matchCabinetId)
        : undefined;

      if (!target) {
        if (latest.shouldRestoreDrawerButtons) {
          recordDividerUiDebug("Controller.ResizeRestore", "Restore drawer CTA after resize", {
            dimension: event.dimension,
          });
          setVisibleDrawerButtons(true);
        }
        return;
      }

      setActiveContext(target);
      recordDividerUiDebug("Controller.ResizeRestore", "Restore drawer overlay after resize", {
        cabinetId: target.cabinetId,
        drawerType: target.drawerType,
        dimension: event.dimension,
        selectedDividerType: readSelectedType(),
      });

      const traceId = createDividerUiTraceId("controller-resize-restore");
      void adapter
        .restoreTopView(target)
        .catch((error: unknown) => {
          warnDividerUiDebug("Controller.ResizeRestore", "Failed to reopen drawer after resize", {
            cabinetId: target.cabinetId,
            drawerType: target.drawerType,
            dimension: event.dimension,
            error,
          });
        })
        .finally(() => {
          window.setTimeout(() => {
            adapter.setSlotButtonsVisible(true);
            showSlotsGuarded(target, traceId);
            void refreshAvailability(target);
          }, RESIZE_RESTORE_REFRESH_DELAY_MS);
        });
    },
    [adapter, readSelectedType, refreshAvailability, setActiveContext, showSlotsGuarded],
  );

  // ── Invariant 1: ONE registration effect. selectedType/availability MUST NOT appear here.
  useEffect(() => {
    if (!isPlayCanvasReady) return;

    recordDividerUiDebug("Controller.Register", "Register PlayCanvas callbacks", {
      adapterReady: adapter.isReady(),
    });

    const unsubscribeSlots = adapter.onSlotClick(handleSlotClick);
    const unsubscribeContext = adapter.onActiveContextChange(handleContextEvent);
    setStatus("ready");

    return () => {
      recordDividerUiDebug("Controller.Register", "Unregister PlayCanvas callbacks", {});
      unsubscribeSlots();
      unsubscribeContext();
    };
  }, [isPlayCanvasReady, adapter, handleSlotClick, handleContextEvent, setStatus]);

  // ── Selection gate: hide overlay outside "Customize", show + sync on entry.
  useEffect(() => {
    if (!isPlayCanvasReady) {
      recordDividerUiDebug("Controller.Gate", "Skip because PlayCanvas is not ready", {
        dividerSelection,
      });
      return;
    }

    const traceId = createDividerUiTraceId("controller-gate");

    if (dividerSelection !== "Customize") {
      recordDividerUiDebug("Controller.Gate", "Disable divider slot buttons because Customize is not selected", {
        dividerSelection,
      });
      void adapter.execute({ kind: "hideSlots", traceId });
      applyAvailability(null);
      return;
    }

    adapter.setSlotButtonsVisible(true);

    const context = latestRef.current.state.activeContext ?? adapter.resolveActiveContext();
    if (!context) {
      warnDividerUiDebug("Controller.Gate", "Skip overlay init because active drawer is not resolved", {
        fallbackCabinetId: latestRef.current.fallbackCabinetId,
      });
      return;
    }

    recordDividerUiDebug("Controller.Gate", "Initialize divider overlay", {
      cabinetId: context.cabinetId,
      drawerType: context.drawerType,
      selectedDividerType: readSelectedType(),
    });
    setActiveContext(context);
    showSlotsGuarded(context, traceId);
  }, [
    isPlayCanvasReady,
    dividerSelection,
    adapter,
    applyAvailability,
    readSelectedType,
    setActiveContext,
    showSlotsGuarded,
  ]);

  // ── Availability follows the active context.
  useEffect(() => {
    if (!isPlayCanvasReady || dividerSelection !== "Customize") return;
    const context = state.activeContext;
    if (!context) return;

    recordDividerUiDebug("Controller.Availability", "Fetch availability for active context", {
      cabinetId: context.cabinetId,
      drawerType: context.drawerType,
    });

    let isCurrent = true;
    void adapter.fetchAvailability(context).then((availability) => {
      if (!isCurrent) {
        recordDividerUiDebug("Controller.Availability", "Discard stale availability response", {
          cabinetId: context.cabinetId,
          drawerType: context.drawerType,
          types: availability?.types ?? null,
        });
        return;
      }
      applyAvailability(availability);
    });

    return () => {
      isCurrent = false;
    };
  }, [isPlayCanvasReady, dividerSelection, state.activeContext, adapter, applyAvailability]);

  // ── Context-matched availability (null when it belongs to another drawer).
  const matchedAvailability = useMemo(() => {
    if (dividerSelection !== "Customize" || !state.availability) return null;

    const context = state.activeContext ?? adapter.resolveActiveContext();
    if (!context) return null;

    return sameContext(state.availability.context, context) ? state.availability : null;
  }, [adapter, dividerSelection, state.activeContext, state.availability]);

  // ── Invariant 5: react to selected-type changes (a NORMAL effect, not the dispatcher).
  const prevSelectedTypeRef = useRef<DividerType | null>(selectedType);
  useEffect(() => {
    const typeChanged = prevSelectedTypeRef.current !== selectedType;
    const previousType = prevSelectedTypeRef.current;
    prevSelectedTypeRef.current = selectedType;

    if (!isPlayCanvasReady || dividerSelection !== "Customize" || !selectedType) {
      recordDividerUiDebug("Controller.SelectedType", "Skip", {
        selectedType,
        previousType,
        typeChanged,
        reason: !isPlayCanvasReady
          ? "playcanvas-not-ready"
          : dividerSelection !== "Customize"
            ? "not-customize"
            : "no-selection",
        dividerSelection,
      });
      return;
    }

    const context = state.activeContext ?? adapter.resolveActiveContext();
    if (!context) {
      recordDividerUiDebug("Controller.SelectedType", "Skip: no active drawer context", {
        selectedType,
        previousType,
        typeChanged,
        fallbackCabinetId: latestRef.current.fallbackCabinetId,
      });
      return;
    }

    const traceId = createDividerUiTraceId("controller-selected-type");

    if (matchedAvailability && !matchedAvailability.types.includes(selectedType)) {
      const message = buildUnavailableDividerWarning(selectedType, matchedAvailability.types);
      showWarning(message);
      warnDividerUiDebug("Controller.SelectedType", "Selected divider type unavailable for active drawer", {
        traceId,
        selectedType,
        availableTypes: matchedAvailability.types,
        userMessage: message,
      });
      void adapter.execute({ kind: "showSlots", context, selectedType: null, traceId });
      return;
    }

    if (!typeChanged) {
      recordDividerUiDebug("Controller.SelectedType", "Skip re-show: type unchanged (availability refetch)", {
        traceId,
        selectedType,
        cabinetId: context.cabinetId,
        drawerType: context.drawerType,
        availabilityTypes: matchedAvailability?.types ?? null,
      });
      return;
    }

    recordDividerUiDebug("Controller.SelectedType", "Refresh overlay for newly selected type", {
      traceId,
      selectedType,
      cabinetId: context.cabinetId,
      drawerType: context.drawerType,
    });
    void adapter.execute({ kind: "showSlots", context, selectedType, traceId });
  }, [
    selectedType,
    isPlayCanvasReady,
    dividerSelection,
    matchedAvailability,
    state.activeContext,
    adapter,
    showWarning,
  ]);

  const refresh = useCallback(() => {
    const latest = latestRef.current;
    if (!latest.isPlayCanvasReady || latest.dividerSelection !== "Customize") return;

    const context = latest.state.activeContext ?? adapter.resolveActiveContext();
    if (!context) return;

    const traceId = createDividerUiTraceId("controller-refresh");
    recordDividerUiDebug("Controller.Refresh", "Manual overlay refresh requested", {
      traceId,
      cabinetId: context.cabinetId,
      drawerType: context.drawerType,
    });
    adapter.setSlotButtonsVisible(true);
    showSlotsGuarded(context, traceId);
    void refreshAvailability(context);
  }, [adapter, refreshAvailability, showSlotsGuarded]);

  const derivedOptions = useMemo(
    () => deriveDividerOptions(optionsSource, matchedAvailability),
    [optionsSource, matchedAvailability],
  );

  return {
    state,
    options: derivedOptions,
    availableTypes: matchedAvailability?.types ?? null,
    warning: state.warning,
    clearWarning,
    showWarning,
    refresh,
  };
}
