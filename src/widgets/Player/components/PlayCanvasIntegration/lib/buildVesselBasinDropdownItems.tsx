import { ArrowTopRight } from "@/shared/assets/images/svg/ArrowTopRight.tsx";
import { DeleteMenuIcon } from "@/shared/assets/images/svg/DeleteMenuIcon";
import type { DropdownItem } from "@/shared/ui/NestedDropdown/NestedDropdown";
import type { SelectionAction } from "@/utils/functions/playcanvas/getSelectTool";

import {
  canExecuteSetConfigSelectionAction,
  normalizeSelectionActionKey,
  SELECTION_ACTION_COLOR_ID,
  SELECTION_ACTION_DELETE_ID,
} from "./vesselBasinSelection";

type BuildVesselBasinDropdownItemsParams = {
  actions: SelectionAction[];
  onOpenStyle: () => void;
  onOpenColor: () => void;
  onExecuteAction: (action: SelectionAction) => void | Promise<void>;
};

export const buildVesselBasinDropdownItems = ({
  actions,
  onOpenStyle,
  onOpenColor,
  onExecuteAction,
}: BuildVesselBasinDropdownItemsParams): DropdownItem[] =>
  actions.reduce<DropdownItem[]>((items, action, index) => {
    const actionKey = normalizeSelectionActionKey(action);
    const actionId = actionKey || `action-${index}`;
    const label = action.label || action.id || "Action";

    if (actionKey === SELECTION_ACTION_COLOR_ID && action.configKey) {
      items.push({
        id: `vessel-basin-${actionId}`,
        label,
        children: [
          {
            id: `vessel-basin-${actionId}-select`,
            label: "Select Color",
            trailing: <ArrowTopRight color={"#333"} />,
            onClick: onOpenColor,
          },
        ],
      });
      return items;
    }

    if (canExecuteSetConfigSelectionAction(action)) {
      items.push({
        id: `vessel-basin-${actionId}`,
        label,
        trailing: actionKey === SELECTION_ACTION_DELETE_ID ? <DeleteMenuIcon /> : undefined,
        onClick: () => onExecuteAction(action),
      });
      return items;
    }

    items.push({
      id: `vessel-basin-${actionId}`,
      label,
      disabled: true,
      disabledReason: "Unsupported action descriptor",
    });

    return items;
  }, [
    {
      id: "vessel-basin-style",
      label: "Style",
      children: [
        {
          id: "vessel-basin-style-select",
          label: "Select Style",
          trailing: <ArrowTopRight color={"#333"} />,
          onClick: onOpenStyle,
        },
      ],
    },
  ]);
