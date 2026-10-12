import { type CabinetCoverSegment, type CountertopState } from "@/features/configuratorApi";
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
 * Publishes the actual settled covers, including lower rows with a zero-offset Upper.
 * One read at a time; newer poses and cleanup invalidate outstanding reads.
 */
export const createCabinetCoverPublisher = ({ readCovers, publish, onError }: Options) => {
  let running = false;
  let next: CountertopState | null | undefined;
  let generation = 0;

  const read = async (state: CountertopState | null) => {
    const version = generation;
    if (!state || state.readiness !== "ready" || !state.compositionId) {
      publish(null);
      return;
    }
    const compositionId = state.compositionId;
    try {
      const segments = await readCovers();
      if (version !== generation || next !== undefined) return;
      publish(
        segments === null
          ? null
          : {
              compositionId,
              covers: segments.map(({ widthM, cabinetIds, materialId }) => ({
                widthCm: toCm(widthM),
                cabinetIds,
                materialId,
              })),
            },
      );
    } catch (error) {
      if (version !== generation || next !== undefined) return;
      publish(null);
      onError?.(error);
    }
  };

  const enqueue = (state: CountertopState | null): void => {
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
  return Object.assign(enqueue, {
    reset: () => {
      ++generation;
      next = undefined;
    },
  });
};
