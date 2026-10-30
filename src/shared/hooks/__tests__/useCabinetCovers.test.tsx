// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { setCabinetCoverRuntime } from "@/shared/lib/cabinetCoverRuntime";
import { setCountertopRuntimeState } from "@/shared/lib/countertopRuntimeState";

import { useCabinetCovers } from "../useCabinetCovers";

afterEach(() => {
  cleanup();
  setCabinetCoverRuntime(null);
  setCountertopRuntimeState(null);
});

describe("Lower pricing input", () => {
  it("includes covers at zero Upper offset, updates on material-only changes, and excludes other compositions", () => {
    setCountertopRuntimeState({
      readiness: "ready",
      compositionId: "cabinets",
      productId: "top",
      offset: { x: 0, y: 0 },
    });
    const covers = [{ widthCm: 90, cabinetIds: ["cabinet"], materialId: "Colortech Bianco 10B" }];
    setCabinetCoverRuntime({ compositionId: "cabinets", covers });
    const { result } = renderHook(useCabinetCovers);
    expect(result.current).toEqual(covers);
    act(() =>
      setCabinetCoverRuntime({ compositionId: "cabinets", covers: [{ ...covers[0], materialId: "Blu Pavone A6 GL" }] }),
    );
    expect(result.current?.[0].materialId).toBe("Blu Pavone A6 GL");
    act(() => setCountertopRuntimeState({ readiness: "ready", compositionId: "other", productId: "top" }));
    expect(result.current).toBeNull();
  });
});
