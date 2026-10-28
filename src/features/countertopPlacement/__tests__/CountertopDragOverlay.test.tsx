// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CountertopOverlayFrame } from "@/features/configuratorApi";

import { setCountertopRuntimeState } from "@/shared/lib/countertopRuntimeState";

import { METRES_PER_INCH } from "../lib/countertopLength";
import { createCountertopOverlayStore, type CountertopOverlayStore } from "../lib/countertopOverlayStore";
import { COUNTERTOP_LENGTH_HINT_MS, CountertopDragOverlay } from "../ui/CountertopDragOverlay";

const handlesProps = vi.fn();
vi.mock("../ui/CountertopResizeHandles", () => ({
  CountertopResizeHandles: (props: unknown) => {
    handlesProps(props);
    return null;
  },
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  handlesProps.mockClear();
  setCountertopRuntimeState(null);
});

const inches = (value: number) => value * METRES_PER_INCH;
const HINT = "Drag the ends to change the length";

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

const renderOverlay = (
  frame: CountertopOverlayFrame,
  {
    pending = false,
    store = createCountertopOverlayStore(),
    movable = true,
  }: { pending?: boolean; store?: CountertopOverlayStore; movable?: boolean } = {},
) => {
  store.set(frame);
  const props = {
    onApply: vi.fn(),
    onCancel: vi.fn(),
    lengthAtPointer: vi.fn(async () => null),
    onPreview: vi.fn(),
    onResizeFrom: vi.fn(),
  };
  render(
    <CountertopDragOverlay
      store={store}
      movable={movable}
      pending={pending}
      lengthLimitsM={{ minM: inches(36), maxM: inches(96) }}
      {...props}
    />,
  );
  return props;
};

describe("CountertopDragOverlay length chip", () => {
  it.each([false, true])("shows the length with ✎ and the drag hint (attached: %s)", (attached) => {
    renderOverlay(frameOf({ attached, lengthM: inches(40) }));
    expect(screen.getByTestId("countertop-length-chip").textContent?.trim()).toBe("40″");
    expect(screen.getByText(HINT).getAttribute("aria-hidden")).toBeNull();
    expect(screen.queryByText("Move the countertop off the cabinets to change its length")).toBeNull();
    expect(screen.queryAllByRole("button").map((button) => button.getAttribute("aria-label") ?? button.textContent)).toEqual([
      "Edit countertop length, 40″",
      "Edit countertop depth, 22″",
      "Apply",
      "Discard countertop changes",
    ]);
    expect(screen.queryByRole("spinbutton")).toBeNull();
  });

  it.each([
    ["under the top's lower edge", { x: 700, y: 450 }, "428px"],
    ["below Apply / × when they stand under it", { x: 600, y: 425 }, "460px"],
  ])("places the drag hint %s, centred on the top", (_, bottomRight, top) => {
    const bounds = { left: 300, top: 380, right: 700, bottom: 420, width: 400, height: 40 };
    renderOverlay(frameOf({ bounds, points: { ...frameOf().points, bottomRight } }));
    const hint = screen.getByText("Drag the ends to change the length");
    expect([hint.style.left, hint.style.top]).toEqual(["500px", top]);
  });

  it("fades the drag hint after COUNTERTOP_LENGTH_HINT_MS", () => {
    vi.useFakeTimers();
    renderOverlay(frameOf());
    act(() => vi.advanceTimersByTime(COUNTERTOP_LENGTH_HINT_MS - 1));
    expect(screen.getByText(HINT).getAttribute("aria-hidden")).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByText(HINT).getAttribute("aria-hidden")).toBe("true");
  });

  it.each<[string, Partial<CountertopOverlayFrame>]>([
    ["the top", { dragging: true }],
    ["an end", { preview: { side: "right", lengthM: inches(90) } }],
  ])("fades the drag hint at once when %s is dragged, for the rest of the session", (_, drag) => {
    const store = createCountertopOverlayStore();
    renderOverlay(frameOf(), { store });
    act(() => store.set(frameOf(drag)));
    expect(screen.getByText(HINT).getAttribute("aria-hidden")).toBe("true");
    act(() => store.set(frameOf()));
    expect(screen.getByText(HINT).getAttribute("aria-hidden")).toBe("true");
  });

  it("renders the resize handles for a remote top", () => {
    const props = renderOverlay(frameOf());
    expect(handlesProps).toHaveBeenCalled();
    const handles = handlesProps.mock.calls.at(-1)?.[0] as {
      disabled: boolean;
      origin(): { left: number; top: number };
      onCommit: unknown;
      onPreview: unknown;
      lengthAtPointer: unknown;
    };
    expect(handles.disabled).toBe(false);
    expect(handles.origin()).toEqual({ left: 0, top: 0 });
    expect(handles.onCommit).toBe(props.onResizeFrom);
    expect(handles.onPreview).toBe(props.onPreview);
    expect(handles.lengthAtPointer).toBe(props.lengthAtPointer);
  });

  it("renders the handles on a standard (attached) top with the runtime resizeBoundsM", () => {
    const resizeBoundsM = {
      left: { anchorXM: 1, minLengthM: 0.6, maxLengthM: 2 },
      right: { anchorXM: -1, minLengthM: 0.7, maxLengthM: 1.8 },
    };
    setCountertopRuntimeState({ readiness: "ready", productId: "top", attached: true, canResize: false, resizeBoundsM });
    renderOverlay(frameOf({ attached: true }));
    const handles = handlesProps.mock.calls.at(-1)?.[0] as { resizeBoundsM: unknown; disabled: boolean };
    expect(handles.disabled).toBe(false);
    expect(handles.resizeBoundsM).toBe(resizeBoundsM);
  });
});

