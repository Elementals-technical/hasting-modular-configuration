import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, useSyncExternalStore } from "react";

import {
  createConfiguratorClient,
  isCommandPlacementSession,
  type CabinetsState,
  type ConfiguratorClient,
  type CabinetDraftState,
  type ConfiguratorReceipt,
  type ConfiguratorPreset,
  type ConfiguratorCompactPreset,
} from "@/features/configuratorApi";

import { DRAFT_HINTS, draftInvalidHint, draftValidationStatus } from "../lib/draftValidationMessage";
import { createPlacementOverlayStore, visibleOverlayFrame } from "../lib/placementOverlayStore";
import { sideShelvesAtRowEnds, wallAfterDraft } from "../lib/sideShelfEdges";
import { CabinetDraftOverlay } from "./CabinetDraftOverlay";
import { MoveIcon } from "./placementIcons";
import s from "./CabinetPlacementDebug.module.scss";

export type CabinetPlacementSelection = { definitionId: string; selection: Record<string, unknown> };

type Props = {
  ready: boolean;
  selection: CabinetPlacementSelection | null;
  /**
   * The cabinet an Add places, resolved when the Add starts: the scene type and config as the
   * composition commands would place them. Without it, `selection` is placed as it is.
   */
  prepareSelection?: () => CabinetPlacementSelection | null;
  /**
   * Places the first cabinet of an empty composition as the builder's "+" there does: the scene lays a
   * countertop only for a cabinet its own add places, never for one a draft commits.
   */
  addFirstCabinet?: () => Promise<void>;
  selectedProductId: string | null;
  /** The builder shows its "+" buttons for the cabinet being added: "Drag to Place" is offered with them. */
  offerAdd?: boolean;
  createClient?: () => ConfiguratorClient;
  externalBusy?: boolean;
  onPlacementBusyChange?: (busy: boolean) => void;
  /** The scene committed a change; its receipt names the cabinets it added. */
  onCompositionCommitted?: (state: CabinetsState, receipt: ConfiguratorReceipt) => void | Promise<void>;
  /** A change is about to start. Awaited first: the scene cannot describe itself once a draft is open. */
  onBeforeCompositionChange?: () => void | Promise<void>;
  /** The change announced by `onBeforeCompositionChange` did not happen (cancelled, or it failed to start). */
  onCompositionChangeAbandoned?: () => void;
  onRepositionAvailabilityChange?: (status: CabinetRepositionAvailability) => void;
  /** Engineering tools (Move selected, add side, Save/Restore JSON): `?placementDebug` in the URL. */
  showDebugTools?: boolean;
  /** The scene type of a side shelf, which stays at an end of its row: a draft that leaves one inward is not applied. */
  isSideShelfType?: (definitionId: string) => boolean;
};

export type CabinetPlacementControls = {
  reposition(productId: string): void;
};

export type CabinetRepositionAvailability = {
  supported: boolean;
  available: boolean;
};

const dataOf = (event: unknown): Record<string, unknown> => {
  if (typeof event !== "object" || !event) return {};
  const envelope = event as Record<string, unknown>;
  return typeof envelope.data === "object" && envelope.data ? (envelope.data as Record<string, unknown>) : envelope;
};
const errorMessage = (error: unknown): string => {
  if (!(error instanceof Error)) return "Runtime command failed";
  const code = "code" in error ? String(error.code) : "";
  const detail =
    "detail" in error && error.detail && typeof error.detail === "object" ? JSON.stringify(error.detail) : "";
  const message = code && !error.message.includes(code) ? `${code}: ${error.message}` : error.message;
  return detail && detail !== `{"code":"${code}"}` ? `${message} · ${detail}` : message;
};
const isTerminal = (lifecycle: unknown) => ["committed", "cancelled", "error"].includes(String(lifecycle));

