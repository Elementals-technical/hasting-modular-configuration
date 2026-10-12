// @vitest-environment jsdom
import { createElement, createRef } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { CountertopOverlayFrame } from "@/features/configuratorApi";
import { setCountertopRuntimeState } from "@/shared/lib/countertopRuntimeState";

import {
  DEFAULT_COUNTERTOP_LENGTH_LIMITS_IN,
  formatInches,
  lengthFromHandleDrag,
  limitsInToMetres,
  METRES_PER_INCH,
  metresToDisplayInches,
  resolveCountertopLengthLimitsIn,
} from "../lib/countertopLength";
import {
  COUNTERTOP_LAYOUT_INTRO_STORAGE_KEY,
  getCountertopLayoutIntroSeen,
  setCountertopLayoutIntroSeen,
} from "../lib/countertopLayoutIntroStorage";
import type { CountertopApi, CountertopState } from "../lib/countertopSession";
import { buildCountertopPositionItems, isCountertopSettingsMode } from "../lib/positionMenuItems";
import {
  CountertopDragMode,
  type CountertopDragModeHandle,
  type CountertopOverlayBridge,
} from "../ui/CountertopDragMode";

// Pass-through spy: the real overlay renders, the test also sees the props CountertopDragMode passes.
const overlayProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
vi.mock("../ui/CountertopDragOverlay", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../ui/CountertopDragOverlay")>();
  const Spy = (props: Record<string, unknown>) => {
    overlayProps.current = props;
    return createElement(actual.CountertopDragOverlay as never, props as never);
  };
  return { ...actual, CountertopDragOverlay: Spy };
});
type OverlayCallbacks = {
  onResizeFrom(side: "left" | "right", lengthM: number): void;
  onPreview(preview: { side: "left" | "right"; lengthM: number } | null): void;
  lengthAtPointer(side: "left" | "right", point: { x: number; y: number }): Promise<unknown>;
};
const overlayCallbacks = () => overlayProps.current as unknown as OverlayCallbacks;

beforeAll(() => {
  if (!("PointerEvent" in window)) {
    class PointerEventPolyfill extends MouseEvent {}
    Object.assign(window, { PointerEvent: PointerEventPolyfill });
  }
});
afterEach(() => {
  cleanup();
  setCountertopRuntimeState(null);
});

const inches = (value: number) => value * METRES_PER_INCH;
const base: CountertopState = {
  readiness: "ready",
  productId: "top-1",
  compositionId: "composition-1",
  attached: true,
  offset: { x: 0, y: 0 },
  dragEnabled: false,
  customLength: null,
  size: { length: inches(84), depth: inches(22) },
};

const frameOf = (overrides: Partial<CountertopOverlayFrame> = {}): CountertopOverlayFrame => ({
  active: true,
  status: "clear",
  reasons: [],
  collidesWith: [],
  attached: false,
  lengthM: inches(84),
  depthM: inches(22),
  limits: { minLengthM: inches(48), maxLengthM: inches(120) },
  canApply: true,
  dragging: false,
  visible: true,
  viewport: { width: 1000, height: 800 },
  hull: [],
  bounds: null,
  points: {
    center: { x: 500, y: 400 },
    topCenter: { x: 500, y: 350 },
    bottomRight: { x: 700, y: 450 },
    leftEnd: { x: 300, y: 400 },
    rightEnd: { x: 700, y: 400 },
  },
  lengthAxisPx: { x: 100, y: 0 },
  ...overrides,
});

