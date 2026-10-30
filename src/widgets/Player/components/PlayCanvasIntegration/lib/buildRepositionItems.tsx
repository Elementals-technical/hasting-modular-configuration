import type { CabinetRepositionAvailability } from "@/features/cabinetPlacementDebug/ui/CabinetPlacementDebug";
import { MoveIcon } from "@/features/cabinetPlacementDebug/ui/placementIcons";
import type { DropdownItem } from "@/shared/ui/NestedDropdown/NestedDropdown";

type BuildRepositionItemsParams = {
  /** The placed products along the wall, in the composition's order. */
  order: readonly string[];
  cabinetId: string;
  isSideShelf: (runtimeId: string) => boolean;
  /** Whether the scene can drag a placed cabinet (a Drag & Drop collection), and whether it can now. */
  dragDrop: CabinetRepositionAvailability;
  /** Swaps the cabinet with this neighbour. */
  onMove: (neighborId: string) => void;
  onDragDrop: () => void;
};

/**
 * "Reposition ▸ Move Left | Move Right | Drag & Drop" of the selected cabinet's menu. The only cabinet
 * has no neighbour to swap with, so it gets Drag & Drop alone, and no Reposition where the scene can't
 * drag it. A move swaps the cabinet with its neighbour and never takes a side shelf off the end of its
 * row: a shelf at an end is not pushed inward, and a shelf changes sides only with the one cabinet it
 * stands by.
 */
export const buildRepositionItems = ({
  order,
  cabinetId,
  isSideShelf,
  dragDrop,
  onMove,
  onDragDrop,
}: BuildRepositionItemsParams): DropdownItem[] => {
  const index = order.indexOf(cabinetId);
  if (index === -1) return [];

  const canMove = !isSideShelf(cabinetId) || (order.length === 2 && order.some((id) => !isSideShelf(id)));
  const neighbor = (at: number): string | null => {
    if (!canMove || at < 0 || at >= order.length) return null;
    const shelfAtEnd = isSideShelf(order[at]) && (at === 0 || at === order.length - 1) && order.length > 2;
    return shelfAtEnd ? null : order[at];
  };
  const left = neighbor(index - 1);
  const right = neighbor(index + 1);

  const options: DropdownItem[] = [
    ...(left ? [{ id: "reposition-left", label: "Move Left", onClick: () => onMove(left) }] : []),
    ...(right ? [{ id: "reposition-right", label: "Move Right", onClick: () => onMove(right) }] : []),
    ...(dragDrop.supported
      ? [
          {
            id: "reposition-drag",
            label: "Drag & Drop",
            trailing: <MoveIcon size={14} />,
            disabled: !dragDrop.available,
            disabledReason: dragDrop.available
              ? undefined
              : "Finish the current placement before repositioning a cabinet.",
            onClick: onDragDrop,
          },
        ]
      : []),
  ];

  return options.length > 0 ? [{ id: "reposition", label: "Reposition", children: options }] : [];
};
