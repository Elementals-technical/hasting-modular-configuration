import type { DropdownItem } from "@/shared/ui/NestedDropdown/NestedDropdown";

import { MoveIcon } from "../ui/countertopIcons";

export type CountertopPositionMenuState = { supported: boolean; available: boolean; active: boolean };

/** "Position ▸ Standard | Drag & Drop" of the selected countertop's menu. */
export const buildCountertopPositionItems = (
  status: CountertopPositionMenuState,
  actions: { onStandard(): void; onDragDrop(): void },
): DropdownItem[] =>
  status.supported
    ? [
        {
          id: "countertop-position",
          label: "Position",
          children: [
            {
              id: "countertop-position-standard",
              label: "Standard",
              disabled: !status.available && !status.active,
              onClick: actions.onStandard,
            },
            {
              id: "countertop-position-drag",
              label: "Drag & Drop",
              trailing: <MoveIcon size={14} />,
              disabled: !status.available || status.active,
              onClick: actions.onDragDrop,
            },
          ],
        },
      ]
    : [];

/** Test mode only (`?countertopSettings`): the metre-based Position & Size modal. */
export const isCountertopSettingsMode = (search: string) => new URLSearchParams(search).has("countertopSettings");
