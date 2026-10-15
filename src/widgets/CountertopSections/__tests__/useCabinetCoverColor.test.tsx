// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CabinetCoverColorState, CabinetCoverConfigureResult } from "@/features/configuratorApi";

import { useCabinetCoverColor } from "../lib/useCabinetCoverColor";

const api = vi.hoisted(() => ({ read: vi.fn(), change: vi.fn() }));
vi.mock("@/features/configuratorApi", () => ({
  createConfiguratorBridge: () => ({ getCabinetCoverColorState: api.read, setCabinetCoverColor: api.change }),
}));
vi.mock("@/shared/hooks/usePlayCanvasReady", () => ({ usePlayCanvasReady: () => true }));

let state: CabinetCoverColorState;
beforeEach(() => {
  state = {
    compositionId: "cabinets",
    segments: [
      {
        productId: "cover",
        cabinetIds: ["cabinet"],
        widthM: 0.9,
        depthM: 0.44,
        thicknessM: 0.0127,
        materialId: "Rox Black TKQ",
      },
    ],
    requestedMaterialId: null,
  };
  api.read.mockReset().mockImplementation(async () => state);
  api.change.mockReset().mockImplementation(async (materialId: string): Promise<CabinetCoverConfigureResult> => {
    state = { ...state, segments: state.segments.map((segment) => ({ ...segment, materialId })) };
    return { status: "applied" };
  });
});
afterEach(cleanup);

describe("the Lower scene color", () => {
  it("reads the applied color and confirms a selection from the published scene", async () => {
    const { result } = renderHook(() => useCabinetCoverColor(true));
    await waitFor(() => expect(result.current.color).toBe("Rox Black TKQ"));
    await act(() => result.current.changeColor("Pulpis Chiaro TKH"));
    expect(api.change).toHaveBeenCalledWith("Pulpis Chiaro TKH");
    expect(result.current.color).toBe("Pulpis Chiaro TKH");
    expect(result.current.error).toBeNull();
  });

  it.each(["error", "unsupported", "applied"])(
    "keeps the actual color when %s does not repaint the cover",
    async (status) => {
      api.change.mockResolvedValue({ status });
      const { result } = renderHook(() => useCabinetCoverColor(true));
      await waitFor(() => expect(result.current.color).toBe("Rox Black TKQ"));
      await act(() => result.current.changeColor("Pulpis Chiaro TKH"));
      expect(result.current.color).toBe("Rox Black TKQ");
      expect(result.current.error).toBeTruthy();
      expect(result.current.processing).toBe(false);
    },
  );

  it("removes Lower when the scene no longer has cover segments", async () => {
    const { result } = renderHook(() => useCabinetCoverColor(true));
    await waitFor(() => expect(result.current.available).toBe(true));
    state = { ...state, segments: [] };
    await waitFor(() => expect(result.current.available).toBe(false), { timeout: 2000 });
  });

  it("does not read or mutate the feature outside the enabled collection/flow", async () => {
    const { result } = renderHook(() => useCabinetCoverColor(false));
    await act(() => result.current.changeColor("Pulpis Chiaro TKH"));
    expect(api.read).not.toHaveBeenCalled();
    expect(api.change).not.toHaveBeenCalled();
    expect(result.current.available).toBe(false);
  });
});
