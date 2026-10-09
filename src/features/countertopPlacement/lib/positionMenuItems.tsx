import type { DropdownItem } from "@/shared/ui/NestedDropdown/NestedDropdown";

import { MoveIcon } from "../ui/countertopIcons";
import type { CountertopMovementMode } from "./useCountertopMovementMode";

export type CountertopPositionMenuState = { supported: boolean; available: boolean; active: boolean };

/** "Position ▸ Standard | Drag & Drop" of the selected countertop's menu; none for a top that never moves. */
export const buildCountertopPositionItems = (
  status: CountertopPositionMenuState,
  actions: { onStandard(): void; onDragDrop(): void },
  mode: CountertopMovementMode | null = null,
): DropdownItem[] =>
  status.supported && mode !== "none"
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
