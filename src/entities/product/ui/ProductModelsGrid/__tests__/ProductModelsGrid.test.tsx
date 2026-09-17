// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ProductModel } from "@/entities/product/types";

import { ProductModelsGrid } from "../ProductModelsGrid";

afterEach(cleanup);

const renderGrid = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

const preset: ProductModel = {
  id: 901,
  img: "images/fixture-ui.svg",
  title: 'Fixture UI · 31" Demo',
  isProductModel: true,
  presetProducts: [{ name: "Fixture-Cabinet" }],
  size: "30_39",
  style: [],
};

describe("ProductModelsGrid", () => {
  it("renders one card per preset in the given order", () => {
    const second: ProductModel = { ...preset, id: 902, title: "Second Fixture Model" };

    renderGrid(
      <ProductModelsGrid
        data={[preset, second]}
        handleAddPreset={vi.fn()}
        handleCustomizePreset={vi.fn()}
        activePresetId={null}
      />,
    );

    expect(screen.getByText('Fixture UI · 31" Demo')).toBeTruthy();
    expect(screen.getByText("Second Fixture Model")).toBeTruthy();
  });

  it("shows the default empty message when a collection has no presets", () => {
    renderGrid(<ProductModelsGrid data={[]} handleAddPreset={vi.fn()} handleCustomizePreset={vi.fn()} />);

    expect(screen.getByText("No preset compositions available for this collection")).toBeTruthy();
  });

  it("renders a collection-specific empty message", () => {
    renderGrid(
      <ProductModelsGrid
        data={[]}
        handleAddPreset={vi.fn()}
        handleCustomizePreset={vi.fn()}
        emptyMessage="No preset compositions available for Urban Low Height"
      />,
    );

    expect(screen.getByText("No preset compositions available for Urban Low Height")).toBeTruthy();
  });

  it("renders the Class empty message", () => {
    renderGrid(
      <ProductModelsGrid
        data={[]}
        handleAddPreset={vi.fn()}
        handleCustomizePreset={vi.fn()}
        emptyMessage="No preset compositions available for Class"
      />,
    );

    expect(screen.getByText("No preset compositions available for Class")).toBeTruthy();
  });
});
