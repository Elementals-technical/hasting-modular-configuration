import { describe, expect, it } from "vitest";

import { PLAYER_MENU_ITEM_IDS, type PlayerMenuItemId } from "@/entities/collection";
import type { DropdownItem } from "@/shared/ui/NestedDropdown/NestedDropdown";

import { applyPlayerMenuSupport } from "../applyPlayerMenuSupport";

const supporting = (itemIds: readonly PlayerMenuItemId[]) => ({ items: new Set(itemIds), targets: {} });

const ids = (items: DropdownItem[]): unknown[] =>
  items.map((item) => (item.children ? { [item.id]: ids(item.children) } : item.id));

/** The custom-flow cabinet menu in the shape the player builds it. */
const cabinetMenu: DropdownItem[] = [
  {
    id: "resize",
    label: "Resize",
    children: [{ id: "resize-width", label: "Width", children: [{ id: "resize-width-60", label: '24"' }] }],
  },
  { id: "color", label: "Color", children: [{ id: "cabinet-select-color", label: "Select Color" }] },
  {
    id: "details",
    label: "Details",
    children: [
      { id: "cabinet-style", label: "Cabinet Style" },
      { id: "handle-style", label: "Handle Style", children: [] },
      { id: "accessories", label: "Accessories" },
    ],
  },
  { id: "duplicate", label: "Duplicate" },
  { id: "delete", label: "Delete" },
];

describe("applyPlayerMenuSupport", () => {
  it("keeps the whole menu for a collection that supports every item", () => {
    expect(ids(applyPlayerMenuSupport(cabinetMenu, supporting(PLAYER_MENU_ITEM_IDS)))).toEqual([
      { resize: [{ "resize-width": ["resize-width-60"] }] },
      { color: ["cabinet-select-color"] },
      // A submenu with nothing to choose is not offered.
      { details: ["cabinet-style", "accessories"] },
      "duplicate",
      "delete",
    ]);
  });

  it("leaves out the items the collection does not support, inside submenus too", () => {
    const withoutAccessoriesAndDuplicate = PLAYER_MENU_ITEM_IDS.filter(
      (id) => id !== "accessories" && id !== "duplicate",
    );

    expect(ids(applyPlayerMenuSupport(cabinetMenu, supporting(withoutAccessoriesAndDuplicate)))).toEqual([
      { resize: [{ "resize-width": ["resize-width-60"] }] },
      { color: ["cabinet-select-color"] },
      { details: ["cabinet-style"] },
      "delete",
    ]);
  });

  it("drops a submenu whose every entry is left out", () => {
    const supported = PLAYER_MENU_ITEM_IDS.filter((id) => id !== "cabinet-style" && id !== "accessories");

    expect(ids(applyPlayerMenuSupport(cabinetMenu, supporting(supported)))).not.toContainEqual(
      expect.objectContaining({ details: expect.anything() }),
    );
  });

  it("keeps entries that are not player menu items, such as the options of a submenu", () => {
    const [resize] = applyPlayerMenuSupport(cabinetMenu, supporting(["resize"]));

    expect(resize.children?.[0].children?.[0].id).toBe("resize-width-60");
  });
});