const fixture = ({ overlay = true, introSeen = true }: { overlay?: boolean; introSeen?: boolean } = {}) => {
  // The flows below start past the layout intro; the intro tests opt out.
  sessionStorage.removeItem(COUNTERTOP_LAYOUT_INTRO_STORAGE_KEY);
  if (introSeen) setCountertopLayoutIntroSeen();
  let current = structuredClone(base);
  const api = {
    getState: vi.fn(() => structuredClone(current)),
    setDragEnabled: vi.fn((enabled: boolean) => {
      current = { ...current, dragEnabled: enabled };
    }),
    setOffset: vi.fn((offset: { x: number; y: number }) => {
      current = { ...current, offset, attached: offset.x === 0 && offset.y === 0 };
    }),
    resetOffset: vi.fn(() => {
      current = { ...current, offset: { x: 0, y: 0 }, attached: true };
    }),
    setSize: vi.fn(({ length }: { length: number | null }) => {
      current = { ...current, customLength: length, size: { ...current.size, length: length ?? inches(84) } };
    }),
    whenSettled: vi.fn(() => structuredClone(current)),
    on: vi.fn(() => () => undefined),
  } satisfies CountertopApi;
  let emit: (frame: CountertopOverlayFrame | null) => void = () => undefined;
  const stopOverlay = vi.fn();
  const bridge = {
    subscribeCountertopOverlay: vi.fn(async (callback: (frame: CountertopOverlayFrame | null) => void) => {
      if (!overlay) return null;
      emit = callback;
      return stopOverlay;
    }),
    setCountertopOverlayActive: vi.fn(async () => overlay),
    setCountertopOverlayPlaceholders: vi.fn(async () => overlay),
    setCountertopLengthLimits: vi.fn(async () => true),
  } satisfies CountertopOverlayBridge;
  const onCommitted = vi.fn();
  const onStatusChange = vi.fn();
  const ref = createRef<CountertopDragModeHandle>();
  render(
    <CountertopDragMode
      ref={ref}
      ready
      disabled={false}
      getApi={() => api}
      lengthLimitsIn={{ min: 48, max: 120 }}
      createBridge={() => bridge}
      onCommitted={onCommitted}
      onStatusChange={onStatusChange}
    />,
  );
  const move = (offset: { x: number; y: number }) => {
    current = { ...current, offset, attached: false };
  };
  return {
    api,
    bridge,
    ref,
    onCommitted,
    onStatusChange,
    stopOverlay,
    emit: (f: CountertopOverlayFrame | null) => act(() => emit(f)),
    move,
    state: () => current,
  };
};

const enter = async (f: ReturnType<typeof fixture>) => {
  await waitFor(() => expect(f.onStatusChange).toHaveBeenLastCalledWith(expect.objectContaining({ available: true })));
  act(() => f.ref.current!.enter());
  await waitFor(() =>
    expect(f.onStatusChange).toHaveBeenLastCalledWith(expect.objectContaining({ active: true, busy: true })),
  );
  await waitFor(() =>
    expect(f.onStatusChange).toHaveBeenLastCalledWith(expect.objectContaining({ busy: true, available: false })),
  );
};

describe("countertop Position menu", () => {
  it("offers Standard and Drag & Drop under Position", () => {
    const onStandard = vi.fn();
    const onDragDrop = vi.fn();
    const [position] = buildCountertopPositionItems(
      { supported: true, available: true, active: false },
      { onStandard, onDragDrop },
    );
    expect(position.label).toBe("Position");
    expect(position.children?.map((item) => item.label)).toEqual(["Standard", "Drag & Drop"]);
    position.children?.[0].onClick?.();
    position.children?.[1].onClick?.();
    expect(onStandard).toHaveBeenCalledOnce();
    expect(onDragDrop).toHaveBeenCalledOnce();
    expect(
      buildCountertopPositionItems({ supported: false, available: false, active: false }, { onStandard, onDragDrop }),
    ).toEqual([]);
    const [busy] = buildCountertopPositionItems(
      { supported: true, available: false, active: true },
      { onStandard, onDragDrop },
    );
    expect(busy.children?.map((item) => item.disabled)).toEqual([false, true]);
  });

  it("shows the Position & Size modal only in ?countertopSettings test mode", () => {
    expect(isCountertopSettingsMode("?countertopSettings")).toBe(true);
    expect(isCountertopSettingsMode("?placementDebug")).toBe(false);
  });
});

