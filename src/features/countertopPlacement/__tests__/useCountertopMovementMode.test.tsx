// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CountertopApi, CountertopState } from "@/features/configuratorApi";
import { getCountertopRuntimeState, setCountertopRuntimeState } from "@/shared/lib/countertopRuntimeState";

import { buildCountertopPositionItems } from "../lib/positionMenuItems";
import { resolveMovementMode, useCountertopMovementMode } from "../lib/useCountertopMovementMode";
import { COUNTERTOP_MODE_NOTICE_MS, CountertopModeNotice } from "../ui/CountertopModeNotice";

const thickness = vi.hoisted(() => ({ current: "" }));
vi.mock("@/shared/hooks/store/redux", () => ({ useAppSelector: () => thickness.current }));

const readyState = (patch: Partial<CountertopState> = {}): CountertopState => ({
  readiness: "ready",
  productId: "top-1",
  compositionId: "c-1",
  offset: { x: 0, y: 0 },
  verticalLocked: false,
  ...patch,
});
const patchState = (patch: Partial<CountertopState>) =>
  act(() => setCountertopRuntimeState({ ...(getCountertopRuntimeState() ?? readyState()), ...patch }));

const fakeApi = () => {
  const api = {
    setVerticalLocked: vi.fn((locked: boolean) => patchState({ verticalLocked: locked })),
    setOffset: vi.fn((offset: { x: number; y: number }) => patchState({ offset })),
    resetOffset: vi.fn(() => patchState({ offset: { x: 0, y: 0 }, sink: undefined })),
    getState: vi.fn(() => getCountertopRuntimeState()),
  };
  return { api, getApi: () => api as unknown as CountertopApi };
};
const poseInvalid = () => Object.assign(new Error("gap"), { code: "COUNTERTOP_POSE_INVALID", reasons: ["SINK_LANDING_GAP"] });

/** Mounts with `from` (first load, no notice), then switches the thickness to `to`. */
const switchThickness = (
  from: string,
  to: string,
  state: Partial<CountertopState>,
  setup: (api: ReturnType<typeof fakeApi>["api"]) => void = () => {},
) => {
  const { api, getApi } = fakeApi();
  setup(api);
  thickness.current = from;
  act(() => setCountertopRuntimeState(readyState(state)));
  const hook = renderHook(() => useCountertopMovementMode(getApi, true));
  expect(hook.result.current.notice).toBeNull();
  thickness.current = to;
  hook.rerender();
  return { api, hook };
};

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  act(() => setCountertopRuntimeState(null));
  thickness.current = "";
});

describe("resolveMovementMode", () => {
  it("thin → none, 4″ → offset, 2.4 / 5⅛ / 5½ → free, unknown → null; the option first, metres as a fallback", () => {
    for (const thin of ["0.375", "0.4", "0.5"]) expect(resolveMovementMode(thin, 0.1016)).toBe("none");
    expect(resolveMovementMode("4", null)).toBe("offset");
    for (const free of ["2.4", "2.375", "2.5", "5-1/8", "5.125", "5-1/2"]) expect(resolveMovementMode(free, 0.1016)).toBe("free");
    expect(resolveMovementMode("", 0.1016)).toBe("offset");
    expect(resolveMovementMode("", 0.130175)).toBe("free");
    expect(resolveMovementMode("3", null)).toBeNull();
    expect(resolveMovementMode(undefined, null)).toBeNull();
  });
});

