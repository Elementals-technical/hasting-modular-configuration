import { useCallback, useEffect, useRef, useState } from "react";

import {
  classifyCountertopError,
  createConfiguratorClient,
  isCarriedWithoutHost,
  isLiftedCountertop,
  type CabinetLandSinkReceipt,
  type CabinetLiftSinkReceipt,
  type CabinetMoveSinkReceipt,
  type CabinetsState,
  type ConfiguratorClient,
  type CountertopApi,
  type CountertopSinkLocalM,
} from "@/features/configuratorApi";
import { getCountertopRuntimeState, subscribeCountertopRuntimeState } from "@/shared/lib/countertopRuntimeState";
import type { Reason } from "@/shared/lib/reasonText";

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
/**
 * The top carried an SB sink off the cabinets (`liftSink`: the SB becomes an SC) and the pose its drag started
 * from. A Sink Base must not stay under a remote top: a lift that does not go through puts the top back.
 */
type Lift = { kind: "lift"; fromCabinetId: string; sinkLocalM: CountertopSinkLocalM; before: Pose | null };
type Job = Landing | Lift;

/**
 * How far above the pose it rests at a top is lifted for `liftSink`, which takes a lifted top only
 * (`SpatialOffsetM.y` above 0.01 m) though the scene also announces a lift for a top lowered again.
 */
const LIFT_FROM_REST_M = 0.02;

const SINK_LIFT_FAILED: Reason = { code: "countertop.sinkLiftFailed" };

const errorCode = (error: unknown) =>
  typeof error === "object" && error !== null && typeof (error as { code?: unknown }).code === "string"
    ? (error as { code: string }).code
    : null;

/**
 * SB <-> SC sink move (phase 1 §6d): every 'fits' `sink-landing` action commits `cabinets.moveSink` right away
 * (the SC under the sink becomes the SB, the old SB becomes an SC) and syncs the UI. A failed commit puts the
 * top back where the drag started, so `sink.pending` never stays set by the UI. One commit runs at a time.
 * A hosted sink (after a `sink-lift` -> `cabinets.liftSink`) lands through `cabinets.landSink` instead.
 * A lift is never left half done: the SB under a top that carries its sink becomes an SC, or the top goes back.
 * A missing `liftSink` (API_METHOD_UNAVAILABLE) is skipped with one warning; a missing move/land reverts.
 */
