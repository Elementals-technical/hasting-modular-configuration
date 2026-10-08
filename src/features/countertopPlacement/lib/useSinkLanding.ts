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
  createClient?: () => SinkLandingClient;
};

type Pose = { x: number; y: number };
/** A 'fits' landing and the pose the top had when its drag started (where a failed commit puts it back). */
type Landing = { pending: CountertopSinkPending; before: Pose | null };

const errorCode = (error: unknown) =>
  typeof error === "object" && error !== null && typeof (error as { code?: unknown }).code === "string"
    ? (error as { code: string }).code
    : null;

/**
 * SB <-> SC sink move (phase 1 §6d): every 'fits' `sink-landing` action commits `cabinets.moveSink` right away
 * (the SC under the sink becomes the SB, the old SB becomes an SC) and syncs the UI. A failed commit puts the
 * top back where the drag started, so `sink.pending` never stays set by the UI. One commit runs at a time.
 */
export const useSinkLanding = ({ ready, getApi, onCommitted, createClient }: Options) => {
  const [message, setMessage] = useState<string | null>(null);
  const poseBeforeRef = useRef<Pose | null>(null);
  const runningRef = useRef(false);
  const nextRef = useRef<Landing | null>(null);
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
    });
  }, []);

  // After unmount no new client is created (a late commit would otherwise leak one).
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

  const revert = useCallback(async (before: Pose | null) => {
    const api = getApiRef.current();
    if (!api) return;
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

  const commit = useCallback(
    async ({ pending, before }: Landing) => {
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
        await revert(before);
        return;
      }
      try {
        const state = await sinkClient.getCabinetsState();
        await onCommittedRef.current({ ...state, selectedCabinetId: receipt.sinkHostId ?? state.selectedCabinetId }, receipt);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "The sink moved; UI synchronisation failed.");
      }
    },
    [revert],
  );

  /**
   * One commit at a time. A landing that arrives during a commit is not committed: its ids are from before
   * moveSink (which issues new ones), so the top goes back to Standard instead and `sink.pending` clears.
   */
  const run = useCallback(
    async (landing: Landing) => {
      nextRef.current = landing;
      if (runningRef.current) return;
      runningRef.current = true;
      try {
        nextRef.current = null;
        await commit(landing);
        while (nextRef.current) {
          nextRef.current = null;
          console.warn("[sink-landing] a landing arrived during a commit; its ids are stale, resetting the offset");
          await revert(null);
        }
      } finally {
        runningRef.current = false;
      }
    },
    [commit, revert],
  );

  // The scene went away: drop a waiting landing and the drag-start pose (nothing to revert).
  useEffect(() => {
    if (ready) return;
    nextRef.current = null;
    poseBeforeRef.current = null;
  }, [ready]);

  useEffect(() => {
    if (!ready) return undefined;
    const api = getApi();
    if (!api) return undefined;
    return api.on("action", (action) => {
      if (action?.type !== "sink-landing" || action.landing.status !== "fits") return;
      const { cabinetId, fromCabinetId } = action.landing;
      if (!cabinetId || !fromCabinetId) return;
      const before = poseBeforeRef.current;
      poseBeforeRef.current = null;
      setMessage(null);
      void run({ pending: { cabinetId, fromCabinetId }, before });
    });
  }, [ready, getApi, run]);

  return { message, dismissMessage: () => setMessage(null) };
};
