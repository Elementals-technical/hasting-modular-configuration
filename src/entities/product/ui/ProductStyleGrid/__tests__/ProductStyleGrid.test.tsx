// @vitest-environment jsdom
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { store } from "@/app/store";

import { reset, setActiveCabinetType } from "../../../model/store/slice";
import { ProductStyleGrid } from "../ProductStyleGrid";

/**
 * A style card is identified by the option value it stands for. Nothing keeps a card id, so the
 * grid hands the value back and marks the active card by comparing values.
 */

const DATA = [
  { value: "2", title: "2 Drawer", isShortDesc: false },
  { value: "1", title: "1 Drawer", isShortDesc: false },
  { value: "1+inner", title: "1 Drawer With Inner Drawer", isShortDesc: false, isMixingRestricted: true },
];

const renderGrid = (children: ReactNode) =>
  render(
    <Provider store={store}>
      <MemoryRouter>{children}</MemoryRouter>
    </Provider>,
  );

beforeEach(() => {
  store.dispatch(reset());
  store.dispatch(setActiveCabinetType("Sink-Base"));
});

afterEach(cleanup);

describe("ProductStyleGrid", () => {
  it("reports the option value of the card that was clicked", () => {
    const onSelectStyle = vi.fn();

    renderGrid(
      <ProductStyleGrid
        data={DATA}
        styleDetailsPath="/custom/cabinet-builder/details/style"
        handleOpenStyleSidebar={() => {}}
        onSelectStyle={onSelectStyle}
      />,
    );
    fireEvent.click(screen.getByText("2 Drawer"));

    expect(onSelectStyle).toHaveBeenCalledWith("2");
  });

  it("marks the card whose value is active", () => {
    const { container } = renderGrid(
      <ProductStyleGrid
        data={DATA}
        styleDetailsPath="/custom/cabinet-builder/details/style"
        handleOpenStyleSidebar={() => {}}
        isActive
        activeValue="1"
      />,
    );

    const active = container.querySelectorAll('[class*="activeItem"]');
    expect(active).toHaveLength(1);
    expect(active[0]?.textContent).toContain("1 Drawer");
  });

  it("sends a style the collection does not mix to the prompt instead of selecting it", () => {
    const onSelectStyle = vi.fn();
    const onMixingRestrictedSelect = vi.fn();

    renderGrid(
      <ProductStyleGrid
        data={DATA}
        styleDetailsPath="/custom/cabinet-builder/details/style"
        handleOpenStyleSidebar={() => {}}
        onSelectStyle={onSelectStyle}
        onMixingRestrictedSelect={onMixingRestrictedSelect}
      />,
    );
    fireEvent.click(screen.getByText("1 Drawer With Inner Drawer"));

    expect(onMixingRestrictedSelect).toHaveBeenCalledWith("1+inner");
    expect(onSelectStyle).not.toHaveBeenCalled();
  });

  it("carries the value into the details link", () => {
    renderGrid(
      <ProductStyleGrid
        data={DATA}
        styleDetailsPath="/custom/cabinet-builder/details/style"
        handleOpenStyleSidebar={() => {}}
      />,
    );

    const links = screen.getAllByText("Product Details").map((node) => node.closest("a")?.getAttribute("href"));
    expect(links[0]).toContain("style=2");
    expect(links[2]).toContain("style=1%2Binner");
  });
});
