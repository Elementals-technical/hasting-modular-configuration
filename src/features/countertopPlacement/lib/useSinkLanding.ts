import { useCallback, useEffect, useRef, useState } from "react";

import {
  createConfiguratorClient,
  type CabinetMoveSinkReceipt,
  type CabinetsState,
  type ConfiguratorClient,
  type CountertopApi,
  type CountertopSinkPending,
} from "@/features/configuratorApi";
import { getCountertopRuntimeState, subscribeCountertopRuntimeState } from "@/shared/lib/countertopRuntimeState";

export type SinkLandingClient = Pick<ConfiguratorClient, "moveSink" | "getCabinetsState" | "dispose">;

type Options = {
  ready: boolean;
  getApi: () => CountertopApi | null;
  /** Same UI sync as a committed placement (`adoptCommittedCabinetComposition`). */
  onCommitted: (state: CabinetsState, receipt: CabinetMoveSinkReceipt) => void | Promise<void>;
  /** Test builds: commit every 'fits' landing without asking. */
  autoConfirm?: boolean;
  createClient?: () => SinkLandingClient;
};

export type SinkLandingPrompt = CountertopSinkPending;
type Pose = { x: number; y: number };

/** `?autoMoveSink`: commit 'fits' sink landings without the dialog (test builds). */
export const isSinkAutoConfirmMode = (search: string) => new URLSearchParams(search).has("autoMoveSink");

const errorCode = (error: unknown) =>
  typeof error === "object" && error !== null && typeof (error as { code?: unknown }).code === "string"
    ? (error as { code: string }).code
    : null;

/**
 * SB <-> SC sink move (phase 1 §6d): a 'fits' `sink-landing` action asks the user; Confirm commits
 * `cabinets.moveSink` and syncs the UI, Decline (or a failed commit) puts the top back where the drag
 * started. Every closed prompt is a decision, so `sink.pending` never stays set by the UI.
 */
export const useSinkLanding = ({ ready, getApi, onCommitted, autoConfirm = false, createClient }: Options) => {
  const [prompt, setPrompt] = useState<SinkLandingPrompt | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const poseBeforeRef = useRef<Pose | null>(null);
  const promptRef = useRef<SinkLandingPrompt | null>(null);
  const seenPendingRef = useRef(false);
  const clientRef = useRef<SinkLandingClient | null>(null);
  const createClientRef = useRef(createClient ?? createConfiguratorClient);
  const onCommittedRef = useRef(onCommitted);
  onCommittedRef.current = onCommitted;
  const getApiRef = useRef(getApi);
  getApiRef.current = getApi;

  // Watched in the store listener, not through a hook: PlayCanvasIntegration must not re-render on drag frames.
  useEffect(() => {
    let wasDragging = getCountertopRuntimeState()?.dragging === true;
    return subscribeCountertopRuntimeState(() => {
      const next = getCountertopRuntimeState();
      // The pose before the move: the offset at the moment the pointer drag starts (dragging false -> true).
      const dragging = next?.dragging === true;
      if (dragging && !wasDragging && next) poseBeforeRef.current = { x: next.offset?.x ?? 0, y: next.offset?.y ?? 0 };
      wasDragging = dragging;
      // The landing went away by itself (the top moved again, a reset, a reload): nothing to decide.
      // The action may arrive before the state that carries `pending`, so only a pending seen and then gone counts.
      if (!promptRef.current) seenPendingRef.current = false;
      else if (next?.sink?.pending) seenPendingRef.current = true;
      else if (seenPendingRef.current) close();
    });
  }, []);

  // After unmount no new client is created (a late decision would otherwise leak one).
  const unmountedRef = useRef(false);
  const client = () => (unmountedRef.current ? null : (clientRef.current ??= createClientRef.current()));
  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      clientRef.current?.dispose();
      clientRef.current = null;
    };
  }, []);

  const close = () => {
    promptRef.current = null;
    setPrompt(null);
  };

  const revert = useCallback(async () => {
    const api = getApiRef.current();
    if (!api) return;
    const before = poseBeforeRef.current;
    if (before) {
      try {
        await api.setOffset({ ...before });
        return;
      } catch (error) {
        // e.g. a locked top cannot return to a lifted pose: the reset below still clears `sink.pending`.
        console.warn("[sink-landing] setOffset(before) failed, resetting the offset", error);
      }
    }
    try {
      await api.resetOffset();
    } catch (error) {
      console.warn("[sink-landing] resetOffset failed", error);
      setMessage("The countertop could not go back.");
    }
  }, []);

  const commit = useCallback(async (pending: SinkLandingPrompt) => {
    const sinkClient = client();
    if (!sinkClient) return;
    const move = () => sinkClient.moveSink(pending.fromCabinetId, pending.cabinetId);
    let receipt: CabinetMoveSinkReceipt;
    try {
      try {
        receipt = await move();
      } catch (error) {
        // STALE_COMPOSITION: the client re-reads the revision on the retry.
        if (errorCode(error) !== "STALE_COMPOSITION") throw error;
        receipt = await move();
      }
    } catch (error) {
      console.warn("[sink-landing] moveSink failed", errorCode(error), error);
      setMessage("The sink could not be moved.");
      await revert();
      return;
    }
    try {
      const state = await sinkClient.getCabinetsState();
      await onCommittedRef.current({ ...state, selectedCabinetId: receipt.sinkHostId ?? state.selectedCabinetId }, receipt);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The sink moved; UI synchronisation failed.");
    }
  }, [revert]);

  /** First decision wins; the prompt closes with it. */
  const decide = useCallback(
    async (choice: "confirm" | "decline") => {
      const pending = promptRef.current;
      if (!pending) return;
      close();
      setBusy(true);
      try {
        await (choice === "confirm" ? commit(pending) : revert());
      } finally {
        poseBeforeRef.current = null;
        setBusy(false);
      }
    },
    [commit, revert],
  );

  // The scene went away with the prompt open: nothing to revert, just close it.
  useEffect(() => {
    if (ready || !promptRef.current) return;
    poseBeforeRef.current = null;
    close();
  }, [ready]);

  const autoConfirmRef = useRef(autoConfirm);
  autoConfirmRef.current = autoConfirm;
  useEffect(() => {
    if (!ready) return undefined;
    const api = getApi();
    if (!api) return undefined;
    return api.on("action", (action) => {
      if (action?.type !== "sink-landing" || action.landing.status !== "fits") return;
      const { cabinetId, fromCabinetId } = action.landing;
      if (!cabinetId || !fromCabinetId) return;
      promptRef.current = { cabinetId, fromCabinetId };
      seenPendingRef.current = Boolean(getCountertopRuntimeState()?.sink?.pending);
      setMessage(null);
      if (autoConfirmRef.current) void decide("confirm");
      else setPrompt(promptRef.current);
    });
  }, [ready, getApi, decide]);

  return {
    prompt,
    busy,
    message,
    confirm: () => decide("confirm"),
    decline: () => decide("decline"),
    dismissMessage: () => setMessage(null),
  };
};
