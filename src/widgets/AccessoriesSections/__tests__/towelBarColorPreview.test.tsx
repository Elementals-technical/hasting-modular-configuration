// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { afterEach, describe, expect, it } from "vitest";

import { store } from "@/app/store";
import configurator11 from "@/entities/collection/__tests__/fixtures/remote/configurator-11.json";
import configurator13 from "@/entities/collection/__tests__/fixtures/remote/configurator-13.json";
import type { ConfiguratorAvailableOption } from "@/entities/configurator/api/types";
import { ProductOptionsGrid } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";

import { buildTowelBarColorOptions } from "../lib/towelBarColorOptions";

afterEach(cleanup);

const renderColours = (configurator: { availableOptions: unknown }) => {
  const options = buildTowelBarColorOptions(configurator.availableOptions as ConfiguratorAvailableOption[]);
  render(
    <Provider store={store}>
      <ProductOptionsGrid data={options} groupByDesc />
    </Provider>,
  );
  return options;
};

describe("the towel bar colours' Preview", () => {
  it.each([
    ["Urban Freestanding", 11, configurator11],
    ["Urban Duplex", 13, configurator13],
  ])("is offered for every colour of %s (configurator %i)", (_collection, _id, configurator) => {
    const options = renderColours(configurator);

    expect(options).toHaveLength(5);
    options.forEach(({ title }) => {
      expect(screen.queryByRole("button", { name: `Preview ${title}` })).not.toBeNull();
    });
  });

  // The metallics have a picture and no hex.
  it.each(["Metallizzato Copper M7 MT", "Metallizzato Creta M6 MT"])("shows the picture of %s", (title) => {
    const options = renderColours(configurator11);
    const picture = options.find((option) => option.title === title)?.metadata?.image;

    fireEvent.click(screen.getByRole("button", { name: `Preview ${title}` }));

    expect(picture).toBeTruthy();
    expect(screen.getByRole("img", { name: title }).getAttribute("src")).toBe(picture);
  });
});
