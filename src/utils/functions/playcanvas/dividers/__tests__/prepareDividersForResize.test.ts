import { beforeEach, describe, expect, it, vi } from "vitest";

import { getConfig } from "../../getConfig";
import { setConfig } from "../../setConfig";
import {
  preserveCabinetDividerConfigs,
  restoreCabinetDividerConfigs,
  type PreservedCabinetDividerConfig,
} from "../prepareDividersForResize";

vi.mock("../../getConfig", () => ({
  getConfig: vi.fn(),
}));

vi.mock("../../setConfig", () => ({
  setConfig: vi.fn(),
}));

const getConfigMock = vi.mocked(getConfig);
const setConfigMock = vi.mocked(setConfig);

describe("divider resize config preservation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preserves top and bottom drawer divider configs per cabinet", async () => {
    const topDrawerDividers = { zones: { main: { slots: [{ value: "A" }] } } };
    const botDrawerDividers = { zones: { main: { slots: [{ value: "B" }] } } };

    getConfigMock.mockResolvedValue({
      TopDrawerDividers: topDrawerDividers,
      BotDrawerDividers: botDrawerDividers,
      Depth: 46,
    });

    const preserved = await preserveCabinetDividerConfigs(["cab-1", "cab-1"]);

    expect(getConfigMock).toHaveBeenCalledTimes(1);
    expect(preserved).toHaveLength(1);

    const first = preserved.at(0);
    if (!first) throw new Error("Expected one preserved divider config");

    expect(first.cabinetId).toBe("cab-1");
    expect(first.config).toEqual({
      TopDrawerDividers: topDrawerDividers,
      BotDrawerDividers: botDrawerDividers,
    });
    expect(first.config.TopDrawerDividers).not.toBe(topDrawerDividers);
    expect(first.config.BotDrawerDividers).not.toBe(botDrawerDividers);
  });

  it("skips malformed or missing divider configs", async () => {
    getConfigMock.mockResolvedValue({
      TopDrawerDividers: null,
      BotDrawerDividers: [],
      Depth: 50,
    });

    await expect(preserveCabinetDividerConfigs(["cab-1"])).resolves.toEqual([]);
  });

  it("restores preserved divider configs through setConfig", async () => {
    const preserved: PreservedCabinetDividerConfig[] = [
      {
        cabinetId: "cab-1",
        config: {
          TopDrawerDividers: { zones: { main: { slots: [{ value: "C" }] } } },
        },
      },
    ];

    await restoreCabinetDividerConfigs(preserved);

    expect(setConfigMock).toHaveBeenCalledTimes(1);
    expect(setConfigMock).toHaveBeenCalledWith("cab-1", preserved[0]?.config);
  });
});
