// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CountertopOverlayFrame } from "@/features/configuratorApi";

import {
  DEFAULT_COUNTERTOP_LENGTH_LIMITS_IN,
  DEFAULT_COUNTERTOP_LENGTH_PRESETS_IN,
  limitsInToMetres,
  METRES_PER_INCH,
  presetsWithinLimits,
  resolveCountertopLengthPresetsIn,
} from "../lib/countertopLength";
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

const renderOverlay = (
  frame: CountertopOverlayFrame,
  { pending = false, lengthPresetsIn }: { pending?: boolean; lengthPresetsIn?: number[] } = {},
) => {
  const store = createCountertopOverlayStore();
  store.set(frame);
  const props = {
    onApply: vi.fn(),
    onCancel: vi.fn(),
    onLength: vi.fn(),
    lengthAtPointer: vi.fn(async () => null),
    onPreview: vi.fn(),
    onResizeFrom: vi.fn(),
  };
  render(
    <CountertopDragOverlay
      store={store}
      lengthLimitsIn={{ min: 48, max: 120 }}
      lengthPresetsIn={lengthPresetsIn}
      pending={pending}
      {...props}
    />,
  );
  return props;
};

const lastLength = (onLength: ReturnType<typeof vi.fn>) => onLength.mock.calls.at(-1)?.[0] as number;

describe("countertop length presets helpers", () => {
  it("defaults, sorts, dedupes and drops invalid presets", () => {
    expect(resolveCountertopLengthPresetsIn(undefined)).toEqual([23.6, 48, 60, 72, 84, 96, 120]);
    expect(resolveCountertopLengthPresetsIn([])).toEqual([...DEFAULT_COUNTERTOP_LENGTH_PRESETS_IN]);
    expect(resolveCountertopLengthPresetsIn([90, 60, 60, -1, Number.NaN, 0])).toEqual([60, 90]);
    expect(resolveCountertopLengthPresetsIn([Number.NaN])).toEqual([23.6, 48, 60, 72, 84, 96, 120]);
  });

  it("keeps only presets inside the effective limits", () => {
    const limits = { minM: inches(60), maxM: inches(96) };
    expect(presetsWithinLimits([48, 60, 72, 84, 96, 120], limits)).toEqual([60, 72, 84, 96]);
  });

  it("keeps the one-cabinet 23.6 in preset when the minimum is 60 cm (23.622 in), within 0.05 in", () => {
    const limits = limitsInToMetres(DEFAULT_COUNTERTOP_LENGTH_LIMITS_IN);
    expect(presetsWithinLimits(DEFAULT_COUNTERTOP_LENGTH_PRESETS_IN, limits)).toEqual([23.6, 48, 60, 72, 84, 96, 120]);
    expect(presetsWithinLimits([23.5, 23.6], limits)).toEqual([23.6]);
    expect(presetsWithinLimits([120, 120.1], limits)).toEqual([120]);
  });
});

