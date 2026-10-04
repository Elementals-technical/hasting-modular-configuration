import type { ConfigurationDividerPort, DividerClearResult } from "@/entities/configuration";

/** Stand-in for the divider port: records every clear and answers as set. */

export type TestDividerPort = {
  port: ConfigurationDividerPort;
  calls: string[][];
  /** The next call answers with this instead of clearing. */
  answerNext(result: DividerClearResult): void;
};

export const createTestDividerPort = (): TestDividerPort => {
  const calls: string[][] = [];
  let pending: DividerClearResult | null = null;

  return {
    calls,
    port: {
      async clear(runtimeIds) {
        calls.push([...runtimeIds]);
        const next = pending;
        pending = null;
        return next ?? { status: "applied", cleared: runtimeIds.length };
      },
    },
    answerNext: (result) => {
      pending = result;
    },
  };
};
