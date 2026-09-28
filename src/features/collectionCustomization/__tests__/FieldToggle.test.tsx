// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FieldToggle } from "../ui/FieldToggle";

/** Mako's legs: On keeps them in the cabinet colour ("None"), Off takes them off (""). */
const legs = (on: boolean) => ({ label: "Enable Legs, Then Color", on, onValue: "None", offValue: "" });

const side = (name: "On" | "Off") => screen.getByRole("button", { name });

describe("FieldToggle", () => {
  afterEach(cleanup);

  it("shows the side the field is on as chosen, under the text the collection gives it", () => {
    render(<FieldToggle toggle={legs(false)} onChange={vi.fn()} />);

    expect(screen.getByText("Enable Legs, Then Color")).toBeTruthy();
    expect(side("Off").getAttribute("aria-pressed")).toBe("true");
    expect(side("On").getAttribute("aria-pressed")).toBe("false");
  });

  it("sets the value of the side picked", () => {
    const onChange = vi.fn();
    const { rerender } = render(<FieldToggle toggle={legs(false)} onChange={onChange} />);

    fireEvent.click(side("On"));
    expect(onChange).toHaveBeenLastCalledWith("None");

    rerender(<FieldToggle toggle={legs(true)} onChange={onChange} />);
    fireEvent.click(side("Off"));
    expect(onChange).toHaveBeenLastCalledWith("");
  });

  it("changes nothing when the chosen side is picked again, so On keeps a chosen colour", () => {
    const onChange = vi.fn();
    render(<FieldToggle toggle={legs(true)} onChange={onChange} />);

    fireEvent.click(side("On"));
    expect(onChange).not.toHaveBeenCalled();
  });
});