describe("countertop length maths", () => {
  const limits = { minM: inches(48), maxM: inches(120) };
  it("resizes symmetrically: twice the pointer travel along the axis, left handle inverted, clamped", () => {
    const axisPx = { x: 100, y: 0 };
    expect(
      lengthFromHandleDrag({ startLengthM: 2, delta: { x: 10, y: 5 }, axisPx, side: "right", limits }),
    ).toBeCloseTo(2.2);
    expect(
      lengthFromHandleDrag({ startLengthM: 2, delta: { x: -10, y: 0 }, axisPx, side: "left", limits }),
    ).toBeCloseTo(2.2);
    expect(
      lengthFromHandleDrag({ startLengthM: 2, delta: { x: 0, y: 20 }, axisPx: { x: 0, y: 50 }, side: "right", limits }),
    ).toBeCloseTo(2.8);
    expect(
      lengthFromHandleDrag({ startLengthM: 2, delta: { x: 1000, y: 0 }, axisPx, side: "right", limits }),
    ).toBeCloseTo(inches(120));
    expect(
      lengthFromHandleDrag({ startLengthM: 2, delta: { x: 1000, y: 0 }, axisPx, side: "left", limits }),
    ).toBeCloseTo(inches(48));
  });

  it("reads the collection limits with a one-cabinet (60 cm) to 120 in default", () => {
    const oneCabinet = { min: 60 / 2.54, max: 120 };
    expect(resolveCountertopLengthLimitsIn(undefined)).toEqual(oneCabinet);
    expect(resolveCountertopLengthLimitsIn({ lengthLimitsIn: { min: 36, max: 96 } })).toEqual({ min: 36, max: 96 });
    expect(resolveCountertopLengthLimitsIn({ lengthLimitsIn: { min: 90, max: 30 } })).toEqual(oneCabinet);
  });

  it("sends the default minimum to PlayCanvas as 0.6 m", () => {
    const limitsM = limitsInToMetres(DEFAULT_COUNTERTOP_LENGTH_LIMITS_IN);
    expect(Math.abs(limitsM.minM - 0.6)).toBeLessThan(1e-9);
    expect(limitsM.maxM).toBeCloseTo(inches(120), 9);
  });

  it("displays inches rounded to 0.1 without a trailing .0", () => {
    expect(metresToDisplayInches(0.6)).toBe(23.6);
    expect(metresToDisplayInches(1.2192)).toBe(48);
    expect(metresToDisplayInches(1.651)).toBe(65);
    expect(metresToDisplayInches(inches(84.3))).toBe(84.3);
    expect(metresToDisplayInches(inches(84.26))).toBe(84.3);
    expect(formatInches(metresToDisplayInches(0.6))).toBe("23.6″");
    expect(formatInches(metresToDisplayInches(1.2192))).toBe("48″");
    expect(formatInches(48)).toBe("48″");
    expect(formatInches(60 / 2.54)).toBe("23.6″");
  });
});

