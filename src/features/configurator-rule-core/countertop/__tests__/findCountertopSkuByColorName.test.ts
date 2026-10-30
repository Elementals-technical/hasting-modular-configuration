import { describe, expect, it } from "vitest";

import type { ConfiguratorAvailableOption } from "@/entities/configurator/api/types";

import { findCountertopSkuByColorName } from "../findCountertopSkuByColorName";

const groups: ConfiguratorAvailableOption[] = [
  {
    id: 1,
    proxyName: "Countertop Color",
    proxyType: "material",
    enabled: true,
    metadata: {},
    options: [
      {
        id: 2,
        name: "Porcelain",
        resource: null,
        paramString: null,
        playcanvasString: null,
        variants: [
          {
            id: 3,
            name: "Snow",
            image: null,
            enabled: true,
            description: "",
            metadata: { value: "snow", sku: "SOURCE-SKU" },
          },
        ],
      },
    ],
  },
];

describe("findCountertopSkuByColorName", () => {
  it("resolves a countertop SKU from normalized active-collection groups", () => {
    expect(findCountertopSkuByColorName(groups, "snow")).toBe("POR");
  });

  it("returns an empty result for absent groups or an unknown color", () => {
    expect(findCountertopSkuByColorName(undefined, "snow")).toBe("");
    expect(findCountertopSkuByColorName(groups, "unknown")).toBe("");
  });
});
