import { ArrowTopRight } from "@/shared/assets/images/svg/ArrowTopRight.tsx";
import type { DropdownItem } from "@/shared/ui/NestedDropdown/NestedDropdown";
import type { SelectionAction } from "@/utils/functions/playcanvas/getSelectTool";

import { normalizeSelectionActionKey, SELECTION_ACTION_COLOR_ID } from "./vesselBasinSelection";

type BuildCabinetCoverDropdownItemsParams = {
  actions: SelectionAction[];
  onOpenColor: () => void;
};

/**
 * The menu of a Lower countertop picked in the player. Its colour is the one thing the scene offers
 * on it, and it is not changed in place: the entry leads to the countertop colour step, which opens
 * on its Lower tab. An action the scene names that the player cannot answer is left out.
 */
export const buildCabinetCoverDropdownItems = ({
  actions,
  onOpenColor,
}: BuildCabinetCoverDropdownItemsParams): DropdownItem[] =>
  actions.flatMap((action) =>
    normalizeSelectionActionKey(action) === SELECTION_ACTION_COLOR_ID
      ? [
          {
            // The player menu item id, so a collection without the countertop colour step leaves it out.
            id: "countertop-color",
            label: action.label || "Color",
            children: [
              {
                id: "cabinet-cover-select-color",
                label: "Select Color",
                trailing: <ArrowTopRight color={"#333"} />,
                onClick: onOpenColor,
              },
            ],
          },
        ]
      : [],
  );
