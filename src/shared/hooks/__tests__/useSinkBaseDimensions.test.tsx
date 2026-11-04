// @vitest-environment jsdom
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useSinkBaseDimensions } from "../useSinkBaseDimensions";

const CONFIGS: Record<string, { Width: number; Depth: number }> = {
  "sink-base-80": { Width: 80, Depth: 52 },
  "side-120": { Width: 120, Depth: 40 },
  "sink-base-60": { Width: 60, Depth: 46 },
};

vi.mock("@/utils/functions/playcanvas/getOrderedProductIds", () => ({
  getOrderedProductIds: (fallback: string[] = []) => fallback,
}));
vi.mock("@/utils/functions/playcanvas/getConfig", () => ({
  getConfig: async (productId: string) => CONFIGS[productId],
}));

const isSinkBase = (runtimeId: string) => runtimeId.startsWith("sink-base");

const placed = (initialIds: string[]) =>
  renderHook(({ ids }) => useSinkBaseDimensions(ids, isSinkBase), { initialProps: { ids: initialIds } });

afterEach(cleanup);

describe("the Sink Bases on the scene", () => {
  it.each([
    ["last", ["sink-base-80", "side-120", "sink-base-60"]],
    ["first", ["sink-base-60", "side-120", "sink-base-80"]],
  ])("answer with the narrowest one's width and its own depth, standing %s", async (_position, ids) => {
    const { result } = placed(ids);

    await waitFor(() => expect(result.current).toEqual({ width: 60, depth: 46 }));
  });

  it.each([
    ["nothing is placed", []],
    ["only another cabinet is placed", ["side-120"]],
  ])("answer with nulls once %s", async (_placement, ids) => {
    const { result, rerender } = placed(["sink-base-80"]);
    await waitFor(() => expect(result.current.width).not.toBeNull());

    rerender({ ids });

    await waitFor(() => expect(result.current).toEqual({ width: null, depth: null }));
  });
});
