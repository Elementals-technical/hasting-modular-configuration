// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CabinetMoveSinkReceipt, CabinetsState, CountertopAction, CountertopApi, CountertopState } from "@/features/configuratorApi";
import type { CountertopRuleReason } from "@/features/configurator-rule-core/countertop";
import { ConfiguratorError } from "@/features/configuratorApi";
import { setCountertopRuntimeState } from "@/shared/lib/countertopRuntimeState";

import { commitHostedSinkLanding } from "../lib/hostedSinkLanding";
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

/** The top carries the Sink Base's sink, no lift committed yet: lowered beside the row at `offset`. */
const carried = (offset: { x: number; y: number }) =>
  state({
    offset,
    sink: {
      owner: "countertop",
      shiftM: 0.05,
      landing: { status: "none", cabinetId: null, fromCabinetId: "ULH-sink-cabinet-a", reason: "DETACHED", snapDxM: 0 },
      pending: null,
      hosted: false,
    },
  });
const sinkLocalM = { x: 0.1, y: 0, z: 0.02 };
const liftReceipt = {
  ...receipt,
  sinkHostId: undefined,
  idMap: { "ULH-sink-cabinet-a": "ULH-side-cabinet-n4" },
  sideCabinetId: "ULH-side-cabinet-n4",
};
const invalidInput = () => new ConfiguratorError("INVALID_INPUT", "INVALID_INPUT", { retryable: false });

const setup = (
  moveSink: SinkLandingClient["moveSink"] = vi.fn(async () => receipt),
  extra: Partial<Pick<SinkLandingClient, "liftSink" | "landSink">> = {},
  resolveLandingRefusal: (cabinetWidthCm: number) => CountertopRuleReason | null = () => null,
) => {
  let emit: (action: CountertopAction) => void = () => undefined;
  // What `countertop.getState()` answers: a move keeps the sink where it is, Standard puts it home.
  const scene = { current: state() };
  const api = {
    on: vi.fn((_event: string, callback: (action: CountertopAction) => void) => {
      emit = callback;
      return () => undefined;
    }),
    setOffset: vi.fn(async (offset: { x: number; y: number }) => {
      scene.current = { ...scene.current, offset };
    }),
    resetOffset: vi.fn(async () => {
      scene.current = state({ offset: { x: 0, y: 0 } });
    }),
    getState: vi.fn(() => scene.current),
    whenSettled: vi.fn(async () => scene.current),
  };
  const client = { moveSink, getCabinetsState: vi.fn(async () => cabinets), dispose: vi.fn(), ...extra };
  const onCommitted = vi.fn(async () => undefined);
  const hook = renderHook(() =>
    useSinkLanding({
      ready: true,
      getApi: () => api as unknown as CountertopApi,
      onCommitted,
      resolveLandingRefusal,
      createClient: () => client,
    }),
  );
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
  const lift = () => emitNow({ type: "sink-lift", fromCabinetId: "ULH-sink-cabinet-a", sinkLocalM });
  return { api, client, onCommitted, hook, land, emitNow, lift, scene };
};

// Lets the commit chain (moveSink -> getCabinetsState -> onCommitted / revert) settle.
const flush = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

afterEach(() => {
  cleanup();
  setCountertopRuntimeState(null);
  vi.restoreAllMocks();
});

