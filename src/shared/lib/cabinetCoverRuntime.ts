/**
 * One cover slab the scene lays on bare cabinet tops (ULH): its width in centimetres and the scene ids
 * of the cabinets under it, whose depth the order spells it with.
 */
export type CabinetCoverSize = Readonly<{ widthCm: number; cabinetIds: readonly string[] }>;

/** The covers of a settled countertop pose, for the order. */
export type CabinetCoverRuntime = Readonly<{
  compositionId: string;
  covers: readonly CabinetCoverSize[];
}>;

type Listener = () => void;

let snapshot: CabinetCoverRuntime | null = null;
const listeners = new Set<Listener>();

export const getCabinetCoverRuntime = (): CabinetCoverRuntime | null => snapshot;

export const subscribeCabinetCoverRuntime = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const sameCovers = (left: CabinetCoverRuntime, right: CabinetCoverRuntime) =>
  left.compositionId === right.compositionId &&
  left.covers.length === right.covers.length &&
  left.covers.every(
    (cover, index) =>
      cover.widthCm === right.covers[index].widthCm &&
      cover.cabinetIds.join("|") === right.covers[index].cabinetIds.join("|"),
  );

/** Publishes the covers; an unchanged set leaves the snapshot, so the order is not rebuilt for nothing. */
export const setCabinetCoverRuntime = (next: CabinetCoverRuntime | null): void => {
  if (snapshot === next || (snapshot !== null && next !== null && sameCovers(snapshot, next))) return;

  snapshot =
    next === null
      ? null
      : Object.freeze({
          compositionId: next.compositionId,
          covers: Object.freeze(
            next.covers.map((c) => Object.freeze({ widthCm: c.widthCm, cabinetIds: Object.freeze([...c.cabinetIds]) })),
          ),
        });
  listeners.forEach((listener) => listener());
};
