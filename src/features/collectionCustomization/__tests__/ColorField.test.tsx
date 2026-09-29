// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { store } from "@/app/store";
import type { FieldRuntimeState } from "@/entities/collection";

import { ColorField } from "../ui/ColorField";

afterEach(cleanup);

// The vessel colours of a Blade 11 vessel, which is ceramic only.
const vesselColors: FieldRuntimeState = {
  attributeId: "VesselColor",
  value: "",
  options: [
    { value: "Antracite Matte OCF", label: "Antracite Matte OCF", enabled: true, desc: "Ceramic" },
    {
      value: "Matte White T1C",
      label: "Matte White T1C",
      enabled: false,
      desc: "Solid Surface",
      reasonCode: "vessel.colorUnavailable",
    },
  ],
  visible: true,
  enabled: true,
};

describe("ColorField", () => {
  it("chooses a colour its rules allow and not one they refuse", () => {
    const onChange = vi.fn();
    render(
      <Provider store={store}>
        <MemoryRouter>
          <ColorField field={vesselColors} title="Vessel Color" onChange={onChange} onOrderSwatches={vi.fn()} />
        </MemoryRouter>
      </Provider>,
    );

    fireEvent.click(screen.getByText("Matte White T1C"));
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Antracite Matte OCF"));
    expect(onChange.mock.calls.map(([value]) => value)).toEqual(["Antracite Matte OCF"]);
  });
});
