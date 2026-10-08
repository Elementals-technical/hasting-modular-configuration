// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CountertopApi, CountertopState } from "@/features/configuratorApi";
import { setCountertopRuntimeState } from "@/shared/lib/countertopRuntimeState";

import { resolveVerticalLock, useCountertopVerticalLock } from "../lib/useCountertopVerticalLock";
import { CountertopVerticalLockNotice } from "../ui/CountertopVerticalLockNotice";

const thickness = vi.hoisted(() => ({ current: "" }));
vi.mock("@/shared/hooks/store/redux", () => ({ useAppSelector: () => thickness.current }));

const readyState = (patch: Partial<CountertopState> = {}): CountertopState => ({
  readiness: "ready",
  productId: "top-1",
  compositionId: "c-1",
  offset: { x: 0.1, y: 0 },
  verticalLocked: false,
  ...patch,
});

const fakeApi = () => {
  const api = {
    setVerticalLocked: vi.fn((locked: boolean) => {
      const next = readyState({ verticalLocked: locked });
      act(() => setCountertopRuntimeState(next));
      return next;
    }),
    setOffset: vi.fn(),
    resetOffset: vi.fn(),
  };
  return { api, getApi: () => api as unknown as CountertopApi };
};

afterEach(() => {
  cleanup();
  act(() => setCountertopRuntimeState(null));
  thickness.current = "";
});

describe("resolveVerticalLock", () => {
  it("locks 4″ only, from the option first and the runtime metres as a fallback", () => {
    expect(resolveVerticalLock("4", null)).toBe(true);
    expect(resolveVerticalLock("5-1/8", 0.1016)).toBe(false);
    expect(resolveVerticalLock("5-1/2", null)).toBe(false);
    expect(resolveVerticalLock("", 0.1016)).toBe(true);
    expect(resolveVerticalLock("", 0.130175)).toBe(false);
    expect(resolveVerticalLock(undefined, null)).toBeNull();
  });
});

describe("useCountertopVerticalLock", () => {
  it("locks a 4″ top once it is ready, unlocks on another thickness, and skips calls already in effect", async () => {
    const { api, getApi } = fakeApi();
    thickness.current = "4";
    act(() => setCountertopRuntimeState(readyState({ readiness: "loading" })));
    const { rerender } = renderHook(() => useCountertopVerticalLock(getApi, true));
    expect(api.setVerticalLocked).not.toHaveBeenCalled();

    act(() => setCountertopRuntimeState(readyState()));
    await waitFor(() => expect(api.setVerticalLocked).toHaveBeenCalledWith(true));
    rerender();
    act(() => setCountertopRuntimeState(readyState({ verticalLocked: true, offset: { x: 0.2, y: 0 } })));
    expect(api.setVerticalLocked).toHaveBeenCalledTimes(1);

    thickness.current = "5-1/8";
    rerender();
    await waitFor(() => expect(api.setVerticalLocked).toHaveBeenLastCalledWith(false));
    expect(api.setVerticalLocked).toHaveBeenCalledTimes(2);
  });

  it("does nothing on a runtime without setVerticalLocked", () => {
    thickness.current = "4";
    act(() => setCountertopRuntimeState(readyState()));
    const getApi = vi.fn(() => ({ setOffset: vi.fn() }) as unknown as CountertopApi);
    expect(() => renderHook(() => useCountertopVerticalLock(getApi, true))).not.toThrow();
  });
});

describe("CountertopVerticalLockNotice", () => {
  it("shows only while the lock is violated; Lower drops y to 0 at the same x, Reset resets", async () => {
    const { api, getApi } = fakeApi();
    act(() => setCountertopRuntimeState(readyState({ verticalLocked: true })));
    const { container } = render(<CountertopVerticalLockNotice getApi={getApi} />);
    expect(container.firstChild).toBeNull();

    act(() =>
      setCountertopRuntimeState(
        readyState({ verticalLocked: true, verticalLockViolated: true, offset: { x: 0.25, y: 0.3 } }),
      ),
    );
    expect(screen.getByText("This countertop can't be lifted. Lower it or reset its position.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Lower" }));
    expect(api.setOffset).not.toHaveBeenCalled(); // deferred to a microtask
    await waitFor(() => expect(api.setOffset).toHaveBeenCalledWith({ x: 0.25, y: 0 }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Reset" }).hasAttribute("disabled")).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    await waitFor(() => expect(api.resetOffset).toHaveBeenCalledTimes(1));
  });

  it("reports a rejected action through the classifier", async () => {
    const { api, getApi } = fakeApi();
    api.setOffset.mockImplementation(() => {
      throw Object.assign(new Error("lift"), { code: "COUNTERTOP_POSE_INVALID", reasons: ["TRAP_KEEPOUT"] });
    });
    act(() => setCountertopRuntimeState(readyState({ verticalLocked: true, verticalLockViolated: true })));
    render(<CountertopVerticalLockNotice getApi={getApi} />);
    fireEvent.click(screen.getByRole("button", { name: "Lower" }));
    expect((await screen.findByRole("alert")).textContent).not.toBe("");
  });
});
