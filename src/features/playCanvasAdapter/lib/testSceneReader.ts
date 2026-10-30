import type { CabinetDimensions, ConfigurationSceneReader } from "@/entities/configuration";

/**
 * Stand-in for the scene reader, so C's sync can be tested without a scene. It answers with
 * the state it was given; what the real scene returns is verified in I06.
 */

export type TestSceneReader = {
  reader: ConfigurationSceneReader;
  /** The runtime ids of every read, in call order. */
  calls: string[][];
  /** The order and sizes the scene holds from now on. */
  setScene(order: string[], dimensions: Record<string, CabinetDimensions>): void;
  /** While false, every read answers "not-ready". */
  setReady(ready: boolean): void;
};

export const createTestSceneReader = (): TestSceneReader => {
  const calls: string[][] = [];

  let ready = true;
  let order: string[] = [];
  let dimensionsById: Record<string, CabinetDimensions> = {};

  const reader: ConfigurationSceneReader = {
    async read(runtimeIds) {
      calls.push([...runtimeIds]);

      if (!ready) return { status: "not-ready" };

      return {
        status: "ready",
        order: [...order],
        cabinets: runtimeIds.flatMap((runtimeId) => {
          const dimensions = dimensionsById[runtimeId];
          return dimensions ? [{ runtimeId, dimensions: { ...dimensions } }] : [];
        }),
      };
    },
  };

  return {
    reader,
    calls,
    setScene(nextOrder, nextDimensions) {
      order = [...nextOrder];
      dimensionsById = { ...nextDimensions };
    },
    setReady(next) {
      ready = next;
    },
  };
};
