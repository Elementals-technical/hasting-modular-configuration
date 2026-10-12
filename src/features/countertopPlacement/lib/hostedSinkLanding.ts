import type { CountertopApi } from "@/features/configuratorApi";

type Runner = (cabinetId: string) => void;
let runner: Runner | null = null;

/** `useSinkLanding` registers the commit (`landSink` + UI sync); returns the unregister. */
export const registerHostedSinkLanding = (next: Runner) => {
  runner = next;
  return () => {
    if (runner === next) runner = null;
  };
};

/**
 * 3D emits 'sink-landing' only on drag-end. After an API lowering (Standard / resetOffset / Cancel /
 * setOffset) of a hosted sink over an SC, the 'fits' pending is committed here (`landSink`), else it stays set.
 * Returns true when a landing was handed to `useSinkLanding`.
 */
export const commitHostedSinkLanding = async (api: CountertopApi): Promise<boolean> => {
  const sink = (await api.getState())?.sink;
  const pending = sink?.pending;
  if (!sink?.hosted || pending?.status !== "fits" || !pending.cabinetId || !runner) return false;
  runner(pending.cabinetId);
  return true;
};
