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
  onSelect: (attributeId: string, value: string) => void,
  check: ReactNode,
): DropdownItem[] =>
  fields.map(({ attributeId, label, options, value }) => ({
    id: `cabinet-attribute:${attributeId}`,
    label,
    trailing: "",
    children: options.map((option) => ({
      id: `cabinet-attribute:${attributeId}:${option.value}`,
      label: option.label,
      trailing: option.value === value ? check : null,
      onClick: () => onSelect(attributeId, option.value),
    })),
  }));
