// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProductModelsGrid } from "../ProductModelsGrid";

describe("ProductModelsGrid", () => {
  it("renders a collection-specific empty message", () => {
    render(
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
    render(
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
