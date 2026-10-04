// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { afterEach, describe, expect, it, vi } from "vitest";

import { store } from "@/app/store";
import type { FieldRuntimeState } from "@/entities/collection";

import { FieldControl } from "../ui/FieldControl";

afterEach(cleanup);

const renderField = (ui: React.ReactElement) => render(<Provider store={store}>{ui}</Provider>);

const baseField: FieldRuntimeState = {
  attributeId: "DrawerPanelFluting",
  value: "None",
  options: [
    { value: "None", label: "None", enabled: true },
    { value: "FlutingVerticalA", label: "Vertical Asymmetrical", enabled: true },
    { value: "FlutingVerticalB", label: "Vertical Symmetrical", enabled: false, reason: "Requires Lacquer Matte" },
  ],
  visible: true,
  enabled: true,
};

describe("FieldControl", () => {
  it("renders nothing when the field is not visible", () => {
    const { container } = renderField(
      <FieldControl control="options-grid" field={{ ...baseField, visible: false }} onChange={vi.fn()} />,
    );

    expect(container.innerHTML).toBe("");
  });

  it("renders an options-grid with disabled options kept but marked unavailable", () => {
    renderField(<FieldControl control="options-grid" field={baseField} onChange={vi.fn()} />);

    expect(screen.queryByText("None")).toBeTruthy();
    expect(screen.queryByText("Vertical Asymmetrical")).toBeTruthy();
    expect(screen.queryByText("Vertical Symmetrical")).toBeTruthy();
  });

  it("calls onChange with the option's value when an options-grid item is clicked", () => {
    const onChange = vi.fn();
    renderField(<FieldControl control="options-grid" field={baseField} onChange={onChange} />);

    fireEvent.click(screen.getByText("Vertical Asymmetrical"));

    expect(onChange).toHaveBeenCalledWith("FlutingVerticalA");
  });

  it("filters out disabled options for swatches", () => {
    const swatchField: FieldRuntimeState = {
      ...baseField,
      attributeId: "CabinetColor",
      value: "None",
      options: [
        { value: "A", label: "Color A", enabled: true },
        { value: "B", label: "Color B", enabled: false, reason: "Unavailable" },
      ],
    };

    renderField(<FieldControl control="swatches" field={swatchField} onChange={vi.fn()} />);

    expect(screen.queryByText("Color A")).toBeTruthy();
    expect(screen.queryByText("Color B")).toBeNull();
  });

  it("renders a checkbox reflecting the enabled value convention", () => {
    const checkboxField: FieldRuntimeState = { ...baseField, attributeId: "BookMatching", value: "enabled" };

    renderField(<FieldControl control="checkbox" field={checkboxField} onChange={vi.fn()} />);

    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(true);
  });

  it("calls onChange with the enabled/empty convention when the checkbox is toggled", () => {
    const onChange = vi.fn();
    const checkboxField: FieldRuntimeState = { ...baseField, attributeId: "BookMatching", value: "" };

    renderField(<FieldControl control="checkbox" field={checkboxField} onChange={onChange} />);
    fireEvent.click(screen.getByRole("checkbox"));

    expect(onChange).toHaveBeenCalledWith("enabled");
  });

  it("disables the checkbox when the field is not enabled", () => {
    const checkboxField: FieldRuntimeState = { ...baseField, attributeId: "BookMatching", value: "", enabled: false };

    renderField(<FieldControl control="checkbox" field={checkboxField} onChange={vi.fn()} />);

    expect((screen.getByRole("checkbox") as HTMLInputElement).disabled).toBe(true);
  });
});
