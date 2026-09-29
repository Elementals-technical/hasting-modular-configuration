export type CountertopRuntimeSize = Readonly<{
  productId: string;
  compositionId: string;
  lengthCm: number;
}>;

type CountertopRuntimeSizeListener = () => void;

let snapshot: CountertopRuntimeSize | null = null;
const listeners = new Set<CountertopRuntimeSizeListener>();

export const getCountertopRuntimeSize = (): CountertopRuntimeSize | null => snapshot;

export const subscribeCountertopRuntimeSize = (listener: CountertopRuntimeSizeListener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Publishes an applied runtime top size. Invalid/unchanged values do not disturb the current snapshot. */
export const setCountertopRuntimeSize = (next: CountertopRuntimeSize | null): void => {
  if (next !== null && (typeof next.lengthCm !== "number" || !Number.isFinite(next.lengthCm) || next.lengthCm <= 0)) {
    return;
  }

  if (
    snapshot === next ||
    (snapshot !== null &&
      next !== null &&
      snapshot.productId === next.productId &&
      snapshot.compositionId === next.compositionId &&
      snapshot.lengthCm === next.lengthCm)
  ) {
    return;
  }

  snapshot = next === null ? null : Object.freeze({ ...next });
  listeners.forEach((listener) => listener());
};