/**
 * Cabinet Drag & Drop. "Drag to Place", offered above the composition while the builder shows its "+"
 * buttons, opens an Add draft of the configured cabinet right away; elsewhere a draft opens only from
 * the cabinet menu (`reposition`). PlayCanvas tints the draft green (free spot) or red (overlaps a
 * cabinet; Apply blocked) and publishes screen anchors, where this component puts the move icon, Apply
 * and discard (x). "Cancel" shows while the draft is open. A PlayCanvas build without the overlay (or a
 * draft off screen) falls back to Apply next to Cancel.
 */
export const CabinetPlacementDebug = forwardRef<CabinetPlacementControls, Props>(function CabinetPlacementDebug(
  {
    ready,
    selection,
    prepareSelection,
    addFirstCabinet,
    selectedProductId,
    offerAdd = false,
    createClient = createConfiguratorClient,
    externalBusy = false,
    onPlacementBusyChange,
    onCompositionCommitted,
    onBeforeCompositionChange,
    onCompositionChangeAbandoned,
    onRepositionAvailabilityChange,
    showDebugTools = false,
    isSideShelfType,
  },
  ref,
) {
  const clientRef = useRef<ConfiguratorClient | null>(null);
  const pendingRef = useRef(false);
  const activeSessionRef = useRef<string | null>(null);
  const onCommittedRef = useRef(onCompositionCommitted);
  onCommittedRef.current = onCompositionCommitted;
  const onBeforeChangeRef = useRef(onBeforeCompositionChange);
  onBeforeChangeRef.current = onBeforeCompositionChange;
  const onAbandonedRef = useRef(onCompositionChangeAbandoned);
  onAbandonedRef.current = onCompositionChangeAbandoned;
  const prepareSelectionRef = useRef(prepareSelection);
  prepareSelectionRef.current = prepareSelection;
  const addFirstCabinetRef = useRef(addFirstCabinet);
  addFirstCabinetRef.current = addFirstCabinet;
  const receiptSyncRef = useRef(new Map<string, Promise<void>>());
  const refreshCapabilitiesRef = useRef<(() => Promise<void>) | null>(null);
  const [connected, setConnected] = useState(false);
  const [capabilitiesRefreshing, setCapabilitiesRefreshing] = useState(false);
  const [supported, setSupported] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CabinetDraftState | null>(null);
  const [status, setStatus] = useState("Waiting for cabinet runtime…");
  const [error, setError] = useState<string | null>(null);
  const [compositionStatus, setCompositionStatus] = useState("initializing");
  const [side, setSide] = useState("right");
  const [presetJson, setPresetJson] = useState(() => {
    try {
      return localStorage.getItem("cabinet-placement-debug-preset") ?? "";
    } catch {
      return "";
    }
  });
  const [restoreConfirmed, setRestoreConfirmed] = useState(false);
  // The composition a draft started from, for the side shelf rule: the scene does not check it.
  const [draftStart, setDraftStart] = useState<{ sessionId: string; state: CabinetsState } | null>(null);
  const [overlayStore] = useState(createPlacementOverlayStore);
  // A primitive snapshot: re-render when the anchored session changes, not on every overlay frame.
  const anchoredSessionId = useSyncExternalStore(
    overlayStore.subscribe,
    () => visibleOverlayFrame(overlayStore.get(), overlayStore.get()?.sessionId ?? null)?.sessionId ?? null,
  );

  const syncCommitted = useCallback((client: ConfiguratorClient, receipt: ConfiguratorReceipt): Promise<void> => {
    const previous = receiptSyncRef.current.get(receipt.requestId);
    if (previous) return previous;
    const task = (async () => {
      const state = await client.getCabinetsState();
      if (clientRef.current === client) await onCommittedRef.current?.(state, receipt);
    })();
    receiptSyncRef.current.set(receipt.requestId, task);
    return task;
  }, []);

  useEffect(() => {
    if (!ready) return;
    const client = createClient();
    clientRef.current = client;
    const receiptSync = receiptSyncRef.current;
    let disposed = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let retryDeadline = 0;
    let subscriptionsInstalled = false;
    let subscriptionScope = "";
    let lastReadiness = "initializing";
    let readinessError = false;
    let refreshInFlight: Promise<void> | null = null;
    let placeholdersDisabled = false;
    const unsubscribe: (() => void)[] = [];
    const setSession = (id: string | null) => {
      activeSessionRef.current = id;
      setSessionId(id);
    };
    const updateDraft = (event: unknown) => {
      if (disposed) return;
      if (typeof event === "object" && event && "data" in event && event.data === null) {
        setSession(null);
        setDraft(null);
        setStatus("Ready to drag a cabinet");
        return;
      }
      const next = dataOf(event);
      // A command's own session (a cabinet placed in a column) opens and closes without these controls.
      if (typeof next.sessionId !== "string" || isCommandPlacementSession(next.sessionId)) return;
      const finished = isTerminal(next.lifecycle);
      setSession(finished ? null : next.sessionId);
      setDraft(finished ? null : (next as CabinetDraftState));
      setStatus(finished ? `Placement ${String(next.lifecycle)}` : `Placement: ${String(next.lifecycle)}`);
    };

    const stopSubscriptions = () => {
      unsubscribe.splice(0).forEach((stop) => stop());
      subscriptionsInstalled = false;
    };
    const scheduleReadinessCheck = () => {
      if (disposed || retryTimer) return;
      if (!retryDeadline) retryDeadline = Date.now() + 15_000;
      if (Date.now() >= retryDeadline) {
        setStatus("Cabinet runtime is unavailable. Reload the runtime to retry.");
        return;
      }
      retryTimer = setTimeout(() => {
        retryTimer = undefined;
        void refreshCapabilities();
      }, 300);
    };
    const refreshCapabilities = (): Promise<void> => {
      if (disposed) return Promise.resolve();
      if (refreshInFlight) return refreshInFlight;
      setCapabilitiesRefreshing(true);
      refreshInFlight = (async () => {
        try {
          const capabilities = await client.getCapabilities({ refresh: true });
          if (disposed) return;
          const previousReadiness = lastReadiness;
          lastReadiness = capabilities.readiness;
          if (capabilities.readiness !== "ready") {
            setConnected(false);
            setSupported([]);
            setStatus(
              capabilities.readiness === "initializing"
                ? "Waiting for cabinet runtime…"
                : `Cabinet runtime: ${capabilities.readiness}`,
            );
            scheduleReadinessCheck();
            return;
          }
          const nextScope = `${capabilities.apiInstanceId}:${capabilities.activeCompositionId}`;
          if (subscriptionsInstalled && subscriptionScope !== nextScope) {
            stopSubscriptions();
            setSession(null);
            setDraft(null);
            receiptSync.clear();
          }
          if (!subscriptionsInstalled) {
            await client.connect();
            if (disposed) return;
            unsubscribe.push(await client.on("cabinetPlacement", "change", updateDraft));
            unsubscribe.push(
              await client.on("cabinetPlacement", "action", (event: unknown) => {
                if (disposed) return;
                const action = dataOf(event);
                if (isCommandPlacementSession(action.sessionId)) return;
                if (activeSessionRef.current && action.sessionId !== activeSessionRef.current) return;
                if (action.status === "committed" || action.status === "cancelled") {
                  // Only the open draft: a late report of an earlier one must not drop the next start.
                  if (action.status === "cancelled" && activeSessionRef.current) onAbandonedRef.current?.();
                  setSession(null);
                  setDraft(null);
                  setStatus(action.status === "committed" ? "Placement applied" : "Placement cancelled");
                  if (action.status === "committed" && action.receipt) {
                    void syncCommitted(client, action.receipt as ConfiguratorReceipt).catch((failure) => {
                      if (!disposed) setError(errorMessage(failure));
                    });
                  }
                }
              }),
            );
            unsubscribe.push(
              await client.on("composition", "change", (event: unknown) => {
                if (disposed) return;
                const composition = dataOf(event);
                if (typeof composition.status === "string") setCompositionStatus(composition.status);
                if (isCommandPlacementSession(composition.activeSessionId)) setSession(null);
                else if (typeof composition.activeSessionId === "string") setSession(composition.activeSessionId);
                else if (composition.activeSessionId === null) setSession(null);
                if (retryDeadline && Date.now() >= retryDeadline) retryDeadline = 0;
                void refreshCapabilities();
              }),
            );
            if (typeof client.onPlacementOverlay === "function") {
              const stopOverlay = await client.onPlacementOverlay((frame) => {
                if (!disposed) overlayStore.set(frame);
              });
              if (stopOverlay) {
                unsubscribe.push(() => {
                  stopOverlay();
                  overlayStore.set(null);
                });
                // This UI draws the icons: PlayCanvas' temporary placeholders go away. Repeated on every
                // (re)subscription: a re-created runtime starts with its placeholders on.
                placeholdersDisabled = true;
                void client.setPlacementOverlayPlaceholders(false).catch(() => undefined);
              }
            }
            subscriptionScope = nextScope;
            subscriptionsInstalled = true;
            const state = dataOf(await client.getCompositionState());
            if (disposed) return;
            setCompositionStatus(typeof state.status === "string" ? state.status : "ready");
            if (typeof state.activeSessionId === "string" && !isCommandPlacementSession(state.activeSessionId)) {
              setSession(state.activeSessionId);
              updateDraft(await client.getPlacementState(state.activeSessionId));
            }
          } else if (previousReadiness !== "ready") {
            await client.connect();
            if (disposed) return;
            const state = await client.getCompositionState();
            if (disposed) return;
            setCompositionStatus(state.status ?? "ready");
          }
          if (disposed) return;
          if (retryTimer) clearTimeout(retryTimer);
          retryTimer = undefined;
          retryDeadline = 0;
          setSupported(capabilities.supportedMethods ?? []);
          setConnected(true);
          if (readinessError) {
            setError(null);
            readinessError = false;
          }
          if (previousReadiness !== "ready" && !activeSessionRef.current) setStatus("Ready to drag a cabinet");
        } catch (failure) {
          if (!disposed) {
            setConnected(false);
            setSupported([]);
            lastReadiness = "error";
            readinessError = true;
            setError(errorMessage(failure));
            if (!subscriptionsInstalled) stopSubscriptions();
            scheduleReadinessCheck();
          }
        }
      })().finally(() => {
        refreshInFlight = null;
        if (!disposed) setCapabilitiesRefreshing(false);
      });
      return refreshInFlight;
    };
    refreshCapabilitiesRef.current = refreshCapabilities;
    void refreshCapabilities();
    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      stopSubscriptions();
      overlayStore.set(null);
      if (placeholdersDisabled) void client.setPlacementOverlayPlaceholders(true).catch(() => undefined);
      client.dispose();
      if (clientRef.current === client) clientRef.current = null;
      if (refreshCapabilitiesRef.current === refreshCapabilities) refreshCapabilitiesRef.current = null;
      activeSessionRef.current = null;
      receiptSync.clear();
      setSessionId(null);
      setDraft(null);
      setConnected(false);
    };
  }, [ready, createClient, syncCommitted, overlayStore]);

  const command = async (run: (client: ConfiguratorClient | null) => Promise<void>) => {
    const client = clientRef.current;
    if (externalBusy || pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setError(null);
    try {
      await run(client);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      if (clientRef.current === client) await refreshCapabilitiesRef.current?.();
      pendingRef.current = false;
      setPending(false);
    }
  };
  const start = (kind: "add" | "move", explicitProductId?: string) => {
    if (activeSessionRef.current) return;
    let announced = false;
    void command(async (client) => {
      if (!client) return;
      // No draft for the first cabinet: its place is the only one, and the host's add lays the countertop.
      if (kind === "add" && addFirstCabinetRef.current && (await client.getCabinetsState()).cabinets.length === 0) {
        await addFirstCabinetRef.current();
        return;
      }
      await onBeforeChangeRef.current?.();
      announced = true;
      let next: CabinetDraftState;
      let startState: CabinetsState | null = null;
      if (kind === "add") {
        // Resolved now, with the values the configuration holds at this moment.
        const chosen = prepareSelectionRef.current ? prepareSelectionRef.current() : selection;
        if (!chosen) return;
        const state = await client.getCabinetsState();
        startState = state;
        if (!showDebugTools && state.cabinets.length > 0) {
          // Normal path: let the runtime start the draft at its best free end-of-row slot.
          next = await client.beginAdd(chosen.definitionId, chosen.selection);
        } else {
          // Debug side selector (or empty-composition seed): resolve an explicit option.
          const anchor = state.selectedCabinetId ?? selectedProductId;
          const anchorCabinetId = state.cabinets.some((cabinet) => cabinet.id === anchor) ? anchor : null;
          const options = await client.getPlacementOptions({
            ...chosen,
            operation: "add",
            ...(anchorCabinetId ? { anchorCabinetId } : {}),
          });
          const option =
            options.find((item) => item.availability === "available" && item.kind === side) ??
            options.find((item) => item.availability === "available" && item.kind === "seed");
          if (!option) throw new Error("No available placement on the selected side");
          if (state.cabinets.length === 0 && option.kind === "seed") {
            // Claiming an empty composition changes its revision and invalidates option IDs.
            // Use the runtime-provided seed pose through the public free-placement contract.
            if (typeof option.frameId !== "string") throw new Error("The seed placement has no frame");
            next = await client.beginAdd(chosen.definitionId, chosen.selection, {
              kind: "free",
              frameId: option.frameId,
              positionM: option.positionM,
            });
          } else {
            next = await client.beginAdd(chosen.definitionId, chosen.selection, {
              kind: "option",
              optionId: option.id,
            });
          }
        }
      } else {
        // Local runtime does not publish cabinet selection events: read it at click time.
        const state = await client.getCabinetsState();
        startState = state;
        const id = explicitProductId !== undefined ? explicitProductId : (state.selectedCabinetId ?? selectedProductId);
        if (!id || !state.cabinets.some((cabinet) => cabinet.id === id))
          throw new Error(
            explicitProductId !== undefined
              ? "Cabinet not found in the current composition"
              : "Select a cabinet in the canvas first",
          );
        next = await client.beginMove(id);
      }
      activeSessionRef.current = next.sessionId;
      setSessionId(next.sessionId);
      setDraft(next);
      setDraftStart(startState ? { sessionId: next.sessionId, state: startState } : null);
      setStatus("Drag the cabinet in the canvas, then Apply or Cancel");
      announced = false;
    }).finally(() => {
      // Announced, but no draft opened (nothing to add, or the runtime refused).
      if (announced) onAbandonedRef.current?.();
    });
  };
  const finish = (action: "apply" | "cancel") =>
    void command(async (client) => {
      if (!client) return;
      const id = activeSessionRef.current;
      if (!id) return;
      const result = await client[action](id);
      if (action === "cancel" && !isTerminal((result as CabinetDraftState).lifecycle)) {
        setDraft(result as CabinetDraftState);
        setStatus(`Placement: ${(result as CabinetDraftState).lifecycle}`);
        return;
      }
      activeSessionRef.current = null;
      setSessionId(null);
      setDraft(null);
      setStatus(action === "apply" ? "Placement applied" : "Placement cancelled");
      if (action === "apply") await syncCommitted(client, result as ConfiguratorReceipt);
      else onAbandonedRef.current?.();
    });
  /** An import of the test controls: announced like a draft, so it can be undone the same way. */
  const replaceComposition = async <T,>(send: () => Promise<T>): Promise<T> => {
    await onBeforeChangeRef.current?.();
    try {
      return await send();
    } catch (failure) {
      onAbandonedRef.current?.();
      throw failure;
    }
  };
  const busy =
    externalBusy ||
    !connected ||
    capabilitiesRefreshing ||
    pending ||
    Boolean(sessionId) ||
    compositionStatus !== "ready";
  const canAdd = supported.includes("cabinetPlacement.beginAdd");
  const canMove = supported.includes("cabinetPlacement.beginMove");
  const repositionSupported = ready && connected && canMove;
  const canReposition = repositionSupported && !busy;

  useImperativeHandle(ref, () => ({
    reposition: (productId) => {
      if (canReposition) start("move", productId);
    },
  }));

  useEffect(() => {
    onRepositionAvailabilityChange?.({ supported: repositionSupported, available: canReposition });
    return () => onRepositionAvailabilityChange?.({ supported: false, available: false });
  }, [repositionSupported, canReposition, onRepositionAvailabilityChange]);

  const placementBusy = pending || Boolean(sessionId);
  useEffect(() => {
    onPlacementBusyChange?.(placementBusy);
    return () => onPlacementBusyChange?.(false);
  }, [placementBusy, onPlacementBusyChange]);

  // A side shelf the draft would leave inward or in a column (the scene does not check it).
  const draftWall = draft && draftStart?.sessionId === draft.sessionId ? wallAfterDraft(draftStart.state, draft) : null;
  const sideShelfInward = Boolean(isSideShelfType && draftWall && !sideShelvesAtRowEnds(draftWall, isSideShelfType));
  const applyDisabled =
    !connected ||
    capabilitiesRefreshing ||
    pending ||
    !supported.includes("cabinetPlacement.apply") ||
    draft?.canApply !== true ||
    (draftValidationStatus(draft) ?? "valid") !== "valid" ||
    sideShelfInward;
  const cancelDisabled =
    !connected ||
    capabilitiesRefreshing ||
    pending ||
    !supported.includes("cabinetPlacement.cancel") ||
    draft?.canCancel !== true;
  const anchored = Boolean(sessionId) && anchoredSessionId === sessionId;
  const collisionHint = draftInvalidHint(draft) ?? (sideShelfInward ? DRAFT_HINTS.sideShelfAtRowEnd : null);

  return (
    <>
      <div className={s.toolbar}>
        {sessionId && (
          <div className={s.toolbarButtons}>
            {!anchored && (
              <button
                type="button"
                className={s.primaryPill}
                disabled={applyDisabled}
                title={collisionHint ?? undefined}
                onClick={() => finish("apply")}
              >
                Apply
              </button>
            )}
            <button
              type="button"
              className={s.secondaryPill}
              disabled={cancelDisabled}
              onClick={() => finish("cancel")}
            >
              Cancel
            </button>
          </div>
        )}
        {sessionId && collisionHint && <p className={s.hint}>{collisionHint}</p>}
        {error && (
          <p role="alert" className={s.error}>
            {error}
          </p>
        )}
        <p role="status" className={s.srOnly}>
          {status}
        </p>
      </div>
      {offerAdd && !sessionId && (
        <button
          type="button"
          className={s.dragToPlace}
          disabled={busy || !canAdd || !selection}
          title={!selection ? "Choose a cabinet configuration first" : undefined}
          // On press, as the scene's "+" do: the press closes the builder's sidebar, and with it this
          // option, before a click could land. A click with no press before it is Enter or Space.
          onMouseDown={() => start("add")}
          onClick={(event) => {
            if (event.detail === 0) start("add");
          }}
        >
          <MoveIcon size={16} />
          Drag to Place
        </button>
      )}
      <CabinetDraftOverlay
        store={overlayStore}
        sessionId={sessionId}
        applyDisabled={applyDisabled}
        cancelDisabled={cancelDisabled}
        invalidHint={collisionHint}
        onApply={() => finish("apply")}
        onCancel={() => finish("cancel")}
      />
      {showDebugTools && (
        <section className={s.panel} aria-label="Cabinet placement test controls">
          {connected && canMove && (
            <div className={s.buttons}>
              <button type="button" disabled={busy} onClick={() => start("move")}>
                Move selected cabinet
              </button>
            </div>
          )}
          <label>
            Add on
            <select
              aria-label="Add on side"
              value={side}
              disabled={busy}
              onChange={(event) => setSide(event.target.value)}
            >
              <option value="left">Left</option>
              <option value="right">Right</option>
            </select>
          </label>
          {!selection && connected && <p>Select a cabinet configuration to add.</p>}
          {(supported.includes("composition.exportPreset") || supported.includes("composition.importPreset")) && (
            <details>
              <summary>Save / Restore JSON</summary>
              <button
                type="button"
                disabled={busy || !supported.includes("composition.exportPreset")}
                onClick={() =>
                  void command(async (client) => {
                    if (!client) return;
                    const json = JSON.stringify(await client.exportPreset(), null, 2);
                    localStorage.setItem("cabinet-placement-debug-preset", json);
                    setPresetJson(json);
                    setRestoreConfirmed(false);
                    setStatus("Preset JSON saved in this browser");
                  })
                }
              >
                Save JSON
              </button>
              <label>
                Preset JSON
                <textarea
                  value={presetJson}
                  disabled={busy}
                  onChange={(event) => {
                    setPresetJson(event.target.value);
                    setRestoreConfirmed(false);
                  }}
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={restoreConfirmed}
                  disabled={busy}
                  onChange={(event) => setRestoreConfirmed(event.target.checked)}
                />
                Replace the current composition with this JSON
              </label>
              <button
                type="button"
                disabled={
                  busy || !restoreConfirmed || !presetJson.trim() || !supported.includes("composition.importPreset")
                }
                onClick={() =>
                  void command(async (client) => {
                    if (!client || !restoreConfirmed) return;
                    const receipt = await replaceComposition(() =>
                      client.importPreset(JSON.parse(presetJson) as ConfiguratorPreset),
                    );
                    await syncCommitted(client, receipt);
                    setRestoreConfirmed(false);
                    setStatus("Preset restored; cabinet IDs refreshed");
                  })
                }
              >
                Restore JSON
              </button>
              <button
                type="button"
                disabled={busy || !supported.includes("composition.exportCompactPreset")}
                onClick={() =>
                  void command(async (client) => {
                    if (!client) return;
                    const json = JSON.stringify(await client.exportCompactPreset(), null, 2);
                    setPresetJson(json);
                    setRestoreConfirmed(false);
                    try {
                      await navigator.clipboard?.writeText(json);
                      setStatus("Compact preset exported and copied to clipboard");
                    } catch {
                      setStatus("Compact preset exported (clipboard unavailable)");
                    }
                  })
                }
              >
                Export compact preset
              </button>
              <button
                type="button"
                disabled={
                  busy ||
                  !restoreConfirmed ||
                  !presetJson.trim() ||
                  !supported.includes("composition.importCompactPreset")
                }
                onClick={() =>
                  void command(async (client) => {
                    if (!client || !restoreConfirmed) return;
                    const receipt = await replaceComposition(() =>
                      client.importCompactPreset(JSON.parse(presetJson) as ConfiguratorCompactPreset),
                    );
                    await syncCommitted(client, receipt);
                    setRestoreConfirmed(false);
                    setStatus("Compact preset imported; cabinet IDs refreshed");
                  })
                }
              >
                Import compact preset
              </button>
            </details>
          )}
        </section>
      )}
    </>
  );
});
