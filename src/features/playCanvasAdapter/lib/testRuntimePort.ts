import type {
  ConfigurationRuntimePort,
  FailedRuntimeChange,
  RuntimeApplyResult,
  RuntimeChange,
  RuntimeContext,
  RuntimeFailureCode,
} from "@/entities/configuration";

/**
 * Stand-in for the runtimePort, so C can be built and tested without a scene.
 *
 * It records every set and context it receives and can answer with each of the five
 * statuses. It proves the contract and the order of what C hands over, nothing about
 * the real scene: that is verified against PlayCanvas in I06.
 */

type ChangePredicate = (change: RuntimeChange) => boolean;

export type TestRuntimePort = {
  port: ConfigurationRuntimePort;
  /** Every set passed to `apply`, in call order. */
  calls: RuntimeChange[][];
  /** The context of each call. */
  contexts: RuntimeContext[];
  /** Runtime ids resolved for cabinet and drawer targets, per call. */
  resolvedIds: (string | null)[][];
  /** While false, `isReady` is false and `apply` answers "not-ready". */
  setReady(ready: boolean): void;
  /** The next call fails the matching changes: "partial" if any other applied, else "failed". */
  failNext(predicate: ChangePredicate, message?: string, code?: RuntimeFailureCode): void;
  /** The next call answers "unsupported" for the matching changes and sends nothing. */
  rejectNext(predicate: ChangePredicate, detail?: string): void;
};

export const createTestRuntimePort = (): TestRuntimePort => {
  const calls: RuntimeChange[][] = [];
  const contexts: RuntimeContext[] = [];
  const resolvedIds: (string | null)[][] = [];

  let ready = true;
  let pendingFailure: { predicate: ChangePredicate; message: string; code: RuntimeFailureCode } | null = null;
  let pendingRejection: { predicate: ChangePredicate; detail: string } | null = null;

  const port: ConfigurationRuntimePort = {
    isReady: () => ready,

    async apply<T extends RuntimeChange>(
      changes: readonly T[],
      context: RuntimeContext,
    ): Promise<RuntimeApplyResult<T>> {
      calls.push([...changes]);
      contexts.push(context);
      resolvedIds.push(
        changes.map((change) =>
          change.target.scope === "cabinet" || change.target.scope === "drawer"
            ? context.resolveRuntimeId(change.target.cabinetId)
            : null,
        ),
      );

      if (!ready) return { status: "not-ready" };

      const rejection = pendingRejection;
      pendingRejection = null;

      if (rejection) {
        const unsupported = changes.filter(rejection.predicate);

        if (unsupported.length > 0) {
          return {
            status: "unsupported",
            unsupported: unsupported.map((change) => ({ change, reason: "unbound", detail: rejection.detail })),
          };
        }
      }

      const failure = pendingFailure;
      pendingFailure = null;

      if (!failure) return { status: "applied", applied: [...changes] };

      const applied = changes.filter((change) => !failure.predicate(change));
      const failed: FailedRuntimeChange<T>[] = changes
        .filter(failure.predicate)
        .map((change) => ({ change, code: failure.code, message: failure.message }));

      if (failed.length === 0) return { status: "applied", applied };

      return applied.length > 0 ? { status: "partial", applied, failed } : { status: "failed", failed };
    },
  };

  return {
    port,
    calls,
    contexts,
    resolvedIds,
    setReady(next) {
      ready = next;
    },
    failNext(predicate, message = "runtime rejected the change", code = "scene-rejected") {
      pendingFailure = { predicate, message, code };
    },
    rejectNext(predicate, detail = "no scene translation") {
      pendingRejection = { predicate, detail };
    },
  };
};