export const useSinkLanding = ({ ready, getApi, onCommitted, createClient }: Options) => {
  const [message, setMessage] = useState<Reason | null>(null);
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
      setMessage({ text: "The countertop could not go back." });
    }
  }, []);

  /** The top carries the sink of a Sink Base that is still one (no lift went through). */
  const carriesWithoutHost = useCallback(async () => {
    const api = getApiRef.current();
    try {
      return api !== null && isCarriedWithoutHost(await api.getState());
    } catch {
      return false;
    }
  }, []);

  /** A lift that did not go through: the top goes back, so its sink does not hang over a Sink Base. */
  const dropCarriedSink = useCallback(
    async (before: Pose | null) => {
      await revert(before);
      // The pose the drag started from may carry the sink too (a top lifted before): Standard does not.
      if (await carriesWithoutHost()) {
        try {
          await getApiRef.current()?.resetOffset();
        } catch (error) {
          console.warn("[sink-landing] resetOffset failed", error);
        }
      }
      setMessage(SINK_LIFT_FAILED);
    },
    [carriesWithoutHost, revert],
  );

  /**
   * The scene announces a lift also for a top lowered again in the same drag (the sink beside the row), but
   * `liftSink` takes only a lifted top (INVALID_INPUT). Such a top is lifted a little, the lift committed,
   * and the top put back where the user left it. Null when the top is not such a top or the lift fails again.
   */
  const liftFromRest = useCallback(async (send: () => Promise<SinkCommitReceipt>) => {
    const api = getApiRef.current();
    if (!api) return null;
    let at: Pose;
    let receipt: SinkCommitReceipt;
    try {
      const rest = await api.getState();
      if (isLiftedCountertop(rest) || !isCarriedWithoutHost(rest)) return null;
      at = { x: rest.offset?.x ?? 0, y: rest.offset?.y ?? 0 };
      // A pose the drop already took, only higher: not judged again.
      await api.setOffset({ x: at.x, y: Math.max(at.y, 0) + LIFT_FROM_REST_M }, { validation: "skip" });
      if (!isLiftedCountertop(await api.getState())) return null;
      receipt = await send();
    } catch (error) {
      console.warn("[sink-landing] liftSink failed after lifting the top", errorCode(error), error);
      return null;
    }
    const lower = async () => {
      await api.setOffset(at, { validation: "skip" });
    };
    try {
      await api.whenSettled();
      await lower();
    } catch (error) {
      // The scene rebuilt the composition: the top binds again before it moves.
      if (classifyCountertopError(error).kind !== "not-ready") {
        // A top that hosts its sink 2 cm higher is still a consistent one.
        console.warn("[sink-landing] the top could not be lowered after liftSink", error);
      } else {
        await api.whenSettled();
        await lower().catch((again: unknown) =>
          console.warn("[sink-landing] the top could not be lowered after liftSink", again),
        );
      }
    }
    return receipt;
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
      const attempt = async () => {
        const sent = send();
        if (!sent) throw Object.assign(new Error(name), { code: "API_METHOD_UNAVAILABLE" });
        return sent;
      };
      const attemptTwice = async () => {
        try {
          return await attempt();
        } catch (error) {
          // STALE_COMPOSITION: the client re-reads the revision on the retry.
          if (errorCode(error) !== "STALE_COMPOSITION") throw error;
          return attempt();
        }
      };
      let receipt: SinkCommitReceipt;
      try {
        receipt = await attemptTwice();
      } catch (error) {
        if (job.kind === "lift" && errorCode(error) === "API_METHOD_UNAVAILABLE") return skip();
        const lifted =
          job.kind === "lift" && errorCode(error) === "INVALID_INPUT" ? await liftFromRest(attemptTwice) : null;
        if (lifted) {
          receipt = lifted;
        } else {
          console.warn(`[sink-landing] ${name} failed`, errorCode(error), error);
          if (job.kind === "lift") return dropCarriedSink(job.before);
          setMessage({ text: "The sink could not be moved." });
          await revert(job.before);
          return;
        }
      }
      try {
        const state = await sinkClient.getCabinetsState();
        const sinkHostId = (receipt as { sinkHostId?: string | null }).sinkHostId ?? null;
        await onCommittedRef.current({ ...state, selectedCabinetId: sinkHostId ?? state.selectedCabinetId }, receipt);
      } catch (error) {
        setMessage({ text: error instanceof Error ? error.message : "The sink moved; UI synchronisation failed." });
      }
    },
    [dropCarriedSink, liftFromRest, revert],
  );

  /**
   * One commit at a time. A landing that arrives during a commit is not committed: its ids are from before
   * the commit (which issues new ones), so the top goes back to Standard instead and `sink.pending` clears.
   * A lift that waited is dropped (stale ids too) with a warning; a sink the top still carries over its Sink
   * Base afterwards goes back down with the top (the scene announces a lift once).
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
            if (await carriesWithoutHost()) await dropCarriedSink(null);
            continue;
          }
          console.warn("[sink-landing] a landing arrived during a commit; its ids are stale, resetting the offset");
          await revert(null);
        }
      } finally {
        runningRef.current = false;
      }
    },
    [carriesWithoutHost, commit, dropCarriedSink, revert],
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
        const before = poseBeforeRef.current;
        poseBeforeRef.current = null;
        void run({ kind: "lift", fromCabinetId: action.fromCabinetId, sinkLocalM: { ...action.sinkLocalM }, before });
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
