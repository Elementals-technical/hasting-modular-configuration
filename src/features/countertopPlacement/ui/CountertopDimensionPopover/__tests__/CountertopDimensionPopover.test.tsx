// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { METRES_PER_INCH } from "../../../lib/countertopLength";
import { CountertopDimensionPopover } from "../CountertopDimensionPopover";

afterEach(cleanup);

const inches = (value: number) => value * METRES_PER_INCH;

/** The length chip's popover by default: limits and Align. */
const renderPopover = ({
  label = "Length",
  valueIn = 84,
  limitsIn = { min: 48, max: 120 },
  alignable = true,
}: {
  label?: string;
  valueIn?: number;
  limitsIn?: { min: number; max: number } | null;
  alignable?: boolean;
} = {}) => {
  const props = { onApply: vi.fn(), onClose: vi.fn() };
  render(
    <CountertopDimensionPopover
      label={label}
      anchor={{ x: 300, y: 400 }}
      overlayRef={{ current: document.createElement("div") }}
      valueM={inches(valueIn)}
      limitsM={limitsIn ? { minM: inches(limitsIn.min), maxM: inches(limitsIn.max) } : undefined}
      alignable={alignable}
      {...props}
    />,
  );
  return props;
};
const renderDepth = (valueIn = 18.1) => renderPopover({ label: "Depth", valueIn, limitsIn: null, alignable: false });

const field = (name = "Length") => screen.getByRole("spinbutton", { name });

describe("CountertopDimensionPopover: Length", () => {
  const popover = () => screen.getByRole("dialog", { name: "Countertop length" });

  it("shows the length, the limits and Center aligned", () => {
    renderPopover();
    expect(field()).toHaveProperty("value", "84″");
    expect(within(popover()).getByText("Min 48″")).toBeTruthy();
    expect(within(popover()).getByText("Max 120″")).toBeTruthy();
    expect(
      within(popover())
        .getAllByRole("button", { pressed: true })
        .map((button) => button.textContent),
    ).toEqual(["Center"]);
  });

  it("steps by 1″ and reads a typed length, both kept within the limits", () => {
    renderPopover({ valueIn: 119.5 });
    fireEvent.click(screen.getByRole("button", { name: "Increase length" }));
    expect(field()).toHaveProperty("value", "120″");
    expect(screen.getByRole("button", { name: "Increase length" })).toHaveProperty("disabled", true);
    fireEvent.keyDown(field(), { key: "ArrowDown" });
    expect(field()).toHaveProperty("value", "119″");
    // Focus keeps the text, so what is typed over a selection made on focus replaces it.
    fireEvent.focus(field());
    expect(field()).toHaveProperty("value", "119″");
    fireEvent.change(field(), { target: { value: "60″" } });
    fireEvent.blur(field());
    expect(field()).toHaveProperty("value", "60″");
    fireEvent.change(field(), { target: { value: "30,5" } });
    fireEvent.blur(field());
    expect(field()).toHaveProperty("value", "48″");
    expect(screen.getByRole("button", { name: "Decrease length" })).toHaveProperty("disabled", true);
    fireEvent.change(field(), { target: { value: "72.34" } });
    fireEvent.blur(field());
    expect(field()).toHaveProperty("value", "72.3″");
    fireEvent.change(field(), { target: { value: "abc" } });
    fireEvent.blur(field());
    expect(field()).toHaveProperty("value", "72.3″");
  });

  it("picks one alignment", () => {
    renderPopover();
    fireEvent.click(screen.getByRole("button", { name: "Left" }));
    expect(screen.getByRole("button", { name: "Left" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Center" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("Apply reports the length and the alignment chosen", () => {
    const props = renderPopover();
    fireEvent.click(screen.getByRole("button", { name: "Increase length" }));
    fireEvent.click(screen.getByRole("button", { name: "Left" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(props.onApply).toHaveBeenCalledOnce();
    const [request] = props.onApply.mock.calls[0];
    expect(request.align).toBe("left");
    expect(request.valueM).toBeCloseTo(inches(85), 9);
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it("Enter in the field applies what is typed, within the limits", () => {
    const props = renderPopover();
    fireEvent.change(field(), { target: { value: "200" } });
    fireEvent.submit(field());
    expect(props.onApply).toHaveBeenCalledOnce();
    expect(props.onApply.mock.calls[0][0].valueM).toBeCloseTo(inches(120), 9);
  });

  it("stays open on a press inside it; ×, Escape and a press outside close it", () => {
    const props = renderPopover();
    fireEvent.pointerDown(within(popover()).getByRole("button", { name: "Right" }));
    expect(props.onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.pointerDown(document.body);
    expect(props.onClose).toHaveBeenCalledTimes(3);
    expect(props.onApply).not.toHaveBeenCalled();
  });

  it("is portalled to the body, out of the canvas the page header covers on phones", () => {
    renderPopover();
    expect(popover().parentElement?.className).toBe("portal-body");
  });
});

describe("CountertopDimensionPopover: Depth", () => {
  const popover = () => screen.getByRole("dialog", { name: "Countertop depth" });

  it("has only its field: no Align, no Min / Max", () => {
    renderDepth();
    expect(field("Depth")).toHaveProperty("value", "18.1″");
    expect(within(popover()).queryByRole("group", { name: "Align" })).toBeNull();
    expect(within(popover()).queryByText(/^(Min|Max) /)).toBeNull();
    expect(
      within(popover())
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label") ?? button.textContent),
    ).toEqual(["Close", "Increase depth", "Decrease depth", "Apply"]);
  });

  it("Apply reports the depth, without an alignment", () => {
    const props = renderDepth();
    fireEvent.click(screen.getByRole("button", { name: "Increase depth" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    const [request] = props.onApply.mock.calls[0];
    expect(request.valueM).toBeCloseTo(inches(19.1), 9);
    expect(request).not.toHaveProperty("align");
  });

  it("keeps the depth above 0 without limits", () => {
    renderDepth(1.5);
    fireEvent.click(screen.getByRole("button", { name: "Decrease depth" }));
    expect(field("Depth")).toHaveProperty("value", "0.5″");
    expect(screen.getByRole("button", { name: "Decrease depth" })).toHaveProperty("disabled", true);
    for (const typed of ["-3", "0", "0.04"]) {
      fireEvent.change(field("Depth"), { target: { value: typed } });
      fireEvent.blur(field("Depth"));
      expect(field("Depth")).toHaveProperty("value", "0.5″");
    }
    fireEvent.change(field("Depth"), { target: { value: "24" } });
    fireEvent.blur(field("Depth"));
    expect(field("Depth")).toHaveProperty("value", "24″");
  });
});
