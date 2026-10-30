export type CountertopRuntimeSize = Readonly<{
  productId: string;
  compositionId: string;
  lengthCm: number;
  /** Lengths of the tandem tops (clones of a thin top on sink bases set apart), each priced as a countertop. */
  tandemLengthsCm?: readonly number[];
}>;

const sameLengths = (left: readonly number[] = [], right: readonly number[] = []) =>
  left.length === right.length && left.every((length, index) => length === right[index]);

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
      snapshot.lengthCm === next.lengthCm &&
      sameLengths(snapshot.tandemLengthsCm, next.tandemLengthsCm))
  ) {
    return;
  }

  snapshot =
    next === null
      ? null
      : Object.freeze({ ...next, ...(next.tandemLengthsCm ? { tandemLengthsCm: Object.freeze([...next.tandemLengthsCm]) } : {}) });
  listeners.forEach((listener) => listener());
};
