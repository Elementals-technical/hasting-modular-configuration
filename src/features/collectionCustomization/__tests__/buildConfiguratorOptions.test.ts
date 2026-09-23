import { describe, expect, it } from "vitest";

import configurator9 from "@/entities/collection/__tests__/fixtures/remote/configurator-9.json";
import type { ConfiguratorAvailableOption } from "@/entities/configurator/api/types";

import { buildConfiguratorOptions } from "../lib/buildConfiguratorOptions";

const section = (proxyName: string): ConfiguratorAvailableOption =>
  configurator9.availableOptions.find((group) => group.proxyName === proxyName) as ConfiguratorAvailableOption;

/**
 * The two configurators say where the material is in opposite ways: configurator 4 splits a section
 * into one option per material, configurator 9 keeps one option named after the attribute and names
 * the material on each variant. The builder has to read both without the collections disagreeing.
 */
describe("buildConfiguratorOptions", () => {
  describe("a section split into one option per material (configurator 4)", () => {
    // Real shape of configurator 4's Countertop Color: the option name is the narrower material and
    // the variant's own Material is coarser. Grouping by the variant would merge Glass MT and GL.
    const countertopColor: ConfiguratorAvailableOption = {
      id: 1,
      proxyName: "Countertop Color",
      proxyType: "material",
      enabled: true,
      metadata: {},
      options: [
        {
          id: 10,
          name: "Glass MT",
          resource: null,
          paramString: null,
          playcanvasString: null,
          variants: [
            {
              id: 100,
              name: "Acqua 419 MT",
              image: null,
              enabled: true,
              description: "",
              metadata: { sku: "GLSM", value: "Acqua 419 MT", Material: "Lacquered MT" },
            },
          ],
        },
        {
          id: 11,
          name: "Glass GL",
          resource: null,
          paramString: null,
          playcanvasString: null,
          variants: [
            {
              id: 110,
              name: "Acqua 419 GL",
              image: null,
              enabled: true,
              description: "",
              metadata: { sku: "GLSG", value: "Acqua 419 GL", Material: "Lacquered GL" },
            },
          ],
        },
      ],
    };

    it("groups by the option name and keeps the variant's own material as a filter token", () => {
      const options = buildConfiguratorOptions(countertopColor);

      expect(options.map((option) => option.desc)).toEqual(["Glass MT", "Glass GL"]);
      expect(options[0]?.traits?.materials).toEqual(["Glass MT", "Lacquered MT"]);
    });

    it("leaves the section name out of the material tokens", () => {
      const materials = buildConfiguratorOptions(countertopColor).flatMap((option) => option.traits?.materials ?? []);

      expect(materials).not.toContain("Countertop Color");
    });
  });

  describe("a section held in one option (configurator 9)", () => {
    it("groups by the material the variant names, not by the option", () => {
      const descriptions = buildConfiguratorOptions(section("Select Cabinet Color")).map((option) => option.desc);

      // The single option is named after the attribute, so grouping by it would be one bucket.
      expect([...new Set(descriptions)].sort()).toEqual(["Lacquered GL", "Lacquered MT"]);
      expect(descriptions).not.toContain("Cabinet Color");
    });

    it("keeps the section name out of the material filter", () => {
      const materials = buildConfiguratorOptions(section("Select Cabinet Color")).flatMap(
        (option) => option.traits?.materials ?? [],
      );

      expect([...new Set(materials)]).toEqual(["Lacquered GL", "Lacquered MT"]);
      expect(materials).not.toContain("Select Cabinet Color");
    });

    it("carries the swatch colour and the SKU the price reads", () => {
      const [first] = buildConfiguratorOptions(section("Select Cabinet Color"));

      expect(first?.value).toBe("Acqua 419 GL");
      expect(first?.traits?.hex).toBe("#7098ab");
      expect(first?.traits?.sku).toBe("LACG");
    });

    it("does not offer a colour that has no SKU, because it can be neither priced nor ordered", () => {
      const group = section("Select Cabinet Color");
      const offered = buildConfiguratorOptions(group).map((option) => option.value);
      const withoutSku = group.options
        .flatMap((option) => option.variants)
        .filter((variant) => !variant.metadata?.sku)
        .map((variant) => variant.name);

      expect(offered).toHaveLength(40);
      expect(withoutSku.length).toBeGreaterThan(0);
      withoutSku.forEach((value) => expect(offered).not.toContain(value));
    });

    it("reads a section whose materials are not lacquer the same way", () => {
      const options = buildConfiguratorOptions(section("Select Countertop Color"));

      expect([...new Set(options.map((option) => option.desc))].sort()).toEqual([
        "Glass",
        "HPL",
        "Porcelain",
        "Solid Surface",
      ]);
      // The material name merges the two glass finishes; the SKU keeps them apart for the price.
      expect([...new Set(options.map((option) => option.traits?.sku))].sort()).toEqual([
        "GLSG",
        "GLSM",
        "HPL",
        "POR",
        "SSTL",
      ]);
    });
  });
});
