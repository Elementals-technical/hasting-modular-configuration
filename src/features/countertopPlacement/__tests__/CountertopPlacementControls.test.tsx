// @vitest-environment jsdom
import { createRef } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CountertopPlacementControls,
  type CountertopApi,
  type CountertopState,
  type CountertopPlacementHandle,
} from "../ui/CountertopPlacementControls";

const base: CountertopState = {
  readiness: "ready",
  productId: "top-1",
  compositionId: "composition-1",
  attached: true,
  offset: { x: 0, y: 0 },
  canResize: false,
  dragEnabled: false,
  customLength: null,
  autoLength: 1.2,
  size: { length: 1.2, depth: 0.46 },
  thickness: 0.012,
};
const fixture = (initial: CountertopState = base) => {
  let current = structuredClone(initial);
  const listeners = new Map<string, (event: { type?: string; reason?: string; state: CountertopState }) => void>();
  const stop = vi.fn();
  const publish = (next: CountertopState) => {
    current = next;
    listeners.get("change")?.({ reason: "state", state: current });
  };
  const api = {
    getState: vi.fn(() => structuredClone(current)),
    setDragEnabled: vi.fn((enabled: boolean) => publish({ ...current, dragEnabled: enabled })),
    setOffset: vi.fn(async (offset: { x: number; y: number }) => {
      const attached = offset.x === 0 && offset.y === 0;
      publish({
        ...current,
        offset: { ...offset },
        attached,
        canResize: !attached,
        ...(attached ? { customLength: null, size: { ...current.size, length: current.autoLength } } : {}),
      });
      return current;
    }),
    resetOffset: vi.fn(async () => {
      await api.setOffset({ x: 0, y: 0 });
      return current;
    }),
    setSize: vi.fn(async (size: { length: number | null }) => {
      publish({
        ...current,
        customLength: size.length,
        size: { ...current.size, length: size.length ?? current.autoLength },
      });
      return current;
    }),
    whenSettled: vi.fn(async () => structuredClone(current)),
    on: vi.fn(
      (
        event: string,
        callback: (event: { type?: string; reason?: string; state: CountertopState }) => void,
        options?: { emitCurrent: boolean },
      ) => {
        listeners.set(event, callback);
        if (options?.emitCurrent) callback({ reason: "current", state: current });
        return () => {
          stop(event);
          listeners.delete(event);
        };
      },
    ),
  };
  return {
    api,
    getApi: () => api as CountertopApi,
    stop,
    state: () => current,
    emit: (next: CountertopState) => act(() => publish(next)),
    action: () => act(() => listeners.get("action")?.({ type: "edit-size", state: current })),
  };
};
const open = async () => {
  const opener = (await screen.findByRole("button", { name: "Countertop: Position & Size" })) as HTMLButtonElement;
  await waitFor(() => expect(opener.disabled).toBe(false));
  fireEvent.click(opener);
  const apply = (await screen.findByRole("button", { name: "Apply countertop" })) as HTMLButtonElement;
  await waitFor(() => expect(apply.disabled).toBe(false));
};
const previewPosition = async (x: string, y: string) => {
  fireEvent.change(screen.getByLabelText("Offset X (m)"), { target: { value: x } });
  fireEvent.change(screen.getByLabelText("Offset Y (m)"), { target: { value: y } });
  fireEvent.click(screen.getByRole("button", { name: "Preview position" }));
  await waitFor(() =>
    expect((screen.getByRole("button", { name: "Apply countertop" }) as HTMLButtonElement).disabled).toBe(false),
  );
};
afterEach(cleanup);

