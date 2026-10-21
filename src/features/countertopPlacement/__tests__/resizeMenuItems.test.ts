import { describe, expect, it, vi } from "vitest";

import type { DropdownItem } from "@/shared/ui/NestedDropdown/NestedDropdown";

import { buildCountertopResizeItems, buildCountertopThicknessItem } from "../lib/resizeMenuItems";

const thickness: DropdownItem = { id: "countertop-thickness", label: "Thickness", children: [] };
const ready = { supported: true, available: true, active: false };

describe("countertop Resize menu", () => {
  it("offers Thickness, then Length for a thick top; Length enters the length session", () => {
    const onLength = vi.fn();
    const [resize] = buildCountertopResizeItems(thickness, ready, true, onLength);
    expect(resize.id).toBe("countertop-resize");
    expect(resize.label).toBe("Resize");
    expect(resize.children?.map((item) => [item.id, item.label])).toEqual([
      ["countertop-thickness", "Thickness"],
      ["countertop-length", "Length"],
    ]);
    expect(resize.children?.[1].disabled).toBe(false);
    resize.children?.[1].onClick?.();
    expect(onLength).toHaveBeenCalledOnce();
  });

  it("has no Length for a top that is not thick, or where the countertop Drag & Drop does not run", () => {
    const labels = (items: DropdownItem[]) => items[0]?.children?.map((item) => item.label);
    expect(labels(buildCountertopResizeItems(thickness, ready, false, vi.fn()))).toEqual(["Thickness"]);
    expect(
      labels(
        buildCountertopResizeItems(thickness, { supported: false, available: false, active: false }, true, vi.fn()),
      ),
    ).toEqual(["Thickness"]);
  });

  it("keeps Length, disabled, while another editor is busy or a session is open", () => {
    const lengthOf = (status: typeof ready) =>
      buildCountertopResizeItems(thickness, status, true, vi.fn())[0].children?.[1];
    expect(lengthOf({ supported: true, available: false, active: false })?.disabled).toBe(true);
    expect(lengthOf({ supported: true, available: false, active: true })?.disabled).toBe(true);
  });

  it("is left out with nothing under it, and holds Length alone without a Thickness", () => {
    expect(buildCountertopResizeItems(null, ready, false, vi.fn())).toEqual([]);
    expect(buildCountertopResizeItems(null, ready, true, vi.fn())[0].children?.map((item) => item.id)).toEqual([
      "countertop-length",
    ]);
  });
});

// Both flows change the thickness from the menu: Prebuilt no longer leads to the Countertop step.
describe("countertop Thickness menu", () => {
  it("lists each allowed thickness by its label and picks it in place", () => {
    const onSelect = vi.fn();
    const item = buildCountertopThicknessItem([0.5, 4, 5.125], onSelect);
    expect([item.id, item.label]).toEqual(["countertop-thickness", "Thickness"]);
    expect(item.onClick).toBeUndefined();
    expect(item.children?.map((option) => option.label)).toEqual(['0.5"', '4"', '5.1"']);
    item.children?.[1].onClick?.();
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(4);
  });

  it("has no thickness to pick while the rules allow none", () => {
    expect(buildCountertopThicknessItem([], vi.fn()).children).toEqual([]);
  });
});
