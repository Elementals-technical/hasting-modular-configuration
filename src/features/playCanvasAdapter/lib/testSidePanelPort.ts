import type { ConfigurationSidePanelPort, SidePanelApplyResult, SidePanelPlacement } from "@/entities/configuration";

/** Stand-in for the side panel port: records every set of placements and answers as set. */

export type TestSidePanelPort = {
  port: ConfigurationSidePanelPort;
  calls: { placements: SidePanelPlacement[]; cabinetCount?: number }[];
  /** The next call answers with this instead of applying. */
  answerNext(result: SidePanelApplyResult): void;
};

export const createTestSidePanelPort = (): TestSidePanelPort => {
  const calls: TestSidePanelPort["calls"] = [];
  let pending: SidePanelApplyResult | null = null;

  return {
    calls,
    port: {
      async apply(placements, cabinetCount) {
        calls.push({ placements: [...placements], cabinetCount });
        const next = pending;
        pending = null;
        return next ?? { status: "applied" };
      },
    },
    answerNext: (result) => {
      pending = result;
    },
  };
};
