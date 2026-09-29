import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

import {
  createConfiguratorClient,
  type CabinetsState,
  type ConfiguratorClient,
  type CabinetDraftState,
  type ConfiguratorReceipt,
  type ConfiguratorPreset,
} from "@/features/configuratorApi";

import s from "./CabinetPlacementDebug.module.scss";

type Props = {
  ready: boolean;
  selection: { definitionId: string; selection: Record<string, unknown> } | null;
  selectedProductId: string | null;
  createClient?: () => ConfiguratorClient;
  externalBusy?: boolean;
  onPlacementBusyChange?: (busy: boolean) => void;
  onCompositionCommitted?: (state: CabinetsState) => void | Promise<void>;
  onRepositionAvailabilityChange?: (status: CabinetRepositionAvailability) => void;
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

export const CabinetPlacementDebug = forwardRef<CabinetPlacementControls, Props>(function CabinetPlacementDebug(
  {
    ready,
    selection,
    selectedProductId,
    createClient = createConfiguratorClient,
    externalBusy = false,
    onPlacementBusyChange,
    onCompositionCommitted,
    onRepositionAvailabilityChange,
  },
  ref,
) {
  const clientRef = useRef<ConfiguratorClient | null>(null);
  const pendingRef = useRef(false);
  const activeSessionRef = useRef<string | null>(null);
  const onCommittedRef = useRef(onCompositionCommitted);
  onCommittedRef.current = onCompositionCommitted;
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

  const syncCommitted = useCallback((client: ConfiguratorClient, receipt: ConfiguratorReceipt): Promise<void> => {
    const previous = receiptSyncRef.current.get(receipt.requestId);
    if (previous) return previous;
    const task = (async () => {
      const state = await client.getCabinetsState();
      if (clientRef.current === client) await onCommittedRef.current?.(state);
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
      if (typeof next.sessionId !== "string") return;
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
                if (activeSessionRef.current && action.sessionId !== activeSessionRef.current) return;
                if (action.status === "committed" || action.status === "cancelled") {
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
                if (typeof composition.activeSessionId === "string") setSession(composition.activeSessionId);
                else if (composition.activeSessionId === null) setSession(null);
                if (retryDeadline && Date.now() >= retryDeadline) retryDeadline = 0;
                void refreshCapabilities();
              }),
            );
            subscriptionScope = nextScope;
            subscriptionsInstalled = true;
            const state = dataOf(await client.getCompositionState());
            if (disposed) return;
            setCompositionStatus(typeof state.status === "string" ? state.status : "ready");
            if (typeof state.activeSessionId === "string") {
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
      client.dispose();
      if (clientRef.current === client) clientRef.current = null;
      if (refreshCapabilitiesRef.current === refreshCapabilities) refreshCapabilitiesRef.current = null;
      activeSessionRef.current = null;
      receiptSync.clear();
      setSessionId(null);
      setDraft(null);
      setConnected(false);
    };
  }, [ready, createClient, syncCommitted]);

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
    void command(async (client) => {
      if (!client) return;
      let next: CabinetDraftState;
      if (kind === "add") {
        if (!selection) return;
        const state = await client.getCabinetsState();
        const anchor = state.selectedCabinetId ?? selectedProductId;
        const anchorCabinetId = state.cabinets.some((cabinet) => cabinet.id === anchor) ? anchor : null;
        const options = await client.getPlacementOptions({
          ...selection,
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
          next = await client.beginAdd(selection.definitionId, selection.selection, {
            kind: "free",
            frameId: option.frameId,
            positionM: option.positionM,
          });
        } else {
          next = await client.beginAdd(selection.definitionId, selection.selection, {
            kind: "option",
            optionId: option.id,
          });
        }
      } else {
        // Local runtime does not publish cabinet selection events: read it at click time.
        const state = await client.getCabinetsState();
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
      setStatus("Drag the cabinet in the canvas, then Apply or Cancel");
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
    });
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

  return (
    <section className={s.panel} aria-label="Cabinet placement test controls">
      <div className={s.buttons}>
        <button type="button" disabled={busy || !canAdd || !selection} onClick={() => start("add")}>
          Drag &amp; Drop
        </button>
        {connected && canMove && (
          <button type="button" disabled={busy} onClick={() => start("move")}>
            Move selected cabinet
          </button>
        )}
        {sessionId && (
          <>
            <button
              type="button"
              disabled={
                !connected ||
                capabilitiesRefreshing ||
                pending ||
                !supported.includes("cabinetPlacement.apply") ||
                draft?.canApply !== true
              }
              onClick={() => finish("apply")}
            >
              Apply
            </button>
            <button
              type="button"
              disabled={
                !connected ||
                capabilitiesRefreshing ||
                pending ||
                !supported.includes("cabinetPlacement.cancel") ||
                draft?.canCancel !== true
              }
              onClick={() => finish("cancel")}
            >
              Cancel
            </button>
          </>
        )}
      </div>
      <label>
        Add on
        <select aria-label="Add on side" value={side} disabled={busy} onChange={(event) => setSide(event.target.value)}>
          <option value="left">Left</option>
          <option value="right">Right</option>
        </select>
      </label>
      {!selection && connected && <p>Select a cabinet configuration to add.</p>}
      <p role="status">{status}</p>
      {error && <p role="alert">{error}</p>}
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
                const receipt = await client.importPreset(JSON.parse(presetJson) as ConfiguratorPreset);
                await syncCommitted(client, receipt);
                setRestoreConfirmed(false);
                setStatus("Preset restored; cabinet IDs refreshed");
              })
            }
          >
            Restore JSON
          </button>
        </details>
      )}
    </section>
  );
});
