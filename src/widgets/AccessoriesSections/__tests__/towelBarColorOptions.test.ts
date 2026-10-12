import { describe, expect, it } from "vitest";

import configurator11 from "@/entities/collection/__tests__/fixtures/remote/configurator-11.json";
import configurator13 from "@/entities/collection/__tests__/fixtures/remote/configurator-13.json";
import type { ConfiguratorAvailableOption } from "@/entities/configurator/api/types";

import { buildTowelBarColorOptions } from "../lib/towelBarColorOptions";

/** The five towel bar colours Urban Freestanding and Urban Duplex offer, in their configurators' order. */
const TOWEL_BAR_COLOURS = [
  "Bianco 0B MT",
  "Carbone 43 MT",
  "Metallizzato Copper M7 MT",
  "Metallizzato Creta M6 MT",
  "Nero 03 MT",
];

describe("buildTowelBarColorOptions", () => {
  it.each([
    ["Urban Freestanding", 11, configurator11],
    ["Urban Duplex", 13, configurator13],
  ])("offers %s the five lacquered matte colours of configurator %i", (_collection, _id, configurator) => {
    const options = buildTowelBarColorOptions(
      configurator.availableOptions as unknown as ConfiguratorAvailableOption[],
    );

    expect(options.map(({ name }) => name)).toEqual(TOWEL_BAR_COLOURS);
    // The material is on the variant: the option is named after the section.
    expect(options.every(({ desc }) => desc === "Lacquered MT")).toBe(true);
  });
});
