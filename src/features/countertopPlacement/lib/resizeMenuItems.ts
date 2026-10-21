import type { DropdownItem } from "@/shared/ui/NestedDropdown/NestedDropdown";

import type { CountertopPositionMenuState } from "./positionMenuItems";

/**
 * "Resize ▸ Thickness | Length" of the selected countertop's menu. Thickness is the item each flow
 * builds itself; Length opens the Drag & Drop overlay without moving the top, and only a thick top
 * (`isLengthResizableThickness`) offers it. Not the cabinets' `resize` item: hiding one leaves the other.
 */
export const buildCountertopResizeItems = (
  thickness: DropdownItem | null,
  status: CountertopPositionMenuState,
  lengthResizable: boolean,
  onLength: () => void,
): DropdownItem[] => {
  const children: DropdownItem[] = [
    ...(thickness ? [thickness] : []),
    ...(status.supported && lengthResizable
      ? [
          {
            id: "countertop-length",
            label: "Length",
            disabled: !status.available || status.active,
            onClick: onLength,
          },
        ]
      : []),
  ];
  return children.length > 0 ? [{ id: "countertop-resize", label: "Resize", children }] : [];
};
