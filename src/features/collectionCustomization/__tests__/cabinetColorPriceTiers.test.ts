import { describe, expect, it } from "vitest";

import classProfileDocument from "../../../../public/collections/class/product-profile.json";
import configurator8 from "@/entities/collection/__tests__/fixtures/remote/configurator-8.json";
import { tricotConfigurator, tricotProfile } from "@/entities/collection/__tests__/tricotFixtures";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import { parseProductProfile, selectPriceTierOverride, type ProductProfile } from "@/entities/collection";
import type { ConfiguratorAvailableOption } from "@/entities/configurator/api/types";
import type { ProductOptionData } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";
import { buildTierFilterOptions, filterOptionsByTier } from "@/shared/constants/priceFilters";
import { buildConfiguratorOptions } from "../lib/buildConfiguratorOptions";

const parsedClass = parseProductProfile(classProfileDocument);
if (!parsedClass.ok) throw new Error(JSON.stringify(parsedClass.diagnostics));
const classProfile = parsedClass.profile;
const classCabinetColors = (configurator8.availableOptions as unknown as ConfiguratorAvailableOption[]).find(
  ({ proxyName }) => proxyName === "Select Cabinet Color",
);

/** The colours of a section as the colour grid ranks them: by their configurator traits. */
const toGridOptions = (group: ConfiguratorAvailableOption | undefined): ProductOptionData[] =>
  buildConfiguratorOptions(group).map((option, index) => ({
    id: index,
    title: option.label ?? option.value,
    desc: option.desc,
    isShortDesc: false,
    metadata: { ...option.traits, value: option.value },
  }));

const skusByTier = (options: ProductOptionData[], profile: ProductProfile | null) => {
  const override = selectPriceTierOverride(profile, "CabinetColor");
  return Object.fromEntries(
    buildTierFilterOptions(options, override).map(({ value }) => [
      value,
      [...new Set(filterOptionsByTier(options, value, override).map((option) => option.metadata?.sku))].sort(),
    ]),
  );
};

describe("cabinet colour price tiers of a collection", () => {
  it("rank Tricot's Lacquered MT as Standard $ and its Wood Veneer as Classic $$, all 23 colours", () => {
    const options = toGridOptions(tricotConfigurator.groupsByName["Select Cabinet Color"]);
    const override = selectPriceTierOverride(tricotProfile, "CabinetColor");

    expect(filterOptionsByTier(options, "tier-1", override)).toHaveLength(20);
    expect(filterOptionsByTier(options, "tier-2", override)).toHaveLength(3);
    expect(skusByTier(options, tricotProfile)).toEqual({ "tier-1": ["LACM"], "tier-2": ["WDV"] });
  });

  it("rank Class Wood Veneer as Specialty $$$ and leave its other colours as the shared table ranks them", () => {
    const options = toGridOptions(classCabinetColors);
    const shared = skusByTier(options, null);
    const own = skusByTier(options, classProfile);

    expect(Object.values(shared).flat()).not.toContain("WDV");
    expect(own).toEqual({ ...shared, "tier-3": [...shared["tier-3"], "WDV"].sort() });
    expect(filterOptionsByTier(options, "tier-3", selectPriceTierOverride(classProfile, "CabinetColor"))).toEqual(
      expect.arrayContaining(options.filter((option) => option.metadata?.sku === "WDV")),
    );
  });

  it("are the shared table's for a collection or a field without its own", () => {
    expect(selectPriceTierOverride(ushProfile, "CabinetColor")).toBeUndefined();
    expect(selectPriceTierOverride(tricotProfile, "HandleGrooveColor")).toBeUndefined();
    expect(selectPriceTierOverride(null, "CabinetColor")).toBeUndefined();
  });
});
