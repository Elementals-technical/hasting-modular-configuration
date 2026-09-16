import { describe, expect, it } from "vitest";

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

  it("returns empty mapped data when the optional group input is absent", () => {
    expect(adaptThreekitConfig(undefined, { profile: null })).toEqual({
      allMaterialValues: [],
      productElementOptions: [],
    });
  });
});
