import { describe, expect, it, vi } from "vitest";

import type { PerCabinetAttributeField } from "@/features/configurationCommands";

import { buildCabinetAttributeMenuItems } from "../buildCabinetAttributeMenuItems";

const side: PerCabinetAttributeField = {
  attributeId: "LateralPanelSide",
  label: "Lateral Panel",
  options: [
    { value: "L", label: "Left" },
    { value: "R", label: "Right" },
  ],
  value: "R",
};

describe("the menu entries of a placed cabinet's own values", () => {
  it("is a submenu of the options, the cabinet's value marked", () => {
    const [item] = buildCabinetAttributeMenuItems([side], vi.fn(), "✓");

    expect(item).toMatchObject({ id: "cabinet-attribute:LateralPanelSide", label: "Lateral Panel" });
    expect(item.children?.map(({ label, trailing }) => [label, trailing])).toEqual([
      ["Left", null],
      ["Right", "✓"],
    ]);
  });

  it("hands the picked option to the caller with its attribute", () => {
    const onSelect = vi.fn();
    const [item] = buildCabinetAttributeMenuItems([side], onSelect, "✓");

    item.children?.[0].onClick?.();

    expect(onSelect).toHaveBeenCalledExactlyOnceWith("LateralPanelSide", "L");
  });

  it("has no entry for a collection that offers no such value", () => {
    expect(buildCabinetAttributeMenuItems([], vi.fn(), "✓")).toEqual([]);
  });

  it.each([false, true])("offers an apply-to-all checkbox and sends its %s state with the pattern", (checked) => {
    const onSelect = vi.fn();
    const onToggle = vi.fn();
    const [item] = buildCabinetAttributeMenuItems([{ ...side, canApplyToAll: true }], onSelect, "✓", {
      checked,
      onToggle,
    });
    const [toggle, option] = item.children ?? [];
    expect(toggle).toMatchObject({ label: "Apply to all cabinets", checked });
    toggle.onClick?.();
    expect(onToggle).toHaveBeenCalledOnce();
    option.onClick?.();
    expect(onSelect).toHaveBeenCalledExactlyOnceWith("LateralPanelSide", "L", checked);
  });
});