describe("CountertopDragOverlay length chip", () => {
  it("steps the length by ±1 in and clamps to the limits", () => {
    const { onLength } = renderOverlay(frameOf());
    fireEvent.click(screen.getByRole("button", { name: "Lengthen countertop by 1 inch" }));
    expect(lastLength(onLength)).toBeCloseTo(inches(85), 9);
    fireEvent.click(screen.getByRole("button", { name: "Shorten countertop by 1 inch" }));
    expect(lastLength(onLength)).toBeCloseTo(inches(83), 9);
  });

  it("clamps a step that would pass the maximum and disables at the limits", () => {
    const { onLength } = renderOverlay(frameOf({ lengthM: inches(119.5) }));
    fireEvent.click(screen.getByRole("button", { name: "Lengthen countertop by 1 inch" }));
    expect(lastLength(onLength)).toBeCloseTo(inches(120), 9);
    cleanup();
    renderOverlay(frameOf({ lengthM: inches(120) }));
    expect(screen.getByRole("button", { name: "Lengthen countertop by 1 inch" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Shorten countertop by 1 inch" })).toHaveProperty("disabled", false);
    cleanup();
    renderOverlay(frameOf({ lengthM: inches(48) }));
    expect(screen.getByRole("button", { name: "Shorten countertop by 1 inch" })).toHaveProperty("disabled", true);
  });

  it("disables the stepper, presets and editor while pending", () => {
    renderOverlay(frameOf(), { pending: true });
    for (const name of ["Lengthen countertop by 1 inch", "Shorten countertop by 1 inch", "Length presets", "Edit countertop length"])
      expect(screen.getByRole("button", { name })).toHaveProperty("disabled", true);
  });

  it("lists the presets within the frame limits and applies one", () => {
    const { onLength } = renderOverlay(frameOf({ limits: { minLengthM: inches(60), maxLengthM: inches(96) } }));
    fireEvent.click(screen.getByRole("button", { name: "Length presets" }));
    const items = screen.getAllByRole("menuitem").map((item) => item.textContent);
    expect(items).toEqual(["60″", "72″", "84″", "96″"]);
    fireEvent.click(screen.getByRole("menuitem", { name: "72″" }));
    expect(lastLength(onLength)).toBeCloseTo(inches(72), 9);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("uses the collection presets when given", () => {
    renderOverlay(frameOf(), { lengthPresetsIn: [100, 50, 130] });
    fireEvent.click(screen.getByRole("button", { name: "Length presets" }));
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["50″", "100″"]);
  });

  it("keeps the ✎ numeric editor", () => {
    const { onLength } = renderOverlay(frameOf());
    fireEvent.click(screen.getByRole("button", { name: "Edit countertop length" }));
    const input = screen.getByLabelText("Countertop length (in)");
    fireEvent.change(input, { target: { value: "90" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(lastLength(onLength)).toBeCloseTo(inches(90), 9);
  });

  it("offers Set <min> only for a remote top below the minimum", () => {
    const { onLength } = renderOverlay(frameOf({ lengthM: inches(40) }));
    fireEvent.click(screen.getByRole("button", { name: "Set 48″" }));
    expect(lastLength(onLength)).toBeCloseTo(inches(48), 9);
    cleanup();
    renderOverlay(frameOf({ lengthM: inches(48) }));
    expect(screen.queryByRole("button", { name: /^Set / })).toBeNull();
    cleanup();
    renderOverlay(frameOf({ lengthM: inches(40), attached: true }));
    expect(screen.queryByRole("button", { name: /^Set / })).toBeNull();
  });

  it("applies the 23.6 in preset as the exact one-cabinet minimum (0.6 m)", () => {
    const { onLength } = renderOverlay(frameOf({ limits: { minLengthM: 0.6, maxLengthM: inches(120) } }));
    fireEvent.click(screen.getByRole("button", { name: "Length presets" }));
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "23.6″",
      "48″",
      "60″",
      "72″",
      "84″",
      "96″",
      "120″",
    ]);
    fireEvent.click(screen.getByRole("menuitem", { name: "23.6″" }));
    expect(lastLength(onLength)).toBe(0.6);
  });

  it("shows and sets a 0.6 m minimum as 23.6 in", () => {
    const { onLength } = renderOverlay(
      frameOf({ lengthM: inches(20), limits: { minLengthM: 0.6, maxLengthM: inches(120) } }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Set 23.6″" }));
    expect(lastLength(onLength)).toBe(0.6);
    cleanup();
    renderOverlay(frameOf({ lengthM: 0.6, limits: { minLengthM: 0.6, maxLengthM: inches(120) } }));
    expect(screen.getByTestId("countertop-length-chip").textContent).toContain("23.6″");
    expect(screen.getByRole("button", { name: "Shorten countertop by 1 inch" })).toHaveProperty("disabled", true);
    expect(screen.queryByRole("button", { name: /^Set / })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Edit countertop length" }));
    expect(screen.getByText("Min 23.6″ Max 120″")).toBeTruthy();
  });

  it("uses the frame minimum in the Set pill", () => {
    renderOverlay(frameOf({ lengthM: inches(50), limits: { minLengthM: inches(60), maxLengthM: inches(120) } }));
    expect(screen.getByRole("button", { name: "Set 60″" })).toBeTruthy();
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

  it("shows an attached top read-only with a hint and no handles", () => {
    renderOverlay(frameOf({ attached: true }));
    expect(screen.getByTestId("countertop-length-chip").textContent).toBe("84″");
    expect(screen.getByText("Move the countertop off the cabinets to change its length")).toBeTruthy();
    for (const name of ["Lengthen countertop by 1 inch", "Shorten countertop by 1 inch", "Length presets", "Edit countertop length"])
      expect(screen.queryByRole("button", { name })).toBeNull();
    expect(handlesProps).not.toHaveBeenCalled();
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
