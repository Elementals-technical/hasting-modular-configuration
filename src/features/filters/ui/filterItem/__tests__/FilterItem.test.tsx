// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FilterItem } from "../FilterItem";

describe("FilterItem", () => {
  afterEach(cleanup);

  it("is left out when it has nothing to choose", () => {
    const { container } = render(<FilterItem label="Look" options={[]} />);

    expect(container.childElementCount).toBe(0);
  });

  it("is left out when it offers nothing but All", () => {
    const { container } = render(<FilterItem label="Size" options={[{ label: "All", value: "all" }]} />);

    expect(container.childElementCount).toBe(0);
  });

  it("is shown when it has something to choose", () => {
    render(<FilterItem label="Look" options={[{ label: "Wood", value: "Wood" }]} />);

    expect(screen.getByRole("button", { name: "Look" })).toBeTruthy();
  });

  it("stays shown while it holds a value, so it can be cleared", () => {
    render(<FilterItem label="Look" options={[]} value="Wood" />);

    expect(screen.getByRole("button", { name: "Look" })).toBeTruthy();
  });
});
