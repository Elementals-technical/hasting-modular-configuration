import { describe, expect, it, vi } from "vitest";

import { normalizeProductConfigSnapshot } from "../normalizeProductConfigSnapshot";

vi.mock("@/utils/functions/playcanvas/getDimensionTool", () => ({ getDimensionTool: () => null }));

const selectedDimensions = { width: 60, height: 53, depth: 46 };

describe("normalizeProductConfigSnapshot", () => {
  it("keeps each cabinet's own size instead of the shared selection", () => {
    const low = normalizeProductConfigSnapshot({
      id: "rt-a",
      raw: { Width: 60, Height: 50, Depth: 46 },
      selectedDimensions,
    });
    const high = normalizeProductConfigSnapshot({
      id: "rt-b",
      raw: { Width: 80, Height: 56, Depth: 50.5 },
      selectedDimensions,
    });

    expect([low.Height, low.Depth]).toEqual([50, 46]);
    expect([high.Height, high.Depth]).toEqual([56, 50.5]);
  });

  it("falls back to the shared selection when the scene reports no size", () => {
    const snapshot = normalizeProductConfigSnapshot({ id: "rt-a", raw: {}, selectedDimensions });

    expect([snapshot.Height, snapshot.Depth]).toEqual([53, 46]);
  });
});
