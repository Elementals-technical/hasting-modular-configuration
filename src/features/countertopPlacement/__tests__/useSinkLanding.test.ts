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

const setup = (
  moveSink: SinkLandingClient["moveSink"] = vi.fn(async () => receipt),
  extra: Partial<Pick<SinkLandingClient, "liftSink" | "landSink">> = {},
) => {
  let emit: (action: CountertopAction) => void = () => undefined;
  const api = {
    on: vi.fn((_event: string, callback: (action: CountertopAction) => void) => {
      emit = callback;
      return () => undefined;
    }),
    setOffset: vi.fn(async () => undefined),
    resetOffset: vi.fn(async () => undefined),
  } as unknown as CountertopApi;
  const client = { moveSink, getCabinetsState: vi.fn(async () => cabinets), dispose: vi.fn(), ...extra };
  const onCommitted = vi.fn(async () => undefined);
  const hook = renderHook(() => useSinkLanding({ ready: true, getApi: () => api, onCommitted, createClient: () => client }));
  // The drag starts at x=0.1, then lifts the top and drops it over the side cabinet.
  act(() => setCountertopRuntimeState(state()));
  act(() => setCountertopRuntimeState(state({ dragging: true })));
  act(() => setCountertopRuntimeState(state({ dragging: true, offset: { x: 0.7, y: 0.2 } })));
  const land = async () => {
    act(() => {
      setCountertopRuntimeState(
        state({
          offset: { x: 0.65, y: 0 },
          sink: { owner: "countertop", shiftM: 0, landing: null, pending: { cabinetId: "ULH-side-cabinet-b", fromCabinetId: "ULH-sink-cabinet-a", status: "fits" } },
        }),
      );
      emit({
        type: "sink-landing",
        landing: { status: "fits", cabinetId: "ULH-side-cabinet-b", fromCabinetId: "ULH-sink-cabinet-a", reason: null, snapDxM: -0.05 },
      });
    });
    await flush();
  };
  const emitNow = async (action: CountertopAction) => {
    act(() => emit(action));
    await flush();
  };
  return { api, client, onCommitted, hook, land, emitNow };
};

// Lets the commit chain (moveSink -> getCabinetsState -> onCommitted / revert) settle.
const flush = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

afterEach(() => {
  setCountertopRuntimeState(null);
  vi.restoreAllMocks();
});

