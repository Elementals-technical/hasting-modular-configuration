// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { CountertopOverlayFrame } from "@/features/configuratorApi";

import { METRES_PER_INCH } from "../lib/countertopLength";
import {
  createHandleDragSession,
  nudgeLengthM,
  type CountertopLengthAtPointer,
} from "../lib/handleDrag";
import { CountertopResizeHandles, type CountertopResizeHandlesProps } from "../ui/CountertopResizeHandles";

beforeAll(() => {
  if (!("PointerEvent" in window)) {
    class PointerEventPolyfill extends MouseEvent {}
    Object.assign(window, { PointerEvent: PointerEventPolyfill });
  }
});

let rafQueue: Array<() => void> = [];
beforeEach(() => {
  rafQueue = [];
  vi.stubGlobal("requestAnimationFrame", (cb: () => void) => {
    rafQueue.push(cb);
    return rafQueue.length;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    rafQueue[id - 1] = () => undefined;
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const flushRaf = () =>
  act(() => {
    const queue = rafQueue;
    rafQueue = [];
    queue.forEach((cb) => cb());
  });

const inches = (value: number) => value * METRES_PER_INCH;
const limits = { minLengthM: inches(48), maxLengthM: inches(120) };
const result = (lengthIn: number, snappedTo: CountertopLengthAtPointer["snappedTo"] = null): CountertopLengthAtPointer => ({
  lengthM: inches(lengthIn),
  rawLengthM: inches(lengthIn) + 0.001,
  snappedTo,
  limits,
});

const frameOf = (overrides: Partial<CountertopOverlayFrame> = {}): CountertopOverlayFrame => ({
  active: true,
  status: "clear",
  reasons: [],
  collidesWith: [],
  attached: false,
  lengthM: inches(84),
  depthM: inches(22),
  limits,
  canApply: true,
  dragging: false,
  visible: true,
  viewport: { width: 1000, height: 800 },
  hull: [],
  bounds: null,
  points: { leftEnd: { x: 300, y: 400 }, rightEnd: { x: 700, y: 400 } },
  lengthAxisPx: { x: 100, y: 0 },
  ...overrides,
});

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
};

const setup = (overrides: Partial<CountertopResizeHandlesProps> = {}) => {
  const props: CountertopResizeHandlesProps = {
    frame: frameOf(),
    disabled: false,
    origin: vi.fn(() => ({ left: 10, top: 20 })),
    lengthAtPointer: vi.fn(() => result(90)),
    onPreview: vi.fn(),
    onCommit: vi.fn(),
    ...overrides,
  };
  const view = render(<CountertopResizeHandles {...props} />);
  const handle = (side: "left" | "right") =>
    screen.getByRole("button", { name: `Resize countertop from the ${side} end` });
  return { props, view, handle };
};

describe("CountertopResizeHandles", () => {
  it("renders nothing when attached or without points", () => {
    const { view } = setup({ frame: frameOf({ attached: true }) });
    expect(view.container.innerHTML).toBe("");
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    cleanup();
    setup({ frame: frameOf({ points: null }) });
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("places both handles at the frame end points", () => {
    const { handle } = setup();
    expect(handle("left").style.left).toBe("300px");
    expect(handle("left").style.top).toBe("400px");
    expect(handle("right").style.left).toBe("700px");
  });

  it("drags the right end: frame coords, preview, commit then clear", async () => {
    const { props, handle } = setup();
    fireEvent.pointerDown(handle("right"), { clientX: 710, clientY: 420 });
    expect(handle("right").dataset.dragging).toBe("true");
    expect(handle("right").className).toMatch(/active/);

    fireEvent.pointerMove(window, { clientX: 760, clientY: 420 });
    expect(props.lengthAtPointer).not.toHaveBeenCalled(); // throttled to rAF
    flushRaf();
    expect(props.lengthAtPointer).toHaveBeenCalledWith("right", { x: 750, y: 400 });
    expect(props.onPreview).toHaveBeenLastCalledWith({ side: "right", lengthM: inches(90) });
    expect(screen.getByTestId("countertop-resize-tooltip").textContent).toBe("90″");

    await act(async () => {
      fireEvent.pointerUp(window, { clientX: 760, clientY: 420 });
    });
    expect(props.onCommit).toHaveBeenCalledTimes(1);
    expect(props.onCommit).toHaveBeenCalledWith("right", inches(90));
    expect(props.onPreview).toHaveBeenLastCalledWith(null);
    const commitOrder = vi.mocked(props.onCommit).mock.invocationCallOrder[0];
    const clearOrder = vi.mocked(props.onPreview).mock.invocationCallOrder.at(-1)!;
    expect(commitOrder).toBeLessThan(clearOrder);
    expect(handle("right").dataset.dragging).toBeUndefined();
    expect(screen.queryByTestId("countertop-resize-tooltip")).toBeNull();

    // listeners are gone after release
    fireEvent.pointerMove(window, { clientX: 800, clientY: 420 });
    flushRaf();
    expect(props.lengthAtPointer).toHaveBeenCalledTimes(1);
  });

  it("shows the one-cabinet minimum (0.6 m) as 23.6″ in the tooltip", () => {
    const oneCabinet = { lengthM: 0.6, rawLengthM: 0.55, snappedTo: null, limits: { ...limits, minLengthM: 0.6 } };
    const { handle } = setup({ lengthAtPointer: vi.fn(() => oneCabinet) });
    fireEvent.pointerDown(handle("left"), { clientX: 300, clientY: 400 });
    fireEvent.pointerMove(window, { clientX: 500, clientY: 400 });
    flushRaf();
    expect(screen.getByTestId("countertop-resize-tooltip").textContent).toBe("23.6″");
  });

  it("keeps a single lengthAtPointer in flight (latest wins) and commits the settled result", async () => {
    const first = deferred<CountertopLengthAtPointer | null>();
    const second = deferred<CountertopLengthAtPointer | null>();
    const lengthAtPointer = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { props, handle } = setup({ lengthAtPointer });

    fireEvent.pointerDown(handle("left"), { clientX: 300, clientY: 400 });
    fireEvent.pointerMove(window, { clientX: 280, clientY: 420 });
    flushRaf();
    expect(lengthAtPointer).toHaveBeenCalledTimes(1);

    fireEvent.pointerMove(window, { clientX: 270, clientY: 420 });
    fireEvent.pointerMove(window, { clientX: 250, clientY: 420 });
    flushRaf();
    expect(lengthAtPointer).toHaveBeenCalledTimes(1);

    await act(async () => first.resolve(result(86, { kind: "edge", xM: 1 })));
    expect(props.onPreview).toHaveBeenLastCalledWith({ side: "left", lengthM: inches(86) });
    expect(screen.getByTestId("countertop-resize-tooltip").textContent).toBe("86″edge");
    expect(lengthAtPointer).toHaveBeenCalledTimes(2);
    expect(lengthAtPointer).toHaveBeenLastCalledWith("left", { x: 240, y: 400 });

    await act(async () => {
      fireEvent.pointerUp(window, { clientX: 250, clientY: 420 });
    });
    expect(props.onCommit).not.toHaveBeenCalled(); // waits for the in-flight request

    await act(async () => second.resolve(result(87)));
    expect(props.onCommit).toHaveBeenCalledWith("left", inches(87));
    expect(props.onPreview).toHaveBeenLastCalledWith(null);
    expect(lengthAtPointer).toHaveBeenCalledTimes(2);
  });

  it("pointercancel and Escape clear the preview without committing", async () => {
    const { props, handle } = setup();
    fireEvent.pointerDown(handle("right"), { clientX: 700, clientY: 400 });
    fireEvent.pointerMove(window, { clientX: 760, clientY: 400 });
    flushRaf();
    fireEvent.pointerCancel(window);
    expect(props.onPreview).toHaveBeenLastCalledWith(null);
    expect(props.onCommit).not.toHaveBeenCalled();

    fireEvent.pointerDown(handle("right"), { clientX: 700, clientY: 400 });
    fireEvent.pointerMove(window, { clientX: 760, clientY: 400 });
    flushRaf();
    fireEvent.keyDown(window, { key: "Escape" });
    await act(async () => {
      fireEvent.pointerUp(window);
    });
    expect(props.onPreview).toHaveBeenLastCalledWith(null);
    expect(props.onCommit).not.toHaveBeenCalled();
  });

  it("does not commit when the length did not change, and cancels on unmount", async () => {
    const { props, view, handle } = setup({ lengthAtPointer: vi.fn(() => result(84)) });
    fireEvent.pointerDown(handle("right"), { clientX: 700, clientY: 400 });
    fireEvent.pointerMove(window, { clientX: 701, clientY: 400 });
    flushRaf();
    await act(async () => {
      fireEvent.pointerUp(window);
    });
    expect(props.onCommit).not.toHaveBeenCalled();
    expect(props.onPreview).toHaveBeenLastCalledWith(null);

    vi.mocked(props.onPreview).mockClear();
    fireEvent.pointerDown(handle("right"), { clientX: 700, clientY: 400 });
    view.unmount();
    expect(props.onPreview).toHaveBeenCalledWith(null);
    expect(props.onCommit).not.toHaveBeenCalled();
  });

  it("ignores pointer and keyboard input while disabled", () => {
    const { props, handle } = setup({ disabled: true });
    fireEvent.pointerDown(handle("right"), { clientX: 700, clientY: 400 });
    fireEvent.pointerMove(window, { clientX: 760, clientY: 400 });
    flushRaf();
    fireEvent.keyDown(handle("right"), { key: "ArrowRight" });
    expect(props.lengthAtPointer).not.toHaveBeenCalled();
    expect(props.onCommit).not.toHaveBeenCalled();
    expect(props.onPreview).not.toHaveBeenCalled();
  });

  it("nudges with the arrow keys: outward grows, Shift = 1in, no preview", () => {
    const { props, handle } = setup();
    fireEvent.keyDown(handle("right"), { key: "ArrowRight" });
    expect(props.onCommit).toHaveBeenLastCalledWith("right", inches(84) + 0.0127);
    fireEvent.keyDown(handle("right"), { key: "ArrowLeft", shiftKey: true });
    expect(props.onCommit).toHaveBeenLastCalledWith("right", inches(84) - 0.0254);
    fireEvent.keyDown(handle("left"), { key: "ArrowLeft" });
    expect(props.onCommit).toHaveBeenLastCalledWith("left", inches(84) + 0.0127);
    fireEvent.keyDown(handle("left"), { key: "ArrowRight" });
    expect(props.onCommit).toHaveBeenLastCalledWith("left", inches(84) - 0.0127);
    expect(props.onCommit).toHaveBeenCalledTimes(4);
    expect(props.onPreview).not.toHaveBeenCalled();
  });
});

describe("handleDrag controller", () => {
  it("clamps nudges to the limits and returns null at the edge", () => {
    expect(nudgeLengthM({ side: "right", key: "ArrowRight", shiftKey: false, lengthM: limits.maxLengthM, limits })).toBeNull();
    expect(nudgeLengthM({ side: "left", key: "ArrowUp", shiftKey: false, lengthM: inches(84), limits })).toBeNull();
  });

  it("ignores null results and ends without commit or extra requests", async () => {
    const requestFrame = vi.fn((cb: () => void) => {
      cb();
      return 1;
    });
    const onPreview = vi.fn();
    const onCommit = vi.fn();
    const onFinish = vi.fn();
    const lengthAtPointer = vi.fn(async () => null);
    const session = createHandleDragSession({
      side: "right",
      startLengthM: 1,
      origin: () => ({ left: 0, top: 0 }),
      lengthAtPointer,
      onPreview,
      onCommit,
      onFinish,
      requestFrame,
      cancelFrame: () => undefined,
    });
    session.move({ x: 5, y: 6 });
    await session.end();
    expect(lengthAtPointer).toHaveBeenCalledWith("right", { x: 5, y: 6 });
    expect(onCommit).not.toHaveBeenCalled();
    expect(onPreview).toHaveBeenCalledTimes(1);
    expect(onPreview).toHaveBeenCalledWith(null);
    expect(onFinish).toHaveBeenCalledTimes(1);
    session.cancel();
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it("sends a move that was still waiting for rAF when the pointer is released", async () => {
    const onCommit = vi.fn();
    const session = createHandleDragSession({
      side: "left",
      startLengthM: 1,
      origin: () => ({ left: 1, top: 1 }),
      lengthAtPointer: () => ({ lengthM: 1.2, rawLengthM: 1.2, snappedTo: null, limits: { minLengthM: 0, maxLengthM: 3 } }),
      onPreview: vi.fn(),
      onCommit,
      requestFrame: () => 7,
      cancelFrame: vi.fn(),
    });
    session.move({ x: 11, y: 11 });
    await session.end();
    expect(onCommit).toHaveBeenCalledWith("left", 1.2);
  });
});