describe("useSinkLanding", () => {
  it("commits a 'fits' landing right away: moveSink(from, to), then syncs with the new sink host", async () => {
    const { client, onCommitted, hook, land, api } = setup();
    await land();

    expect(client.moveSink).toHaveBeenCalledWith("ULH-sink-cabinet-a", "ULH-side-cabinet-b");
    // Once for the width the landing is judged by, once for the UI sync.
    expect(client.getCabinetsState).toHaveBeenCalledTimes(2);
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
    expect(hook.result.current.message).toEqual({ text: "The sink could not be moved." });
  });

  it("falls back to resetOffset when the drag-start pose cannot be restored", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const moveSink = vi.fn().mockRejectedValue(new ConfiguratorError("NOT_SIDE_CABINET", "no", { retryable: false }));
    const { hook, land, api } = setup(moveSink);
    vi.mocked(api.setOffset).mockRejectedValueOnce(new ConfiguratorError("COUNTERTOP_VERTICAL_LOCKED", "locked", { retryable: false }));
    await land();

    expect(api.setOffset).toHaveBeenCalledWith({ x: 0.1, y: 0 });
    expect(api.resetOffset).toHaveBeenCalledOnce();
    expect(hook.result.current.message).toEqual({ text: "The sink could not be moved." });
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
    const liftSink = vi.fn(async () => liftReceipt);
    const { client, onCommitted, lift, api } = setup(undefined, { liftSink });
    await lift();

    expect(liftSink).toHaveBeenCalledWith("ULH-sink-cabinet-a", sinkLocalM);
    expect(client.moveSink).not.toHaveBeenCalled();
    expect(onCommitted).toHaveBeenCalledWith(cabinets, liftReceipt);
    expect(api.setOffset).not.toHaveBeenCalled();
    expect(api.resetOffset).not.toHaveBeenCalled();
  });

  it("lifts a top lowered again in the same drag a little, commits the lift, then puts the top back", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const liftSink = vi.fn().mockRejectedValueOnce(invalidInput()).mockResolvedValueOnce(liftReceipt);
    const { onCommitted, lift, api, scene, hook } = setup(undefined, { liftSink });
    scene.current = carried({ x: -1.1, y: 0 });
    await lift();

    expect(liftSink).toHaveBeenCalledTimes(2);
    expect(liftSink).toHaveBeenLastCalledWith("ULH-sink-cabinet-a", sinkLocalM);
    expect(api.setOffset).toHaveBeenNthCalledWith(1, { x: -1.1, y: 0.02 }, { validation: "skip" });
    expect(api.setOffset).toHaveBeenNthCalledWith(2, { x: -1.1, y: 0 }, { validation: "skip" });
    // Lifted, then the lift, then lowered, then the UI follows.
    const [up, down] = api.setOffset.mock.invocationCallOrder;
    expect(up).toBeLessThan(liftSink.mock.invocationCallOrder[1]);
    expect(liftSink.mock.invocationCallOrder[1]).toBeLessThan(down);
    expect(down).toBeLessThan(onCommitted.mock.invocationCallOrder[0]);
    expect(onCommitted).toHaveBeenCalledWith(cabinets, liftReceipt);
    expect(api.resetOffset).not.toHaveBeenCalled();
    expect(hook.result.current.message).toBeNull();
  });

  it("puts a lifted top whose lift is refused back where its drag started, and says so", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const liftSink = vi.fn().mockRejectedValue(invalidInput());
    const { onCommitted, lift, api, scene, hook } = setup(undefined, { liftSink });
    scene.current = carried({ x: 0.7, y: 0.2 });
    // Back at the drag's start the sink is home again: nothing more to do.
    api.setOffset.mockImplementation(async (offset) => {
      scene.current = state({ offset });
    });
    await lift();

    expect(liftSink).toHaveBeenCalledOnce();
    expect(api.setOffset).toHaveBeenCalledOnce();
    expect(api.setOffset).toHaveBeenCalledWith({ x: 0.1, y: 0 });
    expect(api.resetOffset).not.toHaveBeenCalled();
    expect(onCommitted).not.toHaveBeenCalled();
    expect(hook.result.current.message).toEqual({ code: "countertop.sinkLiftFailed" });
  });

  it("resets a top whose lift fails after it was lifted a little and that still carries the sink", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const liftSink = vi.fn().mockRejectedValue(invalidInput());
    const { onCommitted, lift, api, scene, hook } = setup(undefined, { liftSink });
    scene.current = carried({ x: -1.1, y: 0 });
    await lift();

    expect(liftSink).toHaveBeenCalledTimes(2);
    expect(api.setOffset).toHaveBeenLastCalledWith({ x: 0.1, y: 0 });
    expect(api.resetOffset).toHaveBeenCalledOnce();
    expect(onCommitted).not.toHaveBeenCalled();
    expect(hook.result.current.message).toEqual({ code: "countertop.sinkLiftFailed" });
  });

  it("drops a sink-lift that waited for a commit, and puts the top back when it still carries the sink", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const releases: Array<() => void> = [];
    const moveSink = vi.fn(async () => {
      await new Promise<void>((resolve) => releases.push(resolve));
      return receipt;
    });
    const liftSink = vi.fn(async () => liftReceipt);
    const { lift, land, api, scene, hook } = setup(moveSink, { liftSink });
    await land();
    await lift();
    scene.current = carried({ x: -1.1, y: 0 });
    releases[0]();
    await flush();

    expect(liftSink).not.toHaveBeenCalled();
    expect(api.resetOffset).toHaveBeenCalledOnce();
    expect(hook.result.current.message).toEqual({ code: "countertop.sinkLiftFailed" });

    cleanup();
    const quiet = setup(
      vi.fn(async () => {
        await new Promise<void>((resolve) => releases.push(resolve));
        return receipt;
      }),
      { liftSink },
    );
    await quiet.land();
    await quiet.lift();
    releases[1]();
    await flush();
    expect(quiet.api.resetOffset).not.toHaveBeenCalled();
    expect(quiet.hook.result.current.message).toBeNull();
  });

  it("skips a sink-lift once, with one warning, where the runtime has no liftSink", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { lift, api, scene, hook, onCommitted } = setup();
    scene.current = carried({ x: -1.1, y: 0 });
    await lift();
    await lift();

    expect(warn).toHaveBeenCalledOnce();
    expect(api.setOffset).not.toHaveBeenCalled();
    expect(api.resetOffset).not.toHaveBeenCalled();
    expect(onCommitted).not.toHaveBeenCalled();
    expect(hook.result.current.message).toBeNull();
  });
});

