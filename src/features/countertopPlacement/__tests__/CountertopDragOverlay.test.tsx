// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CountertopOverlayFrame } from "@/features/configuratorApi";

import { setCountertopRuntimeState } from "@/shared/lib/countertopRuntimeState";

import { METRES_PER_INCH } from "../lib/countertopLength";
import { createCountertopOverlayStore } from "../lib/countertopOverlayStore";
import { CountertopDragOverlay } from "../ui/CountertopDragOverlay";

const handlesProps = vi.fn();
vi.mock("../ui/CountertopResizeHandles", () => ({
  CountertopResizeHandles: (props: unknown) => {
    handlesProps(props);
    return null;
  },
}));

afterEach(() => {
  cleanup();
  handlesProps.mockClear();
  setCountertopRuntimeState(null);
});

const inches = (value: number) => value * METRES_PER_INCH;

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

const renderOverlay = (frame: CountertopOverlayFrame, { pending = false }: { pending?: boolean } = {}) => {
  const store = createCountertopOverlayStore();
  store.set(frame);
  const props = {
    onApply: vi.fn(),
    onCancel: vi.fn(),
    lengthAtPointer: vi.fn(async () => null),
    onPreview: vi.fn(),
    onResizeFrom: vi.fn(),
  };
  render(<CountertopDragOverlay store={store} pending={pending} {...props} />);
  return props;
};

describe("CountertopDragOverlay length chip", () => {
  it.each([false, true])("shows the length read-only with the drag hint (attached: %s)", (attached) => {
    renderOverlay(frameOf({ attached, lengthM: inches(40) }));
    expect(screen.getByTestId("countertop-length-chip").textContent).toBe("40″");
    expect(screen.getByText("Drag the ends to change the length")).toBeTruthy();
    expect(screen.queryByText("Move the countertop off the cabinets to change its length")).toBeNull();
    expect(screen.queryAllByRole("button").map((button) => button.getAttribute("aria-label") ?? button.textContent)).toEqual([
      "Apply",
      "Discard countertop changes",
    ]);
    expect(screen.queryByRole("spinbutton")).toBeNull();
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
