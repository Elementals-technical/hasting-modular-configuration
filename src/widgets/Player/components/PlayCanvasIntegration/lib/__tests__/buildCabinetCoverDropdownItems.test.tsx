import { describe, expect, it, vi } from "vitest";

import type { PlayerMenuItemId } from "@/entities/collection";
import type { SelectionAction } from "@/utils/functions/playcanvas/getSelectTool";

import { applyPlayerMenuSupport } from "../applyPlayerMenuSupport";
import { buildCabinetCoverDropdownItems } from "../buildCabinetCoverDropdownItems";

const colorAction: SelectionAction = {
  id: "color",
  label: "Color",
  target: "cabinetCover",
  configKey: "CoverCountertopColor",
  productId: "Cabinet_Cover-1",
};

const support = (...items: PlayerMenuItemId[]) => ({ items: new Set<PlayerMenuItemId>(items) });

describe("the menu of a Lower countertop picked in the player", () => {
  it("leads to the countertop colour step and nowhere else", () => {
    const onOpenColor = vi.fn();
    const items = buildCabinetCoverDropdownItems({ actions: [colorAction], onOpenColor });

    expect(items.map((item) => item.id)).toEqual(["countertop-color"]);
    expect(items[0].label).toBe("Color");
    expect(items[0].children?.map((child) => child.label)).toEqual(["Select Color"]);

    items[0].children?.[0].onClick?.();
    expect(onOpenColor).toHaveBeenCalledTimes(1);
  });

  it("leaves out an action the player cannot answer, and offers nothing without one", () => {
    const onOpenColor = vi.fn();

    expect(buildCabinetCoverDropdownItems({ actions: [{ id: "delete", label: "Delete" }], onOpenColor })).toEqual([]);
    expect(buildCabinetCoverDropdownItems({ actions: [], onOpenColor })).toEqual([]);
  });

  it("is left out by a collection whose menu has no countertop colour item", () => {
    const items = buildCabinetCoverDropdownItems({ actions: [colorAction], onOpenColor: vi.fn() });

    expect(applyPlayerMenuSupport(items, support("countertop-color"))).toHaveLength(1);
    expect(applyPlayerMenuSupport(items, support("color"))).toEqual([]);
  });
});