describe("useSinkLanding judges a 'fits' landing by the collection's rules", () => {
  const refusal: CountertopRuleReason = {
    reasonCode: "countertop.sinkBaseBelowMin",
    reasonParams: { currentCm: 50, minCm: 60 },
    disabledReason: "Below the basin's minimum.",
  };
  const refusalMessage = { code: refusal.reasonCode, params: refusal.reasonParams, text: refusal.disabledReason };
  const belowSixtyCm = vi.fn((cabinetWidthCm: number) => (cabinetWidthCm < 60 ? refusal : null));
  const landReceipt = {
    ...receipt,
    idMap: { "ULH-side-cabinet-b": "ULH-sink-cabinet-n3" },
    sinkHostId: "ULH-sink-cabinet-n3",
  };
  const hostedLanding: CountertopAction = {
    type: "sink-landing",
    landing: { status: "fits", cabinetId: "ULH-side-cabinet-b", fromCabinetId: null, reason: null, snapDxM: 0 },
  };
  const hostedOverCabinet = (offset: { x: number; y: number }) =>
    state({
      offset,
      sink: {
        owner: "countertop",
        shiftM: 0,
        landing: null,
        pending: { cabinetId: "ULH-side-cabinet-b", fromCabinetId: null, status: "fits" },
        hosted: true,
      },
    });
  const withSideCabinet = (widthCm: number): CabinetsState =>
    ({
      ...cabinets,
      cabinets: [{ id: "ULH-side-cabinet-b", definitionId: "ULH-side-cabinet", selection: { Width: widthCm } }],
    }) as unknown as CabinetsState;
  const setupOver = (widthCm: number) => {
    const landSink = vi.fn(async () => landReceipt);
    const fixture = setup(undefined, { landSink }, belowSixtyCm);
    fixture.client.getCabinetsState.mockImplementation(async () => withSideCabinet(widthCm));
    return { ...fixture, landSink };
  };

  it("commits no hosted landing on a cabinet below the basin's minimum, puts the top back and says why", async () => {
    const { landSink, emitNow, api, hook, onCommitted } = setupOver(50);
    await emitNow(hostedLanding);

    expect(belowSixtyCm).toHaveBeenLastCalledWith(50);
    expect(landSink).not.toHaveBeenCalled();
    expect(onCommitted).not.toHaveBeenCalled();
    expect(api.setOffset).toHaveBeenCalledWith({ x: 0.1, y: 0 }, { validation: "skip" });
    expect(api.resetOffset).not.toHaveBeenCalled();
    expect(hook.result.current.message).toEqual(refusalMessage);
  });

  it("commits no SB sink move on such a cabinet either", async () => {
    const { client, land, api, hook, onCommitted } = setupOver(50);
    await land();

    expect(client.moveSink).not.toHaveBeenCalled();
    expect(onCommitted).not.toHaveBeenCalled();
    expect(api.setOffset).toHaveBeenCalledWith({ x: 0.1, y: 0 }, { validation: "skip" });
    expect(hook.result.current.message).toEqual(refusalMessage);
  });

  it("commits a landing on a cabinet the rules allow, judged by that cabinet's width", async () => {
    const { landSink, emitNow, api, hook, onCommitted } = setupOver(60);
    await emitNow(hostedLanding);

    expect(belowSixtyCm).toHaveBeenLastCalledWith(60);
    expect(landSink).toHaveBeenCalledWith("ULH-side-cabinet-b");
    expect(onCommitted).toHaveBeenCalledOnce();
    expect(api.setOffset).not.toHaveBeenCalled();
    expect(hook.result.current.message).toBeNull();
  });

  it("leaves a landing whose cabinet cannot be read to the commit, which reports a failure itself", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { client, landSink, emitNow, onCommitted } = setupOver(50);
    client.getCabinetsState.mockRejectedValueOnce(new ConfiguratorError("NOT_READY", "not ready", { retryable: true }));
    await emitNow(hostedLanding);

    expect(landSink).toHaveBeenCalledWith("ULH-side-cabinet-b");
    expect(onCommitted).toHaveBeenCalledOnce();
  });

  it("clears a refusal when the next landing goes through", async () => {
    const { client, landSink, emitNow, hook } = setupOver(50);
    await emitNow(hostedLanding);
    expect(hook.result.current.message).toEqual(refusalMessage);

    client.getCabinetsState.mockImplementation(async () => withSideCabinet(60));
    await emitNow(hostedLanding);

    expect(landSink).toHaveBeenCalledOnce();
    expect(hook.result.current.message).toBeNull();
  });

  describe("after an API lowering (Position ▸ Standard)", () => {
    const goBack = vi.fn(async () => undefined);

    it("answers false for a refused landing, with the top put back by the caller, who knows how it stood", async () => {
      goBack.mockClear();
      const { landSink, api, scene, hook } = setupOver(25);
      scene.current = hostedOverCabinet({ x: 0, y: 0 });
      let handed: boolean | undefined;
      await act(async () => {
        handed = await commitHostedSinkLanding(api as unknown as CountertopApi, goBack);
      });

      expect(handed).toBe(false);
      expect(landSink).not.toHaveBeenCalled();
      expect(goBack).toHaveBeenCalledOnce();
      expect(api.setOffset).not.toHaveBeenCalled();
      expect(api.resetOffset).not.toHaveBeenCalled();
      expect(hook.result.current.message).toEqual(refusalMessage);
    });

    it("sends a refused landing to Standard where the caller has no way back", async () => {
      const { landSink, api, scene, hook } = setupOver(25);
      scene.current = hostedOverCabinet({ x: 0, y: 0 });
      let handed: boolean | undefined;
      await act(async () => {
        handed = await commitHostedSinkLanding(api as unknown as CountertopApi);
      });

      expect(handed).toBe(false);
      expect(landSink).not.toHaveBeenCalled();
      expect(api.resetOffset).toHaveBeenCalledOnce();
      expect(hook.result.current.message).toEqual(refusalMessage);
    });

    it("answers true for a landing it hands on, and does not go back", async () => {
      goBack.mockClear();
      const { landSink, api, scene } = setupOver(60);
      scene.current = hostedOverCabinet({ x: 0, y: 0 });
      let handed: boolean | undefined;
      await act(async () => {
        handed = await commitHostedSinkLanding(api as unknown as CountertopApi, goBack);
      });
      await flush();

      expect(handed).toBe(true);
      expect(landSink).toHaveBeenCalledWith("ULH-side-cabinet-b");
      expect(goBack).not.toHaveBeenCalled();
      expect(api.setOffset).not.toHaveBeenCalled();
    });

    it("leaves a landing to the commit in flight, which clears the pending itself", async () => {
      const releases: Array<() => void> = [];
      const landSink = vi.fn(async () => {
        await new Promise<void>((resolve) => releases.push(resolve));
        return landReceipt;
      });
      const { client, emitNow, api, scene } = setup(undefined, { landSink }, belowSixtyCm);
      client.getCabinetsState.mockImplementation(async () => withSideCabinet(60));
      await emitNow(hostedLanding);
      scene.current = hostedOverCabinet({ x: 0, y: 0 });
      let handed: boolean | undefined;
      await act(async () => {
        handed = await commitHostedSinkLanding(api as unknown as CountertopApi, goBack);
      });

      expect(handed).toBe(true);
      expect(landSink).toHaveBeenCalledOnce();
      releases[0]();
      await flush();
    });
  });
});
