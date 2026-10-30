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

const detailsTo = (query: string) => `/custom/cabinet-builder/details/style?${query}`;

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
        detailsTo={detailsTo}
        handleOpenStyleSidebar={() => {}}
        onSelectStyle={onSelectStyle}
      />,
    );
    fireEvent.click(screen.getByText("2 Drawer"));

    expect(onSelectStyle).toHaveBeenCalledWith("2");
  });

  it("marks the card whose value is active", () => {
    const { container } = renderGrid(
      <ProductStyleGrid data={DATA} detailsTo={detailsTo} handleOpenStyleSidebar={() => {}} isActive activeValue="1" />,
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
        detailsTo={detailsTo}
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
    renderGrid(<ProductStyleGrid data={DATA} detailsTo={detailsTo} handleOpenStyleSidebar={() => {}} />);

    const links = screen.getAllByText("Product Details").map((node) => node.closest("a")?.getAttribute("href"));
    expect(links[0]).toContain("style=2");
    expect(links[2]).toContain("style=1%2Binner");
  });
});

/**
 * Where several series supply the cabinet type, the cards stand under the name of their series
 * (Urban Duplex: the side cabinets of Urban Standard and Urban Low Height).
 */
describe("ProductStyleGrid with the styles of several series", () => {
  const SERIES_DATA = [
    { value: "2", title: "2 Drawer", isShortDesc: false, group: "Urban Duplex" },
    { value: "1", title: "1 Drawer", isShortDesc: false, group: "Urban Duplex" },
    {
      value: "URSTD:2",
      title: "2 Drawer",
      isShortDesc: false,
      group: "Urban Standard",
      detailsQuery: { style: "2", series: "URSTD" },
    },
    { value: "URLH:1", title: "1 Drawer", isShortDesc: false, group: "Urban Low Height", isMixingRestricted: true },
  ];
  const groupTitles = (container: HTMLElement) =>
    Array.from(container.querySelectorAll('[class*="groupTitle"]')).map((node) => node.textContent);
  const cardsUnder = (container: HTMLElement, group: string) => {
    const section = Array.from(container.querySelectorAll("section")).find(
      (node) => node.querySelector('[class*="groupTitle"]')?.textContent === group,
    );
    return Array.from(section?.querySelectorAll("button[aria-label]") ?? []).map((node) =>
      node.getAttribute("aria-label"),
    );
  };

  it("puts each card under the name of its series, in the order given", () => {
    const { container } = renderGrid(
      <ProductStyleGrid data={SERIES_DATA} detailsTo={detailsTo} handleOpenStyleSidebar={() => {}} />,
    );

    expect(groupTitles(container)).toEqual(["Urban Duplex", "Urban Standard", "Urban Low Height"]);
    expect(cardsUnder(container, "Urban Duplex")).toEqual(["2 Drawer", "1 Drawer"]);
    expect(cardsUnder(container, "Urban Standard")).toEqual(["2 Drawer"]);
    expect(cardsUnder(container, "Urban Low Height")).toEqual(["1 Drawer"]);
  });

  it("shows no heading for the styles of one series, nor without any", () => {
    const oneSeries = renderGrid(
      <ProductStyleGrid data={SERIES_DATA.slice(0, 2)} detailsTo={detailsTo} handleOpenStyleSidebar={() => {}} />,
    );
    expect(groupTitles(oneSeries.container)).toEqual([]);
    cleanup();

    const plain = renderGrid(<ProductStyleGrid data={DATA} detailsTo={detailsTo} handleOpenStyleSidebar={() => {}} />);
    expect(groupTitles(plain.container)).toEqual([]);
    expect(plain.container.querySelectorAll("button[aria-label]")).toHaveLength(3);
  });

  it("tells two cards with one title apart by their value", () => {
    const onSelectStyle = vi.fn();
    const onMixingRestrictedSelect = vi.fn();
    const { container } = renderGrid(
      <ProductStyleGrid
        data={SERIES_DATA}
        detailsTo={detailsTo}
        handleOpenStyleSidebar={() => {}}
        isActive
        activeValue="URSTD:2"
        onSelectStyle={onSelectStyle}
        onMixingRestrictedSelect={onMixingRestrictedSelect}
      />,
    );

    fireEvent.click(screen.getAllByText("2 Drawer")[1]);
    expect(onSelectStyle).toHaveBeenCalledWith("URSTD:2");
    fireEvent.click(screen.getAllByText("1 Drawer")[1]);
    expect(onMixingRestrictedSelect).toHaveBeenCalledWith("URLH:1");

    // Only the Urban Standard card is the active one.
    expect(container.querySelectorAll('[class*="activeItem"]')).toHaveLength(1);
  });

  it("asks for the details of a card with the style and series it stands for", () => {
    const { container } = renderGrid(
      <ProductStyleGrid data={SERIES_DATA} detailsTo={detailsTo} handleOpenStyleSidebar={() => {}} />,
    );
    const links = Array.from(container.querySelectorAll("a")).map((node) => node.getAttribute("href") ?? "");

    expect(links[2]).toContain("style=2");
    expect(links[2]).toContain("series=URSTD");
    expect(links[0]).not.toContain("series=");
  });
});
