import { describe, expect, it } from "vitest";

import configurator11 from "@/entities/collection/__tests__/fixtures/remote/configurator-11.json";
import configurator12 from "@/entities/collection/__tests__/fixtures/remote/configurator-12.json";
import configurator13 from "@/entities/collection/__tests__/fixtures/remote/configurator-13.json";
import configurator14 from "@/entities/collection/__tests__/fixtures/remote/configurator-14.json";
import {
  configuratorSchema,
  parseProductProfile,
  selectDefaultValue,
  selectOptionValues,
  type ConfiguratorGroupCatalog,
  type ProductProfile,
} from "@/entities/collection";

import lameManifest from "../../../../public/collections/lame/manifest.json";
import lameProfileDocument from "../../../../public/collections/lame/product-profile.json";
import tricotManifest from "../../../../public/collections/tricot/manifest.json";
import tricotProfileDocument from "../../../../public/collections/tricot/product-profile.json";
import urbanDuplexManifest from "../../../../public/collections/urban-duplex/manifest.json";
import urbanDuplexProfileDocument from "../../../../public/collections/urban-duplex/product-profile.json";
import urbanFreestandingManifest from "../../../../public/collections/urban-freestanding/manifest.json";
import urbanFreestandingPresets from "../../../../public/collections/urban-freestanding/presets.json";
import urbanFreestandingUi from "../../../../public/collections/urban-freestanding/ui.json";
import urbanFreestandingProfileDocument from "../../../../public/collections/urban-freestanding/product-profile.json";
import { resolveConfiguratorOptions } from "../lib/resolveSectionState";

/**
 * Urban Freestanding, Tricot, Urban Duplex and Lame read their colours from their own material
 * configurators, 11 to 14, recorded as Render Admin returns them.
 */

const parseProfile = (document: unknown): ProductProfile => {
  const result = parseProductProfile(document);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.profile;
};

/** A recorded configurator as the loader indexes it. */
const catalogOf = (document: unknown): ConfiguratorGroupCatalog => {
  const { availableOptions } = configuratorSchema.parse(document);
  return {
    groups: availableOptions,
    groupsByName: Object.fromEntries(availableOptions.map((group) => [group.proxyName, group])),
  };
};

const COLLECTIONS = [
  {
    collection: "urban-freestanding",
    configuratorId: 11,
    manifest: urbanFreestandingManifest,
    profile: parseProfile(urbanFreestandingProfileDocument),
    configurator: catalogOf(configurator11),
  },
  {
    collection: "tricot",
    configuratorId: 12,
    manifest: tricotManifest,
    profile: parseProfile(tricotProfileDocument),
    configurator: catalogOf(configurator12),
  },
  {
    collection: "urban-duplex",
    configuratorId: 13,
    manifest: urbanDuplexManifest,
    profile: parseProfile(urbanDuplexProfileDocument),
    configurator: catalogOf(configurator13),
  },
  {
    collection: "lame",
    configuratorId: 14,
    manifest: lameManifest,
    profile: parseProfile(lameProfileDocument),
    configurator: catalogOf(configurator14),
  },
];

const [URBAN_FREESTANDING, , URBAN_DUPLEX] = COLLECTIONS;

describe.each(COLLECTIONS)("$collection colours", ({ configuratorId, manifest, profile, configurator }) => {
  const sourced = profile.attributes.filter(({ optionsSource }) => optionsSource);

  it("come from its own configurator, which its manifest and its profile both name", () => {
    expect(manifest.remote.configurator.id).toBe(configuratorId);
    expect(profile.sourceRefs?.configuratorId).toBe(configuratorId);
  });

  it("are offered for every attribute that names a configurator section", () => {
    expect(sourced.length).toBeGreaterThan(0);
    for (const { attributeId } of sourced) {
      expect(resolveConfiguratorOptions(profile, attributeId, configurator).length, attributeId).toBeGreaterThan(0);
    }
  });

  it("start from colours the section offers", () => {
    for (const { attributeId, resetValue } of sourced) {
      const initial = selectDefaultValue(profile, attributeId);
      // An empty default chooses no colour.
      if (!initial || initial === resetValue) continue;
      expect(
        resolveConfiguratorOptions(profile, attributeId, configurator).map(({ value }) => value),
        attributeId,
      ).toContain(initial);
    }
  });
});

