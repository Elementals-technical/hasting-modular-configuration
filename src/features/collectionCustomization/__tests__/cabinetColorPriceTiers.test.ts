import { describe, expect, it } from "vitest";

import classProfileDocument from "../../../../public/collections/class/product-profile.json";
import classUi from "../../../../public/collections/class/ui.json";
import lameProfileDocument from "../../../../public/collections/lame/product-profile.json";
import lameUi from "../../../../public/collections/lame/ui.json";
import makoProfileDocument from "../../../../public/collections/mako/product-profile.json";
import makoUi from "../../../../public/collections/mako/ui.json";
import tricotUi from "../../../../public/collections/tricot/ui.json";
import configurator8 from "@/entities/collection/__tests__/fixtures/remote/configurator-8.json";
import configurator9 from "@/entities/collection/__tests__/fixtures/remote/configurator-9.json";
import configurator14 from "@/entities/collection/__tests__/fixtures/remote/configurator-14.json";
import { tricotConfigurator, tricotProfile } from "@/entities/collection/__tests__/tricotFixtures";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import {
  configuratorSchema,
  parseProductProfile,
  selectPriceTierOverride,
  type ConfiguratorGroupCatalog,
  type ProductProfile,
} from "@/entities/collection";
import type { FieldOptionState } from "@/entities/collection";
import type { ProductOptionData } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";
import { buildTierFilterOptions, filterOptionsByTier, TIER_DEFINITIONS } from "@/shared/constants/priceFilters";
import { resolveConfiguratorOptions } from "../lib/resolveSectionState";

/**
 * The client's 'list material' > Material Pricing Tiers, GB block: the tiers of Tricot, Lame, Mako
 * and Class. A material it does not list keeps the shared (Azzurra) table's tier.
 */
const GB_TIERS: Record<string, number> = {
  LACM: 2,
  LACG: 3,
  LAM: 1,
  POR: 4,
  HPL: 4,
  SSMT: 2,
  SSGL: 2,
  SSTL: 2,
  SSTM: 2,
  SSTEX: 2,
  SSTMT: 1,
  GLSM: 2,
  GLSG: 2,
  SGLS: 2,
  WDV: 3,
  MTL: 1,
};

/** The colour fields whose configurator group offers the Metal colours, Gold and Silver (SKU MTL). */
const METAL_FIELDS: Record<string, string[]> = {
  tricot: [],
  lame: ["HandleColor", "LegColor", "UndertopColor"],
  mako: ["HandleColor", "LegColor"],
  class: [],
};

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

type UiDocument = { sections: Record<string, { fields?: { attributeId: string; control: string }[] }> };

/** The fields a collection shows as colour grids, the ones with a price filter. */
const colourFieldsOf = (ui: UiDocument) =>
  Object.values(ui.sections)
    .flatMap(({ fields = [] }) => fields)
    .filter(({ control }) => control === "colors")
    .map(({ attributeId }) => attributeId);

const GB_COLLECTIONS = [
  { id: "tricot", profile: tricotProfile, configurator: tricotConfigurator, ui: tricotUi },
  { id: "lame", profile: parseProfile(lameProfileDocument), configurator: catalogOf(configurator14), ui: lameUi },
  { id: "mako", profile: parseProfile(makoProfileDocument), configurator: catalogOf(configurator9), ui: makoUi },
  { id: "class", profile: parseProfile(classProfileDocument), configurator: catalogOf(configurator8), ui: classUi },
].map(({ ui, ...collection }) => ({ ...collection, colourFields: colourFieldsOf(ui as UiDocument) }));

/** The colours of a field as the colour grid ranks them: by their configurator traits. */
const toGridOptions = (options: FieldOptionState[]): ProductOptionData[] =>
  options.map((option, index) => ({
    id: index,
    title: option.label ?? option.value,
    desc: option.desc,
    isShortDesc: false,
    metadata: { ...option.traits, value: option.value },
  }));

const tricotColours = (attributeId: string) =>
  toGridOptions(resolveConfiguratorOptions(tricotProfile, attributeId, tricotConfigurator));

const tierOf = (option: ProductOptionData, profile: ProductProfile | null, attributeId: string) => {
  const override = selectPriceTierOverride(profile, attributeId);
  return TIER_DEFINITIONS.find(({ value }) => filterOptionsByTier([option], value, override).length > 0)?.tier;
};

const skusByTier = (options: ProductOptionData[], profile: ProductProfile | null, attributeId: string) => {
  const override = selectPriceTierOverride(profile, attributeId);
  return Object.fromEntries(
    buildTierFilterOptions(options, override).map(({ value }) => [
      value,
      [...new Set(filterOptionsByTier(options, value, override).map((option) => option.metadata?.sku))].sort(),
    ]),
  );
};

