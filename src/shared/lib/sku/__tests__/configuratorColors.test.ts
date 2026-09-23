import { describe, expect, it } from "vitest";

import configurator9 from "@/entities/collection/__tests__/fixtures/remote/configurator-9.json";
import { makoProfile } from "@/entities/collection/__tests__/makoProfileFixture";
import type { ConfiguratorGroupCatalog } from "@/entities/collection/model/types";
import type { ConfiguratorAvailableOption } from "@/entities/configurator/api/types";

import { createConfiguratorColorReader } from "../configuratorColors";

const groups = configurator9.availableOptions as unknown as ConfiguratorAvailableOption[];
const configurator: ConfiguratorGroupCatalog = {
  groups,
  groupsByName: Object.fromEntries(groups.map((group) => [group.proxyName, group])),
};

const read = createConfiguratorColorReader(makoProfile, configurator);

/**
 * The material codes Mako's colours used to get from the option category its profile listed.
 * The configurator gives the same ones, which is why the catalogs could be dropped: measured
 * across all 154 shipped colours, and locked here by their counts per section.
 */
const MATERIAL_CODES: Record<string, Record<string, number>> = {
  CabinetColor: { LACM: 20, LACG: 20 },
  HandleColor: { LACM: 20, MTL: 2 },
  LegColor: { LACM: 20, MTL: 2 },
  CountertopColor: { GLSM: 20, GLSG: 20, POR: 15, HPL: 14, SSTL: 1 },
};

const SECTION_BY_ATTRIBUTE: Record<string, string> = {
  CabinetColor: "Select Cabinet Color",
  HandleColor: "Select Handle Color",
  LegColor: "Select Leg Color",
  CountertopColor: "Select Countertop Color",
};

describe("createConfiguratorColorReader", () => {
  it("reads the material SKU and the material name of an offered colour", () => {
    expect(read("CabinetColor", "Acqua 419 GL")).toEqual({ sku: "LACG", material: "Lacquered GL" });
    expect(read("HandleColor", "Gold")).toEqual({ sku: "MTL", material: "Metal" });
    expect(read("CountertopColor", "ARDESIA NERA 328")).toEqual({ sku: "POR", material: "Porcelain" });
  });

  it("keeps the two glass finishes apart by SKU, which the material name does not", () => {
    expect(read("CountertopColor", "Acqua 419 GL")).toEqual({ sku: "GLSG", material: "Glass" });
    expect(read("CountertopColor", "Acqua 419 MT")).toEqual({ sku: "GLSM", material: "Glass" });
  });

  it("reads nothing for a colour the configurator does not offer", () => {
    // In the section, but with no SKU: it can be neither priced nor ordered.
    expect(read("CabinetColor", "Agata BD GL")).toBeNull();
    expect(read("CabinetColor", "No Such Colour")).toBeNull();
  });

  it("reads nothing for an attribute that lists its own options", () => {
    // Shapes stay in the profile; only the colours name a configurator section.
    expect(read("DividersStyle", "Oak")).toBeNull();
    expect(read("sinkType", "LB440")).toBeNull();
  });

  it("reads nothing when the configurator is not loaded", () => {
    expect(createConfiguratorColorReader(makoProfile, null)("CabinetColor", "Acqua 419 GL")).toBeNull();
  });

  it("gives every colour the material code its profile category used to give", () => {
    Object.entries(SECTION_BY_ATTRIBUTE).forEach(([attributeId, section]) => {
      const counts: Record<string, number> = {};

      configurator.groupsByName[section]?.options.forEach((option) =>
        option.variants.forEach((variant) => {
          const value = (variant.metadata?.value as string | undefined) ?? variant.name;
          const color = read(attributeId, value);
          if (color) counts[color.sku] = (counts[color.sku] ?? 0) + 1;
        }),
      );

      expect(counts).toEqual(MATERIAL_CODES[attributeId]);
    });
  });
});
