import type { StableCabinetKey } from "@/entities/configuration";

import type { ConfigurationRuntimePort, PlannedChange, RuntimeApplyResult } from "../model/types";

/**
 * Stand-in for I.
 *
 * It records the agreed set and the resolved runtime ids, so tests can prove the order
 * and the content of what C hands over. It proves nothing about the real scene — the
 * actual PlayCanvas support is verified in I06/I07.
 */

export type TestRuntimePort = {
  port: ConfigurationRuntimePort;
  /** Every set passed to `apply`, in call order. */
  calls: PlannedChange[][];
  /** Runtime ids the port was able to resolve, per call. */
  resolvedIds: (string | null)[][];
  /** Make the next call report a failure for changes matching the predicate. */
  failNext(predicate: (change: PlannedChange) => boolean, message?: string): void;
};

export const createTestRuntimePort = (): TestRuntimePort => {
  const calls: PlannedChange[][] = [];
  const resolvedIds: (string | null)[][] = [];

  let pendingFailure: { predicate: (change: PlannedChange) => boolean; message: string } | null = null;

  const port: ConfigurationRuntimePort = {
    async apply(
      changes: PlannedChange[],
      resolveRuntimeId: (cabinetId: StableCabinetKey) => string | null,
    ): Promise<RuntimeApplyResult> {
      calls.push(changes);
      resolvedIds.push(
        changes.map((change) =>
          change.target.scope === "cabinet" || change.target.scope === "drawer"
            ? resolveRuntimeId(change.target.cabinetId)
            : null,
        ),
      );

      const failure = pendingFailure;
      pendingFailure = null;

      if (!failure) {
        return { applied: changes, failed: [] };
      }

      return {
        applied: changes.filter((change) => !failure.predicate(change)),
        failed: changes
          .filter((change) => failure.predicate(change))
          .map((change) => ({ change, message: failure.message })),
      };
    },
  };

  return {
    port,
    calls,
    resolvedIds,
    failNext(predicate, message = "runtime rejected the change") {
      pendingFailure = { predicate, message };
    },
  };
};