describe("CountertopDragOverlay length popover", () => {
  const POPOVER = { name: "Countertop length" };
  const openPopover = () => {
    fireEvent.click(screen.getByRole("button", { name: /^Edit countertop length/ }));
    return screen.getByRole("dialog", POPOVER);
  };

  it("opens from the chip with the frame's length and limits", () => {
    renderOverlay(frameOf());
    const chip = screen.getByRole("button", { name: /^Edit countertop length/ });
    expect(chip.getAttribute("aria-expanded")).toBe("false");
    const popover = openPopover();
    expect(chip.getAttribute("aria-expanded")).toBe("true");
    expect(within(popover).getByRole("spinbutton", { name: "Length" })).toHaveProperty("value", "84″");
    expect(within(popover).getByText("Min 48″")).toBeTruthy();
    expect(within(popover).getByText("Max 120″")).toBeTruthy();
  });

  it("takes the runtime's effective limits first, the collection's when nothing publishes any", () => {
    setCountertopRuntimeState({
      readiness: "ready",
      productId: "top",
      lengthLimitsM: { minLengthM: inches(60), maxLengthM: inches(100) },
    });
    renderOverlay(frameOf());
    expect(within(openPopover()).getByText("Min 60″")).toBeTruthy();
    cleanup();
    setCountertopRuntimeState(null);
    renderOverlay(frameOf({ limits: null }));
    const popover = openPopover();
    expect(within(popover).getByText("Min 36″")).toBeTruthy();
    expect(within(popover).getByText("Max 96″")).toBeTruthy();
  });

  it.each<[string, () => void]>([
    ["Apply", () => fireEvent.click(within(screen.getByRole("dialog", POPOVER)).getByRole("button", { name: "Apply" }))],
    ["×", () => fireEvent.click(screen.getByRole("button", { name: "Close" }))],
    ["Escape", () => fireEvent.keyDown(document, { key: "Escape" })],
    ["a press outside it", () => fireEvent.pointerDown(document.body)],
    ["the chip again", () => fireEvent.click(screen.getByRole("button", { name: /^Edit countertop length/ }))],
  ])("closes on %s and sends nothing", (_, close) => {
    const props = renderOverlay(frameOf());
    openPopover();
    fireEvent.click(screen.getByRole("button", { name: "Increase length" }));
    close();
    expect(screen.queryByRole("dialog", POPOVER)).toBeNull();
    for (const callback of Object.values(props)) expect(callback).not.toHaveBeenCalled();
  });

  it("the depth chip opens the Depth popover alone, at the chip, one popover at a time", () => {
    renderOverlay(frameOf());
    openPopover();
    const depthChip = screen.getByRole("button", { name: "Edit countertop depth, 22″" });
    expect(depthChip.textContent?.trim()).toBe("22″");
    fireEvent.click(depthChip);
    expect(screen.queryByRole("dialog", POPOVER)).toBeNull();
    const depth = screen.getByRole("dialog", { name: "Countertop depth" });
    expect(depthChip.getAttribute("aria-expanded")).toBe("true");
    expect(within(depth).getByRole("spinbutton", { name: "Depth" })).toHaveProperty("value", "22″");
    expect(within(depth).queryByRole("group", { name: "Align" })).toBeNull();
    expect(within(depth).queryByText(/^Min /)).toBeNull();
    fireEvent.click(depthChip);
    expect(screen.queryByRole("dialog", { name: "Countertop depth" })).toBeNull();
  });

  it("the depth popover's Apply sends nothing", () => {
    const props = renderOverlay(frameOf());
    fireEvent.click(screen.getByRole("button", { name: /^Edit countertop depth/ }));
    const depth = screen.getByRole("dialog", { name: "Countertop depth" });
    fireEvent.click(within(depth).getByRole("button", { name: "Increase depth" }));
    fireEvent.click(within(depth).getByRole("button", { name: "Apply" }));
    expect(screen.queryByRole("dialog", { name: "Countertop depth" })).toBeNull();
    for (const callback of Object.values(props)) expect(callback).not.toHaveBeenCalled();
  });

  it("both chips are shut while a command runs or the top is dragged", () => {
    const chips = () => screen.getAllByRole("button", { name: /^Edit countertop/ });
    renderOverlay(frameOf(), { pending: true });
    expect(chips().map((chip) => chip.hasAttribute("disabled"))).toEqual([true, true]);
    cleanup();
    renderOverlay(frameOf({ dragging: true }));
    expect(chips().map((chip) => chip.hasAttribute("disabled"))).toEqual([true, true]);
  });
});