describe("useCountertopMovementMode", () => {
  it("keeps setVerticalLocked in step through 4 → 5½ → 4 → 5½, even after a failed call", async () => {
    const { api, hook } = switchThickness("4", "5-1/2", {});
    await waitFor(() => expect(api.setVerticalLocked).toHaveBeenLastCalledWith(false));
    expect(api.setVerticalLocked).toHaveBeenNthCalledWith(1, true);
    api.setVerticalLocked.mockImplementationOnce(() => {
      throw new Error("boom");
    });
    thickness.current = "4";
    hook.rerender();
    await waitFor(() => expect(api.setVerticalLocked).toHaveBeenCalledTimes(3));
    thickness.current = "5-1/2";
    hook.rerender();
    thickness.current = "4";
    hook.rerender();
    await waitFor(() => expect(api.setVerticalLocked).toHaveBeenLastCalledWith(true));
    expect(getCountertopRuntimeState()?.verticalLocked).toBe(true);
  });

  it("lowers a lifted top switched to 4″ at the same x, and says so", async () => {
    const { api, hook } = switchThickness("5-1/2", "4", { offset: { x: 0.25, y: 0.3 } });
    await waitFor(() => expect(api.setOffset).toHaveBeenCalledWith({ x: 0.25, y: 0 }));
    await waitFor(() => expect(hook.result.current.notice?.codes).toEqual(["countertop.mode.offset", "countertop.mode.lowered"]));
    expect(api.resetOffset).not.toHaveBeenCalled();
  });

  it("resets to Standard when lowering is rejected (POSE_INVALID) or lands over another sink cabinet", async () => {
    const rejected = switchThickness("5-1/2", "4", { offset: { x: 0.2, y: 0.3 } }, (api) =>
      api.setOffset.mockImplementation(() => {
        throw poseInvalid();
      }),
    );
    await waitFor(() => expect(rejected.api.resetOffset).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(rejected.hook.result.current.notice?.codes).toContain("countertop.mode.reset"));
    cleanup();

    const pending = { cabinetId: "sc", fromCabinetId: "sb", status: "fits" as const };
    const landed = switchThickness("5-1/2", "4", { offset: { x: 0.2, y: 0.3 } }, (api) =>
      api.setOffset.mockImplementation((offset) =>
        patchState({ offset, sink: { owner: "countertop", shiftM: 0, landing: null, pending } }),
      ),
    );
    await waitFor(() => expect(landed.api.resetOffset).toHaveBeenCalledTimes(1));
  });

  it("resets a moved top switched to a thin one, but waits for the drag to end", async () => {
    const { api } = switchThickness("5-1/2", "0.5", { offset: { x: 0.2, y: 0 }, dragging: true });
    await Promise.resolve();
    expect(api.resetOffset).not.toHaveBeenCalled();
    patchState({ dragging: false });
    await waitFor(() => expect(api.resetOffset).toHaveBeenCalledTimes(1));
    expect(api.setOffset).not.toHaveBeenCalled();
  });

  it("corrects a violation that comes back in the same mode again, without repeating the switch text", async () => {
    const { api, hook } = switchThickness("5-1/2", "4", { offset: { x: 0.1, y: 0 } });
    await waitFor(() => expect(hook.result.current.notice?.codes).toEqual(["countertop.mode.offset"]));
    // e.g. Cancel of a D&D session restores a lifted snapshot.
    patchState({ offset: { x: 0.1, y: 0.3 } });
    await waitFor(() => expect(api.setOffset).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(hook.result.current.notice?.codes).toEqual(["countertop.mode.lowered"]));
    patchState({ offset: { x: 0.2, y: 0.3 } });
    await waitFor(() => expect(api.setOffset).toHaveBeenCalledTimes(2));
    expect(api.setOffset).toHaveBeenLastCalledWith({ x: 0.2, y: 0 });
  });

  it("another top / composition / preset with another mode is not a switch: no notice", async () => {
    const { api, getApi } = fakeApi();
    thickness.current = "5-1/2";
    act(() => setCountertopRuntimeState(readyState()));
    const hook = renderHook(() => useCountertopMovementMode(getApi, true));
    thickness.current = "4";
    patchState({ productId: "top-2" });
    await waitFor(() => expect(api.setVerticalLocked).toHaveBeenLastCalledWith(true));
    expect(hook.result.current.mode).toBe("offset");
    expect(hook.result.current.notice).toBeNull();
  });

  it("reports a failed reset once, without retrying", async () => {
    const { api, hook } = switchThickness("5-1/2", "4", { offset: { x: 0, y: 0.3 } }, (fake) => {
      fake.setOffset.mockImplementation(() => {
        throw poseInvalid();
      });
      fake.resetOffset.mockImplementation(() => {
        throw Object.assign(new Error("nope"), { code: "COUNTERTOP_INVALID_INPUT" });
      });
    });
    await waitFor(() => expect(hook.result.current.notice?.failure?.text).toBe("nope"));
    hook.rerender();
    expect(api.resetOffset).toHaveBeenCalledTimes(1);
  });
});

describe("CountertopModeNotice and the Position menu", () => {
  it("joins the texts, closes on × and by itself; no Position item for a top that never moves", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    const notice = { codes: ["countertop.mode.free"], failure: null };
    render(<CountertopModeNotice notice={notice} onDismiss={onDismiss} />);
    expect(screen.getByText("This countertop can be moved and lifted.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    act(() => vi.advanceTimersByTime(COUNTERTOP_MODE_NOTICE_MS));
    expect(onDismiss).toHaveBeenCalledTimes(2);

    const actions = { onStandard: vi.fn(), onDragDrop: vi.fn() };
    const status = { supported: true, available: true, active: false };
    expect(buildCountertopPositionItems(status, actions, "none")).toEqual([]);
    expect(buildCountertopPositionItems(status, actions, null)).toHaveLength(1);
    expect(buildCountertopPositionItems(status, actions, "offset")).toHaveLength(1);
  });
});
