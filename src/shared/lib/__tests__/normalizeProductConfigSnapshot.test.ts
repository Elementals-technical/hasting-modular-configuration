import { describe, expect, it, vi } from "vitest";

import { normalizeProductConfigSnapshot } from "../normalizeProductConfigSnapshot";

vi.mock("@/utils/functions/playcanvas/getDimensionTool", () => ({ getDimensionTool: () => null }));

describe("normalizeProductConfigSnapshot", () => {
  it("keeps each cabinet's own size from its scene config", () => {
    const recordedDimensions = { width: 60, height: 53, depth: 46 };
    const low = normalizeProductConfigSnapshot({
      id: "rt-a",
      raw: { Width: 60, Height: 50, Depth: 46 },
      recordedDimensions,
    });
    const high = normalizeProductConfigSnapshot({
      id: "rt-b",
      raw: { Width: 80, Height: 56, Depth: 50.5 },
      recordedDimensions,
    });

    expect([low.Height, low.Depth]).toEqual([50, 46]);
    expect([high.Height, high.Depth]).toEqual([56, 50.5]);
  });

  it("falls back to the size recorded for that cabinet, not to another cabinet's", () => {
    const low = normalizeProductConfigSnapshot({
      id: "rt-a",
      raw: {},
      recordedDimensions: { width: 60, height: 50, depth: 46 },
    });
    const high = normalizeProductConfigSnapshot({
      id: "rt-b",
      raw: {},
      recordedDimensions: { width: 80, height: 56, depth: 50.5 },
    });

    expect([low.Width, low.Height, low.Depth]).toEqual([60, 50, 46]);
    expect([high.Width, high.Height, high.Depth]).toEqual([80, 56, 50.5]);
  });

  it("has no size when neither the scene nor the record has one", () => {
    const snapshot = normalizeProductConfigSnapshot({ id: "rt-a", raw: {}, recordedDimensions: null });

    expect([snapshot.Width, snapshot.Height, snapshot.Depth]).toEqual([null, null, null]);
  });
});
