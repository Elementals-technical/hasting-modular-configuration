// @vitest-environment jsdom

import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import { store } from "@/app/store";
import { ProductOptionItem } from "../ProductOptionItem/ProductOptionItem";
import { ProductStyleItem } from "../ProductStyleItem/ProductStyleItem";
import { ProductOptionsGrid } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";

afterEach(cleanup);
const renderCard = (card: ReactNode) =>
  render(
    <Provider store={store}>
      <MemoryRouter>{card}</MemoryRouter>
    </Provider>,
  );

describe("product card selection and independent actions", () => {
  it("blocks selection while a grid loads and makes its options usable when loading finishes", () => {
    const select = vi.fn();
    const data = [{ id: "white", title: "White", isShortDesc: false }];
    const grid = (loading: boolean) => (
      <Provider store={store}>
        <MemoryRouter>
          <ProductOptionsGrid data={data} handleAdd={select} isLoading={loading} />
        </MemoryRouter>
      </Provider>
    );
    const { container, rerender } = render(grid(true));
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "White" }));
    expect(select).not.toHaveBeenCalled();
    rerender(grid(false));
    expect(container.querySelector('[aria-busy="true"]')).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "White" }));
    expect(select).toHaveBeenCalledExactlyOnceWith("White", undefined, undefined);
  });
  it("selects an option by its configuration value and exposes selected state", () => {
    const select = vi.fn();
    const setActive = vi.fn();
    const metadata = { hex: "#ffffff" };
    renderCard(
      <ProductOptionItem
        id="white"
        title="White"
        name="White-MT"
        isShortDesc={false}
        metadata={metadata}
        isActive
        onClick={select}
        setActive={setActive}
      />,
    );

    const button = screen.getByRole("button", { name: "White", pressed: true });
    expect(button.getAttribute("type")).toBe("button");
    fireEvent.click(button);
    expect(select).toHaveBeenCalledExactlyOnceWith("White-MT", undefined, metadata);
    expect(setActive).toHaveBeenCalledExactlyOnceWith("white");
  });

  it("previews a material without selecting it or nesting the preview button", () => {
    const select = vi.fn();
    const preview = vi.fn();
    const metadata = { hex: "#ffffff" };
    const { container } = renderCard(
      <ProductOptionItem
        id="white"
        title="White"
        isShortDesc={false}
        metadata={metadata}
        onClick={select}
        onPreview={preview}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Preview White" }));
    expect(preview).toHaveBeenCalledExactlyOnceWith("White", metadata);
    expect(select).not.toHaveBeenCalled();
    expect(container.querySelector("button button, button a")).toBeNull();
  });

  it("blocks unavailable selection while keeping its recovery action usable", () => {
    const select = vi.fn();
    const setActive = vi.fn();
    const recover = vi.fn();
    renderCard(
      <ProductOptionItem
        id="white"
        title="White"
        isShortDesc={false}
        isAvailable={false}
        onClick={select}
        setActive={setActive}
        disabledActionLabel="Change material"
        onDisabledAction={recover}
      />,
    );

    const button = screen.getByRole("button", { name: "White" });
    expect(button.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(button);
    expect(select).not.toHaveBeenCalled();
    expect(setActive).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Change material" }));
    expect(recover).toHaveBeenCalledOnce();
    expect(select).not.toHaveBeenCalled();
  });

  it("selects a style and opens its editor once", () => {
    const select = vi.fn();
    const open = vi.fn();
    renderCard(
      <ProductStyleItem value="2" title="Two drawers" isActive onSelectStyle={select} handleOpenStyleSidebar={open} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Two drawers", pressed: true }));
    expect(select).toHaveBeenCalledExactlyOnceWith("2");
    expect(open).toHaveBeenCalledOnce();
  });

  it("keeps Product Details a separate link without selecting or opening the editor", () => {
    const select = vi.fn();
    const open = vi.fn();
    const { container } = renderCard(
      <ProductStyleItem
        value="2"
        title="Two drawers"
        detailsTo="/styles/2?collectionId=test"
        onSelectStyle={select}
        handleOpenStyleSidebar={open}
      />,
    );

    const link = screen.getByRole("link", { name: "Product Details" });
    expect(link.getAttribute("href")).toBe("/styles/2?collectionId=test");
    fireEvent.click(link);
    expect(select).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    expect(container.querySelector("button button, button a")).toBeNull();
  });

  it("routes restricted style selection through the confirmation action", () => {
    const select = vi.fn();
    const open = vi.fn();
    const confirm = vi.fn();
    renderCard(
      <ProductStyleItem
        value="inner"
        title="Inner drawer"
        isMixingRestricted
        onSelectStyle={select}
        handleOpenStyleSidebar={open}
        onMixingRestrictedSelect={confirm}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Inner drawer" }));
    expect(confirm).toHaveBeenCalledExactlyOnceWith("inner");
    expect(select).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it("does not select or prompt for an unavailable restricted style", () => {
    const select = vi.fn();
    const open = vi.fn();
    const confirm = vi.fn();
    renderCard(
      <ProductStyleItem
        value="inner"
        title="Inner drawer"
        isAvailable={false}
        isMixingRestricted
        onSelectStyle={select}
        handleOpenStyleSidebar={open}
        onMixingRestrictedSelect={confirm}
      />,
    );

    const button = screen.getByRole("button", { name: "Inner drawer" });
    expect(button.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(button);
    expect(confirm).not.toHaveBeenCalled();
    expect(select).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });
});