describe("Countertop snapshot positioning", () => {
  it("previews layout position/length, preserves typed length during drag and applies settled state", async () => {
    const { api, getApi, emit, state } = fixture();
    const committed = vi.fn();
    const availability = vi.fn();
    const selected = vi.fn(() =>
      expect(availability).toHaveBeenLastCalledWith({ supported: true, available: false, editing: true }),
    );
    render(
      <CountertopPlacementControls
        ready
        disabled={false}
        getApi={getApi}
        onCommitted={committed}
        onAvailabilityChange={availability}
        onSelect={selected}
      />,
    );
    await open();
    expect(selected).toHaveBeenCalledWith("top-1");
    expect(api.setDragEnabled).toHaveBeenCalledWith(true);
    await previewPosition("0.2", "0.1");
    fireEvent.change(screen.getByLabelText("Length (m)"), { target: { value: "1.6" } });
    emit({ ...state(), offset: { x: 0.3, y: 0.1 } });
    expect((screen.getByLabelText("Length (m)") as HTMLInputElement).value).toBe("1.6");
    fireEvent.click(screen.getByRole("button", { name: "Preview size" }));
    await waitFor(() => expect(api.setSize).toHaveBeenCalledExactlyOnceWith({ length: 1.6 }));
    await waitFor(() =>
      expect((screen.getByRole("button", { name: "Apply countertop" }) as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.click(screen.getByRole("button", { name: "Apply countertop" }));
    await waitFor(() => expect(committed).toHaveBeenCalledOnce());
    expect(committed.mock.calls[0][0]).toMatchObject({ productId: "top-1", customLength: 1.6, dragEnabled: false });
    expect(api.whenSettled).toHaveBeenCalled();
    expect(await screen.findByRole("button", { name: "Countertop: Position & Size" })).toBeTruthy();
    expect(availability).toHaveBeenLastCalledWith({ supported: true, available: true, editing: false });
  });

  it("cancels an originally attached top using resetOffset and restores auto length", async () => {
    const { api, getApi, state } = fixture();
    render(<CountertopPlacementControls ready disabled={false} getApi={getApi} />);
    await open();
    await previewPosition("0.2", "0.1");
    fireEvent.click(screen.getByRole("button", { name: "Cancel countertop" }));
    await screen.findByRole("button", { name: "Countertop: Position & Size" });
    expect(api.resetOffset).toHaveBeenCalledOnce();
    expect(api.setSize).toHaveBeenLastCalledWith({ length: null });
    expect(state()).toMatchObject({ attached: true, offset: { x: 0, y: 0 }, customLength: null, dragEnabled: false });
  });

  it("restores a moved top's original customLength and dragEnabled after Standard/Layout switching", async () => {
    const moved = {
      ...base,
      attached: false,
      canResize: true,
      offset: { x: 0.35, y: 0.1 },
      customLength: 1.5,
      dragEnabled: true,
      size: { length: 1.5, depth: 0.46 },
    };
    const { api, getApi, state } = fixture(moved);
    render(<CountertopPlacementControls ready disabled={false} getApi={getApi} />);
    await open();
    fireEvent.change(screen.getByLabelText("Countertop positioning mode"), { target: { value: "standard" } });
    await waitFor(() => expect(state().attached).toBe(true));
    await waitFor(() =>
      expect((screen.getByRole("button", { name: "Cancel countertop" }) as HTMLButtonElement).disabled).toBe(false),
    );
    expect(state().customLength).toBeNull();
    expect(state().dragEnabled).toBe(false);
    fireEvent.change(screen.getByLabelText("Countertop positioning mode"), { target: { value: "layout" } });
    await waitFor(() => expect(state().dragEnabled).toBe(true));
    await waitFor(() =>
      expect((screen.getByRole("button", { name: "Cancel countertop" }) as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel countertop" }));
    await screen.findByRole("button", { name: "Countertop: Position & Size" });
    expect(api.setOffset).toHaveBeenLastCalledWith({ x: 0.35, y: 0.1 });
    expect(api.setSize).toHaveBeenLastCalledWith({ length: 1.5 });
    expect(state().dragEnabled).toBe(true);
  });

  it("restores moved auto length as null rather than a numeric effective size", async () => {
    const { api, getApi } = fixture({
      ...base,
      attached: false,
      canResize: true,
      offset: { x: 0.4, y: 0 },
      customLength: null,
    });
    render(<CountertopPlacementControls ready disabled={false} getApi={getApi} />);
    await open();
    fireEvent.change(screen.getByLabelText("Length (m)"), { target: { value: "1.8" } });
    fireEvent.click(screen.getByRole("button", { name: "Preview size" }));
    await waitFor(() => expect(api.setSize).toHaveBeenCalledWith({ length: 1.8 }));
    await waitFor(() =>
      expect((screen.getByRole("button", { name: "Cancel countertop" }) as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel countertop" }));
    await screen.findByRole("button", { name: "Countertop: Position & Size" });
    expect(api.setSize).toHaveBeenLastCalledWith({ length: null });
  });

  it("validates positive finite length and exposes depth/thickness only as read-only values", async () => {
    const { api, getApi } = fixture({ ...base, attached: false, canResize: true, offset: { x: 0.2, y: 0 } });
    render(<CountertopPlacementControls ready disabled={false} getApi={getApi} />);
    await open();
    for (const value of ["", "0", "-1"]) {
      fireEvent.change(screen.getByLabelText("Length (m)"), { target: { value } });
      expect((screen.getByRole("button", { name: "Preview size" }) as HTMLButtonElement).disabled).toBe(true);
    }
    expect((screen.getByLabelText("Depth (m)") as HTMLInputElement).readOnly).toBe(true);
    expect((screen.getByLabelText("Thickness (m)") as HTMLInputElement).readOnly).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Auto length" }));
    fireEvent.click(screen.getByRole("button", { name: "Preview size" }));
    await waitFor(() => expect(api.setSize).toHaveBeenCalledExactlyOnceWith({ length: null }));
  });

  it("keeps editing locked and sends no commands to an externally replaced top", async () => {
    const { api, getApi, emit, state } = fixture();
    const availability = vi.fn();
    render(<CountertopPlacementControls ready disabled={false} getApi={getApi} onAvailabilityChange={availability} />);
    await open();
    const writes = api.setDragEnabled.mock.calls.length;
    emit({ ...state(), productId: "replacement-top" });
    expect(screen.getByRole("alert").textContent).toContain("composition changed");
    expect((screen.getByRole("button", { name: "Apply countertop" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Cancel countertop" }) as HTMLButtonElement).disabled).toBe(true);
    expect(api.setDragEnabled).toHaveBeenCalledTimes(writes);
    expect(availability).toHaveBeenLastCalledWith({ supported: true, available: false, editing: true });
    fireEvent.click(screen.getByRole("button", { name: "Close stale editor" }));
    expect(api.setDragEnabled).toHaveBeenCalledTimes(writes);
    expect(api.setOffset).not.toHaveBeenCalled();
    expect(api.setSize).not.toHaveBeenCalled();
    expect(availability).toHaveBeenLastCalledWith({ supported: true, available: true, editing: false });
  });

  it("applies entered position and custom length without requiring Preview", async () => {
    const { api, getApi } = fixture();
    const committed = vi.fn();
    render(<CountertopPlacementControls ready disabled={false} getApi={getApi} onCommitted={committed} />);
    await open();
    fireEvent.change(screen.getByLabelText("Offset X (m)"), { target: { value: "0.2" } });
    fireEvent.change(screen.getByLabelText("Offset Y (m)"), { target: { value: "0.1" } });
    fireEvent.change(screen.getByLabelText("Length (m)"), { target: { value: "1.7" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply countertop" }));
    await waitFor(() => expect(committed).toHaveBeenCalledOnce());
    expect(api.setOffset).toHaveBeenCalledExactlyOnceWith({ x: 0.2, y: 0.1 });
    expect(api.setSize).toHaveBeenCalledExactlyOnceWith({ length: 1.7 });
    expect(committed.mock.calls[0][0]).toMatchObject({ customLength: 1.7, offset: { x: 0.2, y: 0.1 } });
  });

  it("rejects a replacement API even when product and composition IDs match the snapshot", async () => {
    const original = fixture();
    const replacement = fixture();
    const availability = vi.fn();
    const { rerender } = render(
      <CountertopPlacementControls
        ready
        disabled={false}
        getApi={original.getApi}
        onAvailabilityChange={availability}
      />,
    );
    await open();
    rerender(
      <CountertopPlacementControls
        ready
        disabled={false}
        getApi={replacement.getApi}
        onAvailabilityChange={availability}
      />,
    );
    await waitFor(() => expect(replacement.api.getState).toHaveBeenCalledOnce());
    expect((screen.getByRole("button", { name: "Apply countertop" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Cancel countertop" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Close stale editor" }));
    expect(replacement.api.setDragEnabled).not.toHaveBeenCalled();
    expect(replacement.api.setOffset).not.toHaveBeenCalled();
    expect(replacement.api.setSize).not.toHaveBeenCalled();
    expect(availability).toHaveBeenLastCalledWith({ supported: true, available: true, editing: false });
  });

  it("unlocks after begin fails and displays foreign-realm error details", async () => {
    const { api, getApi } = fixture();
    const availability = vi.fn();
    render(<CountertopPlacementControls ready disabled={false} getApi={getApi} onAvailabilityChange={availability} />);
    const opener = (await screen.findByRole("button", { name: "Countertop: Position & Size" })) as HTMLButtonElement;
    await waitFor(() => expect(opener.disabled).toBe(false));
    api.getState.mockImplementationOnce(() => {
      throw { code: "CONFIGURATION_BOOLEAN_PENDING", message: "Boolean update is pending" };
    });
    fireEvent.click(opener);
    expect((await screen.findByRole("alert")).textContent).toContain(
      "CONFIGURATION_BOOLEAN_PENDING: Boolean update is pending",
    );
    await waitFor(() => expect(screen.queryByRole("button", { name: "Apply countertop" })).toBeNull());
    expect(availability).toHaveBeenLastCalledWith({ supported: true, available: true, editing: false });
    expect(api.setDragEnabled).not.toHaveBeenCalled();
  });

  it("blocks Apply and Cancel during pointer motion and formats displayed metres only", async () => {
    const { api, getApi, emit, state } = fixture({
      ...base,
      offset: { x: 0.600000035, y: 0.10000002 },
      size: { length: 1.20000003, depth: 0.46000004 },
      thickness: 0.01200001,
    });
    render(<CountertopPlacementControls ready disabled={false} getApi={getApi} />);
    await open();
    expect((screen.getByLabelText("Offset X (m)") as HTMLInputElement).value).toBe("0.6");
    expect((screen.getByLabelText("Depth (m)") as HTMLInputElement).value).toBe("0.46");
    expect((screen.getByLabelText("Thickness (m)") as HTMLInputElement).value).toBe("0.012");
    emit({ ...state(), dragging: true });
    const writes = api.setDragEnabled.mock.calls.length;
    const apply = screen.getByRole("button", { name: "Apply countertop" }) as HTMLButtonElement;
    const cancel = screen.getByRole("button", { name: "Cancel countertop" }) as HTMLButtonElement;
    expect(apply.disabled).toBe(true);
    expect(cancel.disabled).toBe(true);
    fireEvent.click(apply);
    fireEvent.click(cancel);
    expect(api.setDragEnabled).toHaveBeenCalledTimes(writes);
    emit({ ...state(), dragging: false });
    expect(apply.disabled).toBe(false);
    expect(cancel.disabled).toBe(false);
    expect(state().offset?.x).toBe(0.600000035);
  });

  it("keeps the snapshot after failed Apply and permits retrying Cancel", async () => {
    const { api, getApi } = fixture();
    const availability = vi.fn();
    render(<CountertopPlacementControls ready disabled={false} getApi={getApi} onAvailabilityChange={availability} />);
    await open();
    api.setDragEnabled.mockImplementationOnce(() => {
      throw new Error("drag update failed");
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply countertop" }));
    expect((await screen.findByRole("alert")).textContent).toContain("drag update failed");
    expect(availability).toHaveBeenLastCalledWith({ supported: true, available: false, editing: true });
    fireEvent.click(screen.getByRole("button", { name: "Cancel countertop" }));
    await screen.findByRole("button", { name: "Countertop: Position & Size" });
  });

  it("reports constrained rollback instead of claiming Cancel succeeded", async () => {
    const { api, getApi, emit, state } = fixture({
      ...base,
      attached: false,
      canResize: true,
      offset: { x: 0.4, y: 0 },
    });
    render(<CountertopPlacementControls ready disabled={false} getApi={getApi} />);
    await open();
    api.setOffset.mockImplementationOnce(async () => {
      emit({ ...state(), offset: { x: 0.3, y: 0 } });
      return state();
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel countertop" }));
    expect((await screen.findByRole("alert")).textContent).toContain("could not be restored exactly");
    expect(screen.getByRole("button", { name: "Cancel countertop" })).toBeTruthy();
    expect(api.setSize).not.toHaveBeenCalled();
  });

  it("guards duplicate opens/commands, supports edit-size actions and unsubscribes", async () => {
    const { api, getApi, action, stop } = fixture();
    const handle = createRef<CountertopPlacementHandle>();
    const { unmount } = render(<CountertopPlacementControls ref={handle} ready disabled={false} getApi={getApi} />);
    await waitFor(() =>
      expect((screen.getByRole("button", { name: "Countertop: Position & Size" }) as HTMLButtonElement).disabled).toBe(
        false,
      ),
    );
    action();
    act(() => {
      handle.current?.open();
      handle.current?.open();
    });
    await screen.findByRole("button", { name: "Apply countertop" });
    await waitFor(() => expect(api.setDragEnabled).toHaveBeenCalledExactlyOnceWith(true));
    await waitFor(() =>
      expect((screen.getByRole("button", { name: "Apply countertop" }) as HTMLButtonElement).disabled).toBe(false),
    );
    let release!: () => void;
    api.whenSettled.mockImplementationOnce(
      () =>
        new Promise<CountertopState>((resolve) => {
          release = () => resolve(api.getState());
        }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Apply countertop" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply countertop" }));
    await waitFor(() => expect(api.whenSettled).toHaveBeenCalledOnce());
    act(() => release());
    await screen.findByRole("button", { name: "Countertop: Position & Size" });
    expect(api.setDragEnabled).toHaveBeenCalledTimes(2);
    unmount();
    expect(stop).toHaveBeenCalledTimes(2);
  });

  it("hides missing APIs and waits for readiness without starting edits", async () => {
    const { getApi, emit } = fixture({ ...base, readiness: "waiting", productId: null });
    const availability = vi.fn();
    const { rerender } = render(
      <CountertopPlacementControls ready disabled={false} getApi={() => null} onAvailabilityChange={availability} />,
    );
    expect(screen.queryByLabelText("Countertop positioning")).toBeNull();
    expect(availability).toHaveBeenLastCalledWith({ supported: false, available: false, editing: false });
    rerender(
      <CountertopPlacementControls ready disabled={false} getApi={getApi} onAvailabilityChange={availability} />,
    );
    expect(
      ((await screen.findByRole("button", { name: "Countertop: Position & Size" })) as HTMLButtonElement).disabled,
    ).toBe(true);
    emit(base);
    await waitFor(() =>
      expect((screen.getByRole("button", { name: "Countertop: Position & Size" }) as HTMLButtonElement).disabled).toBe(
        false,
      ),
    );
  });

  it("discovers a delayed API once and cleans up bounded discovery", async () => {
    vi.useFakeTimers();
    try {
      const { api, stop } = fixture();
      let runtimeApi: CountertopApi | null = null;
      const getApi = vi.fn(() => runtimeApi);
      const { unmount } = render(<CountertopPlacementControls ready disabled={false} getApi={getApi} />);
      expect(screen.queryByLabelText("Countertop positioning")).toBeNull();
      expect(getApi).toHaveBeenCalledOnce();
      await act(async () => vi.advanceTimersByTimeAsync(600));
      runtimeApi = api;
      await act(async () => vi.advanceTimersByTimeAsync(300));
      expect((screen.getByRole("button", { name: "Countertop: Position & Size" }) as HTMLButtonElement).disabled).toBe(
        false,
      );
      expect(api.on).toHaveBeenCalledTimes(2);
      const calls = getApi.mock.calls.length;
      await act(async () => vi.advanceTimersByTimeAsync(16000));
      expect(getApi).toHaveBeenCalledTimes(calls);
      expect(api.on).toHaveBeenCalledTimes(2);
      unmount();
      expect(stop).toHaveBeenCalledTimes(2);

      const missing = vi.fn(() => null);
      const absent = render(<CountertopPlacementControls ready disabled={false} getApi={missing} />);
      await act(async () => vi.advanceTimersByTimeAsync(16000));
      expect(missing).toHaveBeenCalledTimes(51);
      await act(async () => vi.advanceTimersByTimeAsync(16000));
      expect(missing).toHaveBeenCalledTimes(51);
      absent.unmount();

      const cancelled = vi.fn(() => null);
      const pending = render(<CountertopPlacementControls ready disabled={false} getApi={cancelled} />);
      pending.unmount();
      await act(async () => vi.advanceTimersByTimeAsync(16000));
      expect(cancelled).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });
});
