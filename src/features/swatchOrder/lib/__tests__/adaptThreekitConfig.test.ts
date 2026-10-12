import { describe, expect, it } from "vitest";

import configurator11 from "@/entities/collection/__tests__/fixtures/remote/configurator-11.json";
import configurator13 from "@/entities/collection/__tests__/fixtures/remote/configurator-13.json";
import type { ConfiguratorAvailableOption } from "@/entities/configurator/api/types";

import { adaptThreekitConfig } from "../adaptThreekitConfig";

const groups: ConfiguratorAvailableOption[] = [
  {
    id: 10,
    proxyName: "Cabinet Color",
    proxyType: "material",
    enabled: true,
    metadata: {},
    options: [
      {
        id: 20,
        name: "Lacquer",
        resource: null,
        paramString: null,
        playcanvasString: null,
        variants: [
          {
            id: 30,
            name: "Test White",
            image: "white.jpg",
            enabled: true,
            description: "",
            metadata: {
              label: "White",
              value: "white",
              sku: "CAB-WHITE",
              Material: "Lacquer",
            },
          },
        ],
      },
    ],
  },
];

describe("adaptThreekitConfig", () => {
  it("maps normalized active-collection groups without an API response envelope", () => {
    const result = adaptThreekitConfig(groups, { profile: null });

    expect(result.productElementOptions).toHaveLength(1);
    expect(result.productElementOptions[0]).toMatchObject({
      id: "pe-10",
      value: "Cabinet Color",
      valuesArray: [
        {
          assetId: "30",
          label: "White",
          value: "white",
          metadata: {
            sku: "CAB-WHITE",
            Material: "Lacquer",
            image: "white.jpg",
          },
        },
      ],
    });
    expect(result.allMaterialValues).toHaveLength(1);
  });

  it("names the groups of a collection's own configurator as configurator 4 does", () => {
    const result = adaptThreekitConfig(configurator11.availableOptions as unknown as ConfiguratorAvailableOption[], {
      profile: null,
    });

    // Gloss White, without a SKU, is no swatch.
    expect(result.productElementOptions.map(({ value, valuesArray }) => [value, valuesArray.length])).toEqual([
      ["Cabinet Color", 235],
      ["Handle Groove Color", 252],
      ["Countertop Color", 60],
      ["Vessels", 49],
      ["Towel Bar Color", 5],
    ]);
  });

  it("offers each colour of Urban Duplex's two panel options once", () => {
    const result = adaptThreekitConfig(configurator13.availableOptions as unknown as ConfiguratorAvailableOption[], {
      profile: null,
    });
    const cabinet = result.productElementOptions.find(({ value }) => value === "Cabinet Color")?.valuesArray ?? [];

    expect(cabinet).toHaveLength(232);
    expect(new Set(cabinet.map(({ value }) => value)).size).toBe(232);
    expect(cabinet.find(({ value }) => value === "Bianco Calce DA ST")?.metadata?.Material).toBe("Soft-Touch");
  });

  it("returns empty mapped data when the optional group input is absent", () => {
    expect(adaptThreekitConfig(undefined, { profile: null })).toEqual({
      allMaterialValues: [],
      productElementOptions: [],
    });
  });
});
