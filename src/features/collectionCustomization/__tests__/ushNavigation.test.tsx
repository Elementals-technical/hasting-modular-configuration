// @vitest-environment jsdom

import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useCollectionPresets } from "@/entities/collection";
import { SideNavigation } from "@/widgets/SideNavigation/ui/SideNavigation";

import { NavigationProbe } from "./testUtils/NavigationProbe";
import { readNavigation } from "./testUtils/readNavigation";
import { buildReadyUshCollection, renderWithUshCollection } from "./testUtils/renderWithUshCollection";

const readyUsh = buildReadyUshCollection();

const renderUsh = (children: React.ReactNode, initialPath?: string) =>
  renderWithUshCollection(children, { data: readyUsh, initialPath });

const PresetsProbe = () => {
  const presets = useCollectionPresets();
  return <output data-testid="presets-count">{presets.length}</output>;
};

afterEach(cleanup);

describe("USH through the shared navigation/presets path", () => {
  it("keeps USH's own 6 prebuilt steps, in order", () => {
    renderUsh(<NavigationProbe flow="prebuilt" />);

    expect(readNavigation().steps.map((step) => step.stepId)).toEqual([
      "model",
      "cabinet",
      "countertop",
      "accessories",
      "faucet-holes",
      "summary",
    ]);
  });

  it("keeps USH's own 6 custom steps, in order", () => {
    renderUsh(<NavigationProbe flow="custom" />);

    expect(readNavigation().steps.map((step) => step.stepId)).toEqual([
      "cabinet-builder",
      "cabinet-colors",
      "countertop-custom",
      "accessories-custom",
      "faucet-holes",
      "summary",
    ]);
  });

  it("exposes USH's full 54-preset catalog", () => {
    renderUsh(<PresetsProbe />);

    expect(screen.getByTestId("presets-count").textContent).toBe("54");
  });

  it("carries every preset's own product list, 123 items total across the catalog", () => {
    const total = readyUsh.catalog.presets?.reduce((sum, preset) => sum + preset.presetProducts.length, 0) ?? 0;

    expect(total).toBe(123);
  });

  it("renders USH's 6 prebuilt step labels through the real SideNavigation widget", () => {
    renderUsh(<SideNavigation />, "/prebuilt/model?collectionId=urban-standard-height");

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(6);
    expect(links[0].textContent).toBe("Model");
    expect(links[links.length - 1].textContent).toBe("Summary");
  });
});