describe("CountertopDragMode", () => {
  it("enters drag mode with limits and the overlay, and Apply commits", async () => {
    const f = fixture();
    await enter(f);
    expect(f.api.setDragEnabled).toHaveBeenCalledWith(true);
    expect(f.bridge.setCountertopLengthLimits).toHaveBeenCalledWith({ minM: inches(48), maxM: inches(120) });
    expect(f.bridge.setCountertopOverlayActive).toHaveBeenCalledWith(true);
    expect(f.bridge.setCountertopOverlayPlaceholders).toHaveBeenCalledWith(false);
    f.emit(frameOf());
    expect(screen.getByTestId("countertop-length-chip").textContent).toBe("84″");
    expect(screen.getByTestId("countertop-depth-chip").textContent).toContain("22″");
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(f.onCommitted).toHaveBeenCalled());
    expect(f.api.setDragEnabled).toHaveBeenLastCalledWith(false);
    expect(f.api.whenSettled).toHaveBeenCalled();
    await waitFor(() => expect(f.bridge.setCountertopOverlayActive).toHaveBeenLastCalledWith(false));
    expect(f.stopOverlay).toHaveBeenCalled();
    expect(screen.queryByTestId("countertop-drag-overlay")).toBeNull();
  });

  it("blocks Apply on a conflict and shows the reason", async () => {
    const f = fixture();
    await enter(f);
    f.emit(
      frameOf({ status: "colliding", canApply: false, reasons: [{ code: "overlap", message: "Overlaps a cabinet" }] }),
    );
    expect(screen.getByRole("button", { name: "Apply" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("alert").textContent).toBe("Overlaps a cabinet");
  });

  it("Cancel restores the captured offset and length", async () => {
    const f = fixture();
    await enter(f);
    f.emit(frameOf());
    f.move({ x: 0.3, y: 0.1 });
    f.api.setSize({ length: inches(100) });
    fireEvent.click(screen.getByRole("button", { name: "Discard countertop changes" }));
    await waitFor(() => expect(f.bridge.setCountertopOverlayActive).toHaveBeenLastCalledWith(false));
    expect(f.api.resetOffset).toHaveBeenCalled();
    expect(f.api.setSize).toHaveBeenLastCalledWith({ length: null });
    expect(f.state()).toMatchObject({ attached: true, customLength: null, dragEnabled: false });
    expect(f.onCommitted).not.toHaveBeenCalled();
  });

  it("resizes a standard (attached) top from one end within resizeBoundsM[side], never via setSize", async () => {
    const f = fixture();
    await enter(f);
    f.emit(frameOf({ attached: true }));
    const left = { anchorXM: 1, minLengthM: inches(60), maxLengthM: inches(100) };
    act(() => setCountertopRuntimeState({ readiness: "ready", productId: "top-1", resizeBoundsM: { left, right: null } }));
    expect(screen.getAllByRole("button", { name: /^Resize countertop from the/ })).toHaveLength(2);
    const resizeFrom = vi.fn(async () => undefined);
    Object.assign(f.api, { resizeFrom });
    act(() => overlayCallbacks().onResizeFrom("left", inches(110)));
    await waitFor(() => expect(resizeFrom).toHaveBeenCalledWith("left", inches(100)));
    const bridge = f.bridge as CountertopOverlayBridge;
    const limits = { minLengthM: inches(48), maxLengthM: inches(120) };
    bridge.countertopLengthAtPointer = vi.fn(async () => ({ lengthM: inches(40), rawLengthM: inches(40), snappedTo: null, limits }));
    await expect(overlayCallbacks().lengthAtPointer("left", { x: 1, y: 2 })).resolves.toMatchObject({
      lengthM: inches(60),
      limits: { minLengthM: inches(60), maxLengthM: inches(100) },
    });
    expect(bridge.countertopLengthAtPointer).toHaveBeenCalledWith("left", { x: 1, y: 2 }, { snap: true });
    expect(f.api.setSize).not.toHaveBeenCalled();
  });

  it("never falls back to setSize on a standard top when the build lacks resizeFrom", async () => {
    const f = fixture();
    await enter(f);
    f.emit(frameOf({ attached: true }));
    const bridge = f.bridge as CountertopOverlayBridge;
    bridge.resizeCountertopFrom = vi.fn(async () => {
      throw { code: "API_METHOD_UNAVAILABLE", message: "countertop.resizeFrom is not available" };
    });
    act(() => overlayCallbacks().onResizeFrom("right", inches(90)));
    await waitFor(() => expect(bridge.resizeCountertopFrom).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(f.api.setSize).not.toHaveBeenCalled();
  });

  it("drags the right handle: asks lengthAtPointer, previews, then resizes from that end", async () => {
    const f = fixture();
    await enter(f);
    f.emit(frameOf());
    const bridge = f.bridge as CountertopOverlayBridge;
    const resizeFrom = vi.fn(async () => undefined);
    Object.assign(f.api, { resizeFrom });
    bridge.previewCountertopLength = vi.fn(async () => true);
    bridge.countertopLengthAtPointer = vi.fn(async () => ({
      lengthM: inches(90),
      rawLengthM: inches(90.2),
      snappedTo: null,
      limits: { minLengthM: inches(48), maxLengthM: inches(120) },
    }));
    fireEvent.pointerDown(screen.getByRole("button", { name: "Resize countertop from the right end" }), {
      clientX: 700,
      clientY: 400,
    });
    fireEvent.pointerMove(window, { clientX: 710, clientY: 400 });
    fireEvent.pointerUp(window, { clientX: 710, clientY: 400 });
    await waitFor(() => expect(resizeFrom).toHaveBeenCalledWith("right", inches(90)));
    expect(bridge.countertopLengthAtPointer).toHaveBeenCalledWith("right", expect.any(Object), { snap: true });
    expect(bridge.previewCountertopLength).toHaveBeenCalledWith({ side: "right", lengthM: inches(90) });
    await waitFor(() => expect(bridge.previewCountertopLength).toHaveBeenLastCalledWith(null));
    expect(f.api.setSize).not.toHaveBeenCalled();
  });

  it("Standard resets the offset and leaves drag mode", async () => {
    const f = fixture();
    await enter(f);
    act(() => f.ref.current!.standard());
    await waitFor(() => expect(f.onCommitted).toHaveBeenCalled());
    expect(f.api.resetOffset).toHaveBeenCalled();
    expect(f.api.setDragEnabled).toHaveBeenLastCalledWith(false);
    await waitFor(() => expect(f.onStatusChange).toHaveBeenLastCalledWith(expect.objectContaining({ active: false })));
  });

  it("falls back to Apply / Cancel pills without countertopOverlay", async () => {
    const f = fixture({ overlay: false });
    await enter(f);
    expect(screen.queryByTestId("countertop-drag-overlay")).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit countertop length" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(f.onStatusChange).toHaveBeenLastCalledWith(expect.objectContaining({ active: false })));
    expect(f.bridge.setCountertopOverlayActive).not.toHaveBeenCalled();
  });
});

describe("CountertopDragMode layout intro", () => {
  const INTRO = { name: "Customize Your Countertop Layout" };
  const requestDragDrop = async (f: ReturnType<typeof fixture>) => {
    await waitFor(() =>
      expect(f.onStatusChange).toHaveBeenLastCalledWith(expect.objectContaining({ available: true })),
    );
    act(() => f.ref.current!.enter());
  };
  const introClosed = () => waitFor(() => expect(screen.queryByRole("dialog", INTRO)).toBeNull());

  it("opens the intro before the first entry, and Continue marks it seen and enters", async () => {
    const f = fixture({ introSeen: false });
    await requestDragDrop(f);
    expect((await screen.findByRole("dialog", INTRO)).textContent).toContain("enter Drag & Drop mode");
    expect(screen.queryByRole("button", { name: "Show example 1" })).toBeNull();
    expect(f.api.setDragEnabled).not.toHaveBeenCalled();
    expect(f.onStatusChange).not.toHaveBeenCalledWith(expect.objectContaining({ active: true }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(getCountertopLayoutIntroSeen()).toBe(true);
    await waitFor(() => expect(f.api.setDragEnabled).toHaveBeenCalledWith(true));
    await waitFor(() => expect(f.onStatusChange).toHaveBeenLastCalledWith(expect.objectContaining({ active: true })));
    await introClosed();
  });

  it("enters straight away on the next Drag & Drop of the session", async () => {
    const f = fixture({ introSeen: false });
    await requestDragDrop(f);
    fireEvent.click(await screen.findByRole("button", { name: "Continue" }));
    await waitFor(() => expect(f.onStatusChange).toHaveBeenLastCalledWith(expect.objectContaining({ active: true })));
    await introClosed();
    act(() => f.ref.current!.standard());
    await waitFor(() => expect(f.onStatusChange).toHaveBeenLastCalledWith(expect.objectContaining({ active: false })));
    await requestDragDrop(f);
    await waitFor(() => expect(f.onStatusChange).toHaveBeenLastCalledWith(expect.objectContaining({ active: true })));
    expect(screen.queryByRole("dialog", INTRO)).toBeNull();
    expect(f.api.setDragEnabled.mock.calls.filter(([enabled]) => enabled)).toHaveLength(2);
  });

  it.each([
    ["×", "Close"],
    ["the backdrop", "Overlay"],
  ])("closes on %s without entering or marking it seen, so the next entry asks again", async (_, control) => {
    const f = fixture({ introSeen: false });
    await requestDragDrop(f);
    fireEvent.click(await screen.findByRole("button", { name: control }));
    await introClosed();
    expect(f.api.setDragEnabled).not.toHaveBeenCalled();
    expect(f.onStatusChange).not.toHaveBeenCalledWith(expect.objectContaining({ active: true }));
    expect(getCountertopLayoutIntroSeen()).toBe(false);
    act(() => f.ref.current!.enter());
    expect(await screen.findByRole("dialog", INTRO)).toBeTruthy();
  });

  it("still enters on Continue when the host blocks session storage", async () => {
    const f = fixture({ introSeen: false });
    const blocked = vi.spyOn(window, "sessionStorage", "get").mockImplementation(() => {
      throw new DOMException("Storage is blocked", "SecurityError");
    });
    try {
      await requestDragDrop(f);
      fireEvent.click(await screen.findByRole("button", { name: "Continue" }));
      await waitFor(() => expect(f.api.setDragEnabled).toHaveBeenCalledWith(true));
      expect(getCountertopLayoutIntroSeen()).toBe(false);
    } finally {
      blocked.mockRestore();
    }
  });
});

describe("CountertopDragMode length commands (v2)", () => {
  const deferredResizeFrom = (f: ReturnType<typeof fixture>) => {
    const resolvers: Array<() => void> = [];
    const resizeFrom = vi.fn(() => new Promise<void>((resolve) => resolvers.push(resolve)));
    Object.assign(f.api, { resizeFrom });
    return { resolvers, resizeFrom };
  };

  it("keeps one resizeFrom in flight and sends only the latest queued length", async () => {
    const f = fixture();
    await enter(f);
    f.emit(frameOf());
    const { resolvers, resizeFrom } = deferredResizeFrom(f);
    act(() => {
      overlayCallbacks().onResizeFrom("right", inches(60));
      overlayCallbacks().onResizeFrom("right", inches(70));
      overlayCallbacks().onResizeFrom("right", inches(80));
    });
    await waitFor(() => expect(resizeFrom).toHaveBeenCalledTimes(1));
    expect(resizeFrom).toHaveBeenLastCalledWith("right", inches(60));
    await act(async () => resolvers[0]());
    await waitFor(() => expect(resizeFrom).toHaveBeenCalledTimes(2));
    expect(resizeFrom).toHaveBeenLastCalledWith("right", inches(80));
    await act(async () => resolvers[1]());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(resizeFrom).toHaveBeenCalledTimes(2);
  });

  it("reports a failed resizeFrom and still sends the queued length", async () => {
    const f = fixture();
    await enter(f);
    f.emit(frameOf());
    let reject: (error: unknown) => void = () => undefined;
    const resizeFrom = vi.fn<(side: string, lengthM: number) => Promise<void>>(() => Promise.resolve());
    resizeFrom.mockImplementationOnce(() => new Promise<void>((_, fail) => (reject = fail)));
    Object.assign(f.api, { resizeFrom });
    act(() => {
      overlayCallbacks().onResizeFrom("right", inches(60));
      overlayCallbacks().onResizeFrom("right", inches(90));
    });
    await waitFor(() => expect(resizeFrom).toHaveBeenCalledTimes(1));
    await act(async () => reject({ code: "LIMIT", message: "Too long" }));
    await waitFor(() => expect(resizeFrom).toHaveBeenLastCalledWith("right", inches(90)));
    expect(screen.getByText("LIMIT: Too long")).toBeTruthy();
  });

  it("resizeFrom prefers api.resizeFrom, clamps, and clears the preview after it settles", async () => {
    const f = fixture();
    await enter(f);
    f.emit(frameOf());
    const resizeFrom = vi.fn(async () => undefined);
    Object.assign(f.api, { resizeFrom });
    const bridge = f.bridge as CountertopOverlayBridge;
    bridge.previewCountertopLength = vi.fn(async () => true);
    bridge.resizeCountertopFrom = vi.fn(async () => undefined);
    act(() => overlayCallbacks().onResizeFrom("left", inches(200)));
    await waitFor(() => expect(resizeFrom).toHaveBeenCalledWith("left", inches(120)));
    await waitFor(() => expect(bridge.previewCountertopLength).toHaveBeenLastCalledWith(null));
    expect(bridge.resizeCountertopFrom).not.toHaveBeenCalled();
    expect(f.api.setSize).not.toHaveBeenCalled();
  });

  it("resizeFrom uses the bridge, then falls back to setSize when the build lacks resizeFrom", async () => {
    const f = fixture();
    await enter(f);
    f.emit(frameOf());
    const bridge = f.bridge as CountertopOverlayBridge;
    bridge.previewCountertopLength = vi.fn(async () => true);
    bridge.resizeCountertopFrom = vi.fn(async () => {
      throw { code: "API_METHOD_UNAVAILABLE", message: "countertop.resizeFrom is not available" };
    });
    act(() => overlayCallbacks().onResizeFrom("right", inches(90)));
    await waitFor(() => expect(f.api.setSize).toHaveBeenCalledWith({ length: inches(90) }));
    expect(bridge.resizeCountertopFrom).toHaveBeenCalledWith("right", inches(90));
    await waitFor(() => expect(bridge.previewCountertopLength).toHaveBeenLastCalledWith(null));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("delegates preview and lengthAtPointer (snapped) to the bridge", async () => {
    const f = fixture();
    await enter(f);
    f.emit(frameOf());
    const bridge = f.bridge as CountertopOverlayBridge;
    const hit = { lengthM: 2, rawLengthM: 2.01, snappedTo: { kind: "cabinet", xM: 1 }, limits: { minLengthM: 1, maxLengthM: 3 } };
    await expect(overlayCallbacks().lengthAtPointer("right", { x: 1, y: 2 })).resolves.toBeNull();
    bridge.previewCountertopLength = vi.fn(async () => {
      throw new Error("detached");
    });
    bridge.countertopLengthAtPointer = vi.fn(async () => hit);
    act(() => overlayCallbacks().onPreview({ side: "right", lengthM: 2 }));
    expect(bridge.previewCountertopLength).toHaveBeenCalledWith({ side: "right", lengthM: 2 });
    await expect(overlayCallbacks().lengthAtPointer("right", { x: 1, y: 2 })).resolves.toEqual(hit);
    expect(bridge.countertopLengthAtPointer).toHaveBeenCalledWith("right", { x: 1, y: 2 }, { snap: true });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("Cancel waits for the in-flight length and clears the preview", async () => {
    const f = fixture();
    await enter(f);
    f.emit(frameOf());
    const bridge = f.bridge as CountertopOverlayBridge;
    bridge.previewCountertopLength = vi.fn(async () => true);
    const { resolvers, resizeFrom } = deferredResizeFrom(f);
    const release = () => resolvers[0]();
    act(() => {
      overlayCallbacks().onResizeFrom("right", inches(60));
      overlayCallbacks().onResizeFrom("right", inches(70));
    });
    await waitFor(() => expect(resizeFrom).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Discard countertop changes" }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(f.api.resetOffset).not.toHaveBeenCalled();
    await act(async () => release());
    await waitFor(() => expect(f.bridge.setCountertopOverlayActive).toHaveBeenLastCalledWith(false));
    expect(f.api.setSize).toHaveBeenLastCalledWith({ length: null });
    expect(resizeFrom).not.toHaveBeenCalledWith("right", inches(70));
    expect(bridge.previewCountertopLength).toHaveBeenCalledWith(null);
  });
});

describe("countertop D&D validation and command errors", () => {
  afterEach(() => act(() => setCountertopRuntimeState(null)));
  const verdict = (validation: NonNullable<CountertopState["validation"]>) =>
    act(() => setCountertopRuntimeState({ ...base, validation }));

  it("shows the live verdict by Apply: invalid in red, a warning as a hint, unknown not at all", async () => {
    const f = fixture();
    await enter(f);
    f.emit(frameOf());
    expect(screen.queryByRole("alert")).toBeNull();
    // A 'validation' change reaches the store through the central subscriber; the overlay re-renders.
    verdict({ status: "invalid", reasons: ["TRAP_KEEPOUT", "SINK_LANDING_GAP"], warnings: [] });
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe("Too close to the sink trap. The sink can't go here.");
    expect(alert.getAttribute("data-validation")).toBe("invalid");
    verdict({ status: "valid", reasons: [], warnings: ["COUNTERTOP_COLLISION"] });
    expect(screen.queryByRole("alert")).toBeNull();
    const hint = screen.getByRole("status");
    expect(hint.textContent).toBe("The countertop overlaps another object.");
    expect(hint.getAttribute("data-validation")).toBe("warning");
    expect(screen.getByRole("button", { name: "Apply" })).toHaveProperty("disabled", false);
    verdict({ status: "unknown", reasons: ["TRAP_KEEPOUT"], warnings: [] });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("without the overlay shows the verdict in the toolbar and describes run() failures", async () => {
    const f = fixture({ overlay: false });
    await enter(f);
    verdict({ status: "invalid", reasons: ["BASIN_EDGE_TOO_CLOSE"], warnings: [] });
    expect(screen.getByRole("alert").textContent).toBe("Sink too close to the countertop edge.");
    f.api.setDragEnabled.mockImplementationOnce(() => {
      throw Object.assign(new Error("legacy writer"), { code: "LEGACY_WRITERS_BUSY" });
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    // The command error does not hide the live red verdict.
    await waitFor(() =>
      expect(screen.getAllByRole("alert").map((node) => node.textContent)).toEqual([
        "The scene is busy. Try again in a moment.",
        "Sink too close to the countertop edge.",
      ]),
    );
  });
});