describe("CountertopDragOverlay and the scene's Edit size button", () => {
  const host = window as unknown as { containerRef?: { current: HTMLIFrameElement | null } };
  const BOUNDS = { left: 300, top: 380, right: 700, bottom: 420, width: 400, height: 40 };

  /** The scene's 40 px button centred at (500, 375): under the chip at (500, 350) and the marker at (500, 400). */
  const mountButton = () => {
    const iframe = document.createElement("iframe");
    document.body.appendChild(iframe);
    host.containerRef = { current: iframe };
    const button = iframe.contentDocument?.createElement("button");
    if (!button) throw new Error("jsdom gave the iframe no document");
    button.className = "countertop-edit-size-button";
    const rect = { left: 480, top: 355, right: 520, bottom: 395, width: 40, height: 40, x: 480, y: 355 };
    button.getBoundingClientRect = () => ({ ...rect, toJSON: () => ({}) });
    iframe.contentDocument?.body.appendChild(button);
  };
  const placeOf = (element: HTMLElement | null) => [element?.style.left, element?.style.top];
  const marker = () => screen.getByTestId("countertop-drag-overlay").querySelector<HTMLElement>(":scope > span");
  const hint = () => screen.getByText("Drag the ends to change the length");

  afterEach(() => {
    host.containerRef?.current?.remove();
    delete host.containerRef;
  });

  it("moves the chip above a lifted top's button and the marker below it, the hint and popover with them", () => {
    mountButton();
    setCountertopRuntimeState({ readiness: "ready", productId: "top", attached: false, canResize: true });
    renderOverlay(frameOf({ bounds: BOUNDS }));
    const chip = screen.getByTestId("countertop-length-chip");
    expect(placeOf(chip)).toEqual(["500px", "341px"]);
    expect(placeOf(marker())).toEqual(["500px", "414px"]);
    expect(placeOf(hint())).toEqual(["500px", "437px"]);
    fireEvent.click(chip);
    // Above the moved chip: 341 − 10 (half the chip) − 18 (gap) − 0 (jsdom's popover height).
    expect(screen.getByRole("dialog", { name: "Countertop length" }).style.top).toBe("313px");
  });

  it("does not read the button while the top cannot be resized", () => {
    mountButton();
    setCountertopRuntimeState({ readiness: "ready", productId: "top", attached: true, canResize: false });
    renderOverlay(frameOf({ attached: true, bounds: BOUNDS }));
    expect(placeOf(screen.getByTestId("countertop-length-chip"))).toEqual(["500px", "350px"]);
    expect(placeOf(marker())).toEqual(["500px", "400px"]);
    expect(placeOf(hint())).toEqual(["500px", "428px"]);
  });
});

describe("CountertopDragOverlay length ghost", () => {
  const hull = [
    { x: 300, y: 380 },
    { x: 760, y: 380 },
    { x: 760, y: 420 },
    { x: 300, y: 420 },
  ];

  it("draws the previewed box's hull while a handle drag previews a length", () => {
    renderOverlay(frameOf({ hull, preview: { side: "right", lengthM: inches(96) }, lengthM: inches(96) }));
    const polygon = screen.getByTestId("countertop-length-ghost").querySelector("polygon");
    expect(polygon?.getAttribute("points")).toBe("300,380 760,380 760,420 300,420");
  });

  it("has no ghost without a preview", () => {
    renderOverlay(frameOf({ hull, preview: null }));
    expect(screen.queryByTestId("countertop-length-ghost")).toBeNull();
  });
});
