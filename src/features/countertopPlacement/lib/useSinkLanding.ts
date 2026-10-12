import { useCallback, useEffect, useRef, useState } from "react";

import {
  createConfiguratorClient,
  type CabinetLandSinkReceipt,
  type CabinetLiftSinkReceipt,
  type CabinetMoveSinkReceipt,
  type CabinetsState,
  type ConfiguratorClient,
  type CountertopApi,
  type CountertopSinkLocalM,
} from "@/features/configuratorApi";
import { getCountertopRuntimeState, subscribeCountertopRuntimeState } from "@/shared/lib/countertopRuntimeState";

import { registerHostedSinkLanding } from "./hostedSinkLanding";

export type SinkLandingClient = Pick<ConfiguratorClient, "moveSink" | "getCabinetsState" | "dispose"> &
  Partial<Pick<ConfiguratorClient, "liftSink" | "landSink">>;
export type SinkCommitReceipt = CabinetMoveSinkReceipt | CabinetLiftSinkReceipt | CabinetLandSinkReceipt;

type Options = {
  ready: boolean;
  getApi: () => CountertopApi | null;
  /** Same UI sync as a committed placement (`adoptCommittedCabinetComposition`). */
  onCommitted: (state: CabinetsState, receipt: SinkCommitReceipt) => void | Promise<void>;
  createClient?: () => SinkLandingClient;
};

type Pose = { x: number; y: number };
/**
 * A 'fits' landing and the pose the top had when its drag started (where a failed commit puts it back).
 * `fromCabinetId: null`: a hosted sink lands (`landSink`), otherwise an SB sink moves (`moveSink`).
 */
type Landing = { kind: "landing"; cabinetId: string; fromCabinetId: string | null; before: Pose | null };
/** The top carried an SB sink off the cabinets (`liftSink`); a failure is only logged, nothing is reverted. */
type Lift = { kind: "lift"; fromCabinetId: string; sinkLocalM: CountertopSinkLocalM };
type Job = Landing | Lift;

const errorCode = (error: unknown) =>
  typeof error === "object" && error !== null && typeof (error as { code?: unknown }).code === "string"
    ? (error as { code: string }).code
    : null;

/**
 * SB <-> SC sink move (phase 1 §6d): every 'fits' `sink-landing` action commits `cabinets.moveSink` right away
 * (the SC under the sink becomes the SB, the old SB becomes an SC) and syncs the UI. A failed commit puts the
 * top back where the drag started, so `sink.pending` never stays set by the UI. One commit runs at a time.
 * A hosted sink (after a `sink-lift` -> `cabinets.liftSink`) lands through `cabinets.landSink` instead.
 * A missing `liftSink` (API_METHOD_UNAVAILABLE) is skipped with one warning; a missing move/land reverts.
 */
export const useSinkLanding = ({ ready, getApi, onCommitted, createClient }: Options) => {
  const [message, setMessage] = useState<string | null>(null);
  const poseBeforeRef = useRef<Pose | null>(null);
  const runningRef = useRef(false);
  const nextRef = useRef<Job | null>(null);
  const warnedRef = useRef(new Set<string>());
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
    async (job: Job) => {
      const sinkClient = client();
      if (!sinkClient) return;
      const name = job.kind === "lift" ? "liftSink" : job.fromCabinetId === null ? "landSink" : "moveSink";
      const send = (): Promise<SinkCommitReceipt> | undefined =>
        job.kind === "lift"
          ? sinkClient.liftSink?.(job.fromCabinetId, job.sinkLocalM)
          : job.fromCabinetId === null
            ? sinkClient.landSink?.(job.cabinetId)
            : sinkClient.moveSink(job.fromCabinetId, job.cabinetId);
      const skip = () => {
        if (!warnedRef.current.has(name)) console.warn(`[sink-landing] cabinets.${name} is not available in this runtime`);
        warnedRef.current.add(name);
      };
      let receipt: SinkCommitReceipt;
      try {
        const attempt = async () => {
          const sent = send();
          if (!sent) throw Object.assign(new Error(name), { code: "API_METHOD_UNAVAILABLE" });
          return sent;
        };
        try {
          receipt = await attempt();
        } catch (error) {
          // STALE_COMPOSITION: the client re-reads the revision on the retry.
          if (errorCode(error) !== "STALE_COMPOSITION") throw error;
          receipt = await attempt();
        }
      } catch (error) {
        if (job.kind === "lift" && errorCode(error) === "API_METHOD_UNAVAILABLE") return skip();
        console.warn(`[sink-landing] ${name} failed`, errorCode(error), error);
        if (job.kind === "lift") return;
        setMessage("The sink could not be moved.");
        await revert(job.before);
        return;
      }
      try {
        const state = await sinkClient.getCabinetsState();
        const sinkHostId = (receipt as { sinkHostId?: string | null }).sinkHostId ?? null;
        await onCommittedRef.current({ ...state, selectedCabinetId: sinkHostId ?? state.selectedCabinetId }, receipt);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "The sink moved; UI synchronisation failed.");
      }
    },
    [revert],
  );

  /**
   * One commit at a time. A landing that arrives during a commit is not committed: its ids are from before
   * the commit (which issues new ones), so the top goes back to Standard instead and `sink.pending` clears.
   * A lift that waited is dropped (stale ids too) with a warning; nothing is reverted.
   */
  const run = useCallback(
    async (job: Job) => {
      nextRef.current = job;
      if (runningRef.current) return;
      runningRef.current = true;
      try {
        nextRef.current = null;
        await commit(job);
        let waited: Job | null;
        // `as`: the ref is set by the action listener while the commit is awaited.
        while ((waited = nextRef.current as Job | null)) {
          nextRef.current = null;
          if (waited.kind === "lift") {
            console.warn("[sink-landing] a sink-lift arrived during a commit; its ids are stale, dropping it");
            continue;
          }
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

  // API lowerings of a hosted sink emit no 'sink-landing' (see `commitHostedSinkLanding`).
  useEffect(() => {
    if (!ready) return undefined;
    return registerHostedSinkLanding((cabinetId) => {
      // A commit in flight (e.g. the drag-end landing) clears the pending itself; a second one would revert.
      if (runningRef.current) return;
      setMessage(null);
      void run({ kind: "landing", cabinetId, fromCabinetId: null, before: null });
    });
  }, [ready, run]);

  useEffect(() => {
    if (!ready) return undefined;
    const api = getApi();
    if (!api) return undefined;
    return api.on("action", (action) => {
      if (action?.type === "sink-lift") {
        if (!action.fromCabinetId || !action.sinkLocalM) return;
        void run({ kind: "lift", fromCabinetId: action.fromCabinetId, sinkLocalM: { ...action.sinkLocalM } });
        return;
      }
      if (action?.type !== "sink-landing" || action.landing.status !== "fits") return;
      const { cabinetId, fromCabinetId } = action.landing;
      // `fromCabinetId: null` is a hosted sink landing on an SC (`landSink`).
      if (!cabinetId) return;
      const before = poseBeforeRef.current;
      poseBeforeRef.current = null;
      setMessage(null);
      void run({ kind: "landing", cabinetId, fromCabinetId: fromCabinetId ?? null, before });
    });
  }, [ready, getApi, run]);

  return { message, dismissMessage: () => setMessage(null) };
};
