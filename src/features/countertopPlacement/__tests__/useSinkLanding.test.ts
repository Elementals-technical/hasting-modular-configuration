// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CabinetMoveSinkReceipt, CabinetsState, CountertopAction, CountertopApi, CountertopState } from "@/features/configuratorApi";
import { ConfiguratorError } from "@/features/configuratorApi";
import { setCountertopRuntimeState } from "@/shared/lib/countertopRuntimeState";

import { useSinkLanding, type SinkLandingClient } from "../lib/useSinkLanding";

const state = (overrides: Partial<CountertopState> = {}): CountertopState => ({
  readiness: "ready",
  productId: "top-1",
  offset: { x: 0.1, y: 0 },
  dragging: false,
  sink: { owner: "cabinet", shiftM: 0, landing: null, pending: null },
  ...overrides,
});

const receipt = {
  requestId: "r",
  compositionRevision: 3,
  addedProductIds: [],
  updatedProductIds: [],
  removedProductIds: [],
  selectedCabinetId: null,
  idMap: { "ULH-sink-cabinet-a": "ULH-side-cabinet-n1", "ULH-side-cabinet-b": "ULH-sink-cabinet-n2" },
  sinkHostId: "ULH-sink-cabinet-n2",
} as unknown as CabinetMoveSinkReceipt;

const cabinets: CabinetsState = { cabinets: [], connections: [], selectedCabinetId: null } as unknown as CabinetsState;

const setup = (moveSink: SinkLandingClient["moveSink"] = vi.fn(async () => receipt)) => {
  let emit: (action: CountertopAction) => void = () => undefined;
  const api = {
    on: vi.fn((_event: string, callback: (action: CountertopAction) => void) => {
      emit = callback;
      return () => undefined;
    }),
    setOffset: vi.fn(async () => undefined),
    resetOffset: vi.fn(async () => undefined),
  } as unknown as CountertopApi;
  const client = { moveSink, getCabinetsState: vi.fn(async () => cabinets), dispose: vi.fn() };
  const onCommitted = vi.fn(async () => undefined);
  const hook = renderHook(() => useSinkLanding({ ready: true, getApi: () => api, onCommitted, createClient: () => client }));
  // The drag starts at x=0.1, then lifts the top and drops it over the side cabinet.
  act(() => setCountertopRuntimeState(state()));
  act(() => setCountertopRuntimeState(state({ dragging: true })));
  act(() => setCountertopRuntimeState(state({ dragging: true, offset: { x: 0.7, y: 0.2 } })));
  const land = () =>
    act(() => {
      setCountertopRuntimeState(
        state({
          offset: { x: 0.65, y: 0 },
          sink: { owner: "countertop", shiftM: 0, landing: null, pending: { cabinetId: "ULH-side-cabinet-b", fromCabinetId: "ULH-sink-cabinet-a" } },
        }),
      );
      emit({
        type: "sink-landing",
        landing: { status: "fits", cabinetId: "ULH-side-cabinet-b", fromCabinetId: "ULH-sink-cabinet-a", reason: null, snapDxM: -0.05 },
      });
    });
  return { api, client, onCommitted, hook, land };
};

afterEach(() => {
  setCountertopRuntimeState(null);
  vi.restoreAllMocks();
});

describe("useSinkLanding", () => {
  it("asks on a 'fits' landing, commits moveSink(from, to) and syncs with the new ids", async () => {
    const { client, onCommitted, hook, land, api } = setup();
    land();
    expect(hook.result.current.prompt).toEqual({ cabinetId: "ULH-side-cabinet-b", fromCabinetId: "ULH-sink-cabinet-a" });

    await act(() => hook.result.current.confirm());

    expect(client.moveSink).toHaveBeenCalledWith("ULH-sink-cabinet-a", "ULH-side-cabinet-b");
    expect(client.getCabinetsState).toHaveBeenCalledOnce();
    expect(onCommitted).toHaveBeenCalledWith({ ...cabinets, selectedCabinetId: "ULH-sink-cabinet-n2" }, receipt);
    expect(api.setOffset).not.toHaveBeenCalled();
    expect(hook.result.current.prompt).toBeNull();
  });

  it("declines by putting the top back at the drag-start pose", async () => {
    const { client, hook, land, api } = setup();
    land();
    await act(() => hook.result.current.decline());
    // A second decision (e.g. the popup's close after Confirm) is ignored.
    await act(() => hook.result.current.confirm());

    expect(api.setOffset).toHaveBeenCalledWith({ x: 0.1, y: 0 });
    expect(client.moveSink).not.toHaveBeenCalled();
    expect(hook.result.current.prompt).toBeNull();
  });

  it("retries STALE_COMPOSITION once, then reverts the pose and reports a failed commit", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const moveSink = vi
      .fn()
      .mockRejectedValueOnce(new ConfiguratorError("STALE_COMPOSITION", "stale", { retryable: true }))
      .mockRejectedValueOnce(new ConfiguratorError("NOT_SIDE_CABINET", "no", { retryable: false }));
    const { onCommitted, hook, land, api } = setup(moveSink);
    land();
    await act(() => hook.result.current.confirm());

    expect(moveSink).toHaveBeenCalledTimes(2);
    expect(onCommitted).not.toHaveBeenCalled();
    expect(api.setOffset).toHaveBeenCalledWith({ x: 0.1, y: 0 });
    expect(hook.result.current.message).toBe("The sink could not be moved.");
  });

  it("falls back to resetOffset when the drag-start pose cannot be restored", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { hook, land, api } = setup();
    vi.mocked(api.setOffset).mockRejectedValueOnce(new ConfiguratorError("COUNTERTOP_VERTICAL_LOCKED", "locked", { retryable: false }));
    land();
    await act(() => hook.result.current.decline());

    expect(api.setOffset).toHaveBeenCalledWith({ x: 0.1, y: 0 });
    expect(api.resetOffset).toHaveBeenCalledOnce();
    expect(hook.result.current.message).toBeNull();
  });

  it("closes the prompt when the pending landing goes away by itself", () => {
    const { hook, land } = setup();
    land();
    act(() => setCountertopRuntimeState(state({ offset: { x: 0.3, y: 0.2 } })));
    expect(hook.result.current.prompt).toBeNull();
  });
});