describe("useSinkLanding", () => {
  it("commits a 'fits' landing right away: moveSink(from, to), then syncs with the new sink host", async () => {
    const { client, onCommitted, hook, land, api } = setup();
    await land();

    expect(client.moveSink).toHaveBeenCalledWith("ULH-sink-cabinet-a", "ULH-side-cabinet-b");
    expect(client.getCabinetsState).toHaveBeenCalledOnce();
    expect(onCommitted).toHaveBeenCalledWith({ ...cabinets, selectedCabinetId: "ULH-sink-cabinet-n2" }, receipt);
    expect(api.setOffset).not.toHaveBeenCalled();
    expect(hook.result.current.message).toBeNull();
  });

  it("puts the top back at the drag-start pose and reports a failed commit", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const moveSink = vi.fn().mockRejectedValue(new ConfiguratorError("NOT_SIDE_CABINET", "no", { retryable: false }));
    const { onCommitted, hook, land, api } = setup(moveSink);
    await land();

    expect(moveSink).toHaveBeenCalledOnce();
    expect(onCommitted).not.toHaveBeenCalled();
    expect(api.setOffset).toHaveBeenCalledWith({ x: 0.1, y: 0 });
    expect(api.resetOffset).not.toHaveBeenCalled();
    expect(hook.result.current.message).toBe("The sink could not be moved.");
  });

  it("falls back to resetOffset when the drag-start pose cannot be restored", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const moveSink = vi.fn().mockRejectedValue(new ConfiguratorError("NOT_SIDE_CABINET", "no", { retryable: false }));
    const { hook, land, api } = setup(moveSink);
    vi.mocked(api.setOffset).mockRejectedValueOnce(new ConfiguratorError("COUNTERTOP_VERTICAL_LOCKED", "locked", { retryable: false }));
    await land();

    expect(api.setOffset).toHaveBeenCalledWith({ x: 0.1, y: 0 });
    expect(api.resetOffset).toHaveBeenCalledOnce();
    expect(hook.result.current.message).toBe("The sink could not be moved.");
  });

  it("retries STALE_COMPOSITION once", async () => {
    const moveSink = vi
      .fn()
      .mockRejectedValueOnce(new ConfiguratorError("STALE_COMPOSITION", "stale", { retryable: true }))
      .mockResolvedValueOnce(receipt);
    const { onCommitted, land, api } = setup(moveSink);
    await land();

    expect(moveSink).toHaveBeenCalledTimes(2);
    expect(onCommitted).toHaveBeenCalledOnce();
    expect(api.setOffset).not.toHaveBeenCalled();
  });

  it("does not start a second moveSink while a commit runs; a landing that waited (stale ids) resets the top", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    let inFlight = 0;
    let maxInFlight = 0;
    const releases: Array<() => void> = [];
    const moveSink = vi.fn(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise<void>((resolve) => releases.push(resolve));
      inFlight -= 1;
      return receipt;
    });
    const { onCommitted, hook, land, api } = setup(moveSink);
    await land();
    await land();
    await land();
    expect(moveSink).toHaveBeenCalledOnce();

    releases[0]();
    await flush();

    expect(moveSink).toHaveBeenCalledOnce();
    expect(maxInFlight).toBe(1);
    expect(onCommitted).toHaveBeenCalledOnce();
    expect(api.resetOffset).toHaveBeenCalledOnce();
    expect(api.setOffset).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledOnce();
    expect(hook.result.current.message).toBeNull();
  });

  it("lands a hosted sink (fromCabinetId null) through landSink, not moveSink", async () => {
    const landReceipt = { ...receipt, idMap: { "ULH-side-cabinet-b": "ULH-sink-cabinet-n3" }, sinkHostId: "ULH-sink-cabinet-n3" };
    const landSink = vi.fn(async () => landReceipt);
    const { client, onCommitted, emitNow, api } = setup(undefined, { landSink });
    await emitNow({
      type: "sink-landing",
      landing: { status: "fits", cabinetId: "ULH-side-cabinet-b", fromCabinetId: null, reason: null, snapDxM: 0 },
    });

    expect(landSink).toHaveBeenCalledWith("ULH-side-cabinet-b");
    expect(client.moveSink).not.toHaveBeenCalled();
    expect(onCommitted).toHaveBeenCalledWith({ ...cabinets, selectedCabinetId: "ULH-sink-cabinet-n3" }, landReceipt);
    expect(api.setOffset).not.toHaveBeenCalled();
  });

  it("commits a sink-lift action through liftSink and syncs the composition", async () => {
    const liftReceipt = {
      ...receipt,
      sinkHostId: undefined,
      idMap: { "ULH-sink-cabinet-a": "ULH-side-cabinet-n4" },
      sideCabinetId: "ULH-side-cabinet-n4",
    };
    const liftSink = vi.fn(async () => liftReceipt);
    const { client, onCommitted, emitNow, api } = setup(undefined, { liftSink });
    await emitNow({ type: "sink-lift", fromCabinetId: "ULH-sink-cabinet-a", sinkLocalM: { x: 0.1, y: 0, z: 0.02 } });

    expect(liftSink).toHaveBeenCalledWith("ULH-sink-cabinet-a", { x: 0.1, y: 0, z: 0.02 });
    expect(client.moveSink).not.toHaveBeenCalled();
    expect(onCommitted).toHaveBeenCalledWith(cabinets, liftReceipt);
    expect(api.setOffset).not.toHaveBeenCalled();
    expect(api.resetOffset).not.toHaveBeenCalled();
  });
});
