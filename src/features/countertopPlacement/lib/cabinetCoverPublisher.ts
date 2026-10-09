import { isLiftedCountertop, type CabinetCoverSegment, type CountertopState } from "@/features/configuratorApi";
import type { CabinetCoverRuntime } from "@/shared/lib/cabinetCoverRuntime";

const CM_PER_M = 100;
const toCm = (metres: number) => Number((metres * CM_PER_M).toFixed(4));

type Options = {
  /** The settled covers of the scene; null when the build has none. */
  readCovers: () => Promise<CabinetCoverSegment[] | null>;
  publish: (covers: CabinetCoverRuntime | null) => void;
  onError?: (error: unknown) => void;
};

/**
 * Publishes the covers of a settled countertop pose: none unless the top is lifted (the scene covers
 * the cabinet tops then). One read at a time; a pose that arrives meanwhile is read once after it,
 * so a slow read never publishes an older pose over a newer one.
 */
export const createCabinetCoverPublisher = ({ readCovers, publish, onError }: Options) => {
  let running = false;
  let next: CountertopState | null | undefined;

  const read = async (state: CountertopState | null) => {
    if (!state || state.readiness !== "ready" || !state.compositionId || !isLiftedCountertop(state)) {
      publish(null);
      return;
    }
    const compositionId = state.compositionId;
    try {
      const segments = await readCovers();
      publish(
        segments === null
          ? null
          : {
              compositionId,
              covers: segments.map(({ widthM, cabinetIds }) => ({ widthCm: toCm(widthM), cabinetIds })),
            },
      );
    } catch (error) {
      publish(null);
      onError?.(error);
    }
  };

  return (state: CountertopState | null): void => {
    next = state;
    if (running) return;
    running = true;
    void (async () => {
      try {
        while (next !== undefined) {
          const current = next;
          next = undefined;
          await read(current);
        }
      } finally {
        running = false;
      }
    })();
  };
};
