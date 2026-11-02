import { describe, expect, it } from "vitest";

import {
  LEGACY_MATERIAL_HIERARCHY,
  filterOptionsByMaterialTree,
  groupMaterialsHierarchically,
  nestGbMaterials,
  toFilterOptions,
} from "../materialFilters";
import type { ProductOptionData } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";

const colour = (title: string, material: string, gbMaterial?: string): ProductOptionData => ({
  id: title,
  title,
  desc: material,
  isShortDesc: false,
  metadata: { materials: [material], gbMaterial, value: title },
});

// Tricot's countertop colours as configurator 12 names them: Material and GBMaterial.
const technolite = colour("Matte White", "Solid Surface", "Technolite");
const technomat = colour("Matte White 8cm", "Solid Surface", "Technomat");
const glassGloss = colour("Zaffiro 411 GL", "Glass GL", "Glass Gloss");
const hpl = colour("Calacatta 259", "HPL", "HPL");

const groupOf = (value: string) => LEGACY_MATERIAL_HIERARCHY.find((group) => group.value === value);

describe("GB materials of a header material", () => {
  it("file a Solid Surface colour under its GB material, nested under the Solid Surface header", () => {
    const { options, hierarchy } = nestGbMaterials([technolite, technomat]);

    expect(options.map(({ desc, metadata }) => [desc, metadata?.materials])).toEqual([
      ["Technolite", ["Technolite"]],
      ["Technomat", ["Technomat"]],
    ]);
    expect(hierarchy.find((group) => group.value === "solid-surface")?.childValues).toEqual([
      ...(groupOf("solid-surface")?.childValues ?? []),
      "Technolite",
      "Technomat",
    ]);
    expect(hierarchy.find((group) => group.value === "glass")).toEqual(groupOf("glass"));
  });

  it("leave a colour of a child material, of no group or without a GB material as it is", () => {
    const options = [glassGloss, hpl, colour("Bianco 1A1", "Tekorlux"), colour("Matte White", "Solid Surface")];
    const nested = nestGbMaterials(options);

    expect(nested.options).toEqual(options);
    expect(nested.hierarchy).toEqual(LEGACY_MATERIAL_HIERARCHY);
  });
});

describe("material filter tree", () => {
  const { options, hierarchy } = nestGbMaterials([technolite, technomat, glassGloss, hpl]);
  const tree = groupMaterialsHierarchically(
    toFilterOptions(new Set(options.flatMap(({ metadata }) => metadata?.materials ?? []))),
    hierarchy,
  );
  const titlesOf = (material: string) =>
    filterOptionsByMaterialTree(options, tree, { material }).map(({ title }) => title);

  it("nests the GB materials under their header", () => {
    expect(tree.find(({ label }) => label === "Solid Surface")?.children?.map(({ value }) => value)).toEqual([
      "Technolite",
      "Technomat",
    ]);
  });

  it("keeps every colour under a header, and one type alone", () => {
    expect(titlesOf("Solid Surface")).toEqual(["Matte White", "Matte White 8cm"]);
    expect(titlesOf("Technomat")).toEqual(["Matte White 8cm"]);
    expect(titlesOf("Glass")).toEqual(["Zaffiro 411 GL"]);
    expect(titlesOf("HPL")).toEqual(["Calacatta 259"]);
  });
});
