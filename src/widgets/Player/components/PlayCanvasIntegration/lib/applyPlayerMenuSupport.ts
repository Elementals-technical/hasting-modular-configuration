import { PLAYER_MENU_ITEM_IDS, type PlayerMenuItemId } from "@/entities/collection";
import type { DropdownItem } from "@/shared/ui/NestedDropdown/NestedDropdown";

import type { PlayerMenuSupport } from "./playerMenuCatalog";

const MENU_ITEM_IDS = new Set<string>(PLAYER_MENU_ITEM_IDS);

const isPlayerMenuItemId = (id: string): id is PlayerMenuItemId => MENU_ITEM_IDS.has(id);

/**
 * The menu as the active collection offers it: an item of the player menu the collection does not
 * support or hides is left out, and so is a submenu left with nothing in it (Details without its
 * entries, Handle Style without handles). Items that are not player menu items (an option of a
 * submenu, a debug entry) are kept as they are.
 */
export const applyPlayerMenuSupport = (items: DropdownItem[], support: PlayerMenuSupport): DropdownItem[] =>
  items.flatMap((item) => {
    if (isPlayerMenuItemId(item.id) && !support.items.has(item.id)) return [];
    if (!item.children) return [item];

    const children = applyPlayerMenuSupport(item.children, support);
    return children.length > 0 ? [{ ...item, children }] : [];
  });
