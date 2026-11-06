import type { CountertopApi } from "@/features/configuratorApi";

/** Puts the top back as it stood before an API lowering, for a landing the rules refuse. */
export type HostedLandingGoBack = () => Promise<unknown>;
/** Answers whether the landing was handed on; false: the rules refused it and the top went back. */
type Runner = (cabinetId: string, goBack: HostedLandingGoBack | null) => Promise<boolean>;
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
 * `goBack` is how the top returns if the rules refuse the landing; without it, it goes to Standard.
 * Returns true when a landing was handed to `useSinkLanding`.
 */
export const commitHostedSinkLanding = async (
  api: CountertopApi,
  goBack: HostedLandingGoBack | null = null,
): Promise<boolean> => {
  const sink = (await api.getState())?.sink;
  const pending = sink?.pending;
  if (!sink?.hosted || pending?.status !== "fits" || !pending.cabinetId || !runner) return false;
  return runner(pending.cabinetId, goBack);
};