describe.each(GB_COLLECTIONS)("$id colour price tiers", ({ id, profile, configurator, colourFields }) => {
  it("are the GB block of the client's Material Pricing Tiers", () => {
    expect(profile.ruleData.priceTiers).toEqual({ bySku: GB_TIERS });
  });

  it("rank the Metal colours, Gold and Silver, as Standard $", () => {
    const optionsOf = (attributeId: string) => resolveConfiguratorOptions(profile, attributeId, configurator);
    const metalFields = colourFields.filter((attributeId) =>
      optionsOf(attributeId).some(({ traits }) => traits?.sku?.trim().toUpperCase() === "MTL"),
    );
    expect(metalFields).toEqual(METAL_FIELDS[id]);

    for (const attributeId of metalFields) {
      const options = toGridOptions(optionsOf(attributeId));
      const override = selectPriceTierOverride(profile, attributeId);

      expect(buildTierFilterOptions(options, override)[0], attributeId).toMatchObject({ label: "Standard $" });
      expect(
        filterOptionsByTier(options, "tier-1", override)
          .map(({ metadata }) => metadata?.value)
          .sort(),
      ).toEqual(["Gold", "Silver"]);
    }
  });

  it.each(colourFields)("rank %s by the GB block, a material it does not list by the shared table", (attributeId) => {
    const options = toGridOptions(resolveConfiguratorOptions(profile, attributeId, configurator));
    expect(options.length, attributeId).toBeGreaterThan(0);

    for (const option of options) {
      const sku = option.metadata?.sku?.trim().toUpperCase() ?? "";
      const expected = GB_TIERS[sku] ?? tierOf(option, null, attributeId);
      expect({ colour: option.metadata?.value, sku, tier: tierOf(option, profile, attributeId) }).toEqual({
        colour: option.metadata?.value,
        sku,
        tier: expected,
      });
    }
  });
});

describe("Tricot colour price tiers", () => {
  it("rank its 20 Lacquered MT cabinet colours as Classic $$ and its 3 Wood Veneer ones as Specialty $$$", () => {
    const options = tricotColours("CabinetColor");

    expect(skusByTier(options, tricotProfile, "CabinetColor")).toEqual({ "tier-2": ["LACM"], "tier-3": ["WDV"] });
    expect(filterOptionsByTier(options, "tier-2", selectPriceTierOverride(tricotProfile, "CabinetColor"))).toHaveLength(
      20,
    );
  });

  it("rank all 20 Lacquered MT handle groove colours as Classic $$ alone", () => {
    const options = tricotColours("HandleGrooveColor");
    const override = selectPriceTierOverride(tricotProfile, "HandleGrooveColor");

    expect(buildTierFilterOptions(options, override).map(({ value }) => value)).toEqual(["tier-2"]);
    expect(filterOptionsByTier(options, "tier-2", override)).toHaveLength(20);
  });

  it("rank every one of the 71 countertop colours, Matte White as Classic $$", () => {
    const options = tricotColours("CountertopColor");
    const override = selectPriceTierOverride(tricotProfile, "CountertopColor");
    const ranked = buildTierFilterOptions(options, override).flatMap(({ value }) =>
      filterOptionsByTier(options, value, override),
    );

    expect(skusByTier(options, tricotProfile, "CountertopColor")).toEqual({
      "tier-1": ["SSTMT"],
      "tier-2": ["GLSG", "GLSM", "SSTL"],
      "tier-4": ["HPL", "POR"],
    });
    expect(ranked).toHaveLength(71);
  });

  it("rank its Lacquered MT vessel colours as Classic $$ and its Lacquered GL ones as Specialty $$$", () => {
    expect(skusByTier(tricotColours("VesselColor"), tricotProfile, "VesselColor")).toEqual({
      "tier-2": ["LACM"],
      "tier-3": ["LACG"],
    });
  });
});

describe("a collection's own price tiers", () => {
  const withTiers = (priceTiers: ProductProfile["ruleData"]["priceTiers"]): ProductProfile => ({
    ...tricotProfile,
    ruleData: { ...tricotProfile.ruleData, priceTiers },
  });

  it("give a field its own tiers over the collection's", () => {
    const profile = withTiers({ bySku: { LACM: 2, WDV: 3 }, byAttribute: { CabinetColor: { WDV: 4 } } });

    expect(selectPriceTierOverride(profile, "CabinetColor")).toEqual({ bySku: { LACM: 2, WDV: 4 } });
    expect(selectPriceTierOverride(profile, "HandleGrooveColor")).toEqual({ bySku: { LACM: 2, WDV: 3 } });
  });

  it("are the shared table's for a collection or a field without its own", () => {
    expect(selectPriceTierOverride(ushProfile, "CabinetColor")).toBeUndefined();
    expect(selectPriceTierOverride(withTiers({ byAttribute: { CabinetColor: { WDV: 3 } } }), "VesselColor")).toBe(
      undefined,
    );
    expect(selectPriceTierOverride(null, "CabinetColor")).toBeUndefined();
  });
});
