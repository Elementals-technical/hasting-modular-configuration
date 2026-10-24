import { formatCountertopThicknessLabel } from "@/entities/countertop";
import type { DropdownItem } from "@/shared/ui/NestedDropdown/NestedDropdown";

import type { CountertopPositionMenuState } from "./positionMenuItems";

/**
 * "Thickness ▸ …" of the selected countertop's menu, in Prebuilt as in Custom: the thicknesses the
 * rules allow, each changing the top in place. With none allowed the submenu is empty, and the menu
 * leaves it out. `labelOf` names a thickness, as the collection's profile does.
 */
export const buildCountertopThicknessItem = (
  thicknesses: readonly number[],
  onSelect: (thickness: number) => void,
  labelOf: (thickness: number) => string | null = formatCountertopThicknessLabel,
): DropdownItem => ({
  id: "countertop-thickness",
  label: "Thickness",
  children: thicknesses.map((value) => {
    const label = labelOf(value) ?? String(value);
    return { id: label, label, onClick: () => onSelect(value) };
  }),
});

/**
 * "Resize ▸ Thickness | Length" of the selected countertop's menu. Thickness is
 * `buildCountertopThicknessItem`; Length opens the Drag & Drop overlay without moving the top, and only a
 * top whose Thickness option declares `countertopLengthResize` (`isLengthResizableThickness`) offers it.
 * Not the cabinets' `resize` item: hiding one leaves the other.
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
