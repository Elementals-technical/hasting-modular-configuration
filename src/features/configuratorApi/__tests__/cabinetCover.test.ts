import { describe, expect, it } from "vitest";

import { createConfiguratorBridge } from "../bridge";
import { parseCabinetCoverSegments } from "../cabinetCover";
import type { ConfiguratorApi } from "../types";

// `ConfiguratorAPI.cabinetCover.getState()` of a lifted top over one 24″ ULH cabinet (recorded in the browser).
const state = {
  compositionId: "cabinets",
  service: {
    phase: "idle",
    entries: [
      {
        productId: "Cabinet_Cover-92be-1-2",
        segment: {
          cabinetIds: ["ULH-side-cabinet-6dae"],
          xMinM: -0.29999997094272857,
          xMaxM: 0.30000005289912934,
          zMinM: -5.954898903426376e-7,
          zMaxM: 0.4397086495556003,
          thicknessM: 0.0127,
          materialId: "Rox Black TKQ",
        },
      },
    ],
  },
};

const bridgeFor = (api: Partial<ConfiguratorApi> | null) =>
  createConfiguratorBridge({ getApi: () => api as ConfiguratorApi | null });

describe("cabinet covers", () => {
  it("reads each slab's width and depth in metres", () => {
    const [segment] = parseCabinetCoverSegments(state);

    expect(segment.productId).toBe("Cabinet_Cover-92be-1-2");
    expect(segment.cabinetIds).toEqual(["ULH-side-cabinet-6dae"]);
    expect(segment.widthM).toBeCloseTo(0.6, 6);
    expect(segment.depthM).toBeCloseTo(0.4397, 4);
  });

  it("leaves out what the runtime does not report as a sized slab", () => {
    expect(parseCabinetCoverSegments(null)).toEqual([]);
    expect(parseCabinetCoverSegments({ service: null })).toEqual([]);
    expect(
      parseCabinetCoverSegments({
        service: {
          entries: [
            null,
            { productId: 1, segment: {} },
            { productId: "a", segment: { xMinM: 0, xMaxM: "1", zMinM: 0, zMaxM: 1 } },
            { productId: "b", segment: { xMinM: 1, xMaxM: 1, zMinM: 0, zMaxM: 1 } },
          ],
        },
      }),
    ).toEqual([]);
  });

  it("waits for the covers to settle, and resolves null for a build without them", async () => {
    const calls: string[] = [];
    const cabinetCover = {
      whenSettled: async () => void calls.push("whenSettled"),
      getState: () => (calls.push("getState"), state),
    };
    const bridge = bridgeFor({ cabinetCover });

    expect(await bridge.getCabinetCovers?.()).toHaveLength(1);
    expect(calls).toEqual(["whenSettled", "getState"]);

    const older = bridgeFor({});
    expect(await older.getCabinetCovers?.()).toBeNull();
  });
});