describe("urban duplex panels", () => {
  const { profile, configurator } = URBAN_DUPLEX;

  it.each([
    ["BasePanelColor", "Base Panel"],
    ["LateralPanelColor", "Lateral Panel"],
  ])("offer %s the colours of its own option of the shared cabinet group, each once", (attributeId, option) => {
    const colours = resolveConfiguratorOptions(profile, attributeId, configurator);

    expect(colours).toHaveLength(232);
    expect(new Set(colours.map(({ value }) => value)).size).toBe(232);
    // The option names a panel, not a material.
    expect(colours.some(({ desc, traits }) => desc === option || traits?.materials?.includes(option))).toBe(false);
    expect(colours.find(({ value }) => value === "Bianco Calce DA ST")).toMatchObject({
      desc: "Soft-Touch",
      traits: { sku: "ST", materials: ["Soft-Touch"] },
    });
  });
});

describe("urban freestanding countertop", () => {
  const { profile, configurator } = URBAN_FREESTANDING;

  // The defaults of the Hastings website's configurator (Threekit asset a48171b0, read 2026-10-09).
  it("starts as the website does: brushed steel under a matte Statuario porcelain top with a Cover basin", () => {
    expect(selectDefaultValue(profile, "CabinetColor")).toBe("Metal acciaio 2MA");
    expect(selectDefaultValue(profile, "CountertopColor")).toBe("Bianco Statuario Venato Matte TQV");
    expect(selectDefaultValue(profile, "sinkType")).toBe("Top_Porcelain_Cover");
    expect(selectDefaultValue(profile, "FaucetHolesAmount")).toBe("0");
    expect(selectOptionValues(profile, "sinkType")).toContain("Top_Porcelain_Cover");
  });

  it("offers the 60 colours with a SKU: Gloss White has none", () => {
    const colours = resolveConfiguratorOptions(profile, "CountertopColor", configurator).map(({ value }) => value);

    expect(colours).toHaveLength(60);
    expect(colours).toContain("Pulpis Chiaro TKH");
    expect(colours).not.toContain("Gloss White");
  });
});

describe("urban freestanding models", () => {
  const { profile, configurator } = URBAN_FREESTANDING;
  const products = urbanFreestandingPresets.flatMap(({ presetProducts }) => presetProducts);
  const offered = (attributeId: string) =>
    resolveConfiguratorOptions(profile, attributeId, configurator).map(({ value }) => value);

  // The renders and the website show brushed steel cabinets under a matte Statuario porcelain top.
  it("are built in the materials their renders show, with the website's Cover basin", () => {
    expect(new Set(products.map(({ CabinetColor }) => CabinetColor))).toEqual(new Set(["Metal acciaio 2MA"]));
    expect(new Set(products.map(({ CountertopColor }) => CountertopColor))).toEqual(
      new Set(["Bianco Statuario Venato Matte TQV"]),
    );
    expect(new Set(products.map((product) => (product.name === "Sink-Base" ? product.sinkType : "no basin")))).toEqual(
      new Set(["Top_Porcelain_Cover", "no basin"]),
    );
  });

  it("take those materials from configurator 11 and the basin from the profile", () => {
    expect(offered("CabinetColor")).toContain("Metal acciaio 2MA");
    expect(offered("CountertopColor")).toContain("Bianco Statuario Venato Matte TQV");
    expect(selectOptionValues(profile, "sinkType")).toContain("Top_Porcelain_Cover");
  });
});

/** Every file of the Urban Freestanding image folder, keyed by its path from the collection folder. */
const urbanFreestandingImages = new Set(
  Object.keys(import.meta.glob("/public/collections/urban-freestanding/images/**/*", { query: "?url" })).map((path) =>
    path.replace("/public/collections/urban-freestanding/", ""),
  ),
);

describe("urban freestanding basin pictures", () => {
  it("shows Urban Standard Height's pictures for every basin but the vessel cutout, and ships each", () => {
    const pictures: Record<string, string> = urbanFreestandingUi.optionImages.sinkType;
    const basins = selectOptionValues(URBAN_FREESTANDING.profile, "sinkType");

    expect(basins.filter((basin) => !pictures[basin])).toEqual(["Vessel"]);
    for (const picture of Object.values(pictures)) expect(urbanFreestandingImages.has(picture), picture).toBe(true);
  });
});
