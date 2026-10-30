// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CountertopState } from "@/features/configuratorApi";
import { setCountertopRuntimeState } from "@/shared/lib/countertopRuntimeState";

import { useCountertopLength } from "../hooks/useCountertopLength";

const sidePanels = vi.hoisted(() => ({ left: "inactive", right: "inactive" }));
const sceneWidth = vi.hoisted(() => ({ current: null as number | null }));

vi.mock("@/shared/hooks/store/redux", () => ({
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector({
      rootStateUI: {
        product: { productOptions: { SidePanelLeft: sidePanels.left, SidePanelRight: sidePanels.right } },
      },
    }),
}));
vi.mock("@/shared/hooks/useSceneTotalWidth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/hooks/useSceneTotalWidth")>()),
  useSceneTotalWidth: () => sceneWidth.current,
}));

const countertop = (autoLength: number | null, patch: Partial<CountertopState> = {}): CountertopState => ({
  readiness: "ready",
  productId: "Top_Solid-1",
  compositionId: "c-1",
  autoLength,
  ...patch,
});

const lengthWith = (state: CountertopState | null) => {
  act(() => setCountertopRuntimeState(state));
  return renderHook(() => useCountertopLength(["cabinet-a", "cabinet-b"])).result.current;
};

afterEach(() => {
  cleanup();
  act(() => setCountertopRuntimeState(null));
  sidePanels.left = "inactive";
  sidePanels.right = "inactive";
  sceneWidth.current = null;
});

describe("useCountertopLength", () => {
  it("is the run the countertop covers, not the cabinets under cabinet covers", () => {
    // Urban Low Height #46: the countertop covers the 120 cm Sink Base; the composition spans 255 cm.
    sceneWidth.current = 255;
    expect(lengthWith(countertop(1.2))).toEqual({ withSidePanels: 120, cabinetsOnly: 120 });
  });

  it("drops the 0.05 cm the scene leaves at every joint, and float noise", () => {
    expect(lengthWith(countertop(1.6005)).withSidePanels).toBe(160);
    // 13 cabinets of 25 cm: 12 joints.
    expect(lengthWith(countertop(3.256)).withSidePanels).toBe(325);
    // 0.58 * 100 is 57.99999999999999.
    expect(lengthWith(countertop(0.58)).withSidePanels).toBe(58);
  });

  it("counts the side panels in, and leaves them out of the cabinets' own length", () => {
    sidePanels.left = "active";
    sidePanels.right = "active";
    expect(lengthWith(countertop(1.2205))).toEqual({ withSidePanels: 122, cabinetsOnly: 120 });
  });

  it("is the composition's width while the scene has no countertop", () => {
    sceneWidth.current = 160;
    sidePanels.left = "active";
    expect(lengthWith(null)).toEqual({ withSidePanels: 161, cabinetsOnly: 160 });
    expect(lengthWith(countertop(1.2, { productId: null }))).toEqual({ withSidePanels: 161, cabinetsOnly: 160 });
    expect(lengthWith(countertop(null))).toEqual({ withSidePanels: 161, cabinetsOnly: 160 });
  });

  it("keeps the auto length while the scene waits, and ignores a custom length", () => {
    expect(lengthWith(countertop(1.2, { readiness: "waiting" })).withSidePanels).toBe(120);
    expect(lengthWith(countertop(1.2, { customLength: 1.5, size: { length: 1.5 } })).withSidePanels).toBe(120);
  });
});
