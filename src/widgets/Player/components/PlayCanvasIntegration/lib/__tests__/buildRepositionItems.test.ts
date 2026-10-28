import { describe, expect, it, vi } from "vitest";

import type { DropdownItem } from "@/shared/ui/NestedDropdown/NestedDropdown";

import { buildRepositionItems } from "../buildRepositionItems";

const isSideShelf = (runtimeId: string) => runtimeId.startsWith("shelf");
const canDrag = { supported: true, available: true };
const cannotDrag = { supported: false, available: false };

const build = (order: string[], cabinetId: string, dragDrop = canDrag) =>
  buildRepositionItems({ order, cabinetId, isSideShelf, dragDrop, onMove: vi.fn(), onDragDrop: vi.fn() });

/** The options under Reposition; null when the menu has no Reposition. */
const options = (items: DropdownItem[]) => {
  const [reposition] = items;
  return reposition ? (reposition.children ?? []).map(({ id }) => id) : null;
};

describe("Reposition of the selected cabinet", () => {
  it("offers Move Left, Move Right and Drag & Drop", () => {
    expect(options(build(["a", "b", "c"], "b"))).toEqual(["reposition-left", "reposition-right", "reposition-drag"]);
  });

  it("offers only Drag & Drop for the only cabinet, and no Reposition where the scene cannot drag it", () => {
    expect(options(build(["a"], "a"))).toEqual(["reposition-drag"]);
    expect(build(["a"], "a", cannotDrag)).toEqual([]);
    // A cabinet the composition does not hold has nothing to reposition.
    expect(build(["a", "b"], "c")).toEqual([]);
  });

  it("keeps Drag & Drop of the only cabinet, disabled, while another placement is open", () => {
    const [reposition] = build(["a"], "a", { supported: true, available: false });

    expect(reposition.children?.map(({ id, disabled }) => ({ id, disabled }))).toEqual([
      { id: "reposition-drag", disabled: true },
    ]);
  });

  it("offers only the moves where the scene cannot drag a cabinet", () => {
    expect(options(build(["a", "b", "c"], "a", cannotDrag))).toEqual(["reposition-right"]);
    expect(options(build(["a", "b", "c"], "c", cannotDrag))).toEqual(["reposition-left"]);
  });

  it("keeps Drag & Drop, disabled with the reason, while another placement is open", () => {
    const [reposition] = build(["a", "b"], "a", { supported: true, available: false });

    expect(reposition.children?.find(({ id }) => id === "reposition-drag")).toMatchObject({
      disabled: true,
      disabledReason: "Finish the current placement before repositioning a cabinet.",
    });
  });

  it("never moves a side shelf off the end of its row", () => {
    // A cabinet does not swap with the shelf at the end of the row, and the shelf stays there.
    expect(options(build(["shelf", "a", "b"], "a", cannotDrag))).toEqual(["reposition-right"]);
    expect(build(["shelf", "a", "b"], "shelf", cannotDrag)).toEqual([]);
    // With the one cabinet it stands by, the shelf changes sides.
    expect(options(build(["shelf", "a"], "shelf", cannotDrag))).toEqual(["reposition-right"]);
  });

  it("hands Move the neighbour it swaps with, and starts the drag from Drag & Drop", () => {
    const onMove = vi.fn();
    const onDragDrop = vi.fn();
    const [reposition] = buildRepositionItems({
      order: ["a", "b", "c"],
      cabinetId: "b",
      isSideShelf,
      dragDrop: canDrag,
      onMove,
      onDragDrop,
    });
    const option = (id: string) => reposition.children?.find((child) => child.id === id);

    option("reposition-left")?.onClick?.();
    option("reposition-right")?.onClick?.();
    option("reposition-drag")?.onClick?.();

    expect(onMove.mock.calls).toEqual([["a"], ["c"]]);
    expect(onDragDrop).toHaveBeenCalledOnce();
  });
});
