import type { ReactNode } from "react";

import type { PerCabinetAttributeField } from "@/features/configurationCommands";
import type { DropdownItem } from "@/shared/ui/NestedDropdown/NestedDropdown";

/**
 * The menu entries of the values a placed cabinet has of its own (`playerMenu.attributes` of the
 * collection's ui.json): each a submenu of its options, the cabinet's value marked with `check`.
 * Urban Duplex lists the side of the lateral panel; a collection that lists none gets no entry.
 */
export const buildCabinetAttributeMenuItems = (
  fields: readonly PerCabinetAttributeField[],
  onSelect: (attributeId: string, value: string, applyToAll?: boolean) => void,
  check: ReactNode,
  broadcast?: { checked: boolean; onToggle: () => void },
): DropdownItem[] =>
  fields.map(({ attributeId, label, options, value, canApplyToAll }) => ({
    id: `cabinet-attribute:${attributeId}`,
    label,
    trailing: "",
    children: [
      ...(canApplyToAll && broadcast
        ? [
            {
              id: `cabinet-attribute:${attributeId}:apply-to-all`,
              label: "Apply to all cabinets",
              checked: broadcast.checked,
              trailing: broadcast.checked ? check : "☐",
              onClick: broadcast.onToggle,
            },
          ]
        : []),
      ...options.map((option) => ({
        id: `cabinet-attribute:${attributeId}:${option.value}`,
        label: option.label,
        trailing: option.value === value ? check : null,
        disabled: option.disabled,
        onClick: () =>
          canApplyToAll && broadcast
            ? onSelect(attributeId, option.value, broadcast.checked)
            : onSelect(attributeId, option.value),
      })),
    ],
  }));
